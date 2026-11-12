import { describe, expect, it } from 'vitest';
import { applyAction, advanceTo, createEngine, replay, replayFrames, validateEngine } from './engine';
import { account } from './accounting';
import { makeFixedDeckConfig, resolveManifest, validateConfig, validateManifest, VERSIONS } from './scenario';
import { snapshotFromEngine, validateSnapshot } from './runSnapshots';
import { assessComparison, inspectProducerCompatibility, type PairSpec } from './matchedRuns';
import { makeVipConfig, measureVipResults, VIP_PILOT_TIMINGS, VIP_VERSIONS } from './vip';
import { readVipActivity } from '../sof/vip';
import { measureTimeWeightedWip } from '../flow/sof018Metrics';
import { immutable, type Checked, type Difficulty, type Engine, type FinalRunSnapshot } from './types';
const value = <T,>(r: Checked<T>): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const act = (s: Engine, c: unknown): Engine => { const r = applyAction(s, c); if (!r.accepted) throw new Error(JSON.stringify({ c, now: s.nowMs, issues: r.issues })); return r.state; };
const time = (s: Engine, at: number) => value(advanceTo(s, at)).state;
const admit = (s: Engine, n: number) => act(s, { kind: 'admit', orderKey: `order-${n}` });
const move = (s: Engine, n: number, to: 'prep' | 'oven' | 'boxDeliver' | 'served') => act(s, { kind: 'move', orderKey: `order-${n}`, to });
const discard = (s: Engine, n: number) => act(s, { kind: 'discard', orderKey: `order-${n}` });
const stop = (s: Engine, at = s.nowMs) => value(snapshotFromEngine(act(time(s, at), { kind: 'end', reason: 'manual-stop' })));
function running(variant: 'fifo' | 'expedite' = 'expedite', difficulty: Difficulty = 'normal', guide = false, runId = 'vip') {
  let s = value(createEngine(runId, value(makeVipConfig({ difficulty, variant, initialSpeed: 1, guidedStart: guide })))).state;
  s = act(s, { kind: 'set-pause', reason: 'instruction', active: false });
  if (guide) { s = move(s, 1, 'prep'); s = act(s, { kind: 'set-pause', reason: 'guide', active: false }); }
  return s;
}
function vipReadyInBox(serviceAt?: number) {
  let s = running(); s = admit(time(s, 10000), 13); s = move(s, 13, 'prep');
  s = move(time(s, 40000), 13, 'oven'); s = move(time(s, 80000), 13, 'boxDeliver');
  return serviceAt === undefined ? s : move(time(s, serviceAt), 13, 'served');
}
const pair: PairSpec = { pairId: 'vip-pair', baselineRunId: 'fifo', subjectRunId: 'expedite', requestedBasis: 'matched',
  change: { dimensionId: 'vip-service', version: 'v1', beforeVariantId: 'fifo', afterVariantId: 'expedite' } };
const archive = (...runs: FinalRunSnapshot[]) => ({ schema: 'sof-archive/v1', runs });
const horizon = (variant: 'fifo' | 'expedite', frames: Parameters<typeof replay>[2] = []) => {
  const c = value(makeVipConfig({ difficulty: 'normal', variant, initialSpeed: 1 }));
  return value(snapshotFromEngine(value(replay(c, variant, [{ atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } }, ...(frames as any[])], c.manifest.horizonMs)).state));
};

describe('canonical Round 3 preview pilot manifest and config', () => {
  it.each(['easy', 'normal', 'hard'] as const)('materializes the original 12 plus precisely 3 Small VIPs for %s', difficulty => {
    const base = value(makeFixedDeckConfig({ difficulty, policy: 'manual-pull' }));
    const c = value(makeVipConfig({ difficulty, variant: 'expedite' }));
    expect(c.manifest.orders.slice(0, 12)).toEqual(base.manifest.orders);
    expect(c.manifest.orders).toHaveLength(15);
    expect(c.manifest.orders.slice(12).map(o => [o.orderKey, o.complexity, o.prepMs + o.bakeMs, o.availableAtMs, o.deadlineAtMs! - o.availableAtMs])).toEqual(
      VIP_PILOT_TIMINGS[difficulty].arrivalMs.map((at, i) => [`order-${13 + i}`, 'Small', 70000, at, VIP_PILOT_TIMINGS[difficulty].deadlineWindowMs]));
    expect(c.manifest.horizonMs).toBe(VIP_PILOT_TIMINGS[difficulty].horizonMs);
    expect(base.manifest.horizonMs).toBe({ easy: 420000, normal: 240000, hard: 180000 }[difficulty]);
    expect(resolveManifest(VIP_VERSIONS.scenario, difficulty, 0)).toEqual({ ok: true, value: c.manifest });
    expect(c.policy.wip).toEqual({ orderQueue: 4, prep: 2, oven: 3, boxDeliver: 2 });
    expect(c.resources).toEqual({ occupancy: { orderQueue: null, prep: 2, oven: 3, boxDeliver: null }, processing: { prep: { kind: 'fixed', slots: 2 }, oven: { kind: 'fixed', slots: 3 } } });
    const fifo = value(makeVipConfig({ difficulty, variant: 'fifo' }));
    const { policy: _f, ...fi } = fifo, { policy: _e, ...ei } = c;
    expect(fi).toEqual(ei); expect(Object.isFrozen(c.manifest.orders[14])).toBe(true);
  });
  it('rejects all unknown options, metadata, cross-scenario variants and invented resources', () => {
    for (const raw of [null, {}, { difficulty: 'normal', variant: 'push' }, { difficulty: 'normal', variant: 'expedite', seed: 0 }, { difficulty: 'normal', variant: 'expedite', initialSpeed: undefined }, { difficulty: 'normal', variant: 'expedite', guidedStart: undefined }, { difficulty: 'normal', variant: 'expedite', config: {} }]) expect(makeVipConfig(raw as never).ok).toBe(false);
    const c = value(makeVipConfig({ difficulty: 'normal', variant: 'expedite' }));
    for (const mutate of [(x: any) => x.manifest.orders[12].priority = true, (x: any) => delete x.manifest.orders[12].deadlineAtMs,
      (x: any) => x.manifest.orders[12].deadlineAtMs++, (x: any) => x.manifest.orders[0].serviceClass = 'normal',
      (x: any) => x.manifest.orders.push({ ...x.manifest.orders[14], orderKey: 'order-16', ordinal: 16 }),
      (x: any) => x.resources.occupancy.prep = 3, (x: any) => x.resources.processing.prep.slots = 3,
      (x: any) => x.policy.variantId = 'manual-pull', (x: any) => x.policy.wip.orderQueue = 5, (x: any) => x.scoringVersion = VERSIONS.scoring]) {
      const raw = clone(c); mutate(raw); expect(validateConfig(raw).ok).toBe(false);
    }
    const legacy = clone(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' })));
    (legacy.manifest.orders[0] as any).serviceClass = 'vip'; (legacy.manifest.orders[0] as any).deadlineAtMs = 90000;
    expect(validateManifest(legacy.manifest).ok).toBe(false);
  });
  it('bounds 15-order area arithmetic without expanding the legacy fixture limit', () => {
    const c: any = clone(value(makeVipConfig({ difficulty: 'normal', variant: 'fifo' })));
    c.manifest.horizonMs = Math.floor(Number.MAX_SAFE_INTEGER / 30) + 1;
    expect(validateManifest(c.manifest)).toMatchObject({ ok: false, issues: [{ code: 'OVERFLOW' }] });
    c.manifest.horizonMs = 300000; c.manifest.orders[12].deadlineAtMs = Number.MAX_SAFE_INTEGER + 1;
    expect(validateManifest(c.manifest).ok).toBe(false);
    const legacy: any = clone(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' })).manifest);
    legacy.orders.push({ ...legacy.orders[0], ordinal: 13, orderKey: 'order-13' }); expect(validateManifest(legacy).ok).toBe(false);
  });
  it.each(['easy', 'normal', 'hard'] as const)('serves all 3 VIPs on time with real commands and a guided normal in %s', difficulty => {
    let s = running('expedite', difficulty, true);
    // Actual legal moves, not oracle-generated events. Normal guide continues alongside VIP work.
    if (difficulty === 'easy') {
      s = move(time(s, 30000), 1, 'oven');
    }
    for (const [i, arrival] of VIP_PILOT_TIMINGS[difficulty].arrivalMs.entries()) {
      const start = Math.max(s.nowMs, arrival), n = i + 13;
      s = admit(time(s, start), n); s = move(s, n, 'prep');
      if (difficulty !== 'easy' && i === 0) { s = move(time(s, 30000), 1, 'oven'); }
      if (difficulty === 'easy' && i === 0) { s = move(time(s, 70000), 1, 'boxDeliver'); s = move(s, 1, 'served'); }
      s = move(time(s, start + 30000), n, 'oven');
      if (difficulty !== 'easy' && i === 0) { s = move(time(s, 70000), 1, 'boxDeliver'); s = move(s, 1, 'served'); }
      s = move(time(s, start + 70000), n, 'boxDeliver'); s = move(s, n, 'served');
    }
    const snap = value(snapshotFromEngine(time(s, s.config.manifest.horizonMs)));
    expect(value(measureVipResults(snap))).toMatchObject({ vipOnTime: 3, vipLate: 0, vipPending: 0, vipNotYetArrived: 0, vipBurnt: 0, vipServedN: 3, normalServedN: 1, deadlinePenaltyCount: 0, vipMeanArrivalToServedMs: 70000 });
    expect(validateSnapshot(snap).ok).toBe(true);
    expect(value(replay(s.config, s.runId, replayFrames(s), s.nowMs)).state).toEqual(s);
  });
});

describe('manual VIP selection, global token and actual exception occupancy', () => {
  it('FIFO respects oldest available whole population while expedite may choose oldest normal or earliest VIP', () => {
    let s = time(running('fifo'), 10000);
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-13' }).issues[0].code).toBe('FIFO');
    for (let n = 1; n <= 12; n++) { s = admit(s, n); s = discard(s, n); }
    s = admit(s, 13); expect(s.tickets[12].status).toBe('active');
    const e = time(running(), 170000);
    expect(applyAction(e, { kind: 'admit', orderKey: 'order-14' }).issues[0].code).toBe('FIFO');
    expect(applyAction(e, { kind: 'admit', orderKey: 'order-2' }).issues[0].code).toBe('FIFO');
    expect(applyAction(e, { kind: 'admit', orderKey: 'order-1' }).accepted).toBe(true);
    expect(applyAction(e, { kind: 'admit', orderKey: 'order-13' }).accepted).toBe(true);
    expect(e.tickets.every(t => t.status !== 'active')).toBe(true); // no automatic admission/movement
  });
  it('allows the VIP-only fifth Orders slot and no ordinary exception', () => {
    let s = running(); for (let n = 1; n <= 4; n++) s = admit(s, n);
    s = time(s, 10000);
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-5' }).issues[0].code).toBe('CAPACITY');
    s = admit(s, 13);
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: 'order-13', exceptions: [{ station: 'orderQueue', orderKey: 'order-13', occupancy: 5, ordinaryLimit: 4 }] });
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-5' }).issues[0].code).toBe('CAPACITY');
    s = move(s, 13, 'prep'); expect(value(readVipActivity(s)).exceptions).toEqual([]);
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-5' }).accepted).toBe(false);
    const final = stop(s); expect(validateSnapshot(final).ok).toBe(true);
  });
  it('never exceeds physical or policy Prep 2, even for a VIP', () => {
    let s = running(); s = move(admit(s, 1), 1, 'prep'); s = move(admit(s, 2), 2, 'prep'); s = admit(time(s, 10000), 13);
    const reject = applyAction(s, { kind: 'move', orderKey: 'order-13', to: 'prep' });
    expect(reject.issues[0].code).toBe('CAPACITY'); expect(reject.state).toBe(s);
    expect(applyAction(s, { kind: 'move', orderKey: 'order-13', to: 'oven' }).issues[0].code).toBe('INVALID_MOVE');
    s = move(time(s, 30000), 1, 'oven'); s = move(s, 13, 'prep');
    expect(s.tickets.filter(t => t.station === 'prep')).toHaveLength(2);
  });
  it('never exceeds physical Oven 3; the VIP receives no Oven exception', () => {
    let s = running(); s = admit(admit(admit(s, 1), 2), 3);
    s = move(s, 1, 'prep'); s = move(s, 3, 'prep');
    s = time(s, 60000); s = move(s, 1, 'oven'); s = move(s, 3, 'oven');
    s = move(s, 2, 'prep'); s = move(admit(s, 13), 13, 'prep');
    s = move(time(s, 90000), 2, 'oven');
    expect(s.tickets.filter(t => t.station === 'oven')).toHaveLength(3);
    const rejected = applyAction(s, { kind: 'move', orderKey: 'order-13', to: 'oven' });
    expect(rejected.issues[0].code).toBe('CAPACITY'); expect(rejected.state).toBe(s);
    s = move(time(s, 100000), 1, 'boxDeliver'); s = move(s, 13, 'oven');
    expect(s.tickets.filter(t => t.station === 'oven')).toHaveLength(3);
    expect(validateEngine(s).ok).toBe(true); expect(validateSnapshot(stop(s)).ok).toBe(true);
  });
  it('grants only the VIP a third Box slot and reports the exception from occupancy', () => {
    let s = running(); s = move(admit(s, 1), 1, 'prep'); s = move(admit(s, 2), 2, 'prep');
    s = time(s, 30000); s = move(s, 1, 'oven'); s = move(s, 2, 'oven'); s = move(admit(s, 13), 13, 'prep');
    s = move(time(s, 60000), 13, 'oven'); s = time(s, 70000); s = move(s, 1, 'boxDeliver'); s = move(s, 2, 'boxDeliver');
    s = move(time(s, 100000), 13, 'boxDeliver');
    expect(value(readVipActivity(s)).exceptions).toEqual([{ station: 'boxDeliver', orderKey: 'order-13', occupancy: 3, ordinaryLimit: 2 }]);
    s = move(s, 13, 'served'); expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: null, exceptions: [] });
    expect(validateSnapshot(stop(s)).ok).toBe(true);
  });
  it.each(['manual', 'service', 'burn'] as const)('releases the global token on %s closure, including overdue VIPs', closure => {
    let s = closure === 'manual' ? admit(time(running(), 170000), 13) : vipReadyInBox();
    if (closure === 'burn') { s = running(); s = move(admit(time(s, 10000), 13), 13, 'prep'); s = move(time(s, 40000), 13, 'oven'); }
    s = time(s, Math.max(90000, s.nowMs));
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-14' }).issues[0].code).toBe('VIP_TOKEN');
    if (closure === 'manual') s = discard(s, 13);
    else if (closure === 'service') s = move(s, 13, 'served');
    else s = time(s, 95000);
    expect(value(readVipActivity(s)).activeVipOrderKey).toBeNull(); s = admit(s, 14);
    expect(value(readVipActivity(s)).activeVipOrderKey).toBe('order-14');
    expect(validateSnapshot(stop(s)).ok).toBe(true);
  });
  it('does not let later normal admissions use a VIP-present exception after a normal leaves Orders', () => {
    let s = running(); for (let n = 1; n <= 4; n++) s = admit(s, n);
    s = admit(time(s, 10000), 13); s = discard(s, 1);
    expect(s.tickets.filter(t => t.station === 'orderQueue')).toHaveLength(4);
    expect(applyAction(s, { kind: 'admit', orderKey: 'order-5' }).issues[0].code).toBe('CAPACITY');
    s = discard(s, 2); s = admit(s, 5); expect(s.tickets.filter(t => t.station === 'orderQueue')).toHaveLength(4);
  });
  it('refuses an ordinary third Box ticket even with active VIP presence elsewhere', () => {
    let s = running(); s = admit(admit(admit(s, 1), 2), 3); s = move(s, 1, 'prep'); s = move(s, 3, 'prep');
    s = time(s, 60000); s = move(s, 1, 'oven'); s = move(s, 3, 'oven');
    s = move(s, 2, 'prep'); s = admit(s, 13);
    s = move(time(s, 90000), 2, 'oven'); s = move(time(s, 100000), 1, 'boxDeliver'); s = move(time(s, 120000), 3, 'boxDeliver');
    s = time(s, 130000);
    const rejected = applyAction(s, { kind: 'move', orderKey: 'order-2', to: 'boxDeliver' });
    expect(rejected.issues[0].code).toBe('CAPACITY'); expect(rejected.state).toBe(s);
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: 'order-13', exceptions: [] });
    s = move(s, 1, 'served'); s = move(s, 2, 'boxDeliver');
    expect(s.tickets.filter(t => t.station === 'boxDeliver')).toHaveLength(2);
  });
  it('keeps FIFO at ordinary Orders capacity, with no active VIP token restriction', () => {
    let s = time(running('fifo'), 170000);
    for (let n = 1; n <= 12; n++) { s = admit(s, n); s = discard(s, n); }
    for (const n of [13, 14, 15]) s = admit(s, n);
    expect(s.tickets.filter(t => t.status === 'active')).toHaveLength(3);
    expect(validateEngine(s).ok).toBe(true); expect(value(readVipActivity(s)).activeVipOrderKey).toBeNull();
    const ordinary = running('fifo'); let full = ordinary; for (let n = 1; n <= 4; n++) full = admit(full, n);
    expect(applyAction(full, { kind: 'admit', orderKey: 'order-5' }).issues[0].code).toBe('CAPACITY');
  });
  it('includes admitted VIP lifetime in WIP and rates, excluding all external VIP backlog', () => {
    let s = admit(time(running(), 10000), 13); s = time(s, 90000); s = discard(s, 13);
    const final = stop(s, 170000), wip = value(measureTimeWeightedWip(final));
    expect(wip).toMatchObject({ areaTicketSec: 80, averageWip: 80 / 170, admittedCount: 1, externalCount: 14,
      servedCount: 0, exitCount: 1, allExitRatePerSimMinute: 60 / 170, deliveryRatePerSimMinute: 0 });
    expect(value(measureVipResults(final))).toMatchObject({ vipLate: 1, vipPending: 2, deadlinePenaltyCount: 1 });
  });
});

describe('external-arrival deadlines, partition, scoring and evidence', () => {
  it.each([100000, 100001])('service at deadline boundary %s uses <= for on-time and single -2 otherwise', servedAt => {
    const final = stop(vipReadyInBox(servedAt), servedAt);
    const results = value(measureVipResults(final));
    expect(results).toMatchObject({ vipOnTime: servedAt === 100000 ? 1 : 0, vipLate: servedAt === 100000 ? 0 : 1,
      vipPending: 1, vipNotYetArrived: 1, vipBurnt: 0, vipMeanArrivalToServedMs: servedAt - 10000,
      deadlinePenaltyCount: servedAt === 100000 ? 0 : 1, score: servedAt === 100000 ? 4 : 2 });
    expect(final.metrics.angry).toBe(0); expect(final.history.events.some(e => e.kind === 'anger')).toBe(false);
  });
  it.each([0, 10000, 100000, 100001, 300000])('external VIPs are partitioned without admission at observation %s', at => {
    const s = running(), final = at === 300000 ? value(snapshotFromEngine(time(s, at))) : stop(s, at), results = value(measureVipResults(final));
    expect(results.vipOnTime + results.vipLate + results.vipPending + results.vipNotYetArrived + results.vipBurnt).toBe(3);
    expect(results.deadlinePenaltyCount).toBe(at === 300000 ? 3 : at > 100000 ? 1 : 0);
    expect(results.score).toBe(results.deadlinePenaltyCount ? -2 * results.deadlinePenaltyCount : 0);
    const wip = value(measureTimeWeightedWip(final)); expect(wip.areaTicketSec).toBe(0); expect(wip.averageWip).toBe(at ? 0 : null);
    expect(final.metrics.stillInProgress).toBe(0);
    if (at === 100000) expect(results).toMatchObject({ vipPending: 2, vipNotYetArrived: 1, vipLate: 0 });
  });
  it('late-then-burn final score replaces the deadline penalty and never stacks anger', () => {
    let s = running(); s = move(admit(time(s, 10000), 13), 13, 'prep'); s = move(time(s, 70000), 13, 'oven');
    const overdue = stop(s, 100001); expect(value(measureVipResults(overdue))).toMatchObject({ vipLate: 1, deadlinePenaltyCount: 1, score: -2 });
    const burnt = stop(s, 125000); expect(value(measureVipResults(burnt))).toMatchObject({ vipBurnt: 1, vipLate: 0, deadlinePenaltyCount: 0, score: -2 });
    expect(burnt.metrics).toMatchObject({ burnt: 1, angry: 0, served: 0 });
    expect(burnt.history.events.filter(e => e.kind === 'discard' && e.reason === 'burnt')).toHaveLength(1);
  });
  it('manual closure is unsuccessful late, but deadline penalties only occur after the actual deadline', () => {
    const s = discard(admit(time(running(), 10000), 13), 13);
    expect(value(measureVipResults(stop(s, 10000)))).toMatchObject({ vipLate: 1, deadlinePenaltyCount: 0, score: 0 });
    expect(value(measureVipResults(stop(s, 100001)))).toMatchObject({ vipLate: 1, deadlinePenaltyCount: 1, score: -2 });
  });
  it('keeps a positive served zero-burn bonus, but no bonus for zero served and no bonus after burn', () => {
    expect(value(measureVipResults(stop(running(), 10000))).score).toBe(0);
    let s = running('expedite', 'normal', true); s = move(time(s, 30000), 1, 'oven'); s = move(time(s, 70000), 1, 'boxDeliver'); s = move(s, 1, 'served');
    expect(stop(s).metrics.score).toBe(4);
    s = move(admit(s, 13), 13, 'prep'); s = move(time(s, 100000), 13, 'oven');
    const final = stop(s, 155000); expect(final.metrics.score).toBe(-1); expect(value(measureVipResults(final)).deadlinePenaltyCount).toBe(0);
  });
  it('served-only means distinguish external arrival and Orders admission; empty samples remain null', () => {
    let s = running(); s = move(admit(time(s, 20000), 1), 1, 'prep'); s = move(time(s, 50000), 1, 'oven');
    s = move(time(s, 90000), 1, 'boxDeliver'); s = move(s, 1, 'served');
    const result = value(measureVipResults(stop(s)));
    expect(result).toMatchObject({ normalServedN: 1, normalMeanArrivalToServedMs: 90000, normalMeanOrdersToServedMs: 70000, vipServedN: 0, vipMeanArrivalToServedMs: null });
    const ordinary = value(snapshotFromEngine(time(value(replay(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' })), 'ordinary', [{ atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } }], 240000)).state, 240000)));
    expect(measureVipResults(ordinary)).toMatchObject({ ok: false, issues: [{ code: 'NOT_VIP_SCENARIO' }] });
  });
  it('marks positive-time normal Orders/ready/Box waiting overlap, excluding processing, external and zero-time overlap', () => {
    let s = running('expedite', 'normal', true); s = admit(s, 2);
    s = move(admit(time(s, 10000), 13), 13, 'prep'); s = time(s, 20000); s = discard(s, 13);
    const results = value(measureVipResults(stop(s))); expect(results.normalWaitedDuringVipCount).toBe(1); // only normal 2 in Orders, not guide still processing
    const zero = discard(admit(time(running(), 10000), 13), 13); expect(value(measureVipResults(stop(zero))).normalWaitedDuringVipCount).toBe(0);
    s = running('expedite', 'normal', true); s = admit(time(s, 35000), 13); s = time(s, 36000);
    expect(value(measureVipResults(stop(s))).normalWaitedDuringVipCount).toBe(1); // guide ready at Prep
  });
  it('reconciles complete 15-ticket ledgers, immutable replay and tamper rejection', () => {
    let s = running(); s = move(admit(time(s, 10000), 13), 13, 'prep');
    const before = JSON.stringify(s); const final = stop(s, 100001);
    expect(JSON.stringify(s)).toBe(before); expect(final.orders).toHaveLength(15);
    const folded = value(account(final.config, final.runId, final.history, final.observation.endMs));
    expect(folded.active).toBe(1); expect(folded.external).toBe(13); expect(folded.arrived).toBe(14); expect(folded.areaTicketMs).toBe(90001);
    expect(Object.isFrozen(final.history.events)).toBe(true); expect(Object.isFrozen(value(measureVipResults(final)))).toBe(true);
    const forged: any = clone(final); forged.metrics.score = 0; expect(validateSnapshot(forged).ok).toBe(false);
    forged.metrics.score = final.metrics.score; forged.config.manifest.orders[12].deadlineAtMs++; expect(validateSnapshot(forged).ok).toBe(false);
    const unknown: any = clone(final); unknown.history.events[0].vip = true; expect(validateSnapshot(unknown).ok).toBe(false);
    expect(value(replay(s.config, s.runId, replayFrames(s), s.nowMs)).state).toEqual(s);
    expect(immutable(s)).toEqual(s);
  });
  it('sole explicit pair can match canonical pilot variants but never establishes production approval or human play', () => {
    const b = horizon('fifo'), a = horizon('expedite');
    expect(assessComparison(archive(b, a), pair)).toMatchObject({ kind: 'matched', issues: [], evidence: 'producer-compatible', humanPlay: 'not-established' });
    expect(inspectProducerCompatibility(a)).toMatchObject({ ok: true, value: { productionManifest: false, humanPlay: 'not-established' } });
    expect(assessComparison(archive(b, a), { ...pair, change: null }).issues).toContain('UNAPPROVED_POLICY_CHANGE');
    expect(assessComparison(archive(b, a), { ...pair, baselineRunId: 'missing' }).kind).toBe('missing');
    expect(assessComparison(archive(b, a), { ...pair, requestedBasis: 'contextual' }).kind).toBe('contextual');
    expect(assessComparison(archive(b, a), { ...pair, change: { ...pair.change!, dimensionId: 'admission-wip' } }).issues).toContain('UNAPPROVED_POLICY_CHANGE');
  });
  it('control trace differences and equal manual stops remain unmatched', () => {
    const b = horizon('fifo'), a = horizon('expedite', [{ atMs: 1000, command: { kind: 'speed', speed: 2 } }]);
    expect(assessComparison(archive(b, a), pair).issues).toContain('CONTROL_TRACE_MISMATCH');
    const manual = archive(stop(running('fifo', 'normal', false, 'fifo'), 1000), stop(running('expedite', 'normal', false, 'expedite'), 1000));
    expect(assessComparison(manual, pair).issues).toContain('MANUAL_END_NOT_MATCHABLE');
    expect(assessComparison(manual, pair).kind).toBe('unmatched');
  });
});
