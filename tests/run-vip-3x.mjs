import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.SOF_TEST_OUTPUT || path.join(root, 'test-results/round3-3x'));
const mode = process.argv[2] || '--all';
if (!['--all','--engine-only','--browser-only'].includes(mode) || process.argv.length > 3) {
  console.error('Usage: node tests/run-vip-3x.mjs [--all|--engine-only|--browser-only]'); process.exit(2);
}
await mkdir(output, { recursive: true });
const report = { mode, startedAt: new Date().toISOString(), output, steps: [], scope: 'Testing only; no deployment, uploads, fabricated browser results or changes to gameplay.' };
const save = () => writeFile(path.join(output, 'run-summary.json'), JSON.stringify(report, null, 2));
async function run(label, command, args, env = process.env) {
  console.log(`\n[3×] ${label}`);
  const begin = Date.now();
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env, shell: false });
  const outcome = await new Promise(resolve => {
    child.once('error', error => resolve({ code: null, error: error.message }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  report.steps.push({ label, ...outcome, elapsedMs: Date.now() - begin }); await save();
  if (outcome.code !== 0) throw new Error(`${label} failed: ${outcome.error || outcome.signal || `exit ${outcome.code}`}`);
}
try {
  if (mode !== '--browser-only') {
    await run('Exact Normal/3× driver and stress assertions', process.execPath,
      [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'tests/vip-3x-stress.ts'],
      { ...process.env, SOF_STRESS_OUTPUT: path.join(output, 'stress.json') });
  }
  if (mode !== '--engine-only') {
    // Build before browser play, in a separate directory: do not rewrite a running UAT preview.
    if (!process.env.SOF_TEST_URL && !process.env.SOF_TEST_DIST) {
      await run('Full unit-regression gate', process.execPath,
        [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts']);
      await run('Type-check gate', process.execPath,
        [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
      await run('Production-artifact build for the local HTTPS test server', process.execPath,
        [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', path.join(output, 'dist/public')]);
    }
    await run('Clean FIFO and expedite browser pair; Normal/3×/full horizon', process.execPath,
      ['tests/vip-3x.e2e.mjs'], { ...process.env,
        SOF_TEST_OUTPUT: path.join(output, 'browser'),
        ...(process.env.SOF_TEST_URL ? {} : { SOF_TEST_DIST: process.env.SOF_TEST_DIST || path.join(output, 'dist/public') }),
      });
  }
  report.passed = true; report.finishedAt = new Date().toISOString(); await save();
  console.log(`\n[3×] PASSED. Results: ${output}`);
} catch (error) {
  report.passed = false; report.error = error.message; report.finishedAt = new Date().toISOString(); await save();
  console.error(`[3×] FAILED: ${error.message}`); process.exitCode = 1;
}
