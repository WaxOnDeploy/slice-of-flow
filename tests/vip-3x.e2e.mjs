import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';
import {
  numericSummary, assertThreeXDuration, assertThreeXCheckpoint,
  isExpectedLocatorRemovalError, assertActionConfirmation, assertFinalTicketResults,
  reconcileHorizonAction, isVipTicket,
} from './vip-3x-assertions.mjs';

// UI-only play: no clock mocking, store injection or manufactured result archives.
const output = process.env.SOF_TEST_OUTPUT || 'test-results/round3-3x/browser';
const names = (process.env.SOF_BROWSERS || 'chromium').split(',').map(s => s.trim());
const engines = { chromium, firefox, webkit };
const results = [];
let harness;
let stage = 'setup';
const player = 'Downstream-first; FIFO pulls oldest; expedite pulls earliest eligible VIP first and prioritizes VIPs within each station. No preemption, reserved capacity, artificial waits or early ends.';

async function readResult(root) {
  const result = root.getByTestId('vip-results').first();
  await result.waitFor({ timeout: 5000 });
  return result.evaluate(node => ({
    id: node.dataset.runId, variant: node.dataset.variant,
    observation: Array.from(node.querySelectorAll('p')).find(n => n.textContent.includes('Actual observation:'))?.textContent.trim(),
    values: Object.fromEntries(Array.from(node.querySelectorAll('dl > div')).map(div => [div.querySelector('dt').textContent.trim(), div.querySelector('dd').textContent.trim()])),
    tickets: Array.from(node.querySelectorAll('[data-vip-ticket][data-vip-status]')).map(n => ({
      ticket: n.dataset.vipTicket, status: n.dataset.vipStatus, station: n.dataset.vipStation || null,
      admittedAtMs: n.dataset.vipAdmittedAtMs ? Number(n.dataset.vipAdmittedAtMs) : null,
    })),
    text: node.innerText,
  }));
}

async function actionObservation(root, ticket) {
  // One read-only DOM snapshot: no locator existence/actionability races in queries.
  return root.evaluate((n, key) => {
    const active = Array.from(n.querySelectorAll('[data-testid="vip-board"] [data-vip-ticket]')).find(t => t.dataset.vipTicket === key);
    const vipRow = Array.from(n.querySelectorAll('.sof-vip-arrivals li')).find(row => row.querySelector('strong')?.textContent.trim() === `VIP Order ${key.split('-')[1]}`);
    const servedText = n.querySelector('[data-testid="vip-live-scores"]')?.textContent;
    return {
      ticket: key, ended: !!n.querySelector('[data-testid="vip-results"]'),
      activePresent: !!active, status: active ? 'active' : 'missing', station: active?.dataset.vipStation || null,
      selected: active?.getAttribute('aria-pressed') === 'true',
      servedAfter: servedText?.match(/Served:\s*(\d+)/) ? Number(servedText.match(/Served:\s*(\d+)/)[1]) : null,
      feedback: n.querySelector('.sof-lab-feedback[role="status"]')?.textContent.trim(),
      vipOutcome: vipRow?.querySelector('span')?.textContent.trim() || null,
    };
  }, ticket);
}

async function play(page, root, variant, trace, browserName) {
  stage = `${variant}: instruction and first move`;
  await root.getByRole('button', { name: variant === 'fifo' ? 'Start FIFO baseline' : 'Start VIP/expedite', exact: true }).click();
  await page.getByRole('button', { name: 'Try first order', exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.match(await root.getByTestId('vip-timer').innerText(), /300 simulated seconds/);
  await page.getByRole('button', { name: 'Try first order', exact: true }).click();
  const first = root.getByTestId('vip-board').locator('[data-vip-ticket="order-1"]');
  await first.waitFor();
  const runId = await root.evaluate(n => Array.from(n.querySelectorAll('p')).find(p => p.textContent.includes('Active run ID:'))?.querySelector('code')?.textContent.trim());
  assert.ok(runId, 'Captured the actual active UI run ID');
  await page.waitForTimeout(250);
  assert.match(await root.getByTestId('vip-timer').innerText(), /300 simulated seconds/);
  await first.focus(); await page.keyboard.press('Enter');
  const started = performance.now(); // Monotonic; immediately before clock-unlocking move.
  const guidedRequest = { kind: 'move', ticket: 'order-1', from: 'orderQueue', to: 'prep', variant, runId };
  trace.push({ variant, kind: 'move-requested', wallElapsedMs: 0, simulatedElapsedSecondsApprox: 0, request: guidedRequest });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-testid="vip-board"] [data-vip-ticket="order-1"]')?.dataset.vipStation === 'prep');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-vip-ticket') === 'order-1');
  const arrivalSeen = new Set();
  let progressAt = performance.now();
  const endBy = started + 160000;
  let pollCount = 0;
  const observations = [];
  const actions = [];
  const checkpoints = [];
  const checkpointTargets = [60, 150, 240];
  const record = async (kind, details = {}) => {
    const timer = await root.evaluate(n => n.querySelector('[data-testid="vip-timer"]')?.textContent || null);
    const remaining = timer?.match(/remaining:\s*(\d+)/)?.[1];
    const event = { variant, kind, wallElapsedMs: Math.round(performance.now() - started), simulatedElapsedSecondsApprox: remaining === undefined ? null : 300 - Number(remaining), ...details };
    trace.push(event); return event;
  };
  actions.push(assertActionConfirmation(guidedRequest, await actionObservation(root, 'order-1')));
  await record('move-confirmed', { request: guidedRequest, confirmation: actions.at(-1), guided: true });

  const reconcileAtHorizon = async request => {
    const rendered = await readResult(root);
    const summary = numericSummary(rendered);
    assertFinalTicketResults(rendered.tickets, summary);
    const confirmation = reconcileHorizonAction(request, rendered);
    actions.push(confirmation);
    await record(`${request.kind}-${confirmation.disposition}`, { request, confirmation, horizonReconciliation: true });
    return { horizon: true, confirmation };
  };
  const click = async (locator, request) => {
    let locatorRemovalError;
    // ONLY this locator operation is inside the recovery catch. Parsing,
    // evaluation, trace writes and assertions below must propagate every error.
    try { await locator.click({ timeout: 1500 }); }
    catch (error) {
      if (!isExpectedLocatorRemovalError(error)) throw error;
      locatorRemovalError = error;
    }
    if (locatorRemovalError) {
      const observed = await actionObservation(root, request.ticket);
      // Removal of the specific click target + actual horizon are mandatory.
      if (!observed.ended || await locator.count() !== 0) throw locatorRemovalError;
      const reconciled = await reconcileAtHorizon(request);
      await record('horizon-locator-removal', { request, message: locatorRemovalError.message, confirmation: reconciled.confirmation });
      return reconciled;
    }
    return { horizon: false };
  };
  const confirm = async request => {
    const deadline = performance.now() + 1500;
    let observed;
    do {
      observed = await actionObservation(root, request.ticket);
      if (observed.ended) return reconcileAtHorizon(request);
      if (request.kind === 'admit' ? observed.activePresent && observed.station === 'orderQueue'
        : request.to === 'served' ? !observed.activePresent && observed.servedAfter === request.servedBefore + 1 && observed.feedback === 'Delivered. Pull or select another ticket.'
          : observed.activePresent && observed.station === request.to) {
        if (request.to === 'served') observed.status = 'served';
        const confirmation = assertActionConfirmation(request, observed);
        actions.push(confirmation);
        await record(`${request.kind}-confirmed`, { request, confirmation });
        return { horizon: false, confirmation };
      }
      await page.waitForTimeout(50);
    } while (performance.now() < deadline);
    const rejection = { disposition: 'rejected', reason: 'no-confirmed-dom-transition', request, evidence: observed };
    actions.push(rejection);
    await record(`${request.kind}-rejected`, rejection);
    assert.fail(`Enabled ${request.kind} for ${request.ticket} did not confirm ${request.to || 'Orders'} within 1500ms; feedback: ${observed.feedback}`);
  };
  const perform = async (locator, request) => {
    await record(`${request.kind}-requested`, { request });
    const clicked = await click(locator, request);
    return clicked.horizon ? clicked : confirm(request);
  };

  stage = `${variant}: 300s horizon at 3×`;
  console.log(stage);
  while (true) {
    assert.ok(performance.now() < endBy, `${variant} did not reach horizon within 160 real seconds`);
    const activeState = await root.evaluate(n => ({
      ended: !!n.querySelector('[data-testid="vip-results"]'), visibility: document.visibilityState,
      pause: n.querySelector('[data-testid="vip-pause-status"]')?.textContent.trim(),
      speed: Array.from(n.querySelectorAll('button')).find(b => b.textContent === '3×')?.getAttribute('aria-pressed'),
      timer: n.querySelector('[data-testid="vip-timer"]')?.textContent.trim(),
    }));
    if (activeState.ended) break;
    assert.equal(activeState.visibility, 'visible', 'Clean matched pair must remain visible');
    assert.match(activeState.pause, /^Kitchen running\./);
    assert.equal(activeState.speed, 'true');
    const elapsedSim = 300 - Number(activeState.timer?.match(/remaining:\s*(\d+)/)?.[1]);
    assert.ok(Number.isInteger(elapsedSim) && elapsedSim >= 0 && elapsedSim <= 300, 'Observed actual running UI clock');
    while (checkpointTargets.length && elapsedSim >= checkpointTargets[0]) {
      const target = checkpointTargets.shift();
      const checkpoint = assertThreeXCheckpoint({ wallElapsedMs: Math.round(performance.now() - started), simulatedElapsedSecondsApprox: elapsedSim });
      checkpoints.push({ targetSimulatedSeconds: target, ...checkpoint });
      await record('clock-checkpoint', checkpoints.at(-1));
    }
    if (performance.now() - progressAt > 20000) {
      console.log(`${variant}: ${(await record('progress')).simulatedElapsedSecondsApprox}s simulated elapsed`);
      progressAt = performance.now();
      await writeFile(path.join(output, 'action-trace-in-progress.json'), JSON.stringify(trace, null, 2));
    }
    if (pollCount++ % 3 === 0) {
      const arrivals = await root.locator('.sof-vip-arrivals li').evaluateAll(nodes => nodes.map(n => ({ text: n.innerText })));
      for (const arrival of arrivals) {
        const key = arrival.text.match(/VIP Order (\d+)/)?.[1];
        if (key && !/Not yet arrived/.test(arrival.text) && !arrivalSeen.has(key)) {
          arrivalSeen.add(key); observations.push(await record('arrival-observed', { ticket: `order-${key}`, text: arrival.text }));
        }
      }
    }
    for (const station of ['boxDeliver', 'oven', 'prep', 'orderQueue']) {
      if (await root.getByTestId('vip-results').count()) break;
      const items = await root.getByTestId('vip-board').locator(`[data-vip-ticket][data-vip-station="${station}"]`).evaluateAll(nodes => nodes.map(n => ({ key: n.dataset.vipTicket, text: n.innerText })));
      // Ready downstream work first. Expedite prioritizes VIPs; no fabricated result target.
      items.sort((a, b) => (variant === 'expedite' ? Number(/^VIP/.test(b.text)) - Number(/^VIP/.test(a.text)) : 0) || Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]));
      for (const item of items) {
        if (['prep', 'oven'].includes(station) && !/\bReady\b/.test(item.text)) continue;
        const ticket = root.getByTestId('vip-board').locator(`[data-vip-ticket="${item.key}"]`);
        const selection = { kind: 'select', ticket: item.key, from: station, variant, runId };
        const selected = await click(ticket, selection);
        if (selected.horizon) break;
        const observed = await actionObservation(root, item.key);
        if (observed.ended) { await reconcileAtHorizon(selection); break; }
        assert.equal(observed.selected, true, `Selected the named ${item.key}, not an unrelated ticket`);
        const destination = await root.evaluate(n => {
          const action = n.querySelector('[data-vip-destination]');
          return { ended: !!n.querySelector('[data-testid="vip-results"]'), enabled: !!action && !action.disabled, to: action?.dataset.vipDestination };
        });
        if (destination.ended) { await reconcileAtHorizon(selection); break; }
        if (destination.enabled) {
          const expected = { orderQueue: 'prep', prep: 'oven', oven: 'boxDeliver', boxDeliver: 'served' }[station];
          assert.equal(destination.to, expected, 'Named selected ticket has its next legal station');
          assert.equal(observed.station, station, 'Captured ticket is still at the requested source');
          const request = { kind: 'move', ticket: item.key, from: station, to: destination.to, servedBefore: observed.servedAfter, variant, runId };
          if (request.to === 'served') assert.ok(Number.isSafeInteger(request.servedBefore), 'Observed real live served count before delivery');
          await perform(root.locator('[data-vip-destination]'), request);
          break;
        }
      }
    }
    const pullState = await root.evaluate((n, policy) => {
      const byName = name => Array.from(n.querySelectorAll('button')).find(b => b.textContent.trim() === name);
      const vip = byName('Pull earliest VIP into Orders');
      const normal = byName(policy === 'fifo' ? 'Pull oldest available ticket (FIFO)' : 'Pull next Normal order into Orders');
      const pull = policy === 'expedite' && vip && !vip.disabled ? vip : normal;
      return { ended: !!n.querySelector('[data-testid="vip-results"]'), enabled: !!pull && !pull.disabled, ticket: pull?.dataset.vipAdmit, name: pull?.textContent.trim() };
    }, variant);
    if (pullState.ended) break;
    if (pullState.enabled) {
      assert.match(pullState.ticket ?? '', /^order-(?:[1-9]|1[0-5])$/, 'Admission button names a canonical ticket');
      const request = { kind: 'admit', ticket: pullState.ticket, variant, runId };
      await perform(root.getByRole('button', { name: pullState.name, exact: true }), request);
    }
    await page.waitForTimeout(100);
  }
  const wallElapsedMs = Math.round(performance.now() - started);
  const timing = assertThreeXDuration(wallElapsedMs);
  assert.equal(checkpoints.length, 3, 'Observed all intermediate 3× clock checkpoints');
  const rendered = await readResult(root);
  assert.equal(rendered.id, runId, 'Actual result retains the active run identity');
  assert.equal(rendered.variant, variant);
  assert.match(rendered.observation, /300 simulated seconds\s*·\s*horizon/);
  assert.equal(arrivalSeen.size, 3, 'Observed all three VIP arrivals');
  const summary = numericSummary(rendered);
  assertFinalTicketResults(rendered.tickets, summary);
  const actionCounts = {
    requested: trace.filter(e => e.variant === variant && ['admit-requested', 'move-requested'].includes(e.kind)).length,
    confirmed: actions.filter(a => a.disposition === 'confirmed' && ['admit', 'move'].includes(a.kind)).length,
    rejected: actions.filter(a => a.disposition === 'rejected' && ['admit', 'move'].includes(a.kind)).length,
    confirmedDeliveries: actions.filter(a => a.disposition === 'confirmed' && a.kind === 'move' && a.to === 'served').length,
    confirmedVipAdmissions: actions.filter(a => a.disposition === 'confirmed' && a.kind === 'admit' && isVipTicket(a.ticket)).length,
  };
  assert.equal(actionCounts.requested, actionCounts.confirmed + actionCounts.rejected, 'Every gameplay request has confirmed or rejected evidence');
  assert.ok(actionCounts.confirmedDeliveries > 0, 'Automated player confirmed a named real delivery');
  if (variant === 'expedite') assert.ok(actionCounts.confirmedVipAdmissions > 0, 'Expedite actually admitted a named VIP; enabled no-op VIP pulls must fail');
  await page.screenshot({ path: path.join(output, `${browserName}-${variant}-result.png`), fullPage: true });
  console.log(`${variant}: finished in ${wallElapsedMs / 1000}s wall; ${summary.served} served, ${summary.vip.onTime} VIPs on time, ${actionCounts.confirmedVipAdmissions} confirmed VIP admissions`);
  return { ...rendered, ...summary, wallElapsedMs, timing, checkpoints, actionCounts, actionConfirmations: actions, arrivalObservations: observations };
}

try {
  await mkdir(output, { recursive: true });
  for (const name of names) assert.ok(engines[name], `Unsupported browser: ${name}`);
  stage = 'HTTPS harness acquisition';
  harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4184));
  for (const name of names) {
    let browser; let page;
    const trace = []; const errors = []; const csp = []; const uploads = [];
    try {
      stage = `${name}: browser launch`;
      browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: harness.local });
      page = await context.newPage();
      page.setDefaultTimeout(2500);
      page.on('pageerror', e => errors.push(e.message));
      context.on('request', r => { if (!['GET', 'HEAD'].includes(r.method())) uploads.push({ method: r.method(), url: r.url() }); });
      await page.exposeFunction('vipCspEvent', e => csp.push(e));
      await page.addInitScript(() => {
        sessionStorage.setItem('sof-splash-seen', '1');
        document.addEventListener('securitypolicyviolation', e => window.vipCspEvent({ directive: e.effectiveDirective, uri: e.blockedURI }));
      });
      await page.goto(new URL('?round3=1', harness.base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const root = page.getByTestId('vip-round'); await root.waitFor({ timeout: 15000 });
      await root.getByLabel('Next run difficulty', { exact: true }).selectOption('normal');
      await root.getByLabel('Next run speed', { exact: true }).selectOption('3');
      assert.equal(await root.getByRole('button', { name: 'Start VIP/expedite', exact: true }).isEnabled(), false);
      const baseline = await play(page, root, 'fifo', trace, name);
      const subject = await play(page, root, 'expedite', trace, name);
      assert.notEqual(baseline.id, subject.id);
      const b = root.getByLabel('Baseline attempt', { exact: true });
      const a = root.getByLabel('Expedite attempt', { exact: true });
      assert.equal(await b.inputValue(), ''); assert.equal(await a.inputValue(), '');
      await b.selectOption(baseline.id); await a.selectOption(subject.id);
      stage = `${name}: matched comparison`;
      const comparison = root.getByTestId('vip-comparison');
      const text = await comparison.innerText();
      assert.match(text, /Basis:\s*matched\./);
      const table = await comparison.getByTestId('vip-comparison-table').locator('tbody tr').evaluateAll(rows => rows.map(row => Array.from(row.children).map(cell => cell.textContent.trim())));
      assert.equal(table.length, 12);
      assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(uploads, []);
      results.push({ browser: name, settings: { difficulty: 'normal', speed: 3, horizonSimulatedSeconds: 300 }, player, baseline, subject, comparisonBasis: 'matched', table, runtimeErrors: errors, cspViolations: csp, resultUploads: uploads,
        interpretation: 'Automated UI observations, not human-play evidence or a promised expedite advantage. Rendered means are rounded; requested/confirmed/rejected trace times are DOM observation times, not exact engine boundaries. Horizon races reconcile the named canonical final ticket, never aggregate disappearance. Real-equivalent latency is simulated latency / 3; the actual horizon stopwatch is measured independently with documented timing gates.' });
      await writeFile(path.join(output, `${name}-action-trace.json`), JSON.stringify(trace, null, 2));
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      await page.screenshot({ path: path.join(output, `${name}-comparison.png`), fullPage: true });
      console.log(`${name}: clean 3× pair passed and explicitly matched`);
      await context.close();
    } catch (error) {
      if (page && !page.isClosed()) {
        // Best-effort diagnostic capture never changes the failed verdict.
        await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
        await writeFile(path.join(output, 'failure-page.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable'));
      }
      await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, message: error.message, stack: error.stack, trace, runtimeErrors: errors, cspViolations: csp, resultUploads: uploads }, null, 2));
      throw error;
    } finally { if (browser) await browser.close(); }
  }
} catch (error) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'run-failure.json'), JSON.stringify({ stage, message: error.message, stack: error.stack, completedBrowsers: results.map(r => r.browser) }, null, 2));
  throw error;
} finally { if (harness) await harness.close(); }
