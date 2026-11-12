import { account } from './accounting';
import { replay, replayFrames, validateEngine } from './engine';
import { scoreCounts, validateConfig } from './scenario';
import {
  equivalent, exactKeys, failure, immutable, isCode, isRecord, isTime, success,
  type Accounting, type Checked, type Engine, type Finalization, type FinalOrder, type FinalRunSnapshot,
  type RunArchive, type RunDraft,
} from './types';

export function makeRunId(sessionCode: unknown, ordinal: unknown): Checked<string> {
  if (typeof sessionCode !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(sessionCode)) return failure('INVALID_ID', 'sessionCode');
  if (!isTime(ordinal) || ordinal === 0) return failure('INVALID_ID', 'ordinal');
  return success(`${sessionCode}:run:${ordinal}`);
}
export function makeOrderId(runId: unknown, ordinal: unknown): Checked<string> {
  if (!isCode(runId) || runId.length > 64 || !isTime(ordinal) || ordinal === 0) return failure('INVALID_ID', 'orderId');
  return success(`${runId}:order:${ordinal}`);
}
export function createRunDraft(runId: unknown, configInput: unknown): Checked<RunDraft> {
  if (!isCode(runId) || runId.length > 64) return failure('INVALID_ID', 'runId');
  const config = validateConfig(configInput); if (!config.ok) return config;
  return success(immutable({ schema: 'sof-draft/v1', runId, config: config.value, final: null }));
}
function finalOrders(a: Accounting): readonly FinalOrder[] {
  return immutable(a.orders.map(({ arrived: _arrived, holds: _holds, ...order }) => order));
}
function metrics(a: Accounting): FinalRunSnapshot['metrics'] {
  const angry = a.orders.filter(o => o.angry && o.outcome !== 'burnt' && o.admittedAtMs !== null).length;
  return immutable({ served: a.served, burnt: a.burnt, angry, stillInProgress: a.active,
    score: scoreCounts(a.served, a.burnt, angry), servedSample: a.servedSample });
}
/** Validate the entire DTO against its independent transition fold; no inferred missing ledger. */
export function validateSnapshot(input: unknown): Checked<FinalRunSnapshot> {
  if (!isRecord(input) || !exactKeys(input, ['schema', 'kind', 'runId', 'config', 'history', 'observation', 'endReason', 'orders', 'metrics']) ||
    input.schema !== 'sof-run/v1' || input.kind !== 'independent-final' || !isCode(input.runId)) return failure('INVALID_SNAPSHOT', 'snapshot');
  const config = validateConfig(input.config); if (!config.ok) return config;
  if (!isRecord(input.observation) || !exactKeys(input.observation, ['startMs', 'endMs', 'durationMs']) || input.observation.startMs !== 0 ||
    !isTime(input.observation.endMs) || input.observation.durationMs !== input.observation.endMs) return failure('INVALID_OBSERVATION', 'observation');
  const folded = account(config.value, input.runId, input.history, input.observation.endMs); if (!folded.ok) return folded;
  const history = input.history as FinalRunSnapshot['history'];
  const last = history.events.at(-1);
  if (last?.kind !== 'runEnded' || last.reason !== input.endReason || !equivalent(input.orders, finalOrders(folded.value)) ||
    !equivalent(input.metrics, metrics(folded.value))) return failure('SNAPSHOT_MISMATCH', 'snapshot');
  return success(immutable(input) as FinalRunSnapshot);
}
/** Validate producer physics/control trace as well as ledger accounting before final capture. */
export function snapshotFromEngine(input: Engine): Checked<FinalRunSnapshot> {
  const checked = validateEngine(input); if (!checked.ok) return checked;
  if (!input.ended) return failure('NOT_ENDED', 'state');
  const history = immutable({ schema: 'sof-history/v1' as const, source: 'engine-boundary' as const,
    completeness: 'complete' as const, events: input.events });
  const folded = account(input.config, input.runId, history, input.nowMs); if (!folded.ok) return folded;
  const reproduced = replay(input.config, input.runId, replayFrames(input), input.nowMs); if (!reproduced.ok) return reproduced;
  if (!equivalent(input, reproduced.value.state)) return failure('ENGINE_REPLAY_MISMATCH', 'state');
  const projected = input.tickets.map(t => ({
    orderKey: t.orderKey, orderId: t.orderId, outcome: t.status === 'external' || t.status === 'scheduled' ? 'not-admitted' : t.status,
    finalStation: t.station, admittedAtMs: t.admittedAtMs, exitedAtMs: t.exitedAtMs, angry: t.angry,
  }));
  if (!equivalent(projected, finalOrders(folded.value))) return failure('ENGINE_ACCOUNTING_MISMATCH', 'state.tickets');
  return validateSnapshot({ schema: 'sof-run/v1', kind: 'independent-final', runId: input.runId,
    config: input.config, history, observation: { startMs: 0, endMs: input.nowMs, durationMs: input.nowMs },
    endReason: input.ended, orders: finalOrders(folded.value), metrics: metrics(folded.value) });
}
export function finalizeRun(input: unknown, engine: Engine): Checked<Finalization> {
  if (!isRecord(input) || !exactKeys(input, ['schema', 'runId', 'config', 'final']) || input.schema !== 'sof-draft/v1') return failure('INVALID_DRAFT', 'draft');
  const candidate = snapshotFromEngine(engine); if (!candidate.ok) return candidate;
  if (input.runId !== engine.runId || !equivalent(input.config, engine.config)) return failure('DRAFT_MISMATCH', 'draft');
  if (input.final !== null) {
    const previous = validateSnapshot(input.final); if (!previous.ok) return previous;
    if (!equivalent(previous.value, candidate.value)) return failure('FINALIZATION_CONFLICT', 'draft.final');
    return success(Object.freeze({ draft: input as unknown as RunDraft, snapshot: (input as unknown as RunDraft).final! }));
  }
  const draft = immutable({ ...input, final: candidate.value }) as RunDraft;
  return success(Object.freeze({ draft, snapshot: draft.final! }));
}
export function createArchive(): RunArchive { return immutable({ schema: 'sof-archive/v1', runs: [] }); }
function validateArchive(input: unknown): Checked<RunArchive> {
  if (!isRecord(input) || !exactKeys(input, ['schema', 'runs']) || input.schema !== 'sof-archive/v1' || !Array.isArray(input.runs)) return failure('INVALID_ARCHIVE', 'archive');
  const ids = new Set<string>();
  for (const run of input.runs) {
    const checked = validateSnapshot(run); if (!checked.ok) return checked;
    if (ids.has(checked.value.runId)) return failure('DUPLICATE_ID', 'archive');
    ids.add(checked.value.runId);
  }
  return success(input as unknown as RunArchive);
}
export function retainRun(input: unknown, finalInput: unknown): Checked<RunArchive> {
  const archive = validateArchive(input); if (!archive.ok) return archive;
  const snapshot = validateSnapshot(finalInput); if (!snapshot.ok) return snapshot;
  const previous = archive.value.runs.find(r => r.runId === snapshot.value.runId);
  if (previous) return equivalent(previous, snapshot.value) ? success(archive.value) : failure('RETENTION_CONFLICT', 'runId');
  return success(immutable({ schema: 'sof-archive/v1', runs: [...archive.value.runs, snapshot.value] }));
}
export function getRun(input: unknown, runId: unknown): Checked<FinalRunSnapshot | null> {
  const archive = validateArchive(input); if (!archive.ok) return archive;
  if (!isCode(runId)) return failure('INVALID_ID', 'runId');
  return success(archive.value.runs.find(r => r.runId === runId) ?? null);
}
