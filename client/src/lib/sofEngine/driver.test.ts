import { describe, expect, it } from 'vitest';
import { applyWallControl, createDriver, rebaseDriver, sampleWall } from './driver';
import { action, at, resume, start, testConfig, value } from './fixtures/testCases';
import type { Driver, DriverStep } from './types';
const anchor = (speed: 1 | 2 | 3 = 1): DriverStep => {
  const state = resume(start(testConfig({ speed, policy: 'interval-push', horizonMs: 500 })));
  return value(sampleWall(state, value(createDriver(state.runId)), 0));
};

describe('pure driver integer conversion', () => {
  it('first sample anchors without attributing elapsed time', () => {
    const state = resume(start()); const first = value(sampleWall(state, value(createDriver(state.runId)), 1000000));
    expect(first.state).toBe(state); expect(first.state.nowMs).toBe(0);
    expect(first.driver).toEqual({ runId: state.runId, lastWallUs: 1000000, remainderUs: 0 });
  });
  it('preserves 3x microsecond conversion remainder exactly', () => {
    let pair = anchor(3); pair = value(sampleWall(pair.state, pair.driver, 250));
    expect(pair.state.nowMs).toBe(0); expect(pair.driver.remainderUs).toBe(750);
    pair = value(sampleWall(pair.state, pair.driver, 500));
    expect(pair.state.nowMs).toBe(1); expect(pair.driver.remainderUs).toBe(500);
    pair = value(sampleWall(pair.state, pair.driver, 500));
    expect(pair.state.nowMs).toBe(1); expect(pair.driver.remainderUs).toBe(500); expect(pair.emitted).toEqual([]);
  });
  it.each([1, 2, 3] as const)('delayed visible samples at %sx catch all intervals up through horizon', speed => {
    let pair = anchor(speed); pair = value(sampleWall(pair.state, pair.driver, 200000));
    expect(pair.state.nowMs).toBe(Math.min(speed * 200, 500));
    expect(pair.state.tickets.map(t => t.admittedAtMs)).toEqual([10, 20, 30]);
    if (speed === 3) expect(pair.state.ended).toBe('horizon');
  });
  it('old-speed flush happens before new speed, preserving remainder', () => {
    let pair = anchor(1);
    pair = value(applyWallControl(pair.state, pair.driver, 1500, { kind: 'speed', speed: 3 }));
    expect(pair.state.nowMs).toBe(1); expect(pair.state.speed).toBe(3); expect(pair.driver.remainderUs).toBe(500);
    pair = value(sampleWall(pair.state, pair.driver, 2000));
    expect(pair.state.nowMs).toBe(3); expect(pair.driver.remainderUs).toBe(0);
    expect(pair.state.events.filter(e => e.kind === 'commandAccepted' && e.command.kind === 'speed').map(e => e.atMs)).toEqual([1]);
  });
  it.each([1, 2, 3] as const)('pause/resume and hide/show at %sx preserve remainder and phase without catch-up', speed => {
    let pair = anchor(speed);
    pair = value(applyWallControl(pair.state, pair.driver, 250, { kind: 'set-pause', reason: 'facilitator', active: true }));
    const stoppedMs = pair.state.nowMs, remainder = pair.driver.remainderUs;
    pair = value(sampleWall(pair.state, pair.driver, 100000));
    expect(pair.state.nowMs).toBe(stoppedMs); expect(pair.driver.remainderUs).toBe(remainder);
    pair = value(applyWallControl(pair.state, pair.driver, 200000, { kind: 'set-pause', reason: 'hidden', active: true }));
    pair = value(applyWallControl(pair.state, pair.driver, 300000, { kind: 'set-pause', reason: 'facilitator', active: false }));
    expect(pair.state.pausedBy).toEqual(['hidden']);
    pair = value(applyWallControl(pair.state, pair.driver, 400000, { kind: 'set-pause', reason: 'hidden', active: false }));
    expect(pair.state.nowMs).toBe(stoppedMs);
    pair = value(sampleWall(pair.state, pair.driver, 400750));
    expect(pair.state.nowMs).toBe(speed); expect(pair.driver.remainderUs).toBe(0); expect(pair.state.nextPushAtMs).toBe(10);
    pair = value(sampleWall(pair.state, pair.driver, 410000));
    expect(pair.state.nowMs).toBe(Math.floor((10000 * speed + remainder) / 1000));
  });
  it('rebasing while paused does not inject time and preserves fractional remainder', () => {
    let pair = anchor(3); pair = value(sampleWall(pair.state, pair.driver, 250));
    const paused = action(pair.state, { kind: 'set-pause', reason: 'help', active: true });
    const driver = value(rebaseDriver(pair.driver, 99999));
    expect(driver.remainderUs).toBe(750);
    const sampled = value(sampleWall(paused, driver, 100000)); expect(sampled.state).toBe(paused);
  });
  it.each([-1, 0.1, Infinity, NaN, '100'])('rejects invalid wall sample %j', wall => {
    const pair = anchor(); expect(sampleWall(pair.state, pair.driver, wall).ok).toBe(false);
  });
  it('rejects backward samples, malformed drivers, cross-run driver reuse and overflow', () => {
    const pair = anchor(); const d: Driver = { ...pair.driver, lastWallUs: 100 };
    expect(sampleWall(pair.state, d, 99).ok).toBe(false);
    expect(rebaseDriver(d, 99).ok).toBe(false);
    expect(sampleWall(pair.state, { ...d, remainderUs: 1000 }, 100).ok).toBe(false);
    expect(sampleWall(pair.state, { ...d, personal: 'x' }, 100).ok).toBe(false);
    expect(sampleWall(pair.state, { ...d, runId: 'different' }, 100).ok).toBe(false);
    const fast = anchor(3); expect(sampleWall(fast.state, fast.driver, Number.MAX_SAFE_INTEGER).ok).toBe(false);
  });
  it('control rejection is atomic: no state/driver candidate for invalid or paused speed change', () => {
    const pair = anchor(); const paused = action(pair.state, { kind: 'set-pause', reason: 'help', active: true });
    const invalid = applyWallControl(paused, pair.driver, 10000, { kind: 'speed', speed: 2 });
    expect(invalid).toMatchObject({ ok: false, issues: [{ code: 'PAUSED' }] }); expect('value' in invalid).toBe(false);
    expect(applyWallControl(pair.state, pair.driver, 10000, { kind: 'admit', orderKey: 'order-1' }).ok).toBe(false);
    expect(pair.driver.lastWallUs).toBe(0); expect(pair.state.nowMs).toBe(0);
  });
  it('pause control cannot occur after active elapsed sample reaches horizon', () => {
    const pair = anchor(); expect(applyWallControl(pair.state, pair.driver, 600000, { kind: 'set-pause', reason: 'facilitator', active: true }).ok).toBe(false);
    // A host may separately commit the successful sample (horizon) if it wants a final result.
    expect(value(sampleWall(pair.state, pair.driver, 600000)).state.ended).toBe('horizon');
  });
  it('ended samples never advance hazards or create another end', () => {
    const pair = anchor(); const state = at(pair.state, 500);
    const result = value(sampleWall(state, pair.driver, 10000000));
    expect(result.state).toBe(state); expect(result.driver.lastWallUs).toBe(10000000); expect(result.emitted).toEqual([]);
  });
});
