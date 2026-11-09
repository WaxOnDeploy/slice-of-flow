import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLUMN_ORDER, DIFFICULTY_PRESETS, SOLO_DECK, type ColumnId, type OrderCard } from './sliceOfFlowConstants';

let store: typeof import('./sliceOfFlowStore').useSliceOfFlowStore;

beforeAll(async () => {
  // The app's existing development-only diagnostic exposes the store on window.
  vi.stubGlobal('window', {});
  store = (await import('./sliceOfFlowStore')).useSliceOfFlowStore;
});

beforeEach(() => {
  store.getState().setDifficulty('normal');
  store.getState().resetGame();
});

function runActions() {
  const state = store.getState();
  // Drain downstream first. This is a deterministic test operator, not a human pilot.
  for (const from of ['boxDeliver', 'oven', 'prep', 'orderQueue'] as ColumnId[]) {
    const destination = COLUMN_ORDER[COLUMN_ORDER.indexOf(from) + 1];
    for (const card of store.getState().cards.filter(c => c.column === from && !c.burnt)) {
      if (store.getState().canMoveCard(card.id, destination).allowed) {
        store.getState().moveCard(card.id, destination);
      }
    }
  }
  if (state.round === 2 && store.getState().cards.some(c => c.column === 'orderDeck')) {
    store.getState().pullNextOrder();
  }
}

function completeRound() {
  for (let ticks = 0; ticks < 500 && store.getState().isRunning; ticks++) {
    runActions();
    store.getState().tick();
  }
  expect(store.getState().isRunning).toBe(false);
}

describe('preserved Slice of Flow rules', () => {
  it('starts Round 1 paused and does not consume clock or prep time during guidance', () => {
    store.getState().startGame();
    store.getState().flipNextOrder();
    expect(store.getState().moveCard('order-1', 'prep')).toBe(true);
    store.getState().tick();
    expect(store.getState().roundTimer).toBe(DIFFICULTY_PRESETS.normal.roundDuration);
    expect(store.getState().cards[0].prepTimerRemaining).toBe(30);
    store.getState().resumeGame();
    store.getState().tick();
    expect(store.getState().roundTimer).toBe(237);
    expect(store.getState().cards[0].prepTimerRemaining).toBe(27);
  });

  it.each([1, 2, 3] as const)('freezes and resumes timers without refilling the clock at %ix', speed => {
    store.getState().startRound(1);
    store.getState().setSpeed(speed);
    store.getState().flipNextOrder();
    store.getState().moveCard('order-1', 'prep');
    store.getState().tick();
    const timer = store.getState().roundTimer;
    const remaining = store.getState().cards[0].prepTimerRemaining;
    store.getState().pauseGame();
    store.getState().tick();
    expect(store.getState().roundTimer).toBe(timer);
    expect(store.getState().cards[0].prepTimerRemaining).toBe(remaining);
    store.getState().resumeGame();
    store.getState().tick();
    expect(store.getState().roundTimer).toBe(timer - speed);
  });

  it('rejects skipped/backward stations and unfinished Prep', () => {
    store.getState().startRound(1);
    store.getState().flipNextOrder();
    expect(store.getState().moveCard('order-1', 'oven')).toBe(false);
    expect(store.getState().moveCard('order-1', 'prep')).toBe(true);
    expect(store.getState().moveCard('order-1', 'orderQueue')).toBe(false);
    expect(store.getState().moveCard('order-1', 'oven')).toBe(false);
  });

  it.each([1, 2] as const)('preserves physical oven capacity in Round %i', round => {
    store.getState().startRound(round);
    const cards: OrderCard[] = SOLO_DECK.map((card, i) => ({ ...card, column: i < 3 ? 'oven' : i === 3 ? 'prep' : 'orderDeck', prepTimerRemaining: 0 }));
    store.setState({ cards });
    expect(store.getState().moveCard('order-4', 'oven')).toBe(false);
    expect(store.getState().cards.filter(c => c.column === 'oven')).toHaveLength(3);
  });

  it('enforces Round 2 Orders and Prep WIP without automatic arrivals', () => {
    store.getState().startRound(2);
    for (let i = 0; i < 6; i++) store.getState().pullNextOrder();
    expect(store.getState().cards.filter(c => c.column === 'orderQueue')).toHaveLength(4);
    expect(store.getState().moveCard('order-1', 'prep')).toBe(true);
    expect(store.getState().moveCard('order-2', 'prep')).toBe(true);
    expect(store.getState().moveCard('order-3', 'prep')).toBe(false);
    const index = store.getState().nextOrderIndex;
    for (let i = 0; i < 10; i++) store.getState().tick();
    expect(store.getState().nextOrderIndex).toBe(index);
  });

  it('calculates the zero-burn bonus only after at least one delivery', () => {
    store.getState().startRound(1);
    store.getState().endRound();
    expect(store.getState().round1Metrics?.score).toBe(0);
    store.getState().startRound(1);
    store.setState({ cards: [{ ...SOLO_DECK[0], column: 'served', simEnteredQueueAt: 0, simServedAt: 72 }] });
    store.getState().endRound();
    expect(store.getState().round1Metrics).toMatchObject({ served: 1, score: 4, avgLeadTime: 72 });
  });

  it('counts angry unfinished customers but does not double-count burnt-angry tickets', () => {
    store.getState().startRound(1);
    store.setState({ cards: [
      { ...SOLO_DECK[0], column: 'served', simEnteredQueueAt: 0, simServedAt: 72 },
      { ...SOLO_DECK[1], column: 'prep', angry: true },
      { ...SOLO_DECK[2], column: 'oven', burnt: true, angry: true },
    ] });
    store.getState().endRound();
    expect(store.getState().round1Metrics).toMatchObject({ served: 1, burnt: 1, angry: 1, stillInProgress: 1, score: -2 });
  });

  it('runs a complete deterministic Round 1 and Round 2 without changing the original deck or rules', () => {
    store.getState().startGame();
    store.getState().flipNextOrder();
    store.getState().moveCard('order-1', 'prep');
    store.getState().resumeGame();
    completeRound();
    const r1 = store.getState().round1Metrics;
    expect(r1).not.toBeNull();
    expect(r1!.served).toBeGreaterThan(0);
    expect(Number.isFinite(r1!.avgLeadTime)).toBe(true);
    store.getState().goToTransition();
    expect(store.getState().phase).toBe('transition');
    store.getState().startRound(2);
    completeRound();
    expect(store.getState().round1Metrics).toEqual(r1);
    expect(store.getState().round2Metrics?.served).toBeGreaterThan(0);
    store.getState().goToDebrief();
    expect(store.getState().phase).toBe('debrief');
    store.getState().resetGame();
    expect(store.getState().cards.map(c => c.id)).toEqual(SOLO_DECK.map(c => c.id));
    expect(store.getState().round1Metrics).toBeNull();
    expect(store.getState().round2Metrics).toBeNull();
  });
});
