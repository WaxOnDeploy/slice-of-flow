import { scoreCounts } from './scenario';
import type { FinalOrder, RunConfig, Station } from './types';

export const isVip = (config: RunConfig, orderKey: string): boolean => config.manifest.orders.some(o => o.orderKey === orderKey && o.serviceClass === 'vip');
/** The exception belongs to the admitted VIP, not to a normal ticket or external backlog. */
export function policyLimit(config: RunConfig, station: Station, vipPresent: boolean): number | null {
  const limit = config.policy.wip[station];
  return limit !== null && config.policy.variantId === 'expedite' && vipPresent && (station === 'orderQueue' || station === 'boxDeliver') ? limit + 1 : limit;
}
export type VipOutcome = 'on-time' | 'late' | 'pending' | 'not-yet-arrived' | 'burnt';
/** Five exclusive categories; unsuccessfully closed manual discards count as late, even early. */
export function vipOutcome(config: RunConfig, row: FinalOrder, endMs: number): VipOutcome {
  const spec = config.manifest.orders.find(o => o.orderKey === row.orderKey)!;
  if (row.outcome === 'burnt') return 'burnt';
  if (row.outcome === 'served') return row.exitedAtMs! <= spec.deadlineAtMs! ? 'on-time' : 'late';
  if (row.outcome === 'discarded') return 'late';
  if (spec.availableAtMs > endMs) return 'not-yet-arrived';
  return endMs > spec.deadlineAtMs! ? 'late' : 'pending';
}
/** A missed deadline is charged once only; a later burn replaces rather than adds to it.
 * Successful on-time closure cannot later expire. Unsuccessful closure remains unserved.
 * Equality is not expiry, so an action at the exact deadline may serve on time.
 */
export function deadlinePenalties(config: RunConfig, rows: readonly FinalOrder[], endMs: number): number {
  if (config.manifest.scenarioId !== 'vip-expedite') return 0;
  return rows.filter(row => {
    if (!isVip(config, row.orderKey) || row.outcome === 'burnt') return false;
    const deadline = config.manifest.orders.find(o => o.orderKey === row.orderKey)!.deadlineAtMs!;
    return (row.outcome === 'served' ? row.exitedAtMs! : endMs) > deadline;
  }).length;
}
export function runScore(config: RunConfig, rows: readonly FinalOrder[], endMs: number): number {
  const served = rows.filter(o => o.outcome === 'served').length;
  const burnt = rows.filter(o => o.outcome === 'burnt').length;
  // VIP deadlines replace ordinary anger, not another penalty layered on top.
  const angry = rows.filter(o => o.angry && o.outcome !== 'burnt' && o.admittedAtMs !== null && !isVip(config, o.orderKey)).length;
  return scoreCounts(served, burnt, angry) - 2 * deadlinePenalties(config, rows, endMs);
}
