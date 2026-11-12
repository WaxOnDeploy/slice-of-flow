import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedProcess, outcomeExitCode, PROCESS_CLEANUP } from './vip-process.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Whole-process deadlines, distinct from player timing assertions/watchdogs.
// Browser budget covers up to three ~200s pairs plus launch/report overhead.
// Each deadline permits at most another 1.5s grace + 1.5s forced cleanup.
export const STEP_TIMEOUTS_MS = Object.freeze({
  negatives: 60000, stress: 60000, regressions: 180000, typecheck: 120000, build: 180000, browser: 900000,
});

export function launcherPlan(mode, env, output) {
  if (!['--all', '--engine-only', '--browser-only'].includes(mode)) throw new Error('Usage: node tests/run-vip-3x.mjs [--all|--engine-only|--browser-only]');
  const plan = [];
  const add = (kind, label, args, stepEnv = env) => plan.push({ kind, label, command: process.execPath, args, env: stepEnv, timeoutMs: STEP_TIMEOUTS_MS[kind] });
  if (mode === '--all') add('negatives', 'Node-only invariant and infrastructure negative tests',
    ['--test', 'tests/vip-3x-assertions.node-test.mjs', 'tests/vip-infrastructure.node-test.mjs']);
  if (mode !== '--browser-only') add('stress', 'Exact Normal/3× driver and stress assertions',
    [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'tests/vip-3x-stress.ts'],
    { ...env, SOF_STRESS_OUTPUT: path.join(output, 'stress.json') });
  if (mode !== '--engine-only') {
    // Supplied targets intentionally skip all local regression/type/build gates.
    // Never rewrite dist/public or stop an existing UAT preview (including 4196).
    if (!env.SOF_TEST_URL && !env.SOF_TEST_DIST) {
      add('regressions', 'Full unit-regression gate',
        [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts']);
      add('typecheck', 'Type-check gate', [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
      add('build', 'Production-artifact build for the local HTTPS test server',
        [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', path.join(output, 'dist/public')]);
    }
    add('browser', 'Clean FIFO and expedite browser pair; Normal/3×/full horizon',
      ['tests/vip-3x.e2e.mjs'], { ...env, SOF_TEST_OUTPUT: path.join(output, 'browser'),
        ...(env.SOF_TEST_URL ? {} : { SOF_TEST_DIST: env.SOF_TEST_DIST || path.join(output, 'dist/public') }),
      });
  }
  return plan;
}

// Import-safe seam permits launcher failure-report tests using owned dummy scripts.
// CLI always uses the plan above and the real owned-process runner.
export async function runVipLauncher({
  mode = '--all', env = process.env,
  output = path.resolve(env.SOF_TEST_OUTPUT || path.join(root, 'test-results/round3-3x')),
  signal, runner = runOwnedProcess, invalidArguments = false,
} = {}) {
  await mkdir(output, { recursive: true });
  const report = {
    mode, startedAt: new Date().toISOString(), output, steps: [],
    scope: 'Testing only; no deployment, uploads, fabricated browser results or changes to gameplay.',
    target: env.SOF_TEST_URL ? { kind: 'suppliedURL', base: env.SOF_TEST_URL } : env.SOF_TEST_DIST ? { kind: 'suppliedDIST', directory: env.SOF_TEST_DIST } : { kind: 'isolatedLocalBuild' },
    localBuildGatesSkipped: mode === '--engine-only' || Boolean(env.SOF_TEST_URL || env.SOF_TEST_DIST),
    stepTimeoutsMs: STEP_TIMEOUTS_MS, cleanupBoundsMs: PROCESS_CLEANUP,
  };
  const save = () => writeFile(path.join(output, 'run-summary.json'), JSON.stringify(report, null, 2) + '\n');
  let exitCode = 0;
  const checkCancellation = () => {
    if (signal?.aborted) {
      const error = new Error(`Launcher cancelled by ${signal.reason || 'SIGTERM'}`);
      error.exitCode = outcomeExitCode({ reason: 'cancelled', cancellationSignal: signal.reason || 'SIGTERM' });
      throw error;
    }
  };
  try {
    await save();
    if (invalidArguments || !['--all', '--engine-only', '--browser-only'].includes(mode)) {
      const error = new Error('Usage: node tests/run-vip-3x.mjs [--all|--engine-only|--browser-only]');
      error.exitCode = 2; throw error;
    }
    for (const step of launcherPlan(mode, env, output)) {
      checkCancellation();
      console.log(`\n[3×] ${step.label} (deadline ${step.timeoutMs / 1000}s)`);
      let outcome;
      try { outcome = await runner(step.command, step.args, { cwd: root, env: step.env, timeoutMs: step.timeoutMs, signal }); }
      catch (error) { outcome = { code: null, signal: null, reason: 'infrastructure-error', error: error.message }; }
      report.steps.push({ label: step.label, kind: step.kind, timeoutMs: step.timeoutMs, ...outcome });
      await save();
      if (outcome.reason !== 'exited' || outcome.code !== 0 || outcome.termination?.remaining) {
        const error = new Error(`${step.label} failed: ${outcome.error || (outcome.reason === 'exited' ? outcome.signal || `exit ${outcome.code}` : outcome.reason)}`);
        error.exitCode = outcomeExitCode(outcome); throw error;
      }
      checkCancellation();
    }
    report.passed = true;
  } catch (error) {
    exitCode = error.exitCode || 1;
    report.passed = false; report.error = error.message;
    if (signal?.aborted) report.cancellationSignal = signal.reason || 'SIGTERM';
  } finally {
    report.exitCode = exitCode; report.finishedAt = new Date().toISOString(); await save();
  }
  if (report.passed) console.log(`\n[3×] PASSED. Results: ${output}`);
  else console.error(`[3×] FAILED: ${report.error}`);
  return { report, exitCode };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const onInterrupt = () => controller.abort('SIGINT');
  const onTerminate = () => controller.abort('SIGTERM');
  process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate);
  try {
    const { exitCode } = await runVipLauncher({ mode: process.argv[2] || '--all', signal: controller.signal, invalidArguments: process.argv.length > 3 });
    process.exitCode = exitCode;
  } catch (error) {
    // Output directory/report I/O failures cannot guarantee a report; still fail closed.
    console.error(`[3×] Infrastructure/report failure: ${error.message}`); process.exitCode = 1;
  } finally {
    process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate);
  }
}
