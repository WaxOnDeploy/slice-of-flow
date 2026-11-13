import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/supplier';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
const engines = { chromium, firefox, webkit }, results = [];
let stage = 'setup';
try {
  for (const name of (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    let page;
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: harness.local });
      page = await context.newPage();
      const errors = [], csp = [], dataRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      context.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) dataRequests.push({ method: request.method(), url: request.url() }); });
      await page.exposeFunction('supplierCsp', value => csp.push(value));
      await page.addInitScript(() => {
        sessionStorage.setItem('sof-splash-seen', '1');
        localStorage.setItem('sof-tutorial-seen', '1');
        document.addEventListener('securitypolicyviolation', e => window.supplierCsp({ directive: e.effectiveDirective, uri: e.blockedURI }));
      });
      const url = query => new URL(query, harness.base).href;
      stage = `${name}: default-off and combined flag priority`;
      console.log(stage);
      await page.goto(harness.base, { waitUntil: 'networkidle' });
      assert.equal(await page.getByTestId('supplier-round').count(), 0);
      await page.goto(url('?round4=1&round3=1&flow-lab=1'), { waitUntil: 'networkidle' });
      const pilot = page.getByTestId('supplier-round');
      await pilot.waitFor();
      assert.equal(await page.getByTestId('vip-round').count(), 0, 'only one optional kitchen mounted');
      assert.equal(await pilot.locator('[data-supplier-ticket]').count(), 0, 'explicit Start required');
      assert.match(await pilot.innerText(), /supplier-only pilot.*partial/i);
      assert.equal(await pilot.getByRole('button', { name: 'Start managed sequencing', exact: true }).isDisabled(), true);
      // A dedicated query creates the independent pilot only; flags do not establish access control.
      await page.goto(url('?round4=1'), { waitUntil: 'networkidle' });
      const ticket = key => pilot.locator(`[data-supplier-ticket="${key}"]`);
      // Station headings and tickets share one grid parent so moving tickets retain DOM identity.
      const stationIds = { Orders: 'orderQueue', Prep: 'prep', Oven: 'oven', 'Pizza Box': 'boxDeliver' };
      const station = label => ({ locator: selector => pilot.locator(`[data-supplier-station="${stationIds[label]}"]:is(${selector})`) });
      const action = () => pilot.locator('[data-supplier-destination]');
      const start = async policy => {
        await pilot.getByRole('button', { name: policy === 'naive' ? 'Start oldest-first baseline' : 'Start managed sequencing', exact: true }).click();
        await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
        const before = await pilot.getByTestId('supplier-timer').innerText();
        await page.waitForTimeout(300);
        assert.equal(await pilot.getByTestId('supplier-timer').innerText(), before, 'guide owns its pause');
        await ticket('order-1').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
        await station('Prep').locator('[data-supplier-ticket="order-1"]').waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-supplier-ticket')), 'order-1', 'focus follows moved ticket');
        const pull = pilot.getByRole('button', { name: 'Pull next order into Orders', exact: true });
        await pull.click(); await ticket('order-2').click(); await action().click();
        for (let i = 3; i <= 6; i++) await pull.click();
        assert.equal(await station('Orders').locator('[data-supplier-ticket]').count(), 4);
        assert.equal(await pull.isDisabled(), true, 'blocked work does not create another Orders slot');
      };
      const waitBlocked = async () => {
        await page.waitForFunction(() => document.querySelector('[data-supplier-ticket="order-3"]')?.textContent.includes('Waiting on supplier'), null, { timeout: 15000 });
        assert.equal(await station('Orders').locator('[data-supplier-ticket="order-3"]').count(), 1);
        assert.match(await ticket('order-3').innerText(), /Supplier/);
        assert.match(await pilot.getByTestId('supplier-watch').innerText(), /shortage|supplier/i);
      };
      const clearPrep = async () => {
        await page.waitForFunction(() => document.querySelector('[data-supplier-ticket="order-1"]')?.textContent.includes('Ready'), null, { timeout: 15000 });
        for (const key of ['order-1', 'order-2']) { await ticket(key).click(); await action().click(); }
        assert.equal(await station('Prep').locator('[data-supplier-ticket]').count(), 0);
        assert.equal(await station('Oven').locator('[data-supplier-ticket]').count(), 2, 'already-prepping affected/unaffected work not frozen');
      };
      stage = `${name}: naive blocker, WIP and owned pauses`;
      console.log(stage);
      await start('naive'); await waitBlocked();
      await pilot.getByRole('button', { name: 'Pause kitchen', exact: true }).click();
      const frozenTime = await pilot.getByTestId('supplier-timer').innerText();
      const frozenCard = await ticket('order-3').innerText();
      await page.waitForTimeout(400);
      assert.equal(await pilot.getByTestId('supplier-timer').innerText(), frozenTime);
      assert.equal(await ticket('order-3').innerText(), frozenCard, 'simulated blocker age freezes');
      await pilot.getByRole('button', { name: 'Help', exact: true }).click();
      await page.getByRole('button', { name: 'Close help', exact: true }).click();
      assert.equal(await pilot.getByRole('button', { name: 'Resume kitchen', exact: true }).count(), 1, 'help does not clear facilitator owner');
      await pilot.getByRole('button', { name: 'Resume kitchen', exact: true }).click();
      await clearPrep();
      await ticket('order-4').focus(); await page.keyboard.press('Enter');
      assert.equal(await action().isDisabled(), true, 'naive cannot bypass blocked head with free Prep space');
      await page.keyboard.press('ArrowRight');
      assert.match(await pilot.innerText(), /oldest|sequence/i);
      assert.equal(await station('Orders').locator('[data-supplier-ticket]').count(), 4);
      const watch = pilot.getByTestId('supplier-watch');
      await watch.screenshot({ path: path.join(output, `${name}-naive-shortage.png`) });
      await page.setViewportSize({ width: 375, height: 812 });
      await ticket('order-4').focus();
      await page.waitForTimeout(150);
      const bounds = await watch.boundingBox();
      assert(bounds && bounds.y >= -1 && bounds.y + bounds.height <= 813, 'supplier watch stays visible while using phone board');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no phone page overflow');
      await page.screenshot({ path: path.join(output, `${name}-phone-shortage.png`) });
      await page.setViewportSize({ width: 1280, height: 720 });
      stage = `${name}: exact delivery unlock without automatic movement`;
      await page.waitForFunction(() => !document.querySelector('[data-supplier-ticket="order-3"]')?.textContent.includes('Waiting on supplier'), null, { timeout: 18000 });
      assert.equal(await station('Orders').locator('[data-supplier-ticket="order-3"]').count(), 1, 'delivery never automatically moves a ticket');
      await ticket('order-3').click(); assert.equal(await action().isEnabled(), true);
      await pilot.getByRole('button', { name: 'End run', exact: true }).click();
      const firstId = await pilot.getByTestId('supplier-results').getAttribute('data-run-id');
      assert.match(await pilot.getByTestId('supplier-results').innerText(), /ticket.seconds|ticket-seconds/i);
      assert.match(await pilot.getByTestId('supplier-results').innerText(), /manual|not matched/i);
      stage = `${name}: managed work bypass without blocked WIP release`;
      console.log(stage);
      await start('managed'); await waitBlocked(); await clearPrep();
      await ticket('order-4').focus(); await page.keyboard.press('Enter');
      assert.equal(await action().isEnabled(), true);
      await page.keyboard.press('ArrowRight');
      await station('Prep').locator('[data-supplier-ticket="order-4"]').waitFor();
      assert.equal(await station('Orders').locator('[data-supplier-ticket="order-3"]').count(), 1, 'managed blocked head still consumes WIP');
      assert.match(await ticket('order-3').innerText(), /Waiting on supplier/);
      assert.equal(await station('Orders').locator('[data-supplier-ticket]').count(), 3);
      await watch.screenshot({ path: path.join(output, `${name}-managed-shortage.png`) });
      await pilot.getByRole('button', { name: 'End run', exact: true }).click();
      const secondId = await pilot.getByTestId('supplier-results').getAttribute('data-run-id');
      assert.notEqual(firstId, secondId);
      const baseline = pilot.getByRole('combobox', { name: /^Baseline attempt/ });
      const subject = pilot.getByRole('combobox', { name: /^Comparison attempt/ });
      assert.equal(await baseline.inputValue(), ''); assert.equal(await subject.inputValue(), '', 'no latest/best pair preselected');
      await baseline.selectOption(firstId); await subject.selectOption(secondId);
      assert.match(await pilot.getByTestId('supplier-comparison-basis').innerText(), /unmatched|not matched/i);
      assert.match(await pilot.innerText(), /manual|MANUAL_END_NOT_MATCHABLE/i);
      assert.match(await pilot.innerText(), /not.*causal|not.*guarantee/i);
      assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(dataRequests, []);
      results.push({ engine: name, passed: true, mode: 'controlled short UI runs, not matched horizons', trueClockAndShortage: true, blockedWipRetained: true, naiveHeadBlocking: true, managedInBoardSelection: true, deliveryNoAutoMove: true, keyboardFocus: true, ownedPause: true, phoneEmulation: true, errors, csp, dataRequests });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
      console.log(`PASS ${name}: real shortage, WIP, naive/managed, delivery, keyboard, pause, phone and privacy`);
      await context.close();
    } catch (error) {
      if (page && !page.isClosed()) {
        await writeFile(path.join(output, `${name}-failure.txt`), await page.locator('body').innerText());
        await page.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true });
      }
      throw error;
    } finally { await browser.close(); }
  }
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, error: error.stack, completed: results }, null, 2) + '\n');
  throw error;
} finally { await harness.close(); }
