import { describe, expect, it } from 'vitest';
import { makeVipConfig } from '../sofEngine/vip';
import { createEngine, advanceTo, applyAction } from '../sofEngine/engine';
import { type Checked, type Engine, type EngineCommand } from '../sofEngine/types';
import { readCurrentNormalVipWait } from './vipWaiting';
const value = <T,>(x: Checked<T>): T => { if (!x.ok) throw new Error(JSON.stringify(x.issues)); return x.value; };
const command = (engine: Engine, action: EngineCommand) => { const next = applyAction(engine, action); expect(next.accepted).toBe(true); return next.state; };
function start() {
  const config = value(makeVipConfig({ difficulty: 'normal', variant: 'expedite', guidedStart: false }));
  let state = value(createEngine('wait-marker:run:1', config)).state;
  state = command(state, { kind: 'set-pause', reason: 'instruction', active: false });
  return command(state, { kind: 'admit', orderKey: 'order-1' });
}
function vip() {
  let state = value(advanceTo(start(), 10000)).state;
  return command(state, { kind: 'admit', orderKey: 'order-13' });
}
describe('current observed normal waiting while VIP is active', () => {
  it('has no marker with no active VIP, even for an admitted waiting normal', () => {
    expect(value(readCurrentNormalVipWait(value(advanceTo(start(), 10000)).state))).toEqual([]);
  });
  it('excludes zero-time overlap and external normal backlog', () => {
    const atAdmission = vip();
    expect(value(readCurrentNormalVipWait(atAdmission))).toEqual([]);
    expect(value(readCurrentNormalVipWait(value(advanceTo(atAdmission, 10001)).state))).toEqual(['order-1']);
  });
  it('excludes processing and requires positive ready-wait duration', () => {
    let state = command(vip(), { kind: 'move', orderKey: 'order-1', to: 'prep' });
    state = value(advanceTo(state, 39999)).state;
    expect(value(readCurrentNormalVipWait(state))).toEqual([]);
    state = value(advanceTo(state, 40000)).state;
    expect(value(readCurrentNormalVipWait(state))).toEqual([]);
    state = value(advanceTo(state, 40001)).state;
    expect(value(readCurrentNormalVipWait(state))).toEqual(['order-1']);
  });
  it('removes the current marker after the only active VIP closes', () => {
    let state = value(advanceTo(vip(), 10001)).state;
    expect(value(readCurrentNormalVipWait(state))).toEqual(['order-1']);
    state = command(state, { kind: 'discard', orderKey: 'order-13' });
    expect(value(readCurrentNormalVipWait(state))).toEqual([]);
  });
  it('fails closed for invalid engine evidence instead of inventing waiting markers', () => {
    const result = readCurrentNormalVipWait({} as Engine);
    expect(result.ok).toBe(false);
  });
});
