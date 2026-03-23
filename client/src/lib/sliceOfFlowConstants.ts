// Slice of Flow — Game Constants
// Design: "Illustrated Pizza Kitchen" — warm Italian kitchen aesthetic

// ─── TIMING ────────────────────────────────────────────────
export const ROUND_DURATION_SOLO = 5 * 60; // 5 minutes in seconds
export const ORDER_FLIP_INTERVAL_SOLO = 15; // seconds between auto-flips in Round 1
export const OVEN_BURN_TIME = 75; // 1:15 in seconds — pizza burns (halved)
export const OVEN_DONE_TIME = 60; // 1:00 in seconds — pizza is done (halved)
export const OVEN_WARNING_TIME = 45; // 0:45 in seconds — sizzle warning (halved)
export const ANGRY_THRESHOLD = 480; // 8 min lead time = angry customer (doubled)

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
  prepTimerStarted?: number | boolean; // flag or timestamp
  prepTimerRemaining?: number;
  ovenTimerStarted?: number | boolean; // flag or timestamp
  ovenTimerRemaining?: number;
  enteredQueueAt?: number; // legacy timestamp
  servedAt?: number; // legacy timestamp
  simEnteredQueueAt?: number; // simulated game clock when entered queue
  simServedAt?: number; // simulated game clock when served
  simElapsedInQueue?: number; // simulated seconds spent in system
  burnt?: boolean;
  angry?: boolean;
}

// ─── ORDER DECK (12 cards for solo mode) ───────────────────
export const SOLO_DECK: Omit<OrderCard, 'column' | 'prepTimerStarted' | 'prepTimerRemaining' | 'ovenTimerStarted' | 'ovenTimerRemaining' | 'enteredQueueAt' | 'servedAt' | 'simEnteredQueueAt' | 'simServedAt' | 'simElapsedInQueue' | 'burnt' | 'angry'>[] = [
  { id: 'order-1', orderNumber: 1, customer: 'Sarah', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60, ovenTime: 60, color: '#4CAF50' },
  { id: 'order-2', orderNumber: 2, customer: 'Carlos', pizzaType: 'Pepperoni', complexity: 'Small', prepTime: 60, ovenTime: 60, color: '#4CAF50' },
  { id: 'order-3', orderNumber: 3, customer: 'Rachel', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120, ovenTime: 60, color: '#FFC107' },
  { id: 'order-4', orderNumber: 4, customer: 'Dan', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60,ovenTime: 60, color: '#4CAF50' },
  { id: 'order-5', orderNumber: 5, customer: 'Aisha', pizzaType: 'Meat Lovers', complexity: 'Medium', prepTime: 120,ovenTime: 60, color: '#FFC107' },
  { id: 'order-6', orderNumber: 6, customer: 'Priya', pizzaType: 'Cheese', complexity: 'Small', prepTime: 60, ovenTime: 60, color: '#4CAF50' },
  { id: 'order-7', orderNumber: 7, customer: 'Tom', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120, ovenTime: 60, color: '#FFC107' },
  { id: 'order-8', orderNumber: 8, customer: 'Lisa', pizzaType: 'Pepperoni', complexity: 'Small', prepTime: 60, ovenTime: 60, color: '#4CAF50' },
  { id: 'order-9', orderNumber: 9, customer: 'Marcus', pizzaType: 'Custom Build', complexity: 'Large', prepTime: 180,ovenTime: 60, color: '#F44336' },
  { id: 'order-10', orderNumber: 10, customer: 'Derek', pizzaType: 'Meat Lovers', complexity: 'Medium', prepTime: 120, ovenTime: 60, color: '#FFC107' },
  { id: 'order-11', orderNumber: 11, customer: 'Nina', pizzaType: 'Veggie Supreme', complexity: 'Medium', prepTime: 120,ovenTime: 60, color: '#FFC107' },
  { id: 'order-12', orderNumber: 12, customer: 'Sophie', pizzaType: 'Custom Build', complexity: 'Large', prepTime: 180, ovenTime: 60, color: '#F44336' },
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

// ─── DIFFICULTY PRESETS ────────────────────────────────────
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyPreset {
  label: string;
  description: string;
  icon: string;
  roundDuration: number; // seconds
  orderFlipInterval: number; // seconds between auto-flips
  ovenBurnTime: number; // seconds
  ovenDoneTime: number; // seconds
  ovenWarningTime: number; // seconds
  angryThreshold: number; // seconds
  defaultSpeed: 1 | 2 | 3;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    label: 'Easy',
    description: 'Longer rounds, slower orders. Great for learning.',
    icon: '🧑‍🍳',
    roundDuration: 7 * 60, // 7 minutes
    orderFlipInterval: 20, // 20 seconds
    ovenBurnTime: 90, // 1:30 (halved)
    ovenDoneTime: 60, // 1:00 (halved)
    ovenWarningTime: 50, // 0:50 (halved)
    angryThreshold: 600, // 10 min (doubled)
    defaultSpeed: 2,
  },
  normal: {
    label: 'Normal',
    description: 'Standard kitchen. Balanced chaos.',
    icon: '🍕',
    roundDuration: 5 * 60, // 5 minutes
    orderFlipInterval: 15, // 15 seconds
    ovenBurnTime: 75, // 1:15 (halved)
    ovenDoneTime: 60, // 1:00 (halved)
    ovenWarningTime: 45, // 0:45 (halved)
    angryThreshold: 480, // 8 min (doubled)
    defaultSpeed: 3,
  },
  hard: {
    label: 'Hard',
    description: 'Short rounds, fast orders, tight oven. Good luck.',
    icon: '🔥',
    roundDuration: 4 * 60, // 4 minutes
    orderFlipInterval: 10, // 10 seconds
    ovenBurnTime: 60, // 1:00 (halved)
    ovenDoneTime: 45, // 0:45 (halved)
    ovenWarningTime: 30, // 0:30 (halved)
    angryThreshold: 360, // 6 min (doubled)
    defaultSpeed: 3,
  },
};

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
