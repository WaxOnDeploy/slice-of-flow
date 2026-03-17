import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { DIFFICULTY_PRESETS } from '@/lib/sliceOfFlowConstants';
import { Chart, registerables } from 'chart.js';
import { toast } from 'sonner';

Chart.register(...registerables);

const LANDING_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-landing-hero-BvjabfgNxM49wTAoo9T4aA.webp';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── COMPARISON CHART ──────────────────────────────
function ComparisonChart({
  r1,
  r2,
}: {
  r1: { served: number; burnt: number; angry: number; score: number };
  r2: { served: number; burnt: number; angry: number; score: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: ['Served', 'Burnt', 'Angry', 'Score'],
        datasets: [
          {
            label: 'Round 1 (Push)',
            data: [r1.served, r1.burnt, r1.angry, r1.score],
            backgroundColor: ['#EF9A9A', '#EF9A9A', '#EF9A9A', '#EF9A9A'],
            borderColor: '#E64A19',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Round 2 (Pull)',
            data: [r2.served, r2.burnt, r2.angry, r2.score],
            backgroundColor: ['#90CAF9', '#90CAF9', '#90CAF9', '#90CAF9'],
            borderColor: '#1976D2',
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: "'DM Sans', sans-serif", size: 13, weight: 'bold' as const },
              color: '#333',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: "'JetBrains Mono', monospace", size: 12 },
              color: '#666',
            },
            grid: { color: '#E0E0E0' },
          },
          x: {
            ticks: {
              font: { family: "'DM Sans', sans-serif", size: 13 },
              color: '#333',
            },
            grid: { display: false },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [r1, r2]);

  return (
    <div style={{ height: 300 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── BRIDGE TABLE ──────────────────────────────────
const BRIDGE_ROWS = [
  { pizza: 'Order Deck', team: 'Product Backlog', desc: 'All the work that could be done' },
  { pizza: 'Orders Queue', team: 'Sprint Backlog', desc: 'Work committed for this iteration' },
  { pizza: 'Prep Station', team: 'In Development', desc: 'Actively being worked on' },
  { pizza: 'Oven', team: 'In Review / Testing', desc: 'Waiting for validation (you can\'t rush it)' },
  { pizza: 'Box & Deliver', team: 'Deployment / Release', desc: 'Ready to ship to the customer' },
  { pizza: 'Served', team: 'Done / In Production', desc: 'Delivered and accepted' },
  { pizza: 'Burnt Pizza', team: 'Defect / Rework', desc: 'Left too long without attention' },
  { pizza: 'Angry Customer', team: 'Missed SLA / Unhappy Stakeholder', desc: 'Lead time exceeded expectations' },
  { pizza: 'WIP Limit', team: 'WIP Limit', desc: 'Stop starting, start finishing' },
  { pizza: 'Push (Round 1)', team: 'Scope Creep / Overcommitment', desc: 'Work forced in regardless of capacity' },
  { pizza: 'Pull (Round 2)', team: 'Pull System / Kanban', desc: 'Take work only when you have capacity' },
];

// ─── SHARE RESULTS ─────────────────────────────────
function generateShareText(
  r1: { served: number; burnt: number; angry: number; avgLeadTime: number; score: number },
  r2: { served: number; burnt: number; angry: number; avgLeadTime: number; score: number },
  improvement: number,
  difficultyLabel: string,
) {
  const arrow = (v1: number, v2: number, lowerIsBetter = false) => {
    const diff = v2 - v1;
    if (diff === 0) return '→';
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    return improved ? '↑' : '↓';
  };

  return `🍕 Slice of Flow — My Results (${difficultyLabel} Mode)

Round 1 (Push) vs Round 2 (Pull):

  Served:     ${r1.served} → ${r2.served}  ${arrow(r1.served, r2.served)}
  Burnt:      ${r1.burnt} → ${r2.burnt}  ${arrow(r1.burnt, r2.burnt, true)}
  Angry:      ${r1.angry} → ${r2.angry}  ${arrow(r1.angry, r2.angry, true)}
  Lead Time:  ${formatTime(r1.avgLeadTime)} → ${formatTime(r2.avgLeadTime)}  ${arrow(r1.avgLeadTime, r2.avgLeadTime, true)}
  Score:      ${r1.score} → ${r2.score}  ${arrow(r1.score, r2.score)}

${improvement >= 0 ? '📈' : '📉'} ${improvement >= 0 ? '+' : ''}${improvement}% improvement

WIP limits + pull systems = better flow.
Stop starting, start finishing. 🚦

Play it yourself → sliceofflow.com
#SliceOfFlow #Kanban #Agile #FlowMetrics`;
}

export default function SliceOfFlowDebrief() {
  const { round1Metrics, round2Metrics, resetGame, difficulty } = useSliceOfFlowStore();
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const r1 = round1Metrics || { served: 0, burnt: 0, angry: 0, avgLeadTime: 0, stillInProgress: 0, score: 0 };
  const r2 = round2Metrics || { served: 0, burnt: 0, angry: 0, avgLeadTime: 0, stillInProgress: 0, score: 0 };

  const improvement = useMemo(() => {
    if (r1.score === 0) return 0;
    return Math.round(((r2.score - r1.score) / Math.abs(r1.score)) * 100);
  }, [r1.score, r2.score]);

  const difficultyLabel = DIFFICULTY_PRESETS[difficulty].label;

  const handleShare = useCallback(async () => {
    const text = generateShareText(r1, r2, improvement, difficultyLabel);

    // Try native share first (mobile/tablet), fall back to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Slice of Flow — My Results',
          text,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(text);
      setShareState('copied');
      toast.success('Results copied to clipboard!', { duration: 3000 });
      setTimeout(() => setShareState('idle'), 3000);
    } catch {
      // Final fallback: select text in a textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareState('copied');
      toast.success('Results copied to clipboard!', { duration: 3000 });
      setTimeout(() => setShareState('idle'), 3000);
    }
  }, [r1, r2, improvement, difficultyLabel]);

  return (
    <div className="min-h-screen" style={{ background: '#FAF7F2' }}>
      {/* Header */}
      <div
        className="relative h-40 flex items-end"
        style={{
          backgroundImage: `url(${LANDING_IMG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(250,247,242,1))' }}
        />
        <div className="relative px-8 pb-4">
          <h1
            className="text-4xl"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B' }}
          >
            The Results Are In
          </h1>
          <p className="text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
            Push vs. Pull — Let the numbers speak ({difficultyLabel} Mode)
          </p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl mx-auto">
        {/* Score comparison */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="text-center p-6 rounded-xl" style={{ background: '#FFF3E0', border: '2px solid #FFCC80' }}>
            <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#E64A19' }}>
              Round 1 — Push
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E64A19' }}>
              {r1.score}
            </div>
            <div className="text-xs mt-1" style={{ color: '#999' }}>points</div>
          </div>

          <div className="text-center p-6 rounded-xl" style={{ background: '#E8F5E9', border: '2px solid #A5D6A7' }}>
            <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#2E7D32' }}>
              Improvement
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: improvement >= 0 ? '#2E7D32' : '#B71C1C' }}>
              {improvement >= 0 ? '+' : ''}{improvement}%
            </div>
            <div className="text-xs mt-1" style={{ color: '#999' }}>score change</div>
          </div>

          <div className="text-center p-6 rounded-xl" style={{ background: '#E3F2FD', border: '2px solid #90CAF9' }}>
            <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#1976D2' }}>
              Round 2 — Pull
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1976D2' }}>
              {r2.score}
            </div>
            <div className="text-xs mt-1" style={{ color: '#999' }}>points</div>
          </div>
        </div>

        {/* Detailed metrics table */}
        <div className="mb-10">
          <h2 className="text-2xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            Side-by-Side
          </h2>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #E0E0E0' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#333' }}>
                  <th className="text-left px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>Metric</th>
                  <th className="text-center px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#EF9A9A' }}>Round 1 (Push)</th>
                  <th className="text-center px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#90CAF9' }}>Round 2 (Pull)</th>
                  <th className="text-center px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#A5D6A7' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Pizzas Served', v1: r1.served, v2: r2.served, unit: '', better: 'higher' },
                  { label: 'Burnt Pizzas', v1: r1.burnt, v2: r2.burnt, unit: '', better: 'lower' },
                  { label: 'Angry Customers', v1: r1.angry, v2: r2.angry, unit: '', better: 'lower' },
                  { label: 'Avg Lead Time', v1: r1.avgLeadTime, v2: r2.avgLeadTime, unit: 'time', better: 'lower' },
                  { label: 'Still In Progress', v1: r1.stillInProgress, v2: r2.stillInProgress, unit: '', better: 'lower' },
                  { label: 'Final Score', v1: r1.score, v2: r2.score, unit: '', better: 'higher' },
                ].map((row, i) => {
                  const diff = row.v2 - row.v1;
                  const improved = row.better === 'higher' ? diff > 0 : diff < 0;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                        {row.label}
                      </td>
                      <td className="text-center px-4 py-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E64A19' }}>
                        {row.unit === 'time' ? formatTime(row.v1) : row.v1}
                      </td>
                      <td className="text-center px-4 py-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1976D2' }}>
                        {row.unit === 'time' ? formatTime(row.v2) : row.v2}
                      </td>
                      <td className="text-center px-4 py-3 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: improved ? '#2E7D32' : diff === 0 ? '#999' : '#B71C1C' }}>
                        {row.unit === 'time'
                          ? (diff < 0 ? '-' : '+') + formatTime(Math.abs(diff))
                          : (diff > 0 ? '+' : '') + diff
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-10">
          <h2 className="text-2xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            Visual Comparison
          </h2>
          <div className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid #E0E0E0' }}>
            <ComparisonChart r1={r1} r2={r2} />
          </div>
        </div>

        {/* Bridge Table */}
        <div className="mb-10">
          <h2 className="text-2xl mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            The Bridge
          </h2>
          <p className="text-sm mb-4" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
            Everything in the pizza shop maps to your real team:
          </p>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #E0E0E0' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#D94F3B' }}>
                  <th className="text-left px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>Pizza Shop</th>
                  <th className="text-left px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>Your Team</th>
                  <th className="text-left px-4 py-3 text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>Why It Matters</th>
                </tr>
              </thead>
              <tbody>
                {BRIDGE_ROWS.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FFF8E7', borderBottom: '1px solid #F0F0F0' }}>
                    <td className="px-4 py-2.5 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#D94F3B' }}>
                      {row.pizza}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1976D2' }}>
                      {row.team}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
                      {row.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="mb-10">
          <h2 className="text-2xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            Key Takeaways
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: '🚦', title: 'WIP Limits Work', desc: 'Limiting work in progress reduces chaos, improves quality, and increases throughput.' },
              { icon: '🎯', title: 'Pull > Push', desc: "When you control what enters the system, you control the outcome. Stop starting, start finishing." },
              { icon: '🔥', title: 'Multitasking Burns', desc: "Every pizza in the oven is a context switch. Too many and they all burn." },
              { icon: '📊', title: 'Flow is Measurable', desc: 'Lead time, throughput, and WIP are the metrics that matter. Track them.' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 rounded-xl"
                style={{ background: '#fff', border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              >
                <span className="text-3xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="text-base font-bold mb-1" style={{ fontFamily: "'Lilita One', cursive", color: '#333' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center pb-12">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {/* Share Results */}
            <button
              onClick={handleShare}
              className="px-8 py-4 rounded-lg text-xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Lilita One', cursive",
                background: shareState === 'copied' ? '#2E7D32' : '#1976D2',
                color: '#fff',
                boxShadow: shareState === 'copied'
                  ? '0 6px 20px rgba(46, 125, 50, 0.4)'
                  : '0 6px 20px rgba(25, 118, 210, 0.4)',
              }}
            >
              {shareState === 'copied' ? '✓ Copied!' : '📤 Share Results'}
            </button>

            {/* Play Again */}
            <button
              onClick={resetGame}
              className="px-10 py-4 rounded-lg text-xl font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Lilita One', cursive",
                background: 'linear-gradient(135deg, #D94F3B 0%, #E64A19 100%)',
                boxShadow: '0 6px 20px rgba(217, 79, 59, 0.4)',
              }}
            >
              Play Again
            </button>
          </div>
          <p className="text-xs mt-3" style={{ fontFamily: "'DM Sans', sans-serif", color: '#999' }}>
            Try different strategies and difficulty levels. Can you beat your score?
          </p>
        </div>
      </div>
    </div>
  );
}
