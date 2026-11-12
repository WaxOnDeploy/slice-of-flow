import { describe, expect, it } from 'vitest';
import type { RoundMetrics } from './sliceOfFlowConstants';
import { buildResultsExportModel, formatExportTime, safeMetricsSnapshot } from './sliceOfFlowExportModel';
import { renderToStaticMarkup } from 'react-dom/server';
import SliceOfFlowPrintSheet from '@/components/SliceOfFlowPrintSheet';

const metrics = (patch: Partial<RoundMetrics> = {}): RoundMetrics => ({ served: 3, burnt: 1, angry: 0, avgLeadTime: 100, stillInProgress: 2, score: 1, ...patch });

describe('private local export model', () => {
  it('keeps exact approved author/site and shared score rules', () => {
    const model = buildResultsExportModel(metrics(), metrics(), 'normal');
    expect(model.author).toBe('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
    expect(model.site).toBe('Slice of Flow, slice-of-flow.com');
    expect(model.subtitle).toBe('Normal difficulty');
    expect(model.scoring.formula).toContain('+1 per pizza served');
    expect(model.privacy).toContain('nothing is uploaded');
  });
  it.each(['easy', 'normal', 'hard'] as const)('records selected %s difficulty', difficulty => {
    expect(buildResultsExportModel(null, metrics(), difficulty).subtitle.toLowerCase()).toContain(difficulty);
  });
  it('shows skipped Round 1 as n/a, never a fictitious zero baseline', () => {
    const model = buildResultsExportModel(null, metrics({ served: 0, score: 0, avgLeadTime: 0 }), 'hard');
    expect(model.note).toContain('Round 1 was skipped');
    expect(model.rows.every(row => row.values[0] === 'n/a' && row.values[2] === 'n/a')).toBe(true);
    expect(model.rows[0].values[1]).toBe('0');
    expect(model.scorePercentage).toBe('n/a');
  });
  it.each([0, -2])('keeps score-percent and lead-time unavailable for no-delivery baseline (%i)', score => {
    const model = buildResultsExportModel(metrics({ served: 0, avgLeadTime: 0, score }), metrics({ served: 4, score: 7, avgLeadTime: 128 }), 'normal');
    expect(model.scorePercentage).toBe('n/a');
    expect(model.rows.find(row => row.label === 'Average lead time')!.values).toEqual(['n/a', '2:08', 'n/a']);
    expect(model.rows.find(row => row.label === 'Final score')!.values[2]).toBe(`+${7 - score}`);
  });
  it.each([NaN, Infinity, -1, 0])('does not display invalid or absent completed lead time (%s)', avgLeadTime => {
    const model = buildResultsExportModel(metrics(), metrics({ avgLeadTime }), 'normal');
    expect(model.rows.find(row => row.label === 'Average lead time')!.values[1]).toBe('n/a');
    expect(model.rows.find(row => row.label === 'Average lead time')!.values[2]).toBe('n/a');
  });
  it('retains negative/equal scores and adverse outcomes without invented improvement', () => {
    const model = buildResultsExportModel(metrics({ score: 4 }), metrics({ score: -2, served: 2, burnt: 2, avgLeadTime: 120 }), 'normal');
    expect(model.rows.find(row => row.label === 'Final score')!.values).toEqual(['4', '-2', '-6']);
    expect(model.scorePercentage).toBe('-150%');
    expect(model.insights.map(i => i.title)).not.toContain('More Served, Fewer Burnt Pizzas');
    expect(buildResultsExportModel(metrics(), metrics(), 'normal').rows.every(r => r.values[2] === '—')).toBe(true);
  });
  it('copies only allowlisted numbers, omits arbitrary labels and retains independent frozen results', () => {
    const raw = Object.assign(metrics(), { facilitator: 'PRIVATE_PERSON', dependencyOwner: 'PRIVATE_PLATFORM', customer: 'PRIVATE_CUSTOMER', labels: ['PRIVATE_LABEL'] });
    const snapshot = safeMetricsSnapshot(raw)!;
    const model = buildResultsExportModel(raw, raw, 'normal');
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_');
    expect(JSON.stringify(model)).not.toContain('PRIVATE_');
    raw.served = 11;
    expect(snapshot.served).toBe(3);
    expect(model.rows[0].values).toEqual(['3', '3', '—']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.rows[0].values)).toBe(true);
  });
  it('fails closed on arbitrary text injected into numeric fields', () => {
    const malformed = { ...metrics(), served: 'PRIVATE_CUSTOMER', avgLeadTime: 'PRIVATE_LABEL', score: 'PRIVATE_OWNER' } as unknown as RoundMetrics;
    const snapshot = safeMetricsSnapshot(malformed)!;
    const model = buildResultsExportModel(null, malformed, 'normal');
    expect(Number.isNaN(snapshot.served)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_');
    expect(JSON.stringify(model)).not.toContain('PRIVATE_');
    expect(model.rows.find(r => r.label === 'Pizzas served')!.values[1]).toBe('n/a');
    expect(model.rows.find(r => r.label === 'Final score')!.values[1]).toBe('n/a');
  });
  it('prints no artwork, charts, buttons or personal labels while retaining questions and the Bridge', () => {
    const raw = Object.assign(metrics(), { facilitatorName: 'DO_NOT_EXPORT' });
    const model = buildResultsExportModel(null, raw, 'normal');
    const html = renderToStaticMarkup(SliceOfFlowPrintSheet({ model }));
    expect(html).toContain('Printable results table');
    expect(html).toContain('Printable Bridge table');
    expect(html).toContain('Team discussion questions');
    expect(html).toContain('Round 1 was skipped');
    expect(html).toContain('Built by Jeff Bourke, MHA, PMP, SAFe RTE');
    expect(html).not.toMatch(/<img|<canvas|<button|DO_NOT_EXPORT/);
    for (const question of model.questions) expect(html).toContain(question.replaceAll('"', '&quot;').replaceAll("'", '&#x27;'));
  });
  it('does not invent results when either record is missing', () => {
    const model = buildResultsExportModel(null, null, 'normal');
    expect(model.rows.every(row => row.values.every(v => v === 'n/a'))).toBe(true);
    expect(safeMetricsSnapshot(null)).toBeNull();
  });
  it('formats measured simulated seconds consistently', () => {
    expect(formatExportTime(128.9)).toBe('2:08');
    expect(formatExportTime(0)).toBe('0:00');
    expect(formatExportTime(NaN)).toBe('n/a');
    expect(formatExportTime(-1)).toBe('n/a');
  });
});
