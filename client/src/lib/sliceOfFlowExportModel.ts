import { DIFFICULTY_PRESETS, type Difficulty, type RoundMetrics } from './sliceOfFlowConstants';
import { BUILT_BY } from './sliceOfFlowBrand';
import { getDebriefInsights, getResultsComparison, hasLeadTime } from './sliceOfFlowResults';
import { getScoringCopy } from './sliceOfFlowScoringCopy';
import { BRIDGE_ROWS, DISCUSSION_QUESTIONS } from './sliceOfFlowDebriefContent';

export const EXPORT_SITE = 'Slice of Flow, slice-of-flow.com';
export const EXPORT_PRIVACY = 'Names and labels are excluded. Files are created in this browser; nothing is uploaded.';
export const LEAD_TIME_BOUNDARY = 'Lead time: Orders-to-served time, served tickets only. Unfinished orders are excluded.';

export interface ExportRow { readonly label: string; readonly values: readonly string[]; }
export interface ResultsExportModel {
  readonly title: string;
  readonly subtitle: string;
  readonly author: string;
  readonly site: string;
  readonly note: string;
  readonly headers: readonly string[];
  readonly rows: readonly ExportRow[];
  readonly footer: string;
  readonly scorePercentage: string;
  readonly privacy: string;
  readonly insights: readonly { readonly title: string; readonly desc: string; readonly metric: string }[];
  readonly bridge: typeof BRIDGE_ROWS;
  readonly questions: typeof DISCUSSION_QUESTIONS;
  readonly scoring: ReturnType<typeof getScoringCopy>;
}

export function formatExportTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'n/a';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
function count(value: number | undefined) { return value !== undefined && Number.isFinite(value) && value >= 0 ? String(value) : 'n/a'; }
function score(value: number | undefined) { return value !== undefined && Number.isFinite(value) ? String(value) : 'n/a'; }
function signed(value: number | null, time = false) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '-'}${time ? formatExportTime(Math.abs(value)) : Math.abs(value)}`;
}
function difference(a: number | undefined, b: number | undefined): number | null {
  return a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
}
function numeric(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN; }
/** Copy only measured numeric fields. Never serialize raw cards, arbitrary metadata or labels. */
export function safeMetricsSnapshot(metrics: RoundMetrics | null): Readonly<RoundMetrics> | null {
  if (!metrics) return null;
  return Object.freeze({
    served: numeric(metrics.served), burnt: numeric(metrics.burnt), angry: numeric(metrics.angry),
    avgLeadTime: numeric(metrics.avgLeadTime), stillInProgress: numeric(metrics.stillInProgress), score: numeric(metrics.score),
    ...(Number.isFinite(metrics.timeRemaining) ? { timeRemaining: metrics.timeRemaining } : {}),
  });
}

export function buildResultsExportModel(r1: RoundMetrics | null, r2: RoundMetrics | null, difficulty: Difficulty): ResultsExportModel {
  const first = safeMetricsSnapshot(r1), second = safeMetricsSnapshot(r2);
  const comparison = getResultsComparison(first, second);
  const percentage = comparison.scorePercent === null ? 'n/a' : `${comparison.scorePercent > 0 ? '+' : ''}${Number(comparison.scorePercent.toFixed(1))}%`;
  const makeRow = (label: string, a: string, b: string, change: number | null, time = false): ExportRow => Object.freeze({ label, values: Object.freeze([a, b, signed(change, time)]) });
  const countRow = (label: string, key: 'served' | 'burnt' | 'angry' | 'stillInProgress') => {
    const a = count(first?.[key]), b = count(second?.[key]);
    return makeRow(label, a, b, a === 'n/a' || b === 'n/a' ? null : difference(first?.[key], second?.[key]));
  };
  const rows = Object.freeze([
    countRow('Pizzas served', 'served'), countRow('Burnt pizzas', 'burnt'), countRow('Angry customers', 'angry'),
    makeRow('Average lead time', hasLeadTime(first) ? formatExportTime(first!.avgLeadTime) : 'n/a', hasLeadTime(second) ? formatExportTime(second!.avgLeadTime) : 'n/a', comparison.leadTimeDelta, true),
    countRow('Still in progress', 'stillInProgress'),
    makeRow('Final score', score(first?.score), score(second?.score), comparison.scoreDelta),
  ]);
  const notes = first ? 'Round 1 used push. Round 2 used pull + WIP limits. Changes are Round 2 minus Round 1.' : 'Round 1 was skipped. Its values and comparisons are n/a, not zero.';
  const early = [first, second].map((m, i) => m?.timeRemaining && m.timeRemaining > 0 ? `Round ${i + 1} finished with ${formatExportTime(m.timeRemaining)} simulated time remaining.` : '').filter(Boolean).join(' ');
  return Object.freeze({
    title: 'Slice of Flow — Results', subtitle: `${DIFFICULTY_PRESETS[difficulty]?.label ?? 'Normal'} difficulty`, author: BUILT_BY, site: EXPORT_SITE,
    note: notes, headers: Object.freeze(['Metric', 'Round 1 (Push)', 'Round 2 (Pull)', 'Change']), rows,
    footer: `${LEAD_TIME_BOUNDARY}${early ? ` ${early}` : ''}`, scorePercentage: percentage, privacy: EXPORT_PRIVACY,
    insights: Object.freeze(getDebriefInsights(first, second).map(({ title, desc, metric }) => Object.freeze({ title, desc, metric }))),
    bridge: BRIDGE_ROWS, questions: DISCUSSION_QUESTIONS, scoring: Object.freeze(getScoringCopy()),
  });
}
