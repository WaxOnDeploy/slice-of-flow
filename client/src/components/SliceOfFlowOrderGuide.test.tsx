import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACTIVE_ORDER_TYPES } from '@/lib/sliceOfFlowOrderTypes';
import SliceOfFlowOrderGuide, { SliceOfFlowOrderGuide as NamedOrderGuide } from './SliceOfFlowOrderGuide';

const textContent = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'");

describe('shared pizza order guide', () => {
  it('renders every active type with its actual size and Prep/Oven times', () => {
    const html = renderToStaticMarkup(<SliceOfFlowOrderGuide />);
    const copy = textContent(html);
    for (const type of ACTIVE_ORDER_TYPES) {
      expect(html).toContain(`<strong class="block">${type.pizzaType}</strong>`);
      expect(copy).toContain(`${type.size} · Prep ${type.prepTime}s · Oven ${type.ovenTime}s`);
    }
    expect(html.match(/<li>/g)).toHaveLength(ACTIVE_ORDER_TYPES.length);
  });

  it('uses a semantic labelled section, a list, a test hook, and readable 16px copy', () => {
    const html = renderToStaticMarkup(<SliceOfFlowOrderGuide />);
    expect(html).toMatch(/<section[^>]*aria-labelledby="[^"]+"[^>]*data-testid="order-guide"/);
    expect(html).toMatch(/<h2[^>]*id="[^"]+"/);
    expect(html).toContain('aria-label="Active pizza types and size rules"');
    expect(html).toContain('font-size:16px');
    expect(html).toContain('min-w-0');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('explains ordinary Large Custom Build and simulated time without VIP or expedited rules', () => {
    const copy = textContent(renderToStaticMarkup(<SliceOfFlowOrderGuide />));
    expect(copy).toContain('Custom Build is an ordinary Large pizza (90s Prep / 80s Oven).');
    expect(copy).toContain('No VIP priority, no extra capacity, and no expedited handling.');
    expect(copy).toContain('All times are simulated kitchen seconds.');
    expect(copy).toContain('Clock speed changes how quickly time passes, not the pizza rules.');
  });

  it('supports Today’s Specials and tutorial integration with either export', () => {
    expect(NamedOrderGuide).toBe(SliceOfFlowOrderGuide);
    const html = renderToStaticMarkup(<SliceOfFlowOrderGuide title="Today's Specials" headingLevel={3} variant="chalkboard" className="mt-4" testId="specials-order-guide" />);
    expect(textContent(html)).toContain("Today's Specials");
    expect(html).toContain('<h3');
    expect(html).toContain('data-testid="specials-order-guide"');
    expect(html).toContain('mt-4');
    expect(html).toContain('background:#2A1508');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="dialog"');
  });
});
