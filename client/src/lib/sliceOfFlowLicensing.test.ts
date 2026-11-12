import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const metadata = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
const license = readFileSync(`${root}/LICENSE`, 'utf8').replace(/\s+/g, ' ');
const viteConfig = readFileSync(`${root}/vite.config.ts`, 'utf8');

// Project terms do not replace component licenses; this guards only this
// standalone project's approved metadata and unnecessary editor dependencies.
describe('standalone project licensing safeguards', () => {
  it('points package metadata at Jeff’s custom license and prevents accidental npm publication', () => {
    expect(metadata.license).toBe('SEE LICENSE IN LICENSE');
    expect(metadata.private).toBe(true);
  });

  it('retains the named owner and approved permissions contact in the actual root license', () => {
    expect(license).toContain('Owner and licensor: Jeff Bourke, individually.');
    expect(license).toContain('Copyright © 2026 Jeff Bourke.');
    expect(license).toContain('Permission requests: jeff@thefatalfive.com.');
  });

  it('does not install either unneeded editor plugin as a current project dependency', () => {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const name of ['@builder.io/vite-plugin-jsx-loc', 'vite-plugin-manus-runtime']) {
        expect(metadata[section] || {}).not.toHaveProperty(name);
      }
    }
  });

  it('does not import or run those editor plugins in the standalone Vite configuration', () => {
    for (const token of ['vite-plugin-jsx-loc', 'vite-plugin-manus-runtime', 'jsxLocPlugin', 'vitePluginManusRuntime']) {
      expect(viteConfig).not.toContain(token);
    }
  });
});
