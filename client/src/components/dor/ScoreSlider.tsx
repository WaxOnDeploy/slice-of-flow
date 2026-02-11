import { useState } from 'react';
import type { Criterion } from '@/lib/dorTypes';

interface ScoreSliderProps {
  criterion: Criterion;
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
}

export default function ScoreSlider({ criterion, value, onChange, accentColor }: ScoreSliderProps) {
  const [showRubric, setShowRubric] = useState(false);
  const percentage = criterion.maxScore > 0 ? (value / criterion.maxScore) * 100 : 0;

  const getScoreColor = () => {
    if (percentage >= 80) return '#22C55E';
    if (percentage >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{criterion.label}</span>
          <button
            onClick={() => setShowRubric(!showRubric)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors"
            style={{ 
              background: showRubric ? accentColor : 'rgba(255,255,255,0.08)',
              color: showRubric ? '#000' : 'rgba(255,255,255,0.5)',
            }}
            title="Show rubric"
          >
            ?
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="text-lg font-mono font-bold tabular-nums"
            style={{ color: getScoreColor() }}
          >
            {value}
          </span>
          <span className="text-xs text-muted-foreground">/ {criterion.maxScore}</span>
        </div>
      </div>

      {/* Score buttons */}
      <div className="flex gap-1">
        {Array.from({ length: criterion.maxScore + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className="flex-1 h-9 rounded text-xs font-mono font-bold transition-all duration-150"
            style={{
              background: i <= value 
                ? `${getScoreColor()}${i === value ? '' : '40'}` 
                : 'rgba(255,255,255,0.04)',
              color: i <= value ? (i === value ? '#000' : getScoreColor()) : 'rgba(255,255,255,0.25)',
              border: i === value 
                ? `2px solid ${getScoreColor()}` 
                : '1px solid rgba(255,255,255,0.06)',
              transform: i === value ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            {i}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{criterion.description}</p>

      {/* Rubric popover */}
      {showRubric && (
        <div 
          className="mt-2 rounded-lg p-3 text-xs space-y-2 border"
          style={{ 
            background: 'rgba(0,0,0,0.4)', 
            borderColor: `${accentColor}30`,
          }}
        >
          <div className="flex gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#EF4444' }} />
            <div>
              <span className="font-semibold text-red-400">0 — </span>
              <span className="text-muted-foreground">{criterion.rubric.zero}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#F59E0B' }} />
            <div>
              <span className="font-semibold text-amber-400">Mid — </span>
              <span className="text-muted-foreground">{criterion.rubric.mid}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: '#22C55E' }} />
            <div>
              <span className="font-semibold text-green-400">Max — </span>
              <span className="text-muted-foreground">{criterion.rubric.max}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
