import type { ScoringResult, CategoryKey } from '@/lib/dorTypes';
import { CATEGORIES, getVerdictColor, getVerdictBg } from '@/lib/dorTypes';

interface VerdictPanelProps {
  result: ScoringResult | null;
  hasScores: boolean;
}

export default function VerdictPanel({ result, hasScores }: VerdictPanelProps) {
  if (!result || !hasScores) {
    return (
      <div className="rounded-xl border border-border p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-4xl mb-3 opacity-30">📋</div>
        <p className="text-muted-foreground text-sm">Score criteria to see the verdict</p>
      </div>
    );
  }

  const verdictColor = getVerdictColor(result.typeAdjustedVerdict);
  const verdictBg = getVerdictBg(result.typeAdjustedVerdict);

  return (
    <div className="space-y-4">
      {/* Main verdict */}
      <div 
        className="rounded-xl p-5 text-center border"
        style={{ 
          background: verdictBg, 
          borderColor: `${verdictColor}30`,
        }}
      >
        <div className="text-sm text-muted-foreground mb-1 font-mono uppercase tracking-wider">Verdict</div>
        <div 
          className="text-xl font-bold mb-2"
          style={{ color: verdictColor }}
        >
          {result.typeAdjustedVerdictLabel}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-mono font-bold tabular-nums" style={{ color: verdictColor }}>
            {result.weightedTotal}
          </span>
          <span className="text-lg text-muted-foreground">/ 100</span>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border border-border p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Category Breakdown</div>
        {CATEGORIES.map(cat => {
          const cs = result.categoryScores[cat.key as CategoryKey];
          const barColor = cs.percentage >= 80 ? '#22C55E' : cs.percentage >= 50 ? '#F59E0B' : '#EF4444';
          return (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{cat.icon}</span>
                  <span className="text-xs text-foreground">{cat.label}</span>
                  {!cs.passesGate && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">GATE FAIL</span>
                  )}
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: barColor }}>
                  {cs.raw}/{cs.max} ({Math.round(cs.percentage)}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${cs.percentage}%`, 
                    background: barColor,
                    boxShadow: `0 0 6px ${barColor}30`,
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-detected gaps */}
      {result.gaps.length > 0 && (
        <div className="rounded-xl border border-red-500/20 p-4" style={{ background: 'rgba(239, 68, 68, 0.06)' }}>
          <div className="text-xs font-mono text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>⚡</span> Auto-Detected Gaps ({result.gaps.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.gaps.map(gap => (
              <span 
                key={gap} 
                className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/20"
              >
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Threshold legend */}
      <div className="rounded-xl border border-border p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Thresholds</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
            <span className="text-green-400 font-medium">Sprint Ready</span>
            <span className="text-muted-foreground">≥ 90 + all gates pass</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
            <span className="text-amber-400 font-medium">Needs Refinement</span>
            <span className="text-muted-foreground">75–89 + all gates pass</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />
            <span className="text-red-400 font-medium">Not Ready</span>
            <span className="text-muted-foreground">&lt; 75 or any gate fails</span>
          </div>
        </div>
      </div>
    </div>
  );
}
