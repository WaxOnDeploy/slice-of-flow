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
  roundTimer: number; // simulated seconds remaining
  isRunning: boolean;
  orderFlipTimer: number; // simulated seconds until next auto-flip (Round 1)
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
  skipToRound2: () => void;
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
    if (c.simEnteredQueueAt !== undefined && c.simServedAt !== undefined) return c.simServedAt - c.simEnteredQueueAt;
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

  // ─── TICK (called every 1 real second; advances simulated time by `speed` seconds) ──
  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const preset = getPreset(state.difficulty);
    const spd = state.speed;
    let newCards = [...state.cards];
    let shouldFlip = false;

    // Round timer ALWAYS counts down in real time (1 second per tick)
    const newRoundTimer = state.roundTimer - 1;

    // Round 1: auto-flip orders
    let newFlipTimer = state.orderFlipTimer;
    if (state.round === 1) {
      newFlipTimer -= spd;
      if (newFlipTimer <= 0) {
        shouldFlip = true;
        newFlipTimer = preset.orderFlipInterval;
      }
    }

    // Track simulated game clock for lead time (how much sim-time has elapsed since round start)
    const simElapsedThisTick = spd; // simulated seconds that pass this tick

    // Update all card timers incrementally (same approach as round timer)
    newCards = newCards.map((card) => {
      // Oven timer: decrement remaining by speed
      if (card.column === 'oven' && card.ovenTimerStarted && !card.burnt) {
        const newRemaining = (card.ovenTimerRemaining ?? preset.ovenBurnTime) - simElapsedThisTick;
        if (newRemaining <= 0) {
          return { ...card, burnt: true, ovenTimerRemaining: 0 };
        }
        return { ...card, ovenTimerRemaining: newRemaining };
      }
      // Prep timer: decrement remaining by speed
      if (card.column === 'prep' && card.prepTimerStarted) {
        const newRemaining = (card.prepTimerRemaining ?? card.prepTime) - simElapsedThisTick;
        return { ...card, prepTimerRemaining: Math.max(0, newRemaining) };
      }
      return card;
    });

    // Check for angry customers: increment simElapsedInQueue and check threshold
    newCards = newCards.map((card) => {
      if (card.simEnteredQueueAt !== undefined && !card.angry && card.column !== 'served' && card.column !== 'orderDeck') {
        const newElapsed = (card.simElapsedInQueue ?? 0) + simElapsedThisTick;
        if (newElapsed >= preset.angryThreshold) {
          return { ...card, angry: true, simElapsedInQueue: newElapsed };
        }
        return { ...card, simElapsedInQueue: newElapsed };
      }
      return card;
    });

    // Auto-end: check if all cards are either served or burnt (no cards left in play)
    const allCardsComplete = newCards.every(
      (c) => c.column === 'served' || c.burnt || c.column === 'orderDeck'
    );
    const anyCardsInPlay = newCards.some(
      (c) => c.column !== 'orderDeck' && c.column !== 'served' && !c.burnt
    );
    const allOrdersFlipped = newCards.filter((c) => c.column === 'orderDeck').length === 0;
    const shouldAutoEnd = allOrdersFlipped && !anyCardsInPlay;

    // End round if timer hits 0 OR all cards are complete
    if (newRoundTimer <= 0 || shouldAutoEnd) {
      const metrics = calculateMetrics(newCards, state.round);
      if (state.round === 1) {
        set({
          cards: newCards,
          roundTimer: shouldAutoEnd ? newRoundTimer : 0,
          isRunning: false,
          round1Metrics: metrics,
        });
      } else {
        set({
          cards: newCards,
          roundTimer: shouldAutoEnd ? newRoundTimer : 0,
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
    // Use simulated game clock (roundDuration - roundTimer) for lead time tracking
    const preset = getPreset(state.difficulty);
    const simGameClock = preset.roundDuration - state.roundTimer;

    set({
      cards: state.cards.map((c) =>
        c.id === nextCard.id
          ? { ...c, column: 'orderQueue' as ColumnId, simEnteredQueueAt: simGameClock, simElapsedInQueue: 0 }
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
    const preset = getPreset(state.difficulty);
    const simGameClock = preset.roundDuration - state.roundTimer;

    set({
      cards: state.cards.map((c) =>
        c.id === nextCard.id
          ? { ...c, column: 'orderQueue' as ColumnId, simEnteredQueueAt: simGameClock, simElapsedInQueue: 0 }
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
      // Check ovenTimerRemaining — done when remaining <= (burnTime - doneTime)
      // ovenTimerRemaining counts down from burnTime. Done when elapsed >= doneTime.
      // elapsed = burnTime - remaining. So done when (burnTime - remaining) >= doneTime
      // i.e. remaining <= burnTime - doneTime
      const remaining = card.ovenTimerRemaining ?? preset.ovenBurnTime;
      const doneThreshold = preset.ovenBurnTime - preset.ovenDoneTime;
      if (remaining > doneThreshold) {
        return { allowed: false, reason: 'Still baking...' };
      }
    }

    return { allowed: true };
  },

  moveCard: (cardId, toColumn) => {
    const state = get();
    const { allowed } = state.canMoveCard(cardId, toColumn);
    if (!allowed) return false;

    const preset = getPreset(state.difficulty);
    const simGameClock = preset.roundDuration - state.roundTimer;

    set({
      cards: state.cards.map((c) => {
        if (c.id !== cardId) return c;

        const updates: Partial<OrderCard> = { column: toColumn };

        // Start prep timer when entering prep
        if (toColumn === 'prep') {
          updates.prepTimerStarted = true as any; // flag that prep has started
          updates.prepTimerRemaining = c.prepTime;
        }

        // Start oven timer when entering oven
        if (toColumn === 'oven') {
          updates.ovenTimerStarted = true as any; // flag that oven has started
          updates.ovenTimerRemaining = preset.ovenBurnTime;
        }

        // Record served time (simulated game clock)
        if (toColumn === 'served') {
          updates.simServedAt = simGameClock;
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

  // ─── SKIP TO ROUND 2 ────────────────────────────
  skipToRound2: () => {
    const preset = getPreset(get().difficulty);
    set({
      phase: 'round2',
      round: 2,
      cards: createFreshDeck(),
      roundTimer: preset.roundDuration,
      isRunning: true,
      orderFlipTimer: preset.orderFlipInterval,
      nextOrderIndex: 0,
      wipEnabled: true,
      round1Metrics: null,
      round2Metrics: null,
    });
  },

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
