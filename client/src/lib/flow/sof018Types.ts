import type { DeepReadonly, EndReason, OrderRef, RunId, Station } from '../sofEngine/types';
import type { SERVED_DEFINITION, WIP_BOUNDARY } from '../sof/metricDefinitions';
export type ActiveStage = Station;
export type ExitOutcome = 'served' | 'burnt' | 'discarded';
export type ActiveAge = Readonly<OrderRef & {
  admittedAtSimSec: number; stage: ActiveStage; blocked: boolean; ageSimSec: number;
}>;
export type ExitSample = Readonly<OrderRef & {
  admittedAtSimSec: number; exitedAtSimSec: number; outcome: ExitOutcome; elapsedSimSec: number;
}>;
export type WipSummary = DeepReadonly<{
  runId: RunId; source: 'engine-boundary'; boundary: typeof WIP_BOUNDARY;
  servedDefinition: typeof SERVED_DEFINITION; endReason: EndReason;
  durationSimSec: number; areaTicketSec: number; stationAreaTicketSec: Record<Station, number>;
  blockedTicketSec: number; averageWip: number | null;
  admittedCount: number; externalCount: number; servedCount: number; burntCount: number;
  otherDiscardCount: number; exitCount: number;
  deliveryRatePerSimMinute: number | null; allExitRatePerSimMinute: number | null;
  illustrativeOrdersToExitSimSec: number | null; measuredOrdersToServedSimSec: number | null;
  measuredServedSampleCount: number; measuredServedSumSimSec: number;
  unfinished: ActiveAge[]; exits: ExitSample[];
  units: { time: 'simulated-seconds'; area: 'ticket-simulated-seconds'; wip: 'tickets'; rate: 'per-simulated-minute' };
  unavailable: { wipAndRates: 'zero-duration' | null; illustration: 'zero-duration' | 'zero-exits' | null;
    measuredServed: 'no-served-samples' | null };
  caveat: string; exitRateDistinction: string;
}>;
