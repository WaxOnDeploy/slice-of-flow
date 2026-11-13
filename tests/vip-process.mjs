import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { constants } from 'node:os';

export const PROCESS_CLEANUP = Object.freeze({ graceMs: 1500, forceMs: 1500 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const positive = (name, value) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a finite positive number`);
};
function send(pid, signal) {
  try { process.kill(pid, signal); return true; } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}
async function processTable() {
  const table = new Map();
  const entries = await readdir('/proc');
  await Promise.all(entries.filter(entry => /^\d+$/.test(entry)).map(async entry => {
    try {
      const text = await readFile(`/proc/${entry}/stat`, 'utf8');
      const fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
      table.set(Number(entry), { state: fields[0], parent: Number(fields[1]), group: Number(fields[2]), start: fields[19] });
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
    }
  }));
  return table;
}
const executing = info => info && !['Z', 'X'].includes(info.state);

// The leader has a fresh POSIX group. On Linux also remember its descendants
// by PID + kernel start time: Playwright creates detached browser groups. Never
// discover ownership by executable name, port, or user; never signal stale PIDs.
function ownedTree(pid) {
  const known = new Map();
  let scanning;
  const scan = () => scanning ||= (async () => {
    const table = await processTable();
    if (!known.has(pid) && table.has(pid)) known.set(pid, table.get(pid).start);
    const groupStillOwned = [...table].some(([id, info]) => info.group === pid && known.get(id) === info.start);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, info] of table) {
        const parent = table.get(info.parent);
        const isChild = parent && known.get(info.parent) === parent.start;
        if (!known.has(id) && ((info.group === pid && groupStillOwned) || isChild)) {
          known.set(id, info.start); changed = true;
        }
      }
    }
    return new Map([...table].filter(([id, info]) => known.get(id) === info.start && executing(info)));
  })().finally(() => { scanning = undefined; });
  let pollingError;
  const timer = process.platform === 'linux' ? setInterval(() => { scan().catch(error => { pollingError = error; }); }, 50) : undefined;
  const active = async () => {
    if (pollingError) throw pollingError;
    if (process.platform === 'linux') return scan();
    return send(-pid, 0) ? new Map([[pid, {}]]) : new Map();
  };
  return {
    active,
    async signal(signal) {
      const members = await active();
      // Revalidate each identity immediately before signalling; a scan and signal
      // are not atomic, but start-time checks avoid reuse of remembered stale PIDs.
      if (process.platform === 'linux') {
        for (const [id, info] of members) {
          try {
            const text = await readFile(`/proc/${id}/stat`, 'utf8');
            const fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
            if (fields[19] === info.start && !['Z', 'X'].includes(fields[0])) send(id, signal);
          } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
        }
      }
      // Covers inherited descendants born just after the ownership scan, but only
      // while a verified member still anchors ownership of the original group.
      if (process.platform !== 'linux' || [...members.values()].some(info => info.group === pid)) send(-pid, signal);
    },
    async stop() { clearInterval(timer); if (scanning) await scanning; },
  };
}
async function waitForTree(tree, durationMs, signal) {
  const until = performance.now() + durationMs;
  do {
    if (!(await tree.active()).size) return true;
    // Repeat the signal to catch children created while the tree shuts down.
    await tree.signal(signal);
    await sleep(Math.min(25, Math.max(1, until - performance.now())));
  } while (performance.now() < until);
  return !(await tree.active()).size;
}
async function terminateTree(tree, signal, graceMs, forceMs) {
  const termination = { signal, graceMs, forceMs, forced: false, remaining: false };
  if (!(await tree.active()).size) return termination;
  await tree.signal(signal);
  if (await waitForTree(tree, graceMs, signal)) return termination;
  termination.forced = true;
  await tree.signal('SIGKILL');
  termination.remaining = !await waitForTree(tree, forceMs, 'SIGKILL');
  return termination;
}

// Every step must have an explicit deadline. Timeout/cancellation cleanup allows
// graceMs + forceMs (plus bounded OS scheduling/I/O overhead). No global hooks.
export async function runOwnedProcess(command, args, {
  cwd, env = process.env, stdio = 'inherit', timeoutMs, signal,
  graceMs = PROCESS_CLEANUP.graceMs, forceMs = PROCESS_CLEANUP.forceMs,
} = {}) {
  positive('timeoutMs', timeoutMs); positive('graceMs', graceMs); positive('forceMs', forceMs);
  const started = performance.now();
  if (signal?.aborted) return { code: null, signal: null, reason: 'cancelled', cancellationSignal: signal.reason || 'SIGTERM', elapsedMs: 0 };
  if (process.platform === 'win32') throw new Error('Owned process-tree cleanup requires POSIX process groups');
  let child;
  try { child = spawn(command, args, { cwd, env, stdio, shell: false, detached: true }); } catch (error) {
    return { code: null, signal: null, reason: 'spawn-error', error: error.message, elapsedMs: Math.round(performance.now() - started) };
  }
  const tree = child.pid ? ownedTree(child.pid) : undefined;
  let timeout;
  let cancelled;
  try {
    const outcome = await new Promise(resolve => {
      child.once('error', error => resolve({ code: null, signal: null, reason: 'spawn-error', error: error.message }));
      child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal, reason: 'exited' }));
      timeout = setTimeout(() => resolve({ code: null, signal: null, reason: 'timeout' }), timeoutMs);
      cancelled = () => resolve({ code: null, signal: null, reason: 'cancelled', cancellationSignal: signal.reason || 'SIGTERM' });
      signal?.addEventListener('abort', cancelled, { once: true });
      if (signal?.aborted) cancelled();
    });
    clearTimeout(timeout); signal?.removeEventListener('abort', cancelled);
    const cleanupSignal = outcome.reason === 'cancelled' && ['SIGINT', 'SIGTERM'].includes(outcome.cancellationSignal)
      ? outcome.cancellationSignal : 'SIGTERM';
    if (tree) {
      try { outcome.termination = await terminateTree(tree, cleanupSignal, graceMs, forceMs); }
      catch (error) {
        // Even if Linux discovery fails, kill only the original isolated group.
        send(-child.pid, 'SIGKILL');
        outcome.termination = { signal: cleanupSignal, graceMs, forceMs, forced: true, remaining: true, error: error.message };
      }
    }
    outcome.elapsedMs = Math.round(performance.now() - started);
    return outcome;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', cancelled);
    if (tree) await tree.stop().catch(() => {});
    // The launcher must not wait unboundedly on a child handle after force cleanup.
    child.unref();
  }
}

export function outcomeExitCode(outcome) {
  if (outcome.reason === 'timeout') return 124;
  const signal = outcome.reason === 'cancelled' ? outcome.cancellationSignal : outcome.signal;
  if (constants.signals[signal]) return 128 + constants.signals[signal];
  if (outcome.termination?.remaining) return 1;
  return Number.isInteger(outcome.code) && outcome.code !== 0 ? outcome.code : 1;
}
