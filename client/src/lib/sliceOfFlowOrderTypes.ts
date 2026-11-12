import { SOLO_DECK, type Complexity, type OrderCard } from './sliceOfFlowConstants';

/** Display-only metadata. The deck and store remain the source of game rules. */
export type OrderGuideCard = Pick<OrderCard, 'pizzaType' | 'complexity' | 'prepTime' | 'ovenTime'>;
export type NormalOrderPolicy = 'normalSmall' | 'normalMedium' | 'normalLarge';

export interface OrderSizeRule {
  readonly size: Complexity;
  /** Simulated kitchen seconds, not wall-clock seconds. */
  readonly prepTime: number;
  readonly ovenTime: number;
  readonly policy: NormalOrderPolicy;
}

export interface OrderTypeMetadata extends OrderSizeRule {
  readonly pizzaType: string;
  readonly priority: 'standard';
  readonly extraCapacity: 0;
  readonly expedited: false;
}

const NORMAL_POLICIES: Record<Complexity, NormalOrderPolicy> = {
  Small: 'normalSmall',
  Medium: 'normalMedium',
  Large: 'normalLarge',
};

/** Preserve first appearance; do not sort, shuffle, or mutate any cards. */
export function getOrderTypeMetadata(
  deck: readonly OrderGuideCard[] = SOLO_DECK,
): readonly OrderTypeMetadata[] {
  const seen = new Set<string>();
  const types: OrderTypeMetadata[] = [];
  for (const card of deck) {
    // Include the timing/size signature so a type with multiple rules stays complete.
    const key = JSON.stringify([card.pizzaType, card.complexity, card.prepTime, card.ovenTime]);
    if (seen.has(key)) continue;
    seen.add(key);
    types.push(Object.freeze({
      pizzaType: card.pizzaType,
      size: card.complexity,
      prepTime: card.prepTime,
      ovenTime: card.ovenTime,
      policy: NORMAL_POLICIES[card.complexity],
      priority: 'standard',
      extraCapacity: 0,
      expedited: false,
    }));
  }
  return Object.freeze(types);
}

/** All size/timing rules actually present in the supplied deck. */
export function getOrderSizeRules(
  deck: readonly OrderGuideCard[] = SOLO_DECK,
): readonly OrderSizeRule[] {
  const seen = new Set<string>();
  const rules: OrderSizeRule[] = [];
  for (const type of getOrderTypeMetadata(deck)) {
    const key = JSON.stringify([type.size, type.prepTime, type.ovenTime]);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(Object.freeze({
      size: type.size,
      prepTime: type.prepTime,
      ovenTime: type.ovenTime,
      policy: type.policy,
    }));
  }
  return Object.freeze(rules);
}

export const ACTIVE_ORDER_TYPES = getOrderTypeMetadata();
export const ACTIVE_SIZE_RULES = getOrderSizeRules();

/** Explicitly describe Custom Build; this copy grants no new gameplay privileges. */
export function getOrderTypePolicyCopy(type: OrderTypeMetadata): string {
  return `${type.pizzaType} is an ordinary ${type.size} pizza (${type.prepTime}s Prep / ${type.ovenTime}s Oven). No VIP priority, no extra capacity, and no expedited handling.`;
}
