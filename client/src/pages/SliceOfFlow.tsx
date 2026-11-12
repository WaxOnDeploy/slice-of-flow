import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import SliceOfFlowLanding from './SliceOfFlowLanding';
import SliceOfFlowBoard from './SliceOfFlowBoard';
import SliceOfFlowTransition from './SliceOfFlowTransition';
import SliceOfFlowDebrief from './SliceOfFlowDebrief';
import SliceOfFlowSplash from '@/components/SliceOfFlowSplash';
import type { SplashVariant } from '@/components/SliceOfFlowSplash';
import SliceOfFlowRightsFooter from '@/components/SliceOfFlowRightsFooter';
import {
  playOrderFlip,
  playBurn,
  playAngry,
  playRoundEnd,
  playTimerTick,
  playOvenWarning,
  playPrepDone,
} from '@/lib/sliceOfFlowSounds';
import { DIFFICULTY_PRESETS } from '@/lib/sliceOfFlowConstants';
import '@/lib/sliceOfFlowWorkshop.css';

// Preview-only sibling: never loaded or scheduled on the default game path.
const IndependentLab = lazy(() => import('@/components/SliceOfFlowIndependentPreview'));

// ─── PHASE TRANSITION OVERLAY ─────────────────────
function PhaseTransitionOverlay({
  isVisible,
  label,
}: {
  isVisible: boolean;
  label: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: isVisible ? 'auto' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Top curtain */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, #1a1a1a 0%, #2d1810 100%)',
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.5s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      />
      {/* Bottom curtain */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(0deg, #1a1a1a 0%, #2d1810 100%)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.5s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      />
      {/* Center label */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.3s ease 0.25s, transform 0.3s ease 0.25s',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Lilita One', cursive",
            fontSize: 48,
            color: '#D94F3B',
            textShadow: '0 2px 20px rgba(217,79,59,0.5)',
            letterSpacing: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 8,
          }}
        >
          Slice of Flow
        </div>
      </div>
    </div>
  );
}

export default function SliceOfFlow() {
  const phase = useSliceOfFlowStore((s) => s.phase);
  const isRunning = useSliceOfFlowStore((s) => s.isRunning);
  const tick = useSliceOfFlowStore((s) => s.tick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const difficulty = useSliceOfFlowStore((s) => s.difficulty);
  const speed = useSliceOfFlowStore((s) => s.speed);
  const [labEnabled] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('flow-lab') === '1');
  const [labClosed, setLabClosed] = useState(false);

  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);
  const [splashVariant, setSplashVariant] = useState<SplashVariant>('ticket');

  // Read splash variant from URL param: ?splash=neon|pizzabox|ticket
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('splash');
    if (v === 'neon' || v === 'pizzabox' || v === 'ticket') {
      setSplashVariant(v);
    }
    // Skip splash if returning (session storage flag)
    const seen = sessionStorage.getItem('sof-splash-seen');
    if (seen === '1') {
      setShowSplash(false);
    }
  }, []);

  const handleSplashEnter = () => {
    setShowSplash(false);
    sessionStorage.setItem('sof-splash-seen', '1');
  };

  // Phase transition animation state
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState('');
  const [displayedPhase, setDisplayedPhase] = useState(phase);
  const prevPhaseRef = useRef(phase);
  const phaseRootRef = useRef<HTMLDivElement>(null);
  const keyboardInputRef = useRef(false);

  useEffect(() => {
    const onKeyboard = () => { keyboardInputRef.current = true; };
    const onPointer = () => { keyboardInputRef.current = false; };
    window.addEventListener('keydown', onKeyboard, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKeyboard, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (showSplash || transitionVisible) return;
    // A tutorial or round-end dialog owns its own focus while open.
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    const heading = phaseRootRef.current?.querySelector<HTMLElement>('h1, h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.classList.add('sof-focus-heading');
      heading.focus({ preventScroll: true });
    }
  }, [displayedPhase, showSplash, transitionVisible]);

  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      const oldPhase = prevPhaseRef.current;
      prevPhaseRef.current = phase;

      // Determine transition label
      let label = '';
      if (phase === 'round1') label = 'Round 1';
      else if (phase === 'transition') label = 'Time!';
      else if (phase === 'round2') label = 'Round 2';
      else if (phase === 'debrief') label = 'Results';

      // Skip animation for landing → landing or if no label
      if (!label || oldPhase === 'landing' && phase === 'landing') {
        setDisplayedPhase(phase);
        return;
      }

      if (keyboardInputRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayedPhase(phase);
        setTransitionVisible(false);
        return;
      }

      // Show curtain
      setTransitionLabel(label);
      setTransitionVisible(true);

      // After curtain closes, swap content
      const swapTimer = setTimeout(() => {
        setDisplayedPhase(phase);
      }, 500);

      // After a beat, open curtain
      const openTimer = setTimeout(() => {
        setTransitionVisible(false);
      }, 1100);

      return () => {
        clearTimeout(swapTimer);
        clearTimeout(openTimer);
      };
    }
  }, [phase]);

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
        const preset = DIFFICULTY_PRESETS[stateAfter.difficulty];

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
          if (card.column === 'oven' && card.ovenTimerStarted && !card.burnt && card.ovenTimerRemaining !== undefined) {
            const elapsed = preset.ovenBurnTime - card.ovenTimerRemaining;
            if (elapsed >= preset.ovenWarningTime && elapsed < preset.ovenBurnTime && !warnedOvenRef.current.has(card.id)) {
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
        if (timerAfter <= 30 && timerAfter > 0 && Math.floor(timerAfter) % 2 === 0) {
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

  // Show splash screen first
  if (showSplash) {
    return <SliceOfFlowSplash onEnter={handleSplashEnter} variant={splashVariant} />;
  }

  const renderPhase = () => {
    switch (displayedPhase) {
      case 'landing':
        return <SliceOfFlowLanding />;
      case 'round1':
      case 'round2':
        return <SliceOfFlowBoard transitioning={transitionVisible} />;
      case 'transition':
        return <SliceOfFlowTransition />;
      case 'debrief':
        return <>
          <SliceOfFlowDebrief />
          {labEnabled && !labClosed && <Suspense fallback={<p role="status">Loading the independent lab preview…</p>}>
            <IndependentLab difficulty={difficulty} speed={speed} onClose={() => setLabClosed(true)} />
          </Suspense>}
        </>;
      default:
        return <SliceOfFlowLanding />;
    }
  };

  return (
    <>
      <PhaseTransitionOverlay isVisible={transitionVisible} label={transitionLabel} />
      <div ref={phaseRootRef} className="sof-phase" data-phase={displayedPhase} inert={transitionVisible} aria-busy={transitionVisible}>
        {renderPhase()}
        <SliceOfFlowRightsFooter />
      </div>
    </>
  );
}
