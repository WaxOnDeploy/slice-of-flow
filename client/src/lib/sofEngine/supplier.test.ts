import { describe, expect, it } from 'vitest';
import { account, blockedDurationsFromValidatedHistory } from './accounting';
import { advanceTo, applyAction, createEngine, replay, replayFrames, validateEngine } from './engine';
import { applyWallControl, createDriver, sampleWall } from './driver';
import { makeFixedDeckConfig, resolveManifest, validateConfig, validateManifest, VERSIONS, VIP_RESOURCES } from './scenario';
import { createRunDraft, finalizeRun, snapshotFromEngine, validateSnapshot } from './runSnapshots';
import { assessComparison, inspectProducerCompatibility, type PairSpec } from './matchedRuns';
import { makeSupplierConfig, measureSupplierResults, readSupplierBlock, SUPPLIER_PILOT_TIMING, SUPPLIER_VERSIONS, type SupplierVariant } from './supplier';
import { oldestSupplierOrder } from './supplierRules';
import { action, admit, at, clone, move, resume, start, testConfig, value } from './fixtures/testCases';
import type { Engine, EngineEvent, FinalRunSnapshot, HistoryEvidence, ReplayFrame, RunConfig, Speed } from './types';

const config = (variant: SupplierVariant = 'managed', extra: { initialSpeed?: Speed; guidedStart?: boolean } = {}) => value(makeSupplierConfig({ variant, initialSpeed: 1, ...extra }));
function running(variant: SupplierVariant = 'managed', id = variant, guidedStart = false): Engine {
  let s = resume(value(createEngine(id, config(variant, { guidedStart }))).state);
  if (guidedStart) { s = move(s, 1, 'prep'); s = action(s, { kind: 'set-pause', reason: 'guide', active: false }); }
  return s;
}
const history = (s: Engine): HistoryEvidence => ({ schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: s.events });
const fold = (s: Engine) => value(account(s.config, s.runId, history(s), s.nowMs, { requireEnded: s.ended !== null }));
const stop = (s: Engine, end = s.nowMs) => value(snapshotFromEngine(action(at(s, end), { kind: 'end', reason: 'manual-stop' })));
const result = (s: Engine, end = s.nowMs) => value(measureSupplierResults(stop(s, end)));
const rejectedMove = (s: Engine, n: number, to = 'prep') => applyAction(s, { kind: 'move', orderKey: `order-${n}`, to });
const discard = (s: Engine, n: number) => action(s, { kind: 'discard', orderKey: `order-${n}` });
const resumeFrame: ReplayFrame = { atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } };
const horizon = (variant: SupplierVariant, frames: readonly ReplayFrame[] = [], extra: { initialSpeed?: Speed; guidedStart?: boolean } = {}) => {
  const c = config(variant, extra);
  return value(snapshotFromEngine(value(replay(c, variant, [resumeFrame, ...frames], 240000)).state));
};
const pair: PairSpec = { pairId: 'supplier-pair', baselineRunId: 'naive', subjectRunId: 'managed', requestedBasis: 'matched',
  change: { dimensionId: 'supplier-sequencing', version: 'v1', beforeVariantId: 'naive', afterVariantId: 'managed' } };
const archive = (...runs: FinalRunSnapshot[]) => ({ schema: 'sof-archive/v1', runs });
function renumber(events: readonly EngineEvent[]): EngineEvent[] { return events.map((e, i) => ({ ...e, seq: i + 1 })); }

/** Get the affected ticket to the head using legal FIFO admission and ordinary discards. */
function veggieHead(variant: SupplierVariant = 'managed', admitAt = 0): Engine {
  let s = running(variant);
  for (const n of [1, 2]) s = discard(admit(s, n), n);
  s = admit(at(s, admitAt), 3);
  return s;
}

describe('exact Normal supplier pilot manifest and configuration', () => {
  it('uses unchanged Round 2 Normal deck12 at 0, deterministic seed0 and exactly three canonical holds', () => {
    const c = config(), base = value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull', initialSpeed: 1 }));
    expect(c.manifest.orders).toEqual(base.manifest.orders);
    expect(c.manifest).toMatchObject({ scenarioId: 'supplier-shortage', scenarioVersion: 'supplier-shortage-v1', generatorVersion: 'supplier-fixed/v1', seed: 0, difficulty: 'normal', horizonMs: 240000, pushIntervalMs: 15000, burnBufferMs: 15000, patienceMs: 480000 });
    expect(c.manifest.orders.every(o => o.availableAtMs === 0)).toBe(true);
    expect(c.manifest.holds).toEqual([3, 7, 11].map(n => ({ holdId: `supplier-order-${n}`, orderKey: `order-${n}`, startMs: 20000, endMs: 65000, reason: 'supplier-ingredient' })));
    expect(c.policy).toEqual({ dimensionId: 'supplier-sequencing', version: 'v1', variantId: 'managed', wip: { orderQueue: 4, prep: 2, oven: 3, boxDeliver: 2 } });
    expect(c.resources).toEqual(VIP_RESOURCES); expect(c.scoringVersion).toBe(VERSIONS.scoring); expect(c.endCondition).toBe('fixed-horizon');
    expect(SUPPLIER_VERSIONS).toEqual({ scenario: 'supplier-shortage-v1', generator: 'supplier-fixed/v1', policy: 'supplier-sequencing', policyVersion: 'v1' });
    expect(SUPPLIER_PILOT_TIMING).toEqual({ horizonMs: 240000, startMs: 20000, endMs: 65000, affectedOrderTypeId: 'veggie-supreme' });
    expect(resolveManifest(SUPPLIER_VERSIONS.scenario, 'normal', 0)).toEqual({ ok: true, value: c.manifest });
    const naive = config('naive'); const { policy: _n, ...ni } = naive, { policy: _m, ...mi } = c; expect(ni).toEqual(mi);
    expect(Object.isFrozen(c.manifest.holds[0])).toBe(true); expect(Object.isFrozen(SUPPLIER_VERSIONS)).toBe(true);
    expect(value(makeSupplierConfig({ variant: 'naive' })).initialSpeed).toBe(3);
  });
  it.each([1, 2, 3] as const)('supports initialSpeed %s and guided start without extra capacity or auto follow-on moves', initialSpeed => {
    const c = config('naive', { initialSpeed, guidedStart: true });
    let s = value(createEngine('guide', c)).state;
    expect(s.tickets.filter(t => t.status === 'active')).toHaveLength(1);
    expect(s.tickets[0]).toMatchObject({ station: 'orderQueue', admittedAtMs: 0 });
    expect(rejectedMove(s, 1).issues[0].code).toBe('PAUSED');
    s = resume(s); s = move(s, 1, 'prep');
    expect(s.guide).toBe('moved'); expect(at(s, 20000).nowMs).toBe(0);
    s = action(s, { kind: 'set-pause', reason: 'guide', active: false });
    expect(validateEngine(s).ok).toBe(true); expect(s.speed).toBe(initialSpeed);
    expect(stop(s, 30000).metrics.stillInProgress).toBe(1);
  });
  it.each([null, {}, { variant: 'fifo' }, { variant: 'manual-pull' }, { variant: 'push' }, { variant: 'expedite' },
    { variant: 'managed', difficulty: 'normal' }, { variant: 'naive', seed: 0 }, { variant: 'managed', initialSpeed: 0 },
    { variant: 'managed', initialSpeed: undefined }, { variant: 'managed', guidedStart: undefined }, { variant: 'managed', guidedStart: 1 },
    { variant: 'managed', endCondition: 'fixed-horizon' }, { variant: 'managed', holds: [] }, { variant: 'managed', variantId: 'managed' }])('rejects noncanonical maker options %#', input => {
    expect(makeSupplierConfig(input as never).ok).toBe(false);
  });
  it.each(['easy', 'hard', 'Normal', null])('rejects unsupported supplier difficulty %j', difficulty => {
    expect(resolveManifest(SUPPLIER_VERSIONS.scenario, difficulty, 0).ok).toBe(false);
    const c: any = clone(config()); c.manifest.difficulty = difficulty;
    expect(validateConfig(c).ok).toBe(false);
  });
  it.each([
    ['unknown schema', (c: any) => c.manifest.schema = 'sof-manifest/v2'],
    ['scenario', (c: any) => c.manifest.scenarioId = 'fixed-deck'],
    ['scenario version', (c: any) => c.manifest.scenarioVersion = 'supplier-shortage-v2'],
    ['generator', (c: any) => c.manifest.generatorVersion = 'random/v1'],
    ['seed', (c: any) => c.manifest.seed = 1],
    ['extra manifest', (c: any) => c.manifest.owner = 'Supplier'],
    ['order time', (c: any) => c.manifest.orders[2].availableAtMs = 20000],
    ['order duration', (c: any) => c.manifest.orders[2].prepMs++],
    ['order type', (c: any) => c.manifest.orders[2].orderTypeId = 'cheese'],
    ['ordinal', (c: any) => c.manifest.orders[2].ordinal = 20],
    ['VIP metadata', (c: any) => c.manifest.orders[2].serviceClass = 'vip'],
    ['missing hold', (c: any) => c.manifest.holds.pop()],
    ['duplicate hold', (c: any) => c.manifest.holds.push(c.manifest.holds[0])],
    ['hold start', (c: any) => c.manifest.holds[0].startMs++],
    ['hold end', (c: any) => c.manifest.holds[0].endMs--],
    ['hold target', (c: any) => c.manifest.holds[0].orderKey = 'order-4'],
    ['hold id', (c: any) => c.manifest.holds[0].holdId = 'invented'],
    ['hold reason', (c: any) => c.manifest.holds[0].reason = 'fixture-dependency'],
    ['hold owner', (c: any) => c.manifest.holds[0].owner = 'Supplier'],
    ['negative hold', (c: any) => c.manifest.holds[0].startMs = -1],
    ['horizon', (c: any) => c.manifest.horizonMs = 240001],
    ['interval', (c: any) => c.manifest.pushIntervalMs++],
    ['patience', (c: any) => c.manifest.patienceMs++],
    ['burn', (c: any) => c.manifest.burnBufferMs++],
    ['Prep physics', (c: any) => c.resources.processing.prep = { kind: 'per-active-ticket' }],
    ['Oven physics', (c: any) => c.resources.processing.oven.slots = 4],
    ['station physics', (c: any) => c.resources.occupancy.prep = 3],
    ['unknown station', (c: any) => c.resources.occupancy.supplier = 1],
    ['WIP release', (c: any) => c.policy.wip.orderQueue = 5],
    ['clock', (c: any) => c.clockRulesVersion = 'unknown'],
    ['engine', (c: any) => c.engineVersion = 'unknown'],
    ['score', (c: any) => c.scoringVersion = 'vip-deadline-score/v1'],
    ['policy dimension', (c: any) => c.policy.dimensionId = 'admission-wip'],
    ['policy version', (c: any) => c.policy.version = 'v2'],
    ['policy variant', (c: any) => c.policy.variantId = 'fifo'],
    ['end condition', (c: any) => c.endCondition = 'all-resolved-or-horizon'],
    ['config metadata', (c: any) => c.matched = true],
  ] as const)('rejects tampered %s config', (_label, mutate) => {
    const c: any = clone(config()); mutate(c); expect(validateConfig(c).ok).toBe(false);
  });
  it('never extends fixture/official fixed manifest hold reasons or promotes arbitrary fixture schedules', () => {
    const c: any = clone(testConfig({ holds: [{ holdId: 'h', orderKey: 'order-1', startMs: 5, endMs: 10, reason: 'fixture-dependency' }] }));
    c.manifest.holds[0].reason = 'supplier-ingredient'; expect(validateManifest(c.manifest).ok).toBe(false);
    c.manifest.scenarioId = 'supplier-shortage'; expect(validateManifest(c.manifest).ok).toBe(false);
    expect(resolveManifest(SUPPLIER_VERSIONS.scenario, 'normal', 1).ok).toBe(false);
  });
});

describe('manual supplier sequencing, active Orders scope and unchanged physical limits', () => {
  it.each(['naive', 'managed'] as const)('keeps external admission FIFO for %s, no automatic/reserved admission', variant => {
    let s = at(running(variant), 30000);
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-3' }).issues[0].code).toBe('FIFO');
    expect(s.tickets.filter(t => t.status === 'active')).toHaveLength(0);
    for (const n of [1, 2, 3, 4]) s = admit(s, n);
    expect(fold(s)).toMatchObject({ external: 8, active: 4, byStation: { orderQueue: 4, prep: 0 } });
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-5' }).issues[0].code).toBe('CAPACITY');
    expect(readSupplierBlock(s, 'order-3')).toMatchObject({ ageMs: 0 });
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-7' }).issues[0].code).toBe('FIFO');
  });
  it('naive refuses to skip the oldest active Orders, including a blocked head; managed can select admitted unblocked work', () => {
    let naive = veggieHead('naive'); naive = admit(naive, 4); naive = at(naive, 20000);
    const before = JSON.stringify(naive), later = rejectedMove(naive, 4);
    expect(later.issues[0].code).toBe('SUPPLIER_SEQUENCE'); expect(later.state).toBe(naive);
    expect(rejectedMove(naive, 3).issues[0].code).toBe('BLOCKED'); expect(JSON.stringify(naive)).toBe(before);
    let managed = veggieHead('managed'); managed = admit(managed, 4); managed = at(managed, 20000);
    expect(rejectedMove(managed, 3).issues[0].code).toBe('BLOCKED'); managed = move(managed, 4, 'prep');
    expect(managed.tickets[2].station).toBe('orderQueue'); expect(managed.tickets[3].station).toBe('prep');
    expect(rejectedMove(managed, 5).issues[0].code).toBe('NOT_ACTIVE');
    expect(rejectedMove(managed, 3, 'oven').issues[0].code).toBe('INVALID_MOVE');
  });
  it('naive uses admitted time then ordinal/key deterministically, never ticket array order or unblocked-only filtering', () => {
    let s = admit(admit(running('naive'), 1), 2);
    expect(rejectedMove(s, 2).issues[0].code).toBe('SUPPLIER_SEQUENCE');
    s = move(s, 1, 'prep'); expect(rejectedMove(s, 2).accepted).toBe(true);
    const c = config('naive');
    expect(oldestSupplierOrder(c, [{ orderKey: 'order-2', admittedAtMs: 0 }, { orderKey: 'order-1', admittedAtMs: 1 }])).toBe('order-2');
    expect(oldestSupplierOrder(c, [{ orderKey: 'order-2', admittedAtMs: 0 }, { orderKey: 'order-1', admittedAtMs: 0 }])).toBe('order-1');
  });
  it('blocks only unstarted affected tickets, exact delivery unlocks without autopull or WIP release', () => {
    let s = admit(veggieHead(), 4); s = at(s, 19999);
    expect(readSupplierBlock(s, 'order-3')).toBeNull(); expect(rejectedMove(s, 3).accepted).toBe(true);
    s = at(s, 20000); expect(readSupplierBlock(s, 'order-3')).toEqual({ blocked: true, ageMs: 0, owner: 'Supplier', reason: 'Waiting on supplier', deliveryAtMs: 65000 });
    expect(readSupplierBlock(s, 'order-4')).toBeNull(); s = at(s, 64999);
    expect(readSupplierBlock(s, 'order-3')?.ageMs).toBe(44999); expect(rejectedMove(s, 3).accepted).toBe(false);
    const delivery = value(advanceTo(s, 65000)); s = delivery.state;
    expect(delivery.emitted.filter(e => e.kind === 'blockEnd')).toHaveLength(3);
    expect(delivery.emitted.some(e => ['admission', 'movement'].includes(e.kind))).toBe(false);
    expect(readSupplierBlock(s, 'order-3')).toBeNull(); expect(s.tickets[2].station).toBe('orderQueue');
    s = move(s, 3, 'prep'); expect(s.tickets[2].prepReadyAtMs).toBe(125000);
    expect(result(s)).toMatchObject({ observedDisruptionMs: 45000, ticketBlockedMs: 45000, affectedTicketCount: 1, unfinished: 2 });
  });
  it('an affected ticket already at Prep continues timers and can move to Oven before delivery, without blocked-time area', () => {
    let s = move(veggieHead(), 3, 'prep'); s = at(s, 20000);
    expect(s.tickets[2].holds).toEqual(['supplier-order-3']); expect(readSupplierBlock(s, 'order-3')).toBeNull();
    expect(rejectedMove(s, 3, 'oven').issues[0].code).toBe('NOT_READY'); s = at(s, 60000);
    expect(s.tickets[2].ready).toBe(true); s = move(s, 3, 'oven');
    expect(fold(s).blockedTicketMs).toBe(0); expect(readSupplierBlock(s, 'order-3')).toBeNull();
    s = move(at(s, 120000), 3, 'boxDeliver'); s = move(s, 3, 'served');
    expect(result(s)).toMatchObject({ served: 1, servedN: 1, servedMeanMs: 120000, ticketBlockedMs: 0, affectedTicketCount: 0, score: 4 });
  });
  it('admission during shortage starts blocked age at admission, not external arrival or shortage onset', () => {
    let s = veggieHead('managed', 30000); expect(readSupplierBlock(s, 'order-3')?.ageMs).toBe(0);
    s = at(s, 45000); expect(readSupplierBlock(s, 'order-3')?.ageMs).toBe(15000);
    expect(readSupplierBlock(s, 'order-7')).toBeNull(); expect(readSupplierBlock(s, 'absent')).toBeNull();
    expect(result(s, 65000)).toMatchObject({ ticketBlockedMs: 35000, affectedTicketCount: 1 });
  });
  it('two Prep workers remain occupied until a manual move; ready is not worker release', () => {
    let s = move(admit(running(), 1), 1, 'prep'); s = move(admit(s, 2), 2, 'prep'); s = admit(s, 3);
    expect(rejectedMove(s, 3).issues[0].code).toBe('CAPACITY'); s = at(s, 30000);
    expect(s.tickets.filter(t => t.station === 'prep')).toHaveLength(2);
    expect(rejectedMove(s, 3).issues[0].code).toBe('BLOCKED');
    s = admit(s, 4); expect(rejectedMove(s, 4).issues[0].code).toBe('CAPACITY');
    s = move(s, 1, 'oven'); s = move(s, 4, 'prep');
    expect(s.tickets.filter(t => t.station === 'prep')).toHaveLength(2);
  });
  it('never grants a VIP uplift: physical Oven3 and Box2 reject fourth/third ordinary tickets', () => {
    let s = move(veggieHead(), 3, 'prep'); s = discard(admit(s, 4), 4); s = move(admit(s, 5), 5, 'prep');
    s = at(s, 60000); s = move(s, 3, 'oven'); s = move(s, 5, 'oven');
    s = move(admit(s, 6), 6, 'prep'); s = discard(admit(s, 7), 7); s = move(admit(s, 8), 8, 'prep');
    s = move(at(s, 90000), 6, 'oven');
    expect(s.tickets.filter(t => t.station === 'oven')).toHaveLength(3);
    expect(rejectedMove(s, 8, 'oven').issues[0].code).toBe('CAPACITY');
    // A ready Prep ticket does not claim an Oven slot until its explicit legal move.
    s = at(s, 120000); s = move(s, 3, 'boxDeliver'); s = move(s, 5, 'boxDeliver'); s = move(s, 8, 'oven');
    s = at(s, 130000); expect(rejectedMove(s, 6, 'boxDeliver').issues[0].code).toBe('CAPACITY');
    s = move(s, 3, 'served'); s = move(s, 6, 'boxDeliver'); s = at(s, 160000);
    expect(rejectedMove(s, 8, 'boxDeliver').issues[0].code).toBe('CAPACITY');
    s = move(s, 5, 'served'); s = move(s, 8, 'boxDeliver');
    expect(s.tickets.filter(t => t.station === 'boxDeliver')).toHaveLength(2); expect(validateEngine(s).ok).toBe(true);
  });
});

describe('supplier duration evidence and independent transition validation', () => {
  it.each([0, 19999, 20000, 30000, 65000, 240000])('clamps observed shortage once at observation %s and excludes all external demand', end => {
    const s = running(), snap = end === 240000 ? value(snapshotFromEngine(at(s, end))) : stop(s, end);
    expect(value(measureSupplierResults(snap))).toEqual({ definition: 'supplier-results/v1', scheduledDisruptionMs: 45000,
      observedDisruptionMs: Math.max(0, Math.min(65000, end) - 20000), ticketBlockedMs: 0, affectedTicketCount: 0,
      served: 0, servedN: 0, servedMeanMs: null, unfinished: 0, burnt: 0, angry: 0, score: 0 });
    expect(value(account(snap.config, snap.runId, snap.history, end))).toMatchObject({ external: 12, active: 0, blockedTicketMs: 0, areaTicketMs: 0 });
    if (end >= 65000) expect(snap.history.events.filter(e => e.kind === 'blockStart' || e.kind === 'blockEnd')).toHaveLength(6);
  });
  it('all three affected active Orders count independently while disruption observation remains45s', () => {
    let s = running();
    for (let n = 1; n <= 11; n++) { s = admit(s, n); if (![3, 7, 11].includes(n)) s = discard(s, n); }
    s = at(s, 65000);
    expect(result(s)).toMatchObject({ scheduledDisruptionMs: 45000, observedDisruptionMs: 45000, ticketBlockedMs: 135000, affectedTicketCount: 3, unfinished: 3 });
    expect(fold(s)).toMatchObject({ blockedTicketMs: 135000, areaTicketMs: 195000, external: 1, active: 3 });
  });
  it('clips discarded ticket intervals and retains post-exit hold events without adding area', () => {
    let s = veggieHead(); s = discard(at(s, 30000), 3);
    const snap = stop(s, 65000), summary = value(measureSupplierResults(snap));
    expect(summary).toMatchObject({ ticketBlockedMs: 10000, affectedTicketCount: 1, observedDisruptionMs: 45000, unfinished: 0 });
    expect(snap.history.events.filter(e => e.kind === 'blockEnd' && e.orderKey === 'order-3')).toHaveLength(1);
    expect(value(account(snap.config, snap.runId, snap.history, 65000)).areaTicketMs).toBe(30000);
    expect(readSupplierBlock(at(s, 50000), 'order-3')).toBeNull();
    expect(result(veggieHead(), 25000)).toMatchObject({ ticketBlockedMs: 5000, observedDisruptionMs: 5000 });
    expect(result(discard(veggieHead('managed', 30000), 3))).toMatchObject({ ticketBlockedMs: 0, affectedTicketCount: 0, observedDisruptionMs: 10000 });
  });
  it('fixture overlapping holds retain union/all-active semantics in Prep and still allow hazards and exit clipping', () => {
    const c = testConfig({ count: 1, horizonMs: 50, holds: [
      { holdId: 'a', orderKey: 'order-1', startMs: 5, endMs: 10, reason: 'fixture-dependency' },
      { holdId: 'b', orderKey: 'order-1', startMs: 6, endMs: 40, reason: 'fixture-dependency' },
    ] });
    let s = move(admit(resume(start(c)), 1), 1, 'prep'); s = at(s, 6);
    expect(rejectedMove(s, 1, 'oven').issues[0].code).toBe('BLOCKED');
    s = at(s, 10); expect(s.tickets[0].holds).toEqual(['b']); s = at(s, 40); s = move(s, 1, 'oven'); s = at(s, 50);
    expect(fold(s).blockedTicketMs).toBe(35);
    expect(Array.from(blockedDurationsFromValidatedHistory(c, s.events, 50).values())).toEqual([35]);
    let hazard = move(admit(resume(start(c)), 1), 1, 'prep'); hazard = move(at(hazard, 3), 1, 'oven'); hazard = at(hazard, 50);
    expect(fold(hazard)).toMatchObject({ burnt: 1, blockedTicketMs: 17, areaTicketMs: 22 });
    expect(Array.from(blockedDurationsFromValidatedHistory(c, hazard.events, 50).values())).toEqual([17]);
  });
  it('scheduled and external fixture hold evidence never enters WIP or blocked populations', () => {
    const c = testConfig({ count: 1, horizonMs: 50, arrivals: [20], holds: [{ holdId: 'a', orderKey: 'order-1', startMs: 5, endMs: 40, reason: 'fixture-dependency' }] });
    let s = at(resume(start(c)), 10); expect(s.tickets[0].status).toBe('scheduled'); expect(fold(s)).toMatchObject({ active: 0, blockedTicketMs: 0, areaTicketMs: 0 });
    s = at(s, 50); expect(s.tickets[0].status).toBe('external'); expect(fold(s)).toMatchObject({ external: 1, blockedTicketMs: 0, areaTicketMs: 0 });
    expect(readSupplierBlock(s, 'order-1')).toBeNull();
  });
  it('independent fold rejects naive out-of-order admission/start and starts inside ingredient shortage, including missing same-time block envelopes', () => {
    let s = admit(admit(running('naive'), 1), 2);
    const ref2 = { orderKey: 'order-2', orderId: 'naive:order:2' };
    const illegal = { ...history(s), events: renumber([...s.events, { kind: 'movement', ...ref2, from: 'orderQueue', to: 'prep', runId: 'naive', seq: 1, atMs: 0 }]) };
    expect(account(s.config, s.runId, illegal, 0, { requireEnded: false })).toMatchObject({ ok: false, issues: [{ code: 'SUPPLIER_SEQUENCE' }] });
    const external = running('managed');
    const admitted = { ...history(external), events: renumber([...external.events, { kind: 'admission', orderKey: 'order-3', orderId: 'managed:order:3', by: 'pull', runId: 'managed', seq: 1, atMs: 0 }]) };
    expect(account(external.config, external.runId, admitted, 0, { requireEnded: false })).toMatchObject({ ok: false, issues: [{ code: 'FIFO' }] });
    s = at(veggieHead(), 20000);
    const illegalStart: EngineEvent = { kind: 'movement', orderKey: 'order-3', orderId: 'managed:order:3', from: 'orderQueue', to: 'prep', runId: 'managed', seq: 1, atMs: 20000 };
    for (const events of [s.events, s.events.filter(e => e.kind !== 'blockStart')]) {
      expect(account(s.config, s.runId, { ...history(s), events: renumber([...events, illegalStart]) }, 20000, { requireEnded: false })).toMatchObject({ ok: false, issues: [{ code: 'BLOCKED' }] });
    }
  });
  it('rejects malformed summary/snapshot and non-supplier snapshots; summary is deeply frozen and does not mutate callers', () => {
    const snap = stop(veggieHead(), 30000), raw = clone(snap), before = clone(raw);
    const summary = value(measureSupplierResults(raw)); expect(raw).toEqual(before); expect(Object.isFrozen(summary)).toBe(true);
    const forged: any = clone(snap); forged.metrics.score++; expect(measureSupplierResults(forged).ok).toBe(false);
    forged.metrics.score = snap.metrics.score; forged.orders[2].admittedAtMs++; expect(measureSupplierResults(forged).ok).toBe(false);
    expect(measureSupplierResults({ definition: 'supplier-results/v1', ...summary }).ok).toBe(false);
    const ordinary = value(snapshotFromEngine(at(resume(start(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' })))), 240000)));
    expect(measureSupplierResults(ordinary)).toMatchObject({ ok: false, issues: [{ code: 'NOT_SUPPLIER_SCENARIO' }] });
  });
});

describe('shared clock, canonical finalization/replay and sole matched-pair authority', () => {
  it.each([1, 2, 3] as const)('shared driver honors speed%s, pause/help/hidden locks and exact delivery boundary', initialSpeed => {
    let s = veggieHead(); s = action(s, { kind: 'speed', speed: initialSpeed });
    let driver = value(createDriver(s.runId));
    let tick = value(sampleWall(s, driver, 0)); s = tick.state; driver = tick.driver;
    const wallAtStart = 20000000 / initialSpeed;
    // Integer walls only; get near the boundary then change speed under old-speed sampling.
    tick = value(sampleWall(s, driver, Math.floor(wallAtStart))); s = tick.state; driver = tick.driver;
    expect(s.nowMs).toBeLessThanOrEqual(20000);
    tick = value(applyWallControl(s, driver, Math.floor(wallAtStart) + 1000, { kind: 'set-pause', reason: 'hidden', active: true })); s = tick.state; driver = tick.driver;
    const pausedAt = s.nowMs;
    tick = value(applyWallControl(s, driver, 50000000, { kind: 'set-pause', reason: 'help', active: true })); s = tick.state; driver = tick.driver;
    expect(applyWallControl(s, driver, 60000000, { kind: 'speed', speed: 2 }).ok).toBe(false);
    expect(rejectedMove(s, 3).issues[0].code).toBe('PAUSED');
    tick = value(applyWallControl(s, driver, 60000000, { kind: 'set-pause', reason: 'hidden', active: false })); s = tick.state; driver = tick.driver;
    tick = value(sampleWall(s, driver, 70000000)); s = tick.state; driver = tick.driver; expect(s.nowMs).toBe(pausedAt);
    tick = value(applyWallControl(s, driver, 80000000, { kind: 'set-pause', reason: 'help', active: false })); s = tick.state; driver = tick.driver;
    tick = value(applyWallControl(s, driver, 80000000, { kind: 'speed', speed: 1 })); s = tick.state; driver = tick.driver;
    tick = value(sampleWall(s, driver, 80000000 + (65000 - pausedAt) * 1000)); s = tick.state;
    expect(s.nowMs).toBe(65000); expect(readSupplierBlock(s, 'order-3')).toBeNull(); expect(s.tickets[2].station).toBe('orderQueue');
    expect(value(replay(s.config, s.runId, replayFrames(s), s.nowMs)).state).toEqual(s);
    expect(result(s).ticketBlockedMs).toBe(45000);
  });
  it('captures idempotent finalization and replay with real supplier commands and ledger reconciliation', () => {
    let s = admit(veggieHead('managed', 30000), 4); s = move(s, 4, 'prep'); s = move(at(s, 60000), 4, 'oven');
    s = move(at(s, 65000), 3, 'prep'); s = move(at(s, 100000), 4, 'boxDeliver'); s = move(s, 4, 'served');
    s = move(at(s, 125000), 3, 'oven'); s = move(at(s, 185000), 3, 'boxDeliver'); s = move(s, 3, 'served'); s = at(s, 240000);
    const draft = value(createRunDraft(s.runId, s.config)), final = value(finalizeRun(draft, s));
    expect(final.snapshot).toEqual(value(snapshotFromEngine(s))); expect(value(finalizeRun(final.draft, s))).toEqual(final);
    expect(validateSnapshot(final.snapshot).ok).toBe(true); expect(value(replay(s.config, s.runId, replayFrames(s), 240000)).state).toEqual(s);
    expect(value(measureSupplierResults(final.snapshot))).toMatchObject({ ticketBlockedMs: 35000, affectedTicketCount: 1, served: 2, servedN: 2, servedMeanMs: 112500, unfinished: 0, burnt: 0, angry: 0, score: 5 });
    expect(fold(s)).toMatchObject({ admitted: 4, served: 2, otherDiscard: 2, areaTicketMs: 225000, blockedTicketMs: 35000 });
  });
  it('matches canonical supplier naive↔managed both ways and never claims production approval or human play', () => {
    const b = horizon('naive'), a = horizon('managed');
    expect(assessComparison(archive(b, a), pair)).toMatchObject({ kind: 'matched', issues: [], evidence: 'producer-compatible', humanPlay: 'not-established' });
    const reverse = { ...pair, baselineRunId: 'managed', subjectRunId: 'naive', change: { ...pair.change!, beforeVariantId: 'managed', afterVariantId: 'naive' } };
    expect(assessComparison(archive(b, a), reverse).kind).toBe('matched');
    expect(inspectProducerCompatibility(a)).toMatchObject({ ok: true, value: { productionManifest: false, humanPlay: 'not-established' } });
    for (const change of [null, { ...pair.change!, version: 'v2' }, { ...pair.change!, dimensionId: 'vip-service' }, { ...pair.change!, afterVariantId: 'naive' }, { ...pair.change!, afterVariantId: 'fifo' }]) {
      expect(assessComparison(archive(b, a), { ...pair, change }).issues).toContain('UNAPPROVED_POLICY_CHANGE');
    }
  });
  it('does not require gameplay equality when both producer traces are canonical and controls match', () => {
    const frames: ReplayFrame[] = [1, 2, 3, 4].map(n => ({ atMs: 0, command: { kind: 'admit', orderKey: `order-${n}` } }));
    frames.push({ atMs: 20000, command: { kind: 'move', orderKey: 'order-4', to: 'prep' } });
    frames.push({ atMs: 50000, command: { kind: 'move', orderKey: 'order-4', to: 'oven' } });
    const b = horizon('naive'), a = horizon('managed', frames);
    expect(a.metrics.burnt).toBe(1); expect(assessComparison(archive(b, a), pair).kind).toBe('matched');
  });
  it('equal manual stops, speed/guidance mismatch and effective control differences never match', () => {
    const b = horizon('naive');
    expect(assessComparison(archive(b, horizon('managed', [], { initialSpeed: 2 })), pair).issues).toContain('INITIAL_SPEED_MISMATCH');
    const guided = horizon('managed', [{ atMs: 0, command: { kind: 'move', orderKey: 'order-1', to: 'prep' } }, { atMs: 0, command: { kind: 'set-pause', reason: 'guide', active: false } }], { guidedStart: true });
    expect(assessComparison(archive(b, guided), pair).issues).toContain('GUIDANCE_MISMATCH');
    const changed = horizon('managed', [{ atMs: 1000, command: { kind: 'speed', speed: 2 } }]);
    expect(assessComparison(archive(b, changed), pair).issues).toContain('CONTROL_TRACE_MISMATCH');
    const manual = archive(stop(running('naive'), 1000), stop(running('managed'), 1000));
    expect(assessComparison(manual, pair).issues).toContain('MANUAL_END_NOT_MATCHABLE');
    expect(assessComparison(manual, pair).kind).toBe('unmatched');
  });
  it.each([
    ['holds', (s: any) => s.config.manifest.holds[0].endMs++],
    ['demand', (s: any) => s.config.manifest.orders[0].prepMs++],
    ['clock', (s: any) => s.config.clockRulesVersion = 'invented'],
    ['score', (s: any) => s.metrics.score++],
    ['boundary', (s: any) => s.history.events = renumber(s.history.events.filter((e: EngineEvent) => e.kind !== 'blockStart'))],
    ['station', (s: any) => s.orders[0].finalStation = 'prep'],
    ['end', (s: any) => s.endReason = 'manual-stop'],
    ['speed', (s: any) => s.config.initialSpeed = 4],
    ['variant', (s: any) => s.config.policy.variantId = 'expedite'],
    ['unknown command', (s: any) => s.history.events[13].command = { kind: 'override', capacity: 5 }],
  ] as const)('rejects matched status for tampered supplier %s', (_name, mutate) => {
    const raw: any = clone(archive(horizon('naive'), horizon('managed'))); mutate(raw.runs[1]);
    expect(assessComparison(raw, pair).kind).toBe('unmatched');
  });
  it('independent accounting does not fabricate producer physics: forged ready times fail replay matching/finalization', () => {
    const s = move(admit(running(), 1), 1, 'prep'); const snap = stop(s, 40000), forged: any = clone(snap);
    forged.history.events.find((e: EngineEvent) => e.kind === 'ready').atMs = 29999;
    expect(validateSnapshot(forged).ok).toBe(true); expect(inspectProducerCompatibility(forged).ok).toBe(false);
    const finalEngine: any = clone(action(at(s, 40000), { kind: 'end', reason: 'manual-stop' }));
    finalEngine.events.find((e: EngineEvent) => e.kind === 'ready').atMs = 29999;
    expect(snapshotFromEngine(finalEngine).ok).toBe(false);
  });
});
