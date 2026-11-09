import { useState } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { DIFFICULTY_PRESETS, type Difficulty } from '@/lib/sliceOfFlowConstants';
import { ACCESS_SUMMARY, getPrivacyDisclosure, HERO_IMAGE } from '@/lib/sliceOfFlowBrand';
import SliceOfFlowAuthorCredit from '@/components/SliceOfFlowAuthorCredit';
import SliceOfFlowOrderGuide from '@/components/SliceOfFlowOrderGuide';

const HERO_IMG = HERO_IMAGE;

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
  const [showFacilitatorGuide, setShowFacilitatorGuide] = useState(false);

  const preset = DIFFICULTY_PRESETS[difficulty];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FAF7F2' }}>
      {/* Plain HTML credit: outside the illustration, visible before any scrolling. */}
      <header className="px-5 pt-5 pb-4 sm:px-8" data-testid="landing-identity">
        <div className="max-w-5xl mx-auto">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl tracking-tight"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B' }}
          >
            Slice of Flow
          </h1>
          <SliceOfFlowAuthorCredit className="mt-2" />
          <p className="text-base sm:text-lg mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
            A Kanban Pizza Shop Simulation
          </p>
          <p className="text-sm mt-3 font-medium" style={{ fontFamily: "'DM Sans', sans-serif", color: '#534334' }} data-testid="access-summary">
            {ACCESS_SUMMARY}
          </p>
          <details className="mt-2 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#534334' }}>
            <summary className="cursor-pointer w-fit rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1976D2]">
              Privacy &amp; browser storage
            </summary>
            <p className="mt-2 max-w-3xl leading-relaxed" data-testid="privacy-disclosure">
              {getPrivacyDisclosure(Boolean(import.meta.env.VITE_ANALYTICS_ENDPOINT && import.meta.env.VITE_ANALYTICS_WEBSITE_ID))}
            </p>
          </details>
        </div>
      </header>

      {/* Hero art retains the verified MHA door plaque as decoration. */}
      <div className="w-full max-w-5xl mx-auto" data-testid="hero-art">
        <img
          src={HERO_IMG}
          alt="Cartoon Slice of Flow pizza shop, with Jeff Bourke as one of the kitchen chefs"
          className="block w-full h-auto"
          width={2560}
          height={1440}
        />
      </div>

      {/* Content Section */}
      <div className="flex-1 px-5 sm:px-8 pt-6 pb-12 max-w-5xl mx-auto w-full">

        {/* ─── WHO IS THIS FOR ─── */}
        <div
          className="mb-8 p-5 rounded-xl"
          style={{ background: '#FFF8E7', border: '2px solid #D4A843' }}
        >
          <h2
            className="text-xl mb-2"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
          >
            Who is this for?
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
            <strong>Slice of Flow</strong> is a hands-on Kanban training tool built for <strong>Scrum Masters, Agile coaches, RTEs, and delivery leads</strong> who want to teach their teams about flow, WIP limits, and pull systems — without a 90-minute lecture.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { icon: '👥', label: 'Team Workshop', desc: 'Project on a big screen. The whole team plays together, debating which pizza to pull next.' },
              { icon: '🎓', label: 'Coaching Session', desc: 'Walk a team through push vs. pull in 15 minutes. The debrief writes itself.' },
              { icon: '🧑‍💻', label: 'Self-Paced Learning', desc: 'Individual team members explore flow concepts at their own pace before a retrospective.' },
            ].map((item) => (
              <div key={item.label} className="flex gap-2 items-start">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <div className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>{item.label}</div>
                  <div className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── WHAT WILL YOUR TEAM LEARN ─── */}
        <div className="mb-8">
          <h2
            className="text-xl mb-3"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
          >
            What will your team learn?
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { icon: '🚦', title: 'WIP Limits', desc: 'Why limiting work-in-progress reduces chaos and increases throughput' },
              { icon: '🔄', title: 'Pull vs. Push', desc: 'The difference between work being forced in vs. pulled when ready' },
              { icon: '🔥', title: 'Bottleneck Management', desc: 'What happens when the oven (review/testing) becomes the constraint' },
              { icon: '📊', title: 'Flow Metrics', desc: 'Lead time, throughput, and quality — measured and compared across rounds' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-3 items-start p-3 rounded-lg"
                style={{ background: '#fff', border: '1px solid #E0E0E0' }}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <div className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>{item.title}</div>
                  <div className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-10 mb-8">
          {/* Left — What is this? */}
          <div>
            <h2
              className="text-2xl mb-4"
              style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
            >
              How it works
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              You run a pizza shop. Orders come in. You prep, bake, box, and deliver.
              Simple, right?
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              <strong>Round 1 (Push):</strong> Orders flood in whether you're ready or not.
              No limits. Pure chaos. Sound familiar?
            </p>
            <p className="text-base leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>
              <strong>Round 2 (Pull + WIP):</strong> You discover Kanban. WIP limits. Pull systems.
              Same kitchen, same orders — but now you control the flow.
            </p>
          </div>

          {/* Right — The Kitchen Stages */}
          <div>
            <h2
              className="text-2xl mb-4"
              style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
            >
              The Kitchen
            </h2>
            <div className="space-y-3">
              {[
                { icon: '📋', label: 'Orders', desc: 'Customers order pizza — each has a type and complexity' },
                { icon: '🔪', label: 'Prep', desc: 'Chop, sauce, top — Small (30s), Medium (1 min), Large (1:30)' },
                { icon: '🍕', label: 'Oven', desc: 'Bake times vary! Small (40s), Medium (1 min), Large (1:20)' },
                { icon: '📦', label: 'Box & Deliver', desc: 'Box it up and get it out the door' },
                { icon: '⏱️', label: 'Timer', desc: `${Math.floor(preset.roundDuration / 60)} simulated kitchen minutes per round. Clock speed controls how fast they pass.` },
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
        <div className="mt-6">
          <h2
            className="text-2xl mb-4 text-center"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}
          >
            Choose Your Heat Level
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
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
                      <span style={{ color: '#888' }}>Kitchen time</span>
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

        <p className="text-center text-sm mt-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
          <strong>Best on a laptop or tablet.</strong>{' '}
          The board is optimized for 1024px+ screens. Mouse, touch, and keyboard controls are available on the board.
        </p>

        {/* Always visible before both play paths, even when the tutorial was seen. */}
        <SliceOfFlowOrderGuide className="mt-6" testId="landing-order-guide" />
        <p className="text-base leading-relaxed mt-3" style={{ fontFamily: "'DM Sans', sans-serif", color: '#534334' }} data-testid="landing-kitchen-time">
          {`${preset.label}: ${Math.floor(preset.roundDuration / 60)} simulated kitchen minutes per round. Default clock speed is ${preset.defaultSpeed}x — ${preset.defaultSpeed} kitchen seconds pass per real second. You can change speed or pause on the board.`}
        </p>

        {/* Start Buttons */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={startGame}
            className="group relative w-full sm:w-auto max-w-full px-6 sm:px-12 py-5 text-2xl font-bold text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: 'linear-gradient(135deg, #D94F3B 0%, #E64A19 100%)',
              boxShadow: '0 6px 20px rgba(217, 79, 59, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span className="relative z-10">Open the Kitchen</span>
          </button>
          <div className="flex items-center gap-4 w-full sm:w-auto max-w-full">
            <button
              onClick={skipToRound2}
              className="group relative w-full sm:w-auto max-w-full px-6 sm:px-8 py-3 text-lg font-bold text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Lilita One', cursive",
                background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                boxShadow: '0 4px 14px rgba(25, 118, 210, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <span className="relative z-10">Skip to Round 2 — WIP + Pull</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-4 mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#999' }}>
          {preset.label} difficulty — {Math.floor(preset.roundDuration / 60)} simulated kitchen minutes per round — 12 orders
        </p>

        {/* ─── FACILITATOR QUICK-START ─── */}
        <div className="mt-4 mb-6">
          <button
            onClick={() => setShowFacilitatorGuide(!showFacilitatorGuide)}
            className="w-full flex items-center justify-between p-4 rounded-xl transition-all"
            style={{
              background: showFacilitatorGuide ? '#E8EAF6' : '#F5F5F5',
              border: `2px solid ${showFacilitatorGuide ? '#5C6BC0' : '#E0E0E0'}`,
              cursor: 'pointer',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <span className="text-sm font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                Facilitator Quick-Start Guide
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E8EAF6', color: '#3949AB', fontFamily: "'DM Sans', sans-serif" }}>
                2 min prep
              </span>
            </div>
            <span className="text-lg" style={{ color: '#666', transform: showFacilitatorGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▼
            </span>
          </button>

          {showFacilitatorGuide && (
            <div
              className="mt-2 p-5 rounded-xl"
              style={{ background: '#fff', border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            >
              <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "'Lilita One', cursive", color: '#3949AB' }}>
                Running Slice of Flow with Your Team
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-bold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                    Setup (1 minute)
                  </div>
                  <ul className="text-xs space-y-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    <li>• Open this page on a big screen or projector that everyone can see</li>
                    <li>• Choose <strong>Normal</strong> difficulty for most teams (Easy for brand-new Agile teams)</li>
                    <li>• Tell the team: <em>"We're going to run a pizza shop. Your job is to serve as many customers as possible without burning anything."</em></li>
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-bold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                    {`Round 1 — Push (${Math.floor(preset.roundDuration / 60)} simulated kitchen min)`}
                  </div>
                  <ul className="text-xs space-y-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    <li>• Click <strong>"Open the Kitchen"</strong> — the team calls out moves together</li>
                    <li>• Let the chaos happen. Don't coach. Orders pile up, pizzas burn — that's the point</li>
                    <li>• When the round ends, ask: <em>"What happened? Why did pizzas burn?"</em></li>
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-bold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                    {`Round 2 — Pull + WIP (${Math.floor(preset.roundDuration / 60)} simulated kitchen min)`}
                  </div>
                  <ul className="text-xs space-y-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    <li>• The transition screen explains WIP limits and pull — read it together</li>
                    <li>• Now the team must decide when to pull orders. Coach them: <em>"Finish what's started before starting something new"</em></li>
                    <li>• Watch the difference in flow, lead time, and burn rate</li>
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-bold mb-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                    Debrief (5 min)
                  </div>
                  <ul className="text-xs space-y-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    <li>• The results page shows side-by-side metrics and a "Bridge" table mapping pizza concepts to real team dynamics</li>
                    <li>• Key questions: <em>"What changed between rounds? How does this relate to our sprint work?"</em></li>
                    <li>• Connect the dots: Orders = Backlog, Oven = Review/Testing, Burnt Pizza = Defects, WIP Limit = Stop Starting, Start Finishing</li>
                  </ul>
                </div>

                <div
                  className="p-3 rounded-lg text-xs"
                  style={{ background: '#FFF8E7', border: '1px solid #D4A843', fontFamily: "'DM Sans', sans-serif", color: '#666' }}
                >
                  <strong style={{ color: '#D4A843' }}>Tip:</strong> For a shorter session, use "Skip to Round 2" and focus the debrief on what WIP limits feel like in practice. Round time is simulated kitchen time; allow extra real time for discussion and pauses.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── BROWSER SUPPORT NOTICE ─── */}
        <div className="text-center text-xs pb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#BBB' }}>
          Best experienced on desktop or tablet (1024px+) in Chrome, Edge, Firefox, or Safari.
          <br />
          Mobile devices work but the board is optimized for wider screens.
        </div>
      </div>
    </div>
  );
}
