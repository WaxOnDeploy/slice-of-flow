import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACCESS_SUMMARY, AUTHOR_LINKEDIN_URL, BUILT_BY, getPrivacyDisclosure, HERO_IMAGE } from '@/lib/sliceOfFlowBrand';
import { DIFFICULTY_PRESETS, type Difficulty } from '@/lib/sliceOfFlowConstants';
import { ACTIVE_ORDER_TYPES } from '@/lib/sliceOfFlowOrderTypes';

const mock = vi.hoisted(() => ({
  difficulty: 'normal' as Difficulty,
  showFacilitatorGuide: false,
  tutorialSeen: false,
  startGame: vi.fn(),
  skipToRound2: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: () => [mock.showFacilitatorGuide, vi.fn()] };
});
vi.mock('@/lib/sliceOfFlowStore', () => ({
  useSliceOfFlowStore: (selector: (state: unknown) => unknown) => selector({
    startGame: mock.startGame,
    skipToRound2: mock.skipToRound2,
    difficulty: mock.difficulty,
    setDifficulty: () => {},
    tutorialSeen: mock.tutorialSeen,
  }),
}));
import SliceOfFlowLanding from './SliceOfFlowLanding';

const renderLanding = () => renderToStaticMarkup(<SliceOfFlowLanding />);
const textContent = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');

beforeEach(() => {
  mock.difficulty = 'normal';
  mock.showFacilitatorGuide = false;
  mock.tutorialSeen = false;
  mock.startGame.mockClear();
  mock.skipToRound2.mockClear();
});

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

describe('pre-play pizza order introduction', () => {
  it.each([false, true])('is always visible before both play paths when tutorialSeen=%s', tutorialSeen => {
    mock.tutorialSeen = tutorialSeen;
    const html = renderLanding();
    const copy = textContent(html);
    const guideIndex = html.indexOf('data-testid="landing-order-guide"');
    expect(guideIndex).toBeGreaterThan(-1);
    expect(html).toMatch(/<h2[^>]*>Meet today&#x27;s orders<\/h2>/);
    expect(guideIndex).toBeLessThan(html.indexOf('Open the Kitchen'));
    expect(guideIndex).toBeLessThan(html.indexOf('Skip to Round 2'));
    for (const type of ACTIVE_ORDER_TYPES) expect(copy).toContain(type.pizzaType);
    expect(copy).toContain('Custom Build is an ordinary Large pizza (90s Prep / 80s Oven).');
    expect(copy).toContain('No VIP priority, no extra capacity, and no expedited handling.');
    expect(html).not.toContain('role="dialog"');
    expect(mock.startGame).not.toHaveBeenCalled();
    expect(mock.skipToRound2).not.toHaveBeenCalled();
  });

  it.each(['easy', 'normal', 'hard'] as const)('separates %s preset kitchen duration from default clock speed', difficulty => {
    mock.difficulty = difficulty;
    const html = renderLanding();
    const preset = DIFFICULTY_PRESETS[difficulty];
    const copy = textContent(html);
    expect(copy).toContain(`${preset.label}: ${Math.floor(preset.roundDuration / 60)} simulated kitchen minutes per round. Default clock speed is ${preset.defaultSpeed}x`);
    expect(copy).toContain(`${preset.defaultSpeed} kitchen seconds pass per real second.`);
    expect(html.indexOf('data-testid="landing-kitchen-time"')).toBeLessThan(html.indexOf('Open the Kitchen'));
    expect(copy).not.toContain('4minutes');
    expect(copy).not.toContain('Total time: ~8 minutes');
  });

  it.each(['easy', 'normal', 'hard'] as const)('derives %s facilitator round labels from the preset without real-time promises', difficulty => {
    mock.showFacilitatorGuide = true;
    mock.difficulty = difficulty;
    const copy = textContent(renderLanding());
    const minutes = Math.floor(DIFFICULTY_PRESETS[difficulty].roundDuration / 60);
    expect(copy).toContain(`Round 1 — Push (${minutes} simulated kitchen min)`);
    expect(copy).toContain(`Round 2 — Pull + WIP (${minutes} simulated kitchen min)`);
    expect(copy).toContain('allow extra real time for discussion and pauses.');
    expect(copy).not.toContain('Total time: ~8 minutes');
  });
});
