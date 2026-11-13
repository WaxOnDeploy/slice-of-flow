import {
  commandClass, exactKeys, failure, immutable, isCode, isRecord, isTime, STATIONS, success, validateCommand,
  type Accounting, type AccountingOrder, type Checked, type EngineEvent, type HistoryEvidence,
  type RunConfig, type Station,
} from './types';
import { validateConfig } from './scenario';
import { isVip, policyLimit } from './vipRules';
import { isSupplier, movementBlocked, oldestSupplierOrder } from './supplierRules';

const EVENT_FIELDS: Record<string, readonly string[]> = {
  runStarted: [], arrival: ['orderKey', 'orderId'], admission: ['orderKey', 'orderId', 'by'],
  movement: ['orderKey', 'orderId', 'from', 'to'], ready: ['orderKey', 'orderId', 'station'],
  service: ['orderKey', 'orderId', 'from'], discard: ['orderKey', 'orderId', 'from', 'reason'],
  anger: ['orderKey', 'orderId'], blockStart: ['orderKey', 'orderId', 'holdId'], blockEnd: ['orderKey', 'orderId', 'holdId'],
  commandAccepted: ['commandClass', 'command'], runEnded: ['reason'],
};
export function validateEvent(input: unknown): Checked<EngineEvent> {
  if (!isRecord(input) || typeof input.kind !== 'string' || !Object.hasOwn(EVENT_FIELDS, input.kind) ||
    !exactKeys(input, ['kind', 'runId', 'seq', 'atMs', ...EVENT_FIELDS[input.kind]])) return failure('INVALID_EVENT', 'event');
  if (!isCode(input.runId) || !isTime(input.seq) || input.seq === 0 || !isTime(input.atMs)) return failure('INVALID_EVENT', 'event');
  if (Object.hasOwn(input, 'orderKey') && (!isCode(input.orderKey) || !isCode(input.orderId))) return failure('INVALID_ID', 'event');
  if (input.kind === 'admission' && !['push', 'pull', 'guide'].includes(input.by as string)) return failure('INVALID_EVENT', 'event.by');
  if (input.kind === 'movement' && (!STATIONS.includes(input.from as Station) || !STATIONS.includes(input.to as Station) || input.from === input.to)) return failure('INVALID_EVENT', 'event');
  if (input.kind === 'ready' && input.station !== 'prep' && input.station !== 'oven') return failure('INVALID_EVENT', 'event.station');
  if (input.kind === 'service' && input.from !== 'boxDeliver') return failure('INVALID_EVENT', 'event.from');
  if (input.kind === 'discard' && (!STATIONS.includes(input.from as Station) || !['burnt', 'manual'].includes(input.reason as string) || (input.reason === 'burnt' && input.from !== 'oven'))) return failure('INVALID_EVENT', 'event');
  if (['blockStart', 'blockEnd'].includes(input.kind) && !isCode(input.holdId)) return failure('INVALID_ID', 'event.holdId');
  if (input.kind === 'runEnded' && !['horizon', 'all-resolved', 'manual-stop'].includes(input.reason as string)) return failure('UNSUPPORTED_END_REASON', 'event.reason');
  if (input.kind === 'commandAccepted') {
    const command = validateCommand(input.command); if (!command.ok) return command;
    if (input.commandClass !== commandClass(command.value)) return failure('INVALID_EVENT', 'event.commandClass');
  }
  return success(input as unknown as EngineEvent);
}
export function validateHistory(input: unknown): Checked<HistoryEvidence> {
  if (!isRecord(input) || !exactKeys(input, ['schema', 'source', 'completeness', 'events']) ||
    input.schema !== 'sof-history/v1' || input.source !== 'engine-boundary' || input.completeness !== 'complete' || !Array.isArray(input.events)) return failure('INCOMPLETE_HISTORY', 'history');
  for (let i = 0; i < input.events.length; i++) {
    const event = validateEvent(input.events[i]); if (!event.ok) return failure(event.issues[0].code, `history.events[${i}]`);
  }
  return success(input as unknown as HistoryEvidence);
}

type Row = {
  orderKey: string; orderId: string; outcome: AccountingOrder['outcome']; finalStation: Station | null;
  admittedAtMs: number | null; exitedAtMs: number | null; angry: boolean; arrived: boolean; holds: string[];
};
export type AccountOptions = Readonly<{ requireEnded?: boolean }>;
/**
 * Independent transition fold, not a reducer replay. Prefix mode permits partial same-time batches.
 * Final mode requires complete lifecycle, all due arrivals/hold boundaries, and a terminal event.
 * Command envelopes are validated but NEVER add a ticket/count/area.
 */
export function account(configInput: unknown, runId: unknown, historyInput: unknown, endAtMs: unknown,
  options: AccountOptions = {}): Checked<Accounting> {
  const checked = validateConfig(configInput); if (!checked.ok) return checked;
  if (!isCode(runId) || runId.length > 64) return failure('INVALID_ID', 'runId');
  const config: RunConfig = checked.value;
  if (!isTime(endAtMs) || endAtMs > config.manifest.horizonMs) return failure('INVALID_TIME', 'endAtMs');
  const captured = validateHistory(historyInput); if (!captured.ok) return captured;
  const events = captured.value.events;
  const requireEnded = options.requireEnded !== false;
  const rows: Row[] = [...config.manifest.orders].sort((a, b) => a.ordinal - b.ordinal || (a.orderKey < b.orderKey ? -1 : 1)).map(o => ({
    orderKey: o.orderKey, orderId: `${runId}:order:${o.ordinal}`, outcome: 'not-admitted', finalStation: null,
    admittedAtMs: null, exitedAtMs: null, angry: false, arrived: false, holds: [],
  }));
  const byStation = { orderQueue: 0, prep: 0, oven: 0, boxDeliver: 0 };
  const stateAreaMs = { orderQueue: 0, prep: 0, oven: 0, boxDeliver: 0 };
  let blockedTicketMs = 0, previousAt = 0, started = false, ended = false;
  let served = 0, burnt = 0, otherDiscard = 0, admitted = 0, arrived = 0;
  const seenStarts = new Set<string>(), seenEnds = new Set<string>();
  const integrate = (to: number): boolean => {
    const delta = to - previousAt;
    for (const station of STATIONS) {
      stateAreaMs[station] += byStation[station] * delta;
      if (!Number.isSafeInteger(stateAreaMs[station])) return false;
    }
    blockedTicketMs += rows.filter(r => r.outcome === 'active' && r.finalStation !== null && movementBlocked(config, r.holds, r.finalStation)).length * delta;
    previousAt = to;
    return Number.isSafeInteger(blockedTicketMs);
  };
  const bad = (code: string, seq: number) => failure<Accounting>(code, `history.events[${seq - 1}]`);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.runId !== runId || e.seq !== i + 1 || e.atMs < previousAt || e.atMs > endAtMs) return bad('INVALID_SEQUENCE', i + 1);
    if (ended) return bad('AFTER_END', e.seq);
    if (!integrate(e.atMs)) return bad('OVERFLOW', e.seq);
    if (e.kind === 'runStarted') {
      if (started || i !== 0 || e.atMs !== 0) return bad('INVALID_LIFECYCLE', e.seq);
      started = true; continue;
    }
    if (!started) return bad('INVALID_LIFECYCLE', e.seq);
    if (e.kind === 'runEnded') {
      if (e.atMs !== endAtMs || (e.reason === 'horizon' && e.atMs !== config.manifest.horizonMs) ||
        (e.reason === 'all-resolved' && (config.endCondition !== 'all-resolved-or-horizon' || rows.some(r => r.outcome === 'active' || r.outcome === 'not-admitted')))) return bad('INVALID_END', e.seq);
      ended = true; continue;
    }
    if (e.kind === 'commandAccepted') continue;
    const r = rows.find(r => r.orderKey === e.orderKey);
    if (!r || r.orderId !== e.orderId) return bad('IDENTITY_MISMATCH', e.seq);
    const spec = config.manifest.orders.find(o => o.orderKey === r.orderKey)!;
    if (e.kind === 'arrival') {
      if (r.arrived || e.atMs !== spec.availableAtMs) return bad('INVALID_LIFECYCLE', e.seq);
      r.arrived = true; arrived++;
    } else if (e.kind === 'blockStart' || e.kind === 'blockEnd') {
      const hold = config.manifest.holds.find(h => h.holdId === e.holdId && h.orderKey === e.orderKey);
      if (!hold || e.atMs !== (e.kind === 'blockStart' ? hold.startMs : hold.endMs)) return bad('INVALID_HOLD', e.seq);
      if (e.kind === 'blockStart') {
        if (seenStarts.has(hold.holdId)) return bad('INVALID_HOLD', e.seq);
        seenStarts.add(hold.holdId); r.holds.push(hold.holdId); r.holds.sort();
      } else {
        if (!seenStarts.has(hold.holdId) || seenEnds.has(hold.holdId)) return bad('INVALID_HOLD', e.seq);
        seenEnds.add(hold.holdId); r.holds = r.holds.filter(h => h !== hold.holdId);
      }
    } else if (e.kind === 'admission') {
      if (!r.arrived || r.admittedAtMs !== null || r.outcome !== 'not-admitted') return bad('INVALID_LIFECYCLE', e.seq);
      if ((e.by === 'push' && (config.policy.variantId !== 'interval-push' || e.atMs === 0 || e.atMs % config.manifest.pushIntervalMs !== 0)) ||
        (e.by === 'pull' && config.policy.variantId === 'interval-push') || (e.by === 'guide' && (!config.guidedStart || e.atMs !== 0))) return bad('INVALID_ADMISSION', e.seq);
      if (config.manifest.scenarioId === 'vip-expedite' || isSupplier(config)) {
        const vip = isVip(config, r.orderKey), expedited = config.policy.variantId === 'expedite';
        if (expedited && vip && rows.some(row => row.outcome === 'active' && isVip(config, row.orderKey))) return bad('VIP_TOKEN', e.seq);
        const available = config.manifest.orders.filter(o => rows.some(row => row.orderKey === o.orderKey && row.arrived && row.admittedAtMs === null) &&
          (!expedited || isVip(config, o.orderKey) === vip)).sort((a, b) => a.availableAtMs - b.availableAtMs || a.ordinal - b.ordinal || a.orderKey.localeCompare(b.orderKey));
        if (available[0]?.orderKey !== r.orderKey) return bad('FIFO', e.seq);
        const limit = policyLimit(config, 'orderQueue', vip);
        if (limit !== null && byStation.orderQueue >= limit) return bad('CAPACITY', e.seq);
      }
      r.outcome = 'active'; r.finalStation = 'orderQueue'; r.admittedAtMs = e.atMs; admitted++; byStation.orderQueue++;
    } else {
      if (r.outcome !== 'active' || r.finalStation === null) return bad('INVALID_LIFECYCLE', e.seq);
      if (e.kind === 'movement') {
        if (r.finalStation !== e.from || STATIONS.indexOf(e.to) !== STATIONS.indexOf(e.from) + 1) return bad('INVALID_MOVEMENT', e.seq);
        if (isSupplier(config) && e.from === 'orderQueue' && config.policy.variantId === 'naive' &&
          oldestSupplierOrder(config, rows.filter(row => row.outcome === 'active' && row.finalStation === 'orderQueue')) !== r.orderKey) return bad('SUPPLIER_SEQUENCE', e.seq);
        // Supplier schedule is checked directly as well, so a same-time missing/reordered
        // boundary envelope cannot authorize a start during the shortage.
        const holds = isSupplier(config) ? config.manifest.holds.filter(h => h.orderKey === r.orderKey && h.startMs <= e.atMs && e.atMs < h.endMs).map(h => h.holdId) : r.holds;
        // Legacy fixture ports remain lifecycle accounting rather than producer physics.
        if (isSupplier(config) && movementBlocked(config, holds, e.from)) return bad('BLOCKED', e.seq);
        const limit = policyLimit(config, e.to, isVip(config, r.orderKey));
        if (limit !== null && byStation[e.to] >= limit) return bad('CAPACITY', e.seq);
        byStation[e.from]--; byStation[e.to]++; r.finalStation = e.to;
      } else if (e.kind === 'ready') {
        if (r.finalStation !== e.station) return bad('INVALID_MOVEMENT', e.seq);
      } else if (e.kind === 'anger') {
        if (isVip(config, r.orderKey) || r.angry || e.atMs !== r.admittedAtMs! + config.manifest.patienceMs) return bad('INVALID_LIFECYCLE', e.seq);
        r.angry = true;
      } else if (e.kind === 'service' || e.kind === 'discard') {
        if (r.finalStation !== e.from) return bad('INVALID_MOVEMENT', e.seq);
        byStation[e.from]--; r.finalStation = null; r.exitedAtMs = e.atMs;
        if (e.kind === 'service') { r.outcome = 'served'; served++; }
        else if (e.reason === 'burnt') { r.outcome = 'burnt'; burnt++; }
        else { r.outcome = 'discarded'; otherDiscard++; }
      }
    }
    const active = rows.filter(r => r.outcome === 'active').length;
    if (admitted !== active + served + burnt + otherDiscard || arrived !== rows.filter(r => r.arrived && r.admittedAtMs === null).length + admitted || STATIONS.reduce((n, s) => n + byStation[s], 0) !== active) return bad('UNRECONCILED', e.seq);
    for (const s of STATIONS) if ([config.resources.occupancy[s], policyLimit(config, s, rows.some(row => row.outcome === 'active' && row.finalStation === s && isVip(config, row.orderKey)))].some(cap => cap !== null && byStation[s] > cap)) return bad('CAPACITY', e.seq);
  }
  if (requireEnded && (!started || !ended)) return failure('INCOMPLETE_HISTORY', 'history');
  if (requireEnded) {
    for (const o of config.manifest.orders) if (o.availableAtMs <= endAtMs && !rows.find(r => r.orderKey === o.orderKey)!.arrived) return failure('INCOMPLETE_HISTORY', 'history.arrivals');
    for (const h of config.manifest.holds) if ((h.startMs <= endAtMs && !seenStarts.has(h.holdId)) || (h.endMs <= endAtMs && !seenEnds.has(h.holdId))) return failure('INCOMPLETE_HISTORY', 'history.holds');
  }
  if (!integrate(endAtMs)) return failure('OVERFLOW', 'area');
  const active = rows.filter(r => r.outcome === 'active').length;
  const areaTicketMs = STATIONS.reduce((n, s) => n + stateAreaMs[s], 0);
  const durations = rows.filter(r => r.admittedAtMs !== null).reduce((n, r) => n + (r.exitedAtMs ?? endAtMs) - r.admittedAtMs!, 0);
  const sumSimMs = rows.filter(r => r.outcome === 'served').reduce((n, r) => n + r.exitedAtMs! - r.admittedAtMs!, 0);
  if (!Number.isSafeInteger(areaTicketMs) || !Number.isSafeInteger(durations) || !Number.isSafeInteger(sumSimMs)) return failure('OVERFLOW', 'area');
  if (areaTicketMs !== durations) return failure('UNRECONCILED', 'area');
  return success(immutable({
    arrived, external: arrived - admitted, admitted, active, served, burnt, otherDiscard,
    discarded: burnt + otherDiscard, byStation, stateAreaMs, areaTicketMs, blockedTicketMs, orders: rows,
    servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: served, sumSimMs,
      meanSimMs: served === 0 ? null : sumSimMs / served },
  }));
}

/** Per-ticket interval union from an already validated ledger. The active population only:
 * external/scheduled and exited tickets never count; supplier holds additionally require Orders.
 * Multiple concurrent hold IDs contribute once per ticket, not once per supplier/hold.
 */
export function blockedDurationsFromValidatedHistory(config: RunConfig, events: readonly EngineEvent[], endMs: number): ReadonlyMap<string, number> {
  const rows = new Map(config.manifest.orders.map(o => [o.orderKey, { active: false, station: null as Station | null, holds: [] as string[] }]));
  const durations = new Map(config.manifest.orders.map(o => [o.orderKey, 0]));
  let previous = 0;
  const integrate = (at: number) => {
    for (const [key, row] of Array.from(rows.entries())) if (row.active && row.station !== null && movementBlocked(config, row.holds, row.station)) {
      durations.set(key, durations.get(key)! + at - previous);
    }
    previous = at;
  };
  for (const e of events) {
    integrate(e.atMs);
    if (!('orderKey' in e)) continue;
    const row = rows.get(e.orderKey)!;
    if (e.kind === 'admission') { row.active = true; row.station = 'orderQueue'; }
    if (e.kind === 'movement') row.station = e.to;
    if (e.kind === 'service' || e.kind === 'discard') { row.active = false; row.station = null; }
    if (e.kind === 'blockStart') row.holds.push(e.holdId);
    if (e.kind === 'blockEnd') row.holds = row.holds.filter(id => id !== e.holdId);
  }
  integrate(endMs);
  return durations;
}
