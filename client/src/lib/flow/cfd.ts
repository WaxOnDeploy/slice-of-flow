import { account } from '../sofEngine/accounting';
import { validateSnapshot } from '../sofEngine/runSnapshots';
import { inspectProducerCompatibility } from '../sofEngine/matchedRuns';
import { WIP_BOUNDARY } from '../sof/metricDefinitions';
import { VERSIONS } from '../sofEngine/scenario';
import {
  equivalent, failure, immutable, isRecord, isTime, STATIONS, success,
  type Checked, type DeepReadonly, type FinalRunSnapshot, type Station,
} from '../sofEngine/types';

export const CFD_BAND_ORDER = ['served', 'discarded', 'boxDeliver', 'oven', 'prep', 'orderQueue', 'waiting'] as const;
export const CFD_BOUNDARY_ORDER = ['served', 'exited', 'leftOven', 'leftPrep', 'leftOrders', 'admitted', 'arrived'] as const;
export type CfdBand = typeof CFD_BAND_ORDER[number];
export type CfdBoundary = typeof CFD_BOUNDARY_ORDER[number];
export type CfdPoint = DeepReadonly<{
  atMs: number; atSimSec: number; throughSeq: number | null; eventKind: string | null;
  raw: { arrived: number; admitted: number; enteredPrep: number; enteredOven: number; enteredBox: number;
    served: number; discarded: number; burnt: number; otherDiscard: number; discardedByStation: Record<Station, number> };
  active: number; stations: Record<Station, number>; blockedByStation: Record<Station, number>;
  bands: Record<CfdBand, number>; boundaries: Record<CfdBoundary, number>;
}>;
export type CfdModel = DeepReadonly<{
  schema: 'sof-cfd/v1'; snapshot: FinalRunSnapshot; points: CfdPoint[];
  bandOrder: typeof CFD_BAND_ORDER; boundaryOrder: typeof CFD_BOUNDARY_ORDER;
  source: 'engine-boundary'; validation: 'independent-accounting';
  producerEvidence: 'producer-compatible' | 'not-established'; productionManifest: boolean;
  humanPlay: 'not-established'; population: 'externally-available-orders/v1'; activeBoundary: typeof WIP_BOUNDARY;
  units: { time: 'simulated-seconds'; population: 'tickets'; retainedTime: 'integer-simulated-milliseconds' };
  observation: FinalRunSnapshot['observation']; endReason: FinalRunSnapshot['endReason'];
}>;

/** Lossless post-prefix step table, including each equal-time transition, initial zero and final
 * interval. Canonical account() validates/folds; this module owns no parallel location/hold log.
 */
export function buildCfd(input: unknown): Checked<CfdModel> {
  try {
    const checked = validateSnapshot(input); if (!checked.ok) return checked;
    const s = checked.value, points: CfdPoint[] = [];
    const entries = { prep: 0, oven: 0, boxDeliver: 0 };
    const discardedByStation = { orderQueue: 0, prep: 0, oven: 0, boxDeliver: 0 };
    for (let length = 0; length <= s.history.events.length; length++) {
      const e = length === 0 ? null : s.history.events[length - 1];
      const atMs = e?.atMs ?? 0;
      if (e?.kind === 'movement') entries[e.to as keyof typeof entries]++;
      if (e?.kind === 'discard') discardedByStation[e.from]++;
      const folded = account(s.config, s.runId, { ...s.history, events: s.history.events.slice(0, length) }, atMs, { requireEnded: false });
      if (!folded.ok) return folded;
      const a = folded.value, d = discardedByStation;
      const boundaries = { served: a.served, exited: a.served + a.discarded,
        leftOven: entries.boxDeliver + d.orderQueue + d.prep + d.oven,
        leftPrep: entries.oven + d.orderQueue + d.prep,
        leftOrders: entries.prep + d.orderQueue, admitted: a.admitted, arrived: a.arrived };
      const bands = { served: a.served, discarded: a.discarded,
        boxDeliver: boundaries.leftOven - boundaries.exited, oven: boundaries.leftPrep - boundaries.leftOven,
        prep: boundaries.leftOrders - boundaries.leftPrep, orderQueue: a.admitted - boundaries.leftOrders,
        waiting: a.external };
      const blockedByStation = { orderQueue: 0, prep: 0, oven: 0, boxDeliver: 0 };
      for (const row of a.orders) if (row.outcome === 'active' && row.finalStation !== null && row.holds.length > 0) blockedByStation[row.finalStation]++;
      if (Object.values(bands).some(n => !isTime(n)) ||
        STATIONS.some(st => bands[st] !== a.byStation[st] || blockedByStation[st] > a.byStation[st]) ||
        a.admitted !== a.active + a.served + a.discarded || a.arrived !== a.external + a.admitted ||
        STATIONS.reduce((n, st) => n + a.byStation[st], 0) !== a.active ||
        Object.values(bands).reduce((n, v) => n + v, 0) !== a.arrived ||
        Object.values(d).reduce((n, v) => n + v, 0) !== a.discarded) return failure('CFD_UNRECONCILED', `history.events[${length - 1}]`);
      if (points.length > 0 && CFD_BOUNDARY_ORDER.some(b => boundaries[b] < points[points.length - 1].boundaries[b])) return failure('CFD_NONMONOTONIC', 'boundaries');
      points.push(immutable({ atMs, atSimSec: atMs / 1000, throughSeq: e?.seq ?? null, eventKind: e?.kind ?? null,
        raw: { arrived: a.arrived, admitted: a.admitted, enteredPrep: entries.prep, enteredOven: entries.oven,
          enteredBox: entries.boxDeliver, served: a.served, discarded: a.discarded, burnt: a.burnt,
          otherDiscard: a.otherDiscard, discardedByStation }, active: a.active, stations: a.byStation,
        blockedByStation, bands, boundaries }));
    }
    // A complete final snapshot ends with runEnded at actual endMs; this point closes the final
    // plateau without inventing a transition, horizon replacement, or sampled/smoothed history.
    const producer = inspectProducerCompatibility(s);
    return success(immutable({ schema: 'sof-cfd/v1', snapshot: s, points, bandOrder: CFD_BAND_ORDER,
      boundaryOrder: CFD_BOUNDARY_ORDER, source: s.history.source, validation: 'independent-accounting',
      producerEvidence: producer.ok ? 'producer-compatible' : 'not-established',
      productionManifest: s.config.manifest.scenarioVersion === VERSIONS.scenario &&
        s.config.manifest.generatorVersion === VERSIONS.generator, humanPlay: 'not-established',
      population: 'externally-available-orders/v1', activeBoundary: WIP_BOUNDARY,
      units: { time: 'simulated-seconds', population: 'tickets', retainedTime: 'integer-simulated-milliseconds' },
      observation: s.observation, endReason: s.endReason }));
  } catch {
    return failure('INVALID_CFD_INPUT', 'snapshot');
  }
}

/** Right-continuous selection after all transitions at the selected time. Returns a checked
 * failure (never an exception) for absent/forged models or invalid/out-of-window times.
 */
export function cfdPointAt(input: unknown, atMs: unknown): Checked<CfdPoint> {
  try {
    if (!isRecord(input) || input.schema !== 'sof-cfd/v1') return failure('INVALID_CFD_MODEL', 'model');
    const checked = buildCfd(input.snapshot);
    if (!checked.ok || !equivalent(input, checked.value)) return failure('INVALID_CFD_MODEL', 'model');
    if (!isTime(atMs) || atMs > checked.value.observation.endMs) return failure('INVALID_CFD_TIME', 'atMs');
    const point = checked.value.points.filter(p => p.atMs <= atMs).at(-1)!;
    return success(point);
  } catch {
    return failure('INVALID_CFD_MODEL', 'model');
  }
}
