import { DIFFICULTY_PRESETS, type Difficulty, type RoundMetrics } from './sliceOfFlowConstants';

type TransitionBaseline = Partial<Pick<RoundMetrics, 'served' | 'avgLeadTime'>>;

export const KANBAN_PRACTICES_INTRO = "Here are four core practices you'll use in Round 2:";

const MISSING_BASELINE_REFLECTION =
  'No Round 1 baseline is available. Explore how controlling the flow works in Round 2.';

function hasValidServedCount(served: number | undefined): served is number {
  return typeof served === 'number' && Number.isInteger(served) && served >= 0;
}

export function getRound1Reflection(baseline?: TransitionBaseline | null): string {
  const served = baseline?.served;
  if (!hasValidServedCount(served)) return MISSING_BASELINE_REFLECTION;

  return served < 2
    ? 'Few orders got through. That’s what overload looks like.'
    : 'You have a baseline. Compare what changes when you control the flow in Round 2.';
}

export function getRound1OrderArrivalCopy(difficulty: Difficulty): string {
  const interval = DIFFICULTY_PRESETS[difficulty].orderFlipInterval;
  return `Orders came in every ${interval} simulated seconds whether you were ready or not.`;
}

export function formatTransitionAvgLeadTime(baseline?: TransitionBaseline | null): string {
  const served = baseline?.served;
  const seconds = baseline?.avgLeadTime;
  if (
    !hasValidServedCount(served) || served === 0 ||
    typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0
  ) {
    return 'n/a';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
