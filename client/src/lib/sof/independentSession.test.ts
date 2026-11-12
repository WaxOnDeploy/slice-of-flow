import { beforeAll, describe, expect, it, vi } from 'vitest';
import { validateSnapshot } from '../sofEngine/runSnapshots';
import { makeFixedDeckConfig } from '../sofEngine/scenario';
import { makeVipConfig, measureVipResults } from '../sofEngine/vip';
import { equivalent, type Checked } from '../sofEngine/types';
import {
  abandonIndependentSession, commandIndependentSession, exitConfirmationCommand, facilitatorCommand,
  integerWallUs, replayIndependentSession, sampleIndependentSession, sessionToken,
  startIndependentSession, startVipSession, replayVipSession, visibilityCommand, type IndependentSession,
} from './independentSession';
let useSliceOfFlowStore: typeof import('../sliceOfFlowStore').useSliceOfFlowStore;
beforeAll(async () => {
  vi.stubGlobal('window', {});
  useSliceOfFlowStore = (await import('../sliceOfFlowStore')).useSliceOfFlowStore;
});
const value = <T,>(r: Checked<T>): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const start = (code = 'labA', speed: 1 | 2 | 3 = 1) => value(startIndependentSession({ sessionCode: code, difficulty: 'normal', speed }, 0));
const command = (s: IndependentSession, c: unknown, wall = s.driver.lastWallUs ?? 0) => commandIndependentSession(s, sessionToken(s), wall, c);
function running(speed: 1 | 2 | 3 = 1) {
  let s = start('labA', speed);
  s = command(s, { kind: 'set-pause', reason: 'instruction', active: false }).state;
  s = command(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }).state;
  return command(s, { kind: 'set-pause', reason: 'guide', active: false }).state;
}
describe('independent manual-pull session boundary', () => {
  it('builds the official fixed deck with selected settings and starts under instruction/guide', () => {
    const s = start('labA', 2);
    expect(s.engine.config).toEqual(value(makeFixedDeckConfig({ difficulty: 'normal', policy: 'manual-pull', initialSpeed: 2, guidedStart: true, endCondition: 'fixed-horizon' })));
    expect(s.engine.pausedBy).toEqual(['instruction', 'guide']);
    expect(s.engine.tickets.filter(t => t.status === 'active')).toHaveLength(1);
    expect(s.archive.runs).toHaveLength(0);
    expect(startIndependentSession({ sessionCode: 'personal space', difficulty: 'normal', speed: 1 }, 0).ok).toBe(false);
    expect(startIndependentSession({ sessionCode: 'lab', difficulty: 'normal', speed: 1, config: {} } as never, 0).ok).toBe(false);
  });
  it('rejects stale run, attempt and revision without sampling or effects', () => {
    const s = running();
    for (const token of [{ ...sessionToken(s), runId: 'old:run:1' }, { ...sessionToken(s), attempt: 0 }, { ...sessionToken(s), revision: 0 }]) {
      const r = commandIndependentSession(s, token, 1_000_000, facilitatorCommand(true));
      expect(r.accepted).toBe(false); expect(r.state).toBe(s);
      expect(sampleIndependentSession(s, token, 1_000_000).state).toBe(s);
      expect(abandonIndependentSession(s, token, 'unmount').state).toBe(s);
    }
  });
  it('permits only the sole-guide first move and rejects all other paused mutations below UI', () => {
    const s = start();
    expect(command(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }).accepted).toBe(false);
    const guide = command(s, { kind: 'set-pause', reason: 'instruction', active: false }).state;
    for (const c of [{ kind: 'admit', orderKey: 'order-2' }, { kind: 'speed', speed: 2 }, { kind: 'end', reason: 'manual-stop' }, { kind: 'move', orderKey: 'order-2', to: 'prep' }, { kind: 'set-pause', reason: 'guide', active: false }]) {
      expect(command(guide, c, 1_000_000).state).toBe(guide);
    }
    const moved = command(guide, { kind: 'move', orderKey: 'order-1', to: 'prep' }, 1_000_000);
    expect(moved.accepted).toBe(true); expect(moved.state.engine.nowMs).toBe(0);
    expect(command(moved.state, { kind: 'move', orderKey: 'order-1', to: 'oven' }).accepted).toBe(false);
    expect(command(command(guide, facilitatorCommand(true)).state, { kind: 'move', orderKey: 'order-1', to: 'prep' }).accepted).toBe(false);
  });
  it('facilitator Resume never clears instruction, guide, help, hidden, transition or exit locks', () => {
    for (const owner of ['help', 'hidden', 'transition', 'exit-confirmation'] as const) {
      let s = running(); s = command(s, { kind: 'set-pause', reason: owner, active: true }).state;
      s = command(s, facilitatorCommand(true)).state;
      s = command(s, facilitatorCommand(false)).state;
      expect(s.engine.pausedBy).toEqual([owner]);
      for (const c of [{ kind: 'admit', orderKey: 'order-2' }, { kind: 'move', orderKey: 'order-1', to: 'oven' }, { kind: 'discard', orderKey: 'order-1' }, { kind: 'speed', speed: 2 }, { kind: 'end', reason: 'manual-stop' }]) {
        const r = command(s, c, 10_000_000); expect(r.accepted).toBe(false); expect(r.state).toBe(s);
      }
      const repeated = command(s, { kind: 'set-pause', reason: owner, active: true }, 10_000_000);
      expect(repeated.state).toBe(s);
    }
    let initial = command(start(), facilitatorCommand(true)).state;
    initial = command(initial, facilitatorCommand(false)).state;
    expect(initial.engine.pausedBy).toEqual(['instruction', 'guide']);
  });
  it.each([1, 2, 3] as const)('flushes visible time before hidden pause and excludes hidden catch-up at speed %s', speed => {
    let s = running(speed);
    s = command(s, visibilityCommand(true), 2_000_000).state;
    expect(s.engine.nowMs).toBe(2000 * speed);
    s = command(s, facilitatorCommand(true), 10_000_000).state;
    s = command(s, visibilityCommand(false), 50_000_000).state;
    expect(s.engine.pausedBy).toEqual(['facilitator']); expect(s.engine.nowMs).toBe(2000 * speed);
    s = command(s, facilitatorCommand(false), 60_000_000).state;
    s = sampleIndependentSession(s, sessionToken(s), 61_000_000).state;
    expect(s.engine.nowMs).toBe(3000 * speed);
  });
  it('flushes elapsed wall under old speed before speed change and preserves remainder', () => {
    let s = running(); s = command(s, { kind: 'speed', speed: 3 }, 1_000_500).state;
    expect(s.engine.nowMs).toBe(1000); expect(s.driver.remainderUs).toBe(500);
    s = sampleIndependentSession(s, sessionToken(s), 2_000_500).state;
    expect(s.engine.nowMs).toBe(4000); expect(s.driver.remainderUs).toBe(500);
  });
  it('rolls invalid nonterminal command back atomically including driver and ledger', () => {
    const s = running();
    for (const c of [{ kind: 'move', orderKey: 'order-1', to: 'oven' }, { kind: 'admit', orderKey: 'unknown' }, { kind: 'manual-next' }, { kind: 'speed', speed: 9 }]) {
      expect(command(s, c, 2_000_000).state).toBe(s);
    }
    expect(sampleIndependentSession(s, sessionToken(s), 2_000_000).state.engine.nowMs).toBe(2000);
    expect(command(s, facilitatorCommand(true), -1).state).toBe(s);
  });
  it('enforces official FIFO, readiness, and capacity without partial admission', () => {
    let s = running();
    expect(command(s, { kind: 'admit', orderKey: 'order-3' }).issues[0].code).toBe('FIFO');
    for (const n of [2, 3, 4, 5]) s = command(s, { kind: 'admit', orderKey: `order-${n}` }).state;
    const full = command(s, { kind: 'admit', orderKey: 'order-6' });
    expect(full.issues[0].code).toBe('CAPACITY'); expect(full.state).toBe(s);
    s = command(s, { kind: 'move', orderKey: 'order-2', to: 'prep' }).state;
    const prepFull = command(s, { kind: 'move', orderKey: 'order-3', to: 'prep' });
    expect(prepFull.issues[0].code).toBe('CAPACITY'); expect(prepFull.state).toBe(s);
    expect(command(s, { kind: 'move', orderKey: 'order-1', to: 'oven' }).issues[0].code).toBe('NOT_READY');
  });
  it.each([{ kind: 'speed', speed: 2 }, { kind: 'end', reason: 'manual-stop' }, { kind: 'nonsense' }])('preserves sampled horizon even when the following command is rejected: %j', c => {
    const s = running(); const r = command(s, c, 250_000_000);
    expect(r.accepted).toBe(false); expect(r.state.status).toBe('final');
    expect(r.state.snapshot?.endReason).toBe('horizon'); expect(r.state.snapshot?.observation.durationMs).toBe(240000);
    expect(r.state.archive.runs).toHaveLength(1); expect(validateSnapshot(r.state.snapshot).ok).toBe(true);
    expect(r.state.measured?.averageWip).toBe(1); expect(r.state.measured?.measuredServedSampleCount).toBe(0);
    expect(command(r.state, facilitatorCommand(false), 300_000_000).state).toBe(r.state);
  });
  it('records a real manual stop at actual observed duration, including a served sample', () => {
    let s = running();
    s = command(s, { kind: 'move', orderKey: 'order-1', to: 'oven' }, 30_000_000).state;
    s = command(s, { kind: 'move', orderKey: 'order-1', to: 'boxDeliver' }, 70_000_000).state;
    s = command(s, { kind: 'move', orderKey: 'order-1', to: 'served' }, 70_000_000).state;
    s = command(s, { kind: 'end', reason: 'manual-stop' }, 80_000_000).state;
    expect(s.status).toBe('final'); expect(s.snapshot?.endReason).toBe('manual-stop');
    expect(s.snapshot?.observation.durationMs).toBe(80000);
    expect(s.measured?.areaTicketSec).toBe(70); expect(s.measured?.averageWip).toBe(0.875);
    expect(s.measured?.deliveryRatePerSimMinute).toBe(0.75);
    expect(s.measured?.measuredOrdersToServedSimSec).toBe(70); expect(s.measured?.measuredServedSampleCount).toBe(1);
  });
  it('exit cancel removes only exit ownership; confirm/unmount abandons without completion', () => {
    let s = command(running(), facilitatorCommand(true), 1_000_000).state;
    const previous = s.engine.pausedBy;
    s = command(s, exitConfirmationCommand(true), 10_000_000).state;
    expect(command(s, { kind: 'end', reason: 'manual-stop' }).state).toBe(s);
    const cancelled = command(s, exitConfirmationCommand(false), 20_000_000).state;
    expect(cancelled.engine.pausedBy).toEqual(previous); expect(cancelled.engine.nowMs).toBe(1000);
    expect(abandonIndependentSession(cancelled, sessionToken(cancelled), 'confirmed-exit').accepted).toBe(false);
    for (const [state, reason] of [[s, 'confirmed-exit'], [running(), 'unmount']] as const) {
      const abandoned = abandonIndependentSession(state, sessionToken(state), reason).state;
      expect(abandoned.status).toBe('abandoned'); expect(abandoned.draft).toBeNull();
      expect(abandoned.snapshot).toBeNull(); expect(abandoned.archive.runs).toHaveLength(0);
      expect(abandoned.engine.events.some(e => e.kind === 'runEnded')).toBe(false);
    }
  });
  it('freezes retained evidence and requires fresh session/run identities on each replay', () => {
    const final = command(running(), { kind: 'end', reason: 'manual-stop' }, 1_000_000).state;
    const old = JSON.stringify(final.archive);
    expect(Object.isFrozen(final.archive.runs[0].history.events[0])).toBe(true);
    expect(() => { (final.archive.runs as unknown as unknown[]).push({}); }).toThrow();
    expect(replayIndependentSession(final, { sessionCode: 'labA', difficulty: 'normal', speed: 1 }, 1_000_000).ok).toBe(false);
    const fresh = value(replayIndependentSession(final, { sessionCode: 'labB', difficulty: 'hard', speed: 2 }, 2_000_000));
    expect(fresh.attempt).toBe(2); expect(fresh.runId).not.toBe(final.runId); expect(fresh.sessionCode).not.toBe(final.sessionCode);
    expect(fresh.engine.tickets[0].orderId).not.toBe(final.engine.tickets[0].orderId);
    expect(commandIndependentSession(fresh, sessionToken(final), 3_000_000, facilitatorCommand(false)).state).toBe(fresh);
    expect(JSON.stringify(final.archive)).toBe(old); expect(fresh.archive.runs).toHaveLength(1);
    expect(fresh.snapshot).toBeNull(); expect(fresh.engine.pausedBy).toEqual(['instruction', 'guide']);
  });
  it('never reuses a previous abandoned session code across several attempts', () => {
    const a = abandonIndependentSession(start('abandonA'), sessionToken(start('abandonA')), 'unmount').state;
    const b = value(replayIndependentSession(a, { sessionCode: 'abandonB', difficulty: 'normal', speed: 1 }, 1000));
    const abandonedB = abandonIndependentSession(b, sessionToken(b), 'unmount').state;
    expect(replayIndependentSession(abandonedB, { sessionCode: 'abandonA', difficulty: 'normal', speed: 1 }, 2000).ok).toBe(false);
    expect(abandonedB.archive.runs).toHaveLength(0);
    expect(abandonedB.usedSessionCodes).toEqual(['abandonA', 'abandonB']);
  });
  it('never mutates the existing store during independent start/play/stop/abandon', () => {
    const before = useSliceOfFlowStore.getState(); const data = JSON.stringify(before);
    let s = running(); s = command(s, { kind: 'admit', orderKey: 'order-2' }, 1_000_000).state;
    command(s, { kind: 'end', reason: 'manual-stop' }, 2_000_000);
    abandonIndependentSession(s, sessionToken(s), 'unmount');
    expect(useSliceOfFlowStore.getState()).toBe(before); expect(JSON.stringify(before)).toBe(data);
  });
  it('projects one monotonic integer performance sample, preserving safe validation', () => {
    expect(integerWallUs(1.2349)).toBe(1234); expect(integerWallUs(1.2, 1234)).toBe(1234);
    expect(() => integerWallUs(Infinity)).toThrow(); expect(() => integerWallUs(-1)).toThrow();
    expect(equivalent(start().engine.config.manifest, running().engine.config.manifest)).toBe(true);
  });
});

const vipStart = (variant: 'fifo' | 'expedite' = 'expedite', speed: 1 | 2 | 3 = 1, code = 'vipA') => value(startVipSession({ sessionCode: code, difficulty: 'normal', speed, variant }, 0));
function vipRunning(variant: 'fifo' | 'expedite' = 'expedite', speed: 1 | 2 | 3 = 1) {
  let s = vipStart(variant, speed);
  s = command(s, { kind: 'set-pause', reason: 'instruction', active: false }).state;
  s = command(s, { kind: 'move', orderKey: 'order-1', to: 'prep' }).state;
  return command(s, { kind: 'set-pause', reason: 'guide', active: false }).state;
}
describe('VIP preview session uses the same independent lifecycle', () => {
  it.each(['fifo', 'expedite'] as const)('starts strict canonical %s settings with a normal guide and scheduled VIPs', variant => {
    const s = vipStart(variant, 2);
    expect(s.engine.config).toEqual(value(makeVipConfig({ difficulty: 'normal', variant, initialSpeed: 2, guidedStart: true })));
    expect(s.engine.pausedBy).toEqual(['instruction', 'guide']);
    expect(s.engine.tickets[0]).toMatchObject({ orderKey: 'order-1', station: 'orderQueue', status: 'active', admittedAtMs: 0 });
    expect(s.engine.tickets.slice(12).every(t => t.status === 'scheduled')).toBe(true);
    expect(s.engine.nowMs).toBe(0); expect(s.archive.runs).toHaveLength(0);
    const guide = command(s, { kind: 'set-pause', reason: 'instruction', active: false }).state;
    expect(command(guide, { kind: 'move', orderKey: 'order-13', to: 'prep' }).accepted).toBe(false);
    expect(command(guide, { kind: 'move', orderKey: 'order-1', to: 'prep' }).accepted).toBe(true);
  });
  it('keeps both start APIs exact and rejects any arbitrary configuration injection', () => {
    for (const extra of [{ config: {} }, { scenarioId: 'fixed-deck' }, { seed: 0 }, { guidedStart: false }, { endCondition: 'all-resolved-or-horizon' }]) {
      expect(startVipSession({ sessionCode: 'vip', difficulty: 'normal', speed: 1, variant: 'expedite', ...extra } as never, 0).ok).toBe(false);
    }
    expect(startVipSession({ sessionCode: 'vip', difficulty: 'normal', speed: 1 } as never, 0).ok).toBe(false);
    expect(startVipSession({ sessionCode: 'vip', difficulty: 'normal', speed: 1, variant: 'manual-pull' } as never, 0).ok).toBe(false);
    expect(startIndependentSession({ sessionCode: 'vip', difficulty: 'normal', speed: 1, variant: 'fifo' } as never, 0).ok).toBe(false);
  });
  it.each([1, 2, 3] as const)('excludes hidden time and shared owner pause under VIP speed %s', speed => {
    let s = vipRunning('expedite', speed);
    s = command(s, visibilityCommand(true), 2_000_000).state;
    expect(s.engine.nowMs).toBe(2000 * speed);
    s = command(s, facilitatorCommand(true), 50_000_000).state;
    s = command(s, visibilityCommand(false), 80_000_000).state;
    expect(s.engine.pausedBy).toEqual(['facilitator']);
    expect(s.engine.nowMs).toBe(2000 * speed);
    s = command(s, facilitatorCommand(false), 100_000_000).state;
    const sampled = sampleIndependentSession(s, sessionToken(s), 101_000_000);
    expect(sampled.accepted).toBe(true); expect(sampled.state.engine.nowMs).toBe(3000 * speed);
    expect(sampled.state.engine.tickets[12].status).toBe('scheduled');
  });
  it('samples under old speed with fractional carry and rolls back rejected VIP admissions atomically', () => {
    let s = vipRunning(); s = command(s, { kind: 'speed', speed: 3 }, 1_000_500).state;
    expect(s.engine.nowMs).toBe(1000); expect(s.driver.remainderUs).toBe(500);
    const rejected = command(s, { kind: 'admit', orderKey: 'order-14' }, 4_000_500);
    expect(rejected.accepted).toBe(false); expect(rejected.state).toBe(s);
    const sampled = sampleIndependentSession(s, sessionToken(s), 4_000_500).state;
    expect(sampled.engine.nowMs).toBe(10000); expect(sampled.driver.remainderUs).toBe(500);
    s = command(sampled, { kind: 'admit', orderKey: 'order-13' }, 4_000_500).state;
    expect(s.engine.tickets[12].status).toBe('active');
    expect(commandIndependentSession(s, sessionToken(sampled), 5_000_500, facilitatorCommand(true)).state).toBe(s);
  });
  it.each(['fifo', 'expedite'] as const)('captures the real pilot %s horizon while rejecting a coincident command', variant => {
    const r = command(vipRunning(variant), { kind: 'speed', speed: 2 }, 310_000_000);
    expect(r.accepted).toBe(false); expect(r.state.status).toBe('final');
    const s = r.state.snapshot!;
    expect(s.endReason).toBe('horizon'); expect(s.observation.durationMs).toBe(300000);
    expect(s.orders).toHaveLength(15); expect(r.state.archive.runs).toHaveLength(1);
    expect(value(measureVipResults(s))).toMatchObject({ vipLate: 3, deadlinePenaltyCount: 3, score: -6, vipServedN: 0 });
    expect(r.state.measured).toMatchObject({ averageWip: 1, servedCount: 0, externalCount: 14 });
    expect(validateSnapshot(s).ok).toBe(true); expect(r.state.engine.events.filter(e => e.kind === 'runEnded')).toHaveLength(1);
  });
  it('replays with explicit fresh code/variant and retains immutable evidence without manufacturing played frames', () => {
    const final = command(vipRunning('fifo'), { kind: 'end', reason: 'manual-stop' }, 1_000_000).state;
    const before = JSON.stringify(final.archive);
    expect(replayVipSession(vipRunning(), { sessionCode: 'vipB', difficulty: 'hard', speed: 2, variant: 'expedite' }, 0).ok).toBe(false);
    expect(replayVipSession(final, { sessionCode: 'vipA', difficulty: 'hard', speed: 2, variant: 'expedite' }, 2_000_000).ok).toBe(false);
    const fresh = value(replayVipSession(final, { sessionCode: 'vipB', difficulty: 'hard', speed: 2, variant: 'expedite' }, 2_000_000));
    expect(fresh.engine.config.policy.variantId).toBe('expedite'); expect(fresh.attempt).toBe(2); expect(fresh.snapshot).toBeNull();
    expect(fresh.engine.nowMs).toBe(0); expect(fresh.archive.runs).toHaveLength(1); expect(JSON.stringify(final.archive)).toBe(before);
    expect(fresh.engine.tickets[12].status).toBe('scheduled');
    expect(commandIndependentSession(fresh, sessionToken(final), 3_000_000, facilitatorCommand(false)).state).toBe(fresh);
    expect(Object.isFrozen(fresh.archive.runs[0].config.manifest.orders[12])).toBe(true);
  });
  it('does not change the released store or manufacture a snapshot on VIP abandonment', () => {
    const before = useSliceOfFlowStore.getState(), json = JSON.stringify(before);
    const s = vipRunning();
    const abandoned = abandonIndependentSession(s, sessionToken(s), 'unmount').state;
    expect(abandoned.status).toBe('abandoned'); expect(abandoned.snapshot).toBeNull(); expect(abandoned.archive.runs).toHaveLength(0);
    expect(abandoned.engine.events.some(e => e.kind === 'runEnded')).toBe(false);
    expect(useSliceOfFlowStore.getState()).toBe(before); expect(JSON.stringify(before)).toBe(json);
  });
});
