import { describe, expect, it } from 'vitest';
import { readVipActivity, makeVipConfig, measureVipResults } from './vip';
import { applyAction, advanceTo, createEngine } from '../sofEngine/engine';
import { snapshotFromEngine } from '../sofEngine/runSnapshots';
import type { Checked, Engine } from '../sofEngine/types';
const value = <T,>(r: Checked<T>): T => { if (!r.ok) throw new Error(JSON.stringify(r.issues)); return r.value; };
const action = (s: Engine, c: unknown) => { const r = applyAction(s, c); if (!r.accepted) throw new Error(JSON.stringify(r.issues)); return r.state; };
function running(variant: 'fifo' | 'expedite' = 'expedite') {
  const created = value(createEngine('read', value(makeVipConfig({ difficulty: 'normal', variant, initialSpeed: 1 })))).state;
  return action(created, { kind: 'set-pause', reason: 'instruction', active: false });
}
describe('VIP read-only canonical facade', () => {
  it('scheduled and external VIPs never claim active WIP, a token or an exception', () => {
    const start = running(); expect(value(readVipActivity(start))).toEqual({ activeVipOrderKey: null, exceptions: [] });
    const s = value(advanceTo(start, 170000)).state;
    expect(s.tickets.slice(12).every(t => t.status === 'external')).toBe(true);
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: null, exceptions: [] });
    expect(s.events.filter(e => e.kind === 'admission')).toHaveLength(0);
  });
  it('reports no exception merely because a VIP is active below ordinary occupancy', () => {
    let s = value(advanceTo(running(), 10000)).state;
    s = action(s, { kind: 'admit', orderKey: 'order-13' });
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: 'order-13', exceptions: [] });
    const before = JSON.stringify(s), result = value(readVipActivity(s));
    expect(JSON.stringify(s)).toBe(before); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.exceptions)).toBe(true);
  });
  it('derives a fifth Orders slot only when actual occupancy exceeds the declared ordinary cap', () => {
    let s = running(); for (let n = 1; n <= 4; n++) s = action(s, { kind: 'admit', orderKey: `order-${n}` });
    s = value(advanceTo(s, 10000)).state; s = action(s, { kind: 'admit', orderKey: 'order-13' });
    expect(value(readVipActivity(s)).exceptions).toEqual([{ station: 'orderQueue', orderKey: 'order-13', occupancy: 5, ordinaryLimit: 4 }]);
    s = action(s, { kind: 'discard', orderKey: 'order-1' });
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: 'order-13', exceptions: [] });
    s = action(s, { kind: 'discard', orderKey: 'order-13' });
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: null, exceptions: [] });
  });
  it('FIFO has no priority token or exception even with admitted VIPs', () => {
    let s = running('fifo'); for (let n = 1; n <= 12; n++) { s = action(s, { kind: 'admit', orderKey: `order-${n}` }); s = action(s, { kind: 'discard', orderKey: `order-${n}` }); }
    s = value(advanceTo(s, 170000)).state;
    for (const n of [13, 14, 15]) s = action(s, { kind: 'admit', orderKey: `order-${n}` });
    expect(value(readVipActivity(s))).toEqual({ activeVipOrderKey: null, exceptions: [] });
    const final = value(snapshotFromEngine(action(s, { kind: 'end', reason: 'manual-stop' })));
    expect(value(measureVipResults(final))).toMatchObject({ vipLate: 1, vipPending: 2, deadlinePenaltyCount: 1, score: -2 });
  });
  it('fails closed for invented token state and unknown engine fields', () => {
    const s = running(), extra = { ...s, vipToken: 'order-13' };
    expect(readVipActivity(extra as Engine).ok).toBe(false);
    expect(readVipActivity(null as never).ok).toBe(false);
    const raw: any = JSON.parse(JSON.stringify(value(advanceTo(s, 170000)).state));
    for (const n of [12, 13]) raw.tickets[n] = { ...raw.tickets[n], status: 'active', station: 'orderQueue', admittedAtMs: 170000 };
    expect(readVipActivity(raw)).toMatchObject({ ok: false, issues: [{ code: 'VIP_TOKEN' }] });
  });
});
