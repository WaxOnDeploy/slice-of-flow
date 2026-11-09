import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTY_PRESETS, type Difficulty } from '@/lib/sliceOfFlowConstants';
import { ACTIVE_ORDER_TYPES } from '@/lib/sliceOfFlowOrderTypes';

const mock = vi.hoisted(() => ({
  step: 0,
  difficulty: 'normal' as Difficulty,
  startRound: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: () => [mock.step, vi.fn()] };
});
vi.mock('@/lib/sliceOfFlowStore', () => ({
  useSliceOfFlowStore: () => ({ round1Metrics: null, difficulty: mock.difficulty, startRound: mock.startRound }),
}));
import SliceOfFlowTransition from './SliceOfFlowTransition';

const renderTransition = () => renderToStaticMarkup(<SliceOfFlowTransition />);
const textContent = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'");

beforeEach(() => {
  mock.step = 0;
  mock.difficulty = 'normal';
  mock.startRound.mockClear();
});

describe('Round 2 pre-play order introduction', () => {
  it('renders the complete guide on step 3 before the Start Round 2 action', () => {
    mock.step = 2;
    const html = renderTransition();
    const copy = textContent(html);
    expect(copy).toContain('Your New WIP Limits');
    expect(html).toContain('data-testid="transition-order-guide"');
    expect(html).toMatch(/<h2[^>]*>Same menu, a fresh round<\/h2>/);
    for (const type of ACTIVE_ORDER_TYPES) expect(copy).toContain(type.pizzaType);
    expect(copy).toContain('Custom Build is an ordinary Large pizza (90s Prep / 80s Oven).');
    expect(copy).toContain('No VIP priority, no extra capacity, and no expedited handling.');
    expect(html.indexOf('data-testid="transition-order-guide"')).toBeLessThan(html.indexOf('Start Round 2'));
    expect(html.indexOf('data-testid="transition-kitchen-time"')).toBeLessThan(html.indexOf('Start Round 2'));
    expect(mock.startRound).not.toHaveBeenCalled();
  });

  it.each([0, 1])('does not create an extra popup or start play on earlier step %s', step => {
    mock.step = step;
    const html = renderTransition();
    expect(html).not.toContain('data-testid="transition-order-guide"');
    expect(html).not.toContain('Start Round 2');
    expect(html).toContain('Next →');
    expect(html).not.toContain('role="dialog"');
    expect(mock.startRound).not.toHaveBeenCalled();
  });

  it.each(['easy', 'normal', 'hard'] as const)('labels %s Round 2 duration as simulated kitchen time', difficulty => {
    mock.step = 2;
    mock.difficulty = difficulty;
    const copy = textContent(renderTransition());
    expect(copy).toContain(`Round 2 has ${Math.floor(DIFFICULTY_PRESETS[difficulty].roundDuration / 60)} simulated kitchen minutes, not real-time minutes.`);
    expect(copy).toContain('Clock speed controls how quickly they pass; pizza sizes and times stay the same.');
    expect(mock.startRound).not.toHaveBeenCalled();
  });
});
