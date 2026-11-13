import assert from 'node:assert/strict';

export const NORMAL_VIP_RUN = Object.freeze({
  horizonMs: 300000, speed: 3, orders: 15, normals: 12, vips: 3,
  normalPatienceMs: 480000, shortestRecipeMs: 70000,
});

// Stopwatch starts immediately before the guided move unlocks the kitchen.
// 95–110s allows 5s early sampling uncertainty / 10s automation scheduling overhead,
// but deliberately excludes effective 4× (75s) and 2× (150s). The 160s watchdog
// is a separate liveness limit, never a substitute for this mapping assertion.
export const THREE_X_DURATION_WINDOW_MS = Object.freeze({ min: 95000, max: 110000 });
export function assertThreeXDuration(wallElapsedMs) {
  assert.ok(Number.isFinite(wallElapsedMs) && wallElapsedMs >= 0, 'Finite monotonic wall duration');
  assert.ok(wallElapsedMs >= THREE_X_DURATION_WINDOW_MS.min && wallElapsedMs <= THREE_X_DURATION_WINDOW_MS.max,
    `Clean Normal 3× horizon must take 95–110 real seconds (ideal 100s); observed ${wallElapsedMs / 1000}s`);
  return { wallElapsedMs, idealWallMs: NORMAL_VIP_RUN.horizonMs / NORMAL_VIP_RUN.speed,
    toleranceMs: THREE_X_DURATION_WINDOW_MS };
}

// Remaining UI seconds use ceil(), so observed elapsed simulation is rounded down
// by <1s. Allow 2.5s early / 5s late wall deviation, including command/DOM overhead.
// Applied at the first observations at/after 60, 150 and 240 simulated seconds.
export function assertThreeXCheckpoint({ wallElapsedMs, simulatedElapsedSecondsApprox }) {
  assert.ok(Number.isFinite(wallElapsedMs) && wallElapsedMs >= 0);
  assert.ok(Number.isInteger(simulatedElapsedSecondsApprox) && simulatedElapsedSecondsApprox >= 0 && simulatedElapsedSecondsApprox <= 300);
  const idealWallMs = simulatedElapsedSecondsApprox * 1000 / NORMAL_VIP_RUN.speed;
  const deviationMs = wallElapsedMs - idealWallMs;
  assert.ok(deviationMs >= -2500 && deviationMs <= 5000,
    `3× clock checkpoint at ${simulatedElapsedSecondsApprox}s simulated: wall ${wallElapsedMs}ms, expected ${idealWallMs}ms (-2500/+5000ms)`);
  return { wallElapsedMs, simulatedElapsedSecondsApprox, idealWallMs, deviationMs };
}

const integer = (value, label, max) => {
  assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= max, `${label} must be an integer in 0..${max}`);
};

export function numericSummary(result) {
  const v = result.values;
  assert.ok(v && typeof v === 'object', 'Rendered numeric result values');
  const outcomes = v['VIP outcomes (all three orders)']?.match(/^On time:\s*(\d+)\s*·\s*Late:\s*(\d+)\s*·\s*Pending:\s*(\d+)\s*·\s*Not yet arrived:\s*(\d+)\s*·\s*Burnt:\s*(\d+)$/);
  assert.ok(outcomes, 'Recognized VIP outcome partition');
  const bucket = outcomes.slice(1).map(Number);
  bucket.forEach(n => integer(n, 'VIP outcome count', NORMAL_VIP_RUN.vips));
  assert.equal(bucket.reduce((a, b) => a + b, 0), NORMAL_VIP_RUN.vips, 'Three canonical VIP orders');
  const counts = v['Total served / burnt / angry']?.match(/^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/);
  const mean = label => {
    const text = v[label];
    assert.equal(typeof text, 'string', `${label} exists`);
    const match = text.match(/^(N\/A \(no observed samples\)|\d+(?:\.\d{1,2})? simulated seconds)\s*·\s*observed served n\s*=\s*(\d+)$/);
    assert.ok(match, `${label}: recognized rounded served-only mean`);
    const n = Number(match[2]);
    integer(n, `${label} sample count`, label.startsWith('VIP') ? NORMAL_VIP_RUN.vips : NORMAL_VIP_RUN.normals);
    const ms = n === 0 ? null : Number(match[1].split(' ')[0]) * 1000;
    if (n === 0) assert.match(match[1], /^N\/A/, `${label}: zero samples are N/A, never zero`);
    else {
      assert.ok(Number.isFinite(ms), `${label}: finite mean`);
      // UI rounds to 0.01 seconds: at most 5ms error in either direction.
      assert.ok(ms + 5 >= NORMAL_VIP_RUN.shortestRecipeMs, `${label}: served work requires at least 70 simulated seconds`);
      assert.ok(ms <= NORMAL_VIP_RUN.horizonMs + 5, `${label}: mean cannot exceed observation horizon`);
    }
    return { servedN: n, simulatedMsRoundedInUI: ms,
      equivalentUnpausedRealSecondsAt3x: ms === null ? null : ms / 3000 };
  };
  const score = v['Final canonical VIP score']?.match(/^(-?\d+) points\s*·\s*(\d+) deadline penalties$/);
  assert.ok(counts && score, 'Recognized counts and canonical score');
  const summary = {
    served: Number(counts[1]), burnt: Number(counts[2]), angry: Number(counts[3]),
    vip: { onTime: bucket[0], late: bucket[1], pending: bucket[2], notYetArrived: bucket[3], burnt: bucket[4] },
    vipLatency: mean('VIP arrival-to-served mean'), normalArrivalLatency: mean('Normal arrival-to-served mean'),
    normalOrdersLatency: mean('Normal Orders-to-served mean'), score: Number(score[1]), deadlinePenalties: Number(score[2]),
  };
  integer(summary.served, 'Served orders', NORMAL_VIP_RUN.orders);
  integer(summary.burnt, 'Burnt orders', NORMAL_VIP_RUN.orders);
  integer(summary.angry, 'Angry Normal orders', NORMAL_VIP_RUN.normals);
  integer(summary.deadlinePenalties, 'Deadline penalties', NORMAL_VIP_RUN.vips);
  assert.ok(Number.isSafeInteger(summary.score), 'Safe integer score');
  assert.ok(summary.served > 0, 'Automated player delivered real work');
  assert.ok(summary.served + summary.burnt <= NORMAL_VIP_RUN.orders, 'Served and burnt are disjoint within 15 orders');
  assert.equal(summary.vip.pending, 0, 'All deadlines precede the full horizon');
  assert.equal(summary.vip.notYetArrived, 0, 'All three VIP arrivals precede the full horizon');
  assert.equal(summary.angry, 0, 'Normal patience 480s exceeds the 300s observation horizon');
  assert.equal(summary.normalOrdersLatency.servedN, summary.normalArrivalLatency.servedN, 'Same Normal served sample');
  assert.equal(summary.served, summary.vipLatency.servedN + summary.normalArrivalLatency.servedN, 'Served samples partition all service');
  assert.ok(summary.vip.onTime <= summary.vipLatency.servedN, 'On-time VIPs must actually be served');
  assert.ok(summary.vipLatency.servedN <= summary.vip.onTime + summary.vip.late, 'VIP served sample is on-time or late, never burnt');
  assert.ok(summary.vip.burnt <= summary.burnt, 'VIP burns are included in total burns');
  assert.ok(summary.burnt - summary.vip.burnt + summary.normalArrivalLatency.servedN <= NORMAL_VIP_RUN.normals, 'Normal service and burns fit 12 Normal orders');
  assert.equal(summary.deadlinePenalties, summary.vip.late, 'One penalty per late VIP, not per burn');
  if (summary.normalArrivalLatency.servedN) {
    // Two independently rounded means can differ from their true relation by 10ms.
    assert.ok(summary.normalArrivalLatency.simulatedMsRoundedInUI + 10 >= summary.normalOrdersLatency.simulatedMsRoundedInUI,
      'Normal arrival-to-served cannot be below Orders-to-served (10ms rounding allowance)');
  }
  const canonicalScore = summary.served - 2 * summary.burnt - summary.angry
    + (summary.served > 0 && summary.burnt === 0 ? 3 : 0) - 2 * summary.deadlinePenalties;
  assert.equal(summary.score, canonicalScore, 'Canonical served/burn/anger/bonus/deadline score');
  return summary;
}

// Recovery is considered ONLY around a known locator click, never evaluation,
// parsing, assertions, file writes or browser/harness startup. The caller must
// additionally prove the target disappeared AND an actual 300s horizon exists.
export function isExpectedLocatorRemovalError(error, operation = 'locator.click') {
  const message = (error?.message ?? '').replace(/\x1b\[[0-9;]*m/g, '');
  const terminalDetachment = /element was detached from the DOM[^\n]*\s*$/.test(message);
  return operation === 'locator.click' && error?.name === 'TimeoutError'
    && /^locator\.click: Timeout \d+ms exceeded\./.test(message)
    && /waiting for (?:getByTestId|locator|getByRole)\(|element was detached from the DOM/.test(message)
    && !/page, context or browser has been closed|strict mode violation|intercepts pointer events|element is not (?:visible|enabled)/i.test(message)
    && (!/element is not stable/i.test(message) || terminalDetachment);
}

export const isVipTicket = key => /^order-(13|14|15)$/.test(key);
export function assertActionConfirmation(request, observation) {
  assert.ok(request && /^order-(?:[1-9]|1[0-5])$/.test(request.ticket), 'Named canonical action ticket');
  assert.equal(observation.ticket, request.ticket, 'Confirmation belongs to the requested ticket');
  if (request.kind === 'admit') {
    assert.equal(observation.status, 'active', 'Admission created an active ticket');
    assert.equal(observation.station, 'orderQueue', 'Named admission entered Orders');
  } else {
    assert.equal(request.kind, 'move', 'Known gameplay request');
    if (request.to === 'served') {
      assert.equal(observation.status, 'served', 'Named delivery is served, not merely missing');
      assert.equal(observation.activePresent, false, 'Delivered ticket left active stations');
      assert.equal(observation.servedAfter, request.servedBefore + 1, 'Exactly one real delivery was observed');
      assert.equal(observation.feedback, 'Delivered. Pull or select another ticket.', 'Delivery feedback confirms this request');
      if (isVipTicket(request.ticket)) assert.match(observation.vipOutcome ?? '', /^Served (on time|late)$/, 'Named VIP served outcome');
    } else {
      assert.equal(observation.status, 'active', 'Moved ticket remains active');
      assert.equal(observation.station, request.to, 'Named ticket reached the requested station');
    }
  }
  return { disposition: 'confirmed', ticket: request.ticket, kind: request.kind, to: request.to ?? 'orderQueue', evidence: observation };
}

export function assertFinalTicketResults(tickets, summary) {
  assert.ok(Array.isArray(tickets), 'Final named ticket DOM results exist');
  assert.equal(tickets.length, NORMAL_VIP_RUN.orders, 'Final DOM accounts for all 15 canonical orders');
  assert.equal(new Set(tickets.map(t => t.ticket)).size, NORMAL_VIP_RUN.orders, 'Unique final ticket keys');
  const stations = ['orderQueue', 'prep', 'oven', 'boxDeliver'];
  for (let n = 1; n <= NORMAL_VIP_RUN.orders; n++) {
    const row = tickets.find(t => t.ticket === `order-${n}`);
    assert.ok(row, `Final named result for order-${n}`);
    assert.ok(['not-admitted', 'active', 'served', 'burnt', 'discarded'].includes(row.status), 'Canonical FinalOrder outcome');
    if (row.status === 'not-admitted') assert.equal(row.admittedAtMs, null, 'Unadmitted ticket has no admission timestamp');
    else assert.ok(Number.isSafeInteger(row.admittedAtMs) && row.admittedAtMs >= 0 && row.admittedAtMs <= NORMAL_VIP_RUN.horizonMs, 'Real admission timestamp in observation');
    if (row.status === 'active') assert.ok(stations.includes(row.station), 'Active final ticket has a station');
    else assert.equal(row.station, null, 'Non-active final ticket has no station');
  }
  const count = (status, vip) => tickets.filter(t => t.status === status && (vip === undefined || isVipTicket(t.ticket) === vip)).length;
  assert.equal(count('served'), summary.served, 'Final named served results agree with total service');
  assert.equal(count('burnt'), summary.burnt, 'Final named burnt results agree with total burns');
  assert.equal(count('served', true), summary.vipLatency.servedN, 'Final named VIP service matches VIP sample');
  assert.equal(count('served', false), summary.normalArrivalLatency.servedN, 'Final named Normal service matches Normal sample');
  assert.equal(count('burnt', true), summary.vip.burnt, 'Final named VIP burns match outcome partition');
  return tickets;
}

export function reconcileHorizonAction(request, finalResult) {
  assert.equal(finalResult.variant, request.variant, 'Horizon belongs to this requested run variant');
  assert.equal(finalResult.id, request.runId, 'Horizon belongs to this requested run ID');
  assert.match(finalResult.observation ?? '', /Actual observation:\s*300 simulated seconds\s*·\s*horizon\s*·/, 'Recovery requires the actual full Normal horizon');
  const row = finalResult.tickets?.find(t => t.ticket === request.ticket);
  assert.ok(row, `Reconcile missing active ${request.ticket} against its named final result`);
  let confirmed = false;
  if (request.kind === 'admit') confirmed = row.admittedAtMs !== null && row.status === 'active' && row.station === 'orderQueue';
  else if (request.kind === 'move') confirmed = request.to === 'served'
    ? row.status === 'served'
    : row.status === 'active' && row.station === request.to;
  else assert.equal(request.kind, 'select', 'Known pending horizon request');
  if (!confirmed && request.kind !== 'select') {
    const unchanged = request.kind === 'admit' ? row.status === 'not-admitted'
      : (row.status === 'active' && row.station === request.from) || (request.from === 'oven' && row.status === 'burnt');
    assert.ok(unchanged, 'Horizon final ticket must confirm the transition or prove unchanged/burnt rejection');
  }
  return { disposition: confirmed ? 'confirmed' : 'rejected', reason: confirmed ? 'named-final-result' : 'horizon-before-transition',
    ticket: request.ticket, kind: request.kind, to: request.to ?? null, evidence: row };
}
