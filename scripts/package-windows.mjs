import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'outputs', 'Hearthbound-Windows-test.zip');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();

// Package committed source only: local databases, browser identities, dependencies,
// credentials and generated builds cannot accidentally enter through ignored files.
const commit = git('rev-parse', '--verify', 'HEAD^{commit}');
const files = git('ls-tree', '-r', '--name-only', commit).split('\n');
for (const required of ['START-HEARTHBOUND.cmd', 'scripts/windows/start.mjs', 'TESTING-WINDOWS.md', 'package-lock.json', '.openai/hosting.json']) {
  if (!files.includes(required)) throw new Error(`Commit ${required} before creating a Windows release package.`);
}
const forbidden = files.filter(file => /(^|\/)(node_modules|\.git|\.wrangler|\.sites-runtime|\.vinext|outputs|work)(\/|$)/.test(file) || /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|[^/]*\.pem)$/.test(file));
if (forbidden.length) throw new Error(`Refusing to package local or secret files: ${forbidden.join(', ')}`);

mkdirSync(path.dirname(output), { recursive: true });
git('archive', '--format=zip', '--prefix=Hearthbound/', `--output=${output}`, commit);
const hash = createHash('sha256').update(readFileSync(output)).digest('hex');
writeFileSync(`${output}.sha256`, `${hash}  ${path.basename(output)}\n`);
console.log(`Windows testing package: ${output}`);
console.log(`Source commit: ${commit}`);
console.log('Requires Node.js 24; dependencies are installed on first launch.');
