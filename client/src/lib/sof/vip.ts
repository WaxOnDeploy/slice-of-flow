import { validateEngine } from '../sofEngine/engine';
import { isVip } from '../sofEngine/vipRules';
import { immutable, success, type Checked, type Engine } from '../sofEngine/types';
export { makeVipConfig, measureVipResults, VIP_PILOT_TIMINGS, VIP_VERSIONS } from '../sofEngine/vip';
export type { VipVariant, VipConfigOptions, VipResultSummary } from '../sofEngine/vip';
export type VipActivity = Readonly<{
  activeVipOrderKey: string | null;
  exceptions: readonly Readonly<{ station: 'orderQueue' | 'boxDeliver'; orderKey: string; occupancy: number; ordinaryLimit: number }>[];
}>;
/** Derived from real admitted occupancy only. External VIPs are not WIP or active token holders.
 * FIFO can have multiple active VIPs; its activeVipOrderKey is null because it has no token.
 */
export function readVipActivity(engine: Engine): Checked<VipActivity> {
  const checked = validateEngine(engine); if (!checked.ok) return checked;
  const activeVip = engine.config.policy.variantId === 'expedite' ? engine.tickets.find(t => t.status === 'active' && isVip(engine.config, t.orderKey)) : undefined;
  const exceptions: VipActivity['exceptions'][number][] = [];
  if (activeVip) for (const station of ['orderQueue', 'boxDeliver'] as const) {
    const occupancy = engine.tickets.filter(t => t.status === 'active' && t.station === station).length;
    const ordinaryLimit = engine.config.policy.wip[station]!;
    if (activeVip.station === station && occupancy > ordinaryLimit) exceptions.push({ station, orderKey: activeVip.orderKey, occupancy, ordinaryLimit });
  }
  return success(immutable({ activeVipOrderKey: activeVip?.orderKey ?? null, exceptions }));
}
