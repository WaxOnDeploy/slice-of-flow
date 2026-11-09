import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACCESS_SUMMARY, AUTHOR_LINKEDIN_URL, BUILT_BY, getPrivacyDisclosure, HERO_IMAGE } from '@/lib/sliceOfFlowBrand';

vi.mock('@/lib/sliceOfFlowStore', () => ({ useSliceOfFlowStore: (selector: (state: unknown) => unknown) => selector({ startGame: () => {}, skipToRound2: () => {}, difficulty: 'normal', setDifficulty: () => {} }) }));
import SliceOfFlowLanding from './SliceOfFlowLanding';

const renderLanding = () => renderToStaticMarkup(<SliceOfFlowLanding />);
const textContent = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');

describe('approved landing credibility', () => {
  it('uses the exact real-text credit outside and before the hero illustration', () => {
    const html = renderLanding();
    expect(textContent(html)).toContain(BUILT_BY);
    expect(BUILT_BY).toBe('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
    expect(html.indexOf('data-testid="author-credit"')).toBeLessThan(html.indexOf('data-testid="hero-art"'));
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('data-testid="hero-art"'));
    expect(textContent(html)).not.toContain('MBA');
  });

  it('links the name to Jeff’s exact LinkedIn profile with safe new-tab semantics', () => {
    const html = renderLanding();
    expect(html).toContain(`href="${AUTHOR_LINKEDIN_URL}"`);
    expect(html).toMatch(/<a[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Jeff Bourke<\/a>/);
    expect(html).toContain('focus-visible:outline');
  });

  it('shows the complete cartoon illustration instead of an object-cover crop', () => {
    const html = renderLanding();
    expect(html).toContain(HERO_IMAGE);
    expect(html).toContain('with Jeff Bourke as one of the kitchen chefs');
    expect(html).toContain('class="block w-full h-auto"');
    expect(html).not.toContain('object-cover');
  });

  it('makes free access, no account, and game-results upload behavior explicit', () => {
    const html = renderLanding();
    expect(textContent(html)).toContain(ACCESS_SUMMARY);
    expect(html.indexOf('data-testid="access-summary"')).toBeLessThan(html.indexOf('data-testid="hero-art"'));
    expect(textContent(html)).not.toMatch(/no data collected|100% private|nothing leaves your browser/i);
  });

  it('provides a native accessible privacy disclosure with storage and third-party caveats', () => {
    const html = renderLanding();
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(textContent(html)).toContain('Privacy & browser storage');
    expect(textContent(html)).toContain('browser-only storage flags');
    expect(textContent(html)).toContain('may keep request logs');
  });

  it.each([false, true])('keeps the analytics disclosure truthful for configured=%s', configured => {
    const copy = getPrivacyDisclosure(configured);
    expect(copy).toContain(configured ? 'Optional usage analytics is configured' : 'No usage analytics is configured');
    expect(copy).toContain('until you choose Share');
    expect(copy).toContain('Hosting, Google Fonts, and image/CDN providers');
  });

  it('keeps the exact mobile note before the Start control', () => {
    const html = renderLanding();
    expect(textContent(html)).toContain('Best on a laptop or tablet.');
    expect(html.indexOf('Best on a laptop or tablet.')).toBeLessThan(html.indexOf('Open the Kitchen'));
  });

  it('contains no unapproved evidence, testimonial, or book promotion', () => {
    const copy = textContent(renderLanding());
    expect(copy).not.toMatch(/trusted by|used by \d|\d+ teams have|testimonial|endorsed by/i);
    expect(copy).not.toContain('The Fatal Five');
  });

  it('stacks difficulty cards and constrains action widths on phones', () => {
    const html = renderLanding();
    expect(html).toContain('grid-cols-1 sm:grid-cols-3');
    expect(html).toContain('w-full sm:w-auto max-w-full');
  });
});
