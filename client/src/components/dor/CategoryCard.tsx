import type { CategoryConfig, CategoryScore, Criterion } from '@/lib/dorTypes';
import ScoreSlider from './ScoreSlider';

interface CategoryCardProps {
  config: CategoryConfig;
  criteria: Criterion[];
  scores: Record<string, number>;
  categoryScore: CategoryScore | null;
  onScoreChange: (criterionId: string, value: number) => void;
}

export default function CategoryCard({ config, criteria, scores, categoryScore, onScoreChange }: CategoryCardProps) {
  const percentage = categoryScore?.percentage ?? 0;
  const passesGate = categoryScore?.passesGate ?? true;

  const getBarColor = () => {
    if (!categoryScore) return 'rgba(255,255,255,0.1)';
    if (percentage >= 80) return '#22C55E';
    if (percentage >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div 
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{ 
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {/* Category Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${config.borderColor}` }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{config.label}</h3>
            <span className="text-xs text-muted-foreground">Weight: {config.weight}% · Gate: {config.gateThreshold}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span 
              className="text-2xl font-mono font-bold tabular-nums"
              style={{ color: getBarColor() }}
            >
              {categoryScore?.raw ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">/ {config.maxScore}</span>
          </div>
          {categoryScore && !passesGate && (
            <span className="text-xs font-medium text-red-400 flex items-center gap-1 justify-end mt-0.5">
              ⚠ Below gate threshold
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${percentage}%`, 
            background: getBarColor(),
            boxShadow: `0 0 8px ${getBarColor()}40`,
          }} 
        />
      </div>

      {/* Criteria */}
      <div className="p-5 space-y-5">
        {criteria.map(criterion => (
          <ScoreSlider
            key={criterion.id}
            criterion={criterion}
            value={scores[criterion.id] ?? 0}
            onChange={(val) => onScoreChange(criterion.id, val)}
            accentColor={config.color}
          />
        ))}
      </div>
    </div>
  );
}
