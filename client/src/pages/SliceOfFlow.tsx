import { useEffect, useRef } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import SliceOfFlowLanding from './SliceOfFlowLanding';
import SliceOfFlowBoard from './SliceOfFlowBoard';
import SliceOfFlowTransition from './SliceOfFlowTransition';
import SliceOfFlowDebrief from './SliceOfFlowDebrief';
import {
  playOrderFlip,
  playBurn,
  playAngry,
  playRoundEnd,
  playTimerTick,
  playOvenWarning,
  playPrepDone,
} from '@/lib/sliceOfFlowSounds';
import { OVEN_WARNING_TIME, OVEN_BURN_TIME } from '@/lib/sliceOfFlowConstants';

export default function SliceOfFlow() {
  const phase = useSliceOfFlowStore((s) => s.phase);
  const isRunning = useSliceOfFlowStore((s) => s.isRunning);
  const tick = useSliceOfFlowStore((s) => s.tick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previous state for sound triggers
  const prevCardsRef = useRef<any[]>([]);
  const prevTimerRef = useRef<number>(300);
  const prevRunningRef = useRef<boolean>(false);
  const warnedOvenRef = useRef<Set<string>>(new Set());
  const prepDoneRef = useRef<Set<string>>(new Set());

  // Game tick — runs every second while game is active
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const stateBefore = useSliceOfFlowStore.getState();
        const cardsBefore = stateBefore.cards;
        const timerBefore = stateBefore.roundTimer;

        tick();

        const stateAfter = useSliceOfFlowStore.getState();
        const cardsAfter = stateAfter.cards;
        const timerAfter = stateAfter.roundTimer;

        // ─── SOUND: New order flipped ───
        const queueBefore = cardsBefore.filter((c) => c.column === 'orderQueue').length;
        const queueAfter = cardsAfter.filter((c) => c.column === 'orderQueue').length;
        if (queueAfter > queueBefore) {
          playOrderFlip();
        }

        // ─── SOUND: Pizza burnt ───
        const burntBefore = cardsBefore.filter((c) => c.burnt).length;
        const burntAfter = cardsAfter.filter((c) => c.burnt).length;
        if (burntAfter > burntBefore) {
          playBurn();
        }

        // ─── SOUND: Customer angry ───
        const angryBefore = cardsBefore.filter((c) => c.angry).length;
        const angryAfter = cardsAfter.filter((c) => c.angry).length;
        if (angryAfter > angryBefore) {
          playAngry();
        }

        // ─── SOUND: Oven warning (approaching burn) ───
        cardsAfter.forEach((card) => {
          if (card.column === 'oven' && card.ovenTimerStarted && !card.burnt) {
            const now = Date.now() / 1000;
            const elapsed = now - card.ovenTimerStarted;
            if (elapsed >= OVEN_WARNING_TIME && elapsed < OVEN_BURN_TIME && !warnedOvenRef.current.has(card.id)) {
              warnedOvenRef.current.add(card.id);
              playOvenWarning();
            }
          }
        });

        // ─── SOUND: Prep done ───
        cardsAfter.forEach((card) => {
          if (card.column === 'prep' && card.prepTimerRemaining !== undefined && card.prepTimerRemaining <= 0 && !prepDoneRef.current.has(card.id)) {
            prepDoneRef.current.add(card.id);
            playPrepDone();
          }
        });

        // ─── SOUND: Timer tick (last 30 seconds) ───
        if (timerAfter <= 30 && timerAfter > 0 && timerAfter % 2 === 0) {
          playTimerTick();
        }

        // ─── SOUND: Round end ───
        if (timerBefore > 0 && timerAfter <= 0) {
          playRoundEnd();
        }

        prevCardsRef.current = cardsAfter;
        prevTimerRef.current = timerAfter;
      }, 1000);
    } else {
      // Reset tracking refs when game stops
      if (prevRunningRef.current && !isRunning) {
        warnedOvenRef.current.clear();
        prepDoneRef.current.clear();
      }
    }
    prevRunningRef.current = isRunning;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, tick]);

  switch (phase) {
    case 'landing':
      return <SliceOfFlowLanding />;
    case 'round1':
    case 'round2':
      return <SliceOfFlowBoard />;
    case 'transition':
      return <SliceOfFlowTransition />;
    case 'debrief':
      return <SliceOfFlowDebrief />;
    default:
      return <SliceOfFlowLanding />;
  }
}
