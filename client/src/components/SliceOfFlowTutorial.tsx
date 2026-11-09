import { useState } from 'react';
import SliceOfFlowDialog from '@/components/SliceOfFlowDialog';
import SliceOfFlowOrderGuide from '@/components/SliceOfFlowOrderGuide';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { DIFFICULTY_PRESETS } from '@/lib/sliceOfFlowConstants';
import { getScoringCopy } from '@/lib/sliceOfFlowScoringCopy';

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  tip: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: '📋',
    title: 'Orders Arrive',
    description: 'Round 1: Orders auto-appear every 15 sec — whether you\'re ready or not. That\'s PUSH. Round 2: YOU pull when ready.',
    tip: 'Watch the auto-flip timer in the top bar.',
  },
  {
    icon: '🖱️',
    title: 'Move Cards Forward',
    description: 'Select a ticket, then use its highlighted destination. Or use Enter to select and the right arrow to move. Dragging works too: one station at a time.',
    tip: 'Finish Prep before Oven; finish baking before Pizza Box.',
  },
  {
    icon: '⏱️',
    title: 'Watch the Timers',
    description: 'Each pizza has a PREP timer and an OVEN timer. Can\'t move until prep is done. Leave it in the oven too long? It BURNS!',
    tip: 'Oven card turns yellow → then red = burnt. Move fast!',
  },
  {
    icon: '🎯',
    title: 'Score Points',
    description: 'Serve pizzas and avoid burns. A zero-burn bonus requires at least one served pizza. Burnt customers are not counted again as angry.',
    tip: 'Quality over quantity — one burn costs two served.',
  },
  {
    icon: '🔄',
    title: 'Two Rounds',
    description: 'Round 1 pushes orders in without WIP limits. Round 2 uses pull and WIP limits. The same kitchen and orders let you compare your results.',
    tip: 'The debrief reports what happened—better, equal, or worse results are all useful.',
  },
];

interface Props {
  onClose: () => void;
  onReturnFocus?: () => void;
  open?: boolean;
}

export default function SliceOfFlowTutorial({ onClose, onReturnFocus, open = true }: Props) {
  const [step, setStep] = useState(0);
  const difficulty = useSliceOfFlowStore(state => state.difficulty);
  const preset = DIFFICULTY_PRESETS[difficulty];
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <SliceOfFlowDialog
      open={open}
      title="How to play Slice of Flow"
      description="Kitchen instructions. Escape closes this guide; the guided first move keeps Round 1 paused."
      onDismiss={onClose}
      onReturnFocus={onReturnFocus}
    >
      {/* Diner Order Ticket */}
      <div
        className="relative w-full max-w-xl"
        style={{
          /* Ticket shape with torn/perforated edges */
          background: '#FFFEF5',
          borderRadius: 4,
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.05)',
          /* Subtle paper texture via repeating gradient */
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 28px,
              rgba(200,180,160,0.12) 28px,
              rgba(200,180,160,0.12) 29px
            )
          `,
        }}
      >
        {/* Torn top edge */}
        <div
          style={{
            height: 12,
            background: `repeating-linear-gradient(
              90deg,
              #FFFEF5 0px,
              #FFFEF5 8px,
              transparent 8px,
              transparent 10px,
              #FFFEF5 10px,
              #FFFEF5 18px,
              transparent 18px,
              transparent 20px
            )`,
            borderRadius: '4px 4px 0 0',
          }}
        />

        {/* Red stripe header — like a diner check */}
        <div
          className="px-6 py-3"
          style={{
            background: '#C62828',
            borderTop: '3px solid #8E0000',
            borderBottom: '3px solid #8E0000',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1
                tabIndex={-1}
                data-dialog-initial
                style={{
                  fontFamily: "'Lilita One', cursive",
                  fontSize: 28,
                  color: '#FFFEF5',
                  letterSpacing: 1,
                  lineHeight: 1.1,
                  textShadow: '2px 2px 0 rgba(0,0,0,0.2)',
                }}
              >
                ORDER UP!
              </h1>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: 2,
                  marginTop: 2,
                }}
              >
                HOW TO PLAY
              </div>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'right',
              }}
            >
              <div>TICKET</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#FFD54F', lineHeight: 1 }}>
                #{step + 1}
              </div>
            </div>
          </div>
        </div>

        {/* Progress pips — like order number dots */}
        <div className="flex justify-center gap-3 pt-4 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: i === step ? '#C62828' : i < step ? '#E8D5B7' : 'transparent',
                border: `2px solid ${i === step ? '#C62828' : i < step ? '#C4A882' : '#D4C4A8'}`,
                transition: 'all 0.3s',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 'bold',
                color: i === step ? '#fff' : i < step ? '#8B7355' : '#C4A882',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="px-8 pt-3 pb-6">
          {/* Icon + Title row — diner style */}
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontSize: 44 }}>{current.icon}</span>
            <div>
              <h2
                style={{
                  fontFamily: "'Lilita One', cursive",
                  fontSize: 30,
                  color: '#3E2723',
                  lineHeight: 1.1,
                }}
              >
                {current.title}
              </h2>
            </div>
          </div>

          {/* Dashed separator — like a receipt */}
          <div
            style={{
              borderTop: '2px dashed #C4A882',
              margin: '8px 0 16px',
            }}
          />

          {/* Description — LARGE readable text */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 20,
              lineHeight: 1.5,
              color: '#3E2723',
              marginBottom: 16,
            }}
          >
            {step === 0
              ? `Round 1 pushes in an order every ${preset.orderFlipInterval} kitchen seconds. Round 2 lets you pull when ready. The clock shows simulated kitchen time; the speed control compresses it.`
              : current.description}
          </p>

          {step === 0 && <SliceOfFlowOrderGuide compact headingLevel={3} title="Orders in this round" testId="tutorial-order-guide" className="mb-4" />}
          {step === 3 && <p className="text-base mb-4" style={{ color: '#3E2723' }}>{getScoringCopy().formula}</p>}

          {/* Tip — styled like a handwritten note on the ticket */}
          <div
            className="rounded px-5 py-3 mb-5"
            style={{
              background: '#FFF9E6',
              border: '1px solid #E8D5B7',
              borderLeft: '4px solid #FFB300',
            }}
          >
            <p
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 22,
                color: '#5D4037',
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 'bold', color: '#E65100' }}>Chef's Tip: </span>
              {current.tip}
            </p>
          </div>

          {/* Navigation buttons — styled like diner buttons */}
          <div className="flex items-center justify-between">
            <button
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
              className="px-5 py-2.5 rounded text-base transition-all hover:scale-105"
              style={{
                background: step > 0 ? '#E8D5B7' : '#F0EBE0',
                color: step > 0 ? '#5D4037' : '#C4A882',
                fontFamily: "'Lilita One', cursive",
                fontSize: 18,
                pointerEvents: step > 0 ? 'auto' : 'none',
                border: '2px solid #C4A882',
              }}
            >
              ← Back
            </button>

            <button
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  setStep(step + 1);
                }
              }}
              className="px-7 py-2.5 rounded text-base transition-all hover:scale-105 active:scale-95"
              style={{
                background: isLast ? '#C62828' : '#FFB300',
                color: isLast ? '#fff' : '#3E2723',
                fontFamily: "'Lilita One', cursive",
                fontSize: 18,
                border: isLast ? '2px solid #8E0000' : '2px solid #E69500',
                boxShadow: isLast
                  ? '0 4px 15px rgba(198,40,40,0.3)'
                  : '0 4px 15px rgba(255,179,0,0.3)',
              }}
            >
              {isLast ? "Fire it up! 🍕" : 'Next Order →'}
            </button>
          </div>
        </div>

        {/* Torn bottom edge */}
        <div
          style={{
            height: 12,
            background: `repeating-linear-gradient(
              90deg,
              #FFFEF5 0px,
              #FFFEF5 8px,
              transparent 8px,
              transparent 10px,
              #FFFEF5 10px,
              #FFFEF5 18px,
              transparent 18px,
              transparent 20px
            )`,
            borderRadius: '0 0 4px 4px',
          }}
        />

        {/* Skip button — small, unobtrusive */}
        <button
          onClick={onClose}
          className="absolute top-1 right-2 text-base px-3 py-1 rounded-full transition-all hover:scale-105"
          style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#534334',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 16,
            border: '1px solid #ddd',
          }}
        >
          Skip
        </button>
      </div>
    </SliceOfFlowDialog>
  );
}
