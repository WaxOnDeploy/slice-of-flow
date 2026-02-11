import { useMemo } from 'react';
import {
  loadStories,
  calculateScore,
  CATEGORIES,
  CRITERIA,
  getVerdictColor,
  type CategoryKey,
  type Verdict,
} from '@/lib/dorTypes';

export default function DorDashboard() {
  const stories = useMemo(() => loadStories(), []);

  const analytics = useMemo(() => {
    if (stories.length === 0) return null;

    const results = stories.map(s => ({
      story: s,
      result: calculateScore(s.scores, s.storyType),
    }));

    // KPIs
    const avgScore = results.reduce((sum, r) => sum + r.result.weightedTotal, 0) / results.length;
    const sprintReady = results.filter(r => r.result.typeAdjustedVerdict === 'sprint-ready').length;
    const needsRefinement = results.filter(r => r.result.typeAdjustedVerdict === 'needs-refinement').length;
    const notReady = results.filter(r => 
      r.result.typeAdjustedVerdict === 'not-ready' || r.result.typeAdjustedVerdict === 'category-gap'
    ).length;
    const gateFailures = results.filter(r => 
      Object.values(r.result.categoryScores).some(cs => !cs.passesGate)
    ).length;

    // Category averages
    const categoryAvgs = CATEGORIES.map(cat => {
      const avg = results.reduce((sum, r) => sum + r.result.categoryScores[cat.key as CategoryKey].percentage, 0) / results.length;
      return { ...cat, avg: Math.round(avg) };
    });

    // Weakest category
    const weakest = categoryAvgs.reduce((min, c) => c.avg < min.avg ? c : min, categoryAvgs[0]);

    // Most common gaps
    const gapCounts: Record<string, number> = {};
    results.forEach(r => {
      r.result.gaps.forEach(gap => {
        gapCounts[gap] = (gapCounts[gap] || 0) + 1;
      });
    });
    const topGaps = Object.entries(gapCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Team breakdown
    const teamMap: Record<string, typeof results> = {};
    results.forEach(r => {
      const team = r.story.team || 'Unassigned';
      if (!teamMap[team]) teamMap[team] = [];
      teamMap[team].push(r);
    });
    const teamBreakdown = Object.entries(teamMap).map(([team, teamResults]) => ({
      team,
      count: teamResults.length,
      avgScore: Math.round(teamResults.reduce((s, r) => s + r.result.weightedTotal, 0) / teamResults.length * 10) / 10,
      readyPct: Math.round(teamResults.filter(r => r.result.typeAdjustedVerdict === 'sprint-ready').length / teamResults.length * 100),
    }));

    // Story type breakdown
    const typeMap: Record<string, typeof results> = {};
    results.forEach(r => {
      if (!typeMap[r.story.storyType]) typeMap[r.story.storyType] = [];
      typeMap[r.story.storyType].push(r);
    });
    const typeBreakdown = Object.entries(typeMap).map(([type, typeResults]) => ({
      type,
      count: typeResults.length,
      avgScore: Math.round(typeResults.reduce((s, r) => s + r.result.weightedTotal, 0) / typeResults.length * 10) / 10,
      readyPct: Math.round(typeResults.filter(r => r.result.typeAdjustedVerdict === 'sprint-ready').length / typeResults.length * 100),
    }));

    return {
      total: stories.length,
      avgScore: Math.round(avgScore * 10) / 10,
      sprintReady,
      needsRefinement,
      notReady,
      gateFailures,
      categoryAvgs,
      weakest,
      topGaps,
      teamBreakdown,
      typeBreakdown,
    };
  }, [stories]);

  if (!analytics) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 opacity-30">📊</div>
        <h2 className="text-lg font-mono text-foreground mb-2">No Data Yet</h2>
        <p className="text-sm text-muted-foreground">Score stories to populate the dashboard.</p>
      </div>
    );
  }

  const readyPct = Math.round((analytics.sprintReady / analytics.total) * 100);

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Stories Scored" value={analytics.total.toString()} color="#60A5FA" />
        <KpiCard label="Avg DoR Score" value={analytics.avgScore.toString()} color={analytics.avgScore >= 90 ? '#22C55E' : analytics.avgScore >= 75 ? '#F59E0B' : '#EF4444'} />
        <KpiCard label="Sprint Ready" value={`${analytics.sprintReady}`} sub={`${readyPct}%`} color="#22C55E" />
        <KpiCard label="Needs Refinement" value={`${analytics.needsRefinement}`} color="#F59E0B" />
        <KpiCard label="Not Ready" value={`${analytics.notReady}`} color="#EF4444" />
        <KpiCard label="Gate Failures" value={`${analytics.gateFailures}`} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance */}
        <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Category Performance</div>
          <div className="space-y-4">
            {analytics.categoryAvgs.map(cat => (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-sm text-foreground">{cat.label}</span>
                    {cat.key === analytics.weakest.key && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">WEAKEST</span>
                    )}
                  </div>
                  <span className="text-sm font-mono font-bold tabular-nums" style={{ 
                    color: cat.avg >= 80 ? '#22C55E' : cat.avg >= 50 ? '#F59E0B' : '#EF4444' 
                  }}>
                    {cat.avg}%
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div 
                    className="h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${cat.avg}%`, 
                      background: cat.color,
                      boxShadow: `0 0 8px ${cat.color}40`,
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Gaps */}
        <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Most Common Gaps
          </div>
          {analytics.topGaps.length > 0 ? (
            <div className="space-y-2.5">
              {analytics.topGaps.map(([gap, count]) => {
                const maxCount = analytics.topGaps[0][1] as number;
                const pct = ((count as number) / maxCount) * 100;
                return (
                  <div key={gap} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-40 shrink-0 truncate">{gap}</span>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div 
                        className="h-full rounded flex items-center px-2"
                        style={{ 
                          width: `${Math.max(pct, 15)}%`, 
                          background: 'rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <span className="text-xs font-mono text-red-400">{count as number}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No gaps detected — all scores above threshold.</p>
          )}
        </div>
      </div>

      {/* Team Breakdown */}
      {analytics.teamBreakdown.length > 0 && (
        <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Team Breakdown</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground">Team</th>
                  <th className="text-center py-2 px-3 text-xs font-mono text-muted-foreground">Stories</th>
                  <th className="text-center py-2 px-3 text-xs font-mono text-muted-foreground">Avg Score</th>
                  <th className="text-center py-2 px-3 text-xs font-mono text-muted-foreground">Sprint Ready %</th>
                  <th className="text-right py-2 px-3 text-xs font-mono text-muted-foreground">Health</th>
                </tr>
              </thead>
              <tbody>
                {analytics.teamBreakdown.map(t => {
                  const healthColor = t.readyPct >= 80 ? '#22C55E' : t.readyPct >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <tr key={t.team} className="border-b border-border/30">
                      <td className="py-2.5 px-3 font-medium text-foreground">{t.team}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{t.count}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold" style={{ 
                        color: t.avgScore >= 90 ? '#22C55E' : t.avgScore >= 75 ? '#F59E0B' : '#EF4444' 
                      }}>
                        {t.avgScore}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono" style={{ color: healthColor }}>
                        {t.readyPct}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="w-16 h-2 rounded-full ml-auto" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full" style={{ width: `${t.readyPct}%`, background: healthColor }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Story Type Breakdown */}
      {analytics.typeBreakdown.length > 0 && (
        <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Readiness by Story Type</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {analytics.typeBreakdown.map(t => {
              const color = t.avgScore >= 90 ? '#22C55E' : t.avgScore >= 75 ? '#F59E0B' : '#EF4444';
              return (
                <div 
                  key={t.type} 
                  className="rounded-lg p-4 border"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="text-xs text-muted-foreground mb-1">{t.type}</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono font-bold tabular-nums" style={{ color }}>
                      {t.avgScore}
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">avg</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-muted-foreground">{t.count} stories</span>
                    <span style={{ color }}>{t.readyPct}% ready</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div 
      className="rounded-xl p-4 border"
      style={{ 
        background: `${color}08`,
        borderColor: `${color}20`,
      }}
    >
      <div className="text-xs text-muted-foreground font-mono mb-1">{label}</div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-mono font-bold tabular-nums" style={{ color }}>{value}</span>
        {sub && <span className="text-xs mb-1" style={{ color: `${color}99` }}>{sub}</span>}
      </div>
    </div>
  );
}
