import { useState, useMemo, useCallback } from 'react';
import { Link } from 'wouter';
import CategoryCard from '@/components/dor/CategoryCard';
import VerdictPanel from '@/components/dor/VerdictPanel';
import DorDashboard from '@/components/dor/DorDashboard';
import DorHistory from '@/components/dor/DorHistory';
import {
  CATEGORIES,
  CRITERIA,
  getCriteriaForCategory,
  calculateScore,
  addStory,
  generateId,
  type StoryType,
  type StoryScore,
} from '@/lib/dorTypes';
import { toast } from 'sonner';

type Tab = 'score' | 'history' | 'dashboard';

const STORY_TYPES: StoryType[] = [
  'Proactive Tuning (A)',
  'Response-Based Tuning (B)',
  'SPIKE (C)',
  'ACTION (D)',
  'Other',
];

export default function DorScorer() {
  const [activeTab, setActiveTab] = useState<Tab>('score');
  const [storyId, setStoryId] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyType, setStoryType] = useState<StoryType>('Other');
  const [parentFeature, setParentFeature] = useState('');
  const [team, setTeam] = useState('');
  const [sprintPi, setSprintPi] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [remediation, setRemediation] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const hasScores = useMemo(() => Object.keys(scores).length > 0, [scores]);

  const result = useMemo(() => {
    if (!hasScores) return null;
    return calculateScore(scores, storyType);
  }, [scores, storyType, hasScores]);

  const handleScoreChange = useCallback((criterionId: string, value: number) => {
    setScores(prev => ({ ...prev, [criterionId]: value }));
  }, []);

  const handleSave = () => {
    if (!storyId.trim()) {
      toast.error('Story ID is required');
      return;
    }
    if (!storyTitle.trim()) {
      toast.error('Story Title is required');
      return;
    }
    if (!hasScores) {
      toast.error('Score at least one criterion before saving');
      return;
    }

    const story: StoryScore = {
      id: generateId(),
      storyId: storyId.trim(),
      storyTitle: storyTitle.trim(),
      storyType,
      parentFeature: parentFeature.trim(),
      team: team.trim(),
      sprintPi: sprintPi.trim(),
      scores: { ...scores },
      notes: notes.trim(),
      remediation: remediation.trim(),
      reviewer: reviewer.trim(),
      reviewDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    addStory(story);
    toast.success(`Scored: ${storyId} — ${result?.typeAdjustedVerdictLabel}`);
    handleReset();
    setRefreshKey(k => k + 1);
  };

  const handleReset = () => {
    setStoryId('');
    setStoryTitle('');
    setStoryType('Other');
    setParentFeature('');
    setTeam('');
    setSprintPi('');
    setScores({});
    setNotes('');
    setRemediation('');
    setReviewer('');
  };

  const tabClasses = (tab: Tab) =>
    `px-4 py-2 text-sm font-mono transition-all rounded-lg ${
      activeTab === tab
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    }`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50" style={{ background: 'oklch(0.13 0.01 260 / 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-mono">
                ← Deck Shop
              </Link>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h1 className="font-mono font-bold text-foreground">DoR Scorer</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">v2</span>
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <button onClick={() => setActiveTab('score')} className={tabClasses('score')}>
                Score
              </button>
              <button onClick={() => setActiveTab('history')} className={tabClasses('history')}>
                History
              </button>
              <button onClick={() => setActiveTab('dashboard')} className={tabClasses('dashboard')}>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-6">
        {activeTab === 'score' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            {/* Left: Scoring Form */}
            <div className="space-y-6">
              {/* Story metadata */}
              <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>📝</span> Story Metadata
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Story ID *</label>
                    <input
                      type="text"
                      value={storyId}
                      onChange={e => setStoryId(e.target.value)}
                      placeholder="US-12345"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Story Title *</label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={e => setStoryTitle(e.target.value)}
                      placeholder="As a Detection Engineer, I want to..."
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Story Type</label>
                    <select
                      value={storyType}
                      onChange={e => setStoryType(e.target.value as StoryType)}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {STORY_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Parent Feature</label>
                    <input
                      type="text"
                      value={parentFeature}
                      onChange={e => setParentFeature(e.target.value)}
                      placeholder="Feature name"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Team</label>
                    <input
                      type="text"
                      value={team}
                      onChange={e => setTeam(e.target.value)}
                      placeholder="QRadar / Defender"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Sprint / PI</label>
                    <input
                      type="text"
                      value={sprintPi}
                      onChange={e => setSprintPi(e.target.value)}
                      placeholder="PI 25.1 / Sprint 3"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Reviewer</label>
                    <input
                      type="text"
                      value={reviewer}
                      onChange={e => setReviewer(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Story type indicator */}
                {storyType !== 'Other' && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md font-mono font-medium" style={{
                      background: storyType === 'SPIKE (C)' ? 'rgba(124, 58, 237, 0.15)' : 
                                  storyType === 'ACTION (D)' ? 'rgba(37, 99, 235, 0.15)' :
                                  storyType.includes('Proactive') ? 'rgba(34, 197, 94, 0.15)' :
                                  'rgba(245, 158, 11, 0.15)',
                      color: storyType === 'SPIKE (C)' ? '#A78BFA' : 
                             storyType === 'ACTION (D)' ? '#60A5FA' :
                             storyType.includes('Proactive') ? '#4ADE80' :
                             '#FBBF24',
                    }}>
                      {storyType}
                    </span>
                    <span className="text-muted-foreground">
                      {storyType === 'SPIKE (C)' && '→ AC requirements relaxed, Sprint Ready threshold at 85'}
                      {storyType === 'ACTION (D)' && '→ Dependencies must score ≥ 4 for Sprint Ready'}
                      {storyType === 'Proactive Tuning (A)' && '→ Standard scoring, ensure metrics-driven value'}
                      {storyType === 'Response-Based Tuning (B)' && '→ Standard scoring, capture SOC ticket reference'}
                    </span>
                  </div>
                )}
              </div>

              {/* Category scoring cards */}
              {CATEGORIES.map(cat => (
                <CategoryCard
                  key={cat.key}
                  config={cat}
                  criteria={getCriteriaForCategory(cat.key)}
                  scores={scores}
                  categoryScore={result?.categoryScores[cat.key] ?? null}
                  onScoreChange={handleScoreChange}
                />
              ))}

              {/* Notes & Remediation */}
              <div className="rounded-xl border border-border p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>📝</span> Notes & Remediation
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Key Gaps / Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Additional observations..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Required Remediation Actions</label>
                    <textarea
                      value={remediation}
                      onChange={e => setRemediation(e.target.value)}
                      placeholder="What needs to happen before this is sprint-ready..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pb-8">
                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-lg font-mono font-medium text-sm transition-all"
                  style={{
                    background: result ? getButtonColor(result.typeAdjustedVerdict) : 'rgba(255,255,255,0.1)',
                    color: result ? '#000' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  Save Score
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-lg font-mono font-medium text-sm text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Reset
                </button>
                {result && (
                  <span className="text-sm font-mono ml-auto" style={{ color: getButtonColor(result.typeAdjustedVerdict) }}>
                    {result.typeAdjustedVerdictLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Verdict Panel (sticky) */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <VerdictPanel result={result} hasScores={hasScores} />
              </div>
            </div>

            {/* Mobile verdict (fixed bottom) */}
            {hasScores && result && (
              <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-3 border-t border-border" style={{ background: 'oklch(0.13 0.01 260 / 0.95)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground font-mono">Score</span>
                    <span className="text-xl font-mono font-bold ml-2 tabular-nums" style={{ color: getButtonColor(result.typeAdjustedVerdict) }}>
                      {result.weightedTotal}
                    </span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: getButtonColor(result.typeAdjustedVerdict) }}>
                    {result.typeAdjustedVerdictLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && <DorHistory key={refreshKey} />}
        {activeTab === 'dashboard' && <DorDashboard key={refreshKey} />}
      </main>
    </div>
  );
}

function getButtonColor(verdict: string): string {
  if (verdict === 'sprint-ready') return '#22C55E';
  if (verdict === 'needs-refinement') return '#F59E0B';
  return '#EF4444';
}
