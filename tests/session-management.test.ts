import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { Action, GameState, Member } from '../lib/game';
import type { SessionState } from '../lib/session';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/lib/')) return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('./') && context.parentURL?.includes('/lib/') && !/\.[a-z]+$/.test(specifier)) return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
  return next(specifier, context);
} });
// @ts-ignore native Node test import.
const { createInitialState, addPlayer } = await import('../lib/game.ts');
// @ts-ignore native Node test import.
const { applySessionAction, campaignArchive, publicSession, requireJoinAccess, rotateInvitation } = await import('../lib/session.ts');
const gm: Member = { id: 'gm-session', name: 'GM', role: 'gm', tokenHash: 'private-gm-session-hash' };
const action = (op: string, fields: Record<string, unknown> = {}): Action => ({ id: crypto.randomUUID(), type: 'session', op, ...fields });
function table() {
  const state = createInitialState('SESS22', structuredClone(gm), 'srd-5.2.1');
  const player: Member = { id: 'player-session', name: 'Mira', role: 'player', tokenHash: 'private-player-session-hash' };
  addPlayer(state, player, 'wizard');
  return { state, player };
}

test('legacy tables remain open while invitation hashes never enter the public session data', () => {
  const { state } = table();
  assert.equal((state as SessionState).session, undefined);
  assert.doesNotThrow(() => requireJoinAccess(state));
  assert.deepEqual(publicSession(state), { locked: false, inviteRequired: false, inviteVersion: 0 });
  const first = 'a'.repeat(64), second = 'b'.repeat(64);
  rotateInvitation(state, gm, first);
  assert.throws(() => requireJoinAccess(state), /current invitation/);
  assert.doesNotThrow(() => requireJoinAccess(state, first));
  rotateInvitation(state, gm, second);
  assert.throws(() => requireJoinAccess(state, first), /current invitation/);
  assert.doesNotThrow(() => requireJoinAccess(state, second));
  assert.deepEqual(publicSession(state), { locked: false, inviteRequired: true, inviteVersion: 2 });
  assert.ok(!JSON.stringify(publicSession(state)).includes(second));
  applySessionAction(state, gm, action('lock', { locked: true }));
  rotateInvitation(state, gm, 'c'.repeat(64));
  assert.equal(publicSession(state).locked, true, 'rotating an invite must not silently reopen a locked table');
  assert.throws(() => requireJoinAccess(state, 'c'.repeat(64)), /locked/);
});

test('assignment changes control without rebuilding characters or duplicating ownership', () => {
  const { state, player } = table();
  const hero = state.tokens.find(t => t.id === 'companion-eira')!;
  hero.hp = 4;
  hero.sheet!.notes = 'Keep this history.';
  hero.sheet!.hitDice = 0;
  const { ownerId: _owner, ...before } = structuredClone(hero);
  const oldHero = state.tokens.find(t => t.id === player.characterId)!;
  applySessionAction(state, gm, action('assign', { tokenId: hero.id, memberId: player.id }));
  assert.equal(player.characterId, hero.id);
  assert.equal(hero.ownerId, player.id);
  assert.equal(oldHero.ownerId, undefined);
  const { ownerId: _newOwner, ...after } = hero;
  assert.deepEqual(after, before);

  const command = action('assign', { tokenId: hero.id, memberId: gm.id });
  applySessionAction(state, gm, command);
  const logCount = state.log.length;
  applySessionAction(state, gm, command);
  assert.equal(state.log.length, logCount);
  assert.equal(player.characterId, undefined);
  assert.equal(state.members.find(m => m.id === gm.id)!.characterId, hero.id);
  assert.equal(hero.ownerId, gm.id);
  applySessionAction(state, gm, action('assign', { tokenId: hero.id, memberId: null }));
  assert.equal(hero.ownerId, undefined);
  assert.equal(state.members.find(m => m.id === gm.id)!.characterId, undefined);
});

test('players cannot manage tables and assignments reject enemies, stale seats and combat', () => {
  const { state, player } = table();
  const heroId = state.tokens.find(t => t.kind === 'hero')!.id;
  for (const command of [action('lock', { locked: true }), action('assign', { tokenId: heroId, memberId: player.id }), action('remove', { memberId: gm.id })]) {
    assert.throws(() => applySessionAction(state, player, command), (error: unknown) => (error as { status: number }).status === 403);
  }
  assert.throws(() => rotateInvitation(state, player, 'a'.repeat(64)), /Only the GM/);
  assert.throws(() => applySessionAction(state, gm, action('assign', { tokenId: 'goblin-1', memberId: player.id })), /party character/);
  assert.throws(() => applySessionAction(state, gm, action('assign', { tokenId: heroId, memberId: 'removed-seat' })), /no longer/);
  assert.throws(() => applySessionAction(state, gm, action('lock', { locked: 'false' })), /Choose/);
  state.combat.active = true;
  assert.throws(() => applySessionAction(state, gm, action('assign', { tokenId: heroId, memberId: player.id })), /End the encounter/);
});

test('removal closes new joins but retains the character and combat state for the GM', () => {
  const { state, player } = table();
  const hero = state.tokens.find(t => t.id === player.characterId)!;
  hero.hp = 2;
  state.combat = { active: true, round: 2, order: [hero.id], turnIndex: 0, remainingMovement: 10, actionUsed: true };
  const beforeCombat = structuredClone(state.combat);
  const command = action('remove', { memberId: player.id });
  applySessionAction(state, gm, command);
  applySessionAction(state, gm, command);
  assert.equal(state.members.some(m => m.id === player.id), false);
  assert.equal(state.tokens.find(t => t.id === hero.id), hero);
  assert.equal(hero.hp, 2);
  assert.equal(hero.ownerId, undefined);
  assert.deepEqual(state.combat, beforeCombat);
  assert.equal(publicSession(state).locked, true);
  assert.throws(() => requireJoinAccess(state), /locked/);
  assert.throws(() => applySessionAction(state, gm, action('remove', { memberId: gm.id })), /cannot be removed/);
});

test('GM archives preserve hidden content without carrying any session or account credentials', () => {
  const { state, player } = table();
  Object.assign(state.members[0], { recoveryHash: 'private-recovery-hash', accountHash: 'private-account-hash' });
  rotateInvitation(state, gm, 'a'.repeat(64));
  const enriched = state as GameState & { world: unknown; assistantRequestedAt: number };
  enriched.world = { gmNotes: 'The hidden answer is silver.', scenes: [{ id: 'secret-scene', name: 'Hidden room', terrain: ['###'] }], pings: [{ x: 2, y: 3 }] };
  enriched.assistantRequestedAt = 1234;
  assert.throws(() => campaignArchive(state, player), /Only the GM/);
  const exported = campaignArchive(state, gm);
  assert.equal(exported.format, 'hearthbound-campaign');
  assert.equal(exported.version, 1);
  const serialized = JSON.stringify(exported);
  assert.match(serialized, /The hidden answer is silver/);
  assert.match(serialized, /secret-scene/);
  for (const forbidden of ['tokenHash', 'recoveryHash', 'accountHash', 'inviteHash', 'processed', 'assistantRequestedAt', 'pings', 'private-recovery-hash', 'private-account-hash', 'private-gm-session-hash', 'private-player-session-hash', 'a'.repeat(64)]) {
    assert.ok(!serialized.includes(forbidden), `Archive excludes ${forbidden}`);
  }
  assert.ok(state.members[0].tokenHash, 'Export does not modify live credentials');
});
