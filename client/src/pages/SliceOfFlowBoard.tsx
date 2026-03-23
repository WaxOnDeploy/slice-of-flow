import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSliceOfFlowStore, type SpeedMultiplier } from '@/lib/sliceOfFlowStore';
import {
  COLUMNS,
  WIP_LIMITS,
  DIFFICULTY_PRESETS,
  type ColumnId,
  type OrderCard,
} from '@/lib/sliceOfFlowConstants';
import { toast } from 'sonner';
import SliceOfFlowTutorial from '@/components/SliceOfFlowTutorial';
import {
  playCardMove,
  playServed,
  playOvenSizzle,
  playPullOrder,
  playWipBlocked,
  playGameStart,
  playServiceBell,
  isSoundEnabled,
  toggleSound,
} from '@/lib/sliceOfFlowSounds';

const BOARD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-board-texture-KNwu2LircNbQS5UCEasJLy.webp';

// ─── KITCHEN MENU BOARD ───────────────────────────
function KitchenMenuBoard({ burnWindow }: { burnWindow: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', top: 60, right: 12, zIndex: 100 }}>
      {/* Toggle button — looks like a hanging menu sign */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: open ? '#5D2E0C' : '#7B3F1A',
          color: '#FFF8E1',
          border: '2px solid #3E1A00',
          borderRadius: 8,
          padding: '6px 12px',
          fontFamily: "'Lilita One', cursive",
          fontSize: 14,
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        title="Kitchen Menu — Prep & Cook Times"
      >
        <span style={{ fontSize: 18 }}>📋</span>
        <span>Menu</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Menu board panel */}
      {open && (
        <div
          style={{
            marginTop: 6,
            background: 'linear-gradient(180deg, #3E2010 0%, #2A1508 100%)',
            border: '3px solid #5D2E0C',
            borderRadius: 10,
            padding: '16px 18px 14px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            width: 260,
            position: 'relative',
          }}
        >
          {/* Pushpin */}
          <div style={{
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50)',
            width: 16, height: 16, borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 40%, #E53935, #B71C1C)',
            border: '2px solid #7f0000',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }} />

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{
              fontFamily: "'Lilita One', cursive",
              fontSize: 18,
              color: '#FFC107',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              letterSpacing: 1,
            }}>
              🍕 Today's Specials
            </div>
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,193,7,0.4), transparent)',
              margin: '6px 0',
            }} />
          </div>

          {/* Menu items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { size: 'Small', emoji: '🟢', nickname: 'Quick Slice', prep: '0:30', oven: '0:40', total: '1:10' },
              { size: 'Medium', emoji: '🟡', nickname: 'The Classic', prep: '1:00', oven: '1:00', total: '2:00' },
              { size: 'Large', emoji: '🔴', nickname: 'The Big One', prep: '1:30', oven: '1:20', total: '2:50' },
            ].map((item) => (
              <div
                key={item.size}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  borderLeft: `3px solid ${item.emoji === '🟢' ? '#4CAF50' : item.emoji === '🟡' ? '#FFC107' : '#F44336'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "'Lilita One', cursive",
                    fontSize: 14,
                    color: '#FFF8E1',
                  }}>
                    {item.emoji} {item.size}
                  </span>
                  <span style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: 13,
                    color: 'rgba(255,248,225,0.5)',
                    fontStyle: 'italic',
                  }}>
                    "{item.nickname}"
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ color: '#FFC107' }}>Prep {item.prep}</span>
                  <span style={{ color: '#FF7043' }}>Oven {item.oven}</span>
                  <span style={{ color: '#81C784', fontWeight: 700 }}>= {item.total}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Burn warning footer */}
          <div style={{
            marginTop: 10,
            padding: '6px 8px',
            background: 'rgba(183,28,28,0.15)',
            borderRadius: 4,
            border: '1px dashed rgba(244,67,54,0.3)',
            textAlign: 'center',
          }}>
            <span style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 14,
              color: '#FF8A65',
            }}>
              ⚠️ Burn window: {burnWindow} after bake done!
            </span>
          </div>

          {/* Bottom chalk scribble */}
          <div style={{
            textAlign: 'center',
            marginTop: 8,
            fontFamily: "'Caveat', cursive",
            fontSize: 11,
            color: 'rgba(255,248,225,0.3)',
          }}>
            ~ Pull wisely, Chef ~
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TIMER DISPLAY ─────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── CSS KEYFRAMES (injected once) ─────────────────
const STYLE_ID = 'sof-board-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes sof-pulse-warning {
      0%, 100% { box-shadow: 0 0 0 0 rgba(183,28,28,0.4); }
      50% { box-shadow: 0 0 12px 4px rgba(183,28,28,0.6); }
    }
    @keyframes sof-glow-ready {
      0%, 100% { box-shadow: 0 0 4px 1px rgba(46,125,50,0.3); }
      50% { box-shadow: 0 0 10px 3px rgba(46,125,50,0.5); }
    }
    @keyframes sof-burn-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-2px) rotate(-1deg); }
      75% { transform: translateX(2px) rotate(1deg); }
    }
    @keyframes sof-card-enter {
      from { opacity: 0; transform: translateY(-12px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .sof-pulse-warning { animation: sof-pulse-warning 1s ease-in-out infinite; }
    .sof-glow-ready { animation: sof-glow-ready 1.5s ease-in-out infinite; }
    .sof-burn-shake { animation: sof-burn-shake 0.3s ease-in-out 3; }
    .sof-card-enter { animation: sof-card-enter 0.3s ease-out; }
    .sof-drop-highlight {
      outline: 3px dashed rgba(76,175,80,0.7) !important;
      background: rgba(76,175,80,0.08) !important;
    }
    .sof-drop-invalid {
      outline: 3px dashed rgba(183,28,28,0.5) !important;
      background: rgba(183,28,28,0.05) !important;
    }
    .sof-dragging { opacity: 0.5; transform: scale(0.95); }

    /* ─── CONFETTI BURST (on serve) ─── */
    @keyframes sof-confetti-pop {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { opacity: 0; }
    }
    .sof-confetti-container {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 50;
    }
    .sof-confetti-piece {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 2px;
      animation: sof-confetti-pop 0.7s ease-out forwards;
    }

    /* ─── SMOKE EFFECT (on burn) ─── */
    @keyframes sof-smoke-rise {
      0% { transform: translateY(0) scale(0.5); opacity: 0.6; }
      50% { transform: translateY(-18px) scale(1); opacity: 0.3; }
      100% { transform: translateY(-36px) scale(1.3); opacity: 0; }
    }
    .sof-smoke-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 40;
      overflow: visible;
    }
    .sof-smoke-puff {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(120,120,120,0.5) 0%, rgba(80,80,80,0) 70%);
      animation: sof-smoke-rise 1.2s ease-out forwards;
    }

    /* ─── ANGRY FUSE BAR ─── */
    @keyframes sof-fuse-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .sof-fuse-critical {
      animation: sof-fuse-pulse 0.5s ease-in-out infinite;
    }

    /* ─── OVEN GLOW (intensifies toward burn) ─── */
    @keyframes sof-oven-glow-soft {
      0%, 100% { box-shadow: 0 0 8px 2px rgba(255,152,0,0.15), inset 0 0 6px rgba(255,152,0,0.05); }
      50% { box-shadow: 0 0 14px 4px rgba(255,152,0,0.25), inset 0 0 10px rgba(255,152,0,0.08); }
    }
    @keyframes sof-oven-glow-warm {
      0%, 100% { box-shadow: 0 0 12px 3px rgba(255,87,34,0.25), inset 0 0 8px rgba(255,87,34,0.08); }
      50% { box-shadow: 0 0 20px 6px rgba(255,87,34,0.4), inset 0 0 14px rgba(255,87,34,0.12); }
    }
    @keyframes sof-oven-glow-hot {
      0%, 100% { box-shadow: 0 0 16px 4px rgba(230,74,25,0.35), inset 0 0 10px rgba(230,74,25,0.12); }
      50% { box-shadow: 0 0 28px 8px rgba(230,74,25,0.55), inset 0 0 18px rgba(230,74,25,0.18); }
    }
    @keyframes sof-oven-glow-danger {
      0%, 100% { box-shadow: 0 0 20px 6px rgba(183,28,28,0.4), inset 0 0 12px rgba(183,28,28,0.15); }
      50% { box-shadow: 0 0 36px 12px rgba(183,28,28,0.65), inset 0 0 22px rgba(183,28,28,0.22); }
    }
    .sof-oven-glow-soft { animation: sof-oven-glow-soft 2s ease-in-out infinite; }
    .sof-oven-glow-warm { animation: sof-oven-glow-warm 1.5s ease-in-out infinite; }
    .sof-oven-glow-hot { animation: sof-oven-glow-hot 1.2s ease-in-out infinite; }
    .sof-oven-glow-danger { animation: sof-oven-glow-danger 0.8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

// ─── ORDER CARD COMPONENT ──────────────────────────

// ─── CONFETTI BURST ──────────────────────────────
const CONFETTI_COLORS = ['#4CAF50', '#FFC107', '#FF5722', '#2196F3', '#E91E63', '#00BCD4', '#FF9800'];

function spawnConfetti(x: number, y: number) {
  const container = document.createElement('div');
  container.className = 'sof-confetti-container';
  container.style.position = 'fixed';
  container.style.top = `${y}px`;
  container.style.left = `${x}px`;
  document.body.appendChild(container);

  for (let i = 0; i < 16; i++) {
    const piece = document.createElement('div');
    piece.className = 'sof-confetti-piece';
    const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.5;
    const dist = 30 + Math.random() * 50;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 20; // bias upward
    const rot = Math.random() * 360;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = `${4 + Math.random() * 4}px`;
    piece.style.height = `${4 + Math.random() * 4}px`;
    piece.style.animation = `sof-confetti-pop ${0.5 + Math.random() * 0.4}s ease-out forwards`;
    piece.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    // Set final position via custom property trick: animate to the computed transform
    piece.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${tx}px, ${ty}px) scale(0.5) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'forwards' });
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 1000);
}

// ─── SMOKE EFFECT ──────────────────────────────
function SmokeEffect({ active }: { active: boolean }) {
  const [puffs, setPuffs] = useState<{ id: number; left: number; delay: number }[]>([]);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (active && !hasTriggered.current) {
      hasTriggered.current = true;
      const newPuffs = Array.from({ length: 5 }).map((_, i) => ({
        id: Date.now() + i,
        left: 15 + Math.random() * 70, // % from left
        delay: i * 0.15,
      }));
      setPuffs(newPuffs);
      setTimeout(() => setPuffs([]), 1500);
    }
    if (!active) hasTriggered.current = false;
  }, [active]);

  if (puffs.length === 0) return null;

  return (
    <div className="sof-smoke-container">
      {puffs.map((p) => (
        <div
          key={p.id}
          className="sof-smoke-puff"
          style={{
            left: `${p.left}%`,
            top: -4,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── ANGRY FUSE BAR ──────────────────────────────
function AngryFuse({ elapsed, threshold }: { elapsed: number; threshold: number }) {
  if (elapsed <= 0 || threshold <= 0) return null;
  const pct = Math.min(100, (elapsed / threshold) * 100);
  const remaining = 100 - pct;
  // Color: green → yellow → orange → red as fuse depletes
  let fuseColor = '#4CAF50';
  if (pct > 85) fuseColor = '#B71C1C';
  else if (pct > 65) fuseColor = '#E64A19';
  else if (pct > 40) fuseColor = '#FF9800';
  else fuseColor = '#8BC34A';

  const isCritical = pct > 80;

  return (
    <div className="mt-1" title={`Patience: ${Math.round(remaining)}%`}>
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 9, color: '#999', fontFamily: "'JetBrains Mono', monospace" }}>
          {isCritical ? '💢' : '⏳'}
        </span>
        <div
          className={isCritical ? 'sof-fuse-critical' : ''}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 1.5,
            background: 'rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${remaining}%`,
              height: '100%',
              borderRadius: 1.5,
              background: fuseColor,
              transition: 'width 0.5s linear, background 0.3s',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── COMPLEXITY PIPS ──────────────────────────────
function ComplexityPips({ complexity, burnt }: { complexity: string; burnt?: boolean }) {
  const count = complexity === 'Small' ? 1 : complexity === 'Medium' ? 2 : 3;
  const pipColor = burnt ? '#666' : complexity === 'Small' ? '#4CAF50' : complexity === 'Medium' ? '#FFC107' : '#F44336';
  return (
    <div className="flex items-center gap-0.5" title={complexity}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < count ? pipColor : 'rgba(0,0,0,0.1)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

// ─── TIMER PROGRESS BAR ──────────────────────────────
function TimerProgressBar({
  remaining,
  total,
  doneAt,
  warningAt,
}: {
  remaining: number;
  total: number;
  doneAt?: number; // elapsed threshold where "done" (green zone ends)
  warningAt?: number; // elapsed threshold where warning starts
}) {
  const elapsed = total - remaining;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

  // Determine bar color based on zones
  let barColor = '#4CAF50'; // green — safe
  if (doneAt !== undefined && warningAt !== undefined) {
    // Oven: green (baking) → gold (done zone) → orange (warning) → red (near burn)
    if (elapsed >= warningAt) {
      const burnPct = (elapsed - warningAt) / (total - warningAt);
      barColor = burnPct > 0.6 ? '#B71C1C' : '#E64A19';
    } else if (elapsed >= doneAt) {
      barColor = '#2E7D32'; // deep green = done, pull it!
    } else {
      barColor = '#FF9800'; // orange = still baking
    }
  } else {
    // Prep: green fills up as it completes
    const donePct = elapsed / total;
    barColor = donePct >= 1 ? '#2E7D32' : donePct > 0.7 ? '#8BC34A' : '#FF9800';
  }

  return (
    <div
      style={{
        width: '100%',
        height: 4,
        borderRadius: 2,
        background: 'rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginTop: 4,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 2,
          background: barColor,
          transition: 'width 0.3s linear, background 0.3s',
        }}
      />
    </div>
  );
}

function PizzaCard({
  card,
  isDragging,
  onDragStart,
}: {
  card: OrderCard;
  isDragging?: boolean;
  onDragStart: (cardId: string) => void;
}) {
  const difficulty = useSliceOfFlowStore((s) => s.difficulty);
  const preset = DIFFICULTY_PRESETS[difficulty];
  const prepDone = card.column === 'prep' && card.prepTimerRemaining !== undefined && card.prepTimerRemaining <= 0;

  // Per-card oven timing: use card.ovenBurnAt / card.ovenDoneAt when available, fall back to preset
  const burnBuffer = preset.ovenBurnTime - preset.ovenDoneTime;
  const cardBurnAt = card.ovenBurnAt ?? (card.ovenTime + burnBuffer);
  const cardDoneAt = card.ovenDoneAt ?? card.ovenTime;
  // Warning at ~75% of bake time (proportional to card's bake time)
  const cardWarningAt = cardDoneAt * (preset.ovenWarningTime / preset.ovenDoneTime);

  const ovenElapsed = card.ovenTimerStarted ? (cardBurnAt - (card.ovenTimerRemaining ?? cardBurnAt)) : 0;
  const ovenDone = card.column === 'oven' && card.ovenTimerStarted && ovenElapsed >= cardDoneAt && !card.burnt;
  const ovenWarning = card.column === 'oven' && card.ovenTimerStarted && ovenElapsed >= cardWarningAt && !ovenDone && !card.burnt;

  // Oven glow intensity based on baking progress
  const isInOven = card.column === 'oven' && card.ovenTimerStarted && !card.burnt;
  let ovenGlowClass = '';
  if (isInOven) {
    const bakePct = ovenElapsed / cardBurnAt;
    if (bakePct > 0.85) ovenGlowClass = 'sof-oven-glow-danger';
    else if (bakePct > 0.65) ovenGlowClass = 'sof-oven-glow-hot';
    else if (bakePct > 0.4) ovenGlowClass = 'sof-oven-glow-warm';
    else ovenGlowClass = 'sof-oven-glow-soft';
  }

  // Determine animation class
  let animClass = 'sof-card-enter';
  if (card.burnt) animClass += ' sof-burn-shake';
  else if (ovenWarning) animClass += ' sof-pulse-warning';
  else if (ovenDone || prepDone) animClass += ' sof-glow-ready';
  else if (ovenGlowClass) animClass += ` ${ovenGlowClass}`;
  if (isDragging) animClass += ' sof-dragging';

  // Ready-to-move indicator
  const canMoveForward = prepDone || ovenDone || card.column === 'orderQueue' || card.column === 'boxDeliver';

  return (
    <div
      draggable={!card.burnt}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(card.id);
      }}
      className={`rounded-md border-2 p-2.5 transition-all duration-150 select-none cursor-grab active:cursor-grabbing ${animClass}`}
      style={{
        background: card.burnt ? '#4a4a4a' : '#FFF8E7',
        borderColor: card.burnt ? '#333' : ovenWarning ? '#B71C1C' : ovenDone || prepDone ? '#2E7D32' : card.color,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.1)',
        minWidth: 140,
        cursor: card.burnt ? 'not-allowed' : undefined,
        position: 'relative' as const,
        overflow: 'visible',
      }}
      data-card-id={card.id}
    >
      {/* Smoke effect on burn */}
      <SmokeEffect active={!!card.burnt} />
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            background: card.burnt ? '#333' : card.color,
            color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          #{card.orderNumber}
        </span>
        <div className="flex items-center gap-1.5">
          {canMoveForward && !card.burnt && (
            <span className="text-xs" title="Ready to move" style={{ color: '#2E7D32' }}>▶</span>
          )}
          <ComplexityPips complexity={card.complexity} burnt={card.burnt} />
        </div>
      </div>

      {/* Pizza type */}
      <div
        className="text-sm font-semibold mb-1"
        style={{ fontFamily: "'DM Sans', sans-serif", color: card.burnt ? '#888' : '#333' }}
      >
        {card.burnt ? '🔥 BURNT' : card.pizzaType}
      </div>

      {/* Customer */}
      <div className="text-xs" style={{ fontFamily: "'Caveat', cursive", color: '#888', fontSize: 13 }}>
        for {card.customer} {card.angry && !card.burnt ? '😤' : ''}
      </div>

      {/* Prep timer with progress bar */}
      {card.column === 'prep' && card.prepTimerRemaining !== undefined && (
        <div className="mt-1.5">
          <div
            className="text-xs font-mono px-2 py-1 rounded text-center"
            style={{
              background: prepDone ? '#E8F5E9' : '#FFF3E0',
              color: prepDone ? '#2E7D32' : '#E65100',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {prepDone ? '✓ Ready for oven' : `Prepping: ${formatTime(card.prepTimerRemaining)}`}
          </div>
          {!prepDone && (
            <TimerProgressBar
              remaining={card.prepTimerRemaining}
              total={card.prepTime}
            />
          )}
        </div>
      )}

      {/* Oven timer with progress bar */}
      {card.column === 'oven' && !card.burnt && card.ovenTimerRemaining !== undefined && (
        <div className="mt-1.5">
          <div
            className="text-xs font-mono px-2 py-1 rounded text-center"
            style={{
              background: ovenDone ? '#E8F5E9' : ovenWarning ? '#FFEBEE' : '#FFF3E0',
              color: ovenDone ? '#2E7D32' : ovenWarning ? '#B71C1C' : '#E65100',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {ovenDone
              ? '✓ Pull it out!'
              : ovenWarning
              ? `⚠️ Hurry! ${formatTime(card.ovenTimerRemaining)}`
              : `Baking: ${formatTime(card.ovenTimerRemaining)}`}
          </div>
          <TimerProgressBar
            remaining={card.ovenTimerRemaining}
            total={cardBurnAt}
            doneAt={cardDoneAt}
            warningAt={cardWarningAt}
          />
        </div>
      )}

      {/* Burnt */}
      {card.burnt && (
        <div
          className="mt-1.5 text-xs font-mono px-2 py-1 rounded text-center"
          style={{ background: '#333', color: '#FF6B6B', fontFamily: "'JetBrains Mono', monospace" }}
        >
          BURNT — Toss it
        </div>
      )}

      {/* Angry fuse — shows on cards in active columns (not deck, not served, not burnt) */}
      {!card.burnt && !card.angry && card.column !== 'orderDeck' && card.column !== 'served' && card.simElapsedInQueue !== undefined && card.simElapsedInQueue > 0 && (
        <AngryFuse elapsed={card.simElapsedInQueue} threshold={preset.angryThreshold} />
      )}
    </div>
  );
}

// ─── DROPPABLE COLUMN ──────────────────────────────
function BoardColumn({
  columnId,
  label,
  color,
  bgColor,
  cards,
  wipLimit,
  wipEnabled,
  isDropTarget,
  isValidDrop,
  onDragStart,
}: {
  columnId: ColumnId;
  label: string;
  color: string;
  bgColor: string;
  cards: OrderCard[];
  wipLimit?: number;
  wipEnabled: boolean;
  isDropTarget: boolean;
  isValidDrop: boolean | null;
  onDragStart: (cardId: string) => void;
}) {
  const isOverLimit = wipEnabled && wipLimit !== undefined && cards.length >= wipLimit;
  const isDeck = columnId === 'orderDeck';

  // Drop target visual class
  let dropClass = '';
  if (isDropTarget) {
    dropClass = isValidDrop ? 'sof-drop-highlight' : 'sof-drop-invalid';
  }

  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden transition-all duration-200 ${dropClass}`}
      style={{
        background: `${bgColor}33`,
        border: `2px solid ${isDropTarget ? (isValidDrop ? '#4CAF50' : '#B71C1C') : bgColor}`,
        flex: '1 1 0',
        minHeight: 0,
      }}
    >
      {/* Column header */}
      <div
        className="px-3 py-2 flex items-center justify-between flex-shrink-0"
        style={{ background: color, color: '#fff' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base" style={{ lineHeight: 1 }}>
            {columnId === 'orderDeck' ? '📋' : columnId === 'orderQueue' ? '📥' : columnId === 'prep' ? '🔪' : columnId === 'oven' ? '🔥' : columnId === 'boxDeliver' ? '📦' : '✅'}
          </span>
          <span className="text-sm font-bold" style={{ fontFamily: "'Lilita One', cursive" }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {wipEnabled && wipLimit !== undefined ? (
            <div className="flex items-center gap-1" title={`${cards.length}/${wipLimit}`}>
              {Array.from({ length: wipLimit }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: i < cards.length
                      ? (isOverLimit ? '#FF5252' : '#fff')
                      : 'rgba(255,255,255,0.25)',
                    border: isOverLimit && i < cards.length ? '1px solid #FFCDD2' : '1px solid rgba(255,255,255,0.3)',
                    transition: 'background 0.2s, border 0.2s',
                  }}
                />
              ))}
            </div>
          ) : (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(255,255,255,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {cards.length}
            </span>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {isDeck ? (
          <div className="flex items-center justify-center h-full">
            <div
              className="text-center p-4 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <span className="text-3xl block mb-1">📋</span>
              <span
                className="text-lg font-bold"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: '#666' }}
              >
                {cards.length}
              </span>
              <span className="text-xs block" style={{ color: '#999' }}>remaining</span>
            </div>
          </div>
        ) : (
          cards.map((card) => (
            <PizzaCard
              key={card.id}
              card={card}
              isDragging={false}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── MAIN BOARD ────────────────────────────────────
const TUTORIAL_KEY = 'sof-tutorial-seen';

export default function SliceOfFlowBoard() {
  const {
    round,
    cards,
    roundTimer,
    isRunning,
    wipEnabled,
    orderFlipTimer,
    round1Metrics,
    round2Metrics,
    moveCard,
    canMoveCard,
    pullNextOrder,
    endRound,
    goToTransition,
    goToDebrief,
    speed,
    setSpeed,
    resumeGame,
  } = useSliceOfFlowStore();

  const difficulty = useSliceOfFlowStore((s) => s.difficulty);
  const preset = DIFFICULTY_PRESETS[difficulty];

  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem(TUTORIAL_KEY);
  });

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(TUTORIAL_KEY, '1');
    // Start the round timer now that instructions are done
    resumeGame();
  }, [resumeGame]);

  // If tutorial was already seen (returning player), auto-start immediately
  useEffect(() => {
    if (!showTutorial && !isRunning && roundTimer > 0 && !round1Metrics && !round2Metrics) {
      resumeGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  // Inject animation styles
  useEffect(() => { injectStyles(); }, []);

  // Group cards by column — include burnt cards in their current column
  const cardsByColumn = useMemo(() => {
    const grouped: Record<ColumnId, OrderCard[]> = {
      orderDeck: [],
      orderQueue: [],
      prep: [],
      oven: [],
      boxDeliver: [],
      served: [],
    };
    cards.forEach((card) => {
      grouped[card.column].push(card);
    });
    return grouped;
  }, [cards]);

  // Counts
  const servedCount = cards.filter((c) => c.column === 'served' && !c.burnt).length;
  const burntCount = cards.filter((c) => c.burnt).length;
  const angryCount = cards.filter((c) => c.angry && !c.burnt).length;

  // Timer urgency
  const timerColor = roundTimer <= 30 ? '#B71C1C' : roundTimer <= 60 ? '#E65100' : '#FFF';
  const timerBg = roundTimer <= 30 ? '#FFEBEE' : roundTimer <= 60 ? '#FFF3E0' : 'rgba(255,255,255,0.15)';
  const timerPulse = roundTimer <= 30 ? 'sof-pulse-warning' : '';

  // Check if drop is valid for the current drag target
  const getDropValidity = useCallback((columnId: ColumnId): boolean | null => {
    if (!draggedCardId || dragOverColumn !== columnId) return null;
    const result = canMoveCard(draggedCardId, columnId);
    return result.allowed;
  }, [draggedCardId, dragOverColumn, canMoveCard]);

  // Handle drag
  const handleDragStart = useCallback((cardId: string) => {
    setDraggedCardId(cardId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toColumn: ColumnId) => {
    e.preventDefault();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (cardId) {
      const result = canMoveCard(cardId, toColumn);
      if (result.allowed) {
        moveCard(cardId, toColumn);
        // Play context-specific sound
        if (toColumn === 'oven') playOvenSizzle();
        else if (toColumn === 'served') {
          playServed();
          // Confetti burst at drop location
          spawnConfetti(e.clientX, e.clientY);
        }
        else playCardMove();
        toast.success(`Moved to ${COLUMNS.find(c => c.id === toColumn)?.label}`, { duration: 1500 });
      } else {
        if (result.reason?.includes('WIP limit')) playWipBlocked();
        toast.error(result.reason || 'Cannot move here', { duration: 2000 });
      }
    }
    setDraggedCardId(null);
    setDragOverColumn(null);
  }, [draggedCardId, canMoveCard, moveCard]);

  const handleDragEnd = useCallback(() => {
    setDraggedCardId(null);
    setDragOverColumn(null);
  }, []);

  // Check if all cards are complete (served or burnt, none in pipeline)
  const allOrdersFlipped = cardsByColumn.orderDeck.length === 0;
  const anyCardsInPlay = cards.some(
    (c) => c.column !== 'orderDeck' && c.column !== 'served' && !c.burnt
  );
  const kitchenClear = allOrdersFlipped && !anyCardsInPlay && isRunning;

  // Round ended?
  const roundEnded = !isRunning && (roundTimer <= 0 || round1Metrics !== null || round2Metrics !== null);
  const metrics = round === 1 ? round1Metrics : round2Metrics;

  return (
    <>
      {showTutorial && <SliceOfFlowTutorial onClose={closeTutorial} />}
      <KitchenMenuBoard burnWindow={`${Math.floor((preset.ovenBurnTime - preset.ovenDoneTime) / 60)}:${((preset.ovenBurnTime - preset.ovenDoneTime) % 60).toString().padStart(2, '0')}`} />
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{
          backgroundImage: `url(${BOARD_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        onDragEnd={handleDragEnd}
      >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(30,30,30,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '2px solid rgba(217,79,59,0.3)',
        }}
      >
        {/* Left — Round info */}
        <div className="flex items-center gap-3">
          <h1
            className="text-lg"
            style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B' }}
          >
            Slice of Flow
          </h1>
          <span
            className="px-3 py-1 rounded text-xs font-bold"
            style={{
              background: round === 1 ? '#E64A19' : '#1976D2',
              color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ROUND {round} — {round === 1 ? 'PUSH' : 'PULL'}
          </span>
          {wipEnabled && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ background: '#1976D2', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              WIP LIMITS ON
            </span>
          )}
        </div>

        {/* Center — Timer */}
        <div
          className={`px-6 py-1.5 rounded-lg ${timerPulse}`}
          style={{ background: timerBg }}
        >
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: timerColor }}
          >
            {formatTime(roundTimer)}
          </span>
        </div>

        {/* Right — Scoreboard */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="Served">
            <span className="text-base">✅</span>
            <span className="text-base font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4CAF50' }}>
              {servedCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Burnt">
            <span className="text-base">🔥</span>
            <span className="text-base font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#FF6B6B' }}>
              {burntCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Angry">
            <span className="text-base">😤</span>
            <span className="text-base font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E65100' }}>
              {angryCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }} title="Orders in deck">
            <span className="text-base">📋</span>
            <span className="text-base font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc' }}>
              {cardsByColumn.orderDeck.length}
            </span>
          </div>
          <button
            onClick={() => toggleSound(!isSoundEnabled())}
            className="ml-2 pl-2 text-base opacity-60 hover:opacity-100 transition-opacity"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}
            title={isSoundEnabled() ? 'Mute sounds' : 'Unmute sounds'}
          >
            {isSoundEnabled() ? '🔊' : '🔇'}
          </button>
          <div className="ml-2 pl-2 flex items-center gap-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
            {([1, 2, 3] as SpeedMultiplier[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-1.5 py-0.5 rounded text-xs font-bold transition-all"
                style={{
                  background: speed === s ? '#D94F3B' : 'rgba(255,255,255,0.1)',
                  color: speed === s ? '#fff' : 'rgba(255,255,255,0.5)',
                  transform: speed === s ? 'scale(1.1)' : 'scale(1)',
                }}
                title={`${s}x speed`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            className="ml-1 text-base opacity-60 hover:opacity-100 transition-opacity"
            title="How to Play"
          >
            ❓
          </button>
        </div>
      </div>

      {/* Round 2 — Pull button bar */}
      {round === 2 && isRunning && (
        <div className="flex items-center justify-center gap-4 py-2 flex-shrink-0" style={{ background: 'rgba(25,118,210,0.15)', borderBottom: '1px solid rgba(25,118,210,0.3)' }}>
          <button
            onClick={() => { pullNextOrder(); playPullOrder(); }}
            className="px-6 py-1.5 rounded-lg text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: '#1976D2',
              fontFamily: "'Lilita One', cursive",
              boxShadow: '0 3px 10px rgba(25,118,210,0.3)',
            }}
          >
            Pull Next Order
          </button>
          <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#666' }}>
            Queue: {cardsByColumn.orderQueue.length}/{WIP_LIMITS.orderQueue}
          </span>
        </div>
      )}

      {/* Round 1 — Auto-flip indicator */}
      {round === 1 && isRunning && cardsByColumn.orderDeck.length > 0 && (
        <div className="flex items-center justify-center py-1.5 flex-shrink-0" style={{ background: 'rgba(230,74,25,0.1)', borderBottom: '1px solid rgba(230,74,25,0.2)' }}>
          <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E64A19' }}>
            ⚡ Next order auto-flips in <strong>{orderFlipTimer}s</strong> — Orders flood in whether you're ready or not!
          </span>
        </div>
      )}

      {/* Board columns */}
      <div className="flex-1 flex gap-2 p-3 overflow-hidden" style={{ minHeight: 0 }}>
        {COLUMNS.filter(col => col.id !== 'orderDeck').map((col) => (
          <div
            key={col.id}
            className="flex-1 min-w-[150px] flex flex-col"
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOverColumn(null)}
            style={{ borderRadius: 8 }}
          >
            <BoardColumn
              columnId={col.id}
              label={col.label}
              color={col.color}
              bgColor={col.bgColor}
              cards={cardsByColumn[col.id]}
              wipLimit={WIP_LIMITS[col.id as keyof typeof WIP_LIMITS]}
              wipEnabled={wipEnabled}
              isDropTarget={dragOverColumn === col.id}
              isValidDrop={getDropValidity(col.id)}
              onDragStart={handleDragStart}
            />
          </div>
        ))}
      </div>

      {/* Service Bell — Kitchen Clear! */}
      {kitchenClear && (
        <div
          className="flex items-center justify-center py-3 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(76,175,80,0.15) 0%, rgba(76,175,80,0.25) 50%, rgba(76,175,80,0.15) 100%)',
            borderBottom: '2px solid rgba(76,175,80,0.4)',
            borderTop: '2px solid rgba(76,175,80,0.4)',
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-lg" style={{ fontFamily: "'Lilita One', cursive", color: '#2E7D32' }}>
              Kitchen Clear!
            </span>
            <button
              onClick={() => {
                playServiceBell();
                // Small delay so the bell sound plays before the round-end overlay appears
                setTimeout(() => endRound(), 400);
              }}
              className="group flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-bold text-white transition-all hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #FFD54F 0%, #FFB300 100%)',
                color: '#3E2723',
                fontFamily: "'Lilita One', cursive",
                boxShadow: '0 4px 20px rgba(255,179,0,0.4), 0 0 0 3px rgba(255,213,79,0.3)',
              }}
            >
              <span className="text-2xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>🛎️</span>
              <span>Ring the Bell!</span>
            </button>
            <span className="text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4CAF50' }}>
              {formatTime(roundTimer)} remaining
            </span>
          </div>
        </div>
      )}

      {/* Round end overlay */}
      {roundEnded && metrics && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="rounded-xl p-8 max-w-md w-full mx-4"
            style={{ background: '#FAF7F2', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          >
            <h2
              className="text-3xl text-center mb-1"
              style={{ fontFamily: "'Lilita One', cursive", color: '#D94F3B' }}
            >
              {round === 1 ? '⏰ Time\'s Up!' : round1Metrics ? '🎉 Round 2 Complete!' : '🎉 Round Complete!'}
            </h2>
            <p className="text-center text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
              {round === 1
                ? "That was chaos, wasn't it? Let's learn a better way."
                : round1Metrics
                  ? "Feel the difference? That's the power of flow."
                  : "Great job, Chef! Here's how you did with WIP limits."
              }
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg" style={{ background: '#E8F5E9' }}>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2E7D32' }}>
                  {metrics.served}
                </div>
                <div className="text-xs" style={{ color: '#666' }}>Served</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: '#FFEBEE' }}>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#B71C1C' }}>
                  {metrics.burnt}
                </div>
                <div className="text-xs" style={{ color: '#666' }}>Burnt</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: '#FFF3E0' }}>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E65100' }}>
                  {metrics.angry}
                </div>
                <div className="text-xs" style={{ color: '#666' }}>Angry</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: '#F5F5F5' }}>
                <div className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#333' }}>
                  {metrics.score}
                </div>
                <div className="text-xs" style={{ color: '#666' }}>Score</div>
              </div>
            </div>

            {/* Avg lead time */}
            <div className="text-center mb-6 p-3 rounded-lg" style={{ background: '#E3F2FD' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Avg Lead Time</div>
              <div className="text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1976D2' }}>
                {metrics.served > 0 ? formatTime(metrics.avgLeadTime) : '—'}
              </div>
            </div>

            <button
              onClick={round === 1 ? goToTransition : goToDebrief}
              className="w-full py-3 rounded-lg text-lg font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Lilita One', cursive",
                background: round === 1 ? '#1976D2' : '#D94F3B',
                boxShadow: round === 1 ? '0 4px 15px rgba(25,118,210,0.4)' : '0 4px 15px rgba(217,79,59,0.4)',
              }}
            >
              {round === 1 ? 'Learn Kanban →' : round1Metrics ? 'See Full Results →' : 'See Your Results →'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
