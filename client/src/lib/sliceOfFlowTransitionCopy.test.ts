import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PRESETS, type Difficulty } from './sliceOfFlowConstants';
import {
  formatTransitionAvgLeadTime,
  getRound1OrderArrivalCopy,
  getRound1Reflection,
  KANBAN_PRACTICES_INTRO,
} from './sliceOfFlowTransitionCopy';

const missingBaselineCopy =
  'No Round 1 baseline is available. Explore how controlling the flow works in Round 2.';

describe('getRound1Reflection', () => {
  it.each([0, 1])('acknowledges few orders when %i were served', (served) => {
    expect(getRound1Reflection({ served })).toBe(
      'Few orders got through. That’s what overload looks like.',
    );
  });

  it.each([2, 12])('uses neutral comparison copy when %i were served', (served) => {
    expect(getRound1Reflection({ served })).toBe(
      'You have a baseline. Compare what changes when you control the flow in Round 2.',
    );
  });

  it.each([null, undefined, {}, { avgLeadTime: 90 }])(
    'does not invent observations for a missing baseline: %j',
    (baseline) => {
      expect(getRound1Reflection(baseline)).toBe(missingBaselineCopy);
    },
  );

  it.each([-1, 0.5, NaN, Infinity, -Infinity])(
    'does not treat an invalid served count (%s) as an observed result',
    (served) => {
      expect(getRound1Reflection({ served })).toBe(missingBaselineCopy);
    },
  );
});

describe('formatTransitionAvgLeadTime', () => {
  it('shows n/a when no orders were served, even with a positive lead time', () => {
    expect(formatTransitionAvgLeadTime({ served: 0, avgLeadTime: 90 })).toBe('n/a');
  });

  it.each([null, undefined, {}, { served: 1 }, { avgLeadTime: 90 }])(
    'shows n/a for missing metrics: %j',
    (baseline) => {
      expect(formatTransitionAvgLeadTime(baseline)).toBe('n/a');
    },
  );

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'shows n/a for invalid or nonpositive average lead time: %s',
    (avgLeadTime) => {
      expect(formatTransitionAvgLeadTime({ served: 1, avgLeadTime })).toBe('n/a');
    },
  );

  it.each([-1, 0.5, NaN, Infinity, -Infinity])(
    'shows n/a for an invalid served count: %s',
    (served) => {
      expect(formatTransitionAvgLeadTime({ served, avgLeadTime: 90 })).toBe('n/a');
    },
  );

  it.each([
    { served: 1, avgLeadTime: 59, expected: '0:59' },
    { served: 1, avgLeadTime: 60, expected: '1:00' },
    { served: 2, avgLeadTime: 90.9, expected: '1:30' },
    { served: 2, avgLeadTime: 125, expected: '2:05' },
  ])('formats valid lead time as $expected', ({ served, avgLeadTime, expected }) => {
    expect(formatTransitionAvgLeadTime({ served, avgLeadTime })).toBe(expected);
  });
});

describe('transition teaching copy', () => {
  it.each(['easy', 'normal', 'hard'] satisfies Difficulty[])(
    'uses the selected %s difficulty interval in simulated seconds',
    (difficulty) => {
      expect(getRound1OrderArrivalCopy(difficulty)).toBe(
        `Orders came in every ${DIFFICULTY_PRESETS[difficulty].orderFlipInterval} simulated seconds whether you were ready or not.`,
      );
    },
  );

  it('introduces four core practices without claiming a complete set of principles', () => {
    expect(KANBAN_PRACTICES_INTRO).toBe("Here are four core practices you'll use in Round 2:");
    expect(KANBAN_PRACTICES_INTRO).not.toContain('four principles');
  });
});
