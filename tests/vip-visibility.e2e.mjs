import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { productionHarness } from './browserHarness.mjs';

const output = process.env.SOF_TEST_OUTPUT || '/tmp/sof-vip-visibility';
await mkdir(output, { recursive: true });
const engines = { chromium, firefox, webkit };
const names = (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',');
const harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
const url = new URL(harness.base);
url.searchParams.set('round3', '1');
const results = [];
let activePage;

async function visibleDock(page) {
  const dock = page.locator('.sof-vip-watch-dock');
  await dock.scrollIntoViewIfNeeded();
  await page.getByTestId('vip-board').locator('[data-vip-ticket="order-1"]').focus();
  await page.getByTestId('vip-board').locator('[data-vip-ticket="order-1"]').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(150);
  const geometry = await dock.boundingBox();
  const view = page.viewportSize();
  assert(geometry && geometry.y >= -1 && geometry.y + geometry.height <= view.height, `VIP watch outside viewport: ${JSON.stringify(geometry)}`);
  assert(geometry.height <= view.height * 0.43, 'VIP watch consumes too much of the screen');
  const title = page.getByTestId('vip-watch').locator('.sof-vip-watch-notice');
  if (await title.count()) {
    const rect = await title.boundingBox();
    assert(rect && rect.y >= geometry.y && rect.y + rect.height <= geometry.y + geometry.height, 'Arrival title clipped within watch');
  }
  for (const button of await page.getByTestId('vip-watch').locator('button').all()) {
    const rect = await button.boundingBox();
    assert(rect && rect.y >= geometry.y && rect.y + rect.height <= geometry.y + geometry.height, 'VIP watch action button is clipped');
  }
  return geometry;
}

async function guidedMove(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Try first order', exact: true }).click();
  const first = page.getByTestId('vip-board').locator('[data-vip-ticket="order-1"]');
  await first.click();
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('vip-pause-status').filter({ hasText: 'Kitchen running.' }).waitFor();
}

try {
  for (const name of names) {
    if (!engines[name]) throw new Error(`Unsupported browser: ${name}`);
    const browser = await engines[name].launch(name === 'chromium' ? { args: ['--no-sandbox'] } : {});
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
      activePage = page;
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => sessionStorage.setItem('sof-splash-seen', '1'));
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      const root = page.getByTestId('vip-round');
      await root.getByLabel('Next run speed', { exact: true }).selectOption('3');
      console.log(`${name}: checking real 3× FIFO arrival and scrolling`);
      await guidedMove(page, 'Start FIFO baseline');
      const watch = page.getByTestId('vip-watch');
      const waiting13 = watch.getByRole('button', { name: 'Pull waiting VIP Order 13', exact: true });
      await waiting13.waitFor({ timeout: 15000 });
      assert.equal(await waiting13.isDisabled(), true, 'FIFO must not allow queue jumping');
      assert.match(await watch.innerText(), /VIP Order 13 has arrived/);
      assert.match(await watch.innerText(), /FIFO/);
      assert.equal(await page.getByTestId('vip-board').locator('[data-vip-ticket="order-13"]').count(), 0);
      const announcement = await watch.locator('[role="status"]').innerText();
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-vip-ticket'));
      assert.equal(focused, 'order-1', 'Arrival stole ticket focus');
      await page.waitForTimeout(500);
      assert.equal(await watch.locator('[role="status"]').innerText(), announcement, 'Live announcement changes on every clock tick');
      const desktop = await visibleDock(page);
      await page.screenshot({ path: path.join(output, `${name}-desktop-fifo.png`) });
      await watch.getByRole('button', { name: 'Show VIP arrivals', exact: true }).click();
      assert.equal(await page.getByTestId('vip-arrivals-heading').evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: 'Pause kitchen', exact: true }).click();
      await page.setViewportSize({ width: 375, height: 812 });
      const phone = await visibleDock(page);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Phone page overflow');
      await page.screenshot({ path: path.join(output, `${name}-phone-fifo.png`) });
      await page.getByRole('button', { name: 'Resume kitchen', exact: true }).click();
      await page.getByRole('button', { name: 'End run', exact: true }).click();
      await page.getByTestId('vip-results').waitFor();
      await page.setViewportSize({ width: 1280, height: 720 });
      console.log(`${name}: checking keyboard VIP admission and next arrival while token is occupied`);
      await guidedMove(page, 'Start VIP/expedite');
      const expedite13 = watch.getByRole('button', { name: 'Pull waiting VIP Order 13', exact: true });
      await expedite13.waitFor({ timeout: 15000 });
      assert.equal(await expedite13.isEnabled(), true);
      await expedite13.focus();
      await page.keyboard.press('Enter');
      const gold = page.getByTestId('vip-board').locator('[data-vip-ticket="order-13"]');
      await gold.waitFor();
      assert.match(await gold.getAttribute('class'), /sof-vip-ticket-gold/);
      assert.equal(await gold.getAttribute('data-vip-station'), 'orderQueue');
      const waiting14 = watch.getByRole('button', { name: 'Pull waiting VIP Order 14', exact: true });
      await waiting14.waitFor({ timeout: 35000 });
      assert.equal(await waiting14.isDisabled(), true, 'Second VIP bypasses active token');
      assert.match(await watch.innerText(), /VIP Order 14 has arrived/);
      assert.match(await watch.innerText(), /VIP Order 13/);
      await page.getByRole('button', { name: 'Pause kitchen', exact: true }).click();
      const timerBefore = await page.getByTestId('vip-timer').innerText();
      const textBefore = await watch.innerText();
      await page.waitForTimeout(800);
      assert.equal(await page.getByTestId('vip-timer').innerText(), timerBefore);
      assert.equal(await watch.innerText(), textBefore, 'Watch countdown advances while paused');
      await page.screenshot({ path: path.join(output, `${name}-expedite-next-vip.png`) });
      await page.getByRole('button', { name: 'Resume kitchen', exact: true }).click();
      await page.getByRole('button', { name: 'End run', exact: true }).click();
      await page.getByTestId('vip-results').waitFor();
      assert.equal(await watch.count(), 0, 'Active watch persists after final result');
      assert.deepEqual(errors, [], 'Unexpected runtime errors');
      results.push({ browser: name, passed: true, desktop, phone, fifoVipWaitsOutsideOrders: true, keyboardExpediteAdmission: true, secondVipTokenBlocked: true, stableAnnouncement: true, humanDevices: 'Not certified; browser-engine simulation only' });
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
      console.log(`${name}: VIP visibility checks passed (manual ends; not full matched horizons)`);
      await page.close();
    } finally { await browser.close(); activePage = undefined; }
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await writeFile(path.join(output, 'failure-page.txt'), await activePage.locator('body').innerText().catch(() => 'Unavailable'));
    await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), stack: error.stack }, null, 2) + '\n');
  throw error;
} finally { await harness.close(); }
