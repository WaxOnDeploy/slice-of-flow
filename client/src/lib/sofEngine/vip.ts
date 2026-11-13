import { PULL_WIP, resolveManifest, validateConfig, VERSIONS, VIP_PILOT_TIMINGS, VIP_RESOURCES, VIP_VERSIONS } from './scenario';
import { validateSnapshot } from './runSnapshots';
import { deadlinePenalties, isVip, vipOutcome } from './vipRules';
import { failure, immutable, isRecord, success, type Checked, type Difficulty, type FinalRunSnapshot, type RunConfig, type Speed, type Station } from './types';

export { VIP_PILOT_TIMINGS, VIP_VERSIONS };
export type VipVariant = 'fifo' | 'expedite';
export type VipConfigOptions = Readonly<{ difficulty: Difficulty; variant: VipVariant; initialSpeed?: Speed; guidedStart?: boolean }>;
export function makeVipConfig(input: VipConfigOptions): Checked<RunConfig> {
  if (!isRecord(input) || !Reflect.ownKeys(input).every(k => typeof k === 'string' && ['difficulty', 'variant', 'initialSpeed', 'guidedStart'].includes(k)) || !Object.hasOwn(input, 'difficulty') || !Object.hasOwn(input, 'variant')) return failure('INVALID_CONFIG', 'options');
  const manifest = resolveManifest(VIP_VERSIONS.scenario, input.difficulty, 0);
  if (!manifest.ok) return manifest;
  return validateConfig({ schema: 'sof-config/v1', engineVersion: VERSIONS.engine, clockRulesVersion: VERSIONS.clock,
    scoringVersion: VIP_VERSIONS.scoring, manifest: manifest.value, resources: VIP_RESOURCES,
    initialSpeed: Object.hasOwn(input, 'initialSpeed') ? input.initialSpeed : input.difficulty === 'easy' ? 2 : 3,
    guidedStart: Object.hasOwn(input, 'guidedStart') ? input.guidedStart : false, endCondition: 'fixed-horizon',
    policy: { dimensionId: VIP_VERSIONS.policy, version: VIP_VERSIONS.policyVersion, variantId: input.variant, wip: PULL_WIP } });
}
/** Five VIP categories sum to three. Burnt is exclusive; manual discard is unsuccessfully late.
 * Pending means arrived but not successfully closed and observation <= external-arrival deadline.
 * All means are served-only simulated milliseconds, null when their sample is empty.
 * Waiting is a positive-time association, NEVER a causal displacement/delay estimate.
 */
export type VipResultSummary = Readonly<{
  definition: 'vip-results/v1';
  waitingDefinition: 'positive-time/normal-orders-or-ready/active-vip-overlap/v1';
  vipOnTime: number; vipLate: number; vipPending: number; vipNotYetArrived: number; vipBurnt: number;
  normalWaitedDuringVipCount: number; vipServedN: number; normalServedN: number;
  vipMeanArrivalToServedMs: number | null; normalMeanArrivalToServedMs: number | null;
  normalMeanOrdersToServedMs: number | null; score: number; deadlinePenaltyCount: number;
}>;
function waitingOverlap(snapshot: FinalRunSnapshot): number {
  const rows = new Map(snapshot.orders.map(o => [o.orderKey, { active: false, station: null as Station | null, ready: false }]));
  const activeVips = new Set<string>(), waited = new Set<string>();
  let previous = 0;
  for (const e of snapshot.history.events) {
    if (e.atMs > previous && activeVips.size) {
      for (const [key, row] of Array.from(rows.entries())) if (!isVip(snapshot.config, key) && row.active &&
        (row.station === 'orderQueue' || row.station === 'boxDeliver' || row.ready)) waited.add(key);
    }
    previous = e.atMs;
    if (!('orderKey' in e)) continue;
    const row = rows.get(e.orderKey)!;
    if (e.kind === 'admission') { row.active = true; row.station = 'orderQueue'; if (isVip(snapshot.config, e.orderKey)) activeVips.add(e.orderKey); }
    if (e.kind === 'movement') { row.station = e.to; row.ready = false; }
    if (e.kind === 'ready') row.ready = true;
    if (e.kind === 'service' || e.kind === 'discard') { row.active = false; row.station = null; row.ready = false; activeVips.delete(e.orderKey); }
  }
  return waited.size;
}
export function measureVipResults(input: unknown): Checked<VipResultSummary> {
  const checked = validateSnapshot(input); if (!checked.ok) return checked;
  const snapshot = checked.value, config = snapshot.config, endMs = snapshot.observation.endMs;
  if (config.manifest.scenarioId !== 'vip-expedite') return failure('NOT_VIP_SCENARIO', 'config.manifest');
  const counts = { 'on-time': 0, late: 0, pending: 0, 'not-yet-arrived': 0, burnt: 0 };
  for (const row of snapshot.orders.filter(o => isVip(config, o.orderKey))) counts[vipOutcome(config, row, endMs)]++;
  const vipServed = snapshot.orders.filter(o => isVip(config, o.orderKey) && o.outcome === 'served');
  const normalServed = snapshot.orders.filter(o => !isVip(config, o.orderKey) && o.outcome === 'served');
  const mean = (rows: typeof vipServed, arrival: boolean) => rows.length ? rows.reduce((sum, row) => sum + row.exitedAtMs! - (arrival ? config.manifest.orders.find(o => o.orderKey === row.orderKey)!.availableAtMs : row.admittedAtMs!), 0) / rows.length : null;
  return success(immutable({ definition: 'vip-results/v1', waitingDefinition: 'positive-time/normal-orders-or-ready/active-vip-overlap/v1',
    vipOnTime: counts['on-time'], vipLate: counts.late, vipPending: counts.pending, vipNotYetArrived: counts['not-yet-arrived'], vipBurnt: counts.burnt,
    normalWaitedDuringVipCount: waitingOverlap(snapshot), vipServedN: vipServed.length, normalServedN: normalServed.length,
    vipMeanArrivalToServedMs: mean(vipServed, true), normalMeanArrivalToServedMs: mean(normalServed, true),
    normalMeanOrdersToServedMs: mean(normalServed, false), score: snapshot.metrics.score, deadlinePenaltyCount: deadlinePenalties(config, snapshot.orders, endMs) }));
}
