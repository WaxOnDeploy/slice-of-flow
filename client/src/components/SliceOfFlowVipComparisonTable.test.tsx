import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeVipConfig } from '@/lib/sofEngine/vip';
import { createEngine, applyAction } from '@/lib/sofEngine/engine';
import { snapshotFromEngine } from '@/lib/sofEngine/runSnapshots';
import type { Checked } from '@/lib/sofEngine/types';
import SliceOfFlowVipComparisonTable from './SliceOfFlowVipComparisonTable';
const value = <T,>(x: Checked<T>): T => { if (!x.ok) throw new Error(JSON.stringify(x.issues)); return x.value; };
function fixture(variant: 'fifo' | 'expedite') {
  const config = value(makeVipConfig({ difficulty: 'normal', variant, guidedStart: false }));
  let state = value(createEngine(`table:${variant}:run:1`, config)).state;
  state = applyAction(state, { kind: 'set-pause', reason: 'instruction', active: false }).state;
  state = applyAction(state, { kind: 'end', reason: 'manual-stop' }).state;
  return value(snapshotFromEngine(state));
}
describe('selected VIP comparison table', () => {
  it('shows explicit policies and unavailable means without fabricated zeros, improvements or winners', () => {
    const html = renderToStaticMarkup(<SliceOfFlowVipComparisonTable baseline={fixture('fifo')} subject={fixture('expedite')} />);
    expect(html).toContain('FIFO baseline');
    expect(html).toContain('VIP expedite');
    expect(html).toContain('N/A (no served samples)');
    expect(html).toContain('not proof of delay caused by VIPs');
    expect(html).toContain('not Round 2');
    expect(html).not.toMatch(/winner|proved|% improvement/i);
  });
  it('provides an accessible scroll region and row/column headers', () => {
    const html = renderToStaticMarkup(<SliceOfFlowVipComparisonTable baseline={fixture('fifo')} subject={fixture('expedite')} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('scope="row"');
    expect(html).toContain('scope="col"');
  });
});
