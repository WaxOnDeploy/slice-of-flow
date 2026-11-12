import { describe, expect, it, vi } from 'vitest';
import {
  SCORE_SERVED,
  SCORE_BURNT,
  SCORE_ANGRY,
  SCORE_ZERO_BURNS_BONUS,
} from './sliceOfFlowConstants';
import { getScoringCopy, getZeroBurnBonusCopy } from './sliceOfFlowScoringCopy';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

describe('scoring explanation copy', () => {
  it('uses the existing signed constants and states the bonus condition', () => {
    expect(getScoringCopy()).toEqual({
      heading: 'How scoring works',
      formula: `${signed(SCORE_SERVED)} per pizza served · ${signed(SCORE_BURNT)} per burnt pizza · ${signed(SCORE_ANGRY)} per angry customer.`,
      bonusRule: `Zero-burn bonus: ${signed(SCORE_ZERO_BURNS_BONUS)} only when at least one pizza is served and none are burnt.`,
      customerRule: 'Angry customers include unfinished orders. Customers with burnt pizzas are counted as burnt only, not again as angry.',
    });
  });

  it('follows changed constants rather than hard-coded point values', async () => {
    vi.resetModules();
    vi.doMock('./sliceOfFlowConstants', () => ({
      SCORE_SERVED: 4,
      SCORE_BURNT: -7,
      SCORE_ANGRY: -5,
      SCORE_ZERO_BURNS_BONUS: 9,
    }));
    try {
      const copy = await import('./sliceOfFlowScoringCopy');
      expect(copy.getScoringCopy().formula).toBe('+4 per pizza served · -7 per burnt pizza · -5 per angry customer.');
      expect(copy.getScoringCopy().bonusRule).toBe('Zero-burn bonus: +9 only when at least one pizza is served and none are burnt.');
      expect(copy.getZeroBurnBonusCopy({ served: 1, burnt: 0 })).toBe('+9 zero-burn bonus included.');
    } finally {
      vi.doUnmock('./sliceOfFlowConstants');
      vi.resetModules();
    }
  });

  it.each([1, 3, 12])('notes the bonus when %i pizzas were served with no burns', served => {
    expect(getZeroBurnBonusCopy({ served, burnt: 0 })).toBe(`${signed(SCORE_ZERO_BURNS_BONUS)} zero-burn bonus included.`);
  });

  it.each([
    null,
    { served: 0, burnt: 0 },
    { served: 0, burnt: 1 },
    { served: 1, burnt: 1 },
    { served: 12, burnt: 2 },
  ])('does not claim an included bonus for %j', metrics => {
    expect(getZeroBurnBonusCopy(metrics)).toBeNull();
  });

  it('does not mutate supplied metrics or replace their score', () => {
    const metrics = Object.freeze({ served: 3, burnt: 0, angry: 1, score: 5 });
    expect(getZeroBurnBonusCopy(metrics)).not.toBeNull();
    expect(metrics).toEqual({ served: 3, burnt: 0, angry: 1, score: 5 });
  });
});
