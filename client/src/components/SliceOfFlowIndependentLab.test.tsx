// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { ILLUSTRATION_CAVEAT } from '@/lib/sof/metricDefinitions';
import SliceOfFlowIndependentLab from './SliceOfFlowIndependentLab';

let root: Root;
let container: HTMLDivElement;
let now = 0;
let hidden = false;
const close = vi.fn();
const archiveChange = vi.fn();
const button = (name: string): HTMLButtonElement => {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === name);
  if (!found) throw new Error(`Missing button: ${name}\n${document.body.textContent}`);
  return found;
};
const flushDialog = async () => { await act(async () => { vi.advanceTimersByTime(0); }); };
// Existing Radix focus scopes defer their own teardown; inactive states must not reschedule.
const settleInactive = async () => { await act(async () => { vi.runAllTimers(); }); };
const click = async (name: string) => { await act(async () => button(name).click()); await flushDialog(); };
const mount = async () => { await act(async () => root.render(<SliceOfFlowIndependentLab difficulty="normal" speed={1} sessionCode="dom-lab" onClose={close} onArchiveChange={archiveChange} />)); };
const start = async () => { await click('Start lab run'); await click('Try the first order'); };
const first = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.sof-lab-ticket')).find(b => b.textContent?.startsWith('Order 1 ·'))!;
const guidedMove = async () => { await act(async () => first().click()); await click('Move selected ticket to Prep'); };
const running = async () => { await start(); await guidedMove(); };
const sample = async (wallMs: number) => {
  now = wallMs;
  await act(async () => { vi.advanceTimersByTime(100); });
};
beforeEach(() => {
  vi.useFakeTimers(); now = 0; hidden = false; close.mockReset(); archiveChange.mockReset();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});
describe('preview-only independent lab', () => {
  it('SSR is inert, default-off and truthful, with exact existing credit and no personal field', () => {
    const html = renderToStaticMarkup(<SliceOfFlowIndependentLab difficulty="hard" speed={3} />);
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('Preview only'); expect(text).toContain('Start lab run');
    expect(text).toContain('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
    expect(text).toContain('not an original-game round or a baseline comparison');
    expect(html).not.toContain('<input'); expect(html).not.toContain('lab-live-score');
    expect(html).not.toContain('optional-round'); expect(html).not.toContain('R3');
  });
  it('mounts no scheduler or active board before explicit Start', async () => {
    await mount(); expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('.sof-lab-stations')).toBeNull();
    await sample(500000); expect(document.querySelector('.sof-lab-stations')).toBeNull();
  });
  it('starts under instruction pause with existing dialog containment and return focus', async () => {
    await mount(); await click('Start lab run');
    const dialog = document.querySelector('[role="dialog"]'); expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(button('Try the first order'));
    expect(document.body.textContent).toContain('Kitchen paused — instructions, first-order guide.');
    expect(button('End lab run').disabled).toBe(true);
    expect(button('Pause lab').disabled).toBe(false);
    await click('Try the first order');
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(first());
    expect(document.body.textContent).toContain('Next destination: Prep');
  });
  it('selects via native Space/Enter button semantics, moves only selected ArrowRight, and keeps Space local', async () => {
    await mount(); await start();
    const unrelated = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.dispatchEvent(unrelated); expect(unrelated.defaultPrevented).toBe(false);
    const ticket = first();
    // jsdom has no trusted native keyboard activation; click models the button's standard activation.
    expect(ticket.tagName).toBe('BUTTON'); expect(ticket.getAttribute('role')).toBeNull();
    await act(async () => ticket.click()); expect(ticket.getAttribute('aria-pressed')).toBe('true');
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    ticket.dispatchEvent(space); expect(space.defaultPrevented).toBe(false);
    await act(async () => ticket.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    expect(document.querySelector('.sof-lab-prep .sof-lab-ticket')).not.toBeNull();
    expect(document.activeElement).toBe(document.querySelector('[data-lab-ticket="order-1"]'));
    expect(document.body.textContent).toContain('Kitchen running.');
    expect(button('Move selected ticket to Oven').disabled).toBe(true);
    expect(document.body.textContent).toContain('Wait for Ready');
  });
  it('keeps Resume reachable, help trapped/returned, and help dismissal preserves facilitator lock', async () => {
    await mount(); await running(); await sample(1000); await click('Pause lab');
    expect(button('Resume lab').disabled).toBe(false); expect(button('End lab run').disabled).toBe(true);
    const opener = button('Help'); await act(async () => opener.focus()); await click('Help');
    expect(document.activeElement).toBe(button('Close help'));
    // Radix prevents programmatic focus from escaping the existing modal primitive.
    await act(async () => button('Resume lab').focus());
    expect(document.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true);
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await flushDialog();
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(opener);
    expect(document.body.textContent).toContain('Kitchen paused — facilitator.');
    await click('Resume lab'); expect(document.body.textContent).toContain('Kitchen running.');
  });
  it('hides all live score aggregates from DOM/accessibility while keeping operations/hazards and final debrief', async () => {
    await mount(); await running(); await click('Hide live scores');
    expect(document.querySelector('[data-testid="lab-live-scores"]')).toBeNull();
    expect(document.querySelector('[data-testid="lab-score-hidden"]')?.textContent).toBe('Live score hidden');
    const text = container.textContent!;
    for (const label of ['Served:', 'Burnt:', 'Angry:', 'Points:']) expect(text).not.toContain(label);
    expect(text).toContain('Kitchen time remaining:'); expect(text).toContain('Orders left to pull:'); expect(text).toContain('Capacity:'); expect(text).toContain('Working:');
    await sample(30000); await click('Move selected ticket to Oven');
    expect(container.textContent).toContain('Burn hazard:'); await sample(70000);
    await click('Move selected ticket to Pizza Box'); await click('Deliver selected ticket');
    now = 80000; await click('End lab run');
    const final = document.querySelector('[aria-label="Actual independent run measurements"]');
    expect(final?.textContent).toContain('80 simulated seconds'); expect(final?.textContent).toContain('engine-boundary');
    expect(final?.textContent).toContain('served sample n = 1'); expect(final?.textContent).toContain('70 simulated seconds');
    expect(final?.textContent).toContain('0.88 tickets'); // display-only rounding; pure test checks exact 0.875
    expect(final?.textContent).toContain('Served / Burnt / Angry / Points');
    expect(final?.textContent).toContain(ILLUSTRATION_CAVEAT);
    expect(final?.textContent).toContain('Orders-to-exit illustration — separate');
  });
  it('score visibility is presentation only and resets on a fresh identity replay', async () => {
    await mount(); await running(); await click('Hide live scores');
    now = 1000; await click('End lab run');
    expect(container.textContent).toContain('dom-lab:run:1');
    expect(container.textContent).toContain('served sample n = 0');
    await click('Replay lab run'); await click('Try the first order');
    expect(document.querySelector('[data-testid="lab-live-scores"]')).not.toBeNull();
    expect(container.textContent).toContain('Kitchen paused — first-order guide.');
    await guidedMove(); now = 2000; await click('End lab run');
    expect(container.textContent).toContain('lab-12345678123412341234:run:2');
  });
  it('hidden tab flushes visible elapsed, return has no catch-up, and facilitator lock survives', async () => {
    await mount(); await running(); now = 2000; hidden = true;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.textContent).toContain('Kitchen time remaining: 238');
    await settleInactive();
    expect(container.textContent).toContain('hidden tab'); expect(vi.getTimerCount()).toBe(0);
    await click('Pause lab'); now = 100000; hidden = false;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.textContent).toContain('Kitchen paused — facilitator.');
    expect(container.textContent).toContain('Kitchen time remaining: 238');
    await click('Resume lab'); await sample(101000);
    expect(container.textContent).toContain('Kitchen time remaining: 237');
  });
  it('exit cancellation preserves prior locks; confirmed paused exit abandons rather than completing', async () => {
    await mount(); await running(); await click('Pause lab'); await click('Leave lab');
    expect(button('End lab run').disabled).toBe(true); await click('Cancel exit');
    expect(container.textContent).toContain('Kitchen paused — facilitator.');
    expect(document.activeElement).toBe(button('Leave lab'));
    await click('Leave lab'); await click('Abandon run and exit');
    expect(close).toHaveBeenCalledOnce(); expect(container.textContent).toContain('Attempt 1 abandoned.');
    expect(document.querySelector('[aria-label="Actual independent run measurements"]')).toBeNull();
    expect(document.querySelector('.sof-lab-stations')).toBeNull();
    await settleInactive();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('captures horizon even when stop races after horizon, never a fabricated manual-stop duration', async () => {
    await mount(); await running(); now = 250000; await click('End lab run');
    expect(container.textContent).toContain('horizon'); expect(container.textContent).toContain('240 simulated seconds');
    expect(container.textContent).not.toContain('manual-stop');
    await settleInactive();
    expect(button('Replay lab run')).toBeTruthy(); expect(vi.getTimerCount()).toBe(0);
  });
  it('unmount cancels the only loop and independent interaction never changes existing store or sends data', async () => {
    const store = useSliceOfFlowStore.getState(); const before = JSON.stringify(store);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const localWrite = vi.spyOn(Storage.prototype, 'setItem');
    await mount(); await running(); await sample(1000);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => root.render(null)); expect(vi.getTimerCount()).toBe(0);
    expect(useSliceOfFlowStore.getState()).toBe(store); expect(JSON.stringify(store)).toBe(before);
    expect(fetch).not.toHaveBeenCalled(); expect(localWrite).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it('notifies only actual frozen completed archives; never start/replay/abandon and never duplicates', async () => {
    await mount(); expect(archiveChange).not.toHaveBeenCalled();
    await running(); expect(archiveChange).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="lab-timer"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="lab-live-scores"]')).not.toBeNull();
    now = 1000; await click('End lab run');
    expect(document.querySelector('[data-testid="lab-results"]')).not.toBeNull();
    expect(archiveChange).toHaveBeenCalledOnce();
    const archive = archiveChange.mock.calls[0][0];
    expect(Object.isFrozen(archive.runs[0].history.events)).toBe(true);
    expect(archive.runs[0].observation.durationMs).toBe(1000);
    await mount(); expect(archiveChange).toHaveBeenCalledOnce();
    await click('Replay lab run'); await click('Try the first order');
    await click('Leave lab'); await click('Abandon run and exit');
    expect(archiveChange).toHaveBeenCalledOnce();
    expect(archive.runs).toHaveLength(1);
  });
  it('redundant visible events never cancel the single active scheduler', async () => {
    await mount(); await running(); await sample(1000);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await sample(2000);
    expect(container.textContent).toContain('Kitchen time remaining: 238');
    expect(vi.getTimerCount()).toBe(1);
  });
  it('browser page exit cancels scheduling and abandons without a final snapshot', async () => {
    await mount(); await running(); await sample(1000);
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    await settleInactive();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.textContent).toContain('Attempt 1 abandoned.');
    expect(document.querySelector('[data-testid="lab-results"]')).toBeNull();
    expect(archiveChange).not.toHaveBeenCalled();
  });
});
