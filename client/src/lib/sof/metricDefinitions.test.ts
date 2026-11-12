import { describe, expect, it } from 'vitest';
import {
  compatibleServedDefinitions, hasExitIllustration, hasPositiveObservation, hasServedSamples,
  isServedElapsedSample, LEGACY_SERVED_DEFINITION, METRIC_DEFINITIONS, SERVED_DEFINITION,
} from './metricDefinitions';

describe('explicit measured/legacy definitions', () => {
  it('keeps valid zero elapsed measured samples while legacy remains positive usable', () => {
    expect(isServedElapsedSample(SERVED_DEFINITION, 0)).toBe(true);
    expect(isServedElapsedSample(LEGACY_SERVED_DEFINITION, 0)).toBe(false);
    expect(isServedElapsedSample(SERVED_DEFINITION, 1)).toBe(true);
    expect(isServedElapsedSample(LEGACY_SERVED_DEFINITION, 1)).toBe(true);
    for (const invalid of [null, -1, 0.1, Infinity, NaN, '1']) expect(isServedElapsedSample(SERVED_DEFINITION, invalid)).toBe(false);
    expect(isServedElapsedSample('arbitrary', 1)).toBe(false);
  });
  it('does not silently compare incompatible definitions or grant matched status', () => {
    expect(compatibleServedDefinitions(SERVED_DEFINITION, SERVED_DEFINITION)).toBe(true);
    expect(compatibleServedDefinitions(LEGACY_SERVED_DEFINITION, LEGACY_SERVED_DEFINITION)).toBe(true);
    expect(compatibleServedDefinitions(SERVED_DEFINITION, LEGACY_SERVED_DEFINITION)).toBe(false);
    expect(compatibleServedDefinitions('invented', 'invented')).toBe(false);
  });
  it('requires positive observation/exits for illustration, actual sample n for served mean', () => {
    expect(hasPositiveObservation(0)).toBe(false); expect(hasPositiveObservation(1)).toBe(true);
    expect(hasServedSamples(0)).toBe(false); expect(hasServedSamples(1)).toBe(true);
    expect(hasExitIllustration(0, 1)).toBe(false); expect(hasExitIllustration(1, 0)).toBe(false);
    expect(hasExitIllustration(1, 1)).toBe(true);
    for (const invalid of [null, -1, 0.1, Infinity, NaN]) expect(hasPositiveObservation(invalid)).toBe(false);
  });
  it('states actual units, all-active versus served-only populations, and unknown legacy evidence', () => {
    expect(METRIC_DEFINITIONS.averageWip.population).toBe('orders-admission-to-terminal-exit/v1');
    expect(METRIC_DEFINITIONS.deliveryRate.population).toBe('served-only');
    expect(METRIC_DEFINITIONS.allExitRate.population).toBe(METRIC_DEFINITIONS.averageWip.population);
    expect(METRIC_DEFINITIONS.measuredServed).toMatchObject({ unit: 'simulated-seconds', source: 'engine-boundary', sampleCount: 'actual-timestamp-samples' });
    expect(METRIC_DEFINITIONS.legacyServed).toMatchObject({ source: 'legacy-summary', sampleCount: 'unknown', observation: 'unknown', history: 'unavailable' });
    expect(Object.isFrozen(METRIC_DEFINITIONS.illustration)).toBe(true);
    expect(JSON.stringify(METRIC_DEFINITIONS)).not.toMatch(/winner|guarantee|stress|improvement|unlimited/);
  });
});
