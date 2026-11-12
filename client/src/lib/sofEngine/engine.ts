import {
  commandClass, exactKeys, failure, immutable, isCode, isRecord, isTime, PAUSE_REASONS, STATIONS,
  success, validateCommand, type ActionResult, type Checked, type Engine, type EngineCommand,
  type EngineEvent, type EventData, type PauseReason, type RunConfig, type Step, type Ticket,
} from './types';
import { validateConfig } from './scenario';
import { validateEvent } from './accounting';

type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
type Work = Omit<Mutable<Engine>, 'config'> & { config: RunConfig };
const active = (t: Ticket) => t.status === 'active';
const ref = (t: Ticket) => ({ orderKey: t.orderKey, orderId: t.orderId });
function copy(s: Engine): Work {
  return { ...s, config: s.config, pausedBy: [...s.pausedBy], tickets: s.tickets.map(t => ({ ...t, holds: [...t.holds] })), events: [...s.events] as Mutable<EngineEvent>[] };
}
function emit(s: Work, data: EventData): void {
  s.events.push({ ...data, runId: s.runId, seq: s.events.length + 1, atMs: s.nowMs } as Mutable<EngineEvent>);
}
function step(s: Work, from: number): Step {
  // The config is already newly owned/frozen at creation; all changed data is copied/frozen.
  const state = immutable(s) as Engine;
  return Object.freeze({ state, emitted: Object.freeze(state.events.slice(from)) });
}
function noStep(s: Engine): Step { return Object.freeze({ state: s, emitted: Object.freeze([]) }); }
function end(s: Work, reason: 'horizon' | 'all-resolved' | 'manual-stop'): void {
  if (s.ended !== null) return;
  s.ended = reason; emit(s, { kind: 'runEnded', reason });
}
function clear(s: Work): void {
  if (s.config.endCondition === 'all-resolved-or-horizon' && s.tickets.every(t => ['served', 'burnt', 'discarded'].includes(t.status))) end(s, 'all-resolved');
}
function fifo(s: Work) {
  return s.tickets.filter(t => t.status === 'external').sort((a, b) => {
    const x = s.config.manifest.orders.find(o => o.orderKey === a.orderKey)!;
    const y = s.config.manifest.orders.find(o => o.orderKey === b.orderKey)!;
    return x.availableAtMs - y.availableAtMs || x.ordinal - y.ordinal || a.orderKey.localeCompare(b.orderKey);
  })[0];
}
function admit(s: Work, t: Mutable<Ticket>, by: 'push' | 'pull' | 'guide'): void {
  t.status = 'active'; t.station = 'orderQueue'; t.admittedAtMs = s.nowMs;
  emit(s, { kind: 'admission', ...ref(t), by });
}
function capacity(s: Work, station: typeof STATIONS[number]): boolean {
  const n = s.tickets.filter(t => active(t) && t.station === station).length;
  const physical = s.config.resources.occupancy[station];
  const policy = s.config.policy.wip[station];
  return (physical === null || n < physical) && (policy === null || n < policy);
}
function boundary(s: Work): void {
  const m = s.config.manifest;
  for (const t of s.tickets) {
    const spec = m.orders.find(o => o.orderKey === t.orderKey)!;
    if (t.status === 'scheduled' && spec.availableAtMs === s.nowMs) {
      t.status = 'external'; emit(s, { kind: 'arrival', ...ref(t) });
    }
  }
  // Hold transitions remain authoritative even outside the active population and after exit.
  const holds = [...m.holds].sort((a, b) => a.holdId < b.holdId ? -1 : a.holdId > b.holdId ? 1 : 0);
  for (const [at, kind] of [['endMs', 'blockEnd'], ['startMs', 'blockStart']] as const) {
    for (const hold of holds) if (hold[at] === s.nowMs) {
      const t = s.tickets.find(t => t.orderKey === hold.orderKey)!;
      t.holds = kind === 'blockStart' ? [...t.holds, hold.holdId].sort() : t.holds.filter(id => id !== hold.holdId);
      emit(s, { kind, ...ref(t), holdId: hold.holdId });
    }
  }
  for (const t of s.tickets) if (active(t) && !t.ready) {
    if ((t.station === 'prep' && t.prepReadyAtMs === s.nowMs) || (t.station === 'oven' && t.ovenReadyAtMs === s.nowMs)) {
      t.ready = true; emit(s, { kind: 'ready', ...ref(t), station: t.station as 'prep' | 'oven' });
    }
  }
  for (const t of s.tickets) if (active(t) && t.station === 'oven' && t.burnAtMs === s.nowMs) {
    emit(s, { kind: 'discard', ...ref(t), from: 'oven', reason: 'burnt' });
    t.status = 'burnt'; t.station = null; t.exitedAtMs = s.nowMs; t.ready = false;
  }
  for (const t of s.tickets) if (active(t) && !t.angry && t.admittedAtMs! + m.patienceMs === s.nowMs) {
    t.angry = true; emit(s, { kind: 'anger', ...ref(t) });
  }
  if (s.nextPushAtMs !== null && s.nextPushAtMs <= s.nowMs) {
    // Empty interval boundaries are consumed mathematically; they cannot shift the phase.
    const coincident = s.nowMs % m.pushIntervalMs === 0;
    if (coincident) { const t = fifo(s); if (t && capacity(s, 'orderQueue')) admit(s, t, 'push'); }
    s.nextPushAtMs = (Math.floor(s.nowMs / m.pushIntervalMs) + 1) * m.pushIntervalMs;
  }
}
function nextBoundary(s: Work, target: number): number {
  let next = Math.min(target, s.config.manifest.horizonMs);
  const take = (v: number | null) => { if (v !== null && v > s.nowMs && v < next) next = v; };
  const m = s.config.manifest;
  for (const o of m.orders) if (s.tickets.find(t => t.orderKey === o.orderKey)!.status === 'scheduled') take(o.availableAtMs);
  for (const h of m.holds) { take(h.startMs); take(h.endMs); }
  if (s.tickets.some(t => t.status === 'external')) take(s.nextPushAtMs);
  for (const t of s.tickets) if (active(t)) {
    if (!t.ready) take(t.station === 'prep' ? t.prepReadyAtMs : t.station === 'oven' ? t.ovenReadyAtMs : null);
    if (t.station === 'oven') take(t.burnAtMs);
    if (!t.angry) take(t.admittedAtMs! + m.patienceMs);
  }
  return next;
}

/** Runtime structural gate for reducer states. Complete history is separately reconciled at finalization. */
export function validateEngine(input: unknown): Checked<Engine> {
  if (!isRecord(input) || !exactKeys(input, ['runId', 'config', 'nowMs', 'speed', 'pausedBy', 'guide', 'nextPushAtMs', 'tickets', 'events', 'ended'])) return failure('INVALID_STATE', 'state');
  if (!isCode(input.runId) || !isTime(input.nowMs) || ![1, 2, 3].includes(input.speed as number)) return failure('INVALID_STATE', 'state');
  const config = validateConfig(input.config); if (!config.ok) return config;
  const c = config.value;
  if (input.nowMs > c.manifest.horizonMs || !Array.isArray(input.pausedBy) || new Set(input.pausedBy).size !== input.pausedBy.length || !input.pausedBy.every(p => PAUSE_REASONS.includes(p))) return failure('INVALID_STATE', 'state.pausedBy');
  if (!['pending', 'moved', 'complete'].includes(input.guide as string) || ![null, 'horizon', 'all-resolved', 'manual-stop'].includes(input.ended as null)) return failure('INVALID_STATE', 'state.ended');
  if ((input.guide !== 'complete' && (!c.guidedStart || !input.pausedBy.includes('guide') || input.nowMs !== 0)) ||
    (input.guide === 'complete' && input.pausedBy.includes('guide'))) return failure('INVALID_STATE', 'state.guide');
  if (input.nextPushAtMs !== null && (!isTime(input.nextPushAtMs) || input.nextPushAtMs <= input.nowMs || input.nextPushAtMs % c.manifest.pushIntervalMs !== 0)) return failure('INVALID_STATE', 'state.nextPushAtMs');
  if ((c.policy.variantId === 'manual-pull') !== (input.nextPushAtMs === null)) return failure('INVALID_STATE', 'state.nextPushAtMs');
  if (!Array.isArray(input.tickets) || input.tickets.length !== c.manifest.orders.length || !Array.isArray(input.events)) return failure('INVALID_STATE', 'state.tickets');
  const sorted = [...c.manifest.orders].sort((a, b) => a.ordinal - b.ordinal || a.orderKey.localeCompare(b.orderKey));
  const nowMs = input.nowMs;
  for (const [i, t] of Array.from(input.tickets.entries())) {
    if (!isRecord(t) || !exactKeys(t, ['orderKey', 'orderId', 'status', 'station', 'admittedAtMs', 'exitedAtMs', 'prepReadyAtMs', 'ovenReadyAtMs', 'burnAtMs', 'ready', 'angry', 'holds'])) return failure('INVALID_STATE', `state.tickets[${i}]`);
    if (t.orderKey !== sorted[i].orderKey || t.orderId !== `${input.runId}:order:${sorted[i].ordinal}` || !['scheduled', 'external', 'active', 'served', 'burnt', 'discarded'].includes(t.status as string)) return failure('INVALID_STATE', `state.tickets[${i}]`);
    for (const k of ['admittedAtMs', 'exitedAtMs', 'prepReadyAtMs', 'ovenReadyAtMs', 'burnAtMs']) if (t[k] !== null && !isTime(t[k])) return failure('INVALID_TIME', `state.tickets[${i}].${k}`);
    if (typeof t.ready !== 'boolean' || typeof t.angry !== 'boolean' || !Array.isArray(t.holds) || new Set(t.holds).size !== t.holds.length || !t.holds.every(id => c.manifest.holds.some(h => h.holdId === id && h.orderKey === t.orderKey && h.startMs <= nowMs && h.endMs > nowMs))) return failure('INVALID_STATE', `state.tickets[${i}]`);
    if (t.status === 'active' ? !STATIONS.includes(t.station as typeof STATIONS[number]) || t.admittedAtMs === null || t.exitedAtMs !== null : t.station !== null) return failure('INVALID_STATE', `state.tickets[${i}].station`);
    if (['scheduled', 'external'].includes(t.status as string) && (t.admittedAtMs !== null || t.exitedAtMs !== null || t.angry)) return failure('INVALID_STATE', `state.tickets[${i}]`);
    if (['served', 'burnt', 'discarded'].includes(t.status as string) && (t.admittedAtMs === null || t.exitedAtMs === null || (t.exitedAtMs as number) < (t.admittedAtMs as number) || (t.exitedAtMs as number) > input.nowMs)) return failure('INVALID_STATE', `state.tickets[${i}]`);
    const spec = sorted[i];
    if ((t.status === 'scheduled') !== (spec.availableAtMs > nowMs && t.admittedAtMs === null) ||
      (t.admittedAtMs !== null && ((t.admittedAtMs as number) < spec.availableAtMs || (t.admittedAtMs as number) > nowMs))) return failure('INVALID_STATE', `state.tickets[${i}].admittedAtMs`);
    if (t.status === 'active') {
      const station = t.station as typeof STATIONS[number];
      if (station === 'orderQueue' && (t.ready || t.prepReadyAtMs !== null || t.ovenReadyAtMs !== null || t.burnAtMs !== null)) return failure('INVALID_STATE', `state.tickets[${i}].ready`);
      if (station === 'prep' && (!isTime(t.prepReadyAtMs) || t.ready !== (t.prepReadyAtMs <= nowMs) || t.ovenReadyAtMs !== null || t.burnAtMs !== null)) return failure('INVALID_STATE', `state.tickets[${i}].ready`);
      if (station === 'oven' && (!isTime(t.prepReadyAtMs) || !isTime(t.ovenReadyAtMs) || !isTime(t.burnAtMs) || t.burnAtMs !== t.ovenReadyAtMs + c.manifest.burnBufferMs || t.burnAtMs <= nowMs || t.ready !== (t.ovenReadyAtMs <= nowMs))) return failure('INVALID_STATE', `state.tickets[${i}].ready`);
      if (station === 'boxDeliver' && (t.ready || !isTime(t.prepReadyAtMs) || !isTime(t.ovenReadyAtMs))) return failure('INVALID_STATE', `state.tickets[${i}].ready`);
    } else if (t.ready) return failure('INVALID_STATE', `state.tickets[${i}].ready`);
    const expectedHolds = c.manifest.holds.filter(h => h.orderKey === t.orderKey && h.startMs <= nowMs && h.endMs > nowMs).map(h => h.holdId).sort();
    if (t.holds.length !== expectedHolds.length || t.holds.some((h, n) => h !== expectedHolds[n])) return failure('INVALID_STATE', `state.tickets[${i}].holds`);
  }
  let previous = 0;
  for (const [i, e] of Array.from(input.events.entries())) {
    const event = validateEvent(e); if (!event.ok) return failure(event.issues[0].code, `state.events[${i}]`);
    if (!isRecord(e) || e.runId !== input.runId || e.seq !== i + 1 || !isTime(e.atMs) || e.atMs < previous || e.atMs > input.nowMs || typeof e.kind !== 'string') return failure('INVALID_HISTORY', `state.events[${i}]`);
    previous = e.atMs;
  }
  if (input.events[0]?.kind !== 'runStarted' || input.events[0]?.atMs !== 0 || (input.ended !== null && (input.events.at(-1)?.kind !== 'runEnded' || input.events.at(-1)?.reason !== input.ended))) return failure('INVALID_HISTORY', 'state.events');
  for (const station of STATIONS) {
    const n = input.tickets.filter(t => t.status === 'active' && t.station === station).length;
    const caps = [c.resources.occupancy[station], c.policy.wip[station]];
    if (caps.some(cap => cap !== null && n > cap)) return failure('CAPACITY', `state.${station}`);
  }
  return success(input as unknown as Engine);
}

export function createEngine(runId: unknown, input: unknown): Checked<Step> {
  if (!isCode(runId) || runId.length > 64) return failure('INVALID_ID', 'runId');
  const checked = validateConfig(input); if (!checked.ok) return checked;
  const config = checked.value;
  const s: Work = {
    runId, config, nowMs: 0, speed: config.initialSpeed, pausedBy: config.guidedStart ? ['instruction', 'guide'] : ['instruction'],
    guide: config.guidedStart ? 'pending' : 'complete', nextPushAtMs: config.policy.variantId === 'interval-push' ? config.manifest.pushIntervalMs : null,
    tickets: [...config.manifest.orders].sort((a, b) => a.ordinal - b.ordinal || a.orderKey.localeCompare(b.orderKey)).map(o => ({
      orderKey: o.orderKey, orderId: `${runId}:order:${o.ordinal}`, status: 'scheduled', station: null,
      admittedAtMs: null, exitedAtMs: null, prepReadyAtMs: null, ovenReadyAtMs: null, burnAtMs: null,
      ready: false, angry: false, holds: [],
    })), events: [], ended: null,
  };
  emit(s, { kind: 'runStarted' }); boundary(s);
  if (config.guidedStart) { const t = fifo(s); if (t) admit(s, t, 'guide'); else { s.guide = 'complete'; s.pausedBy = ['instruction']; } }
  if (config.manifest.horizonMs === 0) end(s, 'horizon'); else clear(s);
  return success(step(s, 0));
}
export function advanceTo(input: Engine, targetMs: unknown): Checked<Step> {
  const checked = validateEngine(input); if (!checked.ok) return checked;
  if (!isTime(targetMs) || targetMs < input.nowMs) return failure('INVALID_TIME', 'targetMs');
  if (input.ended || input.pausedBy.length || targetMs === input.nowMs) return success(noStep(input));
  const s = copy(input), from = s.events.length;
  const target = Math.min(targetMs, s.config.manifest.horizonMs);
  while (s.nowMs < target && !s.ended) {
    s.nowMs = nextBoundary(s, target); boundary(s);
    if (s.nowMs === s.config.manifest.horizonMs) end(s, 'horizon'); else clear(s);
  }
  return success(step(s, from));
}
export function applyAction(input: Engine, incoming: unknown): ActionResult {
  const reject = (code: string, path = 'command'): ActionResult => Object.freeze({ ...noStep(input), accepted: false, issues: immutable([{ code, path }]) });
  const valid = validateEngine(input); if (!valid.ok) return Object.freeze({ ...noStep(input), accepted: false, issues: valid.issues });
  const checked = validateCommand(incoming); if (!checked.ok) return Object.freeze({ ...noStep(input), accepted: false, issues: checked.issues });
  const command = checked.value;
  if (input.ended) return reject('ENDED');
  const s = copy(input), from = s.events.length;
  const guidedMove = command.kind === 'move' && command.to === 'prep' && input.nowMs === 0 && input.guide === 'pending' && input.pausedBy.length === 1 && input.pausedBy[0] === 'guide' && input.tickets.find(t => t.orderKey === command.orderKey)?.station === 'orderQueue';
  if (command.kind !== 'set-pause' && input.pausedBy.length && !guidedMove) return reject('PAUSED');
  if (command.kind === 'set-pause') {
    const has = s.pausedBy.includes(command.reason);
    if (has === command.active) return Object.freeze({ ...noStep(input), accepted: true, issues: Object.freeze([]) });
    if (command.reason === 'guide' && (command.active || s.guide === 'pending')) return reject('GUIDE_PENDING');
    emit(s, { kind: 'commandAccepted', commandClass: 'control', command });
    s.pausedBy = command.active ? PAUSE_REASONS.filter(p => p === command.reason || s.pausedBy.includes(p)) : s.pausedBy.filter(p => p !== command.reason);
    if (command.reason === 'guide' && !command.active) s.guide = 'complete';
  } else if (command.kind === 'speed') {
    if (s.speed === command.speed) return Object.freeze({ ...noStep(input), accepted: true, issues: Object.freeze([]) });
    emit(s, { kind: 'commandAccepted', commandClass: 'control', command }); s.speed = command.speed;
  } else if (command.kind === 'end') {
    emit(s, { kind: 'commandAccepted', commandClass: 'control', command }); end(s, 'manual-stop');
  } else {
    const t = s.tickets.find(t => t.orderKey === command.orderKey);
    if (!t) return reject('UNKNOWN_ORDER', 'command.orderKey');
    if (command.kind === 'admit') {
      if (s.config.policy.variantId !== 'manual-pull') return reject('POLICY');
      if (t.status !== 'external') return reject('NOT_AVAILABLE');
      if (fifo(s)?.orderKey !== t.orderKey) return reject('FIFO');
      if (!capacity(s, 'orderQueue')) return reject('CAPACITY');
      emit(s, { kind: 'commandAccepted', commandClass: 'gameplay', command }); admit(s, t, 'pull');
    } else {
      if (!active(t) || t.station === null) return reject('NOT_ACTIVE');
      if (t.holds.length && command.kind === 'move') return reject('BLOCKED');
      const station = t.station;
      if (command.kind === 'move') {
        const next = [...STATIONS, 'served'][STATIONS.indexOf(station) + 1];
        if (command.to !== next) return reject('INVALID_MOVE');
        if ((station === 'prep' || station === 'oven') && !t.ready) return reject('NOT_READY');
        if (command.to !== 'served' && !capacity(s, command.to)) return reject('CAPACITY');
        emit(s, { kind: 'commandAccepted', commandClass: 'gameplay', command });
        if (command.to === 'served') {
          emit(s, { kind: 'service', ...ref(t), from: 'boxDeliver' });
          t.status = 'served'; t.station = null; t.exitedAtMs = s.nowMs; t.ready = false;
        } else {
          emit(s, { kind: 'movement', ...ref(t), from: station, to: command.to }); t.station = command.to; t.ready = false;
          const o = s.config.manifest.orders.find(o => o.orderKey === t.orderKey)!;
          if (command.to === 'prep') t.prepReadyAtMs = s.nowMs + o.prepMs;
          if (command.to === 'oven') { t.ovenReadyAtMs = s.nowMs + o.bakeMs; t.burnAtMs = t.ovenReadyAtMs + s.config.manifest.burnBufferMs; }
          if (guidedMove) s.guide = 'moved';
        }
      } else {
        emit(s, { kind: 'commandAccepted', commandClass: 'gameplay', command });
        emit(s, { kind: 'discard', ...ref(t), from: station, reason: 'manual' });
        t.status = 'discarded'; t.station = null; t.exitedAtMs = s.nowMs; t.ready = false;
      }
    }
  }
  clear(s);
  return Object.freeze({ ...step(s, from), accepted: true, issues: Object.freeze([]) });
}
export function replay(config: unknown, runId: unknown, frames: unknown, endAtMs: unknown): Checked<Step> {
  if (!Array.isArray(frames) || !isTime(endAtMs)) return failure('INVALID_REPLAY', 'frames');
  const created = createEngine(runId, config); if (!created.ok) return created;
  let state = created.value.state, previous = 0;
  for (const [i, frame] of Array.from(frames.entries())) {
    if (!isRecord(frame) || !exactKeys(frame, ['atMs', 'command']) || !isTime(frame.atMs) || frame.atMs < previous || frame.atMs > endAtMs) return failure('INVALID_REPLAY', `frames[${i}]`);
    const advanced = advanceTo(state, frame.atMs); if (!advanced.ok) return advanced;
    if (advanced.value.state.nowMs !== frame.atMs) return failure('REPLAY_TIME_UNREACHABLE', `frames[${i}].atMs`);
    const result = applyAction(advanced.value.state, frame.command);
    if (!result.accepted) return { ok: false, issues: result.issues };
    state = result.state; previous = frame.atMs;
  }
  const final = advanceTo(state, endAtMs); if (!final.ok) return final;
  if (!final.value.state.ended && final.value.state.nowMs !== endAtMs) return failure('REPLAY_TIME_UNREACHABLE', 'endAtMs');
  return success(Object.freeze({ state: final.value.state, emitted: final.value.state.events }));
}
/** Extract only effective accepted command envelopes, preserving equal-time ordering. */
export function replayFrames(state: Engine): readonly { atMs: number; command: EngineCommand }[] {
  return immutable(state.events.flatMap(e => e.kind === 'commandAccepted' ? [{ atMs: e.atMs, command: e.command }] : []));
}
export { commandClass };
export type { PauseReason };
