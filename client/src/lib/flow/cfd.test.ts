import { describe, expect, it } from 'vitest';
import { buildCfd, cfdPointAt, type CfdPoint } from './cfd';
import { clone, testConfig, value } from '../sofEngine/fixtures/testCases';
import { snapshotFromEngine, validateSnapshot } from '../sofEngine/runSnapshots';
import { makeFixedDeckConfig } from '../sofEngine/scenario';
import { replay } from '../sofEngine/engine';
import type { EventData, FinalOrder, FinalRunSnapshot, RunConfig } from '../sofEngine/types';

const ref = (n: number) => ({ orderKey: `order-${n}`, orderId: `r:order:${n}` });
const event = (atMs: number, data: EventData) => ({ ...data, atMs });
const final = (n: number, outcome: FinalOrder['outcome'], finalStation: FinalOrder['finalStation'], admittedAtMs: number | null,
  exitedAtMs: number | null, angry = false): FinalOrder => ({ ...ref(n), outcome, finalStation, admittedAtMs, exitedAtMs, angry });
/** Hand-authored snapshots and expected numbers only. No producer/reducer generates the oracle. */
function port(config: RunConfig, rows: readonly (EventData & { atMs: number })[], orders: readonly FinalOrder[],
  metrics: FinalRunSnapshot['metrics'], endMs = config.manifest.horizonMs): FinalRunSnapshot {
  return { schema: 'sof-run/v1', kind: 'independent-final', runId: 'r', config,
    history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete',
      events: rows.map((e, i) => ({ ...e, runId: 'r', seq: i + 1 })) },
    observation: { startMs: 0, endMs, durationMs: endMs }, endReason: rows.at(-1)!.kind === 'runEnded' ? (rows.at(-1)! as Extract<EventData, { kind: 'runEnded' }>).reason : 'horizon',
    orders, metrics };
}
const zeroMetrics: FinalRunSnapshot['metrics'] = { served: 0, burnt: 0, angry: 0, stillInProgress: 0, score: 0,
  servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 0, sumSimMs: 0, meanSimMs: null } };
function empty(durationMs = 37000): FinalRunSnapshot {
  return port(testConfig({ count: 0, horizonMs: durationMs }), [event(0, { kind: 'runStarted' }), event(durationMs, { kind: 'runEnded', reason: 'horizon' })], [], zeroMetrics);
}
function mixed(): FinalRunSnapshot {
  const c = testConfig({ count: 4, horizonMs: 105000, prepMs: 30000, bakeMs: 40000, patienceMs: 480000 });
  return port(c, [
    event(0, { kind: 'runStarted' }), ...[1, 2, 3, 4].map(n => event(0, { kind: 'arrival', ...ref(n) })),
    ...[1, 2, 3].map(n => event(0, { kind: 'admission', ...ref(n), by: 'pull' })),
    event(5000, { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep' }),
    event(6000, { kind: 'movement', ...ref(2), from: 'orderQueue', to: 'prep' }),
    event(10000, { kind: 'discard', ...ref(3), from: 'orderQueue', reason: 'manual' }),
    event(35000, { kind: 'movement', ...ref(1), from: 'prep', to: 'oven' }),
    event(36000, { kind: 'movement', ...ref(2), from: 'prep', to: 'oven' }),
    event(75000, { kind: 'movement', ...ref(1), from: 'oven', to: 'boxDeliver' }),
    event(76000, { kind: 'service', ...ref(1), from: 'boxDeliver' }),
    event(91000, { kind: 'discard', ...ref(2), from: 'oven', reason: 'burnt' }),
    event(105000, { kind: 'runEnded', reason: 'horizon' }),
  ], [final(1, 'served', null, 0, 76000), final(2, 'burnt', null, 0, 91000),
    final(3, 'discarded', null, 0, 10000), final(4, 'not-admitted', null, null, null)],
  { served: 1, burnt: 1, angry: 0, stillInProgress: 0, score: -1,
    servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 76000, meanSimMs: 76000 } });
}
const bandTuple = (p: CfdPoint) => [p.bands.waiting, p.bands.orderQueue, p.bands.prep, p.bands.oven, p.bands.boxDeliver, p.bands.served, p.bands.discarded];

describe('one canonical final history to true cumulative bands', () => {
  it('matches every hand-authored mixed fixture prefix, including all same-time transitions and final interval', () => {
    const m = value(buildCfd(mixed()));
    // Initial zero, runStarted, four availability transitions, three admissions, movements/exits/end.
    expect(m.points.map(bandTuple)).toEqual([
      [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0], [4, 0, 0, 0, 0, 0, 0],
      [3, 1, 0, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0, 0], [1, 3, 0, 0, 0, 0, 0],
      [1, 2, 1, 0, 0, 0, 0], [1, 1, 2, 0, 0, 0, 0], [1, 0, 2, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 0, 1], [1, 0, 0, 2, 0, 0, 1], [1, 0, 0, 1, 1, 0, 1],
      [1, 0, 0, 1, 0, 1, 1], [1, 0, 0, 0, 0, 1, 2], [1, 0, 0, 0, 0, 1, 2],
    ]);
    expect(m.points.map(p => p.throughSeq)).toEqual([null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(m.points.at(-1)).toMatchObject({ atMs: 105000, atSimSec: 105, active: 0,
      raw: { arrived: 4, admitted: 3, enteredPrep: 2, enteredOven: 2, enteredBox: 1, served: 1, discarded: 2,
        burnt: 1, otherDiscard: 1, discardedByStation: { orderQueue: 1, prep: 0, oven: 1, boxDeliver: 0 } },
      boundaries: { served: 1, exited: 3, leftOven: 3, leftPrep: 3, leftOrders: 3, admitted: 3, arrived: 4 } });
    expect(m.producerEvidence).toBe('not-established'); expect(m.productionManifest).toBe(false);
    expect(m.validation).toBe('independent-accounting'); expect(m.humanPlay).toBe('not-established');
    expect(m.population).toBe('externally-available-orders/v1'); expect(m.units.population).toBe('tickets');
    expect(value(cfdPointAt(m, 50000)).bands).toEqual({ served: 0, discarded: 1, boxDeliver: 0, oven: 2, prep: 0, orderQueue: 0, waiting: 1 });
  });
  it('right-continuous time lookup includes all equal-time transitions and accepts non-event times exactly', () => {
    const m = value(buildCfd(mixed()));
    expect(value(cfdPointAt(m, 0)).throughSeq).toBe(8);
    expect(value(cfdPointAt(m, 75999)).bands.boxDeliver).toBe(1);
    expect(value(cfdPointAt(m, 76000)).bands.served).toBe(1);
    expect(value(cfdPointAt(m, 105000)).atMs).toBe(105000);
  });
  it('canonical manifest identity is distinct from replay-compatible evidence and never establishes human play', () => {
    const c = value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' }));
    const captured = value(snapshotFromEngine(value(replay(c, 'r', [
      { atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } },
      { atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } },
    ], 1000)).state));
    const producer = value(buildCfd(captured));
    expect(producer.productionManifest).toBe(true); expect(producer.producerEvidence).toBe('producer-compatible');
    const raw: any = clone(captured);
    raw.history.events = raw.history.events.filter((e: any) => e.kind !== 'commandAccepted').map((e: any, i: number) => ({ ...e, seq: i + 1 }));
    const accountingOnly = value(buildCfd(raw));
    expect(accountingOnly.productionManifest).toBe(true); expect(accountingOnly.producerEvidence).toBe('not-established');
    expect(accountingOnly.humanPlay).toBe('not-established'); expect(producer.humanPlay).toBe('not-established');
  });
  it.each([0, 37000])('valid empty %sms retains zero/final observations, distinct from absent data', duration => {
    const m = value(buildCfd(empty(duration)));
    expect(m.points.map(p => p.atMs)).toEqual([0, 0, duration]);
    expect(m.points.every(p => Object.values(p.bands).every(v => v === 0))).toBe(true);
    expect(value(cfdPointAt(m, duration)).active).toBe(0);
  });
  it('unfinished work retains its actual station and final partial interval without synthetic exit', () => {
    const c = testConfig({ count: 1, horizonMs: 37000 });
    const s = port(c, [event(0, { kind: 'runStarted' }), event(0, { kind: 'arrival', ...ref(1) }),
      event(0, { kind: 'admission', ...ref(1), by: 'pull' }), event(5000, { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep' }),
      event(37000, { kind: 'runEnded', reason: 'horizon' })], [final(1, 'active', 'prep', 0, null)], { ...zeroMetrics, stillInProgress: 1 });
    const m = value(buildCfd(s)); expect(m.points.at(-1)).toMatchObject({ atMs: 37000, active: 1, bands: { prep: 1, served: 0, discarded: 0 } });
    expect(value(cfdPointAt(m, 36999)).stations.prep).toBe(1);
  });
  it.each([0, 10000])('valid zero served-duration port sample ending %sms preserves every zero-time transition', endMs => {
    const c = testConfig({ count: 1, horizonMs: endMs });
    const s = port(c, [event(0, { kind: 'runStarted' }), event(0, { kind: 'arrival', ...ref(1) }),
      event(0, { kind: 'admission', ...ref(1), by: 'pull' }),
      event(0, { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep' }),
      event(0, { kind: 'movement', ...ref(1), from: 'prep', to: 'oven' }),
      event(0, { kind: 'movement', ...ref(1), from: 'oven', to: 'boxDeliver' }),
      event(0, { kind: 'service', ...ref(1), from: 'boxDeliver' }), event(endMs, { kind: 'runEnded', reason: 'horizon' })],
    [final(1, 'served', null, 0, 0)], { ...zeroMetrics, served: 1, score: 4,
      servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 0, meanSimMs: 0 } });
    const m = value(buildCfd(s)); expect(m.points).toHaveLength(9); expect(m.points.at(-1)!.bands.served).toBe(1);
    expect(m.producerEvidence).toBe('not-established'); expect(m.observation.durationMs).toBe(endMs);
  });
  it('final-time service is applied before the final point, not clipped out', () => {
    const s: any = clone(mixed());
    s.history.events.find((e: any) => e.kind === 'service').atMs = 105000;
    // Preserve canonical order explicitly, never sorting inside production.
    const service = s.history.events.splice(14, 1)[0]; s.history.events.splice(15, 0, service);
    s.history.events.forEach((e: any, i: number) => { e.seq = i + 1; });
    s.orders[0].exitedAtMs = 105000; s.metrics.servedSample.sumSimMs = 105000; s.metrics.servedSample.meanSimMs = 105000;
    const m = value(buildCfd(s)); expect(m.points.at(-1)!.bands.served).toBe(1);
    expect(m.points.filter(p => p.atMs === 105000).map(p => p.eventKind)).toEqual(['service', 'runEnded']);
  });
  it.each(['orderQueue', 'prep', 'oven', 'boxDeliver'] as const)('manual discard at %s enters one exit band, not a virtual downstream visit', station => {
    const route = ['orderQueue', 'prep', 'oven', 'boxDeliver'] as const;
    const rows = [event(0, { kind: 'runStarted' }), event(0, { kind: 'arrival', ...ref(1) }), event(0, { kind: 'admission', ...ref(1), by: 'pull' })];
    for (let i = 1; i <= route.indexOf(station); i++) rows.push(event(i, { kind: 'movement', ...ref(1), from: route[i - 1], to: route[i] }));
    rows.push(event(5, { kind: 'discard', ...ref(1), from: station, reason: 'manual' }), event(10, { kind: 'runEnded', reason: 'horizon' }));
    const m = value(buildCfd(port(testConfig({ count: 1, horizonMs: 10 }), rows, [final(1, 'discarded', null, 0, 5)], zeroMetrics)));
    expect(m.points.at(-1)!.bands.discarded).toBe(1); expect(m.points.at(-1)!.raw.discardedByStation[station]).toBe(1);
    expect(m.points.at(-1)!.boundaries).toEqual({ served: 0, exited: 1, leftOven: 1, leftPrep: 1, leftOrders: 1, admitted: 1, arrived: 1 });
    expect(m.points.at(-1)!.raw.enteredBox).toBe(station === 'boxDeliver' ? 1 : 0);
  });
  it('anger changes no population; admitted burnt/angry ticket still exits only once', () => {
    const c = testConfig({ count: 1, horizonMs: 20, patienceMs: 5 });
    const s = port(c, [event(0, { kind: 'runStarted' }), event(0, { kind: 'arrival', ...ref(1) }), event(0, { kind: 'admission', ...ref(1), by: 'pull' }),
      event(0, { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep' }), event(1, { kind: 'movement', ...ref(1), from: 'prep', to: 'oven' }),
      event(5, { kind: 'anger', ...ref(1) }), event(10, { kind: 'discard', ...ref(1), from: 'oven', reason: 'burnt' }), event(20, { kind: 'runEnded', reason: 'horizon' })],
    [final(1, 'burnt', null, 0, 10, true)], { ...zeroMetrics, burnt: 1, score: -2 });
    const m = value(buildCfd(s)); expect(bandTuple(m.points[5])).toEqual(bandTuple(m.points[6]));
    expect(m.points.at(-1)!.raw).toMatchObject({ served: 0, discarded: 1, burnt: 1 });
  });
  it('overlapping holds annotate the active actual station once, including pre-admission and post-exit holds', () => {
    const c = testConfig({ count: 1, horizonMs: 50, holds: [
      { holdId: 'a', orderKey: 'order-1', startMs: 0, endMs: 30, reason: 'fixture-dependency' },
      { holdId: 'b', orderKey: 'order-1', startMs: 15, endMs: 40, reason: 'fixture-dependency' },
      { holdId: 'after', orderKey: 'order-1', startMs: 45, endMs: 60, reason: 'fixture-dependency' },
    ] });
    const s = port(c, [event(0, { kind: 'runStarted' }), event(0, { kind: 'arrival', ...ref(1) }), event(0, { kind: 'blockStart', ...ref(1), holdId: 'a' }),
      event(10, { kind: 'admission', ...ref(1), by: 'pull' }), event(10, { kind: 'movement', ...ref(1), from: 'orderQueue', to: 'prep' }),
      event(15, { kind: 'blockStart', ...ref(1), holdId: 'b' }), event(30, { kind: 'blockEnd', ...ref(1), holdId: 'a' }),
      event(35, { kind: 'discard', ...ref(1), from: 'prep', reason: 'manual' }), event(40, { kind: 'blockEnd', ...ref(1), holdId: 'b' }),
      event(45, { kind: 'blockStart', ...ref(1), holdId: 'after' }), event(50, { kind: 'runEnded', reason: 'horizon' })],
    [final(1, 'discarded', null, 10, 35)], zeroMetrics);
    const m = value(buildCfd(s));
    expect(m.points.map(p => p.blockedByStation.prep)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0]);
    expect(m.points[4].blockedByStation.orderQueue).toBe(1); // hold contribution begins at admission.
    expect(m.points.at(-1)!.active).toBe(0); expect(m.points.at(-1)!.bands.discarded).toBe(1);
  });
  it('external/scheduled holds stay zero-active and open active holds remain annotated at manual end', () => {
    const c = testConfig({ count: 1, horizonMs: 50, arrivals: [20], holds: [{ holdId: 'h', orderKey: 'order-1', startMs: 5, endMs: 40, reason: 'fixture-dependency' }] });
    const s = port(c, [event(0, { kind: 'runStarted' }), event(5, { kind: 'blockStart', ...ref(1), holdId: 'h' }),
      event(20, { kind: 'arrival', ...ref(1) }), event(25, { kind: 'admission', ...ref(1), by: 'pull' }), event(30, { kind: 'runEnded', reason: 'manual-stop' })],
    [final(1, 'active', 'orderQueue', 25, null)], { ...zeroMetrics, stillInProgress: 1 }, 30);
    const m = value(buildCfd(s));
    expect(m.points[2]).toMatchObject({ active: 0, raw: { arrived: 0 }, blockedByStation: { orderQueue: 0 } });
    expect(m.points[3]).toMatchObject({ active: 0, bands: { waiting: 1 }, blockedByStation: { orderQueue: 0 } });
    expect(m.points.at(-1)).toMatchObject({ active: 1, blockedByStation: { orderQueue: 1 } });
  });
});

describe('CFD public fail-closed boundaries and immutability', () => {
  it.each([
    (s: any) => { s.history = null; }, (s: any) => { delete s.history.events; },
    (s: any) => { s.history.events = []; }, (s: any) => { s.history.completeness = 'partial'; },
    (s: any) => { s.history.source = 'legacy-summary'; }, (s: any) => { s.history.events[2].seq = 2; },
    (s: any) => { s.history.events[10].atMs = 1; }, (s: any) => { s.history.events[10].atMs = -1; },
    (s: any) => { s.history.events[10].atMs = NaN; }, (s: any) => { s.history.events[10].atMs = Infinity; },
    (s: any) => { s.history.events[10].atMs = 105001; }, (s: any) => { s.history.events[10].atMs = 1.5; },
    (s: any) => { s.history.events[1].orderKey = 'unknown'; }, (s: any) => { s.history.events[1].orderId = 'wrong'; },
    (s: any) => { s.history.events[8].to = 'oven'; }, (s: any) => { s.history.events[8].from = 'oven'; },
    (s: any) => { s.history.events[10].reason = 'burnt'; }, (s: any) => { s.history.events[14].from = 'oven'; },
    (s: any) => { s.metrics.served = 2; }, (s: any) => { s.metrics.burnt = 2; },
    (s: any) => { s.orders[1].outcome = 'active'; }, (s: any) => { s.endReason = 'service-bell'; },
    (s: any) => { s.history.events.splice(16, 0, { ...s.history.events[15] }); s.history.events.forEach((e: any, i: number) => { e.seq = i + 1; }); },
    (s: any) => { s.history.events[10] = { ...s.history.events[10], kind: 'blockEnd', holdId: 'missing' }; },
    (s: any) => { s.config.resources.occupancy.oven = 4; }, (s: any) => { s.customer = 'label'; },
  ])('rejects broken history/accounting instead of sorting, smoothing or inferring %#', mutate => {
    const s = clone(mixed()); mutate(s); expect(() => buildCfd(s)).not.toThrow(); expect(buildCfd(s).ok).toBe(false);
  });
  it.each([null, undefined, 0, [], {}, { served: 0 }])('absent/unknown input is not a valid empty observation %#', input => {
    expect(buildCfd(input).ok).toBe(false); expect(cfdPointAt(input, 0).ok).toBe(false);
  });
  it.each([-1, 105001, NaN, Infinity, 1.5, '0', null, undefined])('invalid/out-of-window time fails checked, not throwing %#', time => {
    const m = value(buildCfd(mixed())); expect(() => cfdPointAt(m, time)).not.toThrow(); expect(cfdPointAt(m, time).ok).toBe(false);
  });
  it('forged CFD points cannot be queried as authentic output', () => {
    const m: any = clone(value(buildCfd(mixed()))); m.points[2].bands.waiting = 99;
    expect(cfdPointAt(m, 0).ok).toBe(false);
  });
  it('owns/freeze nested data without mutating/freeze input and remains stable after later mutation', () => {
    const s: any = clone(mixed()), before = clone(s); const m = value(buildCfd(s));
    expect(s).toEqual(before); expect(Object.isFrozen(s.history.events)).toBe(false);
    expect(Object.isFrozen(m.points[2].bands)).toBe(true); expect(Object.isFrozen(m.snapshot.config.manifest.orders)).toBe(true);
    s.history.events[1].atMs = 99; s.orders.length = 0;
    expect(m.snapshot.history.events[1].atMs).toBe(0); expect(m.points[2].bands.waiting).toBe(1);
    expect(value(cfdPointAt(m, 0)).raw.arrived).toBe(4);
    const hostile = Object.defineProperty({}, 'schema', { get() { throw new Error('getter'); } });
    expect(() => buildCfd(hostile)).not.toThrow(); expect(() => cfdPointAt(hostile, 0)).not.toThrow();
  });
  it('canonical snapshot validation and CFD independently agree on explicit hand-authored outcomes', () => {
    expect(validateSnapshot(mixed()).ok).toBe(true); expect(value(buildCfd(mixed())).points.at(-1)!.active).toBe(0);
  });
});
