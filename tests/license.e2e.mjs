import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionHarness } from './browserHarness.mjs';

// Run: SOF_TEST_OUTPUT=/absolute/output node tests/license.e2e.mjs
// Live: SOF_TEST_URL=https://host/app-prefix/ node tests/license.e2e.mjs
// Pages build: SOF_TEST_DIST=/absolute/artifact SOF_TEST_PREFIX=/repo/ node tests/license.e2e.mjs
// --prefix=/repo/ is equivalent to SOF_TEST_PREFIX; the local harness mounts that
// artifact under the prefix without altering the build or shared harness.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.SOF_TEST_OUTPUT || path.join(root, 'test-results', 'license'));
const normalize = text => text.replace(/\s+/g, ' ').trim();
const license = normalize(await readFile(path.join(root, 'LICENSE'), 'utf8'));
const prefixArgument = process.argv.find(arg => arg.startsWith('--prefix='))?.slice('--prefix='.length);
const requestedPrefix = prefixArgument ?? process.env.SOF_TEST_PREFIX;
const prefix = requestedPrefix ? `/${requestedPrefix.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/') : undefined;
await mkdir(output, { recursive: true });
const results = [];
const engines = { chromium, firefox, webkit };
const browserNames = (process.env.SOF_BROWSERS || 'chromium,firefox,webkit').split(',').map(name => name.trim());
for (const name of browserNames) assert(engines[name], `Unknown browser: ${name}`);
let mount, harness, activePage, activeLabel;
const originalDist = process.env.SOF_TEST_DIST;
const started = Date.now();
const heartbeat = setInterval(() => console.log(`PROGRESS license acceptance: ${results.length} passed groups; ${activeLabel || 'starting'}; ${Math.round((Date.now() - started) / 1000)}s elapsed`), 20000);
let base;
const route = suffix => new URL(suffix, base).href;
function passed(group, evidence) {
  results.push({ group, ...evidence });
  console.log(`PASS ${group}`);
}

async function setupContext(browser, viewport) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: harness.local });
  context.setDefaultTimeout(15000);
  const errors = [], violations = [];
  await context.exposeBinding('recordLicenseCsp', (_source, event) => violations.push(event));
  // Observability only: no local/session storage, engine or store injection.
  await context.addInitScript(() => document.addEventListener('securitypolicyviolation', event => {
    window.recordLicenseCsp({ directive: event.effectiveDirective, uri: event.blockedURI, page: location.href });
  }));
  context.on('page', page => page.on('pageerror', error => errors.push({ page: page.url(), message: error.message })));
  return { context, errors, violations };
}

async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth }));
  assert(dimensions.body <= dimensions.viewport + 1 && dimensions.html <= dimensions.viewport + 1, `${label}: horizontal body overflow ${JSON.stringify(dimensions)}`);
}

async function footer(page, label) {
  const region = page.getByTestId('sof-rights-footer');
  assert.equal(await region.count(), 1, `${label}: expected one native copyright footer`);
  await region.scrollIntoViewIfNeeded();
  assert(await region.isVisible(), `${label}: footer not visible`);
  assert(normalize(await region.innerText()).includes('© 2026 Jeff Bourke'), `${label}: copyright text missing`);
  assert.equal(await region.getByRole('link', { name: 'jeff@thefatalfive.com', exact: true }).getAttribute('href'), 'mailto:jeff@thefatalfive.com');
  const link = region.getByRole('link', { name: 'License & Permissions (opens in a new tab)', exact: true });
  assert.equal(await link.evaluate(node => node.tagName), 'A', `${label}: license is not a native anchor`);
  assert.equal(await link.evaluate(node => node.href), route('license'), `${label}: incorrect base-aware license URL`);
  assert.equal(await link.getAttribute('target'), '_blank');
  const rel = (await link.getAttribute('rel')).split(/\s+/);
  assert(rel.includes('noopener') && rel.includes('noreferrer'), `${label}: missing safe new-tab rel`);
  return link;
}

async function licensePage(page, label, screenshot = false) {
  const heading = page.getByRole('heading', { name: 'License & Permissions', exact: true, level: 1 });
  await heading.waitFor();
  await page.waitForFunction(() => document.title === 'License & Permissions | Slice of Flow');
  assert.equal(await page.title(), 'License & Permissions | Slice of Flow');
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  for (const name of ['Free hosted use', 'Ask Jeff first', 'Full proprietary license', 'License notice—not a new visitor contract']) {
    assert(await page.getByRole('heading', { name, exact: true, level: 2 }).isVisible(), `${label}: missing heading ${name}`);
  }
  assert.equal(normalize(await page.getByTestId('full-license-text').innerText()), license, `${label}: full displayed license differs from repository LICENSE`);
  assert(await heading.evaluate(node => document.activeElement === node), `${label}: page heading did not receive focus`);
  for (const linkName of ['← Back to Slice of Flow', '← Back to the kitchen']) {
    assert.equal(await page.getByRole('link', { name: linkName, exact: true }).evaluate(node => node.href), base.href, `${label}: incorrect Back destination`);
  }
  // Computed typography, contrast and horizontal geometry, not a blanket WCAG claim.
  const readability = await page.locator('.sof-license-main p, .sof-license-main h1, .sof-license-main h2, .sof-license-main h3, .sof-license-main a, .sof-rights-footer').evaluateAll(nodes => {
    const rgba = value => { const components = value.match(/[\d.]+/g)?.map(Number); return components?.length >= 3 ? [...components.slice(0, 3), components[3] ?? 1] : [0, 0, 0, 0]; };
    const luminance = rgb => rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    return nodes.map(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      const ancestors = []; for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) ancestors.unshift(ancestor);
      let background = [255, 255, 255];
      for (const ancestor of ancestors) { const color = rgba(getComputedStyle(ancestor).backgroundColor); background = color.slice(0, 3).map((value, i) => value * color[3] + background[i] * (1 - color[3])); }
      const color = rgba(style.color), foreground = color.slice(0, 3).map((value, i) => value * color[3] + background[i] * (1 - color[3]));
      const lights = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return { tag: node.tagName, className: node.className, text: node.textContent.slice(0, 80), fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), contrast: (lights[0] + .05) / (lights[1] + .05), left: rect.left, right: rect.right, width: rect.width, viewport: innerWidth };
    });
  });
  for (const node of readability) {
    const smallNote = node.className.includes('sof-license-eyebrow') || node.tag === 'FOOTER';
    assert(node.fontSize >= (smallNote ? 14 : 16), `${label}: text too small ${JSON.stringify(node)}`);
    assert(node.lineHeight >= node.fontSize * 1.15 - .1, `${label}: insufficient line height ${JSON.stringify(node)}`);
    assert(node.left >= -1 && node.right <= node.viewport + 1 && node.width > 0, `${label}: clipped text block ${JSON.stringify(node)}`);
    const largeText = node.fontSize >= 24 || (/^H[123]$/.test(node.tag) && node.fontSize >= 18.66);
    assert(node.contrast >= (largeText ? 3 : 4.5), `${label}: insufficient text contrast ${JSON.stringify(node)}`);
  }
  await noOverflow(page, label);
  await footer(page, label);
  if (screenshot) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
    await writeFile(path.join(output, `${label}-readability.json`), JSON.stringify(readability, null, 2) + '\n');
  }
}

async function openLicense(page, label) {
  const link = await footer(page, label);
  const originalUrl = page.url();
  const opened = page.waitForEvent('popup');
  await link.focus();
  await page.keyboard.press('Enter');
  const popup = await opened;
  activePage = popup;
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(new URL(popup.url()).href, route('license'), `${label}: popup route incorrect`);
  await licensePage(popup, `${label}-popup`);
  assert.equal(await popup.evaluate(() => window.opener), null, `${label}: new tab exposes opener`);
  assert.equal(page.url(), originalUrl, `${label}: original tab navigated`);
  await popup.close();
  activePage = page;
}

async function enter(page, variant) {
  const button = page.getByRole('button', { name: { ticket: 'FIRE IT UP!', neon: 'Enter Kitchen', pizzabox: 'Open the Box' }[variant], exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('landing-identity').waitFor();
  await page.locator('[data-phase="landing"][aria-busy="false"]').waitFor();
}

async function focusedChecks(browser, name, viewport) {
  const label = `${name}-${viewport.width}`;
  const { context, errors, violations } = await setupContext(browser, viewport);
  try {
    const page = await context.newPage(); activePage = page; activeLabel = label;
    await page.goto(route('license'), { waitUntil: 'networkidle' });
    await licensePage(page, `license-${label}`, true);
    passed(`${label}: direct license`, { exactRepositoryText: true, titleAndHeadings: true, computedReadabilityAndContrast: true, noHorizontalOverflow: true, copyrightAndMailto: true, screenshot: `license-${label}.png` });
    for (const [index, back] of ['← Back to Slice of Flow', '← Back to the kitchen'].entries()) {
      if (index) await page.goto(route('license'), { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: back, exact: true }).click();
      await page.getByTestId('splash-identity').waitFor();
      assert.equal(new URL(page.url()).pathname, base.pathname);
    }
    passed(`${label}: both Back links`, { correctBaseAwareRootRoute: true });
    await page.close();

    for (const variant of ['ticket', 'neon', 'pizzabox']) {
      const splashPage = await context.newPage(); activePage = splashPage;
      const url = new URL(base); url.searchParams.set('splash', variant);
      await splashPage.goto(url.href, { waitUntil: 'networkidle' });
      await splashPage.getByTestId('splash-identity').waitFor();
      await noOverflow(splashPage, `${label}-${variant}-splash`);
      await openLicense(splashPage, `${label}-${variant}-splash`);
      assert(await splashPage.getByTestId('splash-identity').isVisible(), 'License popup reset splash');
      await enter(splashPage, variant);
      await noOverflow(splashPage, `${label}-${variant}-landing`);
      await openLicense(splashPage, `${label}-${variant}-landing`);
      assert(await splashPage.getByTestId('landing-identity').isVisible(), 'License popup reset landing');
      passed(`${label}: ${variant} splash and landing`, { nativeSafeKeyboardNewTab: true, originalTabPreserved: true, noHorizontalOverflow: true });
      await splashPage.close();
    }

    // A fresh page still has never opened the game: tutorial must appear naturally.
    const game = await context.newPage(); activePage = game;
    await game.goto(base.href, { waitUntil: 'networkidle' });
    await game.getByTestId('splash-identity').waitFor();
    await enter(game, 'ticket');
    await game.getByRole('button', { name: 'Open the Kitchen', exact: true }).focus();
    await game.keyboard.press('Enter');
    await game.getByRole('dialog', { name: 'How to play Slice of Flow', exact: true }).waitFor();
    await game.keyboard.press('Escape');
    await game.getByText('Start here: select this order.', { exact: true }).waitFor();
    const clock = game.locator('[aria-label*="simulated kitchen time remaining"]');
    const first = game.locator('[data-card-id="order-1"]');
    const clockBefore = await clock.innerText();
    await first.focus(); await game.keyboard.press('Enter');
    await game.getByText('Move it to Prep — work moves one station at a time.', { exact: true }).waitFor();
    assert.equal(await first.getAttribute('aria-pressed'), 'true');
    await game.keyboard.press('ArrowRight');
    const success = game.getByText('Prep started. This ticket will be ready shortly.', { exact: true });
    await success.waitFor();
    assert((await first.getAttribute('aria-label')).includes('in Prep'), `${label}: keyboard move did not reach Prep`);
    assert.equal(await clock.innerText(), clockBefore, `${label}: clock consumed time before success confirmation`);
    // Do not mark guidance complete while its intentionally delayed confirmation remains.
    await success.waitFor({ state: 'hidden', timeout: 15000 });
    await game.waitForFunction(before => document.querySelector('[aria-label*="simulated kitchen time remaining"]')?.innerText !== before, clockBefore, { timeout: 15000 });
    const identity = (await first.getAttribute('aria-label')).split(', in ')[0];
    const urlBefore = game.url();
    await noOverflow(game, `${label}-round1`);
    await openLicense(game, `${label}-round1`);
    assert.equal(game.url(), urlBefore);
    assert(await game.locator('[data-phase="round1"]').isVisible(), `${label}: game phase reset`);
    assert.equal((await first.getAttribute('aria-label')).split(', in ')[0], identity, `${label}: original first ticket changed`);
    assert((await first.getAttribute('aria-label')).includes('in Prep'), `${label}: original first ticket left Prep without user action`);
    assert.equal(await game.getByRole('dialog', { name: 'How to play Slice of Flow', exact: true }).count(), 0, `${label}: tutorial reopened`);
    assert.equal(await game.getByTestId('landing-identity').count(), 0, `${label}: license reset the game`);
    passed(`${label}: fresh tutorial and guided Round 1`, { keyboardEnterSelection: true, rightArrowPrep: true, confirmedSuccessSettled: true, gameClockStarted: true, boardFooterVisibleAfterScroll: true, safeLicensePopupPreservesVisibleGameAndTicket: true, noHorizontalOverflow: true });
    await game.close();

    for (const [suffix, title] of [['deck-shop', 'Release Train Chronicles'], ['game', 'THE QUEST FOR THE GOLDEN SPRINT']]) {
      const retained = await context.newPage(); activePage = retained;
      // Legacy Deck Shop loads external imagery: acceptance is its visible title,
      // not completion/idle of every third-party request.
      await retained.goto(route(suffix), { waitUntil: 'commit', timeout: 30000 });
      if (suffix === 'deck-shop') {
        const h1 = retained.getByRole('heading', { level: 1, name: title, exact: true });
        await h1.waitFor(); assert.equal(normalize(await h1.innerText()), title);
        assert(await h1.isVisible());
      } else {
        const terminalTitle = retained.getByText(title, { exact: false });
        await terminalTitle.waitFor(); await terminalTitle.scrollIntoViewIfNeeded();
        assert(await terminalTitle.isVisible());
        assert(await retained.getByPlaceholder('Enter command...').isVisible());
      }
      assert.equal(new URL(retained.url()).pathname, new URL(route(suffix)).pathname);
      passed(`${label}: retained /${suffix}`, { expectedVisibleTitle: title, nativeRoute: true });
      await retained.close();
    }
    assert.deepEqual(errors, [], `${label}: runtime errors`);
    assert.deepEqual(violations, [], `${label}: CSP violations`);
    passed(`${label}: runtime and CSP`, { runtimeErrors: errors, cspViolations: violations });
  } finally { await context.close(); }
}

async function shortDebriefCheck(browser, name) {
  const { context, errors, violations } = await setupContext(browser, { width: 1280, height: 720 });
  try {
    const page = await context.newPage(); activePage = page; activeLabel = `${name}-round2-debrief (native skip; no two-round playthrough)`;
    await page.goto(base.href, { waitUntil: 'networkidle' });
    await page.getByTestId('splash-identity').waitFor(); await enter(page, 'ticket');
    await page.getByRole('button', { name: /Hard/ }).click();
    await page.getByRole('button', { name: /Skip to Round 2/ }).click();
    await page.getByRole('dialog', { name: 'How to play Slice of Flow', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pull Next Order', exact: true }).waitFor();
    await openLicense(page, `${name}-round2`);
    assert(await page.locator('[data-phase="round2"]').isVisible());
    passed(`${name}: Round 2 footer`, { nativeSafeKeyboardNewTab: true, visibleRound2Preserved: true });
    await page.getByRole('dialog', { name: 'Round 2 complete', exact: true }).waitFor({ timeout: 90000 });
    await page.getByRole('button', { name: 'See Your Results →', exact: true }).click();
    await page.locator('[data-phase="debrief"][aria-busy="false"]').waitFor();
    await openLicense(page, `${name}-debrief`);
    assert(await page.locator('[data-phase="debrief"]').isVisible());
    for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport); await footer(page, `${name}-debrief-${viewport.width}`);
    }
    assert.deepEqual(errors, [], 'Round 2/debrief runtime errors');
    assert.deepEqual(violations, [], 'Round 2/debrief CSP violations');
    passed(`${name}: debrief footer`, { nativeSafeKeyboardNewTab: true, originalDebriefPreserved: true, footerAt1280And375: true, zeroRuntimeErrors: true, zeroCspViolations: true });
  } finally { await context.close(); }
}

let failure;
try {
  if (!process.env.SOF_TEST_URL && prefix && prefix !== '/') {
    const built = path.resolve(originalDist || path.join(root, 'dist', 'public'));
    mount = await mkdtemp(path.join(output, 'prefix-mount-'));
    const mounted = path.join(mount, prefix.slice(1, -1));
    await mkdir(path.dirname(mounted), { recursive: true });
    await symlink(built, mounted, 'dir');
    // productionHarness falls back to its build root index for SPA deep links.
    await symlink(path.join(built, 'index.html'), path.join(mount, 'index.html'));
    process.env.SOF_TEST_DIST = mount;
  }
  harness = await productionHarness(Number(process.env.SOF_TEST_PORT || 4186));
  base = new URL(harness.base); base.search = ''; base.hash = '';
  if (prefix) base.pathname = prefix;
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  console.log(`START license acceptance: ${base.href}; browsers ${browserNames.join(',')}; dist ${originalDist || 'dist/public'}`);
  for (const name of browserNames) {
    const browser = await engines[name].launch({ headless: true, ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
    try {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) await focusedChecks(browser, name, viewport);
      if (name === 'chromium' && process.env.SOF_LICENSE_DEBRIEF !== '0') await shortDebriefCheck(browser, name);
    } finally { await browser.close(); }
  }
  console.log(`PASS all ${results.length} focused license acceptance groups; full two-round regression intentionally not run`);
} catch (error) {
  failure = { label: activeLabel, error: String(error), stack: error.stack };
  if (activePage && !activePage.isClosed()) {
    try {
      await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
      failure.visibleDom = await activePage.locator('body').innerText();
      failure.url = activePage.url();
    } catch (captureError) { failure.captureError = String(captureError); }
  }
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ url: base?.href, results, ...failure }, null, 2) + '\n');
  console.error(`FAIL ${activeLabel}: ${error.message}`);
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ url: base?.href, localHttpsWithVercelCsp: harness?.local ?? false, dist: originalDist || path.join(root, 'dist', 'public'), prefix: base?.pathname, status: failure ? 'failed' : 'passed', results, failure, notRun: ['Full two-round gameplay regression', 'Transition phase footer (requires Round 1 completion)'], elapsedSeconds: Math.round((Date.now() - started) / 1000) }, null, 2) + '\n');
  if (harness) await harness.close();
  if (mount) await rm(mount, { recursive: true, force: true });
  if (originalDist === undefined) delete process.env.SOF_TEST_DIST; else process.env.SOF_TEST_DIST = originalDist;
}
