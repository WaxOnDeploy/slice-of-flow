import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/exports';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4185));
const results = [];
const engines = { chromium, firefox, webkit };
try {
  for (const name of (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',')) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: harness.local, acceptDownloads: true });
      const page = await context.newPage();
      const errors = [], violations = [], exportRequests = [];
      let capture = false;
      page.on('pageerror', error => errors.push(error.message));
      context.on('request', request => { if (capture) exportRequests.push({ method: request.method(), url: request.url() }); });
      await page.exposeFunction('recordExportCsp', value => violations.push(value));
      await page.addInitScript(() => {
        sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1');
        document.addEventListener('securitypolicyviolation', event => window.recordExportCsp({ directive: event.effectiveDirective, uri: event.blockedURI }));
        window.__urlsCreated = []; window.__urlsRevoked = []; window.__printCalls = 0;
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); window.__urlsCreated.push(url); return url; };
        URL.revokeObjectURL = url => { window.__urlsRevoked.push(url); revoke(url); };
        window.print = () => { window.__printCalls++; };
      });
      await page.goto(harness.base, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Hard/ }).click();
      await page.getByRole('button', { name: /Skip to Round 2/ }).click();
      await page.getByRole('dialog', { name: 'Round 2 complete', exact: true }).waitFor({ timeout: 80000 });
      await page.getByRole('button', { name: 'See Your Results →', exact: true }).click();
      await page.getByTestId('local-exports').waitFor();
      const downloadButton = page.getByRole('button', { name: 'Download PNG', exact: true });
      await downloadButton.waitFor();
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Download PNG').disabled);
      await page.waitForTimeout(300);
      capture = true;
      const downloadEvent = page.waitForEvent('download');
      await downloadButton.focus(); await page.keyboard.press('Enter');
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), 'slice-of-flow-results.png');
      const file = path.join(output, `${name}-empty-round2-results.png`);
      await download.saveAs(file);
      const bytes = await readFile(file);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), 1600);
      assert(bytes.readUInt32BE(20) >= 700);
      await page.waitForTimeout(1200);
      assert.deepEqual(await page.evaluate(() => window.__urlsCreated), await page.evaluate(() => window.__urlsRevoked));
      await page.getByText('Preview the data included', { exact: true }).click();
      const preview = await page.getByRole('table', { name: 'Export data preview' }).innerText();
      assert(preview.includes('n/a') && preview.includes('Final score'));
      const before = preview;
      await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__printCalls), 1);
      assert.equal(await page.getByRole('table', { name: 'Export data preview' }).innerText(), before);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError'); } });
      });
      const createdBefore = await page.evaluate(() => window.__urlsCreated.length);
      await page.getByRole('button', { name: 'Share image', exact: true }).click();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.__urlsCreated.length), createdBefore, 'Cancelling share started a download');
      await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
      const fallbackEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Share image', exact: true }).click();
      await (await fallbackEvent).saveAs(path.join(output, `${name}-fallback-download.png`));
      await page.waitForTimeout(1200);
      assert.deepEqual(await page.evaluate(() => window.__urlsCreated), await page.evaluate(() => window.__urlsRevoked));
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.sof-debrief-screen').isVisible(), false);
      assert.equal(await page.getByTestId('print-debrief').isVisible(), true);
      const printText = await page.getByTestId('print-debrief').innerText();
      for (const text of ['Hard difficulty', 'Round 1 was skipped', 'n/a', 'Built by Jeff Bourke, MHA, PMP, SAFe RTE', 'Slice of Flow, slice-of-flow.com', 'The Bridge', 'Team discussion questions']) assert(printText.includes(text));
      assert.equal(await page.getByTestId('print-debrief').locator('img, canvas, button, input').count(), 0);
      if (name === 'chromium') for (const format of ['A4', 'Letter']) await page.pdf({ path: path.join(output, `debrief-${format}.pdf`), format, printBackground: false, preferCSSPageSize: false });
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: path.join(output, `${name}-phone-exports.png`), fullPage: true });
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) {
        const geometry = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).map(node => { const r = node.getBoundingClientRect(); return { tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 90), x: r.x, width: r.width, right: r.right }; }).filter(node => node.width > innerWidth || node.right > innerWidth + 1).slice(0, 40));
        await writeFile(path.join(output, `${name}-overflow.json`), JSON.stringify(geometry, null, 2));
        throw new Error('Phone debrief overflow');
      }
      assert.deepEqual(errors, []); assert.deepEqual(violations, []);
      assert.deepEqual(exportRequests.filter(r => !r.url.startsWith('blob:')), [], 'Export caused network activity');
      results.push({ browser: name, realPngDownload: true, objectUrlCleanup: true, keyboardDownload: true, shareCancelNoDownload: true, unsupportedShareLocalFallback: true, printCancelPreservesResults: true, scopedPrint: true, phoneLayout: true, noUploadsOrNetwork: true, zeroRuntimeErrors: true, zeroCspViolations: true });
      console.log(`PASS ${name}: PNG, cleanup, cancellation, print, phone layout and privacy`);
      await context.close();
    } finally { await browser.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ url: harness.base, results }, null, 2) + '\n');
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ results, error: String(error), stack: error.stack }, null, 2) + '\n');
  throw error;
} finally { await harness.close(); }
