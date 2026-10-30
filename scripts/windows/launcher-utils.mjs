import path from 'node:path';
import { createHash } from 'node:crypto';

export function requireNodeVersion(version) {
  const major = Number(version.split('.')[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new Error('Install Node.js 24 or newer from https://nodejs.org/en/download, then start Hearthbound again.');
  }
}

export function dependencyFingerprint(lockfile, version, platform, arch) {
  return createHash('sha256').update(lockfile).update(`\n${version.split('.')[0]}:${platform}:${arch}`).digest('hex');
}

export function dataDirectory(env, platform, home) {
  if (env.HEARTHBOUND_DATA_DIR) {
    if (!path.isAbsolute(env.HEARTHBOUND_DATA_DIR)) throw new Error('HEARTHBOUND_DATA_DIR must be an absolute path.');
    return path.resolve(env.HEARTHBOUND_DATA_DIR);
  }
  const base = platform === 'win32' ? env.LOCALAPPDATA : path.join(home, '.local', 'share');
  if (!base || !path.isAbsolute(base)) throw new Error('Cannot locate local application data. Set HEARTHBOUND_DATA_DIR to an absolute folder path.');
  return path.join(base, 'Hearthbound');
}

export function localWorkerConfig(built, buildDirectory, projectRoot) {
  if (!built.main || !built.d1_databases?.some(db => db.binding === 'DB')) {
    throw new Error('The app build is incomplete: the Worker or campaign database binding is missing.');
  }
  return {
    ...built,
    vars: {...built.vars, HEARTHBOUND_LOCAL_MODE: 'true'},
    main: path.resolve(buildDirectory, built.main),
    assets: built.assets ? {...built.assets, directory: path.resolve(buildDirectory, built.assets.directory)} : undefined,
    d1_databases: built.d1_databases.map(db => db.binding === 'DB' ? {
      ...db,
      migrations_dir: path.join(projectRoot, 'drizzle'),
      migrations_table: 'hearthbound_migrations',
    } : db),
    dev: {...built.dev, ip: '127.0.0.1', port: 8787, local_protocol: 'http'},
  };
}

export function parseOptions(args) {
  const allowed = new Set(['--prepare-only', '--no-browser', '--lan']);
  const unsupported = args.find(arg => !allowed.has(arg));
  if (unsupported) throw new Error(`Unknown option: ${unsupported}. Supported options: --prepare-only, --no-browser, --lan.`);
  return {prepareOnly: args.includes('--prepare-only'), noBrowser: args.includes('--no-browser'), lan: args.includes('--lan')};
}

export function lanAddresses(interfaces) {
  return [...new Set(Object.values(interfaces).flatMap(entries => entries || []).filter(item =>
    !item.internal && (item.family === 'IPv4' || item.family === 4) &&
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)
  ).map(item => item.address))].sort();
}
