import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import SliceOfFlowAuthorCredit from './SliceOfFlowAuthorCredit';
import SliceOfFlowSplash, { type SplashVariant } from './SliceOfFlowSplash';
import { AUTHOR_LINKEDIN_URL, BUILT_BY } from '@/lib/sliceOfFlowBrand';

const visibleText = (html: string) => html.replace(/<[^>]*>/g, '');

describe('author credit across first-visit states', () => {
  it('renders exact readable text with a real name link', () => {
    const html = renderToStaticMarkup(<SliceOfFlowAuthorCredit />);
    expect(visibleText(html)).toBe(BUILT_BY);
    expect(html).toContain(`href="${AUTHOR_LINKEDIN_URL}"`);
    expect(html).not.toContain('aria-hidden');
  });

  it.each<SplashVariant>(['ticket', 'neon', 'pizzabox'])('shows the credit above the %s splash animation', variant => {
    const html = renderToStaticMarkup(<SliceOfFlowSplash variant={variant} onEnter={() => {}} />);
    expect(visibleText(html)).toContain(BUILT_BY);
    expect(html).toContain('data-testid="splash-identity"');
    expect(html.indexOf('data-testid="author-credit"')).toBeLessThan(html.indexOf('</header>'));
    expect(html).toContain('Free to play. No account required.');
    expect(html).not.toContain('MBA');
  });

  it('makes the default stamp a native keyboard-operable button', () => {
    const html = renderToStaticMarkup(<SliceOfFlowSplash onEnter={() => {}} />);
    expect(html).toMatch(/<button type="button"[^>]*>FIRE IT UP!<\/button>/);
  });

  it('publishes the same name link and MHA credentials in initial non-JS HTML', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('name="author" content="Jeff Bourke, MHA, PMP, SAFe RTE"');
    expect(html).toContain('data-testid="initial-identity"');
    expect(html).toContain(`href="${AUTHOR_LINKEDIN_URL}"`);
    expect(visibleText(html)).toContain(BUILT_BY);
    expect(html).not.toContain('maximum-scale=1');
  });
});
