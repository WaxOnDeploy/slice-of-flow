import { describe, expect, it } from 'vitest';
import { account } from './accounting';
import { action, admit, at, clone, move, resume, start, testConfig, value } from './fixtures/testCases';
import type { Engine, EventData, HistoryEvidence, RunConfig } from './types';
const history = (s: Engine): HistoryEvidence => ({ schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: s.events });
function ledger(rows: readonly (EventData & {atMs: number})[], runId = 'r'): HistoryEvidence {
  return { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete',
    events: rows.map((e, i) => ({ ...e, runId, seq: i + 1 })) };
}
const ref = (n: number) => ({ orderKey: `order-${n}`, orderId: `r:order:${n}` });
const fold = (s: Engine) => value(account(s.config, s.runId, history(s), s.nowMs));

describe('independent canonical transition fold', () => {
  it('hand-authored all-stage served/unfinished ledger integrates final interval and distinct admission population', () => {
    const c = testConfig({ count: 3, horizonMs: 120000, prepMs: 30000, bakeMs: 40000, burnBufferMs: 15000, patienceMs: 480000 });
    const h = ledger([
      { kind: 'runStarted', atMs: 0 }, ...[1, 2, 3].map(n => ({ kind: 'arrival' as const, ...ref(n), atMs: 0 })),
      { kind: 'admission', ...ref(1), by: 'pull', atMs: 0 },
      { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep', atMs: 0 },
      { kind: 'ready', ...ref(1), station: 'prep', atMs: 30000 },
      { kind: 'movement', ...ref(1), from: 'prep', to: 'oven', atMs: 30000 },
      { kind: 'admission', ...ref(2), by: 'pull', atMs: 60000 },
      { kind: 'movement', ...ref(2), from: 'orderQueue', to: 'prep', atMs: 60000 },
      { kind: 'ready', ...ref(1), station: 'oven', atMs: 70000 },
      { kind: 'movement', ...ref(1), from: 'oven', to: 'boxDeliver', atMs: 70000 },
      { kind: 'service', ...ref(1), from: 'boxDeliver', atMs: 90000 },
      { kind: 'ready', ...ref(2), station: 'prep', atMs: 90000 },
      { kind: 'movement', ...ref(2), from: 'prep', to: 'oven', atMs: 90000 },
      { kind: 'runEnded', reason: 'horizon', atMs: 120000 },
    ]);
    const a = value(account(c, 'r', h, 120000));
    expect(a).toMatchObject({ arrived: 3, external: 1, admitted: 2, active: 1, served: 1, discarded: 0,
      stateAreaMs: { orderQueue: 0, prep: 60000, oven: 70000, boxDeliver: 20000 }, areaTicketMs: 150000,
      servedSample: { n: 1, sumSimMs: 90000, meanSimMs: 90000 } });
    // Independent arithmetic: A's 90s exit + B's unfinished (120-60)s = 150s.
    expect(a.areaTicketMs).toBe(90000 + (120000 - 60000));
    for (let n = 1; n <= h.events.length; n++) {
      const prefix = { ...h, events: h.events.slice(0, n) };
      const end = prefix.events[n - 1].atMs;
      const p = value(account(c, 'r', prefix, end, { requireEnded: false }));
      expect(p.admitted).toBe(p.active + p.served + p.discarded);
      expect(p.arrived).toBe(p.external + p.admitted);
      expect(Object.values(p.byStation).reduce((x, y) => x + y, 0)).toBe(p.active);
    }
  });
  it('counts burnt as one discard exit including its full admitted age and excludes eventual-served filtering', () => {
    let s = resume(start(testConfig({ count: 2, horizonMs: 120000, prepMs: 30000, bakeMs: 40000, burnBufferMs: 15000, patienceMs: 480000 })));
    s = move(admit(s, 1), 1, 'prep'); s = at(s, 30000); s = move(s, 1, 'oven'); s = move(admit(s, 2), 2, 'prep');
    s = move(at(s, 60000), 2, 'oven'); s = move(at(s, 70000), 1, 'boxDeliver'); s = move(at(s, 90000), 1, 'served'); s = at(s, 120000);
    const a = fold(s);
    expect(a).toMatchObject({ admitted: 2, active: 0, served: 1, burnt: 1, discarded: 1, areaTicketMs: 175000,
      stateAreaMs: { orderQueue: 0, prep: 60000, oven: 95000, boxDeliver: 20000 },
      servedSample: { n: 1, sumSimMs: 90000, meanSimMs: 90000 } });
    expect(a.orders[1]).toMatchObject({ outcome: 'burnt', admittedAtMs: 30000, exitedAtMs: 115000 });
  });
  it.each([0, 15000])('overlapping holds before/after admission at %j count active ticket once', admissionMs => {
    const c = testConfig({ count: 1, horizonMs: 50000, holds: [
      { holdId: 'a', orderKey: 'order-1', startMs: 10000, endMs: 30000, reason: 'fixture-dependency' },
      { holdId: 'b', orderKey: 'order-1', startMs: 20000, endMs: 40000, reason: 'fixture-dependency' },
    ] });
    let s = at(resume(start(c)), admissionMs); s = admit(s, 1); s = at(s, 50000);
    const a = fold(s);
    expect(a.areaTicketMs).toBe(50000 - admissionMs);
    expect(a.blockedTicketMs).toBe(admissionMs === 0 ? 30000 : 25000);
    expect(a.orders[0].holds).toEqual([]);
  });
  it('pre-admission/open holds contribute zero external WIP and clip to manual end', () => {
    const c = testConfig({ count: 1, horizonMs: 50000, holds: [{ holdId: 'a', orderKey: 'order-1', startMs: 10000, endMs: 40000, reason: 'fixture-dependency' }] });
    let s = at(resume(start(c)), 20000); s = action(s, { kind: 'end', reason: 'manual-stop' });
    expect(fold(s)).toMatchObject({ active: 0, external: 1, blockedTicketMs: 0, areaTicketMs: 0 });
    let t = at(resume(start(c)), 15000); t = admit(t, 1); t = at(t, 25000); t = action(t, { kind: 'end', reason: 'manual-stop' });
    expect(fold(t)).toMatchObject({ active: 1, blockedTicketMs: 10000, areaTicketMs: 10000 });
    expect(fold(t).orders[0].holds).toEqual(['a']);
  });
  it('hold union closes only one owner, hazards proceed while held, post-exit hold end is retained without active area', () => {
    const c = testConfig({ count: 1, horizonMs: 50, holds: [
      { holdId: 'a', orderKey: 'order-1', startMs: 5, endMs: 10, reason: 'fixture-dependency' },
      { holdId: 'b', orderKey: 'order-1', startMs: 6, endMs: 40, reason: 'fixture-dependency' },
    ] });
    let s = move(admit(resume(start(c)), 1), 1, 'prep'); s = move(at(s, 3), 1, 'oven'); s = at(s, 50);
    expect(fold(s)).toMatchObject({ active: 0, burnt: 1, areaTicketMs: 22, blockedTicketMs: 17 });
    expect(s.events.filter(e => e.kind === 'discard')).toHaveLength(1);
    expect(s.events.filter(e => e.kind === 'blockEnd').map(e => e.atMs)).toEqual([10, 40]);
  });
  it('includes full final partial push interval: (25-10)+(25-20)=20ms', () => {
    const s = at(resume(start(testConfig({ count: 3, policy: 'interval-push', horizonMs: 25 }))), 25);
    expect(fold(s)).toMatchObject({ active: 2, external: 1, areaTicketMs: 20, stateAreaMs: { orderQueue: 20, prep: 0, oven: 0, boxDeliver: 0 } });
  });
  it('nonnegative served-time measurement port accepts zero sample but does not relax gameplay physics', () => {
    const c = testConfig({ count: 1, horizonMs: 10 });
    const h = ledger([
      { kind: 'runStarted', atMs: 0 }, { kind: 'arrival', ...ref(1), atMs: 0 },
      { kind: 'admission', ...ref(1), by: 'pull', atMs: 0 },
      { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep', atMs: 0 },
      { kind: 'movement', ...ref(1), from: 'prep', to: 'oven', atMs: 0 },
      { kind: 'movement', ...ref(1), from: 'oven', to: 'boxDeliver', atMs: 0 },
      { kind: 'service', ...ref(1), from: 'boxDeliver', atMs: 0 },
      { kind: 'runEnded', reason: 'horizon', atMs: 10 },
    ]);
    expect(value(account(c, 'r', h, 10)).servedSample).toEqual({ definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 0, meanSimMs: 0 });
  });
});

describe('ledger failures close the whole measurement', () => {
  const c: RunConfig = testConfig({ count: 1, horizonMs: 10 });
  const valid = ledger([{ kind: 'runStarted', atMs: 0 }, { kind: 'arrival', ...ref(1), atMs: 0 },
    { kind: 'admission', ...ref(1), by: 'pull', atMs: 0 }, { kind: 'discard', ...ref(1), from: 'orderQueue', reason: 'manual', atMs: 5 },
    { kind: 'runEnded', reason: 'horizon', atMs: 10 }]);
  it.each([
    (h: any) => { delete h.events; }, (h: any) => { h.completeness = 'partial'; },
    (h: any) => { h.source = 'legacy-summary'; }, (h: any) => { h.events[1].orderId = 'different'; },
    (h: any) => { h.events[2].seq = 2; }, (h: any) => { h.events[3].atMs = -1; },
    (h: any) => { h.events[3].atMs = 11; }, (h: any) => { h.events[3].atMs = NaN; },
    (h: any) => { h.events[3].from = 'unknown'; }, (h: any) => { h.events[3].customer = 'x'; },
    (h: any) => { h.events[2].kind = 'unknown'; }, (h: any) => { h.events = h.events.filter((_: any, i: number) => i !== 1).map((e: any, i: number) => ({ ...e, seq: i + 1 })); },
    (h: any) => { h.events[3].reason = 'burnt'; },
    (h: any) => { h.events.splice(4, 0, { ...h.events[3] }); h.events.forEach((e: any, i: number) => { e.seq = i + 1; }); },
    (h: any) => { h.events[4].reason = 'service-bell'; },
    (h: any) => { h.events.push({ ...h.events[4], seq: 6 }); },
  ])('rejects malformed or unreconciled ledger %#', mutate => {
    const h = clone(valid); mutate(h); expect(account(c, 'r', h, 10).ok).toBe(false);
  });
  it('absent recording is not a valid empty run; even an empty run needs lifecycle finalization', () => {
    expect(account(c, 'r', { ...valid, events: [] }, 10).ok).toBe(false);
    expect(account(testConfig({ count: 0, horizonMs: 10 }), 'r', ledger([{ kind: 'runStarted', atMs: 0 }, { kind: 'runEnded', reason: 'horizon', atMs: 10 }]), 10).ok).toBe(true);
    expect(account(c, 'r', { ...valid, events: valid.events.slice(0, -1) }, 10).ok).toBe(false);
  });
  it('does not mutate supplied ledger or fixtures and returns deeply frozen rows/areas', () => {
    const h = clone(valid), before = clone(h); const a = value(account(c, 'r', h, 10));
    expect(h).toEqual(before); expect(Object.isFrozen(a.orders[0].holds)).toBe(true); expect(Object.isFrozen(a.stateAreaMs)).toBe(true);
  });
});
