// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SliceOfFlowIndependentEvidence from './SliceOfFlowIndependentEvidence';
import { makeFixedDeckConfig } from '@/lib/sofEngine/scenario';
import { createEngine, advanceTo, applyAction } from '@/lib/sofEngine/engine';
import { createArchive, retainRun, snapshotFromEngine } from '@/lib/sofEngine/runSnapshots';
import type { Checked, RunArchive } from '@/lib/sofEngine/types';
import { buildCfd } from '@/lib/flow/cfd';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: () => <div>Numeric step chart</div>, Area: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
}));
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const value = <T,>(checked: Checked<T>): T => { if (!checked.ok) throw new Error(JSON.stringify(checked.issues)); return checked.value; };
function fixture(id: string, endMs: number) {
  const config = value(makeFixedDeckConfig({ difficulty: 'hard', policy: 'manual-pull', initialSpeed: 3, guidedStart: false, endCondition: 'fixed-horizon' }));
  let state = value(createEngine(id, config)).state;
  state = applyAction(state, { kind: 'set-pause', reason: 'instruction', active: false }).state;
  state = applyAction(state, { kind: 'admit', orderKey: config.manifest.orders[0].orderKey }).state;
  state = value(advanceTo(state, endMs)).state;
  state = applyAction(state, { kind: 'end', reason: 'manual-stop' }).state;
  return value(snapshotFromEngine(state));
}
let container: HTMLDivElement, root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
function render(archive: RunArchive) { act(() => root.render(<SliceOfFlowIndependentEvidence archive={archive} />)); }
function select(index: number, id: string) {
  const node = container.querySelectorAll('select')[index];
  act(() => { node.value = id; node.dispatchEvent(new Event('change', { bubbles: true })); });
}
function archiveOf(...runs: ReturnType<typeof fixture>[]) { let archive = createArchive(); for (const run of runs) archive = value(retainRun(archive, run)); return archive; }

describe('independent recorded evidence preview', () => {
  it('does not invent charts, examples, deltas or usage evidence for an empty archive', () => {
    render(createArchive());
    expect(container.textContent).toContain('No recorded attempts yet');
    expect(container.querySelector('[data-testid="lab-cfd-chart"]')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(container.querySelectorAll('select option')).toHaveLength(3);
  });
  it('does not automatically choose latest or best recorded attempts', () => {
    render(archiveOf(fixture('evidence:run:1', 1500), fixture('evidence:run:2', 3000)));
    expect(Array.from(container.querySelectorAll('select')).map(node => node.value)).toEqual(['', '', '']);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  });
  it('uses recorded-run numbering and actual IDs when earlier attempts were abandoned', () => {
    const run = fixture('evidence:run:2', 1500);
    render(archiveOf(run));
    const labels = Array.from(container.querySelectorAll('select option')).filter(node => (node as HTMLOptionElement).value === run.runId);
    expect(labels).toHaveLength(3);
    for (const node of labels) {
      expect(node.textContent).toContain('Recorded run 1 · evidence:run:2');
      expect(node.textContent).not.toContain('Attempt 1');
    }
  });
  it('preserves every numeric event prefix and distinguishes waiting from active WIP', () => {
    const run = fixture('evidence:run:1', 1500), model = value(buildCfd(run));
    render(archiveOf(run)); select(0, run.runId);
    expect(container.querySelector('[data-testid="lab-cfd-chart"]')).not.toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(model.points.length);
    expect(container.textContent).toContain('“Not admitted” is outside active WIP');
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => { slider.value = String(model.points.length - 1); slider.dispatchEvent(new Event('change', { bubbles: true })); });
    // The HTML numeric table is authoritative even when browser range events differ in jsdom.
    expect(container.querySelector('tbody tr:last-child td')?.textContent).toBe('1.500');
    expect(container.textContent).toContain('Entered Orders');
  });
  it('does not invent an elapsed-time chart for a valid zero-time observation', () => {
    const run = fixture('evidence:run:1', 0);
    render(archiveOf(run)); select(0, run.runId);
    expect(container.querySelector('[data-testid="lab-cfd-chart"]')).toBeNull();
    expect(container.textContent).toContain('without inventing an elapsed-time chart');
    expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });
  it('rejects same-attempt selection instead of manufacturing equal deltas', () => {
    const run = fixture('evidence:run:1', 1500);
    render(archiveOf(run)); select(1, run.runId); select(2, run.runId);
    expect(container.textContent).toContain('Choose two different recorded attempts');
    expect(container.querySelector('[data-testid="lab-comparison-basis"]')).toBeNull();
  });
  it('shows descriptive contextual rows, actual windows and missing served samples without claiming a winner', () => {
    const a = fixture('evidence:run:1', 1500), b = fixture('evidence:run:2', 3000);
    render(archiveOf(a, b)); select(1, a.runId); select(2, b.runId);
    expect(container.querySelector('[data-testid="lab-comparison-basis"]')?.textContent).toContain('Basis: contextual');
    expect(container.textContent).toContain('Baseline observation: 1.5 sim seconds; comparison: 3 sim seconds');
    expect(container.textContent).toContain('Served sample counts: 0 and 0');
    expect(container.textContent).toContain('Unavailable (no served samples)');
    expect(container.textContent).toContain('Short-run Orders-to-exit illustration');
    expect(container.textContent).not.toMatch(/winner is|proved|guaranteed improvement/i);
  });
});
