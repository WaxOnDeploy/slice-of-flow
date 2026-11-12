import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || 'test-results/lab-print';
await mkdir(output, { recursive: true });
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4188));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: harness.local, reducedMotion: 'reduce' });
  await context.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
  const page = await context.newPage();
  await page.goto(new URL('?flow-lab=1', harness.base).href, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Hard/ }).click();
  await page.getByRole('button', { name: /Skip to Round 2/ }).click();
  const tutorial = page.getByRole('button', { name: /Let.*s Cook|Let.*s Go|Start Cooking|Got it.*Let/i });
  if (await tutorial.count()) await tutorial.first().click();
  console.log('Print regression: waiting for an actual normally timed Round 2.');
  await page.getByRole('dialog', { name: 'Round 2 complete', exact: true }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'See Your Results →', exact: true }).click();
  const lab = page.getByTestId('independent-lab'); await lab.waitFor();
  async function check(state) {
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.getByTestId('independent-lab-preview').evaluate(n => getComputedStyle(n).display), 'none');
    assert.equal(await page.locator('.sof-print-sheet').evaluate(n => getComputedStyle(n).display), 'block');
    for (const dialog of await page.locator('.sof-dialog:has(.sof-lab-dialog)').all()) assert.equal(await dialog.evaluate(n => getComputedStyle(n).display), 'none');
    for (const overlay of await page.locator('.sof-dialog-overlay').all()) assert.equal(await overlay.evaluate(n => getComputedStyle(n).display), 'none');
    const file = path.join(output, `${state}.pdf`);
    await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true });
    const { stdout } = await promisify(execFile)('pdftotext', [file, '-']);
    assert.match(stdout, /Slice of Flow/);
    assert.doesNotMatch(stdout, /independent measurement lab|One kitchen, one independent run|Independent run recorded|Recorded lab evidence|Start lab run/i);
    await writeFile(path.join(output, `${state}.txt`), stdout);
    checks.push({ state, labExcluded: true, portalExcluded: true, originalSheetPresent: true });
    await page.emulateMedia({ media: 'screen' });
  }
  await check('pre-start');
  await lab.getByRole('button', { name: 'Start lab run', exact: true }).click();
  await page.getByRole('dialog', { name: 'Independent lab instructions', exact: true }).waitFor();
  await check('active-instructions');
  await page.getByRole('button', { name: 'Try the first order', exact: true }).click();
  await lab.locator('[data-lab-ticket="order-1"]').click();
  await lab.locator('[data-lab-destination]').click();
  await lab.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('dialog', { name: 'How to play the independent lab', exact: true }).waitFor();
  await check('active-help');
  await page.getByRole('button', { name: 'Close help', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await lab.getByRole('button', { name: 'End lab run', exact: true }).click();
  await lab.getByTestId('lab-results').waitFor();
  await check('completed');
  await writeFile(path.join(output, 'results.json'), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify(checks, null, 2));
  await context.close();
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
  throw error;
} finally { await browser.close(); await harness.close(); }
