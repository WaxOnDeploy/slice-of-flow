# Slice of Flow

A browser-based **Kanban pizza shop simulation** for Scrum Masters, Agile coaches, RTEs, delivery leads, and self-paced learners. Run the same kitchen through **Round 1: Push** and **Round 2: Pull + WIP limits**, then compare throughput, quality, and lead time.

This private repository, [`WaxOnDeploy/slice-of-flow`](https://github.com/WaxOnDeploy/slice-of-flow), contains the React 19 / TypeScript / Vite 7 application, its retained legacy pages, and a small Node static-serving helper. Workshop teams can discuss moves around one projected browser; this is not a synchronized multiplayer game.

## Local setup

### Requirements

- **Node.js 22, version 22.12 or newer, recommended.** Vite 7 requires Node **20.19+ or 22.12+**; older Node releases are not suitable.
- Git and access to the private GitHub repository. GitHub CLI (`gh`) is optional; authenticate it before cloning with `gh`.
- Corepack, using the root `package.json` **`packageManager` pin: pnpm 10.4.1**. Do not substitute the separately listed pnpm development dependency for this pin.

Clone with either command, then enter the directory:

```sh
# GitHub CLI (requires an authenticated account with repository access)
gh repo clone WaxOnDeploy/slice-of-flow
# OR Git over HTTPS (requires your GitHub credentials)
git clone https://github.com/WaxOnDeploy/slice-of-flow.git

cd slice-of-flow
corepack enable
corepack pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

Corepack reads the pinned version from this project. If `corepack` is unavailable in your Node installation, install Corepack first; if enabling its shims requires permissions, use `corepack pnpm` in place of `pnpm` below.

Open **http://localhost:3000/**. Vite binds to all interfaces and tries another port if 3000 is occupied, so check the terminal URL. Use a wide desktop/tablet viewport (1024px+ is recommended); the five-column board is not optimized for narrow phones.

### Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server, normally on port 3000. |
| `pnpm check` | Type-check with `tsc --noEmit`. |
| `pnpm build` | Build the Vite client and bundle the Node helper with esbuild. |
| `pnpm preview` | Inspect the built client with Vite preview; use the URL it prints. |
| `pnpm start` | Run the built Node helper in production mode, normally on port 3000 (`PORT` overrides it). |
| `pnpm format` | Rewrite project formatting with Prettier; this modifies files. |

```sh
pnpm check
pnpm build
pnpm preview
```

**Two build outputs, two purposes:** `dist/public/` is the deployable static site, including `index.html` and bundled assets. `dist/index.js` is the optional Express/Node helper, which serves `dist/public` and falls back to `index.html` for client routes. Static hosting does not need to run `pnpm start`; the helper is not a gameplay API or database. Run `pnpm build` before either preview or start. The current package has no `test` script; use the manual checklist below alongside type-checking and building.

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

The board's **1x / 2x / 3x** controls change how many simulated seconds advance per one-second tick, including prep, bake, arrivals, and the round clock. Choose **1x** for a gentler first attempt. Open **Menu** for size timings and the actual post-bake burn window. Some tutorial/transition copy assumes Normal's 15-second arrivals, and the landing selector's “Burn Window” value is not the actual post-bake buffer; the rules above follow the store implementation.

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

Use native pointer drag-and-drop, or the click/tap selection plus next-action button path. For board keyboard play, **Tab** focuses tickets/buttons, **Enter/Space** selects a focused ticket, and **ArrowRight** moves it only when that selected ticket has focus and the move is valid. Native buttons can be activated with Enter/Space. There is no global arrow-key navigation, keyboard drag mode, or implemented backward move. These board controls are not a claim of full-app keyboard accessibility: the default splash entry is currently click-only.

The top bar offers sound mute/unmute and **How to Play** to reopen the tutorial. Sound effects are synthesized with Web Audio. **Reopening the tutorial does not pause an already-running round**; there is no visible general pause control.

## Results and facilitation

Score: **+1** per served pizza, **−2** per burn, **−1** per angry non-burnt customer, and **+3** for zero burns **only if at least one pizza was served**. Average lead time measures simulated time from Orders entry to service for served pizzas; undealt orders are not counted as in progress.

Choose **“See Full Results →”** after a full game or **“See Your Results →”** after skipping Round 1. The debrief shows scores, served/burnt/angry counts, average lead time, unfinished work, charts, a **“The Bridge”** table mapping kitchen stages to team workflow, and discussion questions. Results reflect play; improvement is not guaranteed. **Share Results** uses native sharing or a clipboard fallback; **Play Again / Play Full Game** returns to the landing page. The landing page also has a **Facilitator Quick-Start Guide** for projected team sessions.

## Browser-local state and retained routes

Gameplay, difficulty, speed, and round results live in an **in-memory Zustand store**: a full reload resets them. There are no game accounts, cloud saves, server-side scores, or cross-device/team state synchronization. Resetting a game keeps the current difficulty and speed within that page session.

The tutorial-seen flag is stored as **`sof-tutorial-seen` in localStorage**, scoped to this browser/origin. The splash-seen flag uses **`sof-splash-seen` in sessionStorage**. To repeat onboarding, clear just those keys in browser developer tools and reload; neither flag saves game progress. Storage restrictions can affect onboarding because these reads/writes are not guarded.

| Route | Purpose |
| --- | --- |
| `/` | Slice of Flow splash, landing, both rounds, transition, and debrief; phases do not have separate URLs. |
| `/slice-of-flow` | Compatibility route that replaces the location with `/`. |
| `/deck-shop` | Retained original coaching/deck-shop page (`Home.tsx`), preserved in this history-preserving copy. |
| `/game` | Retained Agile text adventure, “The Quest for the Golden Sprint”; not the pizza board. |
| `/404` and unmatched paths | Not-found page. |

## Deployment setup — Vercel

**Vercel configuration is present; hosting is not connected yet.** The steps below describe setup, not a live deployment. The root **`vercel.json`** supplies framework preset **`vite`**, install command **`pnpm install --frozen-lockfile`**, build command **`pnpm build`**, output directory **`dist/public`**, and an SPA rewrite from **`/(.*)` to `/index.html`**. It also sends `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` as actual HTTP headers.

1. In Vercel, create/import a project from **WaxOnDeploy/slice-of-flow** and grant access to the private repository.
2. Keep the project root at the repository root (not `client`), select Vite, use Node 22, and verify the install/build/output settings above. Ensure installation honors the pinned pnpm version.
3. Review optional analytics and external resources below, then create a preview deployment. Verify `/`, `/deck-shop`, `/game`, `/slice-of-flow`, and an unknown path, including direct navigation/reload through the SPA rewrite.
4. Promote a tested deployment and attach a custom domain only as a separate, deliberate hosting/DNS step. Static Vercel hosting serves `dist/public`; it does not run `dist/index.js`.

Copying or syncing source to GitHub **does not itself change existing hosting, domain registrations, or DNS**. An explicitly configured deployment integration may publish future commits; review those links before pushing. Existing hosting/domains remain unaffected by source sync alone.

### Assets and optional analytics

Illustrations, textures, favicons, and social images reference an external **CloudFront CDN**; fonts load from **Google Fonts**. A GitHub clone does not download those resources, so the complete visual experience needs network access. Review their availability and usage permissions before publishing.

`client/src/main.tsx` loads an optional Umami-style analytics script **only when both `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID` are configured**. No analytics keys or game API credentials are needed to play. Review the endpoint and privacy requirements before enabling it; Vite client variables are public build-time values, not a place for secrets. Manus/editor instrumentation is limited to Vite development serving and is omitted from production builds. Canonical/Open Graph URLs use **`slice-of-flow.com`**, while share copy says **`sliceofflow.com`**; reconcile those with the intended domain before publishing.

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
| `client/src/pages/Home.tsx`, `Game.tsx` | Retained deck-shop/coaching page and text adventure. |
| `server/index.ts` | Optional static-serving Node helper with SPA fallback. |
| `vercel.json` | Static deployment settings, SPA rewrite, and HTTP headers. |

## Manual smoke-test checklist

- [ ] Install from the lockfile; run `pnpm check`, `pnpm build`, and `pnpm preview` successfully.
- [ ] In a fresh browser/origin, enter the splash, read/skip the tutorial, and verify #1 appears while the clock remains paused.
- [ ] Select #1, use **Move #1 to Prep →**, confirm the exact success message and delayed clock start; repeat via drag and focused-ticket ArrowRight in separate games.
- [ ] At 1x, verify Prep/bake readiness, rejected early/skipped/backward moves, Pizza Box → Served, burn behavior, and the three-pizza Oven cap.
- [ ] Reach Round 2; verify manual pulls and WIP caps (4/2/3/2), then inspect the full debrief and share/replay controls. Also test the skip-to-Round-2 results path.
- [ ] Reload to confirm gameplay resets but onboarding flags remain; verify supported routes, deployed deep-link fallback, CDN/fonts, and analytics behavior.
