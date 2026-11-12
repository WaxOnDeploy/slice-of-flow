import { assessComparison, type MatchAssessment } from '../sofEngine/matchedRuns';
import { getRun } from '../sofEngine/runSnapshots';
import { immutable, type DeepReadonly, type FinalRunSnapshot } from '../sofEngine/types';
import { measureTimeWeightedWip } from '../flow/sof018Metrics';
import {
  compatibleServedDefinitions, EXIT_RATE_DISTINCTION, ILLUSTRATION_CAVEAT, METRIC_DEFINITIONS,
  SERVED_DEFINITION, WIP_BOUNDARY,
} from '../sof/metricDefinitions';

export type ComparisonMetric = 'served' | 'burnt' | 'otherDiscard' | 'angry' | 'stillInProgress' |
  'deliveryRate' | 'allExitRate' | 'averageWip' | 'measuredServed' | 'illustration';
export type UnavailableReason = 'missing-run' | 'invalid-run' | 'zero-duration' | 'no-served-samples' |
  'zero-exits' | 'incompatible-definition' | 'overflow';
export type Reading = DeepReadonly<{
  value: number | null; unavailable: UnavailableReason | null; unit: string; definition: string;
  population: string; source: 'engine-boundary' | null;
  observation: FinalRunSnapshot['observation'] | null; sampleCount: number | null; sampleSumSimSec: number | null;
}>;
export type ComparisonRow = DeepReadonly<{
  metric: ComparisonMetric; baseline: Reading; subject: Reading; delta: number | null;
  relation: 'higher' | 'lower' | 'equal' | 'unavailable';
  metricOutcome: 'favorable' | 'adverse' | 'equal' | 'descriptive' | 'unavailable';
}>;
export type RunMetadata = DeepReadonly<{
  runId: string; source: 'engine-boundary'; validation: 'independent-accounting';
  scenarioVersion: string; generatorVersion: string; difficulty: FinalRunSnapshot['config']['manifest']['difficulty'];
  policy: FinalRunSnapshot['config']['policy']; plannedHorizonMs: number;
  observation: FinalRunSnapshot['observation']; endReason: FinalRunSnapshot['endReason'];
  servedDefinition: typeof SERVED_DEFINITION; measuredServedSampleCount: number; measuredServedSumSimSec: number;
}>;
export type TwoRunComparison = DeepReadonly<{
  schema: 'sof-two-run-comparison/v1'; assessment: MatchAssessment;
  baseline: RunMetadata | null; subject: RunMetadata | null; rows: ComparisonRow[];
  directionPattern: 'equal' | 'mixed' | 'higher-only' | 'lower-only' | 'missing';
  interpretation: 'descriptive-only'; humanPlay: 'not-established';
  illustrationCaveat: string; exitRateDistinction: string;
}>;

const specs: Readonly<Record<ComparisonMetric, { unit: string; definition: string; population: string; favorable: 'higher' | 'lower' | null }>> = {
  served: { unit: 'tickets', definition: 'served/run-total/v1', population: 'served-only', favorable: 'higher' },
  burnt: { unit: 'tickets', definition: 'burnt/run-total/v1', population: 'burnt-only', favorable: 'lower' },
  otherDiscard: { unit: 'tickets', definition: 'manual-discard/run-total/v1', population: 'manual-discard-only', favorable: null },
  angry: { unit: 'recorded-customers', definition: 'angry-nonburnt-admitted/run-total/v1', population: 'admitted-angry-nonburnt', favorable: 'lower' },
  stillInProgress: { unit: 'tickets', definition: 'active/observation-end/v1', population: WIP_BOUNDARY, favorable: null },
  deliveryRate: { ...METRIC_DEFINITIONS.deliveryRate, favorable: 'higher' },
  allExitRate: { ...METRIC_DEFINITIONS.allExitRate, favorable: null },
  averageWip: { ...METRIC_DEFINITIONS.averageWip, favorable: null },
  measuredServed: { ...METRIC_DEFINITIONS.measuredServed, favorable: 'lower' },
  illustration: { ...METRIC_DEFINITIONS.illustration, favorable: null },
};
const KEYS = Object.keys(specs) as ComparisonMetric[];
function metadata(s: FinalRunSnapshot | null): RunMetadata | null {
  if (s === null) return null;
  return immutable({ runId: s.runId, source: s.history.source, validation: 'independent-accounting',
    scenarioVersion: s.config.manifest.scenarioVersion, generatorVersion: s.config.manifest.generatorVersion,
    difficulty: s.config.manifest.difficulty, policy: s.config.policy, plannedHorizonMs: s.config.manifest.horizonMs,
    observation: s.observation, endReason: s.endReason, servedDefinition: s.metrics.servedSample.definition,
    measuredServedSampleCount: s.metrics.servedSample.n, measuredServedSumSimSec: s.metrics.servedSample.sumSimMs / 1000 });
}
function readings(snapshot: FinalRunSnapshot | null, missing: UnavailableReason): Record<ComparisonMetric, Reading> {
  const summary = snapshot === null ? null : measureTimeWeightedWip(snapshot);
  const result = {} as Record<ComparisonMetric, Reading>;
  for (const key of KEYS) {
    const spec = specs[key];
    let value: number | null = null, unavailable: UnavailableReason | null = missing;
    if (snapshot !== null && summary?.ok) {
      const w = summary.value;
      const values: Record<ComparisonMetric, number | null> = {
        served: snapshot.metrics.served, burnt: snapshot.metrics.burnt, angry: snapshot.metrics.angry,
        otherDiscard: w.otherDiscardCount, stillInProgress: snapshot.metrics.stillInProgress,
        deliveryRate: w.deliveryRatePerSimMinute, allExitRate: w.allExitRatePerSimMinute,
        averageWip: w.averageWip, measuredServed: w.measuredOrdersToServedSimSec,
        illustration: w.illustrativeOrdersToExitSimSec,
      };
      value = values[key]; unavailable = null;
      if (value === null) unavailable = key === 'measuredServed' ? 'no-served-samples' :
        snapshot.observation.durationMs === 0 ? 'zero-duration' : 'zero-exits';
      if (value !== null && !Number.isFinite(value)) { value = null; unavailable = 'overflow'; }
    }
    result[key] = immutable({ value, unavailable, unit: spec.unit, definition: spec.definition, population: spec.population,
      source: snapshot?.history.source ?? null, observation: snapshot?.observation ?? null,
      sampleCount: key === 'measuredServed' ? snapshot?.metrics.servedSample.n ?? null : null,
      sampleSumSimSec: key === 'measuredServed' && snapshot !== null ? snapshot.metrics.servedSample.sumSimMs / 1000 : null });
  }
  return result;
}

/** Explicit retained pair only. Calls the sole assessor ONCE, and never independently labels
 * a pair matched. Numbers in contextual/unmatched pairs remain descriptive and noncausal.
 * No UI strings, winner, score percentage, rounding, legacy reconstruction or five-round dashboard.
 */
export function compareTwoRuns(archive: unknown, explicitPair: unknown): TwoRunComparison {
  const assessment = assessComparison(archive, explicitPair);
  let baseline: FinalRunSnapshot | null = null, subject: FinalRunSnapshot | null = null;
  let baselineMissing: UnavailableReason = 'missing-run', subjectMissing: UnavailableReason = 'missing-run';
  try {
    const invalidSelection = assessment.issues.includes('SELF_PAIR') || assessment.issues.includes('INVALID_PAIR');
    if (invalidSelection) { baselineMissing = 'invalid-run'; subjectMissing = 'invalid-run'; }
    if (!invalidSelection && assessment.baselineRunId !== null) {
      const b = getRun(archive, assessment.baselineRunId);
      if (b.ok) baseline = b.value; else baselineMissing = 'invalid-run';
    }
    if (!invalidSelection && assessment.subjectRunId !== null) {
      const a = getRun(archive, assessment.subjectRunId);
      if (a.ok) subject = a.value; else subjectMissing = 'invalid-run';
    }
  } catch { baseline = null; subject = null; baselineMissing = 'invalid-run'; subjectMissing = 'invalid-run'; }
  const bs = readings(baseline, baselineMissing), as = readings(subject, subjectMissing);
  const rows = KEYS.map(metric => {
    const b = bs[metric], a = as[metric];
    const compatible = b.unit === a.unit && b.population === a.population && b.definition === a.definition &&
      (metric !== 'measuredServed' || compatibleServedDefinitions(b.definition, a.definition));
    let delta = compatible && b.value !== null && a.value !== null ? a.value - b.value : null;
    if (delta !== null && !Number.isFinite(delta)) delta = null;
    const relation: ComparisonRow['relation'] = delta === null ? 'unavailable' : delta === 0 ? 'equal' : delta > 0 ? 'higher' : 'lower';
    const favorable = specs[metric].favorable;
    const metricOutcome: ComparisonRow['metricOutcome'] = relation === 'unavailable' ? 'unavailable' : relation === 'equal' ? 'equal' :
      favorable === null ? 'descriptive' : relation === favorable ? 'favorable' : 'adverse';
    return immutable({ metric, baseline: b, subject: a, delta, relation, metricOutcome });
  });
  const higher = rows.some(r => r.relation === 'higher'), lower = rows.some(r => r.relation === 'lower');
  const directionPattern = rows.some(r => r.relation === 'unavailable') ? 'missing' :
    higher && lower ? 'mixed' : higher ? 'higher-only' : lower ? 'lower-only' : 'equal';
  return immutable({ schema: 'sof-two-run-comparison/v1', assessment, baseline: metadata(baseline), subject: metadata(subject),
    rows, directionPattern, interpretation: 'descriptive-only', humanPlay: 'not-established',
    illustrationCaveat: ILLUSTRATION_CAVEAT, exitRateDistinction: EXIT_RATE_DISTINCTION });
}
