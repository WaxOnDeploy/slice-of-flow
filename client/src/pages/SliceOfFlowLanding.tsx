import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { DIFFICULTY_PRESETS, type Difficulty } from '@/lib/sliceOfFlowConstants';

const HERO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-landing-hero-BvjabfgNxM49wTAoo9T4aA.webp';

const DIFFICULTY_KEYS: Difficulty[] = ['easy', 'normal', 'hard'];

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; border: string; text: string; activeBg: string }> = {
  easy: { bg: '#E8F5E9', border: '#66BB6A', text: '#2E7D32', activeBg: '#C8E6C9' },
  normal: { bg: '#FFF3E0', border: '#FFA726', text: '#E65100', activeBg: '#FFE0B2' },
  hard: { bg: '#FFEBEE', border: '#EF5350', text: '#B71C1C', activeBg: '#FFCDD2' },
};

export default function SliceOfFlowLanding() {
  const startGame = useSliceOfFlowStore((s) => s.startGame);
  const skipToRound2 = useSliceOfFlowStore((s) => s.skipToRound2);
  const difficulty = useSliceOfFlowStore((s) => s.difficulty);
  const setDifficulty = useSliceOfFlowStore((s) => s.setDifficulty);

  const preset = DIFFICULTY_PRESETS[difficulty];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FAF7F2' }}>
      {/* Hero Section */}
      <div className="relative w-full" style={{ minHeight: '55vh' }}>
        <img
          src={HERO_IMG}
          alt="Slice of Flow Pizza Kitchen"
          className="w-full h-full object-cover absolute inset-0"
          style={{ minHeight: '55vh' }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(250,247,242,1) 100%)',
          }}
        />
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-4">
          <h1
            className="text-6xl md:text-7xl lg:text-8xl tracking-tight"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B', textShadow: '2px 2px 0 #FAF7F2, -1px -1px 0 #FAF7F2' }}
          >
            Slice of Flow
          </h1>
          <p
            className="text-xl md:text-2xl mt-1"
            style={{ fontFamily: "'DM Sans', sans-serif", color: '#666', fontWeight: 500 }}
          >
            A Kanban Pizza Shop Simulation
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 px-8 pt-6 pb-12 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Left — What is this? */}
          <div>
            <h2
              className="text-2xl mb-4"
              style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
            >
              What is this?
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              You run a pizza shop. Orders come in. You prep, bake, box, and deliver.
              Simple, right?
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              <strong>Round 1:</strong> Orders flood in whether you're ready or not.
              No limits. Pure chaos. Sound familiar?
            </p>
            <p className="text-base leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              <strong>Round 2:</strong> You discover Kanban. WIP limits. Pull systems.
              Same kitchen, same orders — but now you control the flow.
            </p>
          </div>

          {/* Right — How it works */}
          <div>
            <h2
              className="text-2xl mb-4"
              style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
            >
              How it works
            </h2>
            <div className="space-y-3">
              {[
                { icon: '📋', label: 'Orders', desc: 'Customers order pizza — each has a type and complexity' },
                { icon: '🔪', label: 'Prep', desc: 'Chop, sauce, top — Small (1 min), Medium (2 min), Large (3 min)' },
                { icon: '🔥', label: 'Oven', desc: `Bake until done. Leave it too long? It burns.` },
                { icon: '📦', label: 'Box & Deliver', desc: 'Box it up and get it out the door' },
                { icon: '⏱️', label: 'Timer', desc: `${Math.floor(preset.roundDuration / 60)} minutes per round. Every second counts.` },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <span className="font-semibold text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                      {item.label}
                    </span>
                    <span className="text-sm ml-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
                      — {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="mt-10">
          <h2
            className="text-2xl mb-4 text-center"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
          >
            Choose Your Heat Level
          </h2>
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {DIFFICULTY_KEYS.map((key) => {
              const p = DIFFICULTY_PRESETS[key];
              const colors = DIFFICULTY_COLORS[key];
              const isActive = difficulty === key;
              return (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className="relative p-5 rounded-xl text-left transition-all duration-200"
                  style={{
                    background: isActive ? colors.activeBg : '#fff',
                    border: `3px solid ${isActive ? colors.border : '#E0E0E0'}`,
                    boxShadow: isActive
                      ? `0 4px 16px ${colors.border}44, inset 0 0 0 1px ${colors.border}33`
                      : '0 2px 8px rgba(0,0,0,0.05)',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Selected indicator */}
                  {isActive && (
                    <div
                      className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: colors.border }}
                    >
                      ✓
                    </div>
                  )}

                  <div className="text-3xl mb-2">{p.icon}</div>
                  <div
                    className="text-xl font-bold mb-1"
                    style={{ fontFamily: "'Lilita One', cursive", color: colors.text }}
                  >
                    {p.label}
                  </div>
                  <div
                    className="text-xs mb-3"
                    style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}
                  >
                    {p.description}
                  </div>

                  {/* Stats */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: '#888' }}>Round</span>
                      <span style={{ color: colors.text, fontWeight: 700 }}>{Math.floor(p.roundDuration / 60)} min</span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: '#888' }}>Order Flip</span>
                      <span style={{ color: colors.text, fontWeight: 700 }}>every {p.orderFlipInterval}s</span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: '#888' }}>Burn Window</span>
                      <span style={{ color: colors.text, fontWeight: 700 }}>{Math.floor(p.ovenBurnTime / 60)}:{(p.ovenBurnTime % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: '#888' }}>Speed</span>
                      <span style={{ color: colors.text, fontWeight: 700 }}>{p.defaultSpeed}x default</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Buttons */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={startGame}
            className="group relative px-12 py-5 text-2xl font-bold text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: 'linear-gradient(135deg, #D94F3B 0%, #E64A19 100%)',
              boxShadow: '0 6px 20px rgba(217, 79, 59, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span className="relative z-10">Open the Kitchen</span>
          </button>
          <button
            onClick={skipToRound2}
            className="group relative px-8 py-3 text-lg font-bold text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
              boxShadow: '0 4px 14px rgba(25, 118, 210, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span className="relative z-10">Skip to Round 2 — WIP + Pull</span>
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#999' }}>
          Solo Practice Mode — {DIFFICULTY_PRESETS[difficulty].label} difficulty, {Math.floor(preset.roundDuration / 60)} minutes per round, 12 orders
        </p>
      </div>
    </div>
  );
}
