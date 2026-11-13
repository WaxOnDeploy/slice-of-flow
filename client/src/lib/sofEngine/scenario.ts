import {
  equivalent, exactKeys, failure, immutable, isCode, isRecord, isTime, STATIONS, success,
  type Checked, type Difficulty, type Manifest, type RunConfig, type Speed,
} from './types';

export const VERSIONS = immutable({
  scenario: 'fixed-deck-v1', generator: 'master-array/v1', engine: 'sof-engine/v1',
  clock: 'integer-ms/old-speed-us/v1', scoring: 'released-score/v1', policy: 'admission-wip', policyVersion: 'v1',
});
export const VIP_VERSIONS = immutable({ scenario: 'vip-expedite-v1', generator: 'vip-hardcoded/v1', scoring: 'vip-deadline-score/v1', policy: 'vip-service', policyVersion: 'v1' });
export const SUPPLIER_VERSIONS = immutable({ scenario: 'supplier-shortage-v1', generator: 'supplier-fixed/v1', policy: 'supplier-sequencing', policyVersion: 'v1' });
export const SUPPLIER_PILOT_TIMING = immutable({ horizonMs: 240000, startMs: 20000, endMs: 65000, affectedOrderTypeId: 'veggie-supreme' });
/** Preview pilot only. Fixed-deck Round 1/2 timing is not changed. */
export const VIP_PILOT_TIMINGS = immutable({
  easy: { horizonMs: 420000, arrivalMs: [60000, 160000, 260000], deadlineWindowMs: 120000 },
  normal: { horizonMs: 300000, arrivalMs: [10000, 90000, 170000], deadlineWindowMs: 90000 },
  hard: { horizonMs: 300000, arrivalMs: [10000, 90000, 170000], deadlineWindowMs: 90000 },
});
/** Explicit test-only input marker. Never resolvable as a published scenario. */
export const FIXTURE_VERSIONS = immutable({ scenario: 'test-fixture/v1', generator: 'test-only/v1' });
const DECK = [
  ['cheese', 'Small', 30000, 40000], ['pepperoni', 'Small', 30000, 40000],
  ['veggie-supreme', 'Medium', 60000, 60000], ['cheese', 'Small', 30000, 40000],
  ['meat-lovers', 'Medium', 60000, 60000], ['cheese', 'Small', 30000, 40000],
  ['veggie-supreme', 'Medium', 60000, 60000], ['pepperoni', 'Small', 30000, 40000],
  ['custom-build', 'Large', 90000, 80000], ['meat-lovers', 'Medium', 60000, 60000],
  ['veggie-supreme', 'Medium', 60000, 60000], ['custom-build', 'Large', 90000, 80000],
] as const;
const TIMING = {
  easy: [420000, 20000, 30000, 600000, 2],
  normal: [240000, 15000, 15000, 480000, 3],
  hard: [180000, 10000, 15000, 360000, 3],
} as const;
const GOLDENS = immutable(Object.fromEntries((['easy', 'normal', 'hard'] as const).map(difficulty => {
  const [horizonMs, pushIntervalMs, burnBufferMs, patienceMs] = TIMING[difficulty];
  return [difficulty, {
    schema: 'sof-manifest/v1', scenarioId: 'fixed-deck', scenarioVersion: VERSIONS.scenario,
    generatorVersion: VERSIONS.generator, seed: 0, difficulty, horizonMs, pushIntervalMs, burnBufferMs, patienceMs,
    orders: DECK.map(([orderTypeId, complexity, prepMs, bakeMs], i) => ({
      orderKey: `order-${i + 1}`, ordinal: i + 1, orderTypeId, complexity, availableAtMs: 0, prepMs, bakeMs,
    })), holds: [],
  }];
})) as unknown as Record<Difficulty, Manifest>);
const VIP_GOLDENS = immutable(Object.fromEntries((['easy', 'normal', 'hard'] as const).map(difficulty => {
  const base = GOLDENS[difficulty], timing = VIP_PILOT_TIMINGS[difficulty];
  return [difficulty, { ...base, scenarioId: 'vip-expedite', scenarioVersion: VIP_VERSIONS.scenario,
    generatorVersion: VIP_VERSIONS.generator, horizonMs: timing.horizonMs,
    orders: [...base.orders, ...timing.arrivalMs.map((availableAtMs, i) => ({
      orderKey: `order-${i + 13}`, ordinal: i + 13, orderTypeId: 'vip-cheese', complexity: 'Small',
      availableAtMs, prepMs: 30000, bakeMs: 40000, serviceClass: 'vip', deadlineAtMs: availableAtMs + timing.deadlineWindowMs,
    }))] }];
})) as unknown as Record<Difficulty, Manifest>);
/** Seed 0 identifies this deterministic fixed schedule, not random demand. */
const SUPPLIER_GOLDEN: Manifest = immutable({ ...GOLDENS.normal, scenarioId: 'supplier-shortage',
  scenarioVersion: SUPPLIER_VERSIONS.scenario, generatorVersion: SUPPLIER_VERSIONS.generator,
  holds: GOLDENS.normal.orders.filter(o => o.orderTypeId === SUPPLIER_PILOT_TIMING.affectedOrderTypeId).map(o => ({
    holdId: `supplier-${o.orderKey}`, orderKey: o.orderKey, startMs: SUPPLIER_PILOT_TIMING.startMs,
    endMs: SUPPLIER_PILOT_TIMING.endMs, reason: 'supplier-ingredient' as const,
  })),
});

export function resolveManifest(version: unknown, difficulty: unknown, seed: unknown): Checked<Manifest> {
  if (version !== VERSIONS.scenario && version !== VIP_VERSIONS.scenario && version !== SUPPLIER_VERSIONS.scenario) return failure('UNSUPPORTED_VERSION', 'scenarioVersion');
  if (seed !== 0) return failure('UNSUPPORTED_SEED', 'seed');
  if (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') return failure('INVALID_DIFFICULTY', 'difficulty');
  if (version === SUPPLIER_VERSIONS.scenario) return difficulty === 'normal' ? success(immutable(SUPPLIER_GOLDEN)) : failure('INVALID_DIFFICULTY', 'difficulty');
  return success(immutable((version === VIP_VERSIONS.scenario ? VIP_GOLDENS : GOLDENS)[difficulty]));
}

export function validateManifest(input: unknown): Checked<Manifest> {
  const keys = ['schema', 'scenarioId', 'scenarioVersion', 'generatorVersion', 'seed', 'difficulty',
    'horizonMs', 'pushIntervalMs', 'burnBufferMs', 'patienceMs', 'orders', 'holds'];
  if (!isRecord(input) || !exactKeys(input, keys)) return failure('INVALID_MANIFEST', 'manifest');
  if (input.schema !== 'sof-manifest/v1' || !['fixed-deck', 'vip-expedite', 'supplier-shortage'].includes(input.scenarioId as string)) return failure('UNSUPPORTED_SCHEMA', 'manifest');
  if (input.seed !== 0) return failure('UNSUPPORTED_SEED', 'manifest.seed');
  const official = input.scenarioId === 'fixed-deck' && input.scenarioVersion === VERSIONS.scenario && input.generatorVersion === VERSIONS.generator;
  const vip = input.scenarioId === 'vip-expedite' && input.scenarioVersion === VIP_VERSIONS.scenario && input.generatorVersion === VIP_VERSIONS.generator;
  const supplier = input.scenarioId === 'supplier-shortage' && input.scenarioVersion === SUPPLIER_VERSIONS.scenario && input.generatorVersion === SUPPLIER_VERSIONS.generator;
  const fixture = input.scenarioId === 'fixed-deck' && input.scenarioVersion === FIXTURE_VERSIONS.scenario && input.generatorVersion === FIXTURE_VERSIONS.generator;
  if (!official && !fixture && !vip && !supplier) return failure('UNSUPPORTED_VERSION', 'manifest.scenarioVersion');
  if (input.difficulty !== 'easy' && input.difficulty !== 'normal' && input.difficulty !== 'hard') return failure('INVALID_DIFFICULTY', 'manifest.difficulty');
  if (supplier && input.difficulty !== 'normal') return failure('INVALID_DIFFICULTY', 'manifest.difficulty');
  for (const key of ['horizonMs', 'pushIntervalMs', 'burnBufferMs', 'patienceMs']) {
    if (!isTime(input[key]) || (key !== 'horizonMs' && !(fixture && key === 'burnBufferMs') && input[key] === 0)) return failure('INVALID_TIME', `manifest.${key}`);
  }
  // Legacy bound is retained; VIP bound covers 15 ticket areas and all duration sums.
  if ((input.horizonMs as number) > Math.floor(Number.MAX_SAFE_INTEGER / (vip ? 30 : 24))) return failure('OVERFLOW', 'manifest.horizonMs');
  if (!Number.isSafeInteger((input.horizonMs as number) + (input.pushIntervalMs as number))) return failure('OVERFLOW', 'manifest.pushIntervalMs');
  if (!Array.isArray(input.orders) || input.orders.length > (vip ? 15 : 12) || !Array.isArray(input.holds) || input.holds.length > 64) return failure('INVALID_MANIFEST', 'manifest.orders');
  const ids = new Set<string>();
  const ordinals = new Set<number>();
  for (const [i, order] of Array.from(input.orders.entries())) {
    const path = `manifest.orders[${i}]`;
    const vipOrder = vip && isRecord(order) && order.serviceClass === 'vip';
    const fields = ['orderKey', 'ordinal', 'orderTypeId', 'complexity', 'availableAtMs', 'prepMs', 'bakeMs'];
    if (!isRecord(order) || !exactKeys(order, vipOrder ? [...fields, 'serviceClass', 'deadlineAtMs'] : fields)) return failure('INVALID_ORDER', path);
    if (!isCode(order.orderKey) || !isCode(order.orderTypeId)) return failure('INVALID_ID', path);
    if (ids.has(order.orderKey) || !isTime(order.ordinal) || order.ordinal === 0 || ordinals.has(order.ordinal)) return failure('DUPLICATE_ID', path);
    ids.add(order.orderKey); ordinals.add(order.ordinal);
    if (!['Small', 'Medium', 'Large'].includes(order.complexity as string)) return failure('INVALID_ORDER', `${path}.complexity`);
    for (const key of ['availableAtMs', 'prepMs', 'bakeMs']) {
      if (!isTime(order[key]) || (key !== 'availableAtMs' && order[key] === 0)) return failure('INVALID_TIME', `${path}.${key}`);
    }
    if (vipOrder && (!isTime(order.deadlineAtMs) || order.deadlineAtMs <= (order.availableAtMs as number))) return failure('INVALID_TIME', `${path}.deadlineAtMs`);
    if (!Number.isSafeInteger((order.availableAtMs as number) + (order.prepMs as number) + (order.bakeMs as number) + (input.burnBufferMs as number) + (input.patienceMs as number) + (input.horizonMs as number))) return failure('OVERFLOW', path);
  }
  const holdIds = new Set<string>();
  for (const [i, hold] of Array.from(input.holds.entries())) {
    const path = `manifest.holds[${i}]`;
    if (!isRecord(hold) || !exactKeys(hold, ['holdId', 'orderKey', 'startMs', 'endMs', 'reason'])) return failure('INVALID_HOLD', path);
    if (!isCode(hold.holdId) || holdIds.has(hold.holdId) || !isCode(hold.orderKey) || !ids.has(hold.orderKey)) return failure('INVALID_ID', path);
    holdIds.add(hold.holdId);
    if (!isTime(hold.startMs) || !isTime(hold.endMs) || hold.endMs <= hold.startMs || hold.reason !== (supplier ? 'supplier-ingredient' : 'fixture-dependency')) return failure('INVALID_HOLD', path);
  }
  if (supplier && !equivalent(input, SUPPLIER_GOLDEN)) return failure('MANIFEST_MISMATCH', 'manifest');
  if ((official || vip) && !equivalent(input, (vip ? VIP_GOLDENS : GOLDENS)[input.difficulty])) return failure('MANIFEST_MISMATCH', 'manifest');
  return success(immutable(input) as Manifest);
}

const RESOURCES = immutable({
  occupancy: { orderQueue: null, prep: null, oven: 3, boxDeliver: null },
  processing: { prep: { kind: 'per-active-ticket' }, oven: { kind: 'fixed', slots: 3 } },
});
export const VIP_RESOURCES = immutable({
  occupancy: { orderQueue: null, prep: 2, oven: 3, boxDeliver: null },
  processing: { prep: { kind: 'fixed', slots: 2 }, oven: { kind: 'fixed', slots: 3 } },
});
const PUSH_WIP = immutable({ orderQueue: null, prep: null, oven: null, boxDeliver: null });
export const PULL_WIP = immutable({ orderQueue: 4, prep: 2, oven: 3, boxDeliver: 2 });
export function validateConfig(input: unknown): Checked<RunConfig> {
  if (!isRecord(input) || !exactKeys(input, ['schema', 'engineVersion', 'clockRulesVersion', 'scoringVersion', 'manifest', 'resources', 'initialSpeed', 'guidedStart', 'endCondition', 'policy'])) return failure('INVALID_CONFIG', 'config');
  if (input.schema !== 'sof-config/v1' || input.engineVersion !== VERSIONS.engine || input.clockRulesVersion !== VERSIONS.clock) return failure('UNSUPPORTED_VERSION', 'config');
  const manifest = validateManifest(input.manifest);
  if (!manifest.ok) return manifest;
  const vip = manifest.value.scenarioId === 'vip-expedite';
  const supplier = manifest.value.scenarioId === 'supplier-shortage';
  if (input.scoringVersion !== (vip ? VIP_VERSIONS.scoring : VERSIONS.scoring)) return failure('UNSUPPORTED_VERSION', 'config.scoringVersion');
  if (!equivalent(input.resources, vip || supplier ? VIP_RESOURCES : RESOURCES)) return failure('INVALID_RESOURCES', 'config.resources');
  if (![1, 2, 3].includes(input.initialSpeed as number) || typeof input.guidedStart !== 'boolean') return failure('INVALID_CONFIG', 'config.initialSpeed');
  if (input.endCondition !== 'fixed-horizon' && input.endCondition !== 'all-resolved-or-horizon') return failure('INVALID_CONFIG', 'config.endCondition');
  if ((vip || supplier) && input.endCondition !== 'fixed-horizon') return failure('INVALID_CONFIG', 'config.endCondition');
  const policy = input.policy;
  if (!isRecord(policy) || !exactKeys(policy, ['dimensionId', 'version', 'variantId', 'wip']) || policy.dimensionId !== (supplier ? SUPPLIER_VERSIONS.policy : vip ? VIP_VERSIONS.policy : VERSIONS.policy) || policy.version !== 'v1' || !(supplier ? ['naive', 'managed'] : vip ? ['fifo', 'expedite'] : ['interval-push', 'manual-pull']).includes(policy.variantId as string)) return failure('INVALID_POLICY', 'config.policy');
  if (!equivalent(policy.wip, policy.variantId === 'interval-push' ? PUSH_WIP : PULL_WIP)) return failure('INVALID_POLICY', 'config.policy.wip');
  return success(immutable(input) as RunConfig);
}
export type FixedDeckOptions = Readonly<{
  difficulty: Difficulty; policy: 'interval-push' | 'manual-pull'; initialSpeed?: Speed;
  guidedStart?: boolean; endCondition?: RunConfig['endCondition'];
}>;
export function makeFixedDeckConfig(input: unknown): Checked<RunConfig> {
  if (!isRecord(input) || !Reflect.ownKeys(input).every(k => typeof k === 'string' && ['difficulty', 'policy', 'initialSpeed', 'guidedStart', 'endCondition'].includes(k)) || !Object.hasOwn(input, 'difficulty') || !Object.hasOwn(input, 'policy')) return failure('INVALID_CONFIG', 'options');
  const manifest = resolveManifest(VERSIONS.scenario, input.difficulty, 0);
  if (!manifest.ok) return manifest;
  return validateConfig({
    schema: 'sof-config/v1', engineVersion: VERSIONS.engine, clockRulesVersion: VERSIONS.clock,
    scoringVersion: VERSIONS.scoring, manifest: manifest.value, resources: RESOURCES,
    initialSpeed: Object.hasOwn(input, 'initialSpeed') ? input.initialSpeed : TIMING[manifest.value.difficulty][4],
    guidedStart: Object.hasOwn(input, 'guidedStart') ? input.guidedStart : false,
    endCondition: Object.hasOwn(input, 'endCondition') ? input.endCondition : 'fixed-horizon',
    policy: { dimensionId: VERSIONS.policy, version: VERSIONS.policyVersion, variantId: input.policy,
      wip: input.policy === 'manual-pull' ? PULL_WIP : PUSH_WIP },
  });
}

/** Producer-owned score rule. Burnt angry records deliberately do not incur anger penalty. */
export function scoreCounts(served: number, burnt: number, angry: number): number {
  return served - 2 * burnt - angry + (served > 0 && burnt === 0 ? 3 : 0);
}
// Keep station configuration explicit, rather than interpreting null as staffing.
export const PHYSICAL_STATIONS = STATIONS;
