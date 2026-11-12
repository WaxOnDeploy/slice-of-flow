/**
 * Standalone, bounded, deterministic assertions; no Vitest, real timers, browser,
 * store, localStorage, network, or production writes. Run: pnpm exec tsx tests/vip-3x-stress.ts
 * SOF_STRESS_OUTPUT overrides the report destination (relative paths use repo cwd).
 * All simulated progression goes through the real integer-microsecond wall driver.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createDriver, sampleWall } from '../client/src/lib/sofEngine/driver';
import { applyAction, createEngine } from '../client/src/lib/sofEngine/engine';
import { makeVipConfig, measureVipResults, type VipVariant } from '../client/src/lib/sofEngine/vip';
import { snapshotFromEngine, validateSnapshot } from '../client/src/lib/sofEngine/runSnapshots';
import { assessComparison, type PairSpec } from '../client/src/lib/sofEngine/matchedRuns';
import { readVipActivity } from '../client/src/lib/sof/vip';
import { hasServedSamples, SERVED_DEFINITION } from '../client/src/lib/sof/metricDefinitions';
import {
  abandonIndependentSession, commandIndependentSession, replayVipSession,
  sampleIndependentSession, sessionToken, startVipSession,
  type IndependentSession,
} from '../client/src/lib/sof/independentSession';
import type { Checked, Driver, Engine, EngineCommand, FinalRunSnapshot, Station } from '../client/src/lib/sofEngine/types';

let assertionCount = 0;
const eq = (actual: unknown, expected: unknown, message?: string) => {
  assertionCount++; assert.deepStrictEqual(actual, expected, message);
};
const check: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  assertionCount++; assert.ok(condition, message);
};
const throws = (fn: () => unknown, message: string) => {
  assertionCount++; assert.throws(fn, TypeError, message);
};
const value = <T,>(result: Checked<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};
const WALL_SPEED = 3;
const wallFor = (simMs: number) => Math.ceil(simMs * 1000 / WALL_SPEED);
const key = (n: number) => `order-${n}`;
const subset = (actual: object, expected: object) => {
  for (const [name, wanted] of Object.entries(expected)) eq((actual as Record<string, unknown>)[name], wanted, name);
};
const near = (actual: number, expected: number, tolerance: number, message: string) => {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, observed ${actual}`);
};

/** Unguided canonical engine fixture; wall samples/actions are real producer operations. */
class Rig {
  engine: Engine;
  driver: Driver;
  wallUs = 0;
  commandSamples = 0;
  wallSamples = 0;
  readonly arrivalWall = new Map<string, number>();
  readonly admissionWall = new Map<string, number>();
  readonly serviceWall = new Map<string, number>();
  constructor(readonly id: string, readonly variant: VipVariant = 'expedite') {
    this.engine = value(createEngine(id, value(makeVipConfig({ difficulty: 'normal', variant, initialSpeed: 3, guidedStart: false })))).state;
    this.driver = value(createDriver(id));
    this.sampleUs(0);
    this.command({ kind: 'set-pause', reason: 'instruction', active: false });
    eq(this.engine.config.initialSpeed, 3);
    eq(this.engine.speed, 3);
  }
  sampleUs(wallUs: number) {
    check(wallUs >= this.wallUs, 'monotonic virtual clock');
    const sampled = value(sampleWall(this.engine, this.driver, wallUs));
    this.engine = sampled.state; this.driver = sampled.driver; this.wallUs = wallUs; this.wallSamples++;
    for (const event of sampled.emitted) if (event.kind === 'arrival') this.arrivalWall.set(event.orderKey, wallUs);
    return this;
  }
  at(simMs: number) {
    this.sampleUs(wallFor(simMs));
    eq(this.engine.nowMs, simMs, `${this.id}: 3× sampled simulated time`);
    return this;
  }
  command(command: EngineCommand) {
    this.sampleUs(this.wallUs);
    const result = applyAction(this.engine, command);
    check(result.accepted, `${this.id}@${this.engine.nowMs}: ${JSON.stringify(command)} rejected ${JSON.stringify(result.issues)}`);
    this.engine = result.state; this.commandSamples++;
    for (const event of result.emitted) {
      if (event.kind === 'admission') this.admissionWall.set(event.orderKey, this.wallUs);
      if (event.kind === 'service') this.serviceWall.set(event.orderKey, this.wallUs);
    }
    return this;
  }
  admit(n: number) { return this.command({ kind: 'admit', orderKey: key(n) }); }
  move(n: number, to: Station | 'served') { return this.command({ kind: 'move', orderKey: key(n), to }); }
  discard(n: number) { return this.command({ kind: 'discard', orderKey: key(n) }); }
  reject(command: EngineCommand, code: string) {
    this.sampleUs(this.wallUs);
    const original = this.engine, originalDriver = this.driver;
    const result = applyAction(original, command);
    eq(result.accepted, false); eq(result.issues[0]?.code, code);
    eq(result.state, original); check(result.state === original, 'rejection preserves engine identity');
    check(this.driver === originalDriver, 'rejection preserves sampled driver');
    eq(result.emitted, []);
    return this;
  }
  /** Immutable end-of-observation branch; does not change the running fixture. */
  observation() {
    const branch = this.engine.ended ? this.engine : applyAction(this.engine, { kind: 'end', reason: 'manual-stop' }).state;
    const snapshot = value(snapshotFromEngine(branch));
    eq(validateSnapshot(snapshot).ok, true);
    return snapshot;
  }
  finish(simMs = this.engine.nowMs) {
    this.at(simMs);
    if (!this.engine.ended) this.command({ kind: 'end', reason: 'manual-stop' });
    return this.observation();
  }
  ticket(n: number) { return this.engine.tickets[n - 1]; }
  occupancy(station: Station) { return this.engine.tickets.filter(t => t.status === 'active' && t.station === station).length; }
  result() { return value(measureVipResults(this.observation())); }
}

const sessionCommand = (s: IndependentSession, wallUs: number, command: EngineCommand) => {
  const result = commandIndependentSession(s, sessionToken(s), wallUs, command);
  check(result.accepted, `session command rejected ${JSON.stringify(result.issues)}`);
  return result.state;
};
const sessionSample = (s: IndependentSession, wallUs: number) => {
  const result = sampleIndependentSession(s, sessionToken(s), wallUs);
  check(result.accepted, `session sample rejected ${JSON.stringify(result.issues)}`);
  return result.state;
};
const guided = (code: string, variant: VipVariant = 'expedite') => {
  let s = value(startVipSession({ sessionCode: code, difficulty: 'normal', speed: 3, variant }, 0));
  s = sessionCommand(s, 0, { kind: 'set-pause', reason: 'instruction', active: false });
  s = sessionCommand(s, 0, { kind: 'move', orderKey: 'order-1', to: 'prep' });
  return sessionCommand(s, 0, { kind: 'set-pause', reason: 'guide', active: false });
};
const pairFor = (before: FinalRunSnapshot, after: FinalRunSnapshot): PairSpec => ({
  pairId: 'stress-pair', baselineRunId: before.runId, subjectRunId: after.runId, requestedBasis: 'matched',
  change: { dimensionId: 'vip-service', version: 'v1', beforeVariantId: 'fifo', afterVariantId: 'expedite' },
});
const compare = (before: FinalRunSnapshot, after: FinalRunSnapshot) => assessComparison({ schema: 'sof-archive/v1', runs: [before, after] }, pairFor(before, after));
const readyVipBox = (rig: Rig, n = 13, arrival = 10000) => {
  rig.at(arrival).admit(n).move(n, 'prep');
  rig.at(arrival + 30000).move(n, 'oven');
  rig.at(arrival + 70000).move(n, 'boxDeliver');
  return rig;
};

type LatencyRow = {
  stressId: string; runId: string; variant: VipVariant; orderKey: string; serviceClass: 'normal' | 'vip';
  expected: Record<string, number>; observed: Record<string, number>;
  assertion: string;
};
const latencyRows: LatencyRow[] = [];
function latency(stressId: string, rig: Rig, n: number, arrivalToServedSimMs: number, ordersToServedSimMs: number) {
  const ticket = rig.ticket(n), spec = rig.engine.config.manifest.orders[n - 1];
  eq(ticket.status, 'served');
  const admitted = ticket.admittedAtMs!, exited = ticket.exitedAtMs!;
  const sampledAdmission = rig.admissionWall.get(key(n)), sampledService = rig.serviceWall.get(key(n));
  check(sampledAdmission !== undefined && sampledService !== undefined, 'actual accepted command wall timestamps available');
  const expected = {
    arrivalToServedSimMs, ordersToServedSimMs, externalWaitingSimMs: arrivalToServedSimMs - ordersToServedSimMs,
    arrivalToServedWallSeconds: arrivalToServedSimMs / 3000,
    ordersToServedWallSeconds: ordersToServedSimMs / 3000,
  };
  const observed = {
    arrivalToServedSimMs: exited - spec.availableAtMs, ordersToServedSimMs: exited - admitted,
    externalWaitingSimMs: admitted - spec.availableAtMs,
    // All latency fixtures are uninterrupted; the external boundary is independently tested by S01.
    arrivalToServedWallSeconds: (sampledService - wallFor(spec.availableAtMs)) / 1e6,
    ordersToServedWallSeconds: (sampledService - sampledAdmission) / 1e6,
    arrivalBoundaryWallUs: wallFor(spec.availableAtMs), admissionWallUs: sampledAdmission, servedWallUs: sampledService,
  };
  subset(observed, { arrivalToServedSimMs, ordersToServedSimMs, externalWaitingSimMs: expected.externalWaitingSimMs });
  near(observed.arrivalToServedWallSeconds, expected.arrivalToServedWallSeconds, 0.0000011, 'arrival-to-served wall latency');
  near(observed.ordersToServedWallSeconds, expected.ordersToServedWallSeconds, 0.0000011, 'admission-to-served wall latency');
  latencyRows.push({ stressId, runId: rig.id, variant: rig.variant, orderKey: key(n), serviceClass: spec.serviceClass === 'vip' ? 'vip' : 'normal', expected, observed,
    assertion: 'Exact simulated elapsed timestamps; observed virtual-wall command latency within 1.1µs of ideal 3× mapping.' });
}

type Case = { id: string; name: string; checklist: string[]; note: string; run: () => unknown };
const cases: Case[] = [
  {
    id: 'S01', name: '3× arrival/deadline/horizon integer-wall boundaries, both policies', checklist: ['E1'],
    note: 'Also B2/A5/B6: expiry is externally anchored; no automatic admission. Ceiling-to-integer-wall samples are within 1µs of ideal.',
    run() {
      const runs = [];
      for (const variant of ['fifo', 'expedite'] as const) {
        const r = new Rig(`boundary-${variant}`, variant);
        eq(r.engine.config.manifest.orders.slice(12).map(o => [o.availableAtMs, o.deadlineAtMs]), [[10000, 100000], [90000, 180000], [170000, 260000]]);
        const schedule = [
          { at: 10000, n: 13, kind: 'arrival' }, { at: 90000, n: 14, kind: 'arrival' },
          { at: 100000, n: 13, kind: 'deadline' }, { at: 170000, n: 15, kind: 'arrival' },
          { at: 180000, n: 14, kind: 'deadline' }, { at: 260000, n: 15, kind: 'deadline' },
        ];
        const landmarks = [];
        let expired = 0;
        for (const event of schedule) {
          r.sampleUs(wallFor(event.at) - 1);
          eq(r.engine.nowMs, event.at - 1);
          if (event.kind === 'arrival') eq(r.ticket(event.n).status, 'scheduled');
          r.sampleUs(wallFor(event.at)); eq(r.engine.nowMs, event.at);
          const observedBoundaryWallUs = r.driver.lastWallUs!;
          near(observedBoundaryWallUs / 1e6, event.at / 3000, 0.0000011, 'actual wall boundary versus ideal 3× mapping');
          if (event.kind === 'arrival') {
            eq(r.ticket(event.n).status, 'external');
            const emitted = r.engine.events.filter(e => e.kind === 'arrival' && e.orderKey === key(event.n));
            eq(emitted.map(e => e.atMs), [event.at]); eq(r.arrivalWall.get(key(event.n)), wallFor(event.at));
          } else {
            subset(r.result(), { deadlinePenaltyCount: expired, vipLate: expired });
            r.at(event.at + 1); expired++;
            subset(r.result(), { deadlinePenaltyCount: expired, vipLate: expired });
          }
          check(r.driver.remainderUs >= 0 && r.driver.remainderUs < 1000, 'bounded fractional carry');
          landmarks.push({ orderKey: key(event.n), kind: event.kind, simMs: event.at, expectedWallSeconds: event.at / 3000, observedBoundaryWallUs });
        }
        r.sampleUs(99_999_999); eq(r.engine.nowMs, 299999); eq(r.engine.ended, null);
        r.sampleUs(100_000_000); eq(r.engine.nowMs, 300000); eq(r.engine.ended, 'horizon');
        const observedHorizonWallUs = r.driver.lastWallUs!; eq(observedHorizonWallUs, 100_000_000);
        eq(r.engine.events.filter(e => e.kind === 'runEnded').length, 1);
        subset(r.result(), { vipLate: 3, deadlinePenaltyCount: 3, vipServedN: 0, score: -6 });
        check(r.engine.tickets.every(t => t.admittedAtMs === null), 'samples never auto-admit');
        const final = r.engine; r.sampleUs(150_000_000); check(r.engine === final, 'ended sample cannot advance/catch up');
        runs.push({ variant, landmarks, horizon: { expectedSimMs: 300000, observedSimMs: r.engine.nowMs, expectedWallSeconds: 100, observedWallUs: observedHorizonWallUs } });
      }
      return runs;
    },
  },
  {
    id: 'S02', name: 'Guided start and nested pause owners freeze active VIP timers without catch-up', checklist: ['F1', 'F2', 'F3', 'F5'],
    note: 'Tests session ownership/timing and abandonment only; dialog focus and visibility UX require browser/manual checks.',
    run() {
      let s = value(startVipSession({ sessionCode: 'pause3x', difficulty: 'normal', speed: 3, variant: 'expedite' }, 0));
      eq(s.engine.config.initialSpeed, 3);
      s = sessionSample(s, 5_000_000); eq(s.engine.nowMs, 0); eq(s.engine.pausedBy, ['instruction', 'guide']);
      s = sessionCommand(s, 10_000_000, { kind: 'set-pause', reason: 'instruction', active: false });
      s = sessionSample(s, 20_000_000); eq(s.engine.nowMs, 0);
      const guidePending = commandIndependentSession(s, sessionToken(s), 25_000_000, { kind: 'set-pause', reason: 'guide', active: false });
      eq(guidePending.accepted, false); eq(guidePending.issues[0]?.code, 'GUIDE_PENDING'); check(guidePending.state === s, 'pending guide rollback');
      s = sessionCommand(s, 25_000_000, { kind: 'move', orderKey: 'order-1', to: 'prep' });
      s = sessionCommand(s, 30_000_000, { kind: 'set-pause', reason: 'guide', active: false });
      eq(s.engine.nowMs, 0); eq(s.engine.guide, 'complete');
      // The guide is closed deliberately so it cannot burn during this isolated VIP pause diagnostic.
      s = sessionCommand(s, 30_000_000, { kind: 'discard', orderKey: 'order-1' });
      const at10 = 30_000_000 + wallFor(10000), at40 = 30_000_000 + wallFor(40000);
      s = sessionCommand(s, at10, { kind: 'admit', orderKey: 'order-13' });
      s = sessionCommand(s, at10, { kind: 'move', orderKey: 'order-13', to: 'prep' });
      s = sessionCommand(s, at40, { kind: 'move', orderKey: 'order-13', to: 'oven' });
      eq(s.engine.nowMs, 40000);
      s = sessionCommand(s, at40, { kind: 'set-pause', reason: 'help', active: true });
      const frozen = {
        nowMs: s.engine.nowMs, vip: s.engine.tickets[12], remainderUs: s.driver.remainderUs,
        readyBurnEvents: s.engine.events.filter(e => e.kind === 'ready' || e.kind === 'discard'),
      };
      s = sessionCommand(s, 50_000_000, { kind: 'set-pause', reason: 'facilitator', active: true });
      s = sessionCommand(s, 60_000_000, { kind: 'set-pause', reason: 'hidden', active: true });
      s = sessionCommand(s, 70_000_000, { kind: 'set-pause', reason: 'exit-confirmation', active: true });
      s = sessionSample(s, 200_000_000);
      s = sessionCommand(s, 210_000_000, { kind: 'set-pause', reason: 'help', active: false });
      eq(s.engine.pausedBy, ['facilitator', 'exit-confirmation', 'hidden']);
      s = sessionCommand(s, 220_000_000, { kind: 'set-pause', reason: 'facilitator', active: false });
      eq(s.engine.pausedBy, ['exit-confirmation', 'hidden']);
      s = sessionCommand(s, 230_000_000, { kind: 'set-pause', reason: 'hidden', active: false });
      eq(s.engine.pausedBy, ['exit-confirmation']);
      s = sessionCommand(s, 240_000_000, { kind: 'set-pause', reason: 'exit-confirmation', active: false });
      eq({ nowMs: s.engine.nowMs, vip: s.engine.tickets[12], remainderUs: s.driver.remainderUs,
        readyBurnEvents: s.engine.events.filter(e => e.kind === 'ready' || e.kind === 'discard') }, frozen);
      eq(s.snapshot, null); eq(s.archive.runs.length, 0); eq(s.engine.pausedBy, []);
      const before = s; const stale = sampleIndependentSession(s, { ...sessionToken(s), revision: s.revision - 1 }, 241_000_000);
      eq(stale.accepted, false); eq(stale.issues[0]?.code, 'STALE_SESSION'); check(stale.state === before, 'stale callback unchanged');
      s = sessionSample(s, 241_000_000); eq(s.engine.nowMs, 43000); eq(s.engine.tickets[12].status, 'active');
      eq(s.engine.tickets[12].ovenReadyAtMs, 80000); eq(s.engine.tickets[12].burnAtMs, 95000);
      s = sessionCommand(s, 241_000_000, { kind: 'set-pause', reason: 'exit-confirmation', active: true });
      const abandoned = abandonIndependentSession(s, sessionToken(s), 'confirmed-exit');
      eq(abandoned.accepted, true); eq(abandoned.state.status, 'abandoned'); eq(abandoned.state.snapshot, null);
      eq(abandoned.state.archive.runs.length, 0); eq(abandoned.state.engine.events.some(e => e.kind === 'runEnded'), false);
      return { guidedWallDiscardedUs: 30_000_000, frozenSimMs: frozen.nowMs, resumedSimMs: s.engine.nowMs,
        pausedBeyondUninterruptedHorizon: true, actualNextWallSecondAddsSimMs: 3000, burnAtMs: s.engine.tickets[12].burnAtMs, abandonmentFinalized: false };
    },
  },
  {
    id: 'S03', name: 'No-congestion three-VIP service with genuine 70s / 23.333s measured latency', checklist: ['D6', 'E1'],
    note: 'Also B4: feasible commanded path, not an assertion about human play or policy benefit.',
    run() {
      const r = new Rig('clean-expedite'); r.admit(1).move(1, 'prep');
      r.at(10000).admit(13).move(13, 'prep');
      r.reject({ kind: 'move', orderKey: 'order-13', to: 'oven' }, 'NOT_READY');
      r.at(30000).move(1, 'oven'); r.at(40000).move(13, 'oven');
      r.reject({ kind: 'move', orderKey: 'order-13', to: 'boxDeliver' }, 'NOT_READY');
      r.at(70000).move(1, 'boxDeliver').move(1, 'served');
      r.at(80000).move(13, 'boxDeliver').move(13, 'served');
      latency('S03', r, 1, 70000, 70000); latency('S03', r, 13, 70000, 70000);
      for (const [n, arrival] of [[14, 90000], [15, 170000]]) {
        readyVipBox(r, n, arrival).move(n, 'served'); latency('S03', r, n, 70000, 70000);
      }
      const snapshot = r.finish(300000), measured = value(measureVipResults(snapshot));
      subset(measured, { vipOnTime: 3, vipLate: 0, vipPending: 0, vipNotYetArrived: 0, vipBurnt: 0,
        vipServedN: 3, normalServedN: 1, vipMeanArrivalToServedMs: 70000, normalMeanOrdersToServedMs: 70000,
        normalWaitedDuringVipCount: 0, deadlinePenaltyCount: 0, score: 7 });
      eq(snapshot.metrics.servedSample.n, 4); eq(snapshot.metrics.servedSample.meanSimMs, 70000);
      return { measured, servedAtSimMs: [80000, 160000, 240000], actualVirtualWallUs: r.wallUs, wallSamples: r.wallSamples };
    },
  },
  {
    id: 'S04', name: 'External waiting versus Orders latency; equal FIFO/expedite observations allowed', checklist: ['E1', 'D7'],
    note: 'Also C4/C5: equality is measured; externally waiting is excluded from Orders-to-served. No causal winner claim.',
    run() {
      const r = new Rig('normal-external-wait');
      r.at(10000).admit(13).move(13, 'prep'); r.at(20000).admit(1).move(1, 'prep');
      r.at(40000).move(13, 'oven'); r.at(50000).move(1, 'oven');
      r.at(80000).move(13, 'boxDeliver').move(13, 'served'); r.at(90000).move(1, 'boxDeliver').move(1, 'served');
      latency('S04', r, 1, 90000, 70000); latency('S04', r, 13, 70000, 70000);
      subset(r.result(), { normalMeanArrivalToServedMs: 90000, normalMeanOrdersToServedMs: 70000, normalServedN: 1, normalWaitedDuringVipCount: 0 });
      const snapshots: FinalRunSnapshot[] = [];
      const observations = [];
      for (const variant of ['fifo', 'expedite'] as const) {
        const equal = new Rig(`equal-${variant}`, variant);
        equal.at(10000);
        if (variant === 'fifo') equal.reject({ kind: 'admit', orderKey: 'order-13' }, 'FIFO');
        // Identical deliberate normal closures and delayed admission, no fabricated arrivals/services.
        for (let n = 1; n <= 12; n++) equal.admit(n).discard(n);
        equal.at(20000).admit(13).move(13, 'prep'); equal.at(50000).move(13, 'oven');
        equal.at(90000).move(13, 'boxDeliver').move(13, 'served');
        latency('S04', equal, 13, 80000, 70000);
        const snapshot = equal.finish(300000); snapshots.push(snapshot);
        const measured = value(measureVipResults(snapshot));
        subset(measured, { vipMeanArrivalToServedMs: 80000, vipServedN: 1, vipOnTime: 1, vipLate: 2, normalServedN: 0, score: 0, deadlinePenaltyCount: 2 });
        observations.push({ variant, measured });
      }
      eq(observations[0].measured, observations[1].measured);
      const matching = compare(snapshots[0], snapshots[1]); eq(matching.kind, 'matched'); eq(matching.issues, []); eq(matching.humanPlay, 'not-established');
      return { normal: r.result(), equalityPair: observations, matching };
    },
  },
  {
    id: 'S05', name: 'Orders fifth place is VIP-only; normal cannot inherit the exception', checklist: ['D1'],
    note: 'Checks actual occupancy and immutable rejection, not CSS/labels.',
    run() {
      const r = new Rig('orders-extra'); for (let n = 1; n <= 4; n++) r.admit(n);
      r.at(10000).reject({ kind: 'admit', orderKey: 'order-5' }, 'CAPACITY').admit(13);
      eq(r.occupancy('orderQueue'), 5);
      eq(value(readVipActivity(r.engine)).exceptions, [{ station: 'orderQueue', orderKey: 'order-13', occupancy: 5, ordinaryLimit: 4 }]);
      r.reject({ kind: 'admit', orderKey: 'order-5' }, 'CAPACITY');
      r.discard(1); eq(r.occupancy('orderQueue'), 4); eq(value(readVipActivity(r.engine)).exceptions, []);
      r.reject({ kind: 'admit', orderKey: 'order-5' }, 'CAPACITY');
      r.move(13, 'prep'); r.admit(5); eq(r.occupancy('orderQueue'), 4);
      const f = new Rig('fifo-orders-cap', 'fifo'); for (let n = 1; n <= 4; n++) f.admit(n);
      f.at(10000).reject({ kind: 'admit', orderKey: 'order-5' }, 'CAPACITY'); eq(f.occupancy('orderQueue'), 4);
      r.finish(); f.finish();
      return { expeditePeakOrders: 5, fifoOrders: f.occupancy('orderQueue'), observedExceptionCleared: value(readVipActivity(r.engine)).exceptions.length === 0 };
    },
  },
  {
    id: 'S06', name: 'Prep 2 and Oven 3 are hard limits; premature/skip moves rejected', checklist: ['D2', 'D3', 'D6'],
    note: 'Legal planned schedules create both full lanes; neither test is a skipped setup.',
    run() {
      const p = new Rig('prep-hard'); p.admit(1).move(1, 'prep').admit(2).move(2, 'prep');
      p.at(10000).admit(13); eq(p.occupancy('prep'), 2);
      p.reject({ kind: 'move', orderKey: 'order-13', to: 'prep' }, 'CAPACITY');
      p.reject({ kind: 'move', orderKey: 'order-13', to: 'oven' }, 'INVALID_MOVE');
      p.at(30000).move(1, 'oven').move(13, 'prep'); eq(p.occupancy('prep'), 2);
      p.reject({ kind: 'move', orderKey: 'order-13', to: 'oven' }, 'NOT_READY'); p.finish();
      const o = new Rig('oven-hard'); o.admit(1).admit(2).admit(3).move(1, 'prep').move(3, 'prep');
      o.at(60000).move(1, 'oven').move(3, 'oven').move(2, 'prep').admit(13).move(13, 'prep');
      o.at(90000).move(2, 'oven'); eq(o.occupancy('oven'), 3); eq(o.ticket(13).ready, true);
      o.reject({ kind: 'move', orderKey: 'order-13', to: 'oven' }, 'CAPACITY'); eq(o.ticket(13).station, 'prep');
      o.at(100000).move(1, 'boxDeliver').move(13, 'oven'); eq(o.occupancy('oven'), 3); o.finish();
      return { observedPrepMaximum: 2, observedOvenMaximum: 3, vipAdmittedAtMs: o.ticket(13).admittedAtMs, vipOvenEntryMs: 100000 };
    },
  },
  {
    id: 'S07', name: 'Third Box place is VIP-only, not ordinary inherited capacity', checklist: ['D4'],
    note: 'Two independent full-lane legal setups verify positive and negative claims.',
    run() {
      const v = new Rig('vip-box-extra'); v.admit(1).move(1, 'prep').admit(2).move(2, 'prep');
      v.at(30000).move(1, 'oven').move(2, 'oven').admit(13).move(13, 'prep');
      v.at(60000).move(13, 'oven'); v.at(70000).move(1, 'boxDeliver').move(2, 'boxDeliver');
      v.at(100000).move(13, 'boxDeliver'); eq(v.occupancy('boxDeliver'), 3);
      eq(value(readVipActivity(v.engine)).exceptions, [{ station: 'boxDeliver', orderKey: 'order-13', occupancy: 3, ordinaryLimit: 2 }]);
      eq(v.ticket(13).status, 'active'); v.move(13, 'served'); eq(v.occupancy('boxDeliver'), 2);
      eq(value(readVipActivity(v.engine)), { activeVipOrderKey: null, exceptions: [] });
      latency('S07', v, 13, 90000, 70000); v.finish();
      const n = new Rig('normal-box-block'); n.admit(1).admit(2).admit(3).move(1, 'prep').move(3, 'prep');
      n.at(60000).move(1, 'oven').move(3, 'oven').move(2, 'prep').admit(13);
      n.at(90000).move(2, 'oven'); n.at(100000).move(1, 'boxDeliver'); n.at(120000).move(3, 'boxDeliver');
      n.at(130000).reject({ kind: 'move', orderKey: 'order-2', to: 'boxDeliver' }, 'CAPACITY');
      eq(value(readVipActivity(n.engine)), { activeVipOrderKey: 'order-13', exceptions: [] });
      n.move(1, 'served').move(2, 'boxDeliver'); eq(n.occupancy('boxDeliver'), 2); n.finish();
      return { observedVipBoxPeak: 3, observedOrdinaryBoxLimit: 2, exceptionAfterVipService: value(readVipActivity(v.engine)).exceptions };
    },
  },
  {
    id: 'S08', name: 'One global active VIP remains locked after deadline; all closure modes release', checklist: ['D5', 'E1'],
    note: 'Manual discard, late service and burn are separate real command paths. FIFO has no active-token constraint.',
    run() {
      const closures = [];
      for (const closure of ['manual', 'service', 'burn'] as const) {
        const r = new Rig(`token-${closure}`);
        if (closure === 'service') readyVipBox(r);
        else {
          r.at(10000).admit(13);
          if (closure === 'burn') { r.at(40000).move(13, 'prep'); r.at(70000).move(13, 'oven'); }
        }
        r.at(100001); eq(r.ticket(13).status, 'active');
        r.reject({ kind: 'admit', orderKey: 'order-14' }, 'VIP_TOKEN');
        eq(value(readVipActivity(r.engine)).activeVipOrderKey, 'order-13');
        if (closure === 'manual') r.discard(13);
        else if (closure === 'service') { r.at(110000).move(13, 'served'); latency('S08', r, 13, 100000, 100000); }
        else { r.at(124999); eq(r.ticket(13).status, 'active'); r.at(125000); eq(r.ticket(13).status, 'burnt'); }
        eq(value(readVipActivity(r.engine)).activeVipOrderKey, null); r.admit(14);
        eq(value(readVipActivity(r.engine)).activeVipOrderKey, 'order-14');
        eq(r.engine.tickets.filter(t => t.status === 'active' && t.orderKey.startsWith('order-1') && Number(t.orderKey.slice(6)) >= 13).length, 1);
        closures.push({ closure, releaseSimMs: r.engine.nowMs, ticket13Status: r.ticket(13).status }); r.finish();
      }
      const f = new Rig('fifo-no-token', 'fifo'); f.at(170000);
      for (let n = 1; n <= 12; n++) f.admit(n).discard(n);
      f.admit(13).admit(14).admit(15); eq(f.occupancy('orderQueue'), 3); eq(value(readVipActivity(f.engine)).activeVipOrderKey, null); f.finish();
      return { closures, fifoSimultaneousActiveVips: 3 };
    },
  },
  {
    id: 'S09', name: 'E2 late service charged once across repeated overdue wall samples', checklist: ['E2', 'D6'],
    note: 'VIP moves safely to Box before burning, then is served late at 110s; observation ends before second deadline.',
    run() {
      const r = readyVipBox(new Rig('late-service'));
      r.at(100000); subset(r.result(), { vipLate: 0, deadlinePenaltyCount: 0, score: 0 });
      for (const at of [100001, 101000, 105000, 110000]) {
        r.at(at); subset(r.result(), { vipLate: 1, vipServedN: 0, deadlinePenaltyCount: 1, score: -2 });
      }
      r.move(13, 'served').reject({ kind: 'move', orderKey: 'order-13', to: 'served' }, 'NOT_ACTIVE');
      latency('S09', r, 13, 100000, 100000);
      const final = r.finish(120000), measured = value(measureVipResults(final));
      subset(measured, { vipOnTime: 0, vipLate: 1, vipServedN: 1, vipPending: 1, vipNotYetArrived: 1,
        vipBurnt: 0, deadlinePenaltyCount: 1, score: 2, vipMeanArrivalToServedMs: 100000 });
      eq(final.metrics.angry, 0); eq(final.history.events.filter(e => e.kind === 'service' && e.orderKey === 'order-13').length, 1);
      eq(final.history.events.some(e => e.kind === 'anger'), false);
      return measured;
    },
  },
  {
    id: 'S10', name: 'E3 exact 10→40→70→110→125 late-then-burn replacement schedule', checklist: ['E3', 'E1'],
    note: 'Orders hold is a deliberate command delay, not an invented fixture dependency. Both preburn and final scores asserted.',
    run() {
      const r = new Rig('late-then-burn'); r.at(10000).admit(13);
      eq(r.ticket(13).station, 'orderQueue'); eq(r.engine.config.manifest.orders[12].deadlineAtMs, 100000);
      r.at(40000); eq(r.ticket(13).station, 'orderQueue'); r.move(13, 'prep'); eq(r.ticket(13).prepReadyAtMs, 70000);
      r.at(69999); eq(r.ticket(13).ready, false); r.at(70000); eq(r.ticket(13).ready, true); r.move(13, 'oven');
      eq(r.ticket(13).ovenReadyAtMs, 110000); eq(r.ticket(13).burnAtMs, 125000);
      r.at(100000); subset(r.result(), { vipLate: 0, deadlinePenaltyCount: 0, score: 0 });
      r.at(100001); subset(r.result(), { vipLate: 1, vipBurnt: 0, deadlinePenaltyCount: 1, score: -2 });
      r.at(109999); eq(r.ticket(13).ready, false); r.at(110000); eq(r.ticket(13).ready, true);
      r.at(124999); eq(r.ticket(13).status, 'active'); r.at(125000); eq(r.ticket(13).status, 'burnt');
      const final = r.finish(130000), measured = value(measureVipResults(final));
      subset(measured, { vipBurnt: 1, vipLate: 0, deadlinePenaltyCount: 0, score: -2, vipServedN: 0, vipMeanArrivalToServedMs: null });
      subset(final.metrics, { burnt: 1, angry: 0, served: 0, score: -2 });
      eq(final.history.events.filter(e => e.kind === 'discard' && e.reason === 'burnt').map(e => e.atMs), [125000]);
      eq(final.history.events.flatMap(e => e.kind === 'ready' && e.orderKey === 'order-13' ? [[e.station, e.atMs]] : []), [['prep', 70000], ['oven', 110000]]);
      eq(final.history.events.some(e => e.kind === 'anger'), false);
      return { admittedMs: r.ticket(13).admittedAtMs, ordersHeldUntilMs: 40000, prepReadyMs: r.ticket(13).prepReadyAtMs,
        ovenReadyMs: r.ticket(13).ovenReadyAtMs, burntMs: r.ticket(13).exitedAtMs,
        burnBoundaryWallUs: wallFor(125000), before: { deadlinePenaltyCount: 1, score: -2 }, final: measured };
    },
  },
  {
    id: 'S11', name: 'Exact deadline equality is on time; +1 simulated ms is late via 3× wall mapping', checklist: ['E1', 'E2'],
    note: 'Automated precision boundary explicitly excluded from stopwatch UAT.',
    run() {
      const observed = [];
      for (const servedAt of [100000, 100001]) {
        const r = readyVipBox(new Rig(`deadline-${servedAt}`)); r.at(servedAt).move(13, 'served');
        latency('S11', r, 13, servedAt - 10000, servedAt - 10000);
        const final = r.finish(), measured = value(measureVipResults(final)), late = servedAt === 100001;
        subset(measured, { vipOnTime: late ? 0 : 1, vipLate: late ? 1 : 0, vipServedN: 1,
          vipBurnt: 0, vipMeanArrivalToServedMs: servedAt - 10000, deadlinePenaltyCount: late ? 1 : 0, score: late ? 2 : 4 });
        eq(final.metrics.angry, 0);
        observed.push({ expectedServedSimMs: servedAt, observedServedSimMs: r.ticket(13).exitedAtMs, observedServiceWallUs: r.serviceWall.get('order-13'), measured });
      }
      eq(wallFor(100001) - wallFor(100000), 333);
      return observed;
    },
  },
  {
    id: 'S12', name: 'Waiting overlap distinctions; null/N/A, manual-stop unmatched and immutable session archive', checklist: ['D7', 'E4', 'F5'],
    note: 'Also C4/C6: null is the data-level N/A contract. Actual text/focus/CSS and reload behavior are owned by browser/manual tests.',
    run() {
      const orders = new Rig('wait-orders'); orders.admit(1).move(1, 'prep').admit(2);
      orders.at(10000).admit(13).move(13, 'prep'); orders.at(20000).discard(13);
      eq(orders.result().normalWaitedDuringVipCount, 1); // Normal 2 waits, Normal 1 processing does not; external others do not.
      const ready = new Rig('wait-ready'); ready.admit(1).move(1, 'prep'); ready.at(35000).admit(13); ready.at(36000);
      eq(ready.result().normalWaitedDuringVipCount, 1);
      const box = new Rig('wait-box'); box.admit(1).move(1, 'prep'); box.at(30000).move(1, 'oven'); box.at(70000).move(1, 'boxDeliver');
      box.at(80000).admit(13); box.at(81000); eq(box.result().normalWaitedDuringVipCount, 1);
      const zero = new Rig('wait-zero'); zero.admit(1); zero.at(10000).admit(13).discard(13); eq(zero.result().normalWaitedDuringVipCount, 0);
      const sessions = (['fifo', 'expedite'] as const).map(variant => {
        let s = guided(`empty-${variant}`, variant);
        s = sessionCommand(s, 1_000_000, { kind: 'end', reason: 'manual-stop' });
        eq(s.status, 'final'); check(s.snapshot !== null, 'final session snapshot');
        eq(s.snapshot.observation.durationMs, 3000); eq(s.snapshot.endReason, 'manual-stop');
        const result = value(measureVipResults(s.snapshot));
        subset(result, { score: 0, vipNotYetArrived: 3, vipServedN: 0, normalServedN: 0,
          vipMeanArrivalToServedMs: null, normalMeanArrivalToServedMs: null, normalMeanOrdersToServedMs: null });
        eq(s.snapshot.metrics.servedSample, { definition: SERVED_DEFINITION, n: 0, sumSimMs: 0, meanSimMs: null });
        eq(hasServedSamples(s.snapshot.metrics.servedSample.n), false);
        eq(s.measured?.measuredOrdersToServedSimSec, null); eq(s.measured?.measuredServedSampleCount, 0);
        eq(s.archive.runs.length, 1); return s;
      });
      const manual = compare(sessions[0].snapshot!, sessions[1].snapshot!);
      eq(manual.kind, 'unmatched'); check(manual.issues.includes('MANUAL_END_NOT_MATCHABLE'), 'equal manual end cannot match');
      const old = sessions[0], before = JSON.stringify(old.archive);
      check(Object.isFrozen(old.archive) && Object.isFrozen(old.archive.runs) && Object.isFrozen(old.archive.runs[0].history.events[0]), 'deep-frozen archive');
      throws(() => (old.archive.runs as unknown as unknown[]).push({}), 'retained runs cannot mutate');
      throws(() => { (old.archive.runs[0].metrics as unknown as { score: number }).score = 999; }, 'retained metrics cannot mutate');
      const duplicate = replayVipSession(old, { sessionCode: old.sessionCode, difficulty: 'normal', speed: 3, variant: 'expedite' }, 2_000_000);
      eq(duplicate.ok, false);
      let fresh = value(replayVipSession(old, { sessionCode: 'archive-fresh', difficulty: 'normal', speed: 3, variant: 'expedite' }, 2_000_000));
      eq(fresh.attempt, 2); check(fresh.runId !== old.runId, 'fresh identity'); eq(fresh.archive.runs.length, 1);
      const stale = commandIndependentSession(fresh, sessionToken(old), 3_000_000, { kind: 'set-pause', reason: 'instruction', active: false });
      eq(stale.accepted, false); eq(stale.issues[0]?.code, 'STALE_SESSION'); check(stale.state === fresh, 'stale old-run callback unchanged');
      fresh = sessionCommand(fresh, 2_000_000, { kind: 'set-pause', reason: 'instruction', active: false });
      fresh = sessionCommand(fresh, 2_000_000, { kind: 'move', orderKey: 'order-1', to: 'prep' });
      fresh = sessionCommand(fresh, 2_000_000, { kind: 'set-pause', reason: 'guide', active: false });
      fresh = sessionCommand(fresh, 3_000_000, { kind: 'end', reason: 'manual-stop' });
      eq(fresh.archive.runs.length, 2); eq(JSON.stringify(old.archive), before); eq(JSON.stringify(fresh.archive.runs[0]), JSON.stringify(old.archive.runs[0]));
      return { waiting: { ordersPositive: 1, readyPositive: 1, boxPositive: 1, zeroTime: 0, processingAndExternalExcluded: true },
        emptyMeans: { vip: null, normalArrival: null, normalOrders: null, servedN: 0, displayContract: 'N/A, not zero' },
        manualAssessment: manual, priorArchiveUnchanged: true, freshArchiveRunCount: fresh.archive.runs.length };
    },
  },
];

const start = performance.now();
const results = cases.map(test => {
  const before = assertionCount, begun = performance.now();
  try {
    const observed = test.run();
    return { id: test.id, name: test.name, checklist: test.checklist, note: test.note, status: 'passed',
      assertions: assertionCount - before, runtimeMs: Math.round((performance.now() - begun) * 1000) / 1000, observed };
  } catch (error) {
    return { id: test.id, name: test.name, checklist: test.checklist, note: test.note, status: 'failed',
      assertions: assertionCount - before, runtimeMs: Math.round((performance.now() - begun) * 1000) / 1000,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) } };
  }
});
const failed = results.filter(test => test.status === 'failed');
const output = resolve(process.env.SOF_STRESS_OUTPUT || 'test-results/round3-3x/stress.json');
const report = {
  schema: 'sof-round3-3x-stress/v1', status: failed.length ? 'failed' : 'passed',
  settings: { difficulty: 'normal', initialSpeed: 3, clock: 'virtual integer wall microseconds', horizonSimMs: 300000, uninterruptedHorizonWallSeconds: 100 },
  execution: { testCount: cases.length, passed: results.length - failed.length, failed: failed.length, assertionCount,
    runtimeMs: Math.round((performance.now() - start) * 1000) / 1000, output },
  safety: { boundedCases: 12, maximumEngineHorizonSimMs: 300000, realTimers: false, network: false,
    applicationPersistence: false, reportFilesystemOnly: true, productionClientChanges: false },
  latencyDefinition: { simulated: 'Actual external-arrival/admission-to-service ledger timestamps; served-only.',
    wall: 'Actual accepted admission/service command samples on uninterrupted virtual 3× clock; external wall boundary = ceil(arrivalSimMs*1000/3).',
    toleranceSeconds: 0.0000011, noSamples: 'null / N/A, never zero', causalClaim: 'None. Waiting is observed positive-time overlap, not proven VIP displacement.' },
  checklistCoverage: {
    D: 'D1–D7 engine data/command contracts covered; keyboard, focus, labels and UI affordances are not exercised.',
    E: 'E1–E4 exact external deadlines, late service, late→burn replacement and empty/manual-end contracts covered.',
    F: 'F1–F3 and F5 owned pause/hidden/exit lifecycle contracts covered. F4 score visibility is UI-only and not covered here.',
  },
  caveats: [
    'These are synthetic legal command schedules, not human play, browser timing, rendering or tablet/Safari evidence.',
    'No-congestion VIP latency is feasible, not a promised human outcome. An intentionally equal FIFO/expedite pair is also asserted.',
    'Driver deadlines are classified from observed external-arrival time; they do not generate a separate deadline-expiry event.',
    'Null/N/A is checked at the data contract; actual rendered N/A strings and hidden-score controls remain browser responsibilities.',
    'Stress manual observations are intentionally unmatched; only the separate equal full-horizon canonical pair is matched.',
  ],
  tests: results, latencyRows,
};
try {
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, tests: cases.length, passed: results.length - failed.length, failed: failed.length,
    assertions: assertionCount, measuredLatencyRows: latencyRows.length, report: output, runtimeMs: report.execution.runtimeMs }));
  for (const test of failed) console.error(`${test.id} ${test.name}\n${test.error?.stack || test.error?.message}`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  console.error(`Failed writing stress report ${output}`, error); process.exitCode = 1;
}
