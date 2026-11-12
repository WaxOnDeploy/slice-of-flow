import { makeFixedDeckConfig, FIXTURE_VERSIONS } from '../scenario';
import { advanceTo, applyAction, createEngine } from '../engine';
import type { Checked, Engine, EngineCommand, HoldSpec, Manifest, RunConfig } from '../types';

export function value<T>(checked: Checked<T>): T {
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  return checked.value;
}
export function clone<T>(input: T): T { return JSON.parse(JSON.stringify(input)); }
/** Synthetic, bounded physics/clock fixtures. Never added to resolver or app/provider registry. */
export function testConfig(options: {
  count?: number; horizonMs?: number; intervalMs?: number; prepMs?: number; bakeMs?: number;
  burnBufferMs?: number; patienceMs?: number; arrivals?: number[]; holds?: HoldSpec[];
  policy?: 'manual-pull' | 'interval-push'; endCondition?: RunConfig['endCondition']; guidedStart?: boolean;
  speed?: 1 | 2 | 3;
} = {}): RunConfig {
  const base = value(makeFixedDeckConfig({ difficulty: 'normal', policy: options.policy ?? 'manual-pull',
    guidedStart: options.guidedStart ?? false, initialSpeed: options.speed ?? 1,
    endCondition: options.endCondition ?? 'fixed-horizon' }));
  const manifest: Manifest = {
    ...base.manifest, scenarioVersion: FIXTURE_VERSIONS.scenario, generatorVersion: FIXTURE_VERSIONS.generator,
    horizonMs: options.horizonMs ?? 50, pushIntervalMs: options.intervalMs ?? 10,
    burnBufferMs: options.burnBufferMs ?? 15, patienceMs: options.patienceMs ?? 100,
    orders: Array.from({ length: options.count ?? 3 }, (_, i) => ({
      orderKey: `order-${i + 1}`, ordinal: i + 1, orderTypeId: 'fixture-small', complexity: 'Small',
      availableAtMs: options.arrivals?.[i] ?? 0, prepMs: options.prepMs ?? 3, bakeMs: options.bakeMs ?? 4,
    })), holds: options.holds ?? [],
  };
  return { ...base, manifest };
}
export function start(config: RunConfig = testConfig(), runId = 'session-1:run:1'): Engine {
  return value(createEngine(runId, config)).state;
}
export function action(state: Engine, command: EngineCommand): Engine {
  const result = applyAction(state, command);
  if (!result.accepted) throw new Error(JSON.stringify(result.issues));
  return result.state;
}
export function resume(state: Engine): Engine { return action(state, { kind: 'set-pause', reason: 'instruction', active: false }); }
export function at(state: Engine, nowMs: number): Engine { return value(advanceTo(state, nowMs)).state; }
export function admit(state: Engine, n: number): Engine { return action(state, { kind: 'admit', orderKey: `order-${n}` }); }
export function move(state: Engine, n: number, to: Extract<EngineCommand, {kind: 'move'}>['to']): Engine {
  return action(state, { kind: 'move', orderKey: `order-${n}`, to });
}
export const SHORT_EXPECTED = Object.freeze({
  push25Admissions: [10, 20], push25OrdersAreaMs: 20, // (25-10)+(25-20)
  overlappingHoldAreaMs: 30000, clippedHoldAreaMs: 25000,
  servedBurntAreaTicketSec: 175, servedBurntMeanSimSec: 90, servedBurntExitEstimateSimSec: 87.5,
});
