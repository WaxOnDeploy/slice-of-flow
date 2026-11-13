import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/supplier-3x';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let page, stage = 'setup';
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: harness.local });
  page = await context.newPage();
  const errors = [], dataRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) dataRequests.push({ method: request.method(), url: request.url() }); });
  await page.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
  await page.goto(new URL('?round4=1', harness.base).href, { waitUntil: 'networkidle' });
  const pilot = page.getByTestId('supplier-round'), observed = [];
  for (const policy of ['naive', 'managed']) {
    stage = policy;
    console.log(`${policy}: starting actual 240s horizon at 3×; no synthetic clock or engine state`);
    await pilot.getByRole('button', { name: policy === 'naive' ? 'Start oldest-first baseline' : 'Start managed sequencing', exact: true }).click();
    await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
    await pilot.locator('[data-supplier-ticket="order-1"]').click();
    const started = performance.now();
    await pilot.locator('[data-supplier-destination]').click();
    const deadline = Date.now() + 110000;
    while (Date.now() < deadline && await pilot.getByTestId('supplier-results').count() === 0) {
      for (const label of ['Pizza Box', 'Oven', 'Prep', 'Orders']) {
        if (await pilot.getByTestId('supplier-results').count()) break;
        const stationIds = { Orders: 'orderQueue', Prep: 'prep', Oven: 'oven', 'Pizza Box': 'boxDeliver' };
        const tickets = pilot.locator(`[data-supplier-ticket][data-supplier-station="${stationIds[label]}"]`);
        for (let i = 0; i < await tickets.count(); i++) {
          if (await pilot.getByTestId('supplier-results').count()) break;
          try {
            await tickets.nth(i).click({ timeout: 500 });
            const action = pilot.locator('[data-supplier-destination]');
            if (await action.count() && await action.isEnabled()) { await action.click({ timeout: 500 }); break; }
          } catch (error) { if (await pilot.getByTestId('supplier-results').count() === 0) throw error; }
        }
      }
      const pull = pilot.getByRole('button', { name: 'Pull next order into Orders', exact: true });
      if (await pull.count() && await pull.isEnabled()) await pull.click();
      await page.waitForTimeout(150);
    }
    await pilot.getByTestId('supplier-results').waitFor({ timeout: 5000 });
    const wallSeconds = (performance.now() - started) / 1000;
    assert(wallSeconds >= 79 && wallSeconds < 105, 'actual 3× 240s horizon approximately 80 wall seconds');
    const result = pilot.getByTestId('supplier-results');
    const runId = await result.getAttribute('data-run-id');
    const text = await result.innerText();
    assert.match(text, /240.*simulated|240.*seconds/i);
    assert.match(text, /horizon/i);
    assert.doesNotMatch(text, /manual-stop/);
    observed.push({ policy, runId, actualWallSeconds: wallSeconds, horizonSimMs: 240000, resultText: text });
    await result.screenshot({ path: path.join(output, `${policy}-actual-result.png`) });
    await writeFile(path.join(output, 'runs.json'), JSON.stringify(observed, null, 2) + '\n');
    console.log(`${policy}: completed in ${wallSeconds.toFixed(3)} wall seconds`);
  }
  stage = 'explicit matched comparison';
  const baseline = pilot.getByRole('combobox', { name: /^Baseline attempt/ }), subject = pilot.getByRole('combobox', { name: /^Comparison attempt/ });
  assert.equal(await baseline.inputValue(), ''); assert.equal(await subject.inputValue(), '');
  await baseline.selectOption(observed[0].runId); await subject.selectOption(observed[1].runId);
  const basis = await pilot.getByTestId('supplier-comparison-basis').innerText();
  assert.match(basis, /Basis: matched/);
  assert.doesNotMatch(basis, /unmatched|not matched/i);
  assert.match(await pilot.innerText(), /not.*causal|not.*guarantee/i);
  assert.deepEqual(errors, []); assert.deepEqual(dataRequests, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, engine: 'chromium', pair: observed, basis, errors, dataRequests, note: 'Scripted UI choices, not a human workshop or promised policy advantage.' }, null, 2) + '\n');
  console.log('PASS: complete supplier 3× pair, producer-compatible retained snapshots and explicit matched comparison');
  await context.close();
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, error: error.stack }, null, 2) + '\n');
  if (page && !page.isClosed()) { await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText()); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); }
  throw error;
} finally { await browser.close(); await harness.close(); }
