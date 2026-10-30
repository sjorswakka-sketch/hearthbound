import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = readdirSync(path.join(root, 'tests'), {withFileTypes: true})
  .filter(entry => entry.isFile() && /\.test\.(?:ts|mjs)$/.test(entry.name))
  .map(entry => path.join(root, 'tests', entry.name))
  .sort();

if (!tests.length) throw new Error('No tests found in tests/.');

// Pass actual paths instead of shell globs so Windows and Unix discover the same suite.
const result = spawnSync(process.execPath, ['--test', '--experimental-strip-types', ...tests], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
