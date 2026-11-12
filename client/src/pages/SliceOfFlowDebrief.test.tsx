import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RoundMetrics } from '@/lib/sliceOfFlowConstants';
import { getScoringCopy, getZeroBurnBonusCopy } from '@/lib/sliceOfFlowScoringCopy';

const fixtures = vi.hoisted(() => ({ r1: null as RoundMetrics | null, r2: null as RoundMetrics | null }));
vi.mock('@/lib/sliceOfFlowStore', () => ({ useSliceOfFlowStore: () => ({ round1Metrics: fixtures.r1, round2Metrics: fixtures.r2, resetGame: () => {}, difficulty: 'normal' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
import SliceOfFlowDebrief from './SliceOfFlowDebrief';

const metric = (values: Partial<RoundMetrics> = {}): RoundMetrics => ({ served: 3, burnt: 1, angry: 0, avgLeadTime: 100, stillInProgress: 1, score: 1, ...values });
const render = () => renderToStaticMarkup(<SliceOfFlowDebrief />);

beforeEach(() => { fixtures.r1 = metric(); fixtures.r2 = metric(); });

describe('results view regressions', () => {
  it.each([0, -2])('renders neutral n/a for a zero-delivery baseline with score %i', score => {
    fixtures.r1 = metric({ served: 0, avgLeadTime: 0, score });
    fixtures.r2 = metric({ served: 4, burnt: 0, avgLeadTime: 128, score: 7 });
    const html = render();
    expect(html).toMatch(/data-testid="score-improvement"[^>]*color:#666[^>]*>n\/a</);
    expect(html).toMatch(/data-testid="lead-time-change"[^>]*color:#666[^>]*>n\/a</);
    expect(html).not.toContain('+0%');
    expect(html).not.toContain('+2:08');
  });

  it.each([0, NaN, Infinity])('keeps missing/invalid lead-time comparisons neutral (%s)', avgLeadTime => {
    fixtures.r2 = metric({ avgLeadTime });
    expect(render()).toMatch(/data-testid="lead-time-change"[^>]*color:#666[^>]*>n\/a</);
  });

  it('preserves the single-round view without fictitious improvement claims', () => {
    fixtures.r1 = null;
    fixtures.r2 = metric({ served: 0, avgLeadTime: 0, score: 0 });
    const html = render();
    expect(html).toContain('Round 1 was skipped');
    expect(html).not.toContain('data-testid="score-improvement"');
    expect(html).toContain('Reflect on Service Outcomes');
    expect(html).not.toContain('Pull Systems Beat Push');
    expect(html).not.toContain('Flow proves');
    expect(html).toContain('n/a');
  });

  it('does not fabricate a zero-score result for an uncompleted Round 2', () => {
    fixtures.r2 = null;
    expect(render()).toContain('No Round 2 results yet');
    expect(render()).not.toContain('What Did We Learn?');
    expect(render()).not.toContain('How scoring works');
  });

  it('shows only supported observations for mixed results', () => {
    fixtures.r1 = metric({ served: 3, burnt: 2, angry: 0, avgLeadTime: 100 });
    fixtures.r2 = metric({ served: 2, burnt: 1, angry: 0, avgLeadTime: 120 });
    const html = render();
    expect(html).toContain('Fewer Burnt Pizzas');
    expect(html).toContain('Reflect on Service Outcomes');
    expect(html).toContain('Reflect on Completed Lead Time');
    expect(html).not.toContain('More Served, Fewer Burnt Pizzas');
  });

  it.each(['full', 'skip'] as const)('prints the exact approved author credentials as accessible HTML in the %s view', view => {
    if (view === 'skip') fixtures.r1 = null;
    expect(render()).toContain('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
  });
});

describe('How scoring works in both results views', () => {
  it.each(['full', 'skip'] as const)('renders one accessible, readable explanation in the %s view', view => {
    if (view === 'skip') fixtures.r1 = null;
    const html = render();
    const copy = getScoringCopy();
    const section = html.match(/<section aria-labelledby="([^"]+)"[^>]*>[\s\S]*?<\/section>/);
    expect(section).not.toBeNull();
    const explanation = section![0];
    expect(explanation).toContain(`id="${section![1]}"`);
    expect(explanation).toMatch(/<h2[^>]*font-size:20px[^>]*>How scoring works<\/h2>/);
    expect(explanation).toMatch(/<p[^>]*font-size:16px[^>]*>/);
    expect(explanation).toContain(copy.formula);
    expect(explanation).toContain(copy.bonusRule);
    expect(explanation).toContain(copy.customerRule);
    expect(html.match(/How scoring works/g)).toHaveLength(1);
    expect(html.indexOf(explanation)).toBeGreaterThan(html.indexOf(view === 'skip' ? 'Round 2 — Pull + WIP' : 'Round 2 — Pull'));
    expect(html).toContain('Share Results');
    expect(html).toContain(view === 'skip' ? 'Play Full Game' : 'Play Again');
    if (view === 'skip') {
      expect(html).toContain('Round 1 was skipped');
      expect(html).not.toContain('data-testid="score-improvement"');
      expect(explanation).not.toContain('Round 1:');
    } else {
      expect(html).toContain('data-testid="score-improvement"');
      expect(html).toContain('Side-by-Side');
    }
  });

  for (const view of ['full', 'skip'] as const) {
    it.each([
      { served: 0, burnt: 0, included: false },
      { served: 0, burnt: 1, included: false },
      { served: 1, burnt: 1, included: false },
      { served: 1, burnt: 0, included: true },
    ])(`only claims Round 2's zero-burn bonus when earned in the ${view} view (%j)`, ({ served, burnt, included }) => {
      if (view === 'skip') fixtures.r1 = null;
      fixtures.r2 = metric({ served, burnt });
      const html = render();
      if (included) {
        expect(html).toContain(`Round 2: ${getZeroBurnBonusCopy(fixtures.r2)}`);
      } else {
        expect(html).not.toContain('zero-burn bonus included.');
      }
      // The conditional rule stays visible even when no bonus was earned.
      expect(html).toContain(getScoringCopy().bonusRule);
    });
  }

  it('labels the bonus independently for both eligible completed rounds without changing scores', () => {
    fixtures.r1 = metric({ served: 2, burnt: 0, score: 5 });
    fixtures.r2 = metric({ served: 3, burnt: 0, score: 6 });
    const before = JSON.stringify(fixtures);
    const html = render();
    expect(html).toContain(`Round 1: ${getZeroBurnBonusCopy(fixtures.r1)}`);
    expect(html).toContain(`Round 2: ${getZeroBurnBonusCopy(fixtures.r2)}`);
    expect(html).toMatch(/data-testid="score-improvement"[^>]*>\+20%</);
    expect(JSON.stringify(fixtures)).toBe(before);
  });

  it('does not claim a Round 1 bonus from Round 2 results alone', () => {
    fixtures.r1 = metric({ served: 0, burnt: 0, score: 0 });
    fixtures.r2 = metric({ served: 1, burnt: 0, score: 4 });
    const html = render();
    expect(html).not.toContain('Round 1:');
    expect(html).toContain(`Round 2: ${getZeroBurnBonusCopy(fixtures.r2)}`);
  });
});
