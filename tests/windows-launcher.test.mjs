import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {dataDirectory, dependencyFingerprint, localWorkerConfig, parseOptions, requireNodeVersion, lanAddresses} from '../scripts/windows/launcher-utils.mjs';

test('Windows campaigns stay outside the extracted release folder', () => {
  const local = path.resolve('work', 'fake-localappdata');
  assert.equal(dataDirectory({LOCALAPPDATA: local}, 'win32', ''), path.join(local, 'Hearthbound'));
  assert.equal(dataDirectory({HEARTHBOUND_DATA_DIR: local}, 'win32', ''), local);
  assert.throws(() => dataDirectory({HEARTHBOUND_DATA_DIR: 'relative'}, 'win32', ''));
});

test('migration config points at shipped migrations and relocates built assets', () => {
  const root = path.resolve('work', 'example release');
  const build = path.join(root, 'dist', 'server');
  const source = {main: 'index.js', assets: {directory: '../client'}, d1_databases: [{binding:'DB',database_id:'stable-id'}]};
  const config = localWorkerConfig(source, build, root);
  assert.equal(config.main, path.join(build, 'index.js'));
  assert.equal(config.assets.directory, path.join(root, 'dist', 'client'));
  assert.equal(config.d1_databases[0].database_id, 'stable-id');
  assert.equal(config.d1_databases[0].migrations_dir, path.join(root, 'drizzle'));
  assert.equal(config.d1_databases[0].migrations_table, 'hearthbound_migrations');
  assert.equal(source.d1_databases[0].migrations_dir, undefined);
  assert.throws(() => localWorkerConfig({main:'index.js'}, build, root));
});

test('new dependency locks or Node majors invalidate the installation fingerprint', () => {
  const fingerprint = dependencyFingerprint('lock one', '24.1.0', 'win32', 'x64');
  assert.equal(fingerprint, dependencyFingerprint('lock one', '24.2.0', 'win32', 'x64'));
  assert.notEqual(fingerprint, dependencyFingerprint('lock two', '24.1.0', 'win32', 'x64'));
  assert.notEqual(fingerprint, dependencyFingerprint('lock one', '26.1.0', 'win32', 'x64'));
  assert.notEqual(fingerprint, dependencyFingerprint('lock one', '24.1.0', 'win32', 'arm64'));
});

test('unsupported runtimes and network-exposure flags fail clearly', () => {
  assert.throws(() => requireNodeVersion('22.1.0'), /Node.js 24/);
  requireNodeVersion('24.16.0');
  assert.throws(() => parseOptions(['--host', '0.0.0.0']), /Unknown option/);
  assert.deepEqual(parseOptions(['--prepare-only','--no-browser']), {prepareOnly:true,noBrowser:true,lan:false});
});

test('LAN hosting is explicit and only suggests private IPv4 addresses', () => {
  assert.equal(parseOptions([]).lan, false);
  assert.equal(parseOptions(['--lan']).lan, true);
  assert.deepEqual(lanAddresses({wifi:[{address:'192.168.1.20',family:'IPv4',internal:false},{address:'127.0.0.1',family:'IPv4',internal:true},{address:'203.0.113.7',family:'IPv4',internal:false},{address:'fe80::1',family:'IPv6',internal:false}]}), ['192.168.1.20']);
  const config=localWorkerConfig({main:'index.js',vars:{OTHER:'kept'},d1_databases:[{binding:'DB'}]},path.resolve('dist/server'),path.resolve('.'));
  assert.equal(config.vars.HEARTHBOUND_LOCAL_MODE,'true');
  assert.equal(config.vars.OTHER,'kept');
  assert.equal(config.dev.ip,'127.0.0.1');
});
