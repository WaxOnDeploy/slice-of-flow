import { describe, expect, it } from 'vitest';
import { measureTimeWeightedWip } from './sof018Metrics';
import { snapshotFromEngine, validateSnapshot } from '../sofEngine/runSnapshots';
import { action, admit, at, clone, move, resume, start, testConfig, value } from '../sofEngine/fixtures/testCases';
import type { Engine, EventData } from '../sofEngine/types';
const measured = (s: Engine) => value(measureTimeWeightedWip(value(snapshotFromEngine(s))));
function standard(kind: 'finished' | 'unfinished' | 'burnt'): Engine {
  let s = resume(start(testConfig({ count: 2, horizonMs: 120000, prepMs: 30000, bakeMs: 40000, burnBufferMs: 15000, patienceMs: 480000 })));
  s = move(admit(s, 1), 1, 'prep');
  if (kind === 'finished') s = move(admit(s, 2), 2, 'prep');
  s = move(at(s, 30000), 1, 'oven');
  if (kind === 'finished') s = move(s, 2, 'oven');
  if (kind === 'burnt') s = move(admit(s, 2), 2, 'prep');
  s = at(s, 60000);
  if (kind === 'burnt') s = move(s, 2, 'oven');
  if (kind === 'unfinished') s = move(admit(s, 2), 2, 'prep');
  s = move(at(s, 70000), 1, 'boxDeliver');
  if (kind === 'finished') s = move(s, 2, 'boxDeliver');
  s = move(at(s, 90000), 1, 'served');
  if (kind === 'finished') s = move(s, 2, 'served');
  if (kind === 'unfinished') s = move(s, 2, 'oven');
  return at(s, 120000);
}

describe('whole-observation all-active WIP and independent served timestamps', () => {
  it.each([
    ['finished', 180, 1.5, 1, 1, 90, 90, 2, 0, 0],
    ['unfinished', 150, 1.25, 0.5, 0.5, 150, 90, 1, 0, 1],
    ['burnt', 175, 175 / 120, 0.5, 1, 87.5, 90, 1, 1, 0],
  ] as const)('independent expected %s result', (kind, area, wip, delivery, exitsRate, estimate, servedMean, n, burnt, active) => {
    const summary = measured(standard(kind));
    expect(summary).toMatchObject({ durationSimSec: 120, areaTicketSec: area, averageWip: wip,
      deliveryRatePerSimMinute: delivery, allExitRatePerSimMinute: exitsRate,
      illustrativeOrdersToExitSimSec: estimate, measuredOrdersToServedSimSec: servedMean,
      measuredServedSampleCount: n, measuredServedSumSimSec: n * 90, burntCount: burnt });
    expect(summary.unfinished).toHaveLength(active);
    expect(summary.exitCount).toBe(n + burnt);
    expect(summary.areaTicketSec).toBe(summary.exits.reduce((sum, x) => sum + x.elapsedSimSec, 0) + summary.unfinished.reduce((sum, x) => sum + x.ageSimSec, 0));
    expect(summary.source).toBe('engine-boundary'); expect(summary.boundary).toBe('orders-admission-to-terminal-exit/v1');
    expect(summary.servedDefinition).toBe('orders-to-served/nonnegative-elapsed/v1');
    expect(summary.caveat).toBe('This is a short-run illustration, not measured served-ticket lead time. Unfinished tickets and discard exits can make the estimate differ from the served-ticket average.');
    expect(summary.exitRateDistinction).toBe('All-exit rate includes served and discarded tickets; delivery rate counts only served tickets.');
    expect(Object.isFrozen(summary.exits)).toBe(true);
  });
  it('positive-duration external-only and empty runs are valid zero WIP/rates, not missing', () => {
    for (const count of [0, 2]) {
      const s = at(resume(start(testConfig({ count, horizonMs: 120000 }))), 120000);
      expect(measured(s)).toMatchObject({ areaTicketSec: 0, averageWip: 0, deliveryRatePerSimMinute: 0,
        allExitRatePerSimMinute: 0, illustrativeOrdersToExitSimSec: null, measuredOrdersToServedSimSec: null,
        measuredServedSampleCount: 0, externalCount: count, unavailable: { wipAndRates: null, illustration: 'zero-exits', measuredServed: 'no-served-samples' } });
    }
  });
  it('zero duration including guided admission makes WIP/rates unavailable and preserves active ticket', () => {
    const s = start(testConfig({ count: 1, horizonMs: 0, guidedStart: true }));
    const m = measured(s);
    expect(m).toMatchObject({ durationSimSec: 0, areaTicketSec: 0, averageWip: null,
      deliveryRatePerSimMinute: null, allExitRatePerSimMinute: null, illustrativeOrdersToExitSimSec: null,
      admittedCount: 1, unavailable: { wipAndRates: 'zero-duration', illustration: 'zero-duration' } });
    expect(m.unfinished[0].ageSimSec).toBe(0);
  });
  it('active held ticket retains actual station/unfinished age and overlapping union', () => {
    const c = testConfig({ count: 1, horizonMs: 120000, holds: [
      { holdId: 'a', orderKey: 'order-1', startMs: 0, endMs: 130000, reason: 'fixture-dependency' },
      { holdId: 'b', orderKey: 'order-1', startMs: 30000, endMs: 130000, reason: 'fixture-dependency' },
    ] });
    const s = at(admit(resume(start(c)), 1), 120000); const m = measured(s);
    expect(m).toMatchObject({ areaTicketSec: 120, averageWip: 1, blockedTicketSec: 120,
      stationAreaTicketSec: { orderQueue: 120, prep: 0, oven: 0, boxDeliver: 0 },
      unfinished: [{ stage: 'orderQueue', blocked: true, ageSimSec: 120 }] });
  });
  it('all-manual-discard run has all-exit illustration without delivery or served samples; actual manual window', () => {
    let s = admit(resume(start(testConfig({ count: 1, horizonMs: 120000 }))), 1);
    s = action(at(s, 30000), { kind: 'discard', orderKey: 'order-1' });
    s = action(at(s, 60000), { kind: 'end', reason: 'manual-stop' });
    expect(measured(s)).toMatchObject({ durationSimSec: 60, areaTicketSec: 30, averageWip: 0.5,
      servedCount: 0, otherDiscardCount: 1, exitCount: 1, deliveryRatePerSimMinute: 0,
      allExitRatePerSimMinute: 1, illustrativeOrdersToExitSimSec: 30, measuredOrdersToServedSimSec: null,
      measuredServedSampleCount: 0, endReason: 'manual-stop' });
  });
  it('final-time caller exit at manual stop counts once and complete final interval is included', () => {
    let s = move(admit(resume(start(testConfig({ count: 1, horizonMs: 20000, prepMs: 3000, bakeMs: 4000 }))), 1), 1, 'prep');
    s = move(at(s, 3000), 1, 'oven'); s = move(at(s, 7000), 1, 'boxDeliver'); s = move(at(s, 12000), 1, 'served');
    s = action(s, { kind: 'end', reason: 'manual-stop' });
    expect(measured(s)).toMatchObject({ durationSimSec: 12, areaTicketSec: 12, exitCount: 1,
      deliveryRatePerSimMinute: 5, allExitRatePerSimMinute: 5, measuredOrdersToServedSimSec: 12,
      measuredServedSampleCount: 1, illustrativeOrdersToExitSimSec: 12 });
  });
  it('nonnegative-elapsed consumer port keeps zero served sample; such port is not an engine gameplay fixture', () => {
    const c = testConfig({ count: 1, horizonMs: 10000 }); const order = { orderKey: 'order-1', orderId: 'r:order:1' };
    const rows: EventData[] = [{ kind: 'runStarted' }, { kind: 'arrival', ...order }, { kind: 'admission', ...order, by: 'pull' },
      { kind: 'movement', ...order, from: 'orderQueue', to: 'prep' }, { kind: 'movement', ...order, from: 'prep', to: 'oven' },
      { kind: 'movement', ...order, from: 'oven', to: 'boxDeliver' }, { kind: 'service', ...order, from: 'boxDeliver' },
      { kind: 'runEnded', reason: 'horizon' }];
    const port = value(validateSnapshot({ schema: 'sof-run/v1', kind: 'independent-final', runId: 'r', config: c,
      history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete', events: rows.map((e, i) => ({ ...e, runId: 'r', seq: i + 1, atMs: i === 7 ? 10000 : 0 })) },
      observation: { startMs: 0, endMs: 10000, durationMs: 10000 }, endReason: 'horizon',
      orders: [{ ...order, outcome: 'served', finalStation: null, admittedAtMs: 0, exitedAtMs: 0, angry: false }],
      metrics: { served: 1, burnt: 0, angry: 0, stillInProgress: 0, score: 4,
        servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 0, meanSimMs: 0 } } }));
    expect(value(measureTimeWeightedWip(port))).toMatchObject({ measuredOrdersToServedSimSec: 0, measuredServedSampleCount: 1, areaTicketSec: 0 });
  });
  it('unknown/missing/incomplete ledgers never become an invented legacy zero measurement', () => {
    for (const input of [null, undefined, { served: 1, avgLeadTime: 90, timeRemaining: 0 }, { kind: 'legacy-summary' }]) expect(measureTimeWeightedWip(input).ok).toBe(false);
    const snapshot: any = clone(value(snapshotFromEngine(standard('finished')))); snapshot.history.events = [];
    expect(measureTimeWeightedWip(snapshot).ok).toBe(false);
    snapshot.history = null; expect(measureTimeWeightedWip(snapshot).ok).toBe(false);
  });
});
