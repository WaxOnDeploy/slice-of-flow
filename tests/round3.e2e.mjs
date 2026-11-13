import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/round3';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
const engines = { chromium, firefox, webkit };
const results = [];
let stage = 'setup';
let debugPage;
async function selectFirst(page, root) {
  await page.getByRole('button', { name: 'Try first order', exact: true }).click();
  const ticket = root.locator('[data-vip-ticket="order-1"]');
  await ticket.waitFor();
  const initial = await root.getByTestId('vip-timer').innerText();
  await page.waitForTimeout(250);
  assert.equal(await root.getByTestId('vip-timer').innerText(), initial, 'guidance owns the paused clock');
  await ticket.focus(); await page.keyboard.press('Enter');
  assert.equal(await ticket.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-vip-ticket="order-1"]')?.getAttribute('data-vip-station') === 'prep');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-vip-ticket') === 'order-1');
}
async function play(page, root, full, name) {
  if (!full) { await page.waitForTimeout(550); await root.getByRole('button', { name: 'End run', exact: true }).click(); }
  const until = Date.now() + 160000;
  let progressAt = Date.now();
  while (full && Date.now() < until && await root.getByTestId('vip-results').count() === 0) {
    if (Date.now() > progressAt + 20000) { console.log(`${name}: playing ${await root.getByTestId('vip-timer').innerText()}`); progressAt = Date.now(); }
    for (const station of ['Pizza Box', 'Oven', 'Prep', 'Orders']) {
      if (await root.getByTestId('vip-results').count()) break;
      // DOM interaction only; no reducer injection, fabricated archive or clock override.
      const key = { 'Pizza Box': 'boxDeliver', Oven: 'oven', Prep: 'prep', Orders: 'orderQueue' }[station];
      const tickets = await root.locator(`[data-vip-ticket][data-vip-station="${key}"]`).evaluateAll(nodes => nodes.map(n => ({ key: n.dataset.vipTicket, text: n.innerText })));
      for (const item of tickets) {
        if ((station === 'Prep' || station === 'Oven') && !/Ready/.test(item.text)) continue;
        const ticket = root.locator(`[data-vip-ticket="${item.key}"]`);
        try {
          await ticket.click({ timeout: 800 });
          const move = root.locator('[data-vip-destination]');
          if (await move.isEnabled()) { await move.click({ timeout: 800 }); break; }
        } catch (error) { if (!await root.getByTestId('vip-results').count()) throw error; }
      }
    }
    if (!await root.getByTestId('vip-results').count()) {
      // The engine, not this test, decides FIFO and the global expedite token.
      const available = root.locator('[data-vip-admit]:enabled');
      if (await available.count()) await available.first().click();
    }
    await page.waitForTimeout(100);
  }
  await root.getByTestId('vip-results').waitFor({ timeout: 5000 });
  const data = await root.getByTestId('vip-results').evaluate(n => ({ id: n.dataset.runId, variant: n.dataset.variant, text: n.innerText }));
  assert.ok(data.id, 'actual completed run ID retained');
  assert.match(data.text, /VIP/i);
  assert.match(data.text, /sample|n\s*=/i);
  return data;
}
try {
  for (const name of (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: name === 'chromium', ignoreHTTPSErrors: harness.local });
      const page = await context.newPage(); debugPage = page;
      const errors = [], csp = [], uploads = [];
      let capture = false;
      page.on('pageerror', e => errors.push(e.message));
      context.on('request', r => { if (capture && !['GET', 'HEAD'].includes(r.method())) uploads.push({ method: r.method(), url: r.url() }); });
      await page.exposeFunction('roundCsp', e => csp.push(e));
      await page.addInitScript(() => {
        sessionStorage.setItem('sof-splash-seen', '1');
        document.addEventListener('securitypolicyviolation', e => window.roundCsp({ directive: e.effectiveDirective, uri: e.blockedURI }));
      });
      stage = `${name}: default-off route`;
      console.log(stage);
      await page.goto(harness.base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Open the Kitchen', exact: true }).waitFor();
      assert.equal(await page.getByTestId('vip-round').count(), 0);
      assert.equal(await page.getByTestId('independent-lab').count(), 0);
      assert.match(await page.locator('body').innerText(), /Jeff Bourke/);
      stage = `${name}: explicit pilot introduction`;
      console.log(stage);
      await page.goto(new URL('?round3=1', harness.base).href, { waitUntil: 'domcontentloaded' });
      const root = page.getByTestId('vip-round'); await root.waitFor();
      assert.equal(await root.locator('[data-vip-ticket]').count(), 0, 'opening the preview does not start a run');
      await page.screenshot({ path: path.join(output, `${name}-intro-desktop.png`), fullPage: true });
      capture = true;
      stage = `${name}: keyboard guide and nested pause controls`;
      await root.getByLabel('Next run speed', { exact: true }).selectOption('3');
      await root.getByRole('button', { name: 'Start FIFO baseline', exact: true }).click();
      await selectFirst(page, root);
      await root.getByRole('button', { name: 'Pause kitchen', exact: true }).click();
      const paused = await root.getByTestId('vip-timer').innerText();
      await page.waitForTimeout(300); assert.equal(await root.getByTestId('vip-timer').innerText(), paused);
      await root.getByRole('button', { name: 'Help', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), true); }
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.match(await root.getByTestId('vip-pause-status').innerText(), /facilitator/i);
      await root.getByRole('button', { name: 'Hide live scores', exact: true }).click();
      assert.equal(await root.locator('[data-testid="vip-live-scores"]').count(), 0);
      assert.equal(await root.getByTestId('vip-timer').count(), 1);
      await root.getByRole('button', { name: 'Resume kitchen', exact: true }).click();
      await page.waitForTimeout(300);
      await play(page, root, false, name);
      stage = `${name}: FIFO and expedite runs`;
      console.log(stage);
      const full = name === 'chromium' && process.env.SOF_VIP_FULL_PAIR !== '0';
      await root.getByRole('button', { name: 'Start FIFO baseline', exact: true }).click();
      await selectFirst(page, root);
      const baseline = await play(page, root, full, `${name} FIFO`);
      await root.getByRole('button', { name: 'Start VIP/expedite', exact: true }).click();
      await selectFirst(page, root);
      await page.screenshot({ path: path.join(output, `${name}-expedite-board.png`), fullPage: true });
      const subject = await play(page, root, full, `${name} expedite`);
      assert.notEqual(baseline.id, subject.id);
      stage = `${name}: explicit comparison and phone layout`;
      const b = root.getByLabel('Baseline attempt', { exact: true });
      const a = root.getByLabel('Expedite attempt', { exact: true });
      assert.equal(await b.inputValue(), '', 'no automatic latest/best baseline');
      assert.equal(await a.inputValue(), '', 'comparison must be explicitly chosen');
      await b.selectOption(baseline.id); await a.selectOption(subject.id);
      const comparison = root.getByTestId('vip-comparison'); await comparison.waitFor();
      const compared = await comparison.innerText();
      assert.match(compared, full ? /Basis:\s*matched/i : /not.?matched|unmatched/i);
      assert.match(compared, /decisions|causal|guarantee/i);
      assert.equal(await comparison.getByTestId('vip-comparison-table').count(), 1);
      assert.match(await comparison.getByTestId('vip-comparison-table').innerText(), /Normal served sample size/);
      await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(450);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(geometry.scroll <= geometry.width + 2, JSON.stringify(geometry));
      await page.screenshot({ path: path.join(output, `${name}-phone-comparison.png`), fullPage: true });
      await root.getByRole('button', { name: 'Return to results', exact: true }).click();
      await page.getByRole('button', { name: 'Open the Kitchen', exact: true }).waitFor();
      assert.equal(await page.getByTestId('vip-round').count(), 0);
      if (name === 'chromium') {
        await page.getByRole('button', { name: 'Open optional Round 3 preview', exact: true }).tap();
        await root.getByRole('button', { name: 'Start FIFO baseline', exact: true }).tap();
        await page.getByRole('button', { name: 'Try first order', exact: true }).tap();
        await root.locator('[data-vip-ticket="order-1"]').tap();
        await root.locator('[data-vip-destination]').tap();
        assert.equal(await root.locator('[data-vip-ticket="order-1"]').getAttribute('data-vip-station'), 'prep');
        await root.getByRole('button', { name: 'End run', exact: true }).tap();
        await root.getByRole('button', { name: 'Return to results', exact: true }).tap();
      }
      capture = false;
      for (const [route, ready] of [['license', /License & Permissions/], ['deck-shop', /Release Train/], ['game', /Golden Sprint|Agile Tower/]]) {
        await page.goto(new URL(route, harness.base).href, { waitUntil: 'domcontentloaded' });
        await page.getByText(ready).first().waitFor({ timeout: 15000 });
      }
      assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(uploads, []);
      results.push({ browser: name, fullPair: full, baseline, subject, comparison: compared, geometry, runtimeErrors: errors, cspViolations: csp, dataUploads: uploads });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(`${name}: Round 3 acceptance passed (${full ? 'full-horizon pair' : 'explicit short manual runs'})`);
      await context.close();
    } catch (error) {
      if (debugPage && !debugPage.isClosed()) {
        await debugPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
        await writeFile(path.join(output, 'failure-page.txt'), await debugPage.locator('body').innerText().catch(() => 'Page unavailable'));
      }
      throw error;
    } finally { debugPage = null; await browser.close(); }
  }
} catch (error) {
  if (debugPage && !debugPage.isClosed()) {
    await debugPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(path.join(output, 'failure-page.txt'), await debugPage.locator('body').innerText().catch(() => 'Page unavailable'));
  }
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, message: error.message, stack: error.stack }, null, 2));
  throw error;
} finally { await harness.close(); }
console.log(JSON.stringify(results.map(({ browser, fullPair }) => ({ browser, fullPair })), null, 2));
