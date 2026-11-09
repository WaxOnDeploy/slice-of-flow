import {
  SCORE_SERVED,
  SCORE_BURNT,
  SCORE_ANGRY,
  SCORE_ZERO_BURNS_BONUS,
  type RoundMetrics,
} from './sliceOfFlowConstants';

function signedPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

/** Explain the existing rules; do not calculate or replace a round's score. */
export function getScoringCopy() {
  return {
    heading: 'How scoring works',
    formula: `${signedPoints(SCORE_SERVED)} per pizza served · ${signedPoints(SCORE_BURNT)} per burnt pizza · ${signedPoints(SCORE_ANGRY)} per angry customer.`,
    bonusRule: `Zero-burn bonus: ${signedPoints(SCORE_ZERO_BURNS_BONUS)} only when at least one pizza is served and none are burnt.`,
    customerRule: 'Angry customers include unfinished orders. Customers with burnt pizzas are counted as burnt only, not again as angry.',
  };
}

/** A display note only: eligibility mirrors the store's existing bonus rule. */
export function getZeroBurnBonusCopy(
  metrics: Pick<RoundMetrics, 'served' | 'burnt'> | null,
): string | null {
  if (!metrics || !(metrics.served > 0 && metrics.burnt === 0)) return null;
  return `${signedPoints(SCORE_ZERO_BURNS_BONUS)} zero-burn bonus included.`;
}
