import { useState, useMemo, useCallback, useEffect } from 'react';
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
  isSoundEnabled,
  toggleSound,
} from '@/lib/sliceOfFlowSounds';

const BOARD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663079801262/HMZYiPTRs2uX46faFy3c3x/sof-board-texture-KNwu2LircNbQS5UCEasJLy.webp';

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
  `;
  document.head.appendChild(style);
}

// ─── ORDER CARD COMPONENT ──────────────────────────
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
  const ovenElapsed = card.ovenTimerStarted ? (preset.ovenBurnTime - (card.ovenTimerRemaining ?? preset.ovenBurnTime)) : 0;
  const ovenDone = card.column === 'oven' && card.ovenTimerStarted && ovenElapsed >= preset.ovenDoneTime && !card.burnt;
  const ovenWarning = card.column === 'oven' && card.ovenTimerStarted && ovenElapsed >= preset.ovenWarningTime && !ovenDone && !card.burnt;

  // Determine animation class
  let animClass = 'sof-card-enter';
  if (card.burnt) animClass += ' sof-burn-shake';
  else if (ovenWarning) animClass += ' sof-pulse-warning';
  else if (ovenDone || prepDone) animClass += ' sof-glow-ready';
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
      }}
      data-card-id={card.id}
    >
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
        <div className="flex items-center gap-1">
          {canMoveForward && !card.burnt && (
            <span className="text-xs" title="Ready to move">▶</span>
          )}
          <span className="text-xs" style={{ fontFamily: "'DM Sans', sans-serif", color: '#888' }}>
            {card.complexity}
          </span>
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

      {/* Prep timer */}
      {card.column === 'prep' && card.prepTimerRemaining !== undefined && (
        <div
          className="mt-1.5 text-xs font-mono px-2 py-1 rounded text-center"
          style={{
            background: prepDone ? '#E8F5E9' : '#FFF3E0',
            color: prepDone ? '#2E7D32' : '#E65100',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {prepDone ? '✓ Ready for oven' : `Prepping: ${formatTime(card.prepTimerRemaining)}`}
        </div>
      )}

      {/* Oven timer */}
      {card.column === 'oven' && !card.burnt && card.ovenTimerRemaining !== undefined && (
        <div
          className="mt-1.5 text-xs font-mono px-2 py-1 rounded text-center"
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
        <span className="text-sm font-bold" style={{ fontFamily: "'Lilita One', cursive" }}>
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {wipEnabled && wipLimit !== undefined && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-bold"
              style={{
                background: isOverLimit ? '#B71C1C' : 'rgba(255,255,255,0.3)',
                color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {cards.length}/{wipLimit}
            </span>
          )}
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(255,255,255,0.2)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {cards.length}
          </span>
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
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem(TUTORIAL_KEY);
  });

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(TUTORIAL_KEY, '1');
  }, []);
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
    goToTransition,
    goToDebrief,
    speed,
    setSpeed,
  } = useSliceOfFlowStore();

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
        else if (toColumn === 'served') playServed();
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

  // Round ended?
  const roundEnded = !isRunning && roundTimer <= 0;
  const metrics = round === 1 ? round1Metrics : round2Metrics;

  return (
    <>
      {showTutorial && <SliceOfFlowTutorial onClose={closeTutorial} />}
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
      {round === 1 && isRunning && (
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
              {round === 1 ? '⏰ Time\'s Up!' : '🎉 Round 2 Complete!'}
            </h2>
            <p className="text-center text-sm mb-6" style={{ fontFamily: "'DM Sans', sans-serif", color: '#666' }}>
              {round === 1 ? "That was chaos, wasn't it? Let's learn a better way." : "Feel the difference? That's the power of flow."}
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
                {formatTime(metrics.avgLeadTime)}
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
              {round === 1 ? 'Learn Kanban →' : 'See Full Results →'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
