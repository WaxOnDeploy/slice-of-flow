import { create } from 'zustand';
import {
  type OrderCard,
  type ColumnId,
  type GamePhase,
  type RoundMetrics,
  type Difficulty,
  SOLO_DECK,
  COLUMN_ORDER,
  WIP_LIMITS,
  DIFFICULTY_PRESETS,
  OVEN_DONE_TIME,
  SCORE_SERVED,
  SCORE_BURNT,
  SCORE_ANGRY,
  SCORE_ZERO_BURNS_BONUS,
} from './sliceOfFlowConstants';

export type SpeedMultiplier = 1 | 2 | 3;

interface GameState {
  // ─── CORE STATE ──────────────────────────────────
  phase: GamePhase;
  round: 1 | 2;
  cards: OrderCard[];
  roundTimer: number; // seconds remaining
  isRunning: boolean;
  orderFlipTimer: number; // seconds until next auto-flip (Round 1)
  nextOrderIndex: number; // index into deck for next flip
  wipEnabled: boolean;
  speed: SpeedMultiplier; // 1x, 2x, 3x time compression
  difficulty: Difficulty;

  // ─── METRICS ─────────────────────────────────────
  round1Metrics: RoundMetrics | null;
  round2Metrics: RoundMetrics | null;

  // ─── ACTIONS ─────────────────────────────────────
  setDifficulty: (difficulty: Difficulty) => void;
  startGame: () => void;
  startRound: (round: 1 | 2) => void;
  tick: () => void;
  moveCard: (cardId: string, toColumn: ColumnId) => boolean;
  flipNextOrder: () => void;
  pullNextOrder: () => void;
  endRound: () => void;
  goToTransition: () => void;
  goToDebrief: () => void;
  resetGame: () => void;
  setSpeed: (speed: SpeedMultiplier) => void;
  canMoveCard: (cardId: string, toColumn: ColumnId) => { allowed: boolean; reason?: string };
}

function createFreshDeck(): OrderCard[] {
  return SOLO_DECK.map((card) => ({
    ...card,
    column: 'orderDeck' as ColumnId,
  }));
}

function calculateMetrics(cards: OrderCard[], round: 1 | 2): RoundMetrics {
  const served = cards.filter((c) => c.column === 'served' && !c.burnt);
  const burnt = cards.filter((c) => c.burnt);
  const angry = served.filter((c) => c.angry);
  const inProgress = cards.filter(
    (c) => c.column !== 'orderDeck' && c.column !== 'served' && !c.burnt
  );

  const leadTimes = served.map((c) => {
    if (c.enteredQueueAt && c.servedAt) return c.servedAt - c.enteredQueueAt;
    return 0;
  }).filter((t) => t > 0);

  const avgLeadTime = leadTimes.length > 0
    ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
    : 0;

  let score = served.length * SCORE_SERVED
    + burnt.length * SCORE_BURNT
    + angry.length * SCORE_ANGRY;

  if (burnt.length === 0) score += SCORE_ZERO_BURNS_BONUS;

  return {
    served: served.length,
    burnt: burnt.length,
    angry: angry.length,
    avgLeadTime,
    stillInProgress: inProgress.length,
    score,
  };
}

// Helper to get timing values from current difficulty
function getPreset(difficulty: Difficulty) {
  return DIFFICULTY_PRESETS[difficulty];
}

export const useSliceOfFlowStore = create<GameState>((set, get) => ({
  // ─── INITIAL STATE ───────────────────────────────
  phase: 'landing',
  round: 1,
  cards: createFreshDeck(),
  roundTimer: DIFFICULTY_PRESETS.normal.roundDuration,
  isRunning: false,
  orderFlipTimer: DIFFICULTY_PRESETS.normal.orderFlipInterval,
  nextOrderIndex: 0,
  wipEnabled: false,
  speed: 3 as SpeedMultiplier,
  difficulty: 'normal' as Difficulty,
  round1Metrics: null,
  round2Metrics: null,

  // ─── SET DIFFICULTY ─────────────────────────────
  setDifficulty: (difficulty) => {
    const preset = DIFFICULTY_PRESETS[difficulty];
    set({
      difficulty,
      speed: preset.defaultSpeed as SpeedMultiplier,
    });
  },

  // ─── SET SPEED ──────────────────────────────────
  setSpeed: (speed) => set({ speed }),

  // ─── START GAME ──────────────────────────────────
  startGame: () => {
    const preset = getPreset(get().difficulty);
    set({
      phase: 'round1',
      round: 1,
      cards: createFreshDeck(),
      roundTimer: preset.roundDuration,
      isRunning: true,
      orderFlipTimer: preset.orderFlipInterval,
      nextOrderIndex: 0,
      wipEnabled: false,
      round1Metrics: null,
      round2Metrics: null,
    });
  },

  // ─── START ROUND ─────────────────────────────────
  startRound: (round) => {
    const preset = getPreset(get().difficulty);
    set({
      phase: round === 1 ? 'round1' : 'round2',
      round,
      cards: createFreshDeck(),
      roundTimer: preset.roundDuration,
      isRunning: true,
      orderFlipTimer: preset.orderFlipInterval,
      nextOrderIndex: 0,
      wipEnabled: round === 2,
    });
  },

  // ─── TICK (called every second, advances by speed multiplier) ──
  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const preset = getPreset(state.difficulty);
    const spd = state.speed;
    const now = Date.now() / 1000;
    let newCards = [...state.cards];
    let shouldFlip = false;

    // Decrement round timer by speed factor
    const newRoundTimer = state.roundTimer - spd;

    // Round 1: auto-flip orders
    let newFlipTimer = state.orderFlipTimer;
    if (state.round === 1) {
      newFlipTimer -= spd;
      if (newFlipTimer <= 0) {
        shouldFlip = true;
        newFlipTimer = preset.orderFlipInterval;
      }
    }

    // Check oven timers — burn detection (use simulated elapsed = real elapsed * speed)
    newCards = newCards.map((card) => {
      if (card.column === 'oven' && card.ovenTimerStarted && !card.burnt) {
        const realElapsed = now - card.ovenTimerStarted;
        const simElapsed = realElapsed * spd;
        if (simElapsed >= preset.ovenBurnTime) {
          return { ...card, burnt: true, ovenTimerRemaining: 0 };
        }
        return { ...card, ovenTimerRemaining: preset.ovenBurnTime - simElapsed };
      }
      // Check prep timers
      if (card.column === 'prep' && card.prepTimerStarted) {
        const realElapsed = now - card.prepTimerStarted;
        const simElapsed = realElapsed * spd;
        return { ...card, prepTimerRemaining: Math.max(0, card.prepTime - simElapsed) };
      }
      return card;
    });

    // Check for angry customers (lead time > threshold)
    newCards = newCards.map((card) => {
      if (card.enteredQueueAt && !card.angry && card.column !== 'served' && card.column !== 'orderDeck') {
        const realLeadTime = now - card.enteredQueueAt;
        const simLeadTime = realLeadTime * spd;
        if (simLeadTime >= preset.angryThreshold) {
          return { ...card, angry: true };
        }
      }
      return card;
    });

    // End round if timer hits 0
    if (newRoundTimer <= 0) {
      const metrics = calculateMetrics(newCards, state.round);
      if (state.round === 1) {
        set({
          cards: newCards,
          roundTimer: 0,
          isRunning: false,
          round1Metrics: metrics,
        });
      } else {
        set({
          cards: newCards,
          roundTimer: 0,
          isRunning: false,
          round2Metrics: metrics,
        });
      }
      return;
    }

    set({
      cards: newCards,
      roundTimer: newRoundTimer,
      orderFlipTimer: newFlipTimer,
    });

    // Auto-flip after state update
    if (shouldFlip && state.round === 1) {
      get().flipNextOrder();
    }
  },

  // ─── FLIP NEXT ORDER (Round 1 — push) ───────────
  flipNextOrder: () => {
    const state = get();
    const deckCards = state.cards.filter((c) => c.column === 'orderDeck');
    if (deckCards.length === 0) return;

    const nextCard = deckCards[0];
    const now = Date.now() / 1000;

    set({
      cards: state.cards.map((c) =>
        c.id === nextCard.id
          ? { ...c, column: 'orderQueue' as ColumnId, enteredQueueAt: now }
          : c
      ),
      nextOrderIndex: state.nextOrderIndex + 1,
    });
  },

  // ─── PULL NEXT ORDER (Round 2 — pull) ───────────
  pullNextOrder: () => {
    const state = get();
    if (!state.wipEnabled) return;

    const queueCards = state.cards.filter((c) => c.column === 'orderQueue');
    if (queueCards.length >= WIP_LIMITS.orderQueue) return;

    const deckCards = state.cards.filter((c) => c.column === 'orderDeck');
    if (deckCards.length === 0) return;

    const nextCard = deckCards[0];
    const now = Date.now() / 1000;

    set({
      cards: state.cards.map((c) =>
        c.id === nextCard.id
          ? { ...c, column: 'orderQueue' as ColumnId, enteredQueueAt: now }
          : c
      ),
      nextOrderIndex: state.nextOrderIndex + 1,
    });
  },

  // ─── MOVE CARD ───────────────────────────────────
  canMoveCard: (cardId, toColumn) => {
    const state = get();
    const preset = getPreset(state.difficulty);
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return { allowed: false, reason: 'Card not found' };

    const fromIndex = COLUMN_ORDER.indexOf(card.column);
    const toIndex = COLUMN_ORDER.indexOf(toColumn);

    // Can only move forward
    if (toIndex <= fromIndex) return { allowed: false, reason: 'Can only move forward' };

    // Can only move one step at a time (except orderDeck → orderQueue which is handled by flip/pull)
    if (toIndex - fromIndex > 1 && card.column !== 'orderDeck') {
      return { allowed: false, reason: 'Can only move one station at a time' };
    }

    // Check WIP limits in Round 2
    if (state.wipEnabled && toColumn !== 'served') {
      const wipLimit = WIP_LIMITS[toColumn as keyof typeof WIP_LIMITS];
      if (wipLimit !== undefined) {
        const cardsInColumn = state.cards.filter((c) => c.column === toColumn && !c.burnt);
        if (cardsInColumn.length >= wipLimit) {
          return { allowed: false, reason: `WIP limit reached (${wipLimit})` };
        }
      }
    }

    // Oven always has physical limit of 3
    if (toColumn === 'oven') {
      const ovenCards = state.cards.filter((c) => c.column === 'oven' && !c.burnt);
      if (ovenCards.length >= 3) {
        return { allowed: false, reason: 'Oven is full (max 3)' };
      }
    }

    // Prep timer must be done before moving to oven
    if (card.column === 'prep' && toColumn === 'oven') {
      if (card.prepTimerRemaining && card.prepTimerRemaining > 0) {
        return { allowed: false, reason: 'Prep not done yet' };
      }
    }

    // Oven timer must be done (but not burnt) before moving to box
    if (card.column === 'oven' && toColumn === 'boxDeliver') {
      if (card.burnt) return { allowed: false, reason: 'Pizza is burnt!' };
      const now = Date.now() / 1000;
      const spd = state.speed;
      if (card.ovenTimerStarted) {
        const simElapsed = (now - card.ovenTimerStarted) * spd;
        if (simElapsed < preset.ovenDoneTime) {
          return { allowed: false, reason: 'Still baking...' };
        }
      }
    }

    return { allowed: true };
  },

  moveCard: (cardId, toColumn) => {
    const state = get();
    const { allowed } = state.canMoveCard(cardId, toColumn);
    if (!allowed) return false;

    const preset = getPreset(state.difficulty);
    const now = Date.now() / 1000;
    const card = state.cards.find((c) => c.id === cardId)!;

    set({
      cards: state.cards.map((c) => {
        if (c.id !== cardId) return c;

        const updates: Partial<OrderCard> = { column: toColumn };

        // Start prep timer when entering prep
        if (toColumn === 'prep') {
          updates.prepTimerStarted = now;
          updates.prepTimerRemaining = c.prepTime;
        }

        // Start oven timer when entering oven
        if (toColumn === 'oven') {
          updates.ovenTimerStarted = now;
          updates.ovenTimerRemaining = preset.ovenBurnTime;
        }

        // Record served time
        if (toColumn === 'served') {
          updates.servedAt = now;
        }

        return { ...c, ...updates };
      }),
    });

    return true;
  },

  // ─── END ROUND ───────────────────────────────────
  endRound: () => {
    const state = get();
    const metrics = calculateMetrics(state.cards, state.round);
    if (state.round === 1) {
      set({ isRunning: false, round1Metrics: metrics });
    } else {
      set({ isRunning: false, round2Metrics: metrics });
    }
  },

  // ─── TRANSITIONS ─────────────────────────────────
  goToTransition: () => set({ phase: 'transition' }),
  goToDebrief: () => set({ phase: 'debrief' }),

  // ─── RESET ───────────────────────────────────────
  resetGame: () => {
    const currentSpeed = get().speed;
    const currentDifficulty = get().difficulty;
    const preset = getPreset(currentDifficulty);
    set({
      phase: 'landing',
      round: 1,
      cards: createFreshDeck(),
      roundTimer: preset.roundDuration,
      isRunning: false,
      orderFlipTimer: preset.orderFlipInterval,
      nextOrderIndex: 0,
      wipEnabled: false,
      speed: currentSpeed,
      difficulty: currentDifficulty,
      round1Metrics: null,
      round2Metrics: null,
    });
  },
}));
