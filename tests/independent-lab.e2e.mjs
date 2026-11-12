import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/independent-lab';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
const engines = { chromium, firefox, webkit }, results = [];
let stage = 'setup';
try {
  for (const name of (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    let debugPage = null;
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: name === 'chromium', ignoreHTTPSErrors: harness.local });
      const page = await context.newPage(), errors = [], csp = [], dataRequests = [];
      debugPage = page;
      let capture = false;
      page.on('pageerror', error => errors.push(error.message));
      context.on('request', request => { if (capture && !['GET', 'HEAD'].includes(request.method())) dataRequests.push({ method: request.method(), url: request.url() }); });
      await page.exposeFunction('recordLabCsp', value => csp.push(value));
      await page.addInitScript(() => {
        sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1');
        document.addEventListener('securitypolicyviolation', e => window.recordLabCsp({ directive: e.effectiveDirective, uri: e.blockedURI }));
      });
      stage = `${name}: original direct-R2 entry`;
      console.log(`Testing ${stage}`);
      await page.goto(new URL('?flow-lab=1', harness.base).href, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Hard/ }).click();
      await page.getByRole('button', { name: /Skip to Round 2/ }).click();
      await page.getByRole('dialog', { name: 'Round 2 complete', exact: true }).waitFor({ timeout: 80000 });
      await page.getByRole('button', { name: 'See Your Results →', exact: true }).click();
      await page.getByTestId('local-exports').waitFor();
      await page.getByTestId('independent-lab').waitFor();
      const lab = page.getByTestId('independent-lab');
      await page.getByTestId('local-exports').getByRole('button', { name: 'Download PNG', exact: true }).click({ trial: true });
      const legacyExport = await page.getByTestId('local-exports').innerText();
      assert.equal(await lab.locator('[data-lab-ticket]').count(), 0, 'no automatic lab start');
      capture = true;
      stage = `${name}: instruction and keyboard guide`;
      await lab.getByRole('button', { name: 'Start lab run', exact: true }).click();
      await page.getByRole('dialog', { name: 'Independent lab instructions', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), true);
      await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
      const first = lab.locator('[data-lab-ticket="order-1"]');
      const guideTimer = await lab.getByTestId('lab-timer').innerText();
      await page.waitForTimeout(350);
      assert.equal(await lab.getByTestId('lab-timer').innerText(), guideTimer, 'guide clock stays paused');
      await first.focus(); await page.keyboard.press('Enter');
      assert.equal(await first.getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[data-lab-ticket="order-1"]')?.closest('[aria-label="Prep"]'));
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-lab-ticket')), 'order-1');
      assert.match(await lab.locator('.sof-lab-feedback').innerText(), /First move complete/);
      stage = `${name}: pause, owned help, hidden scores and blocked action`;
      await lab.getByRole('button', { name: 'Pause lab', exact: true }).click();
      const pausedTime = await lab.getByTestId('lab-timer').innerText();
      await first.focus(); await page.keyboard.press('ArrowRight');
      assert.match(await lab.locator('.sof-lab-feedback').innerText(), /paused/i);
      await page.waitForTimeout(400);
      assert.equal(await lab.getByTestId('lab-timer').innerText(), pausedTime);
      await lab.getByRole('button', { name: 'Help', exact: true }).click();
      await page.getByRole('dialog', { name: 'How to play the independent lab', exact: true }).waitFor();
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), true); }
      await page.getByRole('button', { name: 'Close help', exact: true }).click();
      await page.getByRole('dialog', { name: 'How to play the independent lab', exact: true }).waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.textContent === 'Help', null, { timeout: 2000 });
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Help');
      assert.match(await lab.getByTestId('lab-pause-status').innerText(), /paused — facilitator/);
      await lab.getByRole('button', { name: 'Hide live scores', exact: true }).click();
      assert.equal(await lab.getByTestId('lab-live-scores').count(), 0, 'live score aggregates absent, not CSS-hidden');
      assert.equal(await lab.getByTestId('lab-timer').count(), 1, 'operational timer retained');
      await lab.getByRole('button', { name: 'Leave lab', exact: true }).click();
      await page.getByRole('dialog', { name: 'Abandon this independent run?', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancel exit', exact: true }).click();
      assert.match(await lab.getByTestId('lab-pause-status').innerText(), /paused — facilitator/);
      assert.equal(await lab.getByTestId('lab-timer').innerText(), pausedTime, 'cancel removes only exit owner');
      await lab.getByRole('button', { name: 'Resume lab', exact: true }).click();
      stage = `${name}: actual pointer play and producer final capture`;
      console.log(`Testing ${stage}`);
      // Real UI actions, no private store mutation, clock replacement or fabricated completion.
      const deadline = Date.now() + 90000;
      if (process.env.SOF_LAB_FULL_RUN === '0') { await page.waitForTimeout(500); await lab.getByRole('button', { name: 'End lab run', exact: true }).click(); }
      while (process.env.SOF_LAB_FULL_RUN !== '0' && Date.now() < deadline && await lab.getByTestId('lab-results').count() === 0) {
        for (const station of ['Pizza Box', 'Oven', 'Prep', 'Orders']) {
          if (await lab.getByTestId('lab-results').count()) break;
          const tickets = lab.getByRole('region', { name: station, exact: true }).locator('[data-lab-ticket]');
          for (let i = 0; i < await tickets.count(); i++) {
            const ticket = tickets.nth(i);
            try {
              await ticket.click({ timeout: 500 });
              const action = lab.locator('[data-lab-destination]');
              if (await action.isEnabled()) { await action.click({ timeout: 500 }); break; }
            } catch (error) { if (await lab.getByTestId('lab-results').count() === 0) throw error; }
          }
        }
        const pull = lab.getByRole('button', { name: 'Pull next order into Orders', exact: true });
        if (await pull.count() && await pull.isEnabled()) await pull.click();
        await page.waitForTimeout(150);
      }
      await lab.getByTestId('lab-results').waitFor({ timeout: 10000 });
      const finalText = await lab.getByTestId('lab-results').innerText();
      assert.match(finalText, /Actual observation duration:/);
      assert.match(finalText, /served sample n =/);
      assert.match(finalText, /Orders-to-exit illustration/);
      assert.match(finalText, /complete engine ledger/);
      assert.equal(await page.getByTestId('local-exports').innerText(), legacyExport, 'lab leaves old exports unchanged');
      stage = `${name}: recorded CFD and exact numeric alternative`;
      console.log(`Testing ${stage}`);
      const evidence = page.getByTestId('lab-evidence');
      await evidence.locator('summary', { hasText: 'Inspect recorded cumulative flow' }).click();
      const flowSelect = evidence.getByRole('combobox', { name: /^Recorded attempt/ });
      const id = await flowSelect.locator('option').nth(1).getAttribute('value');
      await flowSelect.selectOption(id);
      await evidence.getByTestId('lab-cfd-chart').waitFor();
      const rows = await evidence.locator('tbody tr').count();
      assert.ok(rows > 10, 'actual complete event history, not final-count bins');
      const range = evidence.getByLabel('Recorded event prefix', { exact: true });
      await range.focus(); await page.keyboard.press('End');
      assert.match(await evidence.getByTestId('lab-cfd-prefix').innerText(), /active|served/);
      await evidence.screenshot({ path: path.join(output, `${name}-recorded-flow.png`) });
      stage = `${name}: fresh replay, manual end and explicit contextual pair`;
      await lab.getByRole('button', { name: 'Replay lab run', exact: true }).click();
      await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
      const replayFirst = lab.locator('[data-lab-ticket="order-1"]');
      await replayFirst.click(); await lab.locator('[data-lab-destination]').click();
      await page.waitForTimeout(250);
      assert.equal(await lab.getByTestId('lab-live-scores').count(), 1, 'fresh replay restores score visibility');
      await lab.getByRole('button', { name: 'End lab run', exact: true }).click();
      await lab.getByTestId('lab-results').waitFor();
      assert.match(await lab.getByTestId('lab-results').innerText(), /manual-stop/);
      assert.equal(await flowSelect.locator('option').count(), 3, 'two actual retained completed IDs');
      await evidence.locator('summary', { hasText: 'Compare two selected lab attempts' }).click();
      const baseline = evidence.getByRole('combobox', { name: /^Baseline attempt/ }), subject = evidence.getByRole('combobox', { name: /^Comparison attempt/ });
      assert.equal(await baseline.inputValue(), ''); assert.equal(await subject.inputValue(), '');
      const id2 = await baseline.locator('option').nth(2).getAttribute('value');
      assert.notEqual(id, id2, 'fresh generic replay identity');
      await baseline.selectOption(id); await subject.selectOption(id);
      assert.match(await evidence.innerText(), /Choose two different recorded attempts/);
      assert.equal(await evidence.getByTestId('lab-comparison-basis').count(), 0);
      await subject.selectOption(id2);
      assert.match(await evidence.getByTestId('lab-comparison-basis').innerText(), /Basis: contextual/);
      assert.match(await evidence.innerText(), /Unavailable \(no served samples\)/);
      assert.equal(await page.getByTestId('local-exports').innerText(), legacyExport);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll('body *')).filter(e => { if(e.getBoundingClientRect().right <= innerWidth + 1)return false;let parent=e.parentElement;while(parent){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(parent).overflowX))return false;parent=parent.parentElement;}return true; }).slice(0, 40).map(e => ({ tag: e.tagName, class: e.className?.baseVal ?? e.className, text: e.textContent?.slice(0,90), right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, parent: e.parentElement?.className })) }));
      overflow.containers = await page.evaluate(() => Array.from(document.querySelectorAll('html,body,#root,div,section,details,label,select,input,svg')).filter(e => !e.closest('table') && (e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 1)).slice(0, 35).map(e => ({ tag: e.tagName, class: e.className?.baseVal ?? e.className, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width, client: e.clientWidth, scroll: e.scrollWidth, overflow: getComputedStyle(e).overflowX, parent: e.parentElement?.className })));
      if (overflow.width > overflow.viewport + 1) { await writeFile(path.join(output, `${name}-overflow.json`), JSON.stringify(overflow, null, 2) + '\n'); await page.screenshot({ path: path.join(output, `${name}-overflow.png`), fullPage: true }); }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'phone page has no horizontal overflow');
      await evidence.screenshot({ path: path.join(output, `${name}-phone-evidence.png`) });
      stage = `${name}: confirmed abandon does not add a snapshot`;
      if (name === 'chromium') await lab.getByRole('button', { name: 'Replay lab run', exact: true }).tap();
      else await lab.getByRole('button', { name: 'Replay lab run', exact: true }).click();
      await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
      await lab.getByRole('button', { name: 'Leave lab', exact: true }).click();
      await page.getByRole('button', { name: 'Abandon run and exit', exact: true }).click();
      await page.getByTestId('independent-lab-preview').waitFor({ state: 'detached' });
      assert.equal(await page.getByTestId('local-exports').innerText(), legacyExport);
      assert.deepEqual(errors, []); assert.deepEqual(csp, []); assert.deepEqual(dataRequests, []);
      results.push({ engine: name, passed: true, fullRun: process.env.SOF_LAB_FULL_RUN !== '0', actualRun: finalText, eventPrefixes: rows, keyboardPointer: true, emulatedTouch: name === 'chromium', pauseHelpExit: true, hiddenScoreDom: true, oldExportsUnchanged: true, csp, dataRequests });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
      console.log(`PASS ${name}: real independent play, keyboard/pointer, owned pause/help/exit, hidden scores, frozen CFD/pair evidence, phone/CSP/privacy`);
      await context.close();
    } finally {
      if (debugPage && !debugPage.isClosed()) {
        await writeFile(path.join(output, `${name}-live-failure.json`), JSON.stringify({ stage, url: debugPage.url(), body: await debugPage.locator('body').innerText() }, null, 2) + '\n');
        await debugPage.screenshot({ path: path.join(output, `${name}-live-failure.png`), fullPage: true });
      }
      await browser.close();
    }
  }
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ stage, error: error.stack, completed: results }, null, 2) + '\n');
  throw error;
} finally { await harness.close(); }
