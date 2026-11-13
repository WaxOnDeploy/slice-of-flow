import { account, blockedDurationsFromValidatedHistory } from './accounting';
import { validateEngine } from './engine';
import { PULL_WIP, resolveManifest, SUPPLIER_PILOT_TIMING, SUPPLIER_VERSIONS, validateConfig, VERSIONS, VIP_RESOURCES } from './scenario';
import { validateSnapshot } from './runSnapshots';
import { isSupplier } from './supplierRules';
import { failure, immutable, isRecord, success, type Checked, type Engine, type RunConfig, type Speed } from './types';

export { SUPPLIER_PILOT_TIMING, SUPPLIER_VERSIONS };
export type SupplierVariant = 'naive' | 'managed';
export type SupplierConfigOptions = Readonly<{ variant: SupplierVariant; initialSpeed?: Speed; guidedStart?: boolean }>;

/** Normal-only, seed-0 deterministic fixed deck. No random demand or configurable disruption. */
export function makeSupplierConfig(input: SupplierConfigOptions): Checked<RunConfig> {
  if (!isRecord(input) || !Reflect.ownKeys(input).every(k => typeof k === 'string' && ['variant', 'initialSpeed', 'guidedStart'].includes(k)) || !Object.hasOwn(input, 'variant')) return failure('INVALID_CONFIG', 'options');
  const manifest = resolveManifest(SUPPLIER_VERSIONS.scenario, 'normal', 0);
  if (!manifest.ok) return manifest;
  return validateConfig({ schema: 'sof-config/v1', engineVersion: VERSIONS.engine, clockRulesVersion: VERSIONS.clock,
    scoringVersion: VERSIONS.scoring, manifest: manifest.value, resources: VIP_RESOURCES,
    initialSpeed: Object.hasOwn(input, 'initialSpeed') ? input.initialSpeed : 3,
    guidedStart: Object.hasOwn(input, 'guidedStart') ? input.guidedStart : false, endCondition: 'fixed-horizon',
    policy: { dimensionId: SUPPLIER_VERSIONS.policy, version: SUPPLIER_VERSIONS.policyVersion, variantId: input.variant, wip: PULL_WIP } });
}

export type SupplierBlock = Readonly<{ blocked: boolean; ageMs: number; owner: 'Supplier'; reason: 'Waiting on supplier'; deliveryAtMs: number }>;
/** Hold envelopes outside active Orders are truthful schedule evidence, not blocked work. */
export function readSupplierBlock(engine: Engine, orderKey: string): SupplierBlock | null {
  if (!validateEngine(engine).ok || !isSupplier(engine.config)) return null;
  const ticket = engine.tickets.find(t => t.orderKey === orderKey);
  if (!ticket || ticket.status !== 'active' || ticket.station !== 'orderQueue' || ticket.admittedAtMs === null) return null;
  const hold = engine.config.manifest.holds.find(h => h.orderKey === orderKey && h.reason === 'supplier-ingredient' &&
    ticket.holds.includes(h.holdId) && h.startMs <= engine.nowMs && engine.nowMs < h.endMs);
  return hold ? immutable({ blocked: true, ageMs: engine.nowMs - Math.max(ticket.admittedAtMs, hold.startMs),
    owner: 'Supplier', reason: 'Waiting on supplier', deliveryAtMs: hold.endMs }) : null;
}

export type SupplierResultSummary = Readonly<{
  definition: 'supplier-results/v1'; scheduledDisruptionMs: number; observedDisruptionMs: number;
  ticketBlockedMs: number; affectedTicketCount: number; served: number; servedN: number;
  servedMeanMs: number | null; unfinished: number; burnt: number; angry: number; score: number;
}>;
/** Observation is the shortage schedule clipped once to the run, not multiplied by tickets.
 * Ticket time is interval union per active Orders ticket only. External/scheduled/exited and
 * already-Prep/Oven/Box tickets do not count. Affected count requires a positive duration.
 * Served-only elapsed time and all score/count values come from the canonical snapshot.
 */
export function measureSupplierResults(input: unknown): Checked<SupplierResultSummary> {
  const checked = validateSnapshot(input); if (!checked.ok) return checked;
  const snapshot = checked.value;
  if (!isSupplier(snapshot.config)) return failure('NOT_SUPPLIER_SCENARIO', 'config.manifest');
  const endMs = snapshot.observation.endMs;
  const folded = account(snapshot.config, snapshot.runId, snapshot.history, endMs); if (!folded.ok) return folded;
  const durations = blockedDurationsFromValidatedHistory(snapshot.config, snapshot.history.events, endMs);
  const ticketBlockedMs = Array.from(durations.values()).reduce((sum, duration) => sum + duration, 0);
  if (ticketBlockedMs !== folded.value.blockedTicketMs) return failure('UNRECONCILED', 'blockedTicketMs');
  const { startMs, endMs: deliveryMs } = SUPPLIER_PILOT_TIMING;
  const metrics = snapshot.metrics;
  return success(immutable({ definition: 'supplier-results/v1', scheduledDisruptionMs: deliveryMs - startMs,
    observedDisruptionMs: Math.max(0, Math.min(deliveryMs, endMs) - startMs), ticketBlockedMs,
    affectedTicketCount: Array.from(durations.values()).filter(duration => duration > 0).length,
    served: metrics.served, servedN: metrics.servedSample.n, servedMeanMs: metrics.servedSample.meanSimMs,
    unfinished: metrics.stillInProgress, burnt: metrics.burnt, angry: metrics.angry, score: metrics.score }));
}
