import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RoundMetrics } from '@/lib/sliceOfFlowConstants';

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

  it('prints the exact approved author credentials as accessible HTML', () => {
    expect(render()).toContain('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
  });
});
