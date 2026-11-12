import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SOLO_DECK, DIFFICULTY_PRESETS } from '../sliceOfFlowConstants';
import { makeFixedDeckConfig, resolveManifest, validateConfig, validateManifest, VERSIONS } from './scenario';
import { clone, testConfig, value } from './fixtures/testCases';
import type { Difficulty } from './types';

describe('materialized master-array seed-0 manifests', () => {
  it.each(['easy', 'normal', 'hard'] as Difficulty[])('resolves immutable %s golden and canonical work without customer fields', difficulty => {
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/fixed-deck-v1.${difficulty}.json`, import.meta.url), 'utf8'));
    const manifest = value(resolveManifest(VERSIONS.scenario, difficulty, 0));
    expect(manifest).toEqual(golden);
    expect(value(resolveManifest(VERSIONS.scenario, difficulty, 0))).toEqual(manifest);
    expect(manifest.orders).toHaveLength(12);
    expect(manifest.orders.map(o => [o.orderKey, o.ordinal, o.complexity, o.prepMs, o.bakeMs])).toEqual(
      SOLO_DECK.map(c => [c.id, c.orderNumber, c.complexity, c.prepTime * 1000, c.ovenTime * 1000]));
    const slug = (s: string) => s.toLowerCase().replaceAll(' ', '-');
    expect(manifest.orders.map(o => o.orderTypeId)).toEqual(SOLO_DECK.map(c => slug(c.pizzaType)));
    const p = DIFFICULTY_PRESETS[difficulty];
    expect([manifest.horizonMs, manifest.pushIntervalMs, manifest.burnBufferMs, manifest.patienceMs]).toEqual(
      [p.roundDuration, p.orderFlipInterval, p.ovenBurnTime - p.ovenDoneTime, p.angryThreshold].map(x => x * 1000));
    expect(manifest.orders.every(o => o.availableAtMs === 0)).toBe(true);
    expect(manifest.holds).toEqual([]);
    expect(Object.isFrozen(manifest.orders[0])).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/customer|deadline|staff|priority|expedite/);
  });
  it.each([['v2', 'normal', 0], [1, 'normal', 0], [VERSIONS.scenario, 'normal', 1], [VERSIONS.scenario, 'impossible', 0]])('rejects unsupported resolution %j', (version, difficulty, seed) => {
    expect(resolveManifest(version, difficulty, seed).ok).toBe(false);
  });
  it('rejects changed official input rather than treating it as published fixture', () => {
    const manifest: any = clone(value(resolveManifest(VERSIONS.scenario, 'normal', 0)));
    manifest.horizonMs = 25;
    expect(validateManifest(manifest)).toMatchObject({ ok: false, issues: [{ code: 'MANIFEST_MISMATCH' }] });
  });
});

describe('runtime validation and ownership', () => {
  it.each([
    (m: any) => { m.customer = 'not-allowed'; },
    (m: any) => { m.orders[0].deadlineMs = 1; },
    (m: any) => { m.orders[0].prepMs = 0; },
    (m: any) => { m.orders[0].bakeMs = NaN; },
    (m: any) => { m.orders[0].availableAtMs = 0.5; },
    (m: any) => { m.orders[1].orderKey = m.orders[0].orderKey; },
    (m: any) => { m.orders[1].ordinal = m.orders[0].ordinal; },
    (m: any) => { m.horizonMs = Number.MAX_SAFE_INTEGER; },
    (m: any) => { m.seed = 3; },
    (m: any) => { m.holds = [{ holdId: 'h', orderKey: 'absent', startMs: 0, endMs: 2, reason: 'fixture-dependency' }]; },
    (m: any) => { m.holds = [{ holdId: 'h', orderKey: 'order-1', startMs: 3, endMs: 3, reason: 'fixture-dependency' }]; },
  ])('rejects malformed manifest %#', mutate => {
    const m = clone(testConfig().manifest); mutate(m); expect(validateManifest(m).ok).toBe(false);
  });
  it.each([
    (c: any) => { c.resources.occupancy.oven = 4; },
    (c: any) => { c.resources.occupancy.prep = 7; },
    (c: any) => { c.resources.processing.prep = { kind: 'fixed', slots: 2 }; },
    (c: any) => { c.resources.processing.oven.slots = 4; },
    (c: any) => { c.resources.workers = 1; },
    (c: any) => { c.policy.wip.orderQueue = 5; },
    (c: any) => { c.engineVersion = 'future'; },
    (c: any) => { c.scoringVersion = 'rebalance'; },
    (c: any) => { c.initialSpeed = 4; },
    (c: any) => { c.guidedStart = 'yes'; },
  ])('rejects unapproved config %#', mutate => {
    const c = clone(testConfig()); mutate(c); expect(validateConfig(c).ok).toBe(false);
  });
  it('copies owned inputs and keeps separate physical, processing and policy capacities', () => {
    const raw: any = clone(testConfig()); const validated = value(validateConfig(raw));
    raw.manifest.orders[0].prepMs = 1000;
    expect(validated.manifest.orders[0].prepMs).toBe(3);
    expect(Object.isFrozen(validated.resources.processing.oven)).toBe(true);
    const push = value(makeFixedDeckConfig({ difficulty: 'hard', policy: 'interval-push' }));
    expect(push.resources).toEqual({ occupancy: { orderQueue: null, prep: null, oven: 3, boxDeliver: null },
      processing: { prep: { kind: 'per-active-ticket' }, oven: { kind: 'fixed', slots: 3 } } });
    expect(push.policy.wip).toEqual({ orderQueue: null, prep: null, oven: null, boxDeliver: null });
    expect(push.initialSpeed).toBe(3);
    expect(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull', staffing: 4 }).ok).toBe(false);
  });
});
