import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_BY, HERO_IMAGE } from '@/lib/sliceOfFlowBrand';

vi.mock('@/lib/sliceOfFlowStore', () => ({ useSliceOfFlowStore: (selector: (state: unknown) => unknown) => selector({ startGame: () => {}, skipToRound2: () => {}, difficulty: 'normal', setDifficulty: () => {} }) }));
import SliceOfFlowLanding from './SliceOfFlowLanding';

describe('approved storefront branding', () => {
  it('uses the exact author line beneath the page title', () => {
    const html = renderToStaticMarkup(<SliceOfFlowLanding />);
    expect(html).toContain(BUILT_BY);
    expect(html.indexOf('</h1>')).toBeLessThan(html.indexOf(BUILT_BY));
    expect(html.indexOf(BUILT_BY)).toBeLessThan(html.indexOf('A Kanban Pizza Shop Simulation'));
  });

  it('shows the complete cartoon illustration instead of an object-cover crop', () => {
    const html = renderToStaticMarkup(<SliceOfFlowLanding />);
    expect(html).toContain(HERO_IMAGE);
    expect(html).toContain('with Jeff Bourke as one of the kitchen chefs');
    expect(html).toContain('class="block w-full h-auto"');
    expect(html).not.toContain('object-cover');
  });

  it('puts the device guidance before the Start control', () => {
    const html = renderToStaticMarkup(<SliceOfFlowLanding />);
    expect(html.indexOf('Best on a laptop or tablet')).toBeLessThan(html.indexOf('Open the Kitchen'));
  });
});
