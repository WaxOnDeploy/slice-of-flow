import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

// UI-only play: no clock mocking, store injection or manufactured result archives.
const output = process.env.SOF_TEST_OUTPUT || 'test-results/round3-3x/browser';
const names = (process.env.SOF_BROWSERS || 'chromium').split(',').map(s => s.trim());
const engines = { chromium, firefox, webkit };
for (const name of names) assert.ok(engines[name], `Unsupported browser: ${name}`);
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4184));
const results = [];
let stage = 'setup';
const player = 'Downstream-first; FIFO pulls oldest; expedite pulls earliest eligible VIP first and prioritizes VIPs within each station. No preemption, reserved capacity, artificial waits or early ends.';

async function readResult(root) {
  const result = root.getByTestId('vip-results').first();
  await result.waitFor({ timeout: 5000 });
  return result.evaluate(node => ({
    id: node.dataset.runId, variant: node.dataset.variant,
    observation: Array.from(node.querySelectorAll('p')).find(n => n.textContent.includes('Actual observation:'))?.textContent.trim(),
    values: Object.fromEntries(Array.from(node.querySelectorAll('dl > div')).map(div => [div.querySelector('dt').textContent.trim(), div.querySelector('dd').textContent.trim()])),
    text: node.innerText,
  }));
}
function numericSummary(result) {
  const v = result.values;
  const outcomes = v['VIP outcomes (all three orders)'].match(/On time:\s*(\d+)\s*·\s*Late:\s*(\d+)\s*·\s*Pending:\s*(\d+)\s*·\s*Not yet arrived:\s*(\d+)\s*·\s*Burnt:\s*(\d+)/);
  assert.ok(outcomes, 'Recognized VIP outcome partition');
  const bucket = outcomes.slice(1).map(Number);
  assert.equal(bucket.reduce((a,b) => a+b, 0), 3);
  const counts = v['Total served / burnt / angry'].match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  const mean = label => {
    const text = v[label];
    const n = Number(text.match(/served n\s*=\s*(\d+)/)?.[1]);
    assert.ok(Number.isInteger(n));
    const ms = n === 0 ? null : Number(text.match(/^([\d.]+)\s+simulated seconds/)?.[1]) * 1000;
    if (n === 0) assert.match(text, /N\/A/);
    else assert.ok(Number.isFinite(ms) && ms >= 0);
    return { servedN: n, simulatedMsRoundedInUI: ms, equivalentUnpausedRealSecondsAt3x: ms === null ? null : ms / 3000 };
  };
  const score = v['Final canonical VIP score'].match(/(-?\d+) points\s*·\s*(\d+) deadline penalties/);
  assert.ok(counts && score);
  const summary = {
    served: Number(counts[1]), burnt: Number(counts[2]), angry: Number(counts[3]),
    vip: { onTime: bucket[0], late: bucket[1], pending: bucket[2], notYetArrived: bucket[3], burnt: bucket[4] },
    vipLatency: mean('VIP arrival-to-served mean'), normalArrivalLatency: mean('Normal arrival-to-served mean'),
    normalOrdersLatency: mean('Normal Orders-to-served mean'), score: Number(score[1]), deadlinePenalties: Number(score[2]),
  };
  assert.ok(summary.served > 0, 'Automated player delivered real work');
  assert.equal(summary.vip.pending, 0, 'All deadlines precede the full horizon');
  assert.equal(summary.vip.notYetArrived, 0, 'All three VIP arrivals precede the full horizon');
  assert.equal(summary.normalOrdersLatency.servedN, summary.normalArrivalLatency.servedN);
  assert.equal(summary.served, summary.vipLatency.servedN + summary.normalArrivalLatency.servedN);
  return summary;
}
async function play(page, root, variant, trace, browserName) {
  stage = `${variant}: instruction and first move`;
  await root.getByRole('button', { name: variant === 'fifo' ? 'Start FIFO baseline' : 'Start VIP/expedite', exact: true }).click();
  await page.getByRole('button', { name: 'Try first order', exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.match(await root.getByTestId('vip-timer').innerText(), /300 simulated seconds/);
  await page.getByRole('button', { name: 'Try first order', exact: true }).click();
  const first = root.locator('[data-vip-ticket="order-1"]');
  await first.waitFor();
  await page.waitForTimeout(250);
  assert.match(await root.getByTestId('vip-timer').innerText(), /300 simulated seconds/);
  await first.focus(); await page.keyboard.press('Enter');
  const started = performance.now();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-vip-ticket="order-1"]')?.dataset.vipStation === 'prep');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-vip-ticket') === 'order-1');
  const arrivalSeen = new Set();
  let progressAt = Date.now();
  const endBy = Date.now() + 160000;
  let pollCount = 0;
  const observations = [];
  const record = async (kind, details = {}) => {
    const timer = await root.evaluate(n => n.querySelector('[data-testid="vip-timer"]')?.textContent || null);
    const remaining = timer?.match(/remaining:\s*(\d+)/)?.[1];
    const event = { variant, kind, wallElapsedMs: Math.round(performance.now() - started), simulatedElapsedSecondsApprox: remaining === undefined ? null : 300 - Number(remaining), ...details };
    trace.push(event); return event;
  };
  await record('guided-prep');
  stage = `${variant}: 300s horizon at 3×`;
  console.log(stage);
  while (await root.getByTestId('vip-results').count() === 0) {
    try {
    assert.ok(Date.now() < endBy, `${variant} did not reach horizon within 160 real seconds`);
    const activeState = await root.evaluate(n => ({
      ended: !!n.querySelector('[data-testid="vip-results"]'),
      visibility: document.visibilityState,
      pause: n.querySelector('[data-testid="vip-pause-status"]')?.textContent.trim(),
      speed: Array.from(n.querySelectorAll('button')).find(b => b.textContent === '3×')?.getAttribute('aria-pressed'),
    }));
    if (activeState.ended) break;
    assert.equal(activeState.visibility, 'visible', 'Clean matched pair must remain visible');
    assert.match(activeState.pause, /^Kitchen running\./);
    assert.equal(activeState.speed, 'true');
    if (Date.now() - progressAt > 20000) {
      console.log(`${variant}: ${(await record('progress')).simulatedElapsedSecondsApprox}s simulated elapsed`); progressAt = Date.now();
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
      const items = await root.locator(`[data-vip-ticket][data-vip-station="${station}"]`).evaluateAll(nodes => nodes.map(n => ({ key: n.dataset.vipTicket, text: n.innerText })));
      // Ready downstream work first. Expedite prioritizes VIPs; no fabricated result target.
      items.sort((a,b) => (variant === 'expedite' ? Number(/^VIP/.test(b.text)) - Number(/^VIP/.test(a.text)) : 0) || Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]));
      for (const item of items) {
        if (['prep','oven'].includes(station) && !/\bReady\b/.test(item.text)) continue;
        try {
          const ticket = root.locator(`[data-vip-ticket="${item.key}"]`);
          await ticket.click({ timeout: 1500 });
          const action = root.locator('[data-vip-destination]');
          if (await action.isEnabled()) {
            const to = await action.getAttribute('data-vip-destination');
            await action.click({ timeout: 1500 });
            await record('move-requested', { ticket: item.key, from: station, to });
            break;
          }
        } catch (error) { if (!await root.getByTestId('vip-results').count()) throw error; }
      }
    }
    if (!await root.getByTestId('vip-results').count()) {
      const vipPull = root.getByRole('button', { name: 'Pull earliest VIP into Orders', exact: true });
      const ordinaryPull = root.getByRole('button', { name: variant === 'fifo' ? 'Pull oldest available ticket (FIFO)' : 'Pull next Normal order into Orders', exact: true });
      const pull = variant === 'expedite' && await vipPull.isEnabled() ? vipPull : ordinaryPull;
      if (await pull.isEnabled()) {
        const ticket = await pull.getAttribute('data-vip-admit');
        await pull.click(); await record('admit-requested', { ticket });
      }
    }
    await page.waitForTimeout(100);
    } catch (error) {
      // A real horizon can remove controls between two UI queries; final results must still validate.
      if (error.code !== 'ERR_ASSERTION' && await root.getByTestId('vip-results').count()) break;
      throw error;
    }
  }
  const wallElapsedMs = Math.round(performance.now() - started);
  const rendered = await readResult(root);
  assert.equal(rendered.variant, variant);
  assert.match(rendered.observation, /300 simulated seconds\s*·\s*horizon/);
  assert.equal(arrivalSeen.size, 3, 'Observed all three VIP arrivals');
  const summary = numericSummary(rendered);
  await page.screenshot({ path: path.join(output, `${browserName}-${variant}-result.png`), fullPage: true });
  console.log(`${variant}: finished in ${wallElapsedMs / 1000}s wall; ${summary.served} served, ${summary.vip.onTime} VIPs on time`);
  return { ...rendered, ...summary, wallElapsedMs, arrivalObservations: observations };
}

try {
  for (const name of names) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    let page; const trace = []; const errors = []; const csp = []; const uploads = [];
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: harness.local });
      page = await context.newPage();
      page.setDefaultTimeout(2500);
      page.on('pageerror', e => errors.push(e.message));
      context.on('request', r => { if (!['GET','HEAD'].includes(r.method())) uploads.push({ method: r.method(), url: r.url() }); });
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
        interpretation: 'Automated UI observations, not human-play evidence or a promised expedite advantage. Rendered means are rounded; trace times are DOM observations/request times, not exact engine boundaries. Real-equivalent latency is simulated latency / 3, not a separate stopwatch measurement.' });
      await writeFile(path.join(output, `${name}-action-trace.json`), JSON.stringify(trace, null, 2));
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      await page.screenshot({ path: path.join(output, `${name}-comparison.png`), fullPage: true });
      console.log(`${name}: clean 3× pair passed and explicitly matched`);
      await context.close();
    } catch (error) {
      if (page && !page.isClosed()) {
        await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
        await writeFile(path.join(output, 'failure-page.txt'), await page.locator('body').innerText().catch(() => 'Page unavailable'));
      }
      await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, message: error.message, trace, runtimeErrors: errors, cspViolations: csp, resultUploads: uploads }, null, 2));
      throw error;
    } finally { await browser.close(); }
  }
} finally { await harness.close(); }
