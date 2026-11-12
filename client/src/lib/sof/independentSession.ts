import { createDriver, rebaseDriver, sampleWall } from '../sofEngine/driver';
import { applyAction, createEngine } from '../sofEngine/engine';
import { makeFixedDeckConfig } from '../sofEngine/scenario';
import { createArchive, createRunDraft, finalizeRun, makeRunId, retainRun } from '../sofEngine/runSnapshots';
import { makeVipConfig, type VipVariant } from '../sofEngine/vip';
import { measureTimeWeightedWip, type WipSummary } from '../flow/sof018Metrics';
import {
  exactKeys, immutable, isRecord, isTime, type Checked, type Difficulty, type Driver,
  type Engine, type EngineCommand, type FinalRunSnapshot, type RunArchive, type RunDraft,
  type Speed, type ValidationIssue,
} from '../sofEngine/types';

/** Host-local state. Never connected to the released store, persistence, or a global clock. */
export type IndependentSession = Readonly<{
  sessionCode: string;
  runId: string;
  usedSessionCodes: readonly string[];
  attempt: number;
  revision: number;
  status: 'active' | 'final' | 'abandoned';
  engine: Engine;
  driver: Driver;
  draft: RunDraft | null;
  archive: RunArchive;
  snapshot: FinalRunSnapshot | null;
  measured: WipSummary | null;
}>;
export type SessionToken = Readonly<{ runId: string; attempt: number; revision: number }>;
export type SessionResult = Readonly<{
  accepted: boolean;
  /** On rejection this is the identical input, except an independently sampled terminal capture. */
  state: IndependentSession;
  issues: readonly ValidationIssue[];
}>;
export type IndependentStart = Readonly<{ sessionCode: string; difficulty: Difficulty; speed: Speed }>;
export type VipStart = Readonly<IndependentStart & { variant: VipVariant }>;
const issue = (code: string, path = 'session'): readonly ValidationIssue[] => Object.freeze([Object.freeze({ code, path })]);
const rejected = (state: IndependentSession, issues: readonly ValidationIssue[]): SessionResult => Object.freeze({ accepted: false, state, issues });
const accepted = (state: IndependentSession): SessionResult => Object.freeze({ accepted: true, state, issues: Object.freeze([]) });
export function sessionToken(state: IndependentSession): SessionToken {
  return Object.freeze({ runId: state.runId, attempt: state.attempt, revision: state.revision });
}
function identity(state: IndependentSession, token: unknown): readonly ValidationIssue[] | null {
  if (!isRecord(token) || !exactKeys(token, ['runId', 'attempt', 'revision']) ||
      token.runId !== state.runId || token.attempt !== state.attempt || token.revision !== state.revision) return issue('STALE_SESSION');
  if (state.status !== 'active') return issue('SESSION_INACTIVE');
  if (!isTime(state.revision) || state.revision === Number.MAX_SAFE_INTEGER) return issue('REVISION_OVERFLOW');
  return null;
}
function start(input: IndependentStart | VipStart, wallUs: unknown, attempt: number, archive: RunArchive, usedSessionCodes: readonly string[] = [], vip = false): Checked<IndependentSession> {
  if (!isRecord(input) || !exactKeys(input, vip ? ['sessionCode', 'difficulty', 'speed', 'variant'] : ['sessionCode', 'difficulty', 'speed'])) return { ok: false, issues: issue('INVALID_START') };
  const id = makeRunId(input.sessionCode, attempt); if (!id.ok) return id;
  if (!isTime(wallUs)) return { ok: false, issues: issue('INVALID_WALL_TIME') };
  // Official builder only. No fixture/scenario/config injection port.
  const config = vip ? makeVipConfig({ difficulty: input.difficulty, variant: (input as VipStart).variant, initialSpeed: input.speed, guidedStart: true }) : makeFixedDeckConfig({ difficulty: input.difficulty, policy: 'manual-pull', initialSpeed: input.speed,
    guidedStart: true, endCondition: 'fixed-horizon' });
  if (!config.ok) return config;
  const created = createEngine(id.value, config.value); if (!created.ok) return created;
  const driver = createDriver(id.value); if (!driver.ok) return driver;
  const rebased = rebaseDriver(driver.value, wallUs); if (!rebased.ok) return rebased;
  const draft = createRunDraft(id.value, config.value); if (!draft.ok) return draft;
  return Object.freeze({ ok: true, value: Object.freeze({ sessionCode: input.sessionCode, runId: id.value,
    usedSessionCodes: Object.freeze([...usedSessionCodes, input.sessionCode]),
    attempt, revision: 0, status: 'active', engine: created.value.state, driver: rebased.value,
    draft: draft.value, archive, snapshot: null, measured: null }) });
}
/** Called only by the host's explicit Start action. No scheduler or clock reads live here. */
export function startIndependentSession(input: IndependentStart, wallUs: unknown): Checked<IndependentSession> {
  return start(input, wallUs, 1, createArchive());
}
/** Round 3 preview pilot, not a generic configuration injection API. */
export function startVipSession(input: VipStart, wallUs: unknown): Checked<IndependentSession> {
  return start(input, wallUs, 1, createArchive(), [], true);
}
export function replayVipSession(previous: IndependentSession, input: VipStart, wallUs: unknown): Checked<IndependentSession> {
  if (previous.status === 'active') return { ok: false, issues: issue('ACTIVE_REPLAY') };
  if (!isRecord(input) || previous.usedSessionCodes.includes(input.sessionCode as string)) return { ok: false, issues: issue('FRESH_SESSION_REQUIRED') };
  if (!isTime(previous.attempt + 1)) return { ok: false, issues: issue('ATTEMPT_OVERFLOW') };
  return start(input, wallUs, previous.attempt + 1, previous.archive, previous.usedSessionCodes, true);
}
/** Replay is another manual run, NOT replayed frames or synthetic played evidence. */
export function replayIndependentSession(previous: IndependentSession, input: IndependentStart, wallUs: unknown): Checked<IndependentSession> {
  if (previous.status === 'active') return { ok: false, issues: issue('ACTIVE_REPLAY') };
  if (!isRecord(input) || previous.usedSessionCodes.includes(input.sessionCode as string)) {
    return { ok: false, issues: issue('FRESH_SESSION_REQUIRED') };
  }
  if (!isTime(previous.attempt + 1)) return { ok: false, issues: issue('ATTEMPT_OVERFLOW') };
  return start(input, wallUs, previous.attempt + 1, previous.archive, previous.usedSessionCodes);
}
function capture(state: IndependentSession, engine: Engine, driver: Driver): Checked<IndependentSession> {
  if (!state.draft) return { ok: false, issues: issue('MISSING_DRAFT') };
  const finalized = finalizeRun(state.draft, engine); if (!finalized.ok) return finalized;
  const measured = measureTimeWeightedWip(finalized.value.snapshot); if (!measured.ok) return measured;
  const archive = retainRun(state.archive, finalized.value.snapshot); if (!archive.ok) return archive;
  return Object.freeze({ ok: true, value: Object.freeze({ ...state, revision: state.revision + 1,
    status: 'final', engine, driver, draft: finalized.value.draft, archive: archive.value,
    snapshot: finalized.value.snapshot, measured: measured.value }) });
}
function candidate(state: IndependentSession, engine: Engine, driver: Driver): Checked<IndependentSession> {
  if (engine.ended) return capture(state, engine, driver);
  if (engine === state.engine && driver.lastWallUs === state.driver.lastWallUs && driver.remainderUs === state.driver.remainderUs) return { ok: true, value: state };
  return Object.freeze({ ok: true, value: Object.freeze({ ...state, engine, driver, revision: state.revision + 1 }) });
}
/** Single scheduled sample; callbacks must carry the exact current attempt/revision. */
export function sampleIndependentSession(state: IndependentSession, token: unknown, wallUs: unknown): SessionResult {
  const stale = identity(state, token); if (stale) return rejected(state, stale);
  const sampled = sampleWall(state.engine, state.driver, wallUs); if (!sampled.ok) return rejected(state, sampled.issues);
  const next = candidate(state, sampled.value.state, sampled.value.driver);
  return next.ok ? accepted(next.value) : rejected(state, next.issues);
}
/**
 * Atomic transaction: validate identity, sample under OLD mode, then resolve a command.
 * A nonterminal rejection rolls back BOTH sampled state and driver, with no partial ledger.
 * Sampling a terminal horizon is different: freeze that real observation even when the
 * subsequent command is invalid/rejected. Never use applyWallControl's rejection rollback
 * for that terminal case. Resume/show samples while still paused and rebases before unlock.
 */
export function commandIndependentSession(state: IndependentSession, token: unknown, wallUs: unknown, command: unknown): SessionResult {
  const stale = identity(state, token); if (stale) return rejected(state, stale);
  const sampled = sampleWall(state.engine, state.driver, wallUs); if (!sampled.ok) return rejected(state, sampled.issues);
  if (sampled.value.state.ended) {
    const final = capture(state, sampled.value.state, sampled.value.driver);
    return final.ok ? rejected(final.value, issue('ENDED', 'command')) : rejected(state, final.issues);
  }
  const action = applyAction(sampled.value.state, command);
  if (!action.accepted) return rejected(state, action.issues);
  // Canonical no-op owner commands create no event/revision while paused.
  if (action.state === state.engine && sampled.value.state === state.engine) return accepted(state);
  let driver = sampled.value.driver;
  if (isRecord(command) && command.kind === 'set-pause' && !command.active) {
    const rebased = rebaseDriver(driver, wallUs); if (!rebased.ok) return rejected(state, rebased.issues);
    driver = rebased.value;
  }
  const next = candidate(state, action.state, driver);
  return next.ok ? accepted(next.value) : rejected(state, next.issues);
}
/** Cleanup/confirmed paused exit discards the draft, never manufactures a terminal event. */
export function abandonIndependentSession(state: IndependentSession, token: unknown, reason: 'unmount' | 'confirmed-exit'): SessionResult {
  const stale = identity(state, token); if (stale) return rejected(state, stale);
  if (reason !== 'unmount' && reason !== 'confirmed-exit') return rejected(state, issue('INVALID_ABANDON'));
  if (reason === 'confirmed-exit' && !state.engine.pausedBy.includes('exit-confirmation')) return rejected(state, issue('EXIT_CONFIRMATION_REQUIRED'));
  return accepted(Object.freeze({ ...state, status: 'abandoned', revision: state.revision + 1, draft: null }));
}
/** Small owned control helpers. No helper clears a second owner's pause. */
export const facilitatorCommand = (paused: boolean): EngineCommand => ({ kind: 'set-pause', reason: 'facilitator', active: paused });
export const visibilityCommand = (hidden: boolean): EngineCommand => ({ kind: 'set-pause', reason: 'hidden', active: hidden });
export const exitConfirmationCommand = (open: boolean): EngineCommand => ({ kind: 'set-pause', reason: 'exit-confirmation', active: open });
/** One wall sample supplied by the UI, never a count of ticks. */
export function integerWallUs(performanceMs: number, lastWallUs: number | null = null): number {
  const wallUs = Math.floor(performanceMs * 1000);
  if (!isTime(wallUs) || (lastWallUs !== null && !isTime(lastWallUs))) throw new RangeError('Invalid monotonic wall sample');
  return Math.max(lastWallUs ?? 0, wallUs);
}
// Use the canonical copy/freeze helper for caller-owned tokens when retained elsewhere.
export const copySessionToken = (token: SessionToken): SessionToken => immutable(token);
