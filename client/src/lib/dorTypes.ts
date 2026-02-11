// ============================================================
// DoR Scoring Tool — Types & Data Model
// ============================================================

export type StoryType = 
  | 'Proactive Tuning (A)' 
  | 'Response-Based Tuning (B)' 
  | 'SPIKE (C)' 
  | 'ACTION (D)' 
  | 'Other';

export type Verdict = 
  | 'sprint-ready' 
  | 'needs-refinement' 
  | 'not-ready' 
  | 'category-gap';

export type CategoryKey = 'structure' | 'invest' | 'ac' | 'safe' | 'nfr';

export interface Criterion {
  id: string;
  label: string;
  category: CategoryKey;
  maxScore: number;
  description: string;
  rubric: {
    zero: string;
    mid: string;
    max: string;
  };
}

export interface CategoryConfig {
  key: CategoryKey;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  maxScore: number;
  weight: number; // percentage
  gateThreshold: number; // percentage of max required
}

export interface StoryScore {
  id: string;
  storyId: string;
  storyTitle: string;
  storyType: StoryType;
  parentFeature: string;
  team: string;
  sprintPi: string;
  scores: Record<string, number>;
  notes: string;
  remediation: string;
  reviewer: string;
  reviewDate: string;
  createdAt: string;
}

export interface CategoryScore {
  key: CategoryKey;
  raw: number;
  max: number;
  percentage: number;
  passesGate: boolean;
}

export interface ScoringResult {
  categoryScores: Record<CategoryKey, CategoryScore>;
  weightedTotal: number;
  verdict: Verdict;
  typeAdjustedVerdict: Verdict;
  verdictLabel: string;
  typeAdjustedVerdictLabel: string;
  gaps: string[];
}

// ============================================================
// Category Configuration
// ============================================================
export const CATEGORIES: CategoryConfig[] = [
  {
    key: 'structure',
    label: 'Story Structure',
    color: '#0D9488',
    bgColor: 'rgba(13, 148, 136, 0.12)',
    borderColor: 'rgba(13, 148, 136, 0.3)',
    icon: '📐',
    maxScore: 20,
    weight: 20,
    gateThreshold: 50,
  },
  {
    key: 'invest',
    label: 'INVEST Criteria',
    color: '#7C3AED',
    bgColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
    icon: '💎',
    maxScore: 20,
    weight: 20,
    gateThreshold: 50,
  },
  {
    key: 'ac',
    label: 'Acceptance Criteria',
    color: '#2563EB',
    bgColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(37, 99, 235, 0.3)',
    icon: '✅',
    maxScore: 20,
    weight: 20,
    gateThreshold: 50,
  },
  {
    key: 'safe',
    label: 'SAFe Context',
    color: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
    icon: '🏗️',
    maxScore: 20,
    weight: 20,
    gateThreshold: 50,
  },
  {
    key: 'nfr',
    label: 'NFR & Risk',
    color: '#DC2626',
    bgColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
    icon: '🛡️',
    maxScore: 20,
    weight: 20,
    gateThreshold: 50,
  },
];

// ============================================================
// Criteria Definitions with Full Rubric
// ============================================================
export const CRITERIA: Criterion[] = [
  // Structure (0-5 each, max 20)
  {
    id: 'role_clear',
    label: 'Role Clear',
    category: 'structure',
    maxScore: 5,
    description: 'Is the "As a..." role specific and contextual?',
    rubric: {
      zero: 'No role identified in story',
      mid: 'Role stated but generic (e.g., "As a user")',
      max: 'Specific role with clear context (e.g., "As a Detection Engineer on the QRadar team")',
    },
  },
  {
    id: 'intent_clear',
    label: 'Intent Clear',
    category: 'structure',
    maxScore: 5,
    description: 'Is the "I want to..." action single and measurable?',
    rubric: {
      zero: 'No action or intent stated',
      mid: 'Action stated but vague or compound',
      max: 'Single clear action with measurable outcome',
    },
  },
  {
    id: 'value_clear',
    label: 'Business Value Clear',
    category: 'structure',
    maxScore: 5,
    description: 'Is the "So that..." value tied to team/org outcome?',
    rubric: {
      zero: 'No "so that" clause or value statement',
      mid: 'Value stated but not tied to team/org outcome',
      max: 'Clear value linked to SOC operations, risk reduction, or compliance',
    },
  },
  {
    id: 'safe_size',
    label: 'Proper SAFe Size',
    category: 'structure',
    maxScore: 5,
    description: 'Is the story right-sized for a single sprint?',
    rubric: {
      zero: 'No estimate; story is epic-sized',
      mid: 'Estimated but likely >1 sprint or unclear scope',
      max: 'Right-sized for single sprint; team confident in estimate',
    },
  },
  // INVEST (0-4 each, max 20)
  {
    id: 'independent',
    label: 'Independent',
    category: 'invest',
    maxScore: 4,
    description: 'Can this story be started and finished independently?',
    rubric: {
      zero: 'Completely blocked by another story',
      mid: 'Partial dependency identified but not resolved',
      max: 'No blockers; can be started and finished independently',
    },
  },
  {
    id: 'negotiable',
    label: 'Negotiable',
    category: 'invest',
    maxScore: 4,
    description: 'Is there room for implementation choice?',
    rubric: {
      zero: 'Rigid requirements with no flexibility',
      mid: 'Some flexibility but key constraints unclear',
      max: 'Clear boundaries with room for implementation choice',
    },
  },
  {
    id: 'valuable',
    label: 'Valuable',
    category: 'invest',
    maxScore: 4,
    description: 'Does this deliver direct, measurable value?',
    rubric: {
      zero: 'No clear value to any stakeholder',
      mid: 'Value implied but not explicit',
      max: 'Direct, measurable value to SOC or security posture',
    },
  },
  {
    id: 'estimable',
    label: 'Estimable',
    category: 'invest',
    maxScore: 4,
    description: 'Can the team confidently estimate this?',
    rubric: {
      zero: 'Team cannot estimate; too many unknowns',
      mid: 'Rough estimate possible but low confidence',
      max: 'Team confident in estimate; scope well understood',
    },
  },
  {
    id: 'small',
    label: 'Small',
    category: 'invest',
    maxScore: 4,
    description: 'Is this completable within a sprint with margin?',
    rubric: {
      zero: 'Multi-sprint effort',
      mid: 'Likely fits in sprint but tight',
      max: 'Clearly completable within sprint with margin',
    },
  },
  // Acceptance Criteria (0-5 each, max 20)
  {
    id: 'bdd_format',
    label: 'BDD Format',
    category: 'ac',
    maxScore: 5,
    description: 'Are AC written in Given/When/Then or equivalent?',
    rubric: {
      zero: 'No acceptance criteria written',
      mid: 'AC exists but not in Given/When/Then or equivalent',
      max: 'All AC in clear BDD format with specific conditions',
    },
  },
  {
    id: 'coverage',
    label: 'Coverage',
    category: 'ac',
    maxScore: 5,
    description: 'Are happy path, error paths, and edge cases covered?',
    rubric: {
      zero: 'No scenarios covered',
      mid: 'Happy path only; no edge cases',
      max: 'Happy path + error paths + boundary conditions covered',
    },
  },
  {
    id: 'testable',
    label: 'Testable',
    category: 'ac',
    maxScore: 5,
    description: 'Can every AC be objectively verified?',
    rubric: {
      zero: 'AC cannot be verified',
      mid: 'AC partially testable; some subjective',
      max: 'Every AC is objectively verifiable with clear pass/fail',
    },
  },
  {
    id: 'ac_clarity',
    label: 'Clear / Unambiguous',
    category: 'ac',
    maxScore: 5,
    description: 'Would any team member read the AC the same way?',
    rubric: {
      zero: 'AC is vague or contradictory',
      mid: 'Mostly clear but some terms undefined',
      max: 'No ambiguity; any team member reads it the same way',
    },
  },
  // SAFe Context (0-5 each, max 20)
  {
    id: 'type_correct',
    label: 'Story Type Correct',
    category: 'safe',
    maxScore: 5,
    description: 'Is the correct work item type used?',
    rubric: {
      zero: 'Wrong work item type used',
      mid: 'Correct type but borderline (e.g., story vs task)',
      max: 'Correct type; clearly matches SAFe definition',
    },
  },
  {
    id: 'parent_alignment',
    label: 'Parent Alignment',
    category: 'safe',
    maxScore: 5,
    description: 'Does the story trace to a parent Feature/Capability?',
    rubric: {
      zero: 'No parent Feature linked',
      mid: 'Parent linked but story doesn\'t clearly contribute',
      max: 'Story clearly traces to parent Feature/Capability',
    },
  },
  {
    id: 'dependencies',
    label: 'Dependencies Identified',
    category: 'safe',
    maxScore: 5,
    description: 'Are all dependencies identified with owners and dates?',
    rubric: {
      zero: 'No dependency analysis done',
      mid: 'Some dependencies listed but owners/dates missing',
      max: 'All dependencies identified with owners, dates, and status',
    },
  },
  {
    id: 'cross_team',
    label: 'Cross-Team Impact',
    category: 'safe',
    maxScore: 5,
    description: 'Have impacted teams been notified with a coordination plan?',
    rubric: {
      zero: 'No cross-team analysis',
      mid: 'Impact noted but no coordination plan',
      max: 'All impacted teams notified; coordination plan in place',
    },
  },
  // NFR & Risk (0-5 each, max 20)
  {
    id: 'nfrs_defined',
    label: 'NFRs Defined',
    category: 'nfr',
    maxScore: 5,
    description: 'Are non-functional requirements specific and measurable?',
    rubric: {
      zero: 'No NFRs considered',
      mid: 'Some NFRs noted but not specific (e.g., "must be fast")',
      max: 'Specific, measurable NFRs (e.g., "<500ms response, 99.9% uptime")',
    },
  },
  {
    id: 'risks',
    label: 'Risks / Assumptions',
    category: 'nfr',
    maxScore: 5,
    description: 'Are risks documented with mitigation plans?',
    rubric: {
      zero: 'No risks or assumptions documented',
      mid: 'Risks listed but no mitigation plan',
      max: 'Risks identified with probability, impact, and mitigation',
    },
  },
  {
    id: 'dod_alignment',
    label: 'DoD Alignment',
    category: 'nfr',
    maxScore: 5,
    description: 'Does the story address all applicable DoD criteria?',
    rubric: {
      zero: 'No awareness of team DoD',
      mid: 'Partial alignment; some DoD items not addressed',
      max: 'Story explicitly addresses all applicable DoD criteria',
    },
  },
  {
    id: 'security',
    label: 'Security / Compliance',
    category: 'nfr',
    maxScore: 5,
    description: 'Are security requirements and compliance impact assessed?',
    rubric: {
      zero: 'No security considerations',
      mid: 'Security mentioned but not specific',
      max: 'Security requirements defined; compliance impact assessed',
    },
  },
];

// ============================================================
// Scoring Engine
// ============================================================
export function getCategoryConfig(key: CategoryKey): CategoryConfig {
  return CATEGORIES.find(c => c.key === key)!;
}

export function getCriteriaForCategory(key: CategoryKey): Criterion[] {
  return CRITERIA.filter(c => c.category === key);
}

export function calculateScore(
  scores: Record<string, number>,
  storyType: StoryType
): ScoringResult {
  const categoryScores: Record<CategoryKey, CategoryScore> = {} as any;

  for (const cat of CATEGORIES) {
    const criteria = getCriteriaForCategory(cat.key);
    const raw = criteria.reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);
    const percentage = cat.maxScore > 0 ? (raw / cat.maxScore) * 100 : 0;
    const passesGate = percentage >= cat.gateThreshold;

    categoryScores[cat.key] = { key: cat.key, raw, max: cat.maxScore, percentage, passesGate };
  }

  // Weighted total (out of 100)
  const weightedTotal = CATEGORIES.reduce((sum, cat) => {
    const cs = categoryScores[cat.key];
    return sum + (cs.percentage / 100) * cat.weight;
  }, 0);

  // Category gate check
  const allGatesPass = Object.values(categoryScores).every(cs => cs.passesGate);

  // Standard verdict
  let verdict: Verdict;
  let verdictLabel: string;
  if (!allGatesPass) {
    verdict = 'category-gap';
    verdictLabel = '❌ Not Ready (Category Gap)';
  } else if (weightedTotal >= 90) {
    verdict = 'sprint-ready';
    verdictLabel = '✅ Sprint Ready';
  } else if (weightedTotal >= 75) {
    verdict = 'needs-refinement';
    verdictLabel = '⚠️ Needs Refinement';
  } else {
    verdict = 'not-ready';
    verdictLabel = '❌ Not Ready';
  }

  // Type-adjusted verdict
  let typeAdjustedVerdict = verdict;
  let typeAdjustedVerdictLabel = verdictLabel;

  if (storyType === 'SPIKE (C)') {
    // SPIKEs: relax AC requirement
    if (verdict === 'category-gap' && !categoryScores.ac.passesGate 
        && categoryScores.structure.passesGate && categoryScores.safe.passesGate) {
      typeAdjustedVerdict = 'needs-refinement';
      typeAdjustedVerdictLabel = '⚠️ Needs Refinement (SPIKE — AC relaxed)';
    } else if (verdict === 'needs-refinement' && weightedTotal >= 85) {
      typeAdjustedVerdict = 'sprint-ready';
      typeAdjustedVerdictLabel = '✅ Sprint Ready (SPIKE)';
    }
  } else if (storyType === 'ACTION (D)') {
    // ACTION: tighten dependency check
    if (verdict === 'sprint-ready' && (scores['dependencies'] ?? 0) < 4) {
      typeAdjustedVerdict = 'needs-refinement';
      typeAdjustedVerdictLabel = '⚠️ Needs Refinement (ACTION — check dependencies)';
    }
  }

  // Auto-detect gaps
  const gaps: string[] = [];
  const gapThresholds: Record<string, { threshold: number; label: string }> = {};
  for (const c of CRITERIA) {
    const midpoint = c.maxScore <= 4 ? 2 : 3;
    gapThresholds[c.id] = { threshold: midpoint, label: c.label };
  }
  for (const [id, config] of Object.entries(gapThresholds)) {
    if ((scores[id] ?? 0) < config.threshold) {
      gaps.push(config.label);
    }
  }

  return {
    categoryScores,
    weightedTotal: Math.round(weightedTotal * 10) / 10,
    verdict,
    typeAdjustedVerdict,
    verdictLabel,
    typeAdjustedVerdictLabel,
    gaps,
  };
}

// ============================================================
// Local Storage Persistence
// ============================================================
const STORAGE_KEY = 'dor-scorer-stories';

export function loadStories(): StoryScore[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStories(stories: StoryScore[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
}

export function addStory(story: StoryScore): StoryScore[] {
  const stories = loadStories();
  stories.unshift(story);
  saveStories(stories);
  return stories;
}

export function deleteStory(id: string): StoryScore[] {
  const stories = loadStories().filter(s => s.id !== id);
  saveStories(stories);
  return stories;
}

export function generateId(): string {
  return `dor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getVerdictColor(verdict: Verdict): string {
  switch (verdict) {
    case 'sprint-ready': return '#22C55E';
    case 'needs-refinement': return '#F59E0B';
    case 'not-ready': return '#EF4444';
    case 'category-gap': return '#EF4444';
  }
}

export function getVerdictBg(verdict: Verdict): string {
  switch (verdict) {
    case 'sprint-ready': return 'rgba(34, 197, 94, 0.12)';
    case 'needs-refinement': return 'rgba(245, 158, 11, 0.12)';
    case 'not-ready': return 'rgba(239, 68, 68, 0.12)';
    case 'category-gap': return 'rgba(239, 68, 68, 0.12)';
  }
}
