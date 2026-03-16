import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';

const HERO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-landing-hero-BvjabfgNxM49wTAoo9T4aA.webp';

export default function SliceOfFlowLanding() {
  const startGame = useSliceOfFlowStore((s) => s.startGame);

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
              <strong>Round 1:</strong> Orders flood in every 15 seconds whether you're ready or not.
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
                { icon: '🔥', label: 'Oven', desc: '2 minutes to bake. Leave it too long? It burns.' },
                { icon: '📦', label: 'Box & Deliver', desc: 'Box it up and get it out the door' },
                { icon: '⏱️', label: 'Timer', desc: '5 minutes per round. Every second counts.' },
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

        {/* Start Button */}
        <div className="mt-10 flex justify-center">
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
        </div>

        <p className="text-center text-xs mt-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#999' }}>
          Solo Practice Mode — 5 minutes per round, 12 orders
        </p>
      </div>
    </div>
  );
}
