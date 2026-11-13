import { replay } from './engine';
import { getRun, snapshotFromEngine, validateSnapshot } from './runSnapshots';
import { makeFixedDeckConfig, VERSIONS, VIP_VERSIONS } from './scenario';
import { makeVipConfig, type VipVariant } from './vip';
import { makeSupplierConfig, SUPPLIER_VERSIONS, type SupplierVariant } from './supplier';
import { compatibleServedDefinitions } from '../sof/metricDefinitions';
import {
  equivalent, exactKeys, failure, immutable, isCode, isRecord, success,
  type Checked, type DeepReadonly, type FinalRunSnapshot, type ValidationIssue,
} from './types';

export type PairSpec = DeepReadonly<{
  pairId: string; baselineRunId: string; subjectRunId: string;
  requestedBasis: 'contextual' | 'matched';
  change: { dimensionId: string; version: string; beforeVariantId: string; afterVariantId: string } | null;
}>;
export type MatchReason =
  | 'INVALID_PAIR' | 'SELF_PAIR' | 'INVALID_ARCHIVE' | 'BASELINE_MISSING' | 'SUBJECT_MISSING'
  | 'BASELINE_INVALID_SNAPSHOT' | 'SUBJECT_INVALID_SNAPSHOT' | 'CONTEXTUAL_REQUESTED'
  | 'UNAPPROVED_POLICY_CHANGE' | 'POLICY_VARIANT_MISMATCH' | 'BASELINE_NOT_PRODUCTION_MANIFEST'
  | 'SUBJECT_NOT_PRODUCTION_MANIFEST' | 'BASELINE_PRODUCER_INCOMPATIBLE' | 'SUBJECT_PRODUCER_INCOMPATIBLE'
  | 'SCENARIO_MISMATCH' | 'DIFFICULTY_MISMATCH' | 'DEMAND_MISMATCH' | 'HOLDS_MISMATCH'
  | 'TIMING_MISMATCH' | 'MANIFEST_MISMATCH' | 'RESOURCES_MISMATCH' | 'ENGINE_RULES_MISMATCH'
  | 'CLOCK_RULES_MISMATCH' | 'SCORING_RULES_MISMATCH' | 'INITIAL_SPEED_MISMATCH'
  | 'GUIDANCE_MISMATCH' | 'END_CONDITION_MISMATCH' | 'INVARIANT_CONFIG_MISMATCH'
  | 'NONPOSITIVE_OBSERVATION' | 'OBSERVATION_MISMATCH' | 'END_REASON_MISMATCH'
  | 'SERVED_DEFINITION_MISMATCH' | 'CONTROL_TRACE_MISMATCH' | 'MANUAL_END_NOT_MATCHABLE';
export type MatchAssessment = DeepReadonly<{
  pairId: string | null; baselineRunId: string | null; subjectRunId: string | null;
  kind: 'missing' | 'contextual' | 'unmatched' | 'matched';
  issues: MatchReason[];
  details: { side: 'archive' | 'baseline' | 'subject'; code: string; path: string }[];
  evidence: 'producer-compatible' | 'not-established'; humanPlay: 'not-established';
}>;
export type ProducerCompatibility = Readonly<{
  evidence: 'producer-compatible'; productionManifest: boolean; humanPlay: 'not-established';
}>;

function canonicalConfig(snapshot: FinalRunSnapshot): boolean {
  const c = snapshot.config;
  const built = c.manifest.scenarioId === 'supplier-shortage' ? makeSupplierConfig({ variant: c.policy.variantId as SupplierVariant,
    initialSpeed: c.initialSpeed, guidedStart: c.guidedStart }) : c.manifest.scenarioId === 'vip-expedite' ? makeVipConfig({ difficulty: c.manifest.difficulty, variant: c.policy.variantId as VipVariant,
    initialSpeed: c.initialSpeed, guidedStart: c.guidedStart }) : makeFixedDeckConfig({ difficulty: c.manifest.difficulty, policy: c.policy.variantId,
    initialSpeed: c.initialSpeed, guidedStart: c.guidedStart, endCondition: c.endCondition });
  return built.ok && equivalent(c, built.value);
}

/** Physics/control replay compatibility, not a certificate of origin or evidence a human played.
 * Generic lifecycle accounting alone intentionally does not satisfy this check.
 */
export function inspectProducerCompatibility(input: unknown): Checked<ProducerCompatibility> {
  try {
    const checked = validateSnapshot(input); if (!checked.ok) return checked;
    const s = checked.value;
    const frames = s.history.events.flatMap(e => e.kind === 'commandAccepted' ? [{ atMs: e.atMs, command: e.command }] : []);
    const reproduced = replay(s.config, s.runId, frames, s.observation.endMs);
    if (!reproduced.ok) return failure('PRODUCER_REPLAY_REJECTED', 'history');
    const captured = snapshotFromEngine(reproduced.value.state);
    if (!captured.ok || !equivalent(s, captured.value)) return failure('PRODUCER_SNAPSHOT_MISMATCH', 'snapshot');
    return success(immutable({ evidence: 'producer-compatible', productionManifest: s.config.manifest.scenarioId === 'fixed-deck' && canonicalConfig(s), humanPlay: 'not-established' }));
  } catch {
    return failure('INVALID_PRODUCER_INPUT', 'snapshot');
  }
}

function validPair(input: unknown): input is PairSpec {
  if (!isRecord(input) || !exactKeys(input, ['pairId', 'baselineRunId', 'subjectRunId', 'requestedBasis', 'change']) ||
    !isCode(input.pairId) || !isCode(input.baselineRunId) || !isCode(input.subjectRunId) ||
    !['contextual', 'matched'].includes(input.requestedBasis as string)) return false;
  return input.change === null || (isRecord(input.change) &&
    exactKeys(input.change, ['dimensionId', 'version', 'beforeVariantId', 'afterVariantId']) &&
    Object.values(input.change).every(isCode));
}
const controls = (s: FinalRunSnapshot) => s.history.events.flatMap(e =>
  e.kind === 'commandAccepted' && e.commandClass === 'control' ? [{ atMs: e.atMs, command: e.command }] : []);

/** The only authority that grants a matched claim. No latest/best selection, caller signatures,
 * arbitrary changed-field lists, gameplay equality, or consumer match flags are accepted.
 */
export function assessComparison(archive: unknown, explicitPair: unknown): MatchAssessment {
  let pair: PairSpec | null = null;
  const issues: MatchReason[] = [];
  const details: { side: 'archive' | 'baseline' | 'subject'; code: string; path: string }[] = [];
  const finish = (kind: MatchAssessment['kind']): MatchAssessment => immutable({
    pairId: pair?.pairId ?? null, baselineRunId: pair?.baselineRunId ?? null, subjectRunId: pair?.subjectRunId ?? null,
    kind, issues, details, evidence: kind === 'matched' ? 'producer-compatible' : 'not-established', humanPlay: 'not-established',
  });
  const add = (condition: boolean, reason: MatchReason) => { if (condition) issues.push(reason); };
  const detail = (side: 'archive' | 'baseline' | 'subject', problems: readonly ValidationIssue[]) => {
    details.push(...problems.map(p => ({ side, ...p })));
  };
  try {
    if (!validPair(explicitPair)) { issues.push('INVALID_PAIR'); return finish('unmatched'); }
    pair = immutable(explicitPair);
    if (pair.baselineRunId === pair.subjectRunId) { issues.push('SELF_PAIR'); return finish('unmatched'); }
    // getRun owns archive validation and identity resolution; do not introduce another archive.
    const before = getRun(archive, pair.baselineRunId), after = getRun(archive, pair.subjectRunId);
    if (!before.ok || !after.ok) {
      issues.push('INVALID_ARCHIVE');
      detail('archive', !before.ok ? before.issues : !after.ok ? after.issues : []);
      return finish('unmatched');
    }
    add(before.value === null, 'BASELINE_MISSING'); add(after.value === null, 'SUBJECT_MISSING');
    if (before.value === null || after.value === null) return finish('missing');
    const bChecked = validateSnapshot(before.value), aChecked = validateSnapshot(after.value);
    if (!bChecked.ok || !aChecked.ok) {
      if (!bChecked.ok) { issues.push('BASELINE_INVALID_SNAPSHOT'); detail('baseline', bChecked.issues); }
      if (!aChecked.ok) { issues.push('SUBJECT_INVALID_SNAPSHOT'); detail('subject', aChecked.issues); }
      return finish('unmatched');
    }
    if (pair.requestedBasis === 'contextual') { issues.push('CONTEXTUAL_REQUESTED'); return finish('contextual'); }
    const b = bChecked.value, a = aChecked.value, bc = b.config, ac = a.config, bm = bc.manifest, am = ac.manifest;
    const change = pair.change;
    const approvedChange = change !== null && change.version === 'v1' && change.beforeVariantId !== change.afterVariantId &&
      ((change.dimensionId === VERSIONS.policy && ['interval-push', 'manual-pull'].includes(change.beforeVariantId) && ['interval-push', 'manual-pull'].includes(change.afterVariantId)) ||
       (change.dimensionId === VIP_VERSIONS.policy && ['fifo', 'expedite'].includes(change.beforeVariantId) && ['fifo', 'expedite'].includes(change.afterVariantId)) ||
       (change.dimensionId === SUPPLIER_VERSIONS.policy && bm.scenarioId === 'supplier-shortage' && am.scenarioId === 'supplier-shortage' && canonicalConfig(b) && canonicalConfig(a) &&
         ['naive', 'managed'].includes(change.beforeVariantId) && ['naive', 'managed'].includes(change.afterVariantId)));
    add(!approvedChange, 'UNAPPROVED_POLICY_CHANGE');
    add(change !== null && (bc.policy.variantId !== change.beforeVariantId || ac.policy.variantId !== change.afterVariantId), 'POLICY_VARIANT_MISMATCH');
    add(!canonicalConfig(b), 'BASELINE_NOT_PRODUCTION_MANIFEST'); add(!canonicalConfig(a), 'SUBJECT_NOT_PRODUCTION_MANIFEST');
    const bp = inspectProducerCompatibility(b), ap = inspectProducerCompatibility(a);
    if (!bp.ok) { issues.push('BASELINE_PRODUCER_INCOMPATIBLE'); detail('baseline', bp.issues); }
    if (!ap.ok) { issues.push('SUBJECT_PRODUCER_INCOMPATIBLE'); detail('subject', ap.issues); }
    add(bm.scenarioId !== am.scenarioId || bm.scenarioVersion !== am.scenarioVersion || bm.generatorVersion !== am.generatorVersion || bm.seed !== am.seed, 'SCENARIO_MISMATCH');
    add(bm.difficulty !== am.difficulty, 'DIFFICULTY_MISMATCH');
    add(!equivalent(bm.orders, am.orders), 'DEMAND_MISMATCH'); add(!equivalent(bm.holds, am.holds), 'HOLDS_MISMATCH');
    add(bm.horizonMs !== am.horizonMs || bm.pushIntervalMs !== am.pushIntervalMs || bm.burnBufferMs !== am.burnBufferMs || bm.patienceMs !== am.patienceMs, 'TIMING_MISMATCH');
    add(!equivalent(bm, am), 'MANIFEST_MISMATCH'); add(!equivalent(bc.resources, ac.resources), 'RESOURCES_MISMATCH');
    add(bc.engineVersion !== ac.engineVersion, 'ENGINE_RULES_MISMATCH'); add(bc.clockRulesVersion !== ac.clockRulesVersion, 'CLOCK_RULES_MISMATCH');
    add(bc.scoringVersion !== ac.scoringVersion, 'SCORING_RULES_MISMATCH'); add(bc.initialSpeed !== ac.initialSpeed, 'INITIAL_SPEED_MISMATCH');
    add(bc.guidedStart !== ac.guidedStart, 'GUIDANCE_MISMATCH'); add(bc.endCondition !== ac.endCondition, 'END_CONDITION_MISMATCH');
    const { policy: _bp, ...bi } = bc, { policy: _ap, ...ai } = ac;
    add(!equivalent(bi, ai), 'INVARIANT_CONFIG_MISMATCH');
    add(b.observation.durationMs <= 0 || a.observation.durationMs <= 0, 'NONPOSITIVE_OBSERVATION');
    add(!equivalent(b.observation, a.observation), 'OBSERVATION_MISMATCH'); add(b.endReason !== a.endReason, 'END_REASON_MISMATCH');
    add(!compatibleServedDefinitions(b.metrics.servedSample.definition, a.metrics.servedSample.definition), 'SERVED_DEFINITION_MISMATCH');
    add(([bm.scenarioId, am.scenarioId].some(id => id === 'vip-expedite' || id === 'supplier-shortage')) && (b.endReason === 'manual-stop' || a.endReason === 'manual-stop'), 'MANUAL_END_NOT_MATCHABLE');
    add(!equivalent(controls(b), controls(a)), 'CONTROL_TRACE_MISMATCH');
    return finish(issues.length === 0 ? 'matched' : 'unmatched');
  } catch {
    issues.push(pair === null ? 'INVALID_PAIR' : 'INVALID_ARCHIVE');
    return finish('unmatched');
  }
}
