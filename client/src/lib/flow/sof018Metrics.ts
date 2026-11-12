import { account } from '../sofEngine/accounting';
import { validateSnapshot } from '../sofEngine/runSnapshots';
import { immutable, success, type Checked } from '../sofEngine/types';
import { EXIT_RATE_DISTINCTION, ILLUSTRATION_CAVEAT, SERVED_DEFINITION, WIP_BOUNDARY } from '../sof/metricDefinitions';
import type { WipSummary } from './sof018Types';
export type { ActiveAge, ActiveStage, ExitOutcome, ExitSample, WipSummary } from './sof018Types';

/** Whole actual observation; no callback-count clock, inferred history, rounding, or eventual-served WIP filter. */
export function measureTimeWeightedWip(input: unknown): Checked<WipSummary> {
  const validated = validateSnapshot(input); if (!validated.ok) return validated;
  const snapshot = validated.value;
  const folded = account(snapshot.config, snapshot.runId, snapshot.history, snapshot.observation.endMs); if (!folded.ok) return folded;
  const a = folded.value, durationSimSec = snapshot.observation.durationMs / 1000;
  const areaTicketSec = a.areaTicketMs / 1000, exitCount = a.served + a.discarded;
  const unfinished = a.orders.filter(o => o.outcome === 'active').map(o => ({
    orderKey: o.orderKey, orderId: o.orderId, admittedAtSimSec: o.admittedAtMs! / 1000,
    stage: o.finalStation!, blocked: o.holds.length > 0, ageSimSec: (snapshot.observation.endMs - o.admittedAtMs!) / 1000,
  }));
  const exits = a.orders.filter(o => o.exitedAtMs !== null).map(o => ({
    orderKey: o.orderKey, orderId: o.orderId, admittedAtSimSec: o.admittedAtMs! / 1000,
    exitedAtSimSec: o.exitedAtMs! / 1000, outcome: o.outcome as 'served' | 'burnt' | 'discarded',
    elapsedSimSec: (o.exitedAtMs! - o.admittedAtMs!) / 1000,
  }));
  return success(immutable({
    runId: snapshot.runId, source: 'engine-boundary', boundary: WIP_BOUNDARY, servedDefinition: SERVED_DEFINITION,
    endReason: snapshot.endReason, durationSimSec, areaTicketSec,
    stationAreaTicketSec: { orderQueue: a.stateAreaMs.orderQueue / 1000, prep: a.stateAreaMs.prep / 1000,
      oven: a.stateAreaMs.oven / 1000, boxDeliver: a.stateAreaMs.boxDeliver / 1000 },
    blockedTicketSec: a.blockedTicketMs / 1000, averageWip: durationSimSec > 0 ? areaTicketSec / durationSimSec : null,
    admittedCount: a.admitted, externalCount: a.external, servedCount: a.served, burntCount: a.burnt,
    otherDiscardCount: a.otherDiscard, exitCount,
    deliveryRatePerSimMinute: durationSimSec > 0 ? a.served * 60 / durationSimSec : null,
    allExitRatePerSimMinute: durationSimSec > 0 ? exitCount * 60 / durationSimSec : null,
    illustrativeOrdersToExitSimSec: durationSimSec > 0 && exitCount > 0 ? areaTicketSec / exitCount : null,
    measuredOrdersToServedSimSec: a.servedSample.meanSimMs === null ? null : a.servedSample.meanSimMs / 1000,
    measuredServedSampleCount: a.servedSample.n, measuredServedSumSimSec: a.servedSample.sumSimMs / 1000,
    unfinished, exits, units: { time: 'simulated-seconds', area: 'ticket-simulated-seconds', wip: 'tickets', rate: 'per-simulated-minute' },
    unavailable: { wipAndRates: durationSimSec === 0 ? 'zero-duration' : null,
      illustration: durationSimSec === 0 ? 'zero-duration' : exitCount === 0 ? 'zero-exits' : null,
      measuredServed: a.servedSample.n === 0 ? 'no-served-samples' : null },
    caveat: ILLUSTRATION_CAVEAT, exitRateDistinction: EXIT_RATE_DISTINCTION,
  }));
}
