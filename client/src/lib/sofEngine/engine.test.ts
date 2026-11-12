import { describe, expect, it } from 'vitest';
import { advanceTo, applyAction, createEngine, replay, replayFrames } from './engine';
import { makeFixedDeckConfig } from './scenario';
import { snapshotFromEngine } from './runSnapshots';
import { action, admit, at, clone, move, resume, start, testConfig, value } from './fixtures/testCases';
import type { Engine } from './types';
const kinds = (s: Engine, time: number) => s.events.filter(e => e.atMs === time).map(e => e.kind);
const error = (s: Engine, c: unknown, code: string) => {
  const r = applyAction(s, c); expect(r.accepted).toBe(false); expect(r.issues[0].code).toBe(code);
  expect(r.state).toBe(s); expect(r.emitted).toEqual([]);
};

describe('clock boundary processing', () => {
  it('processes every crossed push, uneven/1ms partitions, full final interval and stable phase', () => {
    const initial = resume(start(testConfig({ policy: 'interval-push', horizonMs: 35, count: 4 })));
    const jump = at(initial, 35);
    let fine = initial; for (let ms = 1; ms <= 35; ms++) fine = at(fine, ms);
    let uneven = initial; for (const ms of [2, 9, 11, 24, 31, 35]) uneven = at(uneven, ms);
    expect(fine).toEqual(jump); expect(uneven).toEqual(jump);
    expect(jump.events.filter(e => e.kind === 'admission').map(e => e.atMs)).toEqual([10, 20, 30]);
    expect(jump.nextPushAtMs).toBe(40); expect(jump.nowMs).toBe(35); expect(jump.ended).toBe('horizon');
    expect(jump.tickets.map(t => t.admittedAtMs)).toEqual([10, 20, 30, null]);
    expect(value(advanceTo(jump, 100)).state).toBe(jump);
  });
  it('empty intervals and staggered availability do not refill or move cadence', () => {
    const initial = resume(start(testConfig({ policy: 'interval-push', arrivals: [25, 40], count: 2, horizonMs: 45 })));
    const jump = at(initial, 45);
    let fine = initial; for (let ms = 1; ms <= 45; ms++) fine = at(fine, ms);
    expect(fine).toEqual(jump);
    expect(jump.events.filter(e => e.kind === 'arrival' || e.kind === 'admission').map(e => [e.kind, e.atMs])).toEqual(
      [['arrival', 25], ['admission', 30], ['arrival', 40], ['admission', 40]]);
    expect(jump.nextPushAtMs).toBe(50);
  });
  it('skips millions of mathematically empty push intervals without losing phase', () => {
    const initial = resume(start(testConfig({ policy: 'interval-push', count: 1, arrivals: [100000003], intervalMs: 1, horizonMs: 100000005 })));
    const s = at(initial, 100000005);
    expect(s.tickets[0].admittedAtMs).toBe(100000003);
    expect(s.events.filter(e => e.kind === 'admission')).toHaveLength(1);
    expect(s.nextPushAtMs).toBe(100000006);
  });
  it('processes coincident horizon arrival/push before exactly one end and rejects horizon gameplay', () => {
    const s = at(resume(start(testConfig({ policy: 'interval-push', count: 1, arrivals: [20], horizonMs: 20 }))), 20);
    expect(kinds(s, 20)).toEqual(['arrival', 'admission', 'runEnded']);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }, 'ENDED');
    error(s, { kind: 'end', reason: 'manual-stop' }, 'ENDED');
    expect(s.tickets[0].status).toBe('active');
  });
  it('rejects backward/fractional/nonfinite targets without repairing them', () => {
    const s = at(resume(start()), 3);
    for (const target of [2, -1, 3.5, Infinity, NaN, '4']) expect(advanceTo(s, target).ok).toBe(false);
    expect(value(advanceTo(s, 3)).state).toBe(s);
  });
});

describe('atomic below-host mutation gates', () => {
  it('initial instruction plus guide permits only selected first time-zero Orders->Prep under guide alone', () => {
    let s = start(testConfig({ guidedStart: true, policy: 'interval-push' }));
    expect(s.pausedBy).toEqual(['instruction', 'guide']); expect(s.tickets[0].admittedAtMs).toBe(0);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }, 'PAUSED');
    error(s, { kind: 'set-pause', reason: 'guide', active: false }, 'GUIDE_PENDING');
    s = resume(s);
    const before = s;
    expect(at(s, 10)).toBe(s);
    error(s, { kind: 'discard', orderKey: 'order-1' }, 'PAUSED');
    error(s, { kind: 'speed', speed: 2 }, 'PAUSED');
    error(s, { kind: 'end', reason: 'manual-stop' }, 'PAUSED');
    s = move(s, 1, 'prep'); expect(s.guide).toBe('moved'); expect(s.nowMs).toBe(0);
    expect(before.tickets[0].station).toBe('orderQueue'); expect(Object.isFrozen(s.tickets[0])).toBe(true);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'oven' }, 'PAUSED');
    s = action(s, { kind: 'set-pause', reason: 'guide', active: false });
    expect(s.pausedBy).toEqual([]); expect(s.guide).toBe('complete');
  });
  it.each(['help', 'hidden', 'instruction', 'exit-confirmation', 'transition', 'facilitator'] as const)('blocks guidance and mutations while %s also owns a lock', reason => {
    let s = resume(start(testConfig({ guidedStart: true })));
    s = action(s, { kind: 'set-pause', reason, active: true });
    error(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }, 'PAUSED');
    error(s, { kind: 'admit', orderKey: 'order-2' }, 'PAUSED');
    error(s, { kind: 'speed', speed: 2 }, 'PAUSED');
    error(s, { kind: 'end', reason: 'manual-stop' }, 'PAUSED');
  });
  it('repeated pause ownership is accepted without extra events and facilitator resume cannot clear hidden/help', () => {
    let s = resume(start());
    for (const reason of ['facilitator', 'hidden', 'help'] as const) s = action(s, { kind: 'set-pause', reason, active: true });
    const repeated = applyAction(s, { kind: 'set-pause', reason: 'hidden', active: true });
    expect(repeated.accepted).toBe(true); expect(repeated.state).toBe(s); expect(repeated.emitted).toEqual([]);
    s = action(s, { kind: 'set-pause', reason: 'facilitator', active: false });
    expect(s.pausedBy).toEqual(['help', 'hidden']);
  });
  it.each([{ kind: 'manual-next' }, { kind: 'override', capacity: 4 }, { kind: 'speed', speed: 4 },
    { kind: 'set-pause', reason: 'user', active: true }, { kind: 'end', reason: 'service-bell' },
    { kind: 'admit', orderKey: 'order-1', personal: 'x' }, null])('rejects unsupported command %j', command => {
    expect(applyAction(resume(start()), command).accepted).toBe(false);
  });
});

describe('physical work and independent population', () => {
  it('external and scheduled tickets are not active; full pull Orders WIP rejects fifth', () => {
    let s = resume(start(testConfig({ count: 6, arrivals: [0, 0, 0, 0, 0, 20] })));
    expect(s.tickets.map(t => t.status)).toEqual(['external', 'external', 'external', 'external', 'external', 'scheduled']);
    error(s, { kind: 'admit', orderKey: 'order-6' }, 'NOT_AVAILABLE');
    error(s, { kind: 'admit', orderKey: 'order-2' }, 'FIFO');
    for (let n = 1; n <= 4; n++) s = admit(s, n);
    error(s, { kind: 'admit', orderKey: 'order-5' }, 'CAPACITY');
  });
  it('prep progresses per ticket; physical oven is exactly three even with push WIP disabled', () => {
    let s = resume(start(testConfig({ policy: 'interval-push', intervalMs: 1, count: 4, prepMs: 3, horizonMs: 30 })));
    s = at(s, 4); for (let n = 1; n <= 4; n++) s = move(s, n, 'prep');
    error(s, { kind: 'move', orderKey: 'order-1', to: 'oven' }, 'NOT_READY');
    s = at(s, 7); expect(s.tickets.every(t => t.ready)).toBe(true);
    for (let n = 1; n <= 3; n++) s = move(s, n, 'oven');
    error(s, { kind: 'move', orderKey: 'order-4', to: 'oven' }, 'CAPACITY');
    expect(s.tickets.filter(t => t.station === 'oven')).toHaveLength(3);
  });
  it('allows readiness-boundary departure, rejects skipped/backward/terminal moves, emits service instead of duplicate movement', () => {
    let s = admit(resume(start(testConfig({ count: 1 }))), 1);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'oven' }, 'INVALID_MOVE');
    s = move(s, 1, 'prep'); s = at(s, 3); s = move(s, 1, 'oven');
    error(s, { kind: 'move', orderKey: 'order-1', to: 'boxDeliver' }, 'NOT_READY');
    s = at(s, 7); s = move(s, 1, 'boxDeliver'); s = move(s, 1, 'served');
    expect(kinds(s, 7)).toEqual(['ready', 'commandAccepted', 'movement', 'commandAccepted', 'service']);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }, 'NOT_ACTIVE');
    error(s, { kind: 'discard', orderKey: 'order-1' }, 'NOT_ACTIVE');
  });
  it('burn wins over caller action/anger and remains exactly one terminal exit even while held', () => {
    const config = testConfig({ count: 1, patienceMs: 22, holds: [{ holdId: 'h', orderKey: 'order-1', startMs: 6, endMs: 40, reason: 'fixture-dependency' }] });
    let s = move(admit(resume(start(config)), 1), 1, 'prep'); s = at(s, 3); s = move(s, 1, 'oven');
    s = at(s, 7); error(s, { kind: 'move', orderKey: 'order-1', to: 'boxDeliver' }, 'BLOCKED');
    s = at(s, 22); expect(kinds(s, 22)).toEqual(['discard']); expect(s.tickets[0].angry).toBe(false);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'boxDeliver' }, 'NOT_ACTIVE');
    s = at(s, 50); expect(s.events.filter(e => e.kind === 'discard')).toHaveLength(1);
    expect(s.events.filter(e => e.kind === 'blockEnd')).toHaveLength(1);
  });
  it('stable same-time order is arrivals, hold end/start, readiness, burn, anger, push, then caller action', () => {
    const config = testConfig({ policy: 'interval-push', count: 3, arrivals: [0, 22, 0], patienceMs: 12,
      holds: [{ holdId: 'a', orderKey: 'order-2', startMs: 2, endMs: 22, reason: 'fixture-dependency' },
        { holdId: 'b', orderKey: 'order-2', startMs: 22, endMs: 30, reason: 'fixture-dependency' }],
      intervalMs: 10, bakeMs: 4, burnBufferMs: 5, prepMs: 3 });
    let s = at(resume(start(config)), 10); s = move(s, 1, 'prep'); s = at(s, 13); s = move(s, 1, 'oven');
    s = at(s, 22);
    expect(kinds(s, 22)).toEqual(['arrival', 'blockEnd', 'blockStart', 'discard']);
    expect(s.tickets[0].angry).toBe(false); // synthetic coincident burn/anger
  });
  it('zero-buffer synthetic boundary emits readiness before burn at the same timestamp', () => {
    let s = move(admit(resume(start(testConfig({ count: 1, burnBufferMs: 0 }))), 1), 1, 'prep');
    s = move(at(s, 3), 1, 'oven'); s = at(s, 7);
    expect(kinds(s, 7)).toEqual(['ready', 'discard']);
    error(s, { kind: 'move', orderKey: 'order-1', to: 'boxDeliver' }, 'NOT_ACTIVE');
  });
  it('complete synthetic coincident batch preserves category order and caller-envelope order', () => {
    const config = testConfig({ policy: 'interval-push', guidedStart: true, count: 5,
      arrivals: [0, 0, 0, 0, 20], intervalMs: 5, prepMs: 3, bakeMs: 4, burnBufferMs: 13, patienceMs: 10,
      holds: [{ holdId: 'a', orderKey: 'order-5', startMs: 1, endMs: 20, reason: 'fixture-dependency' },
        { holdId: 'b', orderKey: 'order-5', startMs: 20, endMs: 30, reason: 'fixture-dependency' }] });
    let s = move(resume(start(config)), 1, 'prep');
    s = action(s, { kind: 'set-pause', reason: 'guide', active: false });
    s = move(at(s, 3), 1, 'oven');
    s = move(at(s, 17), 2, 'prep'); s = at(s, 20);
    expect(kinds(s, 20)).toEqual(['arrival', 'blockEnd', 'blockStart', 'ready', 'discard', 'anger', 'admission']);
    s = move(s, 2, 'oven');
    expect(kinds(s, 20).slice(-2)).toEqual(['commandAccepted', 'movement']);
  });
});

describe('termination, replay and immutable provenance', () => {
  it('fixed horizon differs from actual early-clear; future external/scheduled demand prevents false clear', () => {
    for (const endCondition of ['fixed-horizon', 'all-resolved-or-horizon'] as const) {
      let s = admit(resume(start(testConfig({ count: 1, endCondition }))), 1);
      s = at(s, 5); s = action(s, { kind: 'discard', orderKey: 'order-1' });
      expect(s.ended).toBe(endCondition === 'fixed-horizon' ? null : 'all-resolved');
      s = at(s, 50); expect(s.nowMs).toBe(endCondition === 'fixed-horizon' ? 50 : 5);
    }
    let s = admit(resume(start(testConfig({ count: 2, arrivals: [0, 40], endCondition: 'all-resolved-or-horizon' }))), 1);
    s = action(s, { kind: 'discard', orderKey: 'order-1' }); expect(s.ended).toBeNull();
    expect(start(testConfig({ count: 0, endCondition: 'all-resolved-or-horizon' })).ended).toBe('all-resolved');
  });
  it('manual stop emits envelope then one end, freezes actual window and rejects all subsequent commands', () => {
    let s = at(resume(start()), 13); s = action(s, { kind: 'end', reason: 'manual-stop' });
    expect(kinds(s, 13)).toEqual(['commandAccepted', 'runEnded']); expect(s.nowMs).toBe(13);
    expect(at(s, 50)).toBe(s); error(s, { kind: 'set-pause', reason: 'help', active: true }, 'ENDED');
  });
  it('replay retains ordered effective commands and fresh order instance identities', () => {
    const config = testConfig({ count: 1 });
    let s = admit(resume(start(config, 'local:run:1')), 1); s = move(s, 1, 'prep');
    s = move(at(s, 3), 1, 'oven'); s = move(at(s, 7), 1, 'boxDeliver'); s = move(s, 1, 'served'); s = at(s, 50);
    const same = value(replay(config, 'local:run:1', replayFrames(s), 50)).state; expect(same).toEqual(s);
    const fresh = value(replay(config, 'local:run:2', replayFrames(s), 50)).state;
    expect(fresh.tickets[0].orderKey).toBe(s.tickets[0].orderKey); expect(fresh.tickets[0].orderId).not.toBe(s.tickets[0].orderId);
    expect(fresh.events.map(({ runId, seq, ...e }) => ({ ...e, ...('orderId' in e ? { orderId: 'normalized' } : {}) }))).toEqual(
      s.events.map(({ runId, seq, ...e }) => ({ ...e, ...('orderId' in e ? { orderId: 'normalized' } : {}) })));
    expect(value(snapshotFromEngine(s)).metrics).toMatchObject({ served: 1, burnt: 0, angry: 0, score: 4,
      servedSample: { n: 1, sumSimMs: 7, meanSimMs: 7 } });
    expect(Object.isFrozen(s.events[0])).toBe(true);
  });
  it('rejects backwards frames, later simulated actions under pause, and caller frame at horizon', () => {
    const c = testConfig();
    expect(replay(c, 'r', [{ atMs: 1, command: { kind: 'speed', speed: 2 } }], 5).ok).toBe(false);
    expect(replay(c, 'r', [{ atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } },
      { atMs: 5, command: { kind: 'speed', speed: 2 } }, { atMs: 4, command: { kind: 'speed', speed: 1 } }], 10).ok).toBe(false);
    expect(replay(c, 'r', [{ atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } },
      { atMs: 50, command: { kind: 'end', reason: 'manual-stop' } }], 50).ok).toBe(false);
  });
  it.each(['easy', 'normal', 'hard'] as const)('preserves ordinary %s patience and does not invent ordinary anger reduction', difficulty => {
    const config = value(makeFixedDeckConfig({ difficulty, policy: 'interval-push' }));
    const s = at(resume(start(config)), config.manifest.horizonMs);
    expect(s.events.filter(e => e.kind === 'anger')).toEqual([]);
  });
  it('rejects malformed runtime state and owns its config independently', () => {
    const config: any = clone(testConfig()); const s = value(createEngine('r', config)).state;
    config.manifest.orders[0].prepMs = 100;
    expect(s.config.manifest.orders[0].prepMs).toBe(3);
    expect(advanceTo({ ...s, personal: 'x' } as any, 3).ok).toBe(false);
    expect(createEngine('a personal name', config).ok).toBe(false);
  });
  it('rejects unknown event keys, forged readiness, absent open holds and extra status fields before mutation', () => {
    const config = testConfig({ count: 1, holds: [{ holdId: 'h', orderKey: 'order-1', startMs: 1, endMs: 40, reason: 'fixture-dependency' }] });
    const s = at(move(admit(resume(start(config)), 1), 1, 'prep'), 2);
    for (const mutate of [
      (x: any) => { x.events[0].personal = 'x'; },
      (x: any) => { x.tickets[0].ready = true; },
      (x: any) => { x.tickets[0].holds = []; },
      (x: any) => { x.tickets[0].staffing = 4; },
    ]) {
      const forged: any = clone(s); mutate(forged);
      expect(advanceTo(forged, 3).ok).toBe(false);
      expect(applyAction(forged, { kind: 'set-pause', reason: 'help', active: true }).accepted).toBe(false);
    }
  });
});
