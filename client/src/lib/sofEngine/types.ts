import type { Complexity, Difficulty } from '../sliceOfFlowConstants';

export type { Complexity, Difficulty };
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type SimMs = number;
export type WallUs = number;
export type RunId = string;
export type OrderKey = string;
export type OrderId = string;
export type Speed = 1 | 2 | 3;
export const STATIONS = ['orderQueue', 'prep', 'oven', 'boxDeliver'] as const;
export type Station = typeof STATIONS[number];
export const PAUSE_REASONS = ['instruction', 'guide', 'help', 'facilitator', 'transition', 'exit-confirmation', 'hidden'] as const;
export type PauseReason = typeof PAUSE_REASONS[number];
export type EndReason = 'horizon' | 'all-resolved' | 'manual-stop' | 'service-bell';
export type EndCondition = 'fixed-horizon' | 'all-resolved-or-horizon';
export type ValidationIssue = Readonly<{ code: string; path: string }>;
export type Checked<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;
export type OrderRef = Readonly<{ orderKey: OrderKey; orderId: OrderId }>;
export type DemandOrder = Readonly<{
  orderKey: OrderKey; ordinal: number; orderTypeId: string; complexity: Complexity;
  availableAtMs: SimMs; prepMs: SimMs; bakeMs: SimMs;
  /** Present together only on VIP demand; normals preserve the original exact shape. */
  serviceClass?: 'vip'; deadlineAtMs?: SimMs;
}>;
export type HoldSpec = Readonly<{
  holdId: string; orderKey: OrderKey; startMs: SimMs; endMs: SimMs; reason: 'fixture-dependency';
}>;
export type Manifest = DeepReadonly<{
  schema: 'sof-manifest/v1'; scenarioId: 'fixed-deck' | 'vip-expedite'; scenarioVersion: string;
  generatorVersion: string; seed: 0; difficulty: Difficulty; horizonMs: SimMs;
  pushIntervalMs: SimMs; burnBufferMs: SimMs; patienceMs: SimMs;
  orders: DemandOrder[]; holds: HoldSpec[];
}>;
export type Resources = DeepReadonly<{
  occupancy: Record<Station, number | null>;
  processing: Record<'prep' | 'oven', { kind: 'per-active-ticket' } | { kind: 'fixed'; slots: number }>;
}>;
export type RunConfig = DeepReadonly<{
  schema: 'sof-config/v1'; engineVersion: string; clockRulesVersion: string; scoringVersion: string;
  manifest: Manifest; resources: Resources; initialSpeed: Speed; guidedStart: boolean;
  endCondition: EndCondition;
  policy: {
    dimensionId: string; version: string; variantId: 'interval-push' | 'manual-pull' | 'fifo' | 'expedite';
    wip: Record<Station, number | null>;
  };
}>;
export type EngineCommand =
  | Readonly<{ kind: 'admit'; orderKey: OrderKey }>
  | Readonly<{ kind: 'move'; orderKey: OrderKey; to: Station | 'served' }>
  | Readonly<{ kind: 'discard'; orderKey: OrderKey }>
  | Readonly<{ kind: 'set-pause'; reason: PauseReason; active: boolean }>
  | Readonly<{ kind: 'speed'; speed: Speed }>
  | Readonly<{ kind: 'end'; reason: 'manual-stop' }>;
export type EventData =
  | Readonly<{ kind: 'runStarted' }>
  | (OrderRef & Readonly<{ kind: 'arrival' }>)
  | (OrderRef & Readonly<{ kind: 'admission'; by: 'push' | 'pull' | 'guide' }>)
  | (OrderRef & Readonly<{ kind: 'movement'; from: Station; to: Station }>)
  | (OrderRef & Readonly<{ kind: 'ready'; station: 'prep' | 'oven' }>)
  | (OrderRef & Readonly<{ kind: 'service'; from: 'boxDeliver' }>)
  | (OrderRef & Readonly<{ kind: 'discard'; from: Station; reason: 'burnt' | 'manual' }>)
  | (OrderRef & Readonly<{ kind: 'anger' }>)
  | (OrderRef & Readonly<{ kind: 'blockStart' | 'blockEnd'; holdId: string }>)
  | Readonly<{ kind: 'commandAccepted'; commandClass: 'gameplay' | 'control'; command: EngineCommand }>
  | Readonly<{ kind: 'runEnded'; reason: EndReason }>;
export type EngineEvent = DeepReadonly<EventData & { runId: RunId; seq: number; atMs: SimMs }>;
export type HistoryEvidence = DeepReadonly<{
  schema: 'sof-history/v1'; source: 'engine-boundary'; completeness: 'complete'; events: EngineEvent[];
}>;
export type FinalOrder = DeepReadonly<OrderRef & {
  outcome: 'not-admitted' | 'active' | 'served' | 'burnt' | 'discarded';
  finalStation: Station | null; admittedAtMs: SimMs | null; exitedAtMs: SimMs | null; angry: boolean;
}>;
export type MeasuredServedSample = Readonly<{
  definition: 'orders-to-served/nonnegative-elapsed/v1'; n: number; sumSimMs: number; meanSimMs: number | null;
}>;
export type FinalRunSnapshot = DeepReadonly<{
  schema: 'sof-run/v1'; kind: 'independent-final'; runId: RunId; config: RunConfig; history: HistoryEvidence;
  observation: { startMs: 0; endMs: SimMs; durationMs: SimMs }; endReason: EndReason; orders: FinalOrder[];
  metrics: { served: number; burnt: number; angry: number; stillInProgress: number; score: number;
    servedSample: MeasuredServedSample };
}>;
export type Ticket = DeepReadonly<OrderRef & {
  status: 'scheduled' | 'external' | 'active' | 'served' | 'burnt' | 'discarded';
  station: Station | null; admittedAtMs: SimMs | null; exitedAtMs: SimMs | null;
  prepReadyAtMs: SimMs | null; ovenReadyAtMs: SimMs | null; burnAtMs: SimMs | null;
  ready: boolean; angry: boolean; holds: string[];
}>;
export type Engine = DeepReadonly<{
  runId: RunId; config: RunConfig; nowMs: SimMs; speed: Speed; pausedBy: PauseReason[];
  guide: 'pending' | 'moved' | 'complete'; nextPushAtMs: SimMs | null;
  tickets: Ticket[]; events: EngineEvent[]; ended: EndReason | null;
}>;
export type Step = Readonly<{ state: Engine; emitted: readonly EngineEvent[] }>;
export type ActionResult = Step & Readonly<{ accepted: boolean; issues: readonly ValidationIssue[] }>;
export type Driver = Readonly<{ runId: RunId; lastWallUs: WallUs | null; remainderUs: number }>;
export type DriverStep = Step & Readonly<{ driver: Driver }>;
export type ReplayFrame = Readonly<{ atMs: SimMs; command: EngineCommand }>;
export type RunDraft = DeepReadonly<{
  schema: 'sof-draft/v1'; runId: RunId; config: RunConfig; final: FinalRunSnapshot | null;
}>;
export type RunArchive = DeepReadonly<{ schema: 'sof-archive/v1'; runs: FinalRunSnapshot[] }>;
export type Finalization = Readonly<{ draft: RunDraft; snapshot: FinalRunSnapshot }>;
export type AccountingOrder = DeepReadonly<FinalOrder & { arrived: boolean; holds: string[] }>;
export type Accounting = DeepReadonly<{
  arrived: number; external: number; admitted: number; active: number; served: number; burnt: number;
  otherDiscard: number; discarded: number; byStation: Record<Station, number>;
  stateAreaMs: Record<Station, number>; areaTicketMs: number; blockedTicketMs: number;
  orders: AccountingOrder[]; servedSample: MeasuredServedSample;
}>;

/** Copy only plain JSON-shaped owned data, then freeze every nested object. */
export function immutable<T>(input: T): DeepReadonly<T> {
  const copy = (v: unknown): unknown => {
    if (Array.isArray(v)) return Object.freeze(v.map(copy));
    if (v !== null && typeof v === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(v)) result[key] = copy(value);
      return Object.freeze(result);
    }
    return v;
  };
  return copy(input) as DeepReadonly<T>;
}
export function success<T>(value: T): Checked<T> { return Object.freeze({ ok: true, value }); }
export function failure<T = never>(code: string, path = ''): Checked<T> {
  return immutable({ ok: false as const, issues: [{ code, path }] });
}
export function isTime(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number) >= 0; }
export function isCode(v: unknown): v is string { return typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,95}$/.test(v); }
export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
export function exactKeys(v: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Reflect.ownKeys(v);
  return own.length === keys.length && own.every(k => typeof k === 'string' && keys.includes(k)) &&
    keys.every(k => Object.hasOwn(v, k));
}
export function commandClass(command: EngineCommand): 'gameplay' | 'control' {
  return ['admit', 'move', 'discard'].includes(command.kind) ? 'gameplay' : 'control';
}
export function validateCommand(input: unknown): Checked<EngineCommand> {
  if (!isRecord(input) || typeof input.kind !== 'string') return failure('INVALID_COMMAND', 'command');
  const shapes: Record<string, readonly string[]> = {
    admit: ['kind', 'orderKey'], move: ['kind', 'orderKey', 'to'], discard: ['kind', 'orderKey'],
    'set-pause': ['kind', 'reason', 'active'], speed: ['kind', 'speed'], end: ['kind', 'reason'],
  };
  if (!Object.hasOwn(shapes, input.kind) || !exactKeys(input, shapes[input.kind])) return failure('INVALID_COMMAND', 'command');
  if (['admit', 'move', 'discard'].includes(input.kind) && !isCode(input.orderKey)) return failure('INVALID_ID', 'command.orderKey');
  if (input.kind === 'move' && ![...STATIONS, 'served'].includes(input.to as Station)) return failure('INVALID_MOVE', 'command.to');
  if (input.kind === 'set-pause' && (!PAUSE_REASONS.includes(input.reason as PauseReason) || typeof input.active !== 'boolean')) return failure('INVALID_CONTROL', 'command');
  if (input.kind === 'speed' && ![1, 2, 3].includes(input.speed as number)) return failure('INVALID_CONTROL', 'command.speed');
  if (input.kind === 'end' && input.reason !== 'manual-stop') return failure('INVALID_CONTROL', 'command.reason');
  return success(immutable(input) as EngineCommand);
}
/** Structural equality for validated DTOs; key insertion order is not identity. */
export function equivalent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equivalent(v, b[i]));
  if (isRecord(a) && isRecord(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equivalent(a[k], b[k]));
  return false;
}
