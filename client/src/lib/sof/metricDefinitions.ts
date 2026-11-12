import { immutable, isTime } from '../sofEngine/types';

export const SERVED_DEFINITION = 'orders-to-served/nonnegative-elapsed/v1' as const;
export const LEGACY_SERVED_DEFINITION = 'orders-to-served/positive-usable/v1' as const;
export const WIP_BOUNDARY = 'orders-admission-to-terminal-exit/v1' as const;
export const ILLUSTRATION_CAVEAT = 'This is a short-run illustration, not measured served-ticket lead time. Unfinished tickets and discard exits can make the estimate differ from the served-ticket average.';
export const EXIT_RATE_DISTINCTION = 'All-exit rate includes served and discarded tickets; delivery rate counts only served tickets.';
export const METRIC_DEFINITIONS = immutable({
  averageWip: { definition: 'all-active/time-weighted-wip/v1', population: WIP_BOUNDARY,
    unit: 'tickets', observationUnit: 'simulated-seconds', source: 'engine-boundary', denominator: 'positive-observation-duration' },
  deliveryRate: { definition: 'served/observation-minute/v1', population: 'served-only',
    unit: 'served-tickets-per-simulated-minute', source: 'engine-boundary', denominator: 'positive-observation-duration' },
  allExitRate: { definition: 'all-terminal-exits/observation-minute/v1', population: WIP_BOUNDARY,
    unit: 'exits-per-simulated-minute', source: 'engine-boundary', denominator: 'positive-observation-duration' },
  illustration: { definition: 'all-active-area/all-terminal-exits/v1', population: WIP_BOUNDARY,
    unit: 'simulated-seconds', source: 'engine-boundary', denominator: 'positive-duration-and-exit-count', caveat: ILLUSTRATION_CAVEAT },
  measuredServed: { definition: SERVED_DEFINITION, population: 'served-only', unit: 'simulated-seconds',
    source: 'engine-boundary', samplePolicy: 'nonnegative-valid-elapsed', sampleCount: 'actual-timestamp-samples' },
  legacyServed: { definition: LEGACY_SERVED_DEFINITION, population: 'served-only', unit: 'simulated-seconds',
    source: 'legacy-summary', samplePolicy: 'positive-usable-elapsed', sampleCount: 'unknown', observation: 'unknown', history: 'unavailable' },
});
export function hasPositiveObservation(durationMs: unknown): durationMs is number { return isTime(durationMs) && durationMs > 0; }
export function hasServedSamples(n: unknown): n is number { return isTime(n) && n > 0; }
export function hasExitIllustration(durationMs: unknown, exits: unknown): boolean {
  return hasPositiveObservation(durationMs) && isTime(exits) && exits > 0;
}
export function isServedElapsedSample(definition: unknown, elapsedMs: unknown): boolean {
  return isTime(elapsedMs) && (definition === SERVED_DEFINITION || (definition === LEGACY_SERVED_DEFINITION && elapsedMs > 0));
}
/** Definition compatibility only; this does NOT assess matched runs or grant a comparison badge. */
export function compatibleServedDefinitions(a: unknown, b: unknown): boolean {
  return (a === SERVED_DEFINITION || a === LEGACY_SERVED_DEFINITION) && a === b;
}
