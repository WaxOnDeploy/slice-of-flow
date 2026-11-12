import { validateEngine } from '../sofEngine/engine';
import { isVip } from '../sofEngine/vipRules';
import { immutable, success, type Checked, type Engine } from '../sofEngine/types';

/** Current observed overlap only. No causal delay or counterfactual displacement claim. */
export function readCurrentNormalVipWait(engine: Engine): Checked<readonly string[]> {
  const checked = validateEngine(engine);
  if (!checked.ok) return checked;
  const activeVips = engine.tickets.filter(t => t.status === 'active' && isVip(engine.config, t.orderKey));
  const keys: string[] = [];
  for (const ticket of engine.tickets) {
    if (ticket.status !== 'active' || isVip(engine.config, ticket.orderKey)) continue;
    let from: number | null = null;
    if (ticket.station === 'orderQueue') from = ticket.admittedAtMs;
    else if (ticket.station === 'prep' && ticket.ready) from = ticket.prepReadyAtMs;
    else if (ticket.station === 'oven' && ticket.ready) from = ticket.ovenReadyAtMs;
    else if (ticket.station === 'boxDeliver') {
      const entry = [...engine.events].reverse().find(event => event.kind === 'movement' && event.orderKey === ticket.orderKey && event.to === 'boxDeliver');
      from = entry?.atMs ?? null;
    }
    if (from !== null && activeVips.some(vip => vip.admittedAtMs !== null && engine.nowMs > Math.max(from!, vip.admittedAtMs))) keys.push(ticket.orderKey);
  }
  return success(immutable(keys));
}
