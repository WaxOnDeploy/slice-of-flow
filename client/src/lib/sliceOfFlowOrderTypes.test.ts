import { describe, expect, it } from 'vitest';
import { SOLO_DECK, SOLO_SHUFFLE_ORDER } from './sliceOfFlowConstants';
import {
  ACTIVE_ORDER_TYPES,
  ACTIVE_SIZE_RULES,
  getOrderSizeRules,
  getOrderTypeMetadata,
  getOrderTypePolicyCopy,
} from './sliceOfFlowOrderTypes';

const expectedDeck = [
  ['order-1', 1, 'Sarah', 'Cheese', 'Small', 30, 40, '#4CAF50'],
  ['order-2', 2, 'Carlos', 'Pepperoni', 'Small', 30, 40, '#4CAF50'],
  ['order-3', 3, 'Rachel', 'Veggie Supreme', 'Medium', 60, 60, '#FFC107'],
  ['order-4', 4, 'Dan', 'Cheese', 'Small', 30, 40, '#4CAF50'],
  ['order-5', 5, 'Aisha', 'Meat Lovers', 'Medium', 60, 60, '#FFC107'],
  ['order-6', 6, 'Priya', 'Cheese', 'Small', 30, 40, '#4CAF50'],
  ['order-7', 7, 'Tom', 'Veggie Supreme', 'Medium', 60, 60, '#FFC107'],
  ['order-8', 8, 'Lisa', 'Pepperoni', 'Small', 30, 40, '#4CAF50'],
  ['order-9', 9, 'Marcus', 'Custom Build', 'Large', 90, 80, '#F44336'],
  ['order-10', 10, 'Derek', 'Meat Lovers', 'Medium', 60, 60, '#FFC107'],
  ['order-11', 11, 'Nina', 'Veggie Supreme', 'Medium', 60, 60, '#FFC107'],
  ['order-12', 12, 'Sophie', 'Custom Build', 'Large', 90, 80, '#F44336'],
];

describe('display-only active order metadata', () => {
  it('includes every actual pizzaType in first-appearance order', () => {
    expect(ACTIVE_ORDER_TYPES.map(type => type.pizzaType)).toEqual([
      'Cheese', 'Pepperoni', 'Veggie Supreme', 'Meat Lovers', 'Custom Build',
    ]);
    expect(ACTIVE_ORDER_TYPES.map(type => type.pizzaType)).toEqual([...new Set(SOLO_DECK.map(card => card.pizzaType))]);
    for (const card of SOLO_DECK) {
      expect(ACTIVE_ORDER_TYPES).toContainEqual(expect.objectContaining({
        pizzaType: card.pizzaType,
        size: card.complexity,
        prepTime: card.prepTime,
        ovenTime: card.ovenTime,
      }));
    }
  });

  it('exposes all actual size rules without duplicated entries', () => {
    expect(ACTIVE_SIZE_RULES).toEqual([
      { size: 'Small', prepTime: 30, ovenTime: 40, policy: 'normalSmall' },
      { size: 'Medium', prepTime: 60, ovenTime: 60, policy: 'normalMedium' },
      { size: 'Large', prepTime: 90, ovenTime: 80, policy: 'normalLarge' },
    ]);
  });

  it('makes Custom Build explicitly normalLarge with no special privileges', () => {
    const custom = ACTIVE_ORDER_TYPES.find(type => type.pizzaType === 'Custom Build')!;
    expect(custom).toEqual({
      pizzaType: 'Custom Build', size: 'Large', prepTime: 90, ovenTime: 80,
      policy: 'normalLarge', priority: 'standard', extraCapacity: 0, expedited: false,
    });
    expect(getOrderTypePolicyCopy(custom)).toBe('Custom Build is an ordinary Large pizza (90s Prep / 80s Oven). No VIP priority, no extra capacity, and no expedited handling.');
    expect(ACTIVE_ORDER_TYPES.every(type => type.priority === 'standard' && type.extraCapacity === 0 && !type.expedited)).toBe(true);
  });

  it('does not change the active deck, IDs, order, customers, colors, or timings', () => {
    const before = JSON.stringify(SOLO_DECK);
    getOrderTypeMetadata();
    getOrderSizeRules();
    expect(JSON.stringify(SOLO_DECK)).toBe(before);
    expect(SOLO_DECK.map(card => [card.id, card.orderNumber, card.customer, card.pizzaType, card.complexity, card.prepTime, card.ovenTime, card.color])).toEqual(expectedDeck);
    expect(SOLO_SHUFFLE_ORDER).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(SOLO_DECK.every(card => !('policy' in card) && !('priority' in card))).toBe(true);
    expect(Object.isFrozen(ACTIVE_ORDER_TYPES)).toBe(true);
    expect(ACTIVE_ORDER_TYPES.every(Object.isFrozen)).toBe(true);
  });

  it('derives new menu labels and additional rules from supplied cards without mutating them', () => {
    const deck = [
      { pizzaType: 'House Special', complexity: 'Medium', prepTime: 65, ovenTime: 70 },
      { pizzaType: 'House Special', complexity: 'Large', prepTime: 95, ovenTime: 85 },
      { pizzaType: 'House Special', complexity: 'Medium', prepTime: 65, ovenTime: 70 },
    ] as const;
    const before = JSON.stringify(deck);
    expect(getOrderTypeMetadata(deck)).toHaveLength(2);
    expect(getOrderSizeRules(deck)).toEqual([
      { size: 'Medium', prepTime: 65, ovenTime: 70, policy: 'normalMedium' },
      { size: 'Large', prepTime: 95, ovenTime: 85, policy: 'normalLarge' },
    ]);
    expect(JSON.stringify(deck)).toBe(before);
    expect(getOrderTypeMetadata([])).toEqual([]);
  });
});
