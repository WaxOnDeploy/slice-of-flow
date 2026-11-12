// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyResultsText } from './sliceOfFlowClipboard';

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

function clipboard(writeText?: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: writeText ? { writeText } : undefined });
}
function legacy(result: boolean | Error) {
  const fn = result instanceof Error ? vi.fn(() => { throw result; }) : vi.fn(() => result);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: fn });
  return fn;
}

describe('local result copying', () => {
  it('uses the modern clipboard when allowed without a temporary textarea', async () => {
    const write = vi.fn().mockResolvedValue(undefined); clipboard(write);
    expect(await copyResultsText('safe results')).toBe(true);
    expect(write).toHaveBeenCalledWith('safe results');
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('falls back locally when clipboard permission is denied and restores focus', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('permission denied')));
    const command = legacy(true);
    const button = document.createElement('button'); document.body.append(button); button.focus();
    expect(await copyResultsText('safe results')).toBe(true);
    expect(command).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(button);
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('does not claim success if both methods fail', async () => {
    clipboard(vi.fn().mockRejectedValue(new Error('denied'))); legacy(false);
    expect(await copyResultsText('safe results')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('handles an unavailable modern API and exception from legacy copy', async () => {
    clipboard(); legacy(new Error('copy blocked'));
    expect(await copyResultsText('safe results')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('handles an unavailable legacy API without mutation or leaks', async () => {
    clipboard(); Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
    expect(await copyResultsText('safe results')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
