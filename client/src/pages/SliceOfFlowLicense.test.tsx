// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import SliceOfFlowLicense from './SliceOfFlowLicense';
import SliceOfFlowRightsFooter from '@/components/SliceOfFlowRightsFooter';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
function dom(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('Slice of Flow public license', () => {
  it('renders the full repository LICENSE without changing its legal text', () => {
    const source = readFileSync(`${process.cwd()}/LICENSE`, 'utf8');
    const root = dom(renderToStaticMarkup(<SliceOfFlowLicense />));
    const blocks = Array.from(root.querySelector('[data-testid="full-license-text"]')!.children).map(node => node.textContent);
    expect(normalize(blocks.join('\n\n'))).toBe(normalize(source));
  });

  it('has readable ownership, approved contact, free use and separate external permission guidance', () => {
    const root = dom(renderToStaticMarkup(<SliceOfFlowLicense />));
    expect(root.querySelector('h1')?.textContent).toBe('License & Permissions');
    expect(root.textContent).toContain('Jeff Bourke');
    expect(root.textContent).toContain('employee-led internal team workshops');
    expect(root.textContent).toContain('paid or unpaid');
    expect(root.textContent).toContain('does not also grant');
    expect(root.querySelector('a[href="mailto:jeff@thefatalfive.com"]')).not.toBeNull();
  });

  it('does not claim draft contract acceptance or registration and provides a return route', () => {
    const root = dom(renderToStaticMarkup(<SliceOfFlowLicense />));
    expect(root.textContent).toContain('Separate visitor Terms of Use remain a draft');
    expect(root.textContent).toContain('not a copyright or trademark registration');
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(root.querySelector('a[href="/"]')?.textContent).toContain('Back to Slice of Flow');
  });

  it('puts real copyright text and safe new-tab license links outside artwork', () => {
    const root = dom(renderToStaticMarkup(<SliceOfFlowRightsFooter />));
    expect(root.querySelector('footer')?.textContent).toContain('© 2026 Jeff Bourke');
    expect(root.querySelector('img')).toBeNull();
    const link = root.querySelector('a[href="/license"]')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toContain('opens in a new tab');
    expect(root.querySelector('a[href="mailto:jeff@thefatalfive.com"]')?.textContent).toBe('jeff@thefatalfive.com');
  });
});
