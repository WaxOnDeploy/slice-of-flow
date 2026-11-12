import { describe, expect, it, vi } from 'vitest';
import * as matching from '../sofEngine/matchedRuns';
import { compareTwoRuns, type ComparisonMetric, type TwoRunComparison } from './compare';
import { clone, testConfig, value } from '../sofEngine/fixtures/testCases';
import { validateSnapshot, snapshotFromEngine } from '../sofEngine/runSnapshots';
import { replay } from '../sofEngine/engine';
import { makeFixedDeckConfig, VERSIONS } from '../sofEngine/scenario';
import { SERVED_DEFINITION, WIP_BOUNDARY } from '../sof/metricDefinitions';
import type { EventData, FinalOrder, FinalRunSnapshot, RunConfig } from '../sofEngine/types';

const pair = { pairId: 'pair', baselineRunId: 'b', subjectRunId: 'a', requestedBasis: 'contextual', change: null };
const matchedPair = { ...pair, requestedBasis: 'matched', change: { dimensionId: VERSIONS.policy, version: VERSIONS.policyVersion,
  beforeVariantId: 'interval-push', afterVariantId: 'manual-pull' } };
const archive = (...runs: FinalRunSnapshot[]) => ({ schema: 'sof-archive/v1', runs });
const row = (v: TwoRunComparison, metric: ComparisonMetric) => v.rows.find(r => r.metric === metric)!;

/** Independent complete port oracle: each admitted ticket enters Prep at 0, Oven at 30000ms,
 * Box at 70000ms, then serves at a hand-selected time. Other tickets can be manually discarded
 * from Orders at hand-selected times. These port observations do not claim producer physics.
 */
function port(id: string, times: readonly number[], discards: readonly number[] = [], duration = 240000): FinalRunSnapshot {
  const count = times.length + discards.length;
  const config = testConfig({ count, horizonMs: duration, prepMs: 30000, bakeMs: 40000, patienceMs: 480000 });
  const ref = (i: number) => ({ orderKey: `order-${i + 1}`, orderId: `${id}:order:${i + 1}` });
  const rows: (EventData & { atMs: number })[] = [{ kind: 'runStarted', atMs: 0 }];
  for (let i = 0; i < count; i++) rows.push({ kind: 'arrival', ...ref(i), atMs: 0 });
  for (let i = 0; i < count; i++) rows.push({ kind: 'admission', ...ref(i), by: 'pull', atMs: 0 });
  for (let i = 0; i < times.length; i++) rows.push({ kind: 'movement', ...ref(i), from: 'orderQueue', to: 'prep', atMs: 0 });
  const later: (EventData & { atMs: number })[] = [];
  for (let i = 0; i < times.length; i++) later.push(
    { kind: 'movement', ...ref(i), from: 'prep', to: 'oven', atMs: 30000 },
    { kind: 'movement', ...ref(i), from: 'oven', to: 'boxDeliver', atMs: 70000 },
    { kind: 'service', ...ref(i), from: 'boxDeliver', atMs: times[i] });
  for (let i = 0; i < discards.length; i++) later.push({ kind: 'discard', ...ref(times.length + i), from: 'orderQueue', reason: 'manual', atMs: discards[i] });
  // Hand-written fixture construction orders events; production never sorts a supplied ledger.
  later.sort((a, b) => a.atMs - b.atMs); rows.push(...later, { kind: 'runEnded', reason: 'horizon', atMs: duration });
  const orders: FinalOrder[] = [
    ...times.map((time, i): FinalOrder => ({ ...ref(i), outcome: 'served', finalStation: null, admittedAtMs: 0, exitedAtMs: time, angry: false })),
    ...discards.map((time, i): FinalOrder => ({ ...ref(times.length + i), outcome: 'discarded', finalStation: null, admittedAtMs: 0, exitedAtMs: time, angry: false })),
  ];
  // Fixture inputs explicitly state timestamps; this sample sum is simple independent fixture math,
  // not a production reducer oracle. Tests below assert hand-authored expected sums/means separately.
  const sum = times.reduce((s, n) => s + n, 0);
  return { schema: 'sof-run/v1', kind: 'independent-final', runId: id, config,
    history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: rows.map((e, i) => ({ ...e, runId: id, seq: i + 1 })) },
    observation: { startMs: 0, endMs: duration, durationMs: duration }, endReason: 'horizon', orders,
    metrics: { served: times.length, burnt: 0, angry: 0, stillInProgress: 0, score: times.length > 0 ? times.length + 3 : 0,
      servedSample: { definition: SERVED_DEFINITION, n: times.length, sumSimMs: sum, meanSimMs: times.length > 0 ? sum / times.length : null } } };
}
function zeroServedPort(id: string, endMs = 10000): FinalRunSnapshot {
  const c = testConfig({ count: 1, horizonMs: endMs });
  const r = { orderKey: 'order-1', orderId: `${id}:order:1` };
  const rows: (EventData & { atMs: number })[] = [
    { kind: 'runStarted', atMs: 0 }, { kind: 'arrival', ...r, atMs: 0 }, { kind: 'admission', ...r, by: 'pull', atMs: 0 },
    { kind: 'movement', ...r, from: 'orderQueue', to: 'prep', atMs: 0 },
    { kind: 'movement', ...r, from: 'prep', to: 'oven', atMs: 0 },
    { kind: 'movement', ...r, from: 'oven', to: 'boxDeliver', atMs: 0 },
    { kind: 'service', ...r, from: 'boxDeliver', atMs: 0 }, { kind: 'runEnded', reason: 'horizon', atMs: endMs },
  ];
  return { schema: 'sof-run/v1', kind: 'independent-final', runId: id, config: c,
    history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: rows.map((e, i) => ({ ...e, runId: id, seq: i + 1 })) },
    observation: { startMs: 0, endMs, durationMs: endMs }, endReason: 'horizon',
    orders: [{ ...r, outcome: 'served', finalStation: null, admittedAtMs: 0, exitedAtMs: 0, angry: false }],
    metrics: { served: 1, burnt: 0, angry: 0, stillInProgress: 0, score: 4, servedSample: { definition: SERVED_DEFINITION, n: 1, sumSimMs: 0, meanSimMs: 0 } } };
}
function actual(c: RunConfig, id: string): FinalRunSnapshot {
  return value(snapshotFromEngine(value(replay(c, id, [
    { atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } },
    { atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } },
  ], 1000)).state));
}

describe('read-only semantic two-run rows', () => {
  it('asserts exact hand-authored numbers, metadata, and separately defined measured versus illustrative means', () => {
    const b = port('b', [120000]), a = port('a', [90000, 90000], [60000]);
    expect(validateSnapshot(b).ok).toBe(true); expect(validateSnapshot(a).ok).toBe(true);
    const v = compareTwoRuns(archive(b, a), pair);
    expect(v.assessment.kind).toBe('contextual');
    expect(row(v, 'served')).toMatchObject({ delta: 1, relation: 'higher', metricOutcome: 'favorable', baseline: { value: 1 }, subject: { value: 2 } });
    expect(row(v, 'deliveryRate')).toMatchObject({ delta: 0.25, baseline: { value: 0.25 }, subject: { value: 0.5 } });
    expect(row(v, 'allExitRate')).toMatchObject({ delta: 0.5, baseline: { value: 0.25 }, subject: { value: 0.75 }, metricOutcome: 'descriptive' });
    expect(row(v, 'averageWip')).toMatchObject({ delta: 0.5, baseline: { value: 0.5 }, subject: { value: 1 }, metricOutcome: 'descriptive' });
    expect(row(v, 'measuredServed')).toMatchObject({ delta: -30, relation: 'lower', baseline: { value: 120, sampleCount: 1, sampleSumSimSec: 120 }, subject: { value: 90, sampleCount: 2, sampleSumSimSec: 180 } });
    expect(row(v, 'illustration')).toMatchObject({ delta: -40, baseline: { value: 120 }, subject: { value: 80 }, metricOutcome: 'descriptive' });
    expect(row(v, 'measuredServed').subject.definition).toBe(SERVED_DEFINITION);
    expect(row(v, 'measuredServed').subject.population).toBe('served-only');
    expect(row(v, 'illustration').subject.population).toBe(WIP_BOUNDARY);
    expect(row(v, 'illustration').subject.definition).not.toBe(row(v, 'measuredServed').subject.definition);
    expect(v.subject).toMatchObject({ runId: 'a', source: 'engine-boundary', validation: 'independent-accounting',
      scenarioVersion: 'test-fixture/v1', generatorVersion: 'test-only/v1', plannedHorizonMs: 240000,
      observation: { startMs: 0, endMs: 240000, durationMs: 240000 }, endReason: 'horizon',
      measuredServedSampleCount: 2, measuredServedSumSimSec: 180 });
    expect(v.directionPattern).toBe('mixed'); expect(v.interpretation).toBe('descriptive-only');
    expect(v.illustrationCaveat).toContain('not measured served-ticket lead time');
    expect(v.exitRateDistinction).toContain('delivery rate counts only served');
  });
  it('equal means/counts are exact equal with numeric zero deltas, not missing', () => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [90000])), pair);
    expect(v.directionPattern).toBe('equal');
    for (const r of v.rows) { expect(r.delta).toBe(0); expect(r.relation).toBe('equal'); expect(r.metricOutcome).toBe('equal'); }
  });
  it('adverse served-only mean direction does not declare a winner, improvement or causal effect', () => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [120000])), pair);
    expect(row(v, 'measuredServed')).toMatchObject({ delta: 30, relation: 'higher', metricOutcome: 'adverse' });
    expect(row(v, 'served').relation).toBe('equal'); expect(v.directionPattern).toBe('higher-only');
    expect(v).not.toHaveProperty('winner'); expect(v).not.toHaveProperty('improvement'); expect(v).not.toHaveProperty('causality');
    expect(v.interpretation).toBe('descriptive-only');
  });
  it('adverse burns and recorded anger remain distinct metric outcomes in synthetic producer fixtures', () => {
    const b = port('b', [], [], 50);
    const c = testConfig({ count: 2, horizonMs: 50, patienceMs: 10 });
    const a = value(snapshotFromEngine(value(replay(c, 'a', [
      { atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } },
      { atMs: 0, command: { kind: 'admit', orderKey: 'order-1' } },
      { atMs: 0, command: { kind: 'move', orderKey: 'order-1', to: 'prep' } },
      { atMs: 0, command: { kind: 'admit', orderKey: 'order-2' } },
      { atMs: 3, command: { kind: 'move', orderKey: 'order-1', to: 'oven' } },
    ], 50)).state));
    // Burn at 3+4+15=22ms; surviving Orders ticket angers at 10ms. Burnt anger is excluded.
    expect(a.metrics).toMatchObject({ served: 0, burnt: 1, angry: 1, stillInProgress: 1, score: -3 });
    const v = compareTwoRuns(archive(b, a), pair);
    expect(row(v, 'burnt')).toMatchObject({ delta: 1, relation: 'higher', metricOutcome: 'adverse' });
    expect(row(v, 'angry')).toMatchObject({ delta: 1, relation: 'higher', metricOutcome: 'adverse' });
    expect(row(v, 'allExitRate').subject.value).toBe(1200);
    expect(row(v, 'deliveryRate').subject.value).toBe(0);
    expect(v.interpretation).toBe('descriptive-only');
  });
  it('keeps raw tiny nonzero deltas, not display-rounded equality', () => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [90001])), pair);
    expect(row(v, 'measuredServed').delta).toBeCloseTo(0.001, 12);
    expect(row(v, 'measuredServed').relation).toBe('higher');
  });
  it('positive-duration empty observations give numeric zero WIP/rates but no-sample means', () => {
    const v = compareTwoRuns(archive(port('b', []), port('a', [])), pair);
    for (const key of ['served', 'burnt', 'angry', 'averageWip', 'deliveryRate', 'allExitRate'] as const) {
      expect(row(v, key)).toMatchObject({ delta: 0, baseline: { value: 0, unavailable: null }, subject: { value: 0, unavailable: null }, relation: 'equal' });
    }
    expect(row(v, 'measuredServed')).toMatchObject({ delta: null, relation: 'unavailable', baseline: { value: null, unavailable: 'no-served-samples', sampleCount: 0 } });
    expect(row(v, 'illustration').baseline.unavailable).toBe('zero-exits'); expect(v.directionPattern).toBe('missing');
  });
  it('zero-duration empty observations retain count zeros while denominator-dependent rows are unavailable', () => {
    const v = compareTwoRuns(archive(port('b', [], [], 0), port('a', [], [], 0)), pair);
    expect(row(v, 'served').delta).toBe(0); expect(row(v, 'deliveryRate').delta).toBeNull();
    expect(row(v, 'averageWip').subject.unavailable).toBe('zero-duration');
    expect(row(v, 'illustration').subject.unavailable).toBe('zero-duration');
  });
  it.each([0, 10000])('legal zero served sample at observation %sms remains measured n=1/mean=0', duration => {
    const v = compareTwoRuns(archive(zeroServedPort('b', duration), zeroServedPort('a', duration)), pair);
    expect(row(v, 'measuredServed')).toMatchObject({ delta: 0, relation: 'equal', baseline: { value: 0, sampleCount: 1, sampleSumSimSec: 0, unavailable: null } });
    expect(v.assessment.kind).toBe('contextual'); expect(v.humanPlay).toBe('not-established');
  });
  it('one no-sample side disables only its mean and preserves available count/rate deltas', () => {
    const v = compareTwoRuns(archive(port('b', []), port('a', [90000])), pair);
    expect(row(v, 'served').delta).toBe(1); expect(row(v, 'deliveryRate').delta).toBe(0.25);
    expect(row(v, 'measuredServed').delta).toBeNull(); expect(row(v, 'measuredServed').subject.sampleCount).toBe(1);
  });
  it('all-discard fixture has delivery zero, all-exit rate positive, measured served unavailable and illustration defined', () => {
    const v = compareTwoRuns(archive(port('b', [], [60000]), port('a', [], [90000])), pair);
    expect(row(v, 'served').subject.value).toBe(0); expect(row(v, 'deliveryRate').subject.value).toBe(0);
    expect(row(v, 'allExitRate').subject.value).toBe(0.25); expect(row(v, 'measuredServed').subject.unavailable).toBe('no-served-samples');
    expect(row(v, 'illustration')).toMatchObject({ delta: 30, subject: { value: 90 }, baseline: { value: 60 } });
  });
  it('actual unequal windows are retained without a fabricated preset rate denominator', () => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [90000], [], 120000)), pair);
    expect(v.baseline!.observation.durationMs).toBe(240000); expect(v.subject!.observation.durationMs).toBe(120000);
    expect(row(v, 'deliveryRate')).toMatchObject({ delta: 0.25, baseline: { value: 0.25 }, subject: { value: 0.5 } });
    expect(v.assessment.kind).toBe('contextual'); expect(v.interpretation).toBe('descriptive-only');
  });
  it('calls the sole authority exactly once, using its returned assessment unchanged', () => {
    const spy = vi.spyOn(matching, 'assessComparison');
    try {
      const b = actual(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'interval-push' })), 'b');
      const a = actual(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull' })), 'a');
      const ar = archive(b, a); const v = compareTwoRuns(ar, matchedPair);
      expect(spy).toHaveBeenCalledTimes(1); expect(spy).toHaveBeenCalledWith(ar, matchedPair);
      expect(v.assessment).toEqual(spy.mock.results[0].value); expect(v.assessment.kind).toBe('matched');
      expect(v.assessment.evidence).toBe('producer-compatible'); expect(v.assessment.humanPlay).toBe('not-established');
      expect(row(v, 'served').relation).toBe('equal'); expect(v.directionPattern).toBe('missing');
    } finally { spy.mockRestore(); }
  });
  it('failed matching never becomes contextual or matched by consumer convenience; rows stay descriptive', () => {
    const v = compareTwoRuns(archive(port('b', [120000]), port('a', [90000])), matchedPair);
    expect(v.assessment.kind).toBe('unmatched'); expect(v.assessment.issues).toContain('BASELINE_NOT_PRODUCTION_MANIFEST');
    expect(row(v, 'measuredServed').delta).toBe(-30); expect(v.interpretation).toBe('descriptive-only');
  });
  it('exact selected IDs remain stable even with later/earlier retained attempts', () => {
    const v = compareTwoRuns(archive(port('new-best', [70000]), port('a', [120000]), port('b', [90000]), port('latest', [])), pair);
    expect(v.baseline!.runId).toBe('b'); expect(v.subject!.runId).toBe('a'); expect(row(v, 'measuredServed').delta).toBe(30);
  });
  it('invalid self-selection cannot generate an equal numeric comparison', () => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [90000])), { ...pair, subjectRunId: 'b' });
    expect(v.assessment.issues).toContain('SELF_PAIR'); expect(v.baseline).toBeNull(); expect(v.subject).toBeNull();
    expect(v.rows.every(r => r.delta === null && r.relation === 'unavailable')).toBe(true);
  });
  it.each([
    ['b', 'stale', 'subject'], ['stale', 'a', 'baseline'], ['gone', 'stale', 'both'],
  ])('missing %s / %s cannot fall back to another retained run', (baselineRunId, subjectRunId, side) => {
    const v = compareTwoRuns(archive(port('b', [90000]), port('a', [90000]), port('latest', [70000])), { ...pair, baselineRunId, subjectRunId });
    expect(v.assessment.kind).toBe('missing'); expect(v.rows.every(r => r.delta === null)).toBe(true);
    if (side === 'subject' || side === 'both') expect(v.subject).toBeNull();
    if (side === 'baseline' || side === 'both') expect(v.baseline).toBeNull();
    expect(row(v, 'served')[side === 'baseline' ? 'baseline' : 'subject'].unavailable).toBe('missing-run');
  });
  it.each([
    (s: any) => { s.metrics.served = NaN; }, (s: any) => { s.metrics.served = Infinity; },
    (s: any) => { s.metrics.served = -1; }, (s: any) => { s.metrics.served = 0.5; },
    (s: any) => { s.metrics.servedSample.n = 0; }, (s: any) => { s.metrics.servedSample.sumSimMs = Infinity; },
    (s: any) => { s.metrics.servedSample.definition = 'orders-to-served/positive-usable/v1'; },
    (s: any) => { s.history = null; }, (s: any) => { s.history.events = []; },
    (s: any) => { s.observation.durationMs = null; }, (s: any) => { s.observation.durationMs = -1; },
  ])('invalid snapshot/sample/definition is unavailable, not a coerced zero or incompatible mean delta %#', mutate => {
    const ar: any = clone(archive(port('b', [90000]), port('a', [90000]))); mutate(ar.runs[1]);
    const v = compareTwoRuns(ar, pair); expect(v.assessment.kind).toBe('unmatched');
    expect(v.rows.every(r => r.delta === null)).toBe(true); expect(row(v, 'served').subject.unavailable).toBe('invalid-run');
  });
  it.each([null, undefined, 0, [], {}, { ...pair, matched: true }, { ...pair, signature: 'equal' }, { ...pair, changedFields: ['policy'] }])('unknown public pair boundary fails closed %#', input => {
    expect(() => compareTwoRuns(archive(port('b', []), port('a', [])), input)).not.toThrow();
    const v = compareTwoRuns(archive(port('b', []), port('a', [])), input); expect(v.assessment.kind).toBe('unmatched'); expect(v.rows.every(r => r.delta === null)).toBe(true);
  });
  it.each([null, undefined, 0, [], {}, { schema: 'sof-archive/v1', runs: [{ runId: 'legacy:r2', served: 1 }] }])('unknown archive/released summaries stay unavailable %#', input => {
    expect(() => compareTwoRuns(input, pair)).not.toThrow(); expect(compareTwoRuns(input, pair).assessment.kind).toBe('unmatched');
  });
  it('read-only inputs and outputs survive later reset/mutation with independently retained definitions', () => {
    const ar: any = clone(archive(port('b', [120000]), port('a', [90000]))), p = clone(pair), before = clone(ar), beforePair = clone(p);
    const v = compareTwoRuns(ar, p); expect(ar).toEqual(before); expect(p).toEqual(beforePair);
    expect(Object.isFrozen(ar.runs)).toBe(false); expect(Object.isFrozen(v.rows)).toBe(true); expect(Object.isFrozen(v.rows[0].subject.observation)).toBe(true);
    ar.runs.length = 0; p.subjectRunId = 'new'; expect(v.subject!.runId).toBe('a'); expect(row(v, 'measuredServed').delta).toBe(-30);
    const hostile = Object.defineProperty({}, 'schema', { get() { throw new Error('getter'); } });
    expect(() => compareTwoRuns(hostile, pair)).not.toThrow();
  });
});
