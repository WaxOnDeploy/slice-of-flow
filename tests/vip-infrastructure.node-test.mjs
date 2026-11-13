import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { get } from 'node:https';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionHarness } from './browserHarness.mjs';
import { runOwnedProcess, outcomeExitCode } from './vip-process.mjs';
import { launcherPlan, runVipLauncher, STEP_TIMEOUTS_MS } from './run-vip-3x.mjs';

// Explicit Node runner only: node --test tests/vip-infrastructure.node-test.mjs
// Hard cap of 3.5s per test. The combined launcher independently caps this
// entire negative-test step at 60s; longer local options cannot override this cap.
const test = (name, options, fn) => nodeTest(name, { ...options, timeout: Math.min(options.timeout, 3500) }, fn);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'sof-infra-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const built = path.join(directory, 'public'), certs = path.join(directory, 'certs');
  await mkdir(path.join(built, 'app/assets'), { recursive: true }); await mkdir(certs);
  await writeFile(path.join(built, 'index.html'), '<!doctype html><title>Owned fixture</title>');
  await writeFile(path.join(built, 'app/assets/test.js'), 'export const mounted = true;\n');
  return { directory, built, certs, options: { env: { SOF_TEST_DIST: built }, tempRoot: certs } };
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
function request(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, { rejectUnauthorized: false, agent: false, timeout: 2000 }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Fixture request timeout')));
  });
}
async function waitFor(file, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { return await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await delay(10);
  }
  throw new Error(`Fixture did not become ready: ${file}`);
}
async function live(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      return !['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0]);
    }
    return true;
  } catch (error) { if (['ESRCH', 'ENOENT'].includes(error.code)) return false; throw error; }
}
function cleanupChild(t, child) {
  t.after(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } child.unref(); });
}

test('occupied port rejects EADDRINUSE, removes only new certs, and leaves its owner serving', { timeout: 8000 }, async t => {
  const f = await fixture(t);
  const owner = createServer((_req, res) => res.end('unrelated owner'));
  t.after(() => new Promise(resolve => owner.close(resolve)));
  const port = await listen(owner);
  await assert.rejects(productionHarness(port, f.options), { code: 'EADDRINUSE' });
  assert.deepEqual(await readdir(f.certs), []);
  assert.equal(owner.listening, true);
  assert.equal(await new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => { socket.destroy(); resolve(true); }); socket.on('error', reject);
  }), true);
});

test('missing openssl rejects and removes its new certificate directory without env mutation', { timeout: 4000 }, async t => {
  const f = await fixture(t);
  const before = { ...process.env };
  await assert.rejects(productionHarness(0, { ...f.options, opensslCommand: path.join(f.directory, 'no-such-openssl') }), { code: 'ENOENT' });
  assert.deepEqual(await readdir(f.certs), []);
  assert.deepEqual({ ...process.env }, before);
});

test('certificate read and synchronous listen failures clean newly acquired resources', { timeout: 8000 }, async t => {
  const f = await fixture(t);
  await assert.rejects(productionHarness(0, { ...f.options, readCertificate: async () => { throw new Error('injected certificate read failure'); } }), /injected certificate read failure/);
  assert.deepEqual(await readdir(f.certs), []);
  await assert.rejects(productionHarness(-1, f.options), { code: 'ERR_SOCKET_BAD_PORT' });
  assert.deepEqual(await readdir(f.certs), []);
});

test('normal HTTPS keeps production CSP, root/SPA and mounted base-path resources; close is idempotent', { timeout: 8000 }, async t => {
  const f = await fixture(t);
  const harness = await productionHarness(0, f.options); t.after(harness.close);
  assert.equal(harness.local, true);
  assert.equal((await readdir(f.certs)).length, 1);
  const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  for (const url of ['', 'nested/route', 'app/deep-link']) {
    const response = await request(new URL(url, harness.base));
    assert.equal(response.status, 200); assert.match(response.body, /Owned fixture/);
    for (const header of config.headers.find(rule => rule.source === '/(.*)').headers) assert.equal(response.headers[header.key.toLowerCase()], header.value);
  }
  const asset = await request(new URL('app/assets/test.js', harness.base));
  assert.equal(asset.status, 200); assert.equal(asset.headers['content-type'], 'application/javascript'); assert.match(asset.body, /mounted = true/);
  // Include a connection stalled before its TLS handshake in owned cleanup.
  const pending = connect(Number(new URL(harness.base).port), '127.0.0.1');
  await new Promise((resolve, reject) => { pending.once('connect', resolve); pending.once('error', reject); });
  t.after(() => pending.destroy());
  await harness.close(); await harness.close();
  assert.deepEqual(await readdir(f.certs), []);
  await assert.rejects(request(harness.base), { code: 'ECONNREFUSED' });
});

test('SOF_TEST_PREFIX serves prefixed Pages artifact routes and assets with production headers', { timeout: 8000 }, async t => {
  const f = await fixture(t);
  const harness = await productionHarness(0, { ...f.options, env: { ...f.options.env, SOF_TEST_PREFIX: '/slice-of-flow/' } }); t.after(harness.close);
  assert.match(harness.base, /^https:\/\/127\.0\.0\.1:\d+\/slice-of-flow\/$/);
  const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  for (const url of ['', 'nested/route', 'app/deep-link']) {
    const response = await request(new URL(url, harness.base));
    assert.equal(response.status, 200); assert.match(response.body, /Owned fixture/);
    for (const header of config.headers.find(rule => rule.source === '/(.*)').headers) assert.equal(response.headers[header.key.toLowerCase()], header.value);
  }
  const asset = await request(new URL('/slice-of-flow/app/assets/test.js', harness.base));
  assert.equal(asset.status, 200); assert.equal(asset.headers['content-type'], 'application/javascript'); assert.match(asset.body, /mounted = true/);
  const outside = await request(new URL('/app/assets/test.js', harness.base));
  assert.equal(outside.status, 200); assert.equal(outside.headers['content-type'], 'text/html'); assert.match(outside.body, /Owned fixture/);
  await harness.close(); assert.deepEqual(await readdir(f.certs), []);
});

test('invalid SOF_TEST_PREFIX rejects before acquiring certificate resources', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  for (const prefix of ['slice-of-flow/', '/slice-of-flow', '/slice//flow/', '/../flow/', '/slice-of-flow/?x/']) {
    await assert.rejects(productionHarness(0, { ...f.options, env: { ...f.options.env, SOF_TEST_PREFIX: prefix } }), /SOF_TEST_PREFIX/);
    assert.deepEqual(await readdir(f.certs), []);
  }
});

test('supplied external URL (including base path) acquires and closes nothing', { timeout: 3000 }, async t => {
  const f = await fixture(t);
  const harness = await productionHarness(-1, { ...f.options, env: { SOF_TEST_URL: 'https://example.invalid/app-prefix/' }, opensslCommand: 'not-an-openssl' });
  assert.equal(harness.base, 'https://example.invalid/app-prefix/'); assert.equal(harness.local, false);
  await harness.close(); await harness.close(); assert.deepEqual(await readdir(f.certs), []);
});

test('default local root and supplied external URL preserve their existing base behavior', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const local = await productionHarness(0, f.options); t.after(local.close);
  assert.match(local.base, /^https:\/\/127\.0\.0\.1:\d+\/$/);
  const external = await productionHarness(-1, { ...f.options, env: { SOF_TEST_URL: 'https://example.invalid/root/' } });
  assert.equal(external.base, 'https://example.invalid/root/'); assert.equal(external.local, false); await external.close();
});

test('owned runner requires finite positive bounds and reports missing command', { timeout: 4000 }, async () => {
  for (const timeoutMs of [undefined, Infinity, 0, -1]) await assert.rejects(runOwnedProcess(process.execPath, [], { timeoutMs }), /finite positive/);
  const result = await runOwnedProcess('/no/such/vip-command', [], { timeoutMs: 1000, stdio: 'ignore' });
  assert.equal(result.reason, 'spawn-error'); assert.equal(result.code, null); assert.match(result.error, /ENOENT/);
});

test('timeout force-kills only owned leader and descendant, not a neighboring child', { timeout: 6000 }, async t => {
  const f = await fixture(t);
  const descendant = path.join(f.directory, 'descendant.mjs'), leader = path.join(f.directory, 'leader.mjs');
  const descendantPid = path.join(f.directory, 'descendant.pid'), leaderPid = path.join(f.directory, 'leader.pid');
  await writeFile(descendant, `import { writeFileSync } from 'node:fs'; process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(descendantPid)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  await writeFile(leader, `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs'; process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(leaderPid)}, String(process.pid)); spawn(process.execPath, [${JSON.stringify(descendant)}], { stdio: 'ignore' }); setInterval(() => {}, 100);\n`);
  const neighbor = spawn(process.execPath, ['-e', 'setInterval(() => {}, 100)'], { detached: true, stdio: 'ignore' }); cleanupChild(t, neighbor);
  const run = runOwnedProcess(process.execPath, [leader], { timeoutMs: 1000, graceMs: 100, forceMs: 500, stdio: 'ignore' });
  const pid = Number(await waitFor(leaderPid)), descendantId = Number(await waitFor(descendantPid));
  // Emergency test cleanup stays limited to the dummy's group even if an assertion fails.
  cleanupChild(t, { pid, unref() {} });
  const result = await run;
  assert.equal(result.reason, 'timeout'); assert.equal(result.termination.forced, true); assert.equal(result.termination.remaining, false);
  assert.ok(result.elapsedMs < 2500); assert.equal(await live(pid), false); assert.equal(await live(descendantId), false);
  assert.equal(await live(neighbor.pid), true);
});

test('cancellation forwards SIGINT, allows graceful exit, and starts no child when already cancelled', { timeout: 6000 }, async t => {
  const f = await fixture(t), ready = path.join(f.directory, 'ready'), received = path.join(f.directory, 'signal');
  const script = path.join(f.directory, 'graceful.mjs');
  await writeFile(script, `import { writeFileSync } from 'node:fs'; process.on('SIGINT', () => { writeFileSync(${JSON.stringify(received)}, 'SIGINT'); process.exit(0); }); writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  const controller = new AbortController();
  const run = runOwnedProcess(process.execPath, [script], { timeoutMs: 3000, graceMs: 500, forceMs: 500, signal: controller.signal, stdio: 'ignore' });
  const pid = Number(await waitFor(ready)); cleanupChild(t, { pid, unref() {} }); controller.abort('SIGINT');
  const result = await run;
  assert.equal(result.reason, 'cancelled'); assert.equal(result.cancellationSignal, 'SIGINT'); assert.equal(result.termination.forced, false);
  assert.equal(await readFile(received, 'utf8'), 'SIGINT'); assert.equal(await live(pid), false);
  const preCancelled = await runOwnedProcess('/no/such/command', [], { timeoutMs: 1000, signal: controller.signal });
  assert.equal(preCancelled.reason, 'cancelled'); assert.equal(preCancelled.elapsedMs, 0);
});

test('timeout cleans a detached browser-like child group by verified descendant identity', { timeout: 6000 }, async t => {
  const f = await fixture(t), ready = path.join(f.directory, 'detached.pid');
  const descendant = path.join(f.directory, 'detached.mjs'), leader = path.join(f.directory, 'parent.mjs');
  await writeFile(descendant, `import { writeFileSync } from 'node:fs'; process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  await writeFile(leader, `import { spawn } from 'node:child_process'; process.on('SIGTERM', () => {}); spawn(process.execPath, [${JSON.stringify(descendant)}], { detached: true, stdio: 'ignore' }).unref(); setInterval(() => {}, 100);\n`);
  const run = runOwnedProcess(process.execPath, [leader], { timeoutMs: 1000, graceMs: 100, forceMs: 500, stdio: 'ignore' });
  const descendantPid = Number(await waitFor(ready)); cleanupChild(t, { pid: descendantPid, unref() {} });
  const result = await run;
  assert.equal(result.reason, 'timeout'); assert.equal(result.termination.forced, true);
  assert.equal(result.termination.remaining, false); assert.equal(await live(descendantPid), false);
  assert.ok(result.elapsedMs < 2500);
});

test('successful leader exit still cleans its inherited descendant group', { timeout: 5000 }, async t => {
  const f = await fixture(t), descendant = path.join(f.directory, 'straggler.mjs'), pidFile = path.join(f.directory, 'straggler.pid');
  await writeFile(descendant, `import { writeFileSync } from 'node:fs'; process.on('SIGTERM', () => {}); writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  const leader = path.join(f.directory, 'exiting.mjs');
  await writeFile(leader, `import { spawn } from 'node:child_process'; spawn(process.execPath, [${JSON.stringify(descendant)}], { stdio: 'ignore' }).unref(); setTimeout(() => process.exit(0), 300);\n`);
  const run = runOwnedProcess(process.execPath, [leader], { timeoutMs: 2000, graceMs: 100, forceMs: 500, stdio: 'ignore' });
  const pid = Number(await waitFor(pidFile));
  const result = await run; assert.equal(result.code, 0); assert.equal(result.reason, 'exited');
  assert.equal(result.termination.forced, true); assert.equal(result.termination.remaining, false); assert.equal(await live(pid), false);
});

test('child exit statuses and POSIX signals map to nonzero launcher statuses', { timeout: 3000 }, () => {
  assert.equal(outcomeExitCode({ reason: 'exited', code: 7 }), 7);
  assert.equal(outcomeExitCode({ reason: 'timeout' }), 124);
  assert.equal(outcomeExitCode({ reason: 'cancelled', cancellationSignal: 'SIGINT' }), 130);
  assert.equal(outcomeExitCode({ reason: 'cancelled', cancellationSignal: 'SIGTERM' }), 143);
  assert.equal(outcomeExitCode({ reason: 'exited', signal: 'SIGKILL' }), 137);
  assert.equal(outcomeExitCode({ reason: 'exited', signal: 'SIGABRT' }), 134);
  assert.equal(outcomeExitCode({ reason: 'spawn-error' }), 1);
});

test('launcher preserves target skips, engine-only scope, isolated build path and explicit deadlines', { timeout: 3000 }, () => {
  const output = '/tmp/owned-output';
  const all = launcherPlan('--all', {}, output);
  assert.deepEqual(all.map(step => step.kind), ['negatives', 'stress', 'regressions', 'typecheck', 'build', 'browser']);
  assert.deepEqual(launcherPlan('--engine-only', {}, output).map(step => step.kind), ['stress']);
  for (const env of [{ SOF_TEST_URL: 'https://example.invalid/app/' }, { SOF_TEST_DIST: '/tmp/supplied-dist' }]) {
    assert.deepEqual(launcherPlan('--all', env, output).map(step => step.kind), ['negatives', 'stress', 'browser']);
    assert.deepEqual(launcherPlan('--browser-only', env, output).map(step => step.kind), ['browser']);
    const browserEnv = launcherPlan('--browser-only', env, output)[0].env;
    if (env.SOF_TEST_URL) assert.equal(browserEnv.SOF_TEST_DIST, undefined); else assert.equal(browserEnv.SOF_TEST_DIST, env.SOF_TEST_DIST);
  }
  assert.equal(all.find(step => step.kind === 'build').args.at(-1), '/tmp/owned-output/dist/public');
  for (const step of all) assert.ok(Number.isFinite(step.timeoutMs) && step.timeoutMs > 0);
  assert.equal(STEP_TIMEOUTS_MS.browser, 900000);
});

test('launcher writes structured nonzero child exit and timeout failures using owned dummy children', { timeout: 6000 }, async t => {
  const f = await fixture(t);
  for (const [name, args, timeoutMs, expected] of [
    ['exit', ['-e', 'process.exit(7)'], 1000, 7],
    ['timeout', ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 100)'], 300, 124],
  ]) {
    const output = path.join(f.directory, name);
    const { exitCode } = await runVipLauncher({ mode: '--engine-only', env: {}, output,
      runner: () => runOwnedProcess(process.execPath, args, { timeoutMs, graceMs: 100, forceMs: 500, stdio: 'ignore' }),
    });
    const report = JSON.parse(await readFile(path.join(output, 'run-summary.json'), 'utf8'));
    assert.equal(exitCode, expected); assert.equal(report.exitCode, expected); assert.equal(report.passed, false);
    assert.equal(report.steps.length, 1); assert.ok(report.startedAt && report.finishedAt && report.error);
    assert.equal(report.steps[0].reason, name === 'exit' ? 'exited' : 'timeout');
  }
});

test('launcher writes cancellation failure, preserves 143, and does not run later steps', { timeout: 5000 }, async t => {
  const f = await fixture(t), ready = path.join(f.directory, 'launcher-ready'), script = path.join(f.directory, 'cancel.mjs');
  await writeFile(script, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  const controller = new AbortController(); let calls = 0;
  const output = path.join(f.directory, 'cancel-report');
  const run = runVipLauncher({ mode: '--all', env: {}, output, signal: controller.signal,
    runner: () => { calls++; return runOwnedProcess(process.execPath, [script], { timeoutMs: 3000, graceMs: 300, forceMs: 500, signal: controller.signal, stdio: 'ignore' }); },
  });
  const pid = Number(await waitFor(ready)); cleanupChild(t, { pid, unref() {} }); controller.abort('SIGTERM');
  const result = await run;
  const report = JSON.parse(await readFile(path.join(output, 'run-summary.json'), 'utf8'));
  assert.equal(result.exitCode, 143); assert.equal(report.passed, false); assert.equal(report.cancellationSignal, 'SIGTERM');
  assert.equal(report.steps[0].reason, 'cancelled'); assert.equal(calls, 1); assert.equal(await live(pid), false);
});

test('actual CLI forwards SIGTERM to an owned dummy step, reports failure, and exits 143', { timeout: 6000 }, async t => {
  const f = await fixture(t), output = path.join(f.directory, 'cli-cancel-report');
  const ready = path.join(f.directory, 'cli-child.pid'), received = path.join(f.directory, 'cli-child.signal');
  const dummy = path.join(f.directory, 'cli-child.mjs'), preload = path.join(f.directory, 'preload.mjs');
  await writeFile(dummy, `import { writeFileSync } from 'node:fs'; process.on('SIGTERM', () => { writeFileSync(${JSON.stringify(received)}, 'SIGTERM'); process.exit(0); }); writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 100);\n`);
  // Override spawn only inside this owned CLI subprocess, never the test process
  // or shared environment. The real CLI installs its real signal/report handlers.
  await writeFile(preload, `import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module'; const original = cp.spawn; cp.spawn = (_command, _args, options) => original(process.execPath, [${JSON.stringify(dummy)}], options); syncBuiltinESMExports();\n`);
  const cli = spawn(process.execPath, ['--import', preload, path.join(root, 'tests/run-vip-3x.mjs'), '--engine-only'], {
    cwd: root, env: { ...process.env, SOF_TEST_OUTPUT: output }, detached: true, stdio: 'ignore',
  });
  cleanupChild(t, cli);
  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI cancellation exceeded deadline')), 4000);
    cli.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    cli.once('error', error => { clearTimeout(timer); reject(error); });
  });
  const pid = Number(await waitFor(ready)); cleanupChild(t, { pid, unref() {} });
  cli.kill('SIGTERM');
  const result = await exited;
  assert.equal(result.code, 143); assert.equal(result.signal, null);
  assert.equal(await readFile(received, 'utf8'), 'SIGTERM'); assert.equal(await live(pid), false);
  const report = JSON.parse(await readFile(path.join(output, 'run-summary.json'), 'utf8'));
  assert.equal(report.passed, false); assert.equal(report.exitCode, 143); assert.equal(report.cancellationSignal, 'SIGTERM');
  assert.equal(report.steps[0].reason, 'cancelled'); assert.equal(report.steps[0].termination.forced, false);
});

test('CLI invalid arguments still write a structured failure report and exit 2', { timeout: 4000 }, async t => {
  const f = await fixture(t), output = path.join(f.directory, 'usage-report');
  const result = await runOwnedProcess(process.execPath, [path.join(root, 'tests/run-vip-3x.mjs'), '--invalid'], {
    cwd: root, env: { ...process.env, SOF_TEST_OUTPUT: output }, timeoutMs: 2000, stdio: 'ignore',
  });
  assert.equal(result.code, 2);
  const report = JSON.parse(await readFile(path.join(output, 'run-summary.json'), 'utf8'));
  assert.equal(report.passed, false); assert.equal(report.exitCode, 2); assert.deepEqual(report.steps, []);
});
