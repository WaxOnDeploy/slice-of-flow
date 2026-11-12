// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildResultsExportModel } from '@/lib/sliceOfFlowExportModel';
const mocks = vi.hoisted(() => ({ render: vi.fn(), download: vi.fn(), share: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/sliceOfFlowPng', () => ({ renderResultsPng: mocks.render, downloadResultsPng: mocks.download, shareResultsPng: mocks.share }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
import SliceOfFlowExportActions from './SliceOfFlowExportActions';

const model = buildResultsExportModel(null, { served: 0, burnt: 0, angry: 0, avgLeadTime: 0, stillInProgress: 0, score: 0 }, 'hard');
let root: Root, host: HTMLDivElement;
async function mount() { await act(async () => { root.render(<SliceOfFlowExportActions model={model} />); }); }
function button(label: string) { const found = Array.from(host.querySelectorAll('button')).find(b => b.textContent === label); if (!found) throw new Error('Button missing: ' + label); return found; }
async function click(label: string) { await act(async () => { button(label).click(); }); }

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.render.mockResolvedValue(new Blob(['PNG'], { type: 'image/png' }));
  mocks.share.mockResolvedValue('shared');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe('local export controls', () => {
  it('prepares a data-only summary without names, labels or remote art', async () => {
    await mount();
    expect(mocks.render).toHaveBeenCalledOnce();
    const summary = mocks.render.mock.calls[0][0];
    expect(summary.author).toBe('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
    expect(summary.site).toBe('Slice of Flow, slice-of-flow.com');
    expect(summary.note).toContain('Score percentage change: n/a');
    expect(host.textContent).toContain('Names and labels are excluded');
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(button('Download PNG').disabled).toBe(false);
  });
  it('downloads a prepared local blob with a generic filename', async () => {
    await mount(); await click('Download PNG');
    expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), 'slice-of-flow-results.png');
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('download requested'));
  });
  it('does not claim a completed download on browser download failure', async () => {
    mocks.download.mockImplementationOnce(() => { throw new Error('blocked'); });
    await mount(); await click('Download PNG');
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Print / Save PDF'));
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('cancels native sharing silently without an unexpected download or metrics mutation', async () => {
    const before = JSON.stringify(model); mocks.share.mockResolvedValue('cancelled');
    await mount(); await click('Share image');
    expect(mocks.share).toHaveBeenCalledWith(expect.any(Blob), 'slice-of-flow-results.png');
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
    expect(JSON.stringify(model)).toBe(before);
    expect(button('Share image').disabled).toBe(false);
  });
  it('explains the local download fallback when native sharing is unsupported', async () => {
    mocks.share.mockResolvedValue('downloaded'); await mount(); await click('Share image');
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('local PNG download'));
  });
  it('shows helpful alternatives on sharing failure', async () => {
    mocks.share.mockRejectedValue(new Error('denied')); await mount(); await click('Share image');
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Download PNG or Print / Save PDF'));
    expect(button('Share image').disabled).toBe(false);
  });
  it('leaves printing available after canvas failure and allows a successful retry', async () => {
    mocks.render.mockRejectedValueOnce(new Error('no canvas')); await mount();
    expect(button('Download PNG').disabled).toBe(true);
    expect(button('Print / Save PDF').disabled).toBe(false);
    expect(host.textContent).toContain('Printing and text sharing are still available');
    await click('Retry image');
    expect(mocks.render).toHaveBeenCalledTimes(2);
    expect(button('Download PNG').disabled).toBe(false);
  });
  it('print cancellation changes neither results nor export readiness', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {}); const before = JSON.stringify(model);
    await mount(); await click('Print / Save PDF');
    expect(print).toHaveBeenCalledOnce();
    expect(JSON.stringify(model)).toBe(before);
    expect(button('Download PNG').disabled).toBe(false);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
