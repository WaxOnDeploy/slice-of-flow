import { useState } from 'react';

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
    title: 'Drag Cards Forward',
    description: 'Drag pizza orders left → right through each station: Orders → Prep → Oven → Pizza Box → Served. One station at a time.',
    tip: 'Cards glow with a ▶ arrow when ready to move.',
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
    description: '+1 per served pizza. -2 for burns. -1 for angry customers. +3 bonus for zero burns in a round!',
    tip: 'Quality over quantity — one burn costs two served.',
  },
  {
    icon: '🔄',
    title: 'Two Rounds',
    description: 'Round 1 = chaos, no rules. Then learn Kanban + WIP limits. Round 2 uses those rules. Compare your results!',
    tip: 'The debrief shows exactly how Kanban improved flow.',
  },
];

interface Props {
  onClose: () => void;
}

export default function SliceOfFlowTutorial({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
    >
      {/* Diner Order Ticket */}
      <div
        className="relative w-full max-w-xl mx-4"
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
            {current.description}
          </p>

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
          className="absolute top-4 right-4 text-xs px-3 py-1 rounded-full transition-all hover:scale-105"
          style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#999',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            border: '1px solid #ddd',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
