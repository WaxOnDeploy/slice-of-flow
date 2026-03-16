import { useState } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { WIP_LIMITS } from '@/lib/sliceOfFlowConstants';

const KITCHEN_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-hero-bg-GAkzomYox6u7BrLN2cai9V.webp';

const KANBAN_PRINCIPLES = [
  {
    icon: '🔄',
    title: 'Visualize the Work',
    desc: 'You already did this — the board shows every pizza at every stage. No hidden work.',
  },
  {
    icon: '🚦',
    title: 'Limit Work in Progress',
    desc: "Stop starting, start finishing. Each station has a maximum number of pizzas it can hold. When it's full, you PULL from the previous station.",
  },
  {
    icon: '🎯',
    title: 'Manage Flow',
    desc: "Watch for bottlenecks. If the oven is always full, that's your constraint. Don't push more into prep — it just creates a pile-up.",
  },
  {
    icon: '📏',
    title: 'Make Policies Explicit',
    desc: 'The WIP limits are visible. Everyone knows the rules. No ambiguity.',
  },
];

export default function SliceOfFlowTransition() {
  const { round1Metrics, startRound } = useSliceOfFlowStore();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      startRound(2);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FAF7F2' }}>
      {/* Header */}
      <div
        className="relative h-48 flex items-end"
        style={{
          backgroundImage: `url(${KITCHEN_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(250,247,242,1))' }}
        />
        <div className="relative px-8 pb-4">
          <h1
            className="text-4xl"
            style={{ fontFamily: "'Lilita One', cursive", color: '#1976D2' }}
          >
            {step === 0 ? 'What Just Happened?' : step === 1 ? 'Enter: Kanban' : 'Your New WIP Limits'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full">
        {/* Step 0: Reflection on Round 1 */}
        {step === 0 && round1Metrics && (
          <div>
            <p className="text-lg mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              Round 1 was a <strong>push system</strong>. Orders came in every 15 seconds whether you were ready or not.
              Sound like any sprint you've been in?
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 rounded-xl" style={{ background: '#E8F5E9', border: '2px solid #A5D6A7' }}>
                <div className="text-4xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2E7D32' }}>
                  {round1Metrics.served}
                </div>
                <div className="text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>Pizzas Served</div>
              </div>
              <div className="text-center p-6 rounded-xl" style={{ background: '#FFEBEE', border: '2px solid #EF9A9A' }}>
                <div className="text-4xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#B71C1C' }}>
                  {round1Metrics.burnt}
                </div>
                <div className="text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>Burnt Pizzas</div>
              </div>
              <div className="text-center p-6 rounded-xl" style={{ background: '#FFF3E0', border: '2px solid #FFCC80' }}>
                <div className="text-4xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E65100' }}>
                  {formatTime(round1Metrics.avgLeadTime)}
                </div>
                <div className="text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>Avg Lead Time</div>
              </div>
            </div>

            <div
              className="p-6 rounded-xl mb-6"
              style={{ background: '#FFF8E1', border: '2px solid #FFE082' }}
            >
              <p className="text-base" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
                <strong>The problem wasn't you.</strong> The problem was the system. When work is pushed in faster than you can process it,
                everything backs up. Quality drops. Stress rises. Pizzas burn.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Kanban Principles */}
        {step === 1 && (
          <div>
            <p className="text-lg mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              Kanban is a method for managing the flow of work. It comes from Toyota's manufacturing system.
              Here are the four principles you'll use in Round 2:
            </p>

            <div className="space-y-4">
              {KANBAN_PRINCIPLES.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-5 rounded-xl"
                  style={{ background: '#fff', border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                >
                  <span className="text-3xl flex-shrink-0">{p.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Lilita One', cursive", color: '#1976D2' }}>
                      {p.title}
                    </h3>
                    <p className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: WIP Limits */}
        {step === 2 && (
          <div>
            <p className="text-lg mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              In Round 2, each station has a <strong>WIP limit</strong>. You can't push more work in — you have to <strong>pull</strong> when there's capacity.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: 'Orders Queue', limit: WIP_LIMITS.orderQueue, color: '#1976D2', icon: '📋' },
                { label: 'Prep Station', limit: WIP_LIMITS.prep, color: '#F9A825', icon: '🔪' },
                { label: 'Oven', limit: WIP_LIMITS.oven, color: '#E64A19', icon: '🔥' },
                { label: 'Box & Deliver', limit: WIP_LIMITS.boxDeliver, color: '#388E3C', icon: '📦' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 p-5 rounded-xl"
                  style={{ background: '#fff', border: `2px solid ${item.color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                >
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                      {item.label}
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: item.color }}
                    >
                      Max {item.limit}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="p-6 rounded-xl mb-6"
              style={{ background: '#E3F2FD', border: '2px solid #90CAF9' }}
            >
              <p className="text-base" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
                <strong>The big change:</strong> You now control when orders enter the queue. No more auto-flip.
                Use the <strong>"Pull Next Order"</strong> button when you have capacity. Focus on finishing, not starting.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: '#E0E0E0',
                color: '#333',
              }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className="w-2.5 h-2.5 rounded-full transition-all"
                style={{ background: s === step ? '#1976D2' : '#E0E0E0' }}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-8 py-3 rounded-lg text-lg font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: step === 2 ? '#D94F3B' : '#1976D2',
              boxShadow: step === 2 ? '0 4px 15px rgba(217,79,59,0.4)' : '0 4px 15px rgba(25,118,210,0.4)',
            }}
          >
            {step === 2 ? 'Start Round 2 →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
