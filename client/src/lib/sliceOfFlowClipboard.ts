/** Local clipboard only. Failure must not be reported as a successful copy. */
export async function copyResultsText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Permission denied or API unsupported: try the local legacy fallback. */ }
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
  } catch { return false; }
  finally {
    textarea.remove();
    if (focused?.isConnected) focused.focus({ preventScroll: true });
  }
}
