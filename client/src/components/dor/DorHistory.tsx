import { useState, useMemo } from 'react';
import {
  loadStories,
  deleteStory,
  calculateScore,
  CATEGORIES,
  getVerdictColor,
  getVerdictBg,
  type StoryScore,
  type CategoryKey,
} from '@/lib/dorTypes';
import { toast } from 'sonner';

export default function DorHistory() {
  const [stories, setStories] = useState<StoryScore[]>(loadStories);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const teams = useMemo(() => Array.from(new Set(stories.map(s => s.team).filter(Boolean))), [stories]);
  const types = useMemo(() => Array.from(new Set(stories.map(s => s.storyType))), [stories]);

  const filteredStories = useMemo(() => {
    return stories.filter(s => {
      const result = calculateScore(s.scores, s.storyType);
      if (filterVerdict !== 'all' && result.typeAdjustedVerdict !== filterVerdict) return false;
      if (filterTeam !== 'all' && s.team !== filterTeam) return false;
      if (filterType !== 'all' && s.storyType !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.storyId.toLowerCase().includes(q) && !s.storyTitle.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [stories, filterVerdict, filterTeam, filterType, searchQuery]);

  const handleDelete = (id: string) => {
    const updated = deleteStory(id);
    setStories(updated);
    toast.success('Score deleted');
  };

  if (stories.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 opacity-30">📋</div>
        <h2 className="text-lg font-mono text-foreground mb-2">No Scores Yet</h2>
        <p className="text-sm text-muted-foreground">Score your first story to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search stories..."
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-64"
        />
        <select
          value={filterVerdict}
          onChange={e => setFilterVerdict(e.target.value)}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Verdicts</option>
          <option value="sprint-ready">✅ Sprint Ready</option>
          <option value="needs-refinement">⚠️ Needs Refinement</option>
          <option value="not-ready">❌ Not Ready</option>
          <option value="category-gap">❌ Category Gap</option>
        </select>
        {teams.length > 0 && (
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {types.length > 1 && (
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {filteredStories.length} of {stories.length} stories
        </span>
      </div>

      {/* Story list */}
      <div className="space-y-2">
        {filteredStories.map(story => {
          const result = calculateScore(story.scores, story.storyType);
          const verdictColor = getVerdictColor(result.typeAdjustedVerdict);
          const verdictBg = getVerdictBg(result.typeAdjustedVerdict);
          const isExpanded = expandedId === story.id;

          return (
            <div 
              key={story.id} 
              className="rounded-xl border transition-all"
              style={{ 
                background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                borderColor: isExpanded ? `${verdictColor}30` : 'rgba(255,255,255,0.08)',
              }}
            >
              {/* Summary row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : story.id)}
                className="w-full px-5 py-3.5 flex items-center gap-4 text-left"
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-mono font-bold shrink-0"
                  style={{ background: verdictBg, color: verdictColor }}
                >
                  {result.weightedTotal}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-primary">{story.storyId}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.5)',
                    }}>
                      {story.storyType}
                    </span>
                  </div>
                  <p className="text-sm text-foreground truncate mt-0.5">{story.storyTitle}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  {story.team && (
                    <span className="text-xs text-muted-foreground font-mono">{story.team}</span>
                  )}
                  <span className="text-xs font-medium" style={{ color: verdictColor }}>
                    {result.typeAdjustedVerdictLabel}
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-border/50 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    {CATEGORIES.map(cat => {
                      const cs = result.categoryScores[cat.key as CategoryKey];
                      const barColor = cs.percentage >= 80 ? '#22C55E' : cs.percentage >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <div key={cat.key} className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">{cat.icon} {cat.label}</div>
                          <div className="text-lg font-mono font-bold" style={{ color: barColor }}>
                            {cs.raw}/{cs.max}
                          </div>
                          <div className="h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full" style={{ width: `${cs.percentage}%`, background: barColor }} />
                          </div>
                          {!cs.passesGate && (
                            <span className="text-[10px] text-red-400 mt-0.5 block">GATE FAIL</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {result.gaps.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-red-400 font-mono">Gaps: </span>
                      <span className="text-xs text-muted-foreground">{result.gaps.join(', ')}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                    {story.parentFeature && (
                      <div>
                        <span className="text-muted-foreground">Parent: </span>
                        <span className="text-foreground">{story.parentFeature}</span>
                      </div>
                    )}
                    {story.sprintPi && (
                      <div>
                        <span className="text-muted-foreground">Sprint/PI: </span>
                        <span className="text-foreground">{story.sprintPi}</span>
                      </div>
                    )}
                    {story.reviewer && (
                      <div>
                        <span className="text-muted-foreground">Reviewer: </span>
                        <span className="text-foreground">{story.reviewer}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="text-foreground">{story.reviewDate}</span>
                    </div>
                  </div>

                  {(story.notes || story.remediation) && (
                    <div className="space-y-2 mb-3">
                      {story.notes && (
                        <div className="text-xs">
                          <span className="text-muted-foreground font-mono">Notes: </span>
                          <span className="text-foreground">{story.notes}</span>
                        </div>
                      )}
                      {story.remediation && (
                        <div className="text-xs">
                          <span className="text-muted-foreground font-mono">Remediation: </span>
                          <span className="text-foreground">{story.remediation}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(story.id)}
                      className="text-xs text-red-400 hover:text-red-300 font-mono transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
