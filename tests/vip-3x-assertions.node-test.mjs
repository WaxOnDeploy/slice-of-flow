import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORMAL_VIP_RUN, assertThreeXDuration, assertThreeXCheckpoint, numericSummary,
  isExpectedLocatorRemovalError, assertActionConfirmation, assertFinalTicketResults,
  reconcileHorizonAction,
} from './vip-3x-assertions.mjs';

function rendered(overrides = {}) {
  return {
    id: 'run-fifo', variant: 'fifo', observation: 'Actual observation: 300 simulated seconds · horizon · complete engine-boundary ledger.',
    values: {
      'VIP outcomes (all three orders)': 'On time: 1 · Late: 1 · Pending: 0 · Not yet arrived: 0 · Burnt: 1',
      'Total served / burnt / angry': '6 / 1 / 0',
      'VIP arrival-to-served mean': '85 simulated seconds · observed served n = 2',
      'Normal arrival-to-served mean': '120 simulated seconds · observed served n = 4',
      'Normal Orders-to-served mean': '90 simulated seconds · observed served n = 4',
      'Final canonical VIP score': '2 points · 1 deadline penalties',
      ...overrides,
    },
  };
}
function tickets() {
  return Array.from({ length: 15 }, (_, i) => {
    const n = i + 1;
    const served = n <= 4 || n === 13 || n === 14;
    return { ticket: `order-${n}`, status: served ? 'served' : n === 15 ? 'burnt' : 'not-admitted',
      station: null, admittedAtMs: served || n === 15 ? 10000 : null };
  });
}
const request = (changes = {}) => ({ kind: 'move', ticket: 'order-13', from: 'prep', to: 'oven', variant: 'fifo', runId: 'run-fifo', ...changes });
const final = (row, changes = {}) => ({ ...rendered(), tickets: [row], ...changes });

test('canonical manifest bounds and observed 100s browser duration', () => {
  assert.deepEqual(NORMAL_VIP_RUN, { horizonMs: 300000, speed: 3, orders: 15, normals: 12, vips: 3, normalPatienceMs: 480000, shortestRecipeMs: 70000 });
  for (const ms of [95000, 100000, 100216, 110000]) assertThreeXDuration(ms);
});
for (const [label, ms] of [['effective 2×', 150000], ['effective 4×', 75000], ['too early', 94999], ['too late', 110001], ['invalid', NaN]]) {
  test(`duration rejects ${label}`, () => assert.throws(() => assertThreeXDuration(ms), assert.AssertionError));
}
test('clock checkpoints allow documented DOM rounding and scheduling tolerance', () => {
  for (const simulated of [60, 150, 240]) {
    assertThreeXCheckpoint({ wallElapsedMs: simulated * 1000 / 3 + 216, simulatedElapsedSecondsApprox: simulated });
  }
  assertThreeXCheckpoint({ wallElapsedMs: 17500, simulatedElapsedSecondsApprox: 60 });
  assertThreeXCheckpoint({ wallElapsedMs: 25000, simulatedElapsedSecondsApprox: 60 });
});
for (const speed of [2, 4]) test(`checkpoint rejects effective ${speed}×`, () => {
  assert.throws(() => assertThreeXCheckpoint({ wallElapsedMs: 150000 / speed, simulatedElapsedSecondsApprox: 150 }), assert.AssertionError);
});
test('valid mixed results allow no asserted policy winner', () => {
  const s = numericSummary(rendered());
  assert.equal(s.served, 6); assert.equal(s.vip.onTime, 1); assert.equal(s.vipLatency.servedN, 2);
  assert.equal(s.normalOrdersLatency.equivalentUnpausedRealSecondsAt3x, 30);
});
test('all VIPs may validly be late and unserved', () => {
  const r = rendered({
    'VIP outcomes (all three orders)': 'On time: 0 · Late: 3 · Pending: 0 · Not yet arrived: 0 · Burnt: 0',
    'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0',
    'Total served / burnt / angry': '4 / 0 / 0',
    'Final canonical VIP score': '1 points · 3 deadline penalties',
  });
  assert.equal(numericSummary(r).vip.onTime, 0);
});
const contradictions = [
  ['review reproduction', { 'VIP outcomes (all three orders)': 'On time: 3 · Late: 0 · Pending: 0 · Not yet arrived: 0 · Burnt: 0',
    'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0',
    'Normal arrival-to-served mean': '0 simulated seconds · observed served n = 1',
    'Normal Orders-to-served mean': '0 simulated seconds · observed served n = 1',
    'Total served / burnt / angry': '1 / 0 / 999', 'Final canonical VIP score': '999 points · 99 deadline penalties' }],
  ['on-time VIP but zero VIP service', { 'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0', 'Total served / burnt / angry': '4 / 1 / 0', 'Final canonical VIP score': '0 points · 1 deadline penalties' }],
  ['more than 15 total resolved', { 'Total served / burnt / angry': '6 / 10 / 0', 'Final canonical VIP score': '-16 points · 1 deadline penalties' }],
  ['more than 12 Normal samples', { 'Normal arrival-to-served mean': '100 simulated seconds · observed served n = 13' }],
  ['more than 3 VIP samples', { 'VIP arrival-to-served mean': '100 simulated seconds · observed served n = 4' }],
  ['VIP served sample includes burn', { 'VIP arrival-to-served mean': '100 simulated seconds · observed served n = 3', 'Total served / burnt / angry': '7 / 1 / 0', 'Final canonical VIP score': '3 points · 1 deadline penalties' }],
  ['VIP burns exceed total', { 'Total served / burnt / angry': '6 / 0 / 0', 'Final canonical VIP score': '7 points · 1 deadline penalties' }],
  ['Normal served and burns exceed 12', {
    'VIP outcomes (all three orders)': 'On time: 0 · Late: 2 · Pending: 0 · Not yet arrived: 0 · Burnt: 1',
    'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0',
    'Total served / burnt / angry': '4 / 11 / 0', 'Final canonical VIP score': '-22 points · 2 deadline penalties',
  }],
  ['normal anger before 480s', { 'Total served / burnt / angry': '6 / 1 / 1', 'Final canonical VIP score': '1 points · 1 deadline penalties' }],
  ['late differs from penalties', { 'Final canonical VIP score': '0 points · 2 deadline penalties' }],
  ['wrong canonical score', { 'Final canonical VIP score': '99 points · 1 deadline penalties' }],
  ['recipe shorter than 70s', { 'Normal Orders-to-served mean': '69.99 simulated seconds · observed served n = 4' }],
  ['VIP latency shorter than 70s', { 'VIP arrival-to-served mean': '0 simulated seconds · observed served n = 2' }],
  ['arrival mean below Orders mean', { 'Normal arrival-to-served mean': '89.98 simulated seconds · observed served n = 4' }],
  ['latency outside horizon', { 'Normal arrival-to-served mean': '300.01 simulated seconds · observed served n = 4' }],
  ['zero sample rendered as numeric zero', { 'VIP arrival-to-served mean': '0 simulated seconds · observed served n = 0' }],
  ['nonempty sample rendered as N/A', { 'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 2' }],
  ['mismatched Normal samples', { 'Normal Orders-to-served mean': '90 simulated seconds · observed served n = 3' }],
  ['pending at full horizon', { 'VIP outcomes (all three orders)': 'On time: 1 · Late: 0 · Pending: 1 · Not yet arrived: 0 · Burnt: 1' }],
  ['missing VIP arrival at full horizon', { 'VIP outcomes (all three orders)': 'On time: 1 · Late: 0 · Pending: 0 · Not yet arrived: 1 · Burnt: 1' }],
];
for (const [name, overrides] of contradictions) test(`summary rejects ${name}`, () => assert.throws(() => numericSummary(rendered(overrides)), assert.AssertionError));
test('means permit independent 0.01s UI rounding only', () => {
  numericSummary(rendered({ 'Normal arrival-to-served mean': '89.99 simulated seconds · observed served n = 4' }));
});
test('all-zero results cannot claim real automated work', () => {
  assert.throws(() => numericSummary(rendered({
    'Total served / burnt / angry': '0 / 0 / 0',
    'VIP arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0',
    'Normal arrival-to-served mean': 'N/A (no observed samples) · observed served n = 0',
    'Normal Orders-to-served mean': 'N/A (no observed samples) · observed served n = 0',
  })), assert.AssertionError);
});
test('admission and station movement require the exact named destination', () => {
  assertActionConfirmation(request({ kind: 'admit', to: undefined }), { ticket: 'order-13', status: 'active', station: 'orderQueue' });
  assertActionConfirmation(request(), { ticket: 'order-13', status: 'active', station: 'oven' });
});
for (const [name, req, evidence] of [
  ['enabled no-op admission', request({ kind: 'admit' }), { ticket: 'order-13', status: 'not-admitted', station: null }],
  ['enabled no-op movement', request(), { ticket: 'order-13', status: 'active', station: 'prep' }],
  ['unrelated ticket transition', request(), { ticket: 'order-14', status: 'active', station: 'oven' }],
  ['disappearance is not delivery', request({ to: 'served', servedBefore: 4 }), { ticket: 'order-13', status: 'missing', activePresent: false }],
]) test(`action rejects ${name}`, () => assert.throws(() => assertActionConfirmation(req, evidence), assert.AssertionError));
const delivery = { ticket: 'order-13', status: 'served', activePresent: false, servedAfter: 5, feedback: 'Delivered. Pull or select another ticket.', vipOutcome: 'Served late' };
test('delivery proves removal, increment, feedback and named VIP served outcome', () => assertActionConfirmation(request({ to: 'served', servedBefore: 4 }), delivery));
for (const [name, overrides] of [
  ['unchanged served count', { servedAfter: 4 }], ['unrelated feedback', { feedback: 'Normal Order 1 selected.' }],
  ['VIP burnt not served', { vipOutcome: 'Burnt' }], ['active still exists', { activePresent: true }],
]) test(`delivery rejects ${name}`, () => assert.throws(() => assertActionConfirmation(request({ to: 'served', servedBefore: 4 }), { ...delivery, ...overrides }), assert.AssertionError));
test('all 15 final named ticket results reconcile with aggregates', () => assertFinalTicketResults(tickets(), numericSummary(rendered())));
for (const [name, mutate] of [
  ['missing final ticket', rows => rows.pop()], ['duplicate ticket', rows => { rows[1] = rows[0]; }],
  ['wrong served status', rows => { rows[0].status = 'burnt'; }],
  ['unadmitted timestamp', rows => { rows[4].admittedAtMs = 1; }],
  ['active without station', rows => { rows[4].status = 'active'; rows[4].admittedAtMs = 1; }],
]) test(`final ticket DOM rejects ${name}`, () => { const rows = tickets(); mutate(rows); assert.throws(() => assertFinalTicketResults(rows, numericSummary(rendered())), assert.AssertionError); });
test('horizon confirms a named move only when final station proves it', () => {
  assert.equal(reconcileHorizonAction(request(), final({ ticket: 'order-13', status: 'active', station: 'oven' })).disposition, 'confirmed');
  assert.equal(reconcileHorizonAction(request(), final({ ticket: 'order-13', status: 'active', station: 'prep' })).disposition, 'rejected');
});
test('horizon reconciles admission and service by named final status', () => {
  const req = request({ kind: 'admit' });
  assert.equal(reconcileHorizonAction(req, final({ ticket: 'order-13', status: 'active', station: 'orderQueue', admittedAtMs: 299999 })).disposition, 'confirmed');
  assert.equal(reconcileHorizonAction(req, final({ ticket: 'order-13', status: 'not-admitted', station: null, admittedAtMs: null })).disposition, 'rejected');
  assert.equal(reconcileHorizonAction(request({ from: 'boxDeliver', to: 'served' }), final({ ticket: 'order-13', status: 'served', station: null })).disposition, 'confirmed');
  assert.equal(reconcileHorizonAction(request({ from: 'boxDeliver', to: 'served' }), final({ ticket: 'order-13', status: 'active', station: 'boxDeliver' })).disposition, 'rejected');
});
for (const [name, value] of [
  ['manual stop', { observation: 'Actual observation: 300 simulated seconds · Manual end — not matched' }],
  ['wrong duration', { observation: 'Actual observation: 299 simulated seconds · horizon · complete engine-boundary ledger.' }],
  ['wrong run', { id: 'other-run' }], ['wrong variant', { variant: 'expedite' }], ['missing named ticket', { tickets: [] }],
]) test(`horizon reconciliation rejects ${name}`, () => assert.throws(() => reconcileHorizonAction(request(), final({ ticket: 'order-13', status: 'active', station: 'oven' }, value)), assert.AssertionError));
test('horizon cannot silently accept an unrelated ticket status', () => {
  assert.throws(() => reconcileHorizonAction(request(), final({ ticket: 'order-13', status: 'served', station: null })), assert.AssertionError);
});
const removal = { name: 'TimeoutError', message: 'locator.click: Timeout 1500ms exceeded.\nCall log:\n  - waiting for getByTestId(\'vip-round\').locator(\'[data-vip-ticket="order-13"]\')' };
test('only specific Playwright locator-removal click timeouts are recovery candidates', () => {
  assert.equal(isExpectedLocatorRemovalError(removal), true);
  assert.equal(isExpectedLocatorRemovalError({ ...removal, message: 'locator.click: Timeout 1500ms exceeded.\n element was detached from the DOM' }), true);
});
test('terminal WebKit detachment remains a candidate after an earlier stability retry, including ANSI output', () => {
  const message = `${removal.message}\n\u001b[2m - element is not stable\u001b[22m\n - retrying click action\n\u001b[2m - element was detached from the DOM, retrying\u001b[22m\n`;
  assert.equal(isExpectedLocatorRemovalError({ ...removal, message }), true);
  // A stability-only timeout is not detachment and must still fail.
  assert.equal(isExpectedLocatorRemovalError({ ...removal, message: `${removal.message}\n - element is not stable\n` }), false);
  // Earlier detachment cannot conceal a later stability problem.
  assert.equal(isExpectedLocatorRemovalError({ ...removal, message: `${removal.message}\n - element was detached from the DOM\n - element is not stable\n` }), false);
  for (const hardFailure of ['overlay intercepts pointer events', 'element is not enabled', 'strict mode violation']) {
    assert.equal(isExpectedLocatorRemovalError({ ...removal, message: `${removal.message}\n - ${hardFailure}\n - element was detached from the DOM\n` }), false);
  }
});
for (const [name, error, operation] of [
  ['TypeError at horizon', new TypeError('Unexpected evaluation'), undefined],
  ['ordinary error at horizon', new Error('unexpected'), undefined],
  ['assertion at horizon', new assert.AssertionError({ message: 'wrong result' }), undefined],
  ['page evaluation failure', { ...removal, message: 'page.evaluate: Something failed' }, undefined],
  ['page closed', { ...removal, message: `${removal.message}\n Target page, context or browser has been closed` }, undefined],
  ['pointer interception', { ...removal, message: `${removal.message}\n overlay intercepts pointer events` }, undefined],
  ['still-disabled action', { ...removal, message: `${removal.message}\n element is not enabled` }, undefined],
  ['non-click timeout', removal, 'locator.innerText'],
  ['fake Error carrying click text', { name: 'Error', message: removal.message }, undefined],
]) test(`horizon recovery rejects ${name}`, () => assert.equal(isExpectedLocatorRemovalError(error, operation), false));
