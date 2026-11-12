import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFile, stat, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.SOF_TEST_OUTPUT || path.join(root, 'test-results', 'workshop');
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const builtRoot = path.join(root, 'dist', 'public');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
let server;
let tlsDirectory;
let base = process.env.SOF_TEST_URL;
const testPort = Number(process.env.SOF_TEST_PORT || 4175);
if (!base) {
  await stat(path.join(builtRoot, 'index.html'));
  tlsDirectory = await mkdtemp(path.join(tmpdir(), 'sof-browser-tls-'));
  const keyFile = path.join(tlsDirectory, 'key.pem');
  const certificateFile = path.join(tlsDirectory, 'certificate.pem');
  // A one-day, loopback-only test certificate; never stored in or deployed with the repository.
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', keyFile, '-out', certificateFile, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true });
  server = createServer({ key: await readFile(keyFile), cert: await readFile(certificateFile) }, async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let target = path.join(builtRoot, pathname);
      if (!target.startsWith(builtRoot)) { response.writeHead(403); response.end(); return; }
      try { if (!(await stat(target)).isFile()) target = path.join(builtRoot, 'index.html'); }
      catch { target = path.join(builtRoot, 'index.html'); }
      for (const rule of config.headers || []) if (rule.source === '/(.*)') for (const header of rule.headers) response.setHeader(header.key, header.value);
      response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
      response.end(await readFile(target));
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise(resolve => server.listen(testPort, '127.0.0.1', resolve));
  base = `https://127.0.0.1:${testPort}/`;
}
await mkdir(output, { recursive: true });
const results = [];
const selectedBrowsers = (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',');
const engines = { chromium, firefox, webkit };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function enterLanding(page, variant = 'ticket') {
  await page.goto(`${base}${base.includes('?') ? '&' : '?'}splash=${variant}`, { waitUntil: 'networkidle' });
  await page.getByTestId('splash-identity').waitFor();
  const entry = page.getByRole('button', { name: variant === 'ticket' ? 'FIRE IT UP!' : variant === 'neon' ? 'Enter Kitchen' : 'Open the Box', exact: true });
  await entry.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('landing-identity').waitFor();
  assert(await page.getByTestId('landing-order-guide').isVisible());
  assert((await page.getByTestId('landing-order-guide').innerText()).includes('ordinary Large'));
}

async function assertFocusContained(page) {
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    assert(await dialog.evaluate(node => node.contains(document.activeElement)), 'Tab left the dialog');
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.evaluate(node => node.contains(document.activeElement)), 'Shift+Tab left the dialog');
  }
}

async function assertBoardLayout(page, label) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`);
  for (const station of await page.locator('.sof-station-label').all()) {
    assert(await station.evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16), `${label}: station text below 16px`);
    const rect = await station.boundingBox();
    assert(rect && rect.x >= 0 && rect.x + rect.width <= (await page.evaluate(() => innerWidth)) + 1, `${label}: clipped station`);
  }
  for (const required of await page.locator('.sof-ticket .text-xs, .sof-ticket .text-sm, .sof-helper').all()) {
    assert(await required.evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16), `${label}: required text below 16px`);
  }
  const visible = await page.locator('.sof-scoreboard').innerText();
  for (const word of ['Served', 'Burnt', 'Angry', 'Orders left']) assert(visible.includes(word));
  assert.equal(await page.locator('[role="region"][aria-label*="station"]').count(), 5);
  await page.screenshot({ path: path.join(output, `${label}.png`) });
}

async function basicChecks(browser, browserName) {
  for (const width of [1280, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 720 }, ignoreHTTPSErrors: !!server });
    const page = await context.newPage();
    const errors = [];
    const violations = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('recordCsp', data => violations.push(data));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordCsp({ directive: event.effectiveDirective, uri: event.blockedURI })));
    await enterLanding(page);
    await page.getByRole('button', { name: 'Open the Kitchen', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'How to play Slice of Flow' }).waitFor();
    assert(await page.getByTestId('tutorial-order-guide').isVisible());
    assert(await page.getByTestId('game-board').evaluate(node => node.inert));
    assert.equal(await page.getByRole('button', { name: '← Back', exact: true }).isDisabled(), true);
    await assertFocusContained(page);
    await page.keyboard.press('Escape');
    await page.getByText('Start here: select this order.', { exact: true }).waitFor();
    const first = page.locator('[data-card-id="order-1"]');
    await page.waitForTimeout(100);
    assert(await first.evaluate(node => document.activeElement === node), 'Tutorial did not return focus to first ticket');
    const before = await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText(), before, 'Guided clock advanced');
    await page.keyboard.press('Space');
    await page.getByText('Move it to Prep — work moves one station at a time.', { exact: true }).waitFor();
    await page.keyboard.press('ArrowRight');
    await page.getByText('Prep started. This ticket will be ready shortly.', { exact: true }).waitFor();
    await page.waitForTimeout(100);
    assert(await first.evaluate(node => document.activeElement === node), 'Ticket lost focus after movement');
    await page.getByRole('button', { name: 'How to Play', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText(), before, 'First-move confirmation resumed behind the help dialog');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2600);
    assert.notEqual(await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText(), before, 'Round clock did not resume');
    await assertBoardLayout(page, `${browserName}-${width}-round1`);
    await page.getByRole('button', { name: 'How to Play', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    const paused = await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[aria-label*="simulated kitchen time remaining"]').innerText(), paused, 'Clock advanced while reading help');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    assert(await page.getByRole('button', { name: 'How to Play', exact: true }).evaluate(node => document.activeElement === node));
    await page.getByRole('button', { name: /Menu/, exact: false }).click();
    assert(await page.getByTestId('specials-order-guide').isVisible());
    await page.getByRole('button', { name: 'Close menu', exact: true }).focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByTestId('specials-order-guide').count(), 0);
    assert.deepEqual(errors, [], `${browserName}: runtime errors`);
    assert.deepEqual(violations, [], `${browserName}: CSP violations`);
    results.push({ browser: browserName, width, guidedKeyboard: true, pausedHelp: true, helpDuringConfirmation: true, focusContainment: true, focusReturn: true, readability: true, zeroRuntimeErrors: true, zeroCspViolations: true });
    console.log(`PASS ${browserName} ${width}px: guide, timers, dialog focus, readability, menu`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, reducedMotion: 'reduce', ignoreHTTPSErrors: !!server });
  const page = await context.newPage();
  await page.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Skip to Round 2/ }).tap();
  await page.getByRole('button', { name: 'Pull Next Order', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pull Next Order', exact: true }).tap();
  const ticket = page.locator('[data-card-id="order-1"]');
  await ticket.tap();
  await page.getByRole('button', { name: 'Move #1 to Prep →', exact: true }).tap();
  assert((await ticket.innerText()).includes('Prepping:'));
  await assertBoardLayout(page, `${browserName}-tablet-round2`);
  results.push({ browser: browserName, simulatedTabletTouch: true, directSkipRound2: true, reducedMotion: true, wipLabels: true });
  await context.close();
}

async function extendedChecks(browser) {
  for (const variant of ['ticket', 'neon', 'pizzabox']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', ignoreHTTPSErrors: !!server });
    const page = await context.newPage();
    await enterLanding(page, variant);
    assert(await page.locator('[data-phase="landing"] h1').evaluate(node => document.activeElement === node));
    results.push({ splash: variant, keyboardEntry: true, reducedMotion: true, landingFocus: true });
    await context.close();
  }
  for (const difficulty of ['Easy', 'Normal', 'Hard']) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 720 }, ignoreHTTPSErrors: !!server });
    await context.route('https://fonts.googleapis.com/**', route => route.abort());
    await context.route('https://fonts.gstatic.com/**', route => route.abort());
    const page = await context.newPage();
    await page.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: new RegExp(difficulty) }).click();
    await page.getByRole('button', { name: 'Open the Kitchen', exact: true }).click();
    await page.getByText('Start here: select this order.', { exact: true }).waitFor();
    await assertBoardLayout(page, `fallback-font-${difficulty.toLowerCase()}`);
    assert((await page.locator('[data-card-id="order-1"]').getAttribute('aria-label')).includes('Small, Prep 30 kitchen seconds'));
    results.push({ difficulty, fallbackFonts: true, boardReadability: true });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: !!server });
  const page = await context.newPage();
  await page.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Hard/ }).click();
  await page.getByRole('button', { name: /Skip to Round 2/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Round 2 complete', exact: true }).waitFor({ timeout: 75000 });
  await page.getByRole('button', { name: 'See Your Results →', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByText('How scoring works', { exact: true }).waitFor();
  assert((await page.locator('body').innerText()).includes('Round 1 was skipped'));
  await page.screenshot({ path: path.join(output, 'skipped-round-debrief.png'), fullPage: true });
  results.push({ skippedRound1Debrief: true, emptyRoundNoBonus: true, scoringExplanation: true });
  await context.close();
  console.log('PASS splash variants, preset layouts with fallback fonts, and skipped-R1 debrief');
}

async function completePair(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: !!server });
  const page = await context.newPage();
  await page.addInitScript(() => { sessionStorage.setItem('sof-splash-seen', '1'); localStorage.setItem('sof-tutorial-seen', '1'); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open the Kitchen', exact: true }).click();
  await page.getByText('Start here: select this order.', { exact: true }).waitFor();
  await page.locator('[data-card-id="order-1"]').click();
  await page.getByRole('button', { name: 'Move #1 to Prep →', exact: true }).click();
  await page.getByText('Prep started. This ticket will be ready shortly.', { exact: true }).waitFor();
  for (const round of [1, 2]) {
    const end = Date.now() + 105000;
    const clickWhilePlaying = async locator => {
      try { await locator.click({ timeout: 1500 }); return true; }
      catch (error) {
        if (await page.getByRole('dialog', { name: `Round ${round} complete`, exact: true }).count()) return false;
        throw error;
      }
    };
    while (Date.now() < end && !(await page.getByRole('dialog', { name: `Round ${round} complete`, exact: true }).count())) {
      if (round === 2) {
        const pull = page.getByRole('button', { name: 'Pull Next Order', exact: true });
        if (await pull.isVisible() && !(await clickWhilePlaying(pull))) break;
      }
      const ready = await page.locator('[data-card-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.cardId, text: node.textContent, station: node.closest('[role="region"]')?.getAttribute('aria-label') })).filter(card =>
        card.station?.startsWith('Pizza Box') ||
        card.station?.startsWith('Orders') ||
        card.text.includes('✓ Ready for oven') || card.text.includes('✓ Pull it out!')
      ).sort((a, b) => {
        const priority = station => station?.startsWith('Pizza Box') ? 0 : station?.startsWith('Oven') ? 1 : station?.startsWith('Prep') ? 2 : 3;
        return priority(a.station) - priority(b.station);
      }));
      for (const card of ready) {
        if (await page.getByRole('dialog').count()) break;
        const ticket = page.locator(`[data-card-id="${card.id}"]`);
        if (!(await clickWhilePlaying(ticket))) break;
        const orderNumber = card.id.replace('order-', '');
        const destination = page.getByRole('button', { name: new RegExp(`^Move #${orderNumber} to `) });
        if (await destination.count() && !(await clickWhilePlaying(destination))) break;
      }
      await delay(350);
      }
    await page.getByRole('dialog', { name: `Round ${round} complete`, exact: true }).waitFor({ timeout: 2000 });
    await assertFocusContained(page);
    await page.keyboard.press('Escape');
    assert(await page.getByRole('dialog').isVisible(), 'Escape dismissed required round-end results');
    await page.screenshot({ path: path.join(output, `round${round}-complete.png`) });
    await page.getByRole('button', { name: round === 1 ? 'Learn Kanban →' : 'See Full Results →', exact: true }).focus();
    await page.keyboard.press('Enter');
    if (round === 1) {
      await page.locator('[data-phase="transition"]').waitFor();
      for (let step = 0; step < 2; step++) {
        await page.getByRole('button', { name: /Next/ }).focus();
        await page.keyboard.press('Enter');
      }
      assert((await page.getByTestId('transition-order-guide').innerText()).includes('ordinary Large'));
      await page.getByRole('button', { name: /Start Round 2/ }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Pull Next Order', exact: true }).waitFor();
    }
  }
  await page.getByText('How scoring works', { exact: true }).waitFor();
  assert((await page.locator('body').innerText()).includes('only when at least one pizza is served and none are burnt'));
  assert(await page.locator('[data-phase="debrief"] .sof-debrief-screen h1').evaluate(node => document.activeElement === node));
  await page.screenshot({ path: path.join(output, 'full-debrief.png'), fullPage: true });
  results.push({ fullRound1Round2UiPlaythrough: true, roundEndFocus: true, requiredEndDialogEscapePolicy: true, transitionOrderGuide: true, debriefScoring: true });
  console.log('PASS complete UI-only Round 1 → Round 2 → debrief');
  await context.close();
}

try {
  for (const name of selectedBrowsers) {
    assert(engines[name], `Unknown browser: ${name}`);
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    try {
      await basicChecks(browser, name);
      if (name === 'chromium' && process.env.SOF_FULL_PAIR !== '0') await completePair(browser);
      if (name === 'chromium' && process.env.SOF_EXTENDED !== '0') await extendedChecks(browser);
    } finally { await browser.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ url: base, results }, null, 2) + '\n');
  console.log(`PASS all ${results.length} workshop acceptance groups`);
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ url: base, results, error: String(error), stack: error.stack }, null, 2) + '\n');
  throw error;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (tlsDirectory) await rm(tlsDirectory, { recursive: true, force: true });
}
