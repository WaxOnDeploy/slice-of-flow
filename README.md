# Slice of Flow

A browser-based **Kanban pizza shop simulation** for Scrum Masters, Agile coaches, RTEs, delivery leads, and self-paced learners. Run the same kitchen through **Round 1: Push** and **Round 2: Pull + WIP limits**, then compare throughput, quality, and lead time.

Built by [Jeff Bourke](https://www.linkedin.com/in/jeffreybourke), MHA, PMP, SAFe RTE. The plain-text credit sits in a responsive header **outside the hero image**, and appears on every first-visit splash variant too. Initial HTML carries the same linked credit and author metadata for non-JavaScript readers; React replaces that initial fallback when it starts. The storefront's decorative plaque already says **MHA**, consistent with Jeff's LinkedIn Education section (Master of Health Administration, Quinnipiac University). Its existing artwork is retained.

**Free to play. No account required. No automatic game-results upload.** The landing page has a native, keyboard-accessible **Privacy & browser storage** disclosure: game state/results are browser-local, reload resets progress, onboarding flags use local/session storage, and normal hosting, Google Fonts, and image/CDN requests may be logged by their providers. Its analytics sentence reflects whether both analytics variables are configured for that particular build; do not advertise blanket “no data collected.” Sharing remains user-initiated.

No team/session counts or testimonials are shown without verified product evidence and the quoted person's permission. No **The Fatal Five** pointer is added to the Slice of Flow landing page; any future pointer is limited to the approved **“forthcoming, early 2027”** wording, with no endorser names or quotes. This landing update does not change the separate legacy `/deck-shop` page. **“Best on a laptop or tablet.”** remains before the Start button, and difficulty cards stack on phones to prevent horizontal overflow.

This public repository, [`WaxOnDeploy/slice-of-flow`](https://github.com/WaxOnDeploy/slice-of-flow), contains the React 19 / TypeScript / Vite 7 application, its retained legacy pages, and a small Node static-serving helper. Workshop teams can discuss moves around one projected browser; this is not a synchronized multiplayer game.

## License — proprietary, Jeff Bourke

**Copyright © 2026 Jeff Bourke. All rights reserved in protectable material he
authored or lawfully owns.** Slice of Flow is offered under the custom
[proprietary LICENSE](LICENSE), version 1.0, beginning with the repository revision
published with that notice on November 12, 2026. It is not offered under a general
open-source project license.

Free personal play and employee-led internal workshops are permitted. Outside
facilitation, paid or unpaid, resale and rehosting require express written
permission. Contact **jeff@thefatalfive.com**. Facilitation permission does not
grant resale, white-labeling or source-distribution rights; a request is not a grant.

Package metadata points to `LICENSE`; `private: true` prevents accidental npm
publication and does **not** change GitHub visibility. Required third-party
licenses/notices and valid prior permissions remain intact. No copyright over
ideas, gameplay methods or otherwise unprotectable generated output is created.

The separate [hosted Terms of Use draft](docs/ip/TERMS_OF_USE_DRAFT.md) is not yet a
live visitor contract. The LICENSE's express hosted-use permissions operate
independently of that draft; no acceptance of unpublished terms is claimed.

See [license status](docs/ip/REVIEW_STATUS.md), [plugin findings](docs/ip/PLUGIN_LICENSE_REVIEW.md)
and [asset provenance](docs/ip/ASSET_PROVENANCE.md). Jeff states he took the chef
reference portrait himself; other photo/artwork and provider questions remain
separate. Private originals, raw prompts, rights agreements and audit archives
must stay outside the public repository. Gameplay rules remain unchanged.

The public [License & Permissions page](https://slice-of-flow.com/license) shows
the approved use summary and full root LICENSE text, imported directly at build
time rather than maintained as a second legal document. Plain-text copyright,
permissions contact and a license link appear on the splash and every game phase.
License links open in a separate tab so they do not discard an ongoing game.
The separate visitor contract remains draft; no acceptance checkbox or claim of
copyright registration has been added. Run `node tests/license.e2e.mjs` after
the production build for desktop/phone, exact-text and game-preservation checks.

## Local setup

### Requirements

- **Node.js 22, version 22.12 or newer, recommended.** Vite 7 requires Node **20.19+ or 22.12+**; older Node releases are not suitable.
- Git. This repository is public, so HTTPS cloning does not require credentials. GitHub CLI (`gh`) is optional.
- Corepack, using the root `package.json` **`packageManager` pin: pnpm 10.4.1**. Do not substitute the separately listed pnpm development dependency for this pin.

Clone with either command, then enter the directory:

```sh
# GitHub CLI
gh repo clone WaxOnDeploy/slice-of-flow
# OR Git over HTTPS (no credentials required for this public repository)
git clone https://github.com/WaxOnDeploy/slice-of-flow.git

cd slice-of-flow
corepack enable
corepack pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

Corepack reads the pinned version from this project. If `corepack` is unavailable in your Node installation, install Corepack first; if enabling its shims requires permissions, use `corepack pnpm` in place of `pnpm` below.

If an older bundled Corepack reports **“Cannot find matching keyid”**, update Corepack rather than disabling signature verification. A verified, non-global alternative is `npm exec --yes --package=pnpm@10.4.1 -- pnpm test` (replace `test` with `install --frozen-lockfile` or `build` as needed).

Open **http://localhost:3000/**. Vite binds to all interfaces and tries another port if 3000 is occupied, so check the terminal URL. Use a wide desktop/tablet viewport (1024px+ is recommended); the five-column board is not optimized for narrow phones.

### Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server, normally on port 3000. |
| `pnpm check` | Type-check with `tsc --noEmit`. |
| `pnpm test` | Run the tracked Vitest regression suite once. |
| `pnpm test:watch` | Run regression tests in watch mode during development. |
| `pnpm test:e2e` | Run workshop browser acceptance tests against an existing production build; see below. |
| `pnpm test:exports` | Run real-browser PNG, print, cancellation, privacy and cleanup tests against the production build. |
| `pnpm build` | Require passing regression tests and type checks, then build the Vite client and Node helper. |
| `pnpm preview` | Inspect the built client with Vite preview; use the URL it prints. |
| `pnpm start` | Run the built Node helper in production mode, normally on port 3000 (`PORT` overrides it). |
| `pnpm format` | Rewrite project formatting with Prettier; this modifies files. |

```sh
pnpm check
pnpm build
pnpm preview
```

**Two build outputs, two purposes:** `dist/public/` is the deployable static site, including `index.html` and bundled assets. `dist/index.js` is the optional Express/Node helper, which serves `dist/public` and falls back to `index.html` for client routes. Static hosting does not need to run `pnpm start`; the helper is not a gameplay API or database. Run `pnpm build` before either preview or start. Both Vercel and Pages invoke this gated build; it is not a substitute for protected-branch review or human/device playtesting.

## How to play

Each round starts with the same **12 fixed orders**, in deck order, ranging from Small to Large. Orders waiting in the deck are represented by the remaining-order counter, not a draggable deck column. Move active tickets through:

**Orders → Prep → Oven → Pizza Box → Served**

Tickets move **forward, one station at a time**. You cannot skip Prep, move backward, put an unfinished pizza in the Oven, or take an unfinished bake to Pizza Box. Pizza Box → Served is a separate move with no processing timer.

| Pizza size | Prep time | Bake time |
| --- | --- | --- |
| Small | 30 seconds | 40 seconds |
| Medium | 60 seconds | 60 seconds |
| Large | 90 seconds | 80 seconds |

These are **simulated seconds**, not necessarily wall-clock seconds. Prep starts on entry to Prep; wait for **“✓ Ready for oven”**. In the Oven, wait for **“✓ Pull it out!”**, then move to Pizza Box promptly. A readiness arrow/glow signals timing readiness, but destination capacity can still block the move. The Oven's displayed countdown includes the remaining time **until burning**, not just until baking finishes.

A pizza burns if left in the Oven beyond its bake time plus the difficulty's post-bake buffer. Burnt tickets stay visible, cannot be selected/dragged in the board UI, and do not consume active Oven/WIP capacity; **“BURNT — Toss it”** is a status label, not a discard button. Customer patience is tracked from entry to Orders until service; the fuse shows waiting time and an angry customer incurs a penalty.

### Push versus Pull

- **Round 1 — PUSH:** after the guided move, orders auto-enter Orders on the preset interval regardless of your capacity. Orders, Prep, and Pizza Box have no WIP limits, but the **Oven always holds at most 3 non-burnt pizzas**.
- **Round 2 — PULL:** orders do not auto-enter. Choose **“Pull Next Order”** when ready. WIP limits are **Orders 4, Prep 2, Oven 3, Pizza Box 2**; Served has no limit. Pulling at a full Orders queue or with an empty deck adds nothing, even though the button remains clickable. Finish downstream work to create room before starting more.

Select **“Learn Kanban →”** after Round 1, work through the three transition screens with **“Next →”**, then choose **“Start Round 2 →”**. Each round ends when its clock expires or all 12 orders have been served/burnt. A clear kitchen can briefly expose **“Ring the Bell!”**, but the next tick also auto-ends it; do not rely on a lasting bell prompt.

### Difficulty and speed

Choose **“Choose Your Heat Level”** on the landing page before opening the kitchen:

| Difficulty | Round length | Round 1 auto-order interval | Default speed | Post-bake burn buffer |
| --- | --- | --- | --- | --- |
| Easy | 7 simulated minutes | 20 simulated seconds | 2x | 30 simulated seconds |
| Normal (default) | 4 simulated minutes | 15 simulated seconds | 3x | 15 simulated seconds |
| Hard | 3 simulated minutes | 10 simulated seconds | 3x | 15 simulated seconds |

The board's **1x / 2x / 3x** controls change how many simulated seconds advance per one-second tick, including prep, bake, arrivals, and the round clock. Choose **1x** for a gentler first attempt. Open **Menu** for deck-derived size timings, every actual order type, and the post-bake burn window. The tutorial and transition use the selected difficulty's actual arrival interval. The landing selector's **“After-bake buffer”** now shows the actual preset difference between burn and done thresholds, rather than a misleading total fallback oven duration.

## Tutorial and your first move

1. Open `/`. If the default ticket splash appears, click **“FIRE IT UP!”** to reach the landing page. Alternate splash variants can be selected with `?splash=neon` or `?splash=pizzabox`.
2. Choose **Easy** if learning, then click **“Open the Kitchen”**. The five-step **“ORDER UP!” / “HOW TO PLAY”** tutorial covers arrivals, movement, timers, scoring, and two rounds. Advance with **“Next Order →”** and finish with **“Fire it up! 🍕”**, or choose **“Skip”**.
3. Round 1 remains paused after the tutorial. Order **#1, Cheese for Sarah**, appears automatically in **Orders**, highlighted with **“Start here: select this order.”** and **“Round clock paused”**. You do not have to wait for an auto-flip or pull an order.
4. Click/tap that ticket, or focus it with Tab and press Enter/Space. The prompt becomes **“Move it to Prep — work moves one station at a time.”** Prep is highlighted and offers **“Move #1 to Prep →”**.
5. Click/tap **“Move #1 to Prep →”**, drag the selected ticket into Prep, or press ArrowRight while the selected ticket itself has keyboard focus. All three paths use the same movement validation.
6. Confirm **“Prep started. This ticket will be ready shortly.”** The clock stays paused during this confirmation, then starts **1.5 seconds later**, together with normal Push arrivals. The ticket's prep countdown then advances.
7. When that ticket says **“✓ Ready for oven”**, select it again and move it to Oven. Wait for **“✓ Pull it out!”**, select and move to Pizza Box, then select and move to Served. Successful moves clear selection, so select the ticket again for its next move.

The guided Round 1 first move runs again on subsequent full games even when the introductory tutorial is already marked seen. **“Skip to Round 2 — WIP + Pull”** bypasses Round 1 and its guided first move; begin that board with **“Pull Next Order”** instead.

### Pointer, keyboard, and persistent help

The helper remains visible during play: **“Select a ticket → move it one station right when capacity is available.”** Selecting any ticket highlights its next station. When allowed, that station provides **“Move #<number> to <station> →”**; when blocked, it shows explanatory text rather than a move button, such as **“Finish Prep first; then send it to the Oven.”** or **“Let it finish baking; then send it to Pizza Box.”** Invalid drag/keyboard attempts also produce feedback.

Use native pointer drag-and-drop, or the click/tap selection plus next-action button path. For board keyboard play, **Tab** focuses tickets/buttons, **Enter/Space** selects a focused ticket, and **ArrowRight** moves it only when that selected ticket has focus and the move is valid. Native splash and gameplay buttons can be activated with Enter/Space. A moved ticket retains keyboard focus, but must be selected again before its next move. There is no global arrow-key navigation, keyboard drag mode, or implemented backward move. Keyboard-initiated phase changes and reduced-motion phase changes bypass the decorative curtain; pointer changes retain it.

The top bar offers sound mute/unmute and **How to Play** to reopen the tutorial. Sound effects are synthesized with Web Audio. **Reopening the tutorial pauses the simulation until it closes**; this is instructional help, not a new general facilitator pause control. The existing accessible dialog primitive contains Tab/Shift+Tab focus and hides the background. Escape closes the tutorial without bypassing Round 1's guided pause. Focus returns to the first ticket after onboarding or to How to Play after reopening help. Round-end results cannot be dismissed with Escape or an outside click: continue with their labelled button.

## Results and facilitation

Score: **+1** per served pizza, **−2** per burn, **−1** per angry non-burnt customer, and **+3** for zero burns **only if at least one pizza was served**. Average lead time measures simulated time from Orders entry to service for served pizzas; undealt orders are not counted as in progress.

Choose **“See Full Results →”** after a full game or **“See Your Results →”** after skipping Round 1. The debrief shows scores, served/burnt/angry counts, average lead time, unfinished work, charts, a **“The Bridge”** table mapping kitchen stages to team workflow, and discussion questions. Results reflect play; improvement is not guaranteed. **Share Results** uses native sharing or a clipboard fallback; **Play Again / Play Full Game** returns to the landing page. The landing page also has a **Facilitator Quick-Start Guide** for projected team sessions.

### Step 1 reliability changes

Missing averages and unavailable percentage comparisons display neutral **n/a**. Score percentage requires actual completed samples in both rounds and a positive Round 1 score; zero/negative baseline percentages are unavailable, while recorded raw scores remain visible. Each learning card states an observation only when its own numbers support it; otherwise it asks a neutral question. Shared results follow the same availability rules, link to `https://slice-of-flow.com`, and do not promise a better outcome. Native share cancellation does not automatically copy results.

Round 1 reflection acknowledges fewer than two deliveries; stronger outcomes get a neutral baseline reflection. The transition introduces **four core practices**, not a complete set of Kanban principles, and uses the selected difficulty's simulated arrival interval. Tests cover comparison/scoring boundaries, truthful insights/share text, transition copy, rendered results/branding, pause/readiness/capacity, and a complete deterministic R1/R2 operator run. Automated runs are not evidence of a completed independent human workshop or full cross-browser certification. New rounds, general facilitator controls, timer/anger rebalance and offline caching remain separate work. PNG and print exports are the later batch described below.

### Workshop-ready Rounds 1–2 batch

- **F4:** “How scoring works” appears in both full and skipped-R1 debriefs. Numeric wording comes from the existing scoring constants. Bonus notes appear only for qualifying recorded rounds; burnt customers are not counted again as angry.
- **F5:** Every actual order type and its timing is derived from the fixed deck. Custom Build is ordinary Large work (90 simulated seconds Prep / 80 Oven), without VIP priority, extra capacity or expedited handling. The guide appears before Start and Skip on landing, before starting Round 2 on the transition, in the tutorial, and in Today's Specials.
- **F7:** Required board ticket, station, action and helper text is at least 16px. Served, Burnt, Angry and Orders left are visible labels, not tooltip-only icons. Numeric WIP labels count non-burnt active tickets, matching existing capacity validation. Five columns retain independent vertical scrolling.
- **N3:** Tutorial and round-end focus handling uses the existing dialog primitive. Background controls are inert during dialogs/curtains; visible focus and deliberate phase targets support the existing keyboard/pointer/touch paths. No new round or scoring/timing rebalance is included.

Build first, install the development-only browser engines, then run the tracked acceptance script:

```sh
pnpm build
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:e2e
```

The local suite requires **OpenSSL on PATH** to create a one-day, loopback-only test certificate in the operating system's temporary directory. It starts a temporary **HTTPS** production server applying the unchanged `vercel.json` headers, including `upgrade-insecure-requests`; generated certificate files are removed afterward and never committed. Certificate-error bypass is limited to that local test server, not a supplied production URL. Alternatively, supply an existing HTTPS preview with `SOF_TEST_URL`.

The script tests 1280px and 1024px desktop boards, emulated tablet touch, modal focus, paused guidance/help, all splash variants, difficulty layouts with fallback fonts, a UI-only two-round playthrough, and skipped-R1 results. Results and screenshots go to ignored `test-results/workshop/`. It uses no debug-store injection or fabricated metrics. For a live-site smoke test, set `SOF_TEST_URL=https://slice-of-flow.com/`. `SOF_BROWSERS=chromium` selects one engine; `SOF_FULL_PAIR=0` and `SOF_EXTENDED=0` omit longer checks. Native device/browser and an uncoached human workshop remain separate acceptance work; Linux WebKit is not a claim of testing actual Safari/iPad hardware. Normal hosting builds retain the unit/typecheck gate; browser tests are a separate release check.

### Local results exports

Both debrief paths provide **Download PNG**, **Share image**, and **Print / Save PDF**. A native disclosure previews the included data. PNG output is a 1600px-wide, naturally sized diner-style summary with the selected difficulty, measured counts/times/scores, consistent missing-data rules and exact author/site credit. Native canvas draws only allowlisted results and system-font text: no screenshot of the board, cross-origin image capture, hosted-font capture, new dependency at runtime, upload, account or server is required.

Image sharing uses a prepared local PNG under a fresh button activation. If native file sharing is unsupported, it requests a local PNG download; cancelling native sharing does not unexpectedly download or copy anything. Temporary download anchors are removed and object URLs are revoked. Text sharing retains its existing native/clipboard paths; if both modern and legacy copying fail, the UI shows a helpful export alternative instead of falsely claiming success.

**Print / Save PDF** opens the browser's print dialog for the same document, without a popup or iframe. The dedicated black-on-white debrief includes a results table, score rules, supported observations, **The Bridge**, discussion questions and a next-experiment writing area. Gameplay, art, interactive controls and charts are not printed. Cancelling leaves the current results intact. The print layout is scoped to the debrief; it does not replace the interactive page or retained routes.

Exports use a copied/frozen, numeric-field allowlist. Arbitrary card names, personal/facilitator/dependency labels and metadata are excluded; there are no free-text label fields in this export batch. Round 1 skipped/missing values stay **n/a**, not fictitious zeros. Measured zero counts and negative scores remain real values. Lead time is **Orders-to-served time for served tickets only**; unfinished tickets are excluded. Printing includes the same supported questions/mappings as the screen, not a second hard-coded copy.

```sh
pnpm build
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:exports
```

The export suite uses the same temporary HTTPS/security policy and supports `SOF_TEST_URL`, `SOF_TEST_PORT`, `SOF_TEST_OUTPUT`, and `SOF_BROWSERS`. Evidence is written to ignored `test-results/exports/`; downloaded empty-round samples are explicitly test evidence, not real team results. Development-only jsdom supports DOM unit checks; it is not shipped in the app. See [native canvas PNG generation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [browser printing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing), and [native sharing](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) for platform requirements.

### Isolated deterministic flow foundations

`client/src/lib/sofEngine/` contains a separately tested pure fixed-deck engine, integer-ms/wall-us driver, canonical event accounting and copied/frozen final snapshots/archive values. `flow/sof018Metrics.ts` measures all-active Orders-admission-to-terminal-exit WIP, actual observation/rates, finished samples and a separately labelled short-run Orders-to-exit illustration. `sof/metricDefinitions.ts` preserves explicit source/units/sample definitions. The golden production deck uses seed 0 only; marked synthetic fixtures never become public scenarios. Inputs and commands fail closed; physical resources, policy WIP and score rules are distinct.

These modules do not replace the **ordinary** Round 1 / Round 2 timer/store, record earlier R1/R2 history, enable rounds 3–5, add storage or modify existing exports. The core foundation release had 151 dedicated tests; its combined export-release suite had 518 tests. A separately flagged draft preview can import the modules only through the lazy composition seam documented below. Library/build evidence is not human gameplay or native-device certification.

`validateSnapshot` is a lifecycle/measurement port, not proof an external ledger was played. `snapshotFromEngine`/`finalizeRun` additionally enforce replay-compatible producer state. A valid zero-duration served port fixture does not grant instant-service physics. Legacy positive-usable served means have unknown observation/sample history and are not silently interchangeable with the new nonnegative-elapsed definition. The sole comparison assessor validates actual producer compatibility, configured policy change, observation and control traces; equal seed or score is insufficient and no human play is certified.

## Browser-local state and retained routes

Gameplay, difficulty, speed, and round results live in an **in-memory Zustand store**: a full reload resets them. There are no game accounts, cloud saves, server-side scores, or cross-device/team state synchronization. Resetting a game keeps the current difficulty and speed within that page session.

The tutorial-seen flag is stored as **`sof-tutorial-seen` in localStorage**, scoped to this browser/origin. The splash-seen flag uses **`sof-splash-seen` in sessionStorage**. To repeat onboarding, clear just those keys in browser developer tools and reload; neither flag saves game progress. Storage restrictions can affect onboarding because these reads/writes are not guarded.

| Route | Purpose |
| --- | --- |
| `/` | Slice of Flow splash, landing, both rounds, transition, and debrief; phases do not have separate URLs. |
| `/license` | Public License & Permissions page, full proprietary notice and permissions contact. |
| `/slice-of-flow` | Compatibility route that replaces the location with `/`. |
| `/deck-shop` | Retained original coaching/deck-shop page (`Home.tsx`), preserved in this history-preserving copy. |
| `/game` | Retained Agile text adventure, “The Quest for the Golden Sprint”; not the pizza board. |
| `/404` and unmatched paths | Not-found page. |

## Deployments — Vercel and GitHub Pages

**Vercel production:** [slice-of-flow.com](https://slice-of-flow.com/), also available at [slice-of-flow.vercel.app](https://slice-of-flow.vercel.app/). `www.slice-of-flow.com` uses a permanent, path-preserving 308 redirect to the main domain. The domain stays registered at Porkbun; its apex A record and www CNAME point to Vercel. The project is linked to this repository's `main` branch. Pushes to `main` build and update production; other branches can receive Vercel preview deployments.

The root **`vercel.json`** sets the Vite preset, `pnpm install --frozen-lockfile`, `pnpm build`, static output `dist/public`, and SPA rewrite `/(.*)` → `/index.html`. Security response headers are described below. For a new Vercel import, keep the root directory at the repository root, not `client`. No gameplay environment variables are required. **Do not set `VITE_BASE_PATH` on Vercel**; its app and assets are served at `/`.

**GitHub Pages target:** [waxondeploy.github.io/slice-of-flow](https://waxondeploy.github.io/slice-of-flow/). The workflow [Deploy to GitHub Pages](https://github.com/WaxOnDeploy/slice-of-flow/actions/workflows/deploy-pages.yml) runs on every push to `main` or manually via **Actions → Deploy to GitHub Pages → Run workflow**. In repository **Settings → Pages**, the publishing Source must be **GitHub Actions**. Check the workflow's green deployment result before treating a new revision as live.

The Pages workflow installs the package-manager pin, uses Node 22, type-checks, and builds with **`VITE_BASE_PATH=/slice-of-flow/`**. Vite asset URLs and the Wouter router share that base. Pages routes are `/slice-of-flow/`, `/slice-of-flow/deck-shop`, and `/slice-of-flow/game`; Vercel routes stay `/`, `/deck-shop`, and `/game`.

Pages cannot configure a server-side SPA rewrite. The workflow copies `index.html` to `404.html`, so direct deep links still render the correct application route, but the initial document response is HTTP **404**. Use Vercel when deep links must return HTTP 200. Static hosting serves `dist/public`; neither host runs the optional `dist/index.js` helper.

These integrations publish from GitHub; source pushes alone do not alter DNS or domain registrations. `slice-of-flow.com` has been separately connected to Vercel; the existing Manus deployment and the GitHub Pages backup remain separate hosts. The public repository exposes its source, retained pages, notes, assets, and Git history; never commit secrets.

### Vercel TLS and security headers

Vercel manages the custom-domain certificates and automatic renewal; no certificate private key belongs in this repository. The live domain was verified with TLS 1.2 and TLS 1.3. Vercel redirects HTTP to HTTPS. See [Vercel encryption and TLS](https://vercel.com/docs/cdn-security/encryption) for platform behavior.

`vercel.json` applies an enforced **Content Security Policy** to all paths. Scripts must come from the same origin; inline script handlers and eval are not allowed. Images are restricted to this origin, the exact CloudFront asset host, and `files.manuscdn.com` for the new cartoon storefront; Google Fonts has explicit stylesheet/font allowances. Inline **styles**, but not scripts, remain permitted because the existing React styles, animated board, and toast library require them. Embedded objects, child frames, and workers are blocked; the page itself can only be framed by its own origin. This is defense in depth, not a substitute for secure code or a complete security audit. See [Vercel CSP guidance](https://vercel.com/docs/cdn-security/security-headers).

The response headers also set `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`. **Permissions-Policy** denies camera, microphone, geolocation, payment, and USB access while preserving same-origin audio, fullscreen, native sharing, and clipboard copying. **Cross-Origin-Opener-Policy: same-origin** isolates cross-origin opener relationships; review this if popup-based authentication or payment is added later. Cross-Origin-Embedder-Policy is deliberately not set, to avoid blocking the external asset CDN.

**HSTS** explicitly preserves Vercel's existing `max-age=63072000` host-only policy. Neither `includeSubDomains` nor `preload` is enabled: other subdomains have not been audited, and a preload submission is a separate, long-lived domain-wide decision. Header changes are version-controlled and deploy through the normal GitHub → Vercel integration. GitHub Pages does **not** apply `vercel.json` response headers; the HTML retains only a supported referrer-policy fallback.

If analytics is enabled, add the trusted endpoint's **exact origin** to both `script-src` and `connect-src`, and allow any additional verified telemetry origin before redeploying. The default policy intentionally blocks third-party analytics scripts; do not weaken it to `https:`, wildcard script sources, or `unsafe-eval` to make an arbitrary endpoint work. Keep CSP allowances synchronized with new integrations and test the first-move flow, Round 2, fonts/images, and both retained routes after changes.

### Assets and optional analytics

Illustrations, textures, favicons, and social images reference external **CloudFront and Manus CDNs**; fonts load from **Google Fonts**. A GitHub clone does not download those resources, so the complete visual experience needs network access. Review their availability and usage permissions before publishing. The cartoon storefront and its approved HTML credit are centralized in `client/src/lib/sliceOfFlowBrand.ts`.

`client/src/main.tsx` loads an optional Umami-style analytics script **only when both `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` are configured**. No analytics keys or game API credentials are needed to play. Review the endpoint and privacy requirements before enabling it; Vite client variables are public build-time values, not a place for secrets. Canonical/Open Graph URLs and share copy use **`slice-of-flow.com`**.

The standalone GitHub/Vercel copy no longer installs the two unneeded editor-only
plugins: `@builder.io/vite-plugin-jsx-loc` and `vite-plugin-manus-runtime`. Normal
React/Tailwind Vite development and both static builds remain supported. The
separate original Manus-managed project keeps its editor configuration; it has
not been modified. Removal avoids carrying these unneeded dependencies forward,
but does not retroactively settle their historical publisher-license questions
or relicense the remaining third-party dependencies. See the
[plugin record](docs/ip/PLUGIN_LICENSE_REVIEW.md). Keep private source-art and
rights records outside this public repository; an archive is not legal clearance
or a completed copyright registration.

## File map

| Path | Responsibility |
| --- | --- |
| `package.json`, `pnpm-lock.yaml`, `patches/` | Scripts, pinned install, dependency lock, and the wouter patch. |
| `vite.config.ts` | `client` root, aliases, dev port, and `dist/public` output. |
| `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx` | Metadata/fonts/analytics, React entry, and route wiring. |
| `client/src/pages/SliceOfFlow.tsx` | Splash, phase transitions, and one-second simulation tick. |
| `client/src/pages/SliceOfFlowLanding.tsx` | Difficulty, start/skip controls, and facilitator guide. |
| `client/src/pages/SliceOfFlowBoard.tsx` | Tickets, stations, movement validation feedback, guided first move, and next actions. |
| `client/src/components/SliceOfFlowTutorial.tsx`, `SliceOfFlowSplash.tsx` | Intro tutorial and splash variants (both under `components/`). |
| `client/src/lib/sliceOfFlowConstants.ts`, `sliceOfFlowStore.ts`, `sliceOfFlowSounds.ts` | Orders/presets/WIP/scoring, state/actions/timers, and synthesized audio (all under `lib/`). |
| `client/src/pages/SliceOfFlowTransition.tsx`, `SliceOfFlowDebrief.tsx` | Kanban lesson and results/sharing (both under `pages/`). |
| `client/src/lib/sliceOfFlowExportModel.ts`, `sliceOfFlowPng.ts`, `sliceOfFlowClipboard.ts`, `sliceOfFlowDebriefContent.ts` | Safe summary, native PNG/local download, honest copying and shared debrief copy. |
| `client/src/components/SliceOfFlowExportActions.tsx`, `SliceOfFlowPrintSheet.tsx`, `client/src/lib/sliceOfFlowPrint.css` | Accessible local-export controls, data preview and print-only debrief. |
| `tests/exports.e2e.mjs`, `tests/browserHarness.mjs` | Real-browser export acceptance and temporary production-equivalent HTTPS harness. |
| `client/src/pages/Home.tsx`, `Game.tsx` | Retained deck-shop/coaching page and text adventure. |
| `server/index.ts` | Optional static-serving Node helper with SPA fallback. |
| `vercel.json` | Static deployment settings, SPA rewrite, and HTTP headers. |
| `.github/workflows/deploy-pages.yml` | Automatic Pages build/deploy with the repository base path and custom 404 fallback. |

## Manual smoke-test checklist

- [ ] Install from the lockfile; run `pnpm check`, `pnpm build`, and `pnpm preview` successfully.
- [ ] In a fresh browser/origin, enter the splash, read/skip the tutorial, and verify #1 appears while the clock remains paused.
- [ ] Select #1, use **Move #1 to Prep →**, confirm the exact success message and delayed clock start; repeat via drag and focused-ticket ArrowRight in separate games.
- [ ] At 1x, verify Prep/bake readiness, rejected early/skipped/backward moves, Pizza Box → Served, burn behavior, and the three-pizza Oven cap.
- [ ] Reach Round 2; verify manual pulls and WIP caps (4/2/3/2), then inspect the full debrief and share/replay controls. Also test the skip-to-Round-2 results path.
- [ ] Reload to confirm gameplay resets but onboarding flags remain; verify supported routes, deployed deep-link fallback, CDN/fonts, and analytics behavior.

## Default-off independent measurement lab — draft preview

On a **draft preview build only**, add `?flow-lab=1` to the root URL, finish a normal or skipped-R1 journey, then explicitly select **Start lab run** below the existing debrief. The flag does not start a run, replace ordinary gameplay, or record its past history. The lab uses the official fixed deck, manual pull, original difficulty/speed defaults and its own immutable run/clock adapter. Its local opaque run codes are identity only, not randomized demand or personal labels.

Pause/Resume belongs only to the facilitator. Instructions, the first-move guide, help, hidden tabs and exit confirmation retain independent pause ownership. Resume samples/rebases while still paused to avoid catch-up. One scheduler exists only during unpaused active lab play; page exit/unmount cancels it. This preview is intentionally silent, with no catch-up sounds. **Hide live scores** removes only live aggregates from DOM/accessibility while retaining operational timers and burn hazards. Ending records an actual terminal snapshot; confirmed exit abandons the active draft without inventing a completed result. Replay starts a fresh manual attempt, not replayed or synthetic played evidence.

Completed lab runs provide measured all-active WIP, served-only delivery rate and Orders-to-served sample mean, distinct all-exit rate and a clearly caveated Orders-to-exit illustration. A read-only disclosure draws cumulative flow from **every** independently reconciled event prefix, including equal-time transitions; waiting outside Orders is not active WIP. Numeric tables and a keyboard event selector preserve exact ms timing. No chart is invented for a zero-duration observation.

The second disclosure requires explicit, distinct baseline/subject selections and uses the sole comparison assessor once. It is deliberately **contextual**, never presented as a matched policy experiment, winner or causal benefit. Missing means stay unavailable; actual observation windows, populations, units and sample counts are retained. No automatic latest/best baseline is selected, and existing PNG/print/text exports remain the original R1/R2 summaries.

```sh
pnpm build
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm test:lab
```

The lab test uses the same temporary local HTTPS/CSP harness and `SOF_TEST_*`/`SOF_BROWSERS` options. It performs real UI actions, complete independent play, keyboard/pointer/focus, owned pause/help/exit, score hiding, fresh replay/manual end, exact-history CFD, contextual pair selection, phone layout and no data-post checks. The ordinary full-game/export suites remain separate release gates. Engine tests and emulated browsers are not a human playtest, Safari/Edge/iPad/projector certification, or evidence of team usage. Keep this feature on a draft branch until human review; the optional VIP pilot below also stays draft-only, never part of ordinary production play.

## Optional Round 3 — VIP / Expedite draft pilot

On this **draft preview branch only**, add `?round3=1` to the root URL. Opening it displays setup; no clock or orders start until **Start FIFO baseline**. Complete a FIFO attempt, then optionally choose **Start VIP/expedite**. Both run the same fixed 12 Normal orders plus three Small VIP orders. Custom Build remains a Normal, Large order. Default Rounds 1–2, their exports, `/deck-shop`, `/game`, `/license`, author credit, proprietary license and security headers are preserved.

The initial pilot uses **300 simulated seconds** on Normal/Hard, VIP arrivals at **10 / 90 / 170 seconds**, and **90 seconds from external arrival** to serve each VIP. Easy uses 420 seconds, arrivals 60 / 160 / 260, and a 120-second deadline window. These are tuned **pilot values**, not the original document's proposed 4:00 / 0:45 / 1:45 / 2:45 defaults. At 3×, a Normal/Hard run needs about 100 uninterrupted real seconds; instructions, pauses and discussion add time. Timing feasibility is not human-play acceptance.

FIFO pulls the oldest available order across both classes. Expedite may pull the earliest available VIP before Normal backlog, but permits **only one active VIP globally** until that ticket is served, burnt or closed. Both variants retain the same two physical Prep workers and three oven slots. A VIP can use a single extra **Orders or Pizza Box policy slot**, visibly marked when occupied; it can **never** exceed physical Prep/Oven capacity. No automatic ticket admission or movement occurs.

VIP deadlines begin at external arrival, not Orders admission. Service exactly at the deadline is on time. A missed deadline for a nonburnt VIP costs 2 points once, including VIPs still in external backlog; burn costs 2 points instead of adding a second deadline penalty. VIP deadline status is shown separately from the existing ledger-based ordinary angry count. The five exclusive VIP outcomes partition all three orders: on time, late, pending, not yet arrived, burnt. An early manually discarded VIP is an unsuccessful late closure, but receives a deadline penalty only after the actual deadline has elapsed.

Normal cards show a **current positive-time waiting overlap** while a VIP is active, excluding processing and external backlog. Final results count distinct Normal tickets observed waiting in Orders, ready Prep/Oven, or Pizza Box during VIP activity. These labels mean **observed overlap**, not proof of counterfactual delay caused by VIPs. Arrival-to-served and Orders-to-served means are separate, include sample sizes, and use N/A for empty served samples.

Choose the completed FIFO and Expedite run IDs explicitly to reveal the before/after table. No latest/best pair is preselected. Only the existing comparison assessor evaluates matched conditions; manual ends, differing settings/controls or mismatched windows stay **not matched**. A matched pair is not a causal claim or promised improvement. No Round 2 aggregate is misrepresented as a normal-only baseline. Discussion asks what happens when every order is VIP, who can declare urgency, and what limits the equivalent expedite lane in real work.

Keyboard Enter/Space selects a ticket; focused-ticket ArrowRight or the highlighted destination button moves it. Ticket DOM identity is retained across stations. Pause/Resume, help, hidden-tab and exit pauses have separate ownership, with one scheduler only while running. Live score hiding leaves operational time/burn information available. Run records remain in local memory only; no uploads, names, account, leaderboard or automatic sharing is added. Existing Print / Save PDF exports remain original R1/R2 content and exclude the whole independent lab and its portal dialogs.

```sh
pnpm build
pnpm test:round3       # Chromium full-horizon pair; Firefox/WebKit short manual runs
pnpm test:lab-print    # Original debrief prints with lab pre-start, dialogs and final results
```

The tracked browser suites use temporary HTTPS with the existing security headers. `SOF_BROWSERS=chromium,firefox,webkit` selects engines; `SOF_VIP_FULL_PAIR=0` uses explicitly short manual runs instead of a Chromium full-horizon pair. Use a browser-safe `SOF_TEST_PORT` (default 4186 for Round 3; avoid restricted 4190). They do not replace actual Safari/iPad/projector or human workshop review. Keep this pilot **draft and unmerged** until human interpretation and playability review. Rounds 4–5, the complete cross-round picker, all-round facilitator controls, VIP-specific export and multi-device play are not implemented here.


### Automated Normal / 3× VIP FIFO and Expedite runs

On the draft Round 3 branch, run `pnpm test:round3:3x` for exact engine/driver stress assertions, full unit/type gates, an isolated production build and a real-browser FIFO → expedite pair. Both browser runs use Normal/3×, finish at the actual 300-simulated-second horizon and explicitly select retained IDs for comparison. The player uses only visible controls and reports actual outcomes, not a guaranteed expedite win. Chromium is the default; `SOF_BROWSERS` enables more engines.

Use `pnpm test:round3:stress` for fast deterministic virtual-wall-clock assertions only. Neither command deploys the app or changes a running UAT preview's build. Reports/screenshots go to ignored `test-results/round3-3x/`. Local browser serving requires OpenSSL on PATH and installed Playwright Chromium; engine-only checks do not. See [3× commands, exact timing landmarks and stress latency expectations](tests/VIP_3X_TESTING.md) for setup, PowerShell options, sample-size semantics and the distinction between simulated test evidence and observed browser play.
