import type { RunConfig, Station } from './types';

export const isSupplier = (config: RunConfig): boolean => config.manifest.scenarioId === 'supplier-shortage';

/** Fixture dependencies block every active movement; ingredients only gate starting Prep.
 * Boundary hold membership is retained for external/exited/already-started tickets.
 */
export function movementBlocked(config: RunConfig, holdIds: readonly string[], station: Station): boolean {
  return holdIds.some(id => {
    const hold = config.manifest.holds.find(h => h.holdId === id);
    return hold?.reason === 'fixture-dependency' || (hold?.reason === 'supplier-ingredient' && station === 'orderQueue');
  });
}

/** Call only with admitted active Orders. A blocked head remains the naive head. */
export function oldestSupplierOrder(config: RunConfig, rows: readonly { orderKey: string; admittedAtMs: number | null }[]): string | undefined {
  return [...rows].sort((a, b) => {
    const x = config.manifest.orders.find(o => o.orderKey === a.orderKey)!;
    const y = config.manifest.orders.find(o => o.orderKey === b.orderKey)!;
    return a.admittedAtMs! - b.admittedAtMs! || x.ordinal - y.ordinal ||
      (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0);
  })[0]?.orderKey;
}
