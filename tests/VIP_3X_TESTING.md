# Automated Normal / 3× FIFO and Expedite testing

This adds test tooling to the **draft Round 3 branch**, not a new gameplay rule or a production release. Copyright and the root proprietary LICENSE remain unchanged.

## Run it

From the repository root, with Node 22.12+ and the project's pinned pnpm:

```sh
git switch feat/round3-vip-preview
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:round3:3x
```

The local HTTPS browser harness also requires **OpenSSL on PATH**. On Windows, install/provide OpenSSL or use a reachable HTTPS Round 3 preview. The pinned package manager can alternatively be invoked with `npm exec --yes --package=pnpm@10.4.1 -- pnpm test:round3:3x` without changing global tooling.

Fast exact engine/driver assertions, with no browser installation or OpenSSL needed:

```sh
pnpm test:round3:stress
```

The full command runs the deterministic stress assertions, full Vitest suite, type checks, a separate production client build, and a browser-operated FIFO → expedite pair. Expect approximately **100 seconds per run** plus setup/build time on a healthy system. Default browser: Chromium. It writes to ignored `test-results/round3-3x/`, exits nonzero on failure, and closes the temporary server/browser. The separate artifact directory leaves a running UAT preview's `dist/public/` untouched.

### Optional settings

Linux/macOS examples:

```sh
# Broader full-horizon coverage: every selected browser runs both complete runs.
SOF_BROWSERS=chromium,firefox,webkit pnpm test:round3:3x

# Browser-only against an existing HTTPS preview which actually contains Round 3.
SOF_TEST_URL='https://YOUR-PREVIEW/' node tests/run-vip-3x.mjs --browser-only

# Isolated report directory.
SOF_TEST_OUTPUT=/absolute/path/to/results pnpm test:round3:3x
```

PowerShell equivalents:

```powershell
$env:SOF_TEST_URL = 'https://YOUR-PREVIEW/'
node tests/run-vip-3x.mjs --browser-only
Remove-Item Env:SOF_TEST_URL
```

`SOF_TEST_URL` supplies a base URL (the browser runner adds `?round3=1`), not the old production game unless Round 3 has been released there. Access-protected Vercel previews require a separately authenticated testing setup; this script does not extract credentials or bypass protection. Existing URLs and artifacts skip the local build/gates, so use the full local command for source validation. `SOF_TEST_DIST` can point to an existing root-host build. `SOF_TEST_PORT` defaults to browser-safe loopback port 4184; avoid browser-restricted ports such as 4190. External HTTPS URLs do not use certificate-error bypass.

## What is automated

### Exact, fast stress layer: `vip-3x-stress.ts`

Legal commands execute through the existing session/engine and integer wall-time driver. Virtual wall samples avoid stopwatch flakiness and verify millisecond boundaries without waiting for real minutes. These are deterministic test scenarios, **not real human gameplay or wall-clock performance benchmarks**. No reducer code, production manifest or policy is modified.

Expected boundaries include scheduled arrivals, external-arrival deadlines, Prep/Oven readiness, burn, fixed horizon, pause rebasing, physical capacities, token ownership, no-queue service latency, late service and late-then-burn scoring, missing served samples, manual-end comparison rejection and frozen results. Read `stress.json` for the actual executed assertions and their measured evidence; do not infer coverage just from this list.

### Real browser layer: `vip-3x.e2e.mjs`

The player sets **Normal / 3×**, uses native keyboard guidance and pointer buttons, and plays both runs to their actual 300-second horizon. It does not set private React/store state, override the browser clock, invent snapshots, call hidden engine APIs or manually end the clean pair.

The operator clears downstream work first. FIFO pulls oldest available; expedite explicitly pulls an eligible VIP before another Normal and prioritizes VIPs within each station. It does **not** preempt cooking or reserve resources ahead of arrival. This is a disclosed strategy, not proof of optimal play. It may still serve VIPs late when both Prep workers are busy; the test must not assert that every expedite run wins or has three on-time VIPs.

Checks include 3× staying selected, no unplanned pause/hidden tab, all three observed arrivals, actual horizon completion, distinct retained IDs, explicit matched selection, served-sample reconciliation, empty means as N/A, no runtime/CSP errors and no automatic result uploads. Diagnostic pause/early-end scenarios remain separate from the clean pair.

## Report files

- `run-summary.json`: commands/exit status and overall success or failure.
- `stress.json`: exact stress-case assertions and measured timing/latency evidence.
- `browser/results.json`: actual rendered means, served counts, VIP outcomes, score, selected IDs and comparison table for each browser.
- `browser/*-action-trace.json`: DOM action requests and observed arrivals with relative browser wall time and approximate kitchen time.
- `browser/*-result.png` and `browser/*-comparison.png`: screenshots.
- `browser/failure.json`, `failure-page.txt`, `failure.png`: failure diagnostics when applicable. Keep an existing failure artifact as history, but use the newest `run-summary.json`/results to judge a rerun.

**Accuracy:** browser result means are rounded by the UI. Trace actions are requests, not proof of accepted engine transitions; the engine's final result is the measurement authority. Arrival trace times are when polling observes the DOM, not exact creation times. A mean divided by 3 is an equivalent unpaused real-time duration, not an independently measured response-time benchmark. Sample size is always included. Burnt, unfinished and unarrived tickets are excluded from served-only latency means.

## Exact Normal / 3× landmarks

All wall equivalents below exclude instructions, guided first move, Help, facilitator pause and hidden-tab time. T = 0 is guide release after the first Normal enters Prep. Display rounding/browser scheduling may delay observation; the deterministic layer verifies exact engine boundaries.

| Landmark | Simulated elapsed | Unpaused wall equivalent at 3× |
|---|---:|---:|
| VIP 13 arrival | 10 s | 3.333 s |
| VIP 13 deadline | 100 s | 33.333 s |
| VIP 14 arrival | 90 s | 30.000 s |
| VIP 14 deadline | 180 s | 60.000 s |
| VIP 15 arrival | 170 s | 56.667 s |
| VIP 15 deadline | 260 s | 86.667 s |
| Full-run horizon | 300 s | 100.000 s |

Each VIP requires 30 s Prep + 40 s Oven = **70 simulated seconds / 23.333 equivalent real seconds** in a no-queue, instant-handling test. Promptly served VIPs admitted on arrival finish at **80/160/240 simulated seconds**, corresponding to **26.667/53.333/80.000 real seconds from T = 0**.

The deadline window is 90 s = 30 real seconds. Thus admission delay + queue delay + human/automation handling must total **no more than 20 simulated seconds / 6.667 real seconds** for on-time service. Processing cannot be shortened by priority.

## Stress latency expectations—not fixed policy outcomes

| Scenario | Precisely expected behavior |
|---|---|
| No congestion, immediate admission/moves | VIP arrival-to-served and Orders-to-served both 70 s simulated. All three can be on time. |
| Backlog delay before admission | Arrival-to-served = external wait + Orders-to-served. The deadline does not reset. A 30 s external delay with immediate cooking yields 100 s arrival-to-served and is late. |
| Prep blocked by two active Normals | VIP stays in Orders until a slot is genuinely released. Earliest possible service includes that wait; there is no third worker or preemption. |
| Oven blocked by three active tickets | Ready VIP waits in Prep until a slot is released. No fourth oven slot; late service is possible even under expedite. |
| Orders/Box policy exception | Only the admitted VIP can use Orders place 5 or Pizza Box place 3. The exception does not remove waiting time, grant a worker, or allow Normals to use it. |
| Token held by an overdue VIP | A second VIP remains blocked until the first is delivered, burnt or otherwise closed. Expiry alone is not closure. |
| Service exactly at deadline | On time; 1 ms later is late with one −2 deadline charge. Initial speed 3× changes wall mapping, not this comparison. |
| Ready-to-burn window | On Normal, 15 simulated seconds / 5 real seconds. **At the burn boundary the ticket burns**; act before it, not at it. |
| Late then burnt | Arrival 10; Prep start 40; Oven start 70; deadline 100; Oven Ready 110; burn 125 s simulated. Final Burnt, not also Late. Burn charge replaces deadline charge, so −2 rather than −4 for that ticket. |
| Waiting overlap | Positive time with a Normal in Orders/Ready Prep/Ready Oven/Box while a VIP is active. Observed overlap is not a causal estimate of delay. |
| No served VIPs | VIP served n = 0, mean null/N/A. No assumed latency for unfinished or burnt tickets. |
| Pause or hidden tab | Kitchen events and deadlines freeze; paused wall time is excluded on resume. This is not a queue-delay penalty or accelerated catch-up. |
| Manual end | Retains actual partial observation and is not matched, even if the two short runs have equal durations. |

### Latency definitions

**Arrival-to-served:** service timestamp minus external arrival; includes external backlog, Orders waiting and processing. **Orders-to-served:** service timestamp minus Orders admission; excludes external backlog but still includes internal waiting. Means use actual served tickets only. Compare both means **and sample sizes**; a low served-only mean can hide numerous unfinished orders.

For the late-then-burn stress, wall equivalents from T = 0 are arrival 3.333 s, Prep 13.333 s, Oven 23.333 s, deadline 33.333 s, Ready 36.667 s and burn 41.667 s. Service never occurred, so that burnt VIP contributes no served latency sample.

These tests do not establish native Safari/tablet behavior, workshop effectiveness, optimal strategy, statistical significance or a guaranteed expedite advantage. They do not deploy or merge PR #8.
