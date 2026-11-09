import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import { DIFFICULTY_PRESETS } from '@/lib/sliceOfFlowConstants';
import { getResultsComparison, getDebriefInsights, generateShareText, hasLeadTime } from '@/lib/sliceOfFlowResults';
import { BUILT_BY, HERO_IMAGE } from '@/lib/sliceOfFlowBrand';
import { Chart, registerables } from 'chart.js';
import { toast } from 'sonner';

Chart.register(...registerables);

const LANDING_IMG = HERO_IMAGE;

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

// ─── SINGLE ROUND CHART (for skip-to-round-2) ────
function SingleRoundChart({
  metrics,
}: {
  metrics: { served: number; burnt: number; angry: number; score: number };
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
            label: 'Round 2 (Pull + WIP)',
            data: [metrics.served, metrics.burnt, metrics.angry, metrics.score],
            backgroundColor: ['#90CAF9', '#EF9A9A', '#FFE082', '#A5D6A7'],
            borderColor: ['#1976D2', '#E64A19', '#F57F17', '#2E7D32'],
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
  }, [metrics]);

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
  { pizza: 'Pizza Box', team: 'Deployment / Release', desc: 'Ready to ship to the customer' },
  { pizza: 'Served', team: 'Done / In Production', desc: 'Delivered and accepted' },
  { pizza: 'Burnt Pizza', team: 'Defect / Rework', desc: 'Left too long without attention' },
  { pizza: 'Angry Customer', team: 'Missed SLA / Unhappy Stakeholder', desc: 'Lead time exceeded expectations' },
  { pizza: 'WIP Limit', team: 'WIP Limit', desc: 'Stop starting, start finishing' },
  { pizza: 'Push (Round 1)', team: 'Scope Creep / Overcommitment', desc: 'Work forced in regardless of capacity' },
  { pizza: 'Pull (Round 2)', team: 'Pull System / Kanban', desc: 'Take work only when you have capacity' },
];

export default function SliceOfFlowDebrief() {
  const { round1Metrics, round2Metrics, resetGame, difficulty } = useSliceOfFlowStore();
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  // Detect if Round 1 was skipped (skip-to-round-2 feature)
  const skippedRound1 = round1Metrics === null;

  const r1 = round1Metrics || { served: 0, burnt: 0, angry: 0, avgLeadTime: 0, stillInProgress: 0, score: 0 };
  const r2 = round2Metrics || { served: 0, burnt: 0, angry: 0, avgLeadTime: 0, stillInProgress: 0, score: 0 };

  const comparison = useMemo(() => getResultsComparison(round1Metrics, round2Metrics), [round1Metrics, round2Metrics]);
  const improvement = comparison.scorePercent === null ? null : Number(comparison.scorePercent.toFixed(1));
  const insights = useMemo(() => getDebriefInsights(round1Metrics, round2Metrics), [round1Metrics, round2Metrics]);

  const difficultyLabel = DIFFICULTY_PRESETS[difficulty].label;

  const handleShare = useCallback(async () => {
    const text = generateShareText(round1Metrics, round2Metrics, difficultyLabel);

    // Try native share first (mobile/tablet), fall back to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Slice of Flow — My Results',
          text,
        });
        return;
      } catch (error) {
        // Cancelling a share must not unexpectedly copy the results.
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
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
  }, [round1Metrics, round2Metrics, difficultyLabel]);

  if (!round2Metrics) {
    return (
      <div className="min-h-screen p-8" style={{ background: '#FAF7F2', color: '#444' }}>
        <h1 className="text-3xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B' }}>No Round 2 results yet</h1>
        <p className="mb-6">Complete Round 2 to see your results. Missing results are not treated as a zero-score round.</p>
        <button onClick={resetGame} className="px-6 py-3 rounded-lg text-white font-bold" style={{ background: '#D94F3B' }}>Return to the kitchen</button>
      </div>
    );
  }

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
            {skippedRound1
              ? `Round 2 Results — Pull + WIP Limits (${difficultyLabel} Mode)`
              : `Push vs. Pull — Let the numbers speak (${difficultyLabel} Mode)`
            }
          </p>
          <p className="text-sm mt-2 font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#444' }}>{BUILT_BY}</p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl mx-auto">

        {/* Top action buttons — easy to find */}
        <div className="flex items-center justify-end gap-3 mb-6">
          <button
            onClick={handleShare}
            className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: shareState === 'copied' ? '#2E7D32' : '#1976D2',
              color: '#fff',
              boxShadow: '0 3px 10px rgba(25,118,210,0.3)',
            }}
          >
            {shareState === 'copied' ? '\u2713 Copied!' : '\ud83d\udce4 Share'}
          </button>
          <button
            onClick={resetGame}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Lilita One', cursive",
              background: '#D94F3B',
              boxShadow: '0 3px 10px rgba(217,79,59,0.3)',
            }}
          >
            {skippedRound1 ? 'Play Full Game' : 'Play Again'}
          </button>
        </div>

        {/* ─── SKIPPED ROUND 1: Single-round summary ─── */}
        {skippedRound1 ? (
          <>
            {/* Info banner */}
            <div
              className="mb-8 p-4 rounded-xl flex items-center gap-3"
              style={{ background: '#E3F2FD', border: '1px solid #90CAF9' }}
            >
              <span className="text-2xl">ℹ️</span>
              <div>
                <div className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1565C0' }}>
                  Round 1 was skipped
                </div>
                <div className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
                  Showing Round 2 results only. Play the full game to see a Push vs. Pull comparison!
                </div>
              </div>
            </div>

            {/* Single score card */}
            <div className="flex justify-center mb-10">
              <div className="text-center p-8 rounded-xl" style={{ background: '#E3F2FD', border: '2px solid #90CAF9', minWidth: 280 }}>
                <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#1976D2' }}>
                  Round 2 — Pull + WIP
                </div>
                <div className="text-6xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1976D2' }}>
                  {r2.score}
                </div>
                <div className="text-xs mt-1" style={{ color: '#999' }}>points</div>
              </div>
            </div>

            {/* Service bell — finished early */}
            {r2.timeRemaining && r2.timeRemaining > 0 && (
              <div className="text-center mb-6 p-3 rounded-xl" style={{ background: '#E8F5E9', border: '1px solid #A5D6A7' }}>
                <span className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#2E7D32' }}>
                  \ud83d\udd14 Finished with <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(r2.timeRemaining)}</strong> to spare!
                </span>
              </div>
            )}

            {/* Single-round metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
              {[
                { label: 'Served', value: r2.served, color: '#2E7D32', bg: '#E8F5E9' },
                { label: 'Burnt', value: r2.burnt, color: '#B71C1C', bg: '#FFEBEE' },
                { label: 'Angry', value: r2.angry, color: '#E65100', bg: '#FFF3E0' },
                { label: 'Avg Lead Time', value: hasLeadTime(round2Metrics) ? formatTime(r2.avgLeadTime) : 'n/a', color: '#1976D2', bg: '#E3F2FD' },
                { label: 'Still In Progress', value: r2.stillInProgress, color: '#666', bg: '#F5F5F5' },
              ].map((item) => (
                <div key={item.label} className="text-center p-4 rounded-xl" style={{ background: item.bg }}>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: item.color }}>
                    {item.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#666' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Single round chart */}
            <div className="mb-10">
              <h2 className="text-2xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
                Your Performance
              </h2>
              <div className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid #E0E0E0' }}>
                <SingleRoundChart metrics={r2} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ─── FULL GAME: Push vs Pull comparison ─── */}
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

              <div className="text-center p-6 rounded-xl" style={{ background: improvement === null ? '#F5F5F5' : improvement > 0 ? '#E8F5E9' : improvement < 0 ? '#FFEBEE' : '#F5F5F5', border: `2px solid ${improvement === null || improvement === 0 ? '#E0E0E0' : improvement > 0 ? '#A5D6A7' : '#EF9A9A'}` }}>
                <div className="text-sm font-semibold mb-2" style={{ fontFamily: "'Lilita One', cursive", color: '#555' }}>
                  Improvement
                </div>
                <div data-testid="score-improvement" className="text-5xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: improvement === null || improvement === 0 ? '#666' : improvement > 0 ? '#2E7D32' : '#B71C1C' }}>
                  {improvement === null ? 'n/a' : `${improvement > 0 ? '+' : ''}${improvement}%`}
                </div>
                <div className="text-xs mt-1" style={{ color: '#999' }}>
                  {improvement === null ? 'Score percentage unavailable' : improvement === 0 ? 'Same score both rounds' : 'score change'}
                </div>
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

            {/* Service bell — finished early */}
            {r2.timeRemaining && r2.timeRemaining > 0 && (
              <div className="text-center mb-8 p-3 rounded-xl" style={{ background: '#E8F5E9', border: '1px solid #A5D6A7' }}>
                <span className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#2E7D32' }}>
                  \ud83d\udd14 Round 2 finished with <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(r2.timeRemaining)}</strong> to spare!
                </span>
              </div>
            )}

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
                      { label: 'Avg Lead Time', v1: r1.avgLeadTime, v2: r2.avgLeadTime, unit: 'time', better: 'lower', served1: r1.served, served2: r2.served },
                      { label: 'Still In Progress', v1: r1.stillInProgress, v2: r2.stillInProgress, unit: '', better: 'lower' },
                      { label: 'Final Score', v1: r1.score, v2: r2.score, unit: '', better: 'higher' },
                    ].map((row, i) => {
                      const diff = row.v2 - row.v1;
                      const unavailable = row.unit === 'time' && comparison.leadTimeDelta === null;
                      const improved = row.better === 'higher' ? diff > 0 : diff < 0;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: '#333' }}>
                            {row.label}
                          </td>
                          <td className="text-center px-4 py-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E64A19' }}>
                            {row.unit === 'time' ? (hasLeadTime(round1Metrics) ? formatTime(row.v1) : 'n/a') : row.v1}
                          </td>
                          <td className="text-center px-4 py-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1976D2' }}>
                            {row.unit === 'time' ? (hasLeadTime(round2Metrics) ? formatTime(row.v2) : 'n/a') : row.v2}
                          </td>
                          <td data-testid={row.unit === 'time' ? 'lead-time-change' : undefined} className="text-center px-4 py-3 font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: unavailable ? '#666' : improved ? '#2E7D32' : diff === 0 ? '#999' : '#B71C1C' }}>
                            {unavailable
                              ? 'n/a'
                              : diff === 0
                              ? '\u2014'
                              : row.unit === 'time'
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
          </>
        )}

        {/* Bridge Table — always shown */}
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

        {/* Key Takeaways — always shown */}
        <div className="mb-10">
          <h2 className="text-2xl mb-4" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            What Did We Learn?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {insights.map((item, i) => (
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
                  <p className="text-sm mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
                    {item.desc}
                  </p>
                  <p className="text-xs italic" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#999' }}>
                    {item.metric}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discussion Questions for Teams */}
        <div className="mb-10">
          <h2 className="text-2xl mb-3" style={{ fontFamily: "'Lilita One', cursive", color: '#D4A843' }}>
            Team Discussion Questions
          </h2>
          <div className="p-5 rounded-xl" style={{ background: '#F3E5F5', border: '1px solid #CE93D8' }}>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                'Where are the "ovens" (bottlenecks) in our real workflow?',
                'What happens to quality when we take on too much work at once?',
                'How would explicit WIP limits change our daily standup?',
                'What\'s our team\'s equivalent of a "burnt pizza"?',
                'Do we push work into the system or pull it when we have capacity?',
                'How could we measure lead time for our actual work items?',
              ].map((q, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm flex-shrink-0 font-bold" style={{ color: '#7B1FA2' }}>{i + 1}.</span>
                  <p className="text-sm" style={{ fontFamily: "'DM Sans', sans-serif", color: '#4A148C' }}>{q}</p>
                </div>
              ))}
            </div>
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

            {/* Play Again / Play Full Game */}
            <button
              onClick={resetGame}
              className="px-10 py-4 rounded-lg text-xl font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Lilita One', cursive",
                background: 'linear-gradient(135deg, #D94F3B 0%, #E64A19 100%)',
                boxShadow: '0 6px 20px rgba(217, 79, 59, 0.4)',
              }}
            >
              {skippedRound1 ? 'Play Full Game' : 'Play Again'}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ fontFamily: "'DM Sans', sans-serif", color: '#999' }}>
            {skippedRound1
              ? 'Try the full game to experience the Push vs. Pull difference firsthand!'
              : 'Try different strategies and difficulty levels. Can you beat your score?'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
