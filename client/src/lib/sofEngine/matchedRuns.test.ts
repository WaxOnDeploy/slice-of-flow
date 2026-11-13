import { describe, expect, it } from 'vitest';
import { assessComparison, inspectProducerCompatibility, type PairSpec } from './matchedRuns';
import { makeFixedDeckConfig, VERSIONS } from './scenario';
import { replay } from './engine';
import { snapshotFromEngine, validateSnapshot } from './runSnapshots';
import { clone, testConfig, value } from './fixtures/testCases';
import type { FinalRunSnapshot, ReplayFrame, RunConfig } from './types';

const PAIR: PairSpec = { pairId: 'pair-1', baselineRunId: 'b', subjectRunId: 'a', requestedBasis: 'matched',
  change: { dimensionId: VERSIONS.policy, version: VERSIONS.policyVersion, beforeVariantId: 'interval-push', afterVariantId: 'manual-pull' } };
const archive = (...runs: FinalRunSnapshot[]) => ({ schema: 'sof-archive/v1', runs });
function config(policy: 'interval-push' | 'manual-pull', extra: Record<string, unknown> = {}): RunConfig {
  return value(makeFixedDeckConfig({ difficulty: 'normal', policy, ...extra }));
}
/** Hand-written oracle: twelve available/not-admitted tickets, no activity; actual stop=1000ms.
 * The producer is not invoked to manufacture this expected ledger or any expected arithmetic.
 */
function idlePort(c: RunConfig, runId: string, endMs = 1000): FinalRunSnapshot {
  const refs = c.manifest.orders.map(o => ({ orderKey: o.orderKey, orderId: `${runId}:order:${o.ordinal}` }));
  return {
    schema: 'sof-run/v1', kind: 'independent-final', runId, config: c,
    history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: [
      { kind: 'runStarted' as const, atMs: 0 }, ...refs.map(r => ({ kind: 'arrival' as const, ...r, atMs: 0 })),
      { kind: 'commandAccepted' as const, commandClass: 'control' as const, command: { kind: 'set-pause' as const, reason: 'instruction' as const, active: false }, atMs: 0 },
      { kind: 'commandAccepted' as const, commandClass: 'control' as const, command: { kind: 'end' as const, reason: 'manual-stop' as const }, atMs: endMs },
      { kind: 'runEnded' as const, reason: 'manual-stop' as const, atMs: endMs },
    ].map((e, i) => ({ ...e, runId, seq: i + 1 })) },
    observation: { startMs: 0, endMs, durationMs: endMs }, endReason: 'manual-stop',
    orders: refs.map(r => ({ ...r, outcome: 'not-admitted', finalStation: null, admittedAtMs: null, exitedAtMs: null, angry: false })),
    metrics: { served: 0, burnt: 0, angry: 0, stillInProgress: 0, score: 0,
      servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 0, sumSimMs: 0, meanSimMs: null } },
  };
}
const resume: ReplayFrame = { atMs: 0, command: { kind: 'set-pause', reason: 'instruction', active: false } };
function producer(c: RunConfig, id: string, frames: readonly ReplayFrame[] = [], endMs = c.manifest.horizonMs): FinalRunSnapshot {
  return value(snapshotFromEngine(value(replay(c, id, [resume, ...frames], endMs)).state));
}
const matched = () => archive(idlePort(config('interval-push'), 'b'), idlePort(config('manual-pull'), 'a'));

describe('sole explicit-pair assessment', () => {
  it('matches the independent hand-authored canonical oracle only after producer replay compatibility', () => {
    const result = assessComparison(matched(), PAIR);
    expect(result).toEqual({ pairId: 'pair-1', baselineRunId: 'b', subjectRunId: 'a', kind: 'matched', issues: [], details: [],
      evidence: 'producer-compatible', humanPlay: 'not-established' });
    expect(inspectProducerCompatibility(matched().runs[0])).toMatchObject({ ok: true, value: { productionManifest: true, humanPlay: 'not-established' } });
  });
  it('never requires equality of ordinary admissions, moves, or discard gameplay', () => {
    const b = producer(config('interval-push'), 'b', [{ atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } }], 1000);
    const a = producer(config('manual-pull'), 'a', [
      { atMs: 0, command: { kind: 'admit', orderKey: 'order-1' } },
      { atMs: 0, command: { kind: 'discard', orderKey: 'order-1' } },
      { atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } },
    ], 1000);
    expect(a.metrics.served).toBe(0); expect(a.orders[0].outcome).toBe('discarded');
    expect(assessComparison(archive(b, a), PAIR).kind).toBe('matched');
  });
  it('accepts both approved policy directions, but not same variants or arbitrary bundles', () => {
    const reverse = { ...PAIR, baselineRunId: 'a', subjectRunId: 'b', change: { ...PAIR.change!, beforeVariantId: 'manual-pull', afterVariantId: 'interval-push' } };
    expect(assessComparison(matched(), reverse).kind).toBe('matched');
    for (const change of [null, { ...PAIR.change!, dimensionId: 'capacity' }, { ...PAIR.change!, version: 'v2' },
      { ...PAIR.change!, afterVariantId: 'interval-push' }, { ...PAIR.change!, afterVariantId: 'four-slots' }]) {
      expect(assessComparison(matched(), { ...PAIR, change }).issues).toContain('UNAPPROVED_POLICY_CHANGE');
    }
    expect(assessComparison(matched(), { ...PAIR, change: reverse.change }).issues).toContain('POLICY_VARIANT_MISMATCH');
  });
  it('retains contextual as its own explicit state, not a failed match downgrade', () => {
    const result = assessComparison(matched(), { ...PAIR, requestedBasis: 'contextual', change: null });
    expect(result.kind).toBe('contextual'); expect(result.issues).toEqual(['CONTEXTUAL_REQUESTED']);
    expect(result.evidence).toBe('not-established');
  });
  it.each([
    ['b', 'stale', ['SUBJECT_MISSING']], ['stale', 'a', ['BASELINE_MISSING']],
    ['gone', 'stale', ['BASELINE_MISSING', 'SUBJECT_MISSING']],
  ])('does not substitute a latest/best run for %s / %s', (baselineRunId, subjectRunId, issues) => {
    const result = assessComparison(matched(), { ...PAIR, baselineRunId, subjectRunId });
    expect(result.kind).toBe('missing'); expect(result.issues).toEqual(issues);
  });
  it('rejects self pairs, duplicate IDs and released summaries outside this archive', () => {
    expect(assessComparison(matched(), { ...PAIR, subjectRunId: 'b' }).issues).toContain('SELF_PAIR');
    expect(assessComparison(archive(matched().runs[0], matched().runs[0]), PAIR).issues).toContain('INVALID_ARCHIVE');
    expect(assessComparison({ schema: 'sof-archive/v1', runs: [{ runId: 'legacy:r2', served: 7 }] }, PAIR).kind).toBe('unmatched');
  });
  it('compares materialized invariants even for mutually valid fixture manifests without promoting them', () => {
    const b = producer(testConfig({ policy: 'interval-push', count: 1, horizonMs: 50 }), 'b');
    const a = producer(testConfig({ policy: 'manual-pull', count: 1, horizonMs: 50 }), 'a');
    const r = assessComparison(archive(b, a), PAIR);
    expect(r.issues).toEqual(['BASELINE_NOT_PRODUCTION_MANIFEST', 'SUBJECT_NOT_PRODUCTION_MANIFEST']);
    expect(r.kind).toBe('unmatched');
    expect(inspectProducerCompatibility(a)).toMatchObject({ ok: true, value: { productionManifest: false } });
  });
  it.each([
    ['demand-work', { prepMs: 9 }, 'DEMAND_MISMATCH'],
    ['demand-availability', { arrivals: [20] }, 'DEMAND_MISMATCH'],
    ['timing', { intervalMs: 11 }, 'TIMING_MISMATCH'],
    ['holds', { holds: [{ holdId: 'h', orderKey: 'order-1', startMs: 5, endMs: 30, reason: 'fixture-dependency' }] }, 'HOLDS_MISMATCH'],
  ])('names the valid %s mismatch', (_name, extra, code) => {
    const b = producer(testConfig({ policy: 'interval-push', count: 1, horizonMs: 50 }), 'b');
    const a = producer(testConfig({ policy: 'manual-pull', count: 1, horizonMs: 50, ...extra } as Parameters<typeof testConfig>[0]), 'a');
    expect(assessComparison(archive(b, a), PAIR).issues).toContain(code);
  });
  it.each([
    ['INITIAL_SPEED_MISMATCH', { initialSpeed: 1 }], ['GUIDANCE_MISMATCH', { guidedStart: true }],
    ['END_CONDITION_MISMATCH', { endCondition: 'all-resolved-or-horizon' }], ['DIFFICULTY_MISMATCH', { difficulty: 'easy' }],
  ])('compares %s as invariant config', (code, extra) => {
    // For guided start, use actual producer frames to complete guidance rather than forge it.
    const c = config('manual-pull', extra);
    const frames: ReplayFrame[] = extra.guidedStart ? [
      { atMs: 0, command: { kind: 'move', orderKey: 'order-1', to: 'prep' } },
      { atMs: 0, command: { kind: 'set-pause', reason: 'guide', active: false } },
    ] : [];
    frames.push({ atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } });
    const a = producer(c, 'a', frames, 1000);
    expect(assessComparison(archive(matched().runs[0], a), PAIR).issues).toContain(code);
  });
  it.each([
    [{ kind: 'speed', speed: 1 }],
    [{ kind: 'set-pause', reason: 'facilitator', active: true }, { kind: 'set-pause', reason: 'facilitator', active: false }],
    [{ kind: 'set-pause', reason: 'hidden', active: true }, { kind: 'set-pause', reason: 'hidden', active: false }],
    [{ kind: 'speed', speed: 1 }, { kind: 'speed', speed: 3 }],
  ].map(commands => [commands]))('compares all effective same-time control envelopes without dropping a temporary change %#', commands => {
    const frames = commands.map(command => ({ atMs: 0, command })) as ReplayFrame[];
    frames.push({ atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } });
    const a = producer(config('manual-pull'), 'a', frames, 1000);
    expect(assessComparison(archive(matched().runs[0], a), PAIR).issues).toContain('CONTROL_TRACE_MISMATCH');
  });
  it('ignores no-op controls (producer records no effective envelope)', () => {
    const a = producer(config('manual-pull'), 'a', [
      { atMs: 0, command: { kind: 'speed', speed: 3 } },
      { atMs: 0, command: { kind: 'set-pause', reason: 'facilitator', active: false } },
      { atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } },
    ], 1000);
    expect(assessComparison(archive(matched().runs[0], a), PAIR).kind).toBe('matched');
  });
  it.each(['instruction', 'help', 'facilitator', 'transition', 'exit-confirmation', 'hidden'] as const)('compares effective %s pause ownership', reason => {
    const a = producer(config('manual-pull'), 'a', [
      { atMs: 0, command: { kind: 'set-pause', reason, active: true } },
      { atMs: 0, command: { kind: 'set-pause', reason, active: false } },
      { atMs: 1000, command: { kind: 'end', reason: 'manual-stop' } },
    ], 1000);
    expect(assessComparison(archive(matched().runs[0], a), PAIR).issues).toContain('CONTROL_TRACE_MISMATCH');
  });
  it('same effective controls at different actual simulated times are not equal traces', () => {
    const control = { kind: 'speed' as const, speed: 1 as const };
    const stop = { atMs: 1000, command: { kind: 'end' as const, reason: 'manual-stop' as const } };
    const b = producer(config('interval-push'), 'b', [{ atMs: 500, command: control }, stop], 1000);
    const a = producer(config('manual-pull'), 'a', [{ atMs: 501, command: control }, stop], 1000);
    expect(assessComparison(archive(b, a), PAIR).issues).toContain('CONTROL_TRACE_MISMATCH');
  });
  it('unknown override/control envelopes never authorize matching', () => {
    const raw: any = clone(matched());
    raw.runs[1].history.events[13].command = { kind: 'override', capacity: 4 };
    expect(assessComparison(raw, PAIR).kind).toBe('unmatched');
    expect(assessComparison(raw, PAIR).details.some(d => d.code === 'INVALID_COMMAND')).toBe(true);
  });
  it('legal zero served-duration lifecycle sample remains port accounting, not matched production evidence', () => {
    const a: any = clone(matched().runs[1]);
    const ref = { orderKey: 'order-1', orderId: 'a:order:1' };
    const transitions = [
      { kind: 'admission', ...ref, by: 'pull' },
      { kind: 'movement', ...ref, from: 'orderQueue', to: 'prep' },
      { kind: 'movement', ...ref, from: 'prep', to: 'oven' },
      { kind: 'movement', ...ref, from: 'oven', to: 'boxDeliver' },
      { kind: 'service', ...ref, from: 'boxDeliver' },
    ].map(e => ({ ...e, runId: 'a', atMs: 0 }));
    a.history.events.splice(14, 0, ...transitions);
    a.history.events.forEach((e: any, i: number) => { e.seq = i + 1; });
    a.orders[0] = { ...a.orders[0], outcome: 'served', admittedAtMs: 0, exitedAtMs: 0 };
    a.metrics = { ...a.metrics, served: 1, score: 4, servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 0, meanSimMs: 0 } };
    expect(validateSnapshot(a).ok).toBe(true);
    expect(inspectProducerCompatibility(a).ok).toBe(false);
    expect(assessComparison(archive(matched().runs[0], a), PAIR).issues).toContain('SUBJECT_PRODUCER_INCOMPATIBLE');
  });
  it('requires identical positive actual windows and terminal provenance, not a preset duration', () => {
    const shorter = idlePort(config('manual-pull'), 'a', 999);
    expect(assessComparison(archive(matched().runs[0], shorter), PAIR).issues).toContain('OBSERVATION_MISMATCH');
    const zero = archive(idlePort(config('interval-push'), 'b', 0), idlePort(config('manual-pull'), 'a', 0));
    expect(assessComparison(zero, PAIR).issues).toContain('NONPOSITIVE_OBSERVATION');
    const horizon = producer(config('manual-pull'), 'a');
    expect(assessComparison(archive(matched().runs[0], horizon), PAIR).issues).toContain('END_REASON_MISMATCH');
  });
  it('valid lifecycle port accounting is not producer-compatible evidence when envelopes are absent', () => {
    const port: any = clone(matched().runs[1]);
    port.history.events = port.history.events.filter((e: any) => e.kind !== 'commandAccepted').map((e: any, i: number) => ({ ...e, seq: i + 1 }));
    expect(validateSnapshot(port).ok).toBe(true);
    expect(inspectProducerCompatibility(port).ok).toBe(false);
    const r = assessComparison(archive(matched().runs[0], port), PAIR);
    expect(r.kind).toBe('unmatched'); expect(r.issues).toContain('SUBJECT_PRODUCER_INCOMPATIBLE');
    expect(r.evidence).toBe('not-established');
  });
  it('coherent forged ready times pass accounting but fail producer matching', () => {
    const c = config('manual-pull');
    const a = producer(c, 'a', [
      { atMs: 0, command: { kind: 'admit', orderKey: 'order-1' } },
      { atMs: 0, command: { kind: 'move', orderKey: 'order-1', to: 'prep' } },
      { atMs: 40000, command: { kind: 'end', reason: 'manual-stop' } },
    ], 40000);
    const forged: any = clone(a); forged.history.events.find((e: any) => e.kind === 'ready').atMs = 29999;
    expect(validateSnapshot(forged).ok).toBe(true); expect(inspectProducerCompatibility(forged).ok).toBe(false);
    const b = producer(config('interval-push'), 'b', [{ atMs: 40000, command: { kind: 'end', reason: 'manual-stop' } }], 40000);
    expect(assessComparison(archive(b, forged), PAIR).issues).toContain('SUBJECT_PRODUCER_INCOMPATIBLE');
  });
  it.each([
    ['physical-capacity', (s: any) => { s.config.resources.occupancy.oven = 4; }, 'INVALID_RESOURCES'],
    ['processing', (s: any) => { s.config.resources.processing.prep = { kind: 'fixed', slots: 2 }; }, 'INVALID_RESOURCES'],
    ['clock', (s: any) => { s.config.clockRulesVersion = 'unknown'; }, 'UNSUPPORTED_VERSION'],
    ['engine', (s: any) => { s.config.engineVersion = 'unknown'; }, 'UNSUPPORTED_VERSION'],
    ['scoring', (s: any) => { s.config.scoringVersion = 'unknown'; }, 'UNSUPPORTED_VERSION'],
    ['policy-cap', (s: any) => { s.config.policy.wip.oven = 4; }, 'INVALID_POLICY'],
    ['unknown-version', (s: any) => { s.config.manifest.scenarioVersion = 'unknown'; }, 'UNSUPPORTED_VERSION'],
    ['forged-demand', (s: any) => { s.config.manifest.orders[0].prepMs = 2; }, 'MANIFEST_MISMATCH'],
    ['served-definition', (s: any) => { s.metrics.servedSample.definition = 'orders-to-served/positive-usable/v1'; }, 'SNAPSHOT_MISMATCH'],
    ['unsupported-end', (s: any) => { s.endReason = 'service-bell'; s.history.events.at(-1).reason = 'service-bell'; }, 'UNSUPPORTED_END_REASON'],
  ])('rejects %s at the canonical boundary with precise underlying reason', (_name, mutate, code) => {
    const raw = clone(matched()); mutate(raw.runs[1]);
    const result = assessComparison(raw, PAIR);
    expect(result.kind).toBe('unmatched'); expect(result.issues).toContain('INVALID_ARCHIVE');
    expect(result.details.some(d => d.code === code)).toBe(true);
  });
  it.each([null, undefined, 1, 'yes', [], {}, { ...PAIR, matched: true }, { ...PAIR, declaredPolicyKeys: ['wip'] },
    { ...PAIR, signature: 'equal' }, { ...PAIR, pairId: 'personal label' }, { ...PAIR, requestedBasis: 'best' },
    { ...PAIR, change: { ...PAIR.change!, fields: ['resources'] } }])('unknown pair input fails closed without an exception %#', input => {
    expect(() => assessComparison(matched(), input)).not.toThrow(); expect(assessComparison(matched(), input).kind).toBe('unmatched');
  });
  it.each([null, undefined, 1, [], {}, { schema: 'sof-archive/v1', runs: null }, { ...matched(), match: true }])('unknown archive input fails closed %#', input => {
    expect(() => assessComparison(input, PAIR)).not.toThrow(); expect(assessComparison(input, PAIR).kind).toBe('unmatched');
    expect(() => inspectProducerCompatibility(input)).not.toThrow(); expect(inspectProducerCompatibility(input).ok).toBe(false);
  });
  it('does not mutate/freeze caller objects; deeply owns the assessment, even for hostile accessors', () => {
    const raw = clone(matched()), pair = clone(PAIR), before = clone(raw), originalPair = clone(pair);
    const result = assessComparison(raw, pair);
    expect(raw).toEqual(before); expect(pair).toEqual(originalPair); expect(Object.isFrozen(raw.runs)).toBe(false);
    expect(Object.isFrozen(result.issues)).toBe(true); expect(Object.isFrozen(result.details)).toBe(true);
    pair.pairId = 'later'; raw.runs.length = 0; expect(result.pairId).toBe('pair-1'); expect(result.kind).toBe('matched');
    const hostile = Object.defineProperty({}, 'schema', { get() { throw new Error('bad getter'); } });
    expect(() => assessComparison(hostile, PAIR)).not.toThrow(); expect(() => inspectProducerCompatibility(hostile)).not.toThrow();
    const circular: any = {}; circular.self = circular; expect(assessComparison(circular, PAIR).kind).toBe('unmatched');
  });
});
