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
    description: 'In Round 1, orders automatically appear in the queue every 15 seconds — whether you\'re ready or not. This is a PUSH system. In Round 2, YOU decide when to pull the next order.',
    tip: 'Watch the auto-flip timer in the top bar to anticipate incoming orders.',
  },
  {
    icon: '🖱️',
    title: 'Drag Cards Forward',
    description: 'Drag pizza order cards from left to right through each station: Order Queue → Prep → Oven → Box & Deliver → Served. Cards can only move one station at a time.',
    tip: 'Cards glow with a ▶ arrow when they\'re ready to move to the next station.',
  },
  {
    icon: '⏱️',
    title: 'Watch the Timers',
    description: 'Each pizza has a PREP timer (based on complexity) and an OVEN timer. You can\'t move a pizza until prep is done. Leave it in the oven too long and it BURNS!',
    tip: 'The oven card turns yellow as a warning, then red when it burns. Move fast!',
  },
  {
    icon: '🎯',
    title: 'Score Points',
    description: 'Earn +10 for each served pizza. Lose -5 for burns and -3 for angry customers (orders waiting too long). Get a +15 bonus if you serve zero burns in a round!',
    tip: 'Quality over quantity — one burn costs half a served pizza.',
  },
  {
    icon: '🔄',
    title: 'Two Rounds',
    description: 'Round 1 is chaos — no rules, orders pushed at you. After Round 1, you\'ll learn Kanban principles and WIP limits. Round 2 uses those rules. Compare your results!',
    tip: 'The debrief at the end shows exactly how Kanban improved your flow.',
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
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #2D1B0E 0%, #1A0F06 100%)',
          border: '2px solid rgba(255,183,77,0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,183,77,0.1)',
        }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-5 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all duration-300"
              style={{
                background: i === step ? '#FFB74D' : i < step ? '#8D6E63' : 'rgba(255,255,255,0.15)',
                transform: i === step ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pt-4 pb-6">
          {/* Icon */}
          <div className="text-center mb-4">
            <span className="text-5xl">{current.icon}</span>
          </div>

          {/* Step counter */}
          <div className="text-center mb-2">
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: '#FFB74D', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Title */}
          <h2
            className="text-2xl text-center mb-3"
            style={{ fontFamily: "'Lilita One', cursive", color: '#FFF8E1' }}
          >
            {current.title}
          </h2>

          {/* Description */}
          <p
            className="text-sm leading-relaxed text-center mb-4"
            style={{ color: 'rgba(255,255,255,0.8)', fontFamily: "'Caveat', cursive", fontSize: '17px' }}
          >
            {current.description}
          </p>

          {/* Tip box */}
          <div
            className="rounded-lg px-4 py-3 mb-5"
            style={{
              background: 'rgba(255,183,77,0.1)',
              border: '1px solid rgba(255,183,77,0.25)',
            }}
          >
            <p className="text-xs" style={{ color: '#FFB74D' }}>
              <span className="font-bold">💡 TIP:</span>{' '}
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{current.tip}</span>
            </p>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: step > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                fontFamily: "'Lilita One', cursive",
                pointerEvents: step > 0 ? 'auto' : 'none',
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
              className="px-6 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: isLast
                  ? 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)'
                  : 'linear-gradient(135deg, #FFB74D 0%, #FF9800 100%)',
                color: isLast ? '#fff' : '#2D1B0E',
                fontFamily: "'Lilita One', cursive",
                boxShadow: isLast
                  ? '0 4px 15px rgba(211,47,47,0.4)'
                  : '0 4px 15px rgba(255,152,0,0.3)',
              }}
            >
              {isLast ? "Let's Cook! 🍕" : 'Next →'}
            </button>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xs px-3 py-1 rounded-full transition-all hover:scale-105"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
