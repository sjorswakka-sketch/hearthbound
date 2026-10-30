import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { configureToolEnvironment } from '../tool-environment.mjs';
import { dataDirectory, dependencyFingerprint, localWorkerConfig, parseOptions, requireNodeVersion, lanAddresses } from './launcher-utils.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const environmentImport = new URL('../sites-env.mjs', import.meta.url).href;
process.chdir(root);
let url = 'http://127.0.0.1:8787';

function runNode(args) {
  const result = spawnSync(process.execPath, args, {cwd: root, env: process.env, stdio: 'inherit', windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Setup stopped (exit ${result.status ?? 'unknown'}). Your saved campaigns have not been deleted.`);
}

async function portAvailable(ip) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port 8787 is already in use. Close the other Hearthbound window, then try again. Existing app: ${url}`)));
    probe.listen(8787, ip, () => probe.close(resolve));
  });
}

async function main() {
  requireNodeVersion(process.versions.node);
  const options = parseOptions(process.argv.slice(2));
  const listenIp = options.lan ? '0.0.0.0' : '127.0.0.1';
  const addresses = options.lan ? lanAddresses(networkInterfaces()) : [];
  if (options.lan && !options.prepareOnly && !addresses.length) throw new Error('No home-network address found. Connect to your Wi-Fi or Ethernet, or use START-HEARTHBOUND.cmd for solo testing.');
  if (addresses.length) url = `http://${addresses[0]}:8787`;
  if (!options.prepareOnly) await portAvailable(listenIp);
  const savedData = dataDirectory(process.env, process.platform, homedir());
  mkdirSync(savedData, {recursive: true});
  configureToolEnvironment(root);
  // Never inherit a managed-server profile into an unpacked Windows release.
  mkdirSync(path.join(root, '.sites-runtime'), {recursive: true});
  writeFileSync(path.join(root, '.sites-runtime', 'execution-profile.json'), JSON.stringify({executionProfile: 'portable'}));
  const lock = readFileSync(path.join(root, 'package-lock.json'));
  const fingerprint = dependencyFingerprint(lock, process.versions.node, process.platform, process.arch);
  const marker = path.join(root, 'node_modules', '.hearthbound-dependencies');
  const toolsPresent = existsSync(path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')) && existsSync(path.join(root, 'node_modules', 'vinext', 'dist', 'cli.js'));
  const sameDependencies = toolsPresent && existsSync(marker) && readFileSync(marker, 'utf8') === fingerprint;
  console.log('\nHearthbound — Windows test edition\n');
  console.log(`Saved campaigns: ${savedData}`);
  console.log('Keep this window open while playing. Close it or press Ctrl+C to stop.\n');
  if (!sameDependencies) {
    console.log('First setup for this version: downloading required components. This can take several minutes.');
    const candidates = [
      process.env.npm_execpath,
      path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ].filter(Boolean);
    const npm = candidates.find(candidate => existsSync(candidate));
    if (!npm) throw new Error('npm was not found. Install the complete Node.js 24 Windows package, including npm, from https://nodejs.org/en/download.');
    runNode([npm, 'ci', '--include=dev', '--include=optional', '--no-audit', '--no-fund']);
    writeFileSync(marker, fingerprint);
  }
  console.log('\nPreparing this version of the world…');
  runNode([path.join(root, 'scripts', 'run-framework.mjs'), 'build']);
  const buildDirectory = path.join(root, 'dist', 'server');
  const built = JSON.parse(readFileSync(path.join(buildDirectory, 'wrangler.json'), 'utf8'));
  const config = path.join(root, '.sites-runtime', 'windows-wrangler.json');
  writeFileSync(config, JSON.stringify(localWorkerConfig(built, buildDirectory, root), null, 2));
  const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const bindingArgs = ['--local', '--config', config, '--persist-to', savedData];
  console.log('\nApplying any new campaign storage updates…');
  // Wrangler keeps a migration ledger in the persistent database. Already-applied
  // migrations are skipped, including when a newer release is unpacked elsewhere.
  const previousCI = process.env.CI;
  process.env.CI = 'true';
  try { runNode(['--import', environmentImport, wrangler, 'd1', 'migrations', 'apply', 'DB', ...bindingArgs]); }
  finally { if (previousCI === undefined) delete process.env.CI; else process.env.CI = previousCI; }
  if (options.prepareOnly) { console.log('\nSetup verified. Run START-HEARTHBOUND.cmd to play.'); return; }
  console.log(`\nOpening Hearthbound at ${url}`);
  if (options.lan) {
    console.log('LAN game: keep this host running. Friends on the same trusted home network open one of these addresses:');
    for (const address of addresses) console.log(`  http://${address}:8787`);
    console.log('Create a table, then share its invitation from the Session tab. Other players do not need to install the game.');
    console.log('If Windows asks about network access, use your private home-network profile. No router changes are needed.\n');
  } else console.log('Solo test mode. Use START-LAN-GAME.cmd to host one shared world for friends on the same home network.\n');
  const child = spawn(process.execPath, ['--import', environmentImport, wrangler, 'dev', ...bindingArgs, '--ip', listenIp, '--port', '8787', '--inspector-port', '0'], {
    cwd: root, env: process.env, stdio: 'inherit', windowsHide: true,
  });
  let stopped = false;
  child.once('error', error => {stopped = true; console.error(error.message); process.exitCode = 1;});
  child.once('exit', code => {stopped = true; process.exitCode = code ?? 0;});
  const stop = () => {stopped = true; child.kill('SIGTERM');};
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  if (!options.noBrowser) {
    for (let attempt = 0; attempt < 90 && !stopped; attempt++) {
      try {
        const response = await fetch(url, {signal: AbortSignal.timeout(2000)});
        if (response.ok) {
          if (process.platform === 'win32') {
            const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {detached: true, stdio: 'ignore', windowsHide: true});
            browser.on('error', () => console.log(`Open your browser at ${url}`));
            browser.unref();
          } else console.log(`Open your browser at ${url}`);
          break;
        }
      } catch { /* Runtime is still starting. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!stopped) console.log(`If no browser appeared, open ${url}`);
  }
}

main().catch(error => {console.error(`\n${error.message}\n`); process.exitCode = 1;});
