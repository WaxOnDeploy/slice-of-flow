// Slice of Flow — Game Constants
// Design: "Illustrated Pizza Kitchen" — warm Italian kitchen aesthetic

// ─── TIMING ────────────────────────────────────────────────
export const ROUND_DURATION_SOLO = 5 * 60; // 5 minutes in seconds
export const ORDER_FLIP_INTERVAL_SOLO = 15; // seconds between auto-flips in Round 1
export const OVEN_BURN_TIME = 150; // 2:30 in seconds — pizza burns
export const OVEN_DONE_TIME = 120; // 2:00 in seconds — pizza is done
export const OVEN_WARNING_TIME = 90; // 1:30 in seconds — sizzle warning
export const ANGRY_THRESHOLD = 240; // 4 min lead time = angry customer

// ─── WIP LIMITS (Round 2) ─────────────────────────────────
export const WIP_LIMITS = {
  orderQueue: 4,
  prep: 2,
  oven: 3, // physical constraint — always enforced
  boxDeliver: 2,
} as const;

// ─── SCORING ───────────────────────────────────────────────
export const SCORE_SERVED = 1;
export const SCORE_BURNT = -2;
export const SCORE_ANGRY = -1;
export const SCORE_ZERO_BURNS_BONUS = 3;

// ─── COLUMNS ───────────────────────────────────────────────
export type ColumnId = 'orderDeck' | 'orderQueue' | 'prep' | 'oven' | 'boxDeliver' | 'served';

export const COLUMNS: { id: ColumnId; label: string; color: string; bgColor: string }[] = [
  { id: 'orderDeck', label: 'Order Deck', color: '#9E9E9E', bgColor: '#E0E0E0' },
  { id: 'orderQueue', label: 'Orders', color: '#1976D2', bgColor: '#90CAF9' },
  { id: 'prep', label: 'Prep', color: '#F9A825', bgColor: '#FFE082' },
  { id: 'oven', label: 'Oven', color: '#E64A19', bgColor: '#FF8A65' },
  { id: 'boxDeliver', label: 'Box & Deliver', color: '#388E3C', bgColor: '#A5D6A7' },
  { id: 'served', label: 'Served', color: '#2E7D32', bgColor: '#4CAF50' },
];

// Column flow order for validation (cards can only move forward)
export const COLUMN_ORDER: ColumnId[] = ['orderDeck', 'orderQueue', 'prep', 'oven', 'boxDeliver', 'served'];

// ─── CARD COMPLEXITY ───────────────────────────────────────
export type Complexity = 'Small' | 'Medium' | 'Large';

export interface OrderCard {
  id: string;
  orderNumber: number;
  customer: string;
  pizzaType: string;
  complexity: Complexity;
  prepTime: number; // seconds
  ovenTime: number; // seconds
  color: string; // card accent color
  // Runtime state
  column: ColumnId;
  prepTimerStarted?: number; // timestamp
  prepTimerRemaining?: number;
  ovenTimerStarted?: number; // timestamp
  ovenTimerRemaining?: number;
  enteredQueueAt?: number; // timestamp for lead time calc
  servedAt?: number;
  burnt?: boolean;
  angry?: boolean;
}

// ─── ORDER DECK (12 cards for solo mode) ───────────────────
export const SOLO_DECK: Omit<OrderCard, 'column' | 'prepTimerStarted' | 'prepTimerRemaining' | 'ovenTimerStarted' | 'ovenTimerRemaining' | 'enteredQueueAt' | 'servedAt' | 'burnt' | 'angry'>[] = [
  { id: 'order-1', orderNumber: 1, customer: 'Sarah', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60, ovenTime: 120, color: '#4CAF50' },
  { id: 'order-2', orderNumber: 2, customer: 'Carlos', pizzaType: 'Pepperoni', complexity: 'Small', prepTime: 60, ovenTime: 120, color: '#4CAF50' },
  { id: 'order-3', orderNumber: 3, customer: 'Rachel', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120, ovenTime: 120, color: '#FFC107' },
  { id: 'order-4', orderNumber: 4, customer: 'Dan', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60, ovenTime: 120, color: '#4CAF50' },
  { id: 'order-5', orderNumber: 5, customer: 'Aisha', pizzaType: 'Meat Lovers', complexity: 'Medium', prepTime: 120, ovenTime: 120, color: '#FFC107' },
  { id: 'order-6', orderNumber: 6, customer: 'Priya', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60, ovenTime: 120, color: '#4CAF50' },
  { id: 'order-7', orderNumber: 7, customer: 'Tom', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120, ovenTime: 120, color: '#FFC107' },
  { id: 'order-8', orderNumber: 8, customer: 'Lisa', pizzaType: 'Pepperoni', complexity: 'Small', prepTime: 60, ovenTime: 120, color: '#4CAF50' },
  { id: 'order-9', orderNumber: 9, customer: 'Marcus', pizzaType: 'Custom Build', complexity: 'Large', prepTime: 180, ovenTime: 120, color: '#F44336' },
  { id: 'order-10', orderNumber: 10, customer: 'Derek', pizzaType: 'Meat Lovers', complexity: 'Medium', prepTime: 120, ovenTime: 120, color: '#FFC107' },
  { id: 'order-11', orderNumber: 11, customer: 'Nina', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120, ovenTime: 120, color: '#FFC107' },
  { id: 'order-12', orderNumber: 12, customer: 'Sophie', pizzaType: 'Custom Build', complexity: 'Large', prepTime: 180, ovenTime: 120, color: '#F44336' },
];

// Default shuffle order for solo (mixes complexity)
export const SOLO_SHUFFLE_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// ─── DESIGN TOKENS ─────────────────────────────────────────
export const COLORS = {
  background: '#FAF7F2',
  primary: '#D94F3B', // Tomato red — "SLICE"
  secondary: '#D4A843', // Warm gold — "OF FLOW"
  danger: '#B71C1C',
  angry: '#E65100',
  text: '#333333',
  textLight: '#666666',
  success: '#4CAF50',
  brick: '#C75B39',
} as const;

// ─── GAME PHASES ───────────────────────────────────────────
export type GamePhase = 'landing' | 'round1' | 'transition' | 'round2' | 'debrief';

// ─── METRICS ───────────────────────────────────────────────
export interface RoundMetrics {
  served: number;
  burnt: number;
  angry: number;
  avgLeadTime: number; // seconds
  stillInProgress: number;
  score: number;
}
