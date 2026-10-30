// Real HTTP checks against a server you have already started. No AI calls.
// Creates one persistent test campaign; credentials stay in memory only.
import { randomUUID } from 'node:crypto';

let roomsCreated = 0;
let currentCheck = 'validate local server address';
const secrets = new Set();
const hiddenFields = new Set(['tokenHash', 'recoveryHash', 'accountHash', 'inviteHash']);

function ensure(condition) {
  if (!condition) throw new Error('Check failed');
}

function localOrigin(args) {
  ensure(args.length <= 1);
  const target = new URL(args[0] ?? 'http://127.0.0.1:5173');
  ensure(target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  ensure(!target.username && !target.password && !target.search && !target.hash && target.pathname === '/');
  return target.origin;
}

function remember(snapshot) {
  for (const field of ['token', 'recoveryCode', 'inviteCode']) {
    if (snapshot[field] !== undefined) {
      ensure(typeof snapshot[field] === 'string' && /^[a-f0-9]{64}$/.test(snapshot[field]));
      secrets.add(snapshot[field]);
    }
  }
  return snapshot;
}

function hasHiddenField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => hiddenFields.has(key) || hasHiddenField(child));
}

function credentialFree(value) {
  ensure(!hasHiddenField(value));
  const encoded = JSON.stringify(value);
  for (const secret of secrets) ensure(!encoded.includes(secret));
}

function passed(name) {
  console.log(`PASS ${name}`);
}

async function main() {
  const origin = localOrigin(process.argv.slice(2));
  async function request({ body, token, room, archive = false, status = 200 } = {}) {
    const endpoint = new URL('/api/game', origin);
    if (room) endpoint.searchParams.set('room', room);
    if (archive) endpoint.searchParams.set('download', 'campaign');
    const response = await fetch(endpoint, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    ensure(response.status === status);
    const value = await response.json();
    if (status < 400) {
      remember(value);
      credentialFree(value.state);
      if (archive) ensure(response.headers.get('Content-Disposition')?.startsWith('attachment;'));
    }
    return value;
  }
  const post = (body, token, status = 200) => request({ body, token, status });

  currentCheck = 'create invitation-protected campaign';
  const gm = await post({ type: 'create', name: 'Multiplayer smoke GM', ruleSetId: 'srd-5.2.1', requireInvite: true }, undefined, 201);
  roomsCreated += 1;
  ensure(gm.me?.role === 'gm' && gm.token && gm.recoveryCode && gm.inviteCode);
  ensure(gm.state.session?.inviteRequired === true && gm.state.session.inviteVersion === 1);
  const room = gm.room;
  ensure(typeof room === 'string' && /^[A-Z2-9]{6}$/.test(room));
  const act = (token, type, fields, status = 200) => post({ type: 'action', room, action: { id: randomUUID(), type, ...fields } }, token, status);
  const join = (name, inviteCode, status = 201) => post({ type: 'join', room, name, characterClass: 'fighter', ...(inviteCode ? { inviteCode } : {}) }, undefined, status);
  passed(currentCheck);

  currentCheck = 'require current invitation and protect campaign access';
  await request({ room, status: 401 });
  await join('Missing invitation', undefined, 403);
  await join('Invalid invitation', '0'.repeat(64), 403);
  let player = await join('Smoke player one', gm.inviteCode);
  ensure(player.me?.role === 'player' && player.token && player.recoveryCode && !player.inviteCode);
  const originalHero = player.me.characterId;
  passed(currentCheck);

  currentCheck = 'synchronize one world between GM and player';
  const narration = 'Smoke check: everyone stands beneath the same harbor lantern.';
  await act(gm.token, 'world', { op: 'sceneUpdate', name: 'Multiplayer smoke campaign', narration });
  await act(gm.token, 'world', { op: 'notes', text: 'Smoke check private GM notes.' });
  const gmView = await request({ room, token: gm.token });
  const playerView = await request({ room, token: player.token });
  ensure(gmView.state.revision === playerView.state.revision && playerView.state.narrative === narration);
  ensure(playerView.state.title === gmView.state.title && playerView.state.world.activeScene === gmView.state.world.activeScene);
  ensure(JSON.stringify(playerView.state.terrain) === JSON.stringify(gmView.state.terrain));
  ensure(JSON.stringify(playerView.state.tokens) === JSON.stringify(gmView.state.tokens));
  ensure(!JSON.stringify(playerView).includes('Smoke check private GM notes.'));
  passed(currentCheck);

  currentCheck = 'deny GM controls to players';
  await act(player.token, 'opening', { text: 'Unauthorized opening' }, 403);
  await act(player.token, 'world', { op: 'notes', text: 'Unauthorized notes' }, 403);
  await act(player.token, 'session', { op: 'lock', locked: true }, 403);
  await post({ type: 'invite', room }, player.token, 403);
  await request({ room, token: player.token, archive: true, status: 403 });
  passed(currentCheck);

  currentCheck = 'rotate invitations and invalidate old invitation';
  let invitation = await post({ type: 'invite', room }, gm.token);
  ensure(invitation.inviteCode !== gm.inviteCode && invitation.state.session.inviteVersion === 2);
  await join('Expired invitation', gm.inviteCode, 403);
  const otherPlayer = await join('Smoke player two', invitation.inviteCode);
  passed(currentCheck);

  currentCheck = 'lock new joins while current players continue';
  await act(gm.token, 'session', { op: 'lock', locked: true });
  await join('Locked table', invitation.inviteCode, 403);
  await request({ room, token: player.token });
  await act(player.token, 'chat', { text: 'Current players can continue at a locked table.' });
  invitation = await post({ type: 'invite', room }, gm.token);
  ensure(invitation.state.session.locked === true && invitation.state.session.inviteVersion === 3);
  await join('Still locked', invitation.inviteCode, 403);
  passed(currentCheck);

  currentCheck = 'restore a locked-table seat and revoke old credentials';
  const beforeRecovery = player;
  player = await post({ type: 'recover', room, recoveryCode: player.recoveryCode });
  ensure(player.me.id === beforeRecovery.me.id && player.me.characterId === originalHero && player.me.role === 'player');
  ensure(player.token !== beforeRecovery.token && player.recoveryCode !== beforeRecovery.recoveryCode);
  await request({ room, token: beforeRecovery.token, status: 403 });
  await post({ type: 'recover', room, recoveryCode: beforeRecovery.recoveryCode }, undefined, 403);
  await request({ room, token: player.token });
  passed(currentCheck);

  currentCheck = 'rotate credentials from a current browser session';
  const beforeRotation = player;
  player = await post({ type: 'recoveryCode', room }, player.token);
  ensure(player.me.id === beforeRotation.me.id && player.me.characterId === originalHero);
  ensure(player.token !== beforeRotation.token && player.recoveryCode !== beforeRotation.recoveryCode);
  await request({ room, token: beforeRotation.token, status: 403 });
  await post({ type: 'recover', room, recoveryCode: beforeRotation.recoveryCode }, undefined, 403);
  await request({ room, token: player.token });
  passed(currentCheck);

  currentCheck = 'export GM archive without credentials';
  const archive = await request({ room, token: gm.token, archive: true });
  ensure(archive.format === 'hearthbound-campaign' && archive.version === 1);
  ensure(archive.state.world.gmNotes === 'Smoke check private GM notes.');
  ensure(archive.state.members.length === 3 && !('processed' in archive.state));
  credentialFree(archive);
  passed(currentCheck);

  currentCheck = 'remove a player, close joins and retain the hero';
  await act(gm.token, 'session', { op: 'lock', locked: false });
  const removal = { type: 'action', room, action: { id: randomUUID(), type: 'session', op: 'remove', memberId: player.me.id } };
  const removed = await post(removal, gm.token);
  ensure(removed.state.session.locked === true && !removed.state.members.some(member => member.id === player.me.id));
  const retainedHero = removed.state.tokens.find(token => token.id === originalHero);
  ensure(retainedHero && !retainedHero.ownerId);
  const replayed = await post(removal, gm.token);
  ensure(replayed.state.revision === removed.state.revision);
  await request({ room, token: player.token, status: 403 });
  await post({ type: 'recover', room, recoveryCode: player.recoveryCode }, undefined, 403);
  await join('Removed seat locked', invitation.inviteCode, 403);
  await act(otherPlayer.token, 'chat', { text: 'The remaining player can still play.' });
  passed(currentCheck);
}

try {
  await main();
  console.log(`Campaigns created: ${roomsCreated}`);
} catch {
  // Do not print errors, response bodies, URLs, tokens or recovery/invite codes.
  console.error(`FAIL ${currentCheck}`);
  console.error(`Campaigns created: ${roomsCreated}`);
  process.exitCode = 1;
}
