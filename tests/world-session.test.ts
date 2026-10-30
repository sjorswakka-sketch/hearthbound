import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { GameState, Member, Action } from '../lib/game';
import type { WorldData } from '../lib/world';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/lib/')) return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('./') && context.parentURL?.includes('/lib/') && !/\.[a-z]+$/.test(specifier)) return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
  return next(specifier, context);
} });
// @ts-ignore native Node TypeScript imports for tests.
const { createInitialState, addPlayer } = await import('../lib/game.ts');
// @ts-ignore native Node TypeScript imports for tests.
const { applyWorldAction, applyVisibleAction, visibleState, guardVisibility, worldData } = await import('../lib/world.ts');
const gm: Member = { id: 'gm-world', name: 'GM', role: 'gm', tokenHash: 'secret-gm-token-hash' };
const action = (op: string, fields: Record<string, unknown> = {}): Action => ({ id: crypto.randomUUID(), type: 'world', op, ...fields });
const world = (state: GameState) => (state as GameState & { world: WorldData }).world;

test('world editing is GM-only, and protected occupied tiles cannot be overwritten', () => {
  const state = createInitialState('WORLD2', gm, 'srd-5.2.1');
  const player: Member = { id: 'player', name: 'Mira', role: 'player' };
  assert.throws(() => applyWorldAction(state, player, action('notes', { text: 'Secret' })), (error: unknown) => (error as { status: number }).status === 403);
  const hero = state.tokens.find(token => token.kind === 'hero')!;
  assert.throws(() => applyWorldAction(state, gm, action('terrain', { x: hero.x, y: hero.y, tile: '#' })), /Move the character/);
  const original = state.terrain[hero.y][hero.x];
  assert.equal(original, '.');
  state.combat.active = true;
  assert.throws(() => applyWorldAction(state, gm, action('sceneCreate', { name: 'Crypt', preset: 'crypt' })), /End the encounter/);
  applyWorldAction(state, gm, action('notes', { text: 'Private during combat.' }));
  assert.equal(world(state).gmNotes, 'Private during combat.');
});

test('switching scenes preserves terrain, objects, enemy health, and party identity', () => {
  const state = createInitialState('WORLD3', gm, 'srd-5.1');
  const heroes = state.tokens.filter(token => token.kind === 'hero').map(token => token.id).sort();
  applyWorldAction(state, gm, action('terrain', { x: 2, y: 2, tile: '#' }));
  applyWorldAction(state, gm, action('object', { x: 2, y: 4, kind: 'chest' }));
  state.objects.find(object => object.x === 2 && object.y === 4)!.open = true;
  applyWorldAction(state, gm, action('spawn', { x: 2, y: 3, name: 'Watcher', hp: 19, ac: 14 }));
  const watcher = state.tokens.find(token => token.name === 'Watcher')!;
  watcher.hp = 3;
  applyWorldAction(state, gm, action('sceneCreate', { name: 'Old Crypt', preset: 'crypt' }));
  const cryptId = world(state).activeScene;
  assert.notEqual(cryptId, 'harbor');
  assert.ok(!state.tokens.some(token => token.id === watcher.id));
  applyWorldAction(state, gm, action('terrain', { x: 5, y: 5, tile: '~' }));
  applyWorldAction(state, gm, action('sceneSwitch', { sceneId: 'harbor' }));
  assert.equal(state.terrain[2][2], '#');
  assert.equal(state.objects.find(object => object.x === 2 && object.y === 4)?.open, true);
  assert.equal(state.tokens.find(token => token.id === watcher.id)?.hp, 3);
  assert.deepEqual(state.tokens.filter(token => token.kind === 'hero').map(token => token.id).sort(), heroes);
  assert.equal(new Set(state.tokens.filter(token => token.hp > 0).map(token => `${token.x},${token.y}`)).size, state.tokens.filter(token => token.hp > 0).length);
  applyWorldAction(state, gm, action('sceneSwitch', { sceneId: cryptId }));
  assert.equal(state.terrain[5][5], '~');
});

test('repeated world action IDs cannot duplicate spawned creatures', () => {
  const state = createInitialState('WORLD4', gm);
  const command = action('spawn', { x: 2, y: 3, name: 'Once only' });
  applyWorldAction(state, gm, command);
  applyWorldAction(state, gm, command);
  assert.equal(state.tokens.filter(token => token.name === 'Once only').length, 1);
});

test('fog removes concealed cells, objects, creatures, sheets, GM notes, inactive scenes and logs', () => {
  const state = createInitialState('WORLD5', gm, 'srd-5.2.1');
  const player: Member = { id: 'fog-player', name: 'Mira', role: 'player', tokenHash: 'player-token-hash' };
  addPlayer(state, player, 'rogue');
  const secretEnemy = state.tokens.find(token => token.kind === 'enemy')!;
  secretEnemy.name = 'Secret Stalker';
  secretEnemy.sheet!.notes = 'Hidden ritual instructions';
  const data = worldData(state);
  data.gmNotes = 'Trap answer: obsidian';
  data.fogEnabled = true;
  data.scenes.push({ id: 'unseen-pocket', name: 'Unseen Pocket Dimension', terrain: ['SECRET MAP'], objects: [], enemies: [], revealed: [] });
  for (const kind of ['combat', 'move', 'spell', 'check', 'condition', 'system']) state.log.push({ id: crypto.randomUUID(), kind, text: `GM rebuilt Secret Stalker: Hidden ritual instructions (${kind}).`, at: new Date().toISOString() });
  state.log.push({ id: crypto.randomUUID(), kind: 'story', text: 'GM: The lantern flickers.', at: new Date().toISOString() });
  state.combat = { active: true, round: 1, order: [secretEnemy.id, player.characterId!], turnIndex: 0, remainingMovement: 30, actionUsed: false };
  Object.assign(state.members[0], { recoveryHash: 'recovery-secret', accountHash: 'account-secret' });
  const output = visibleState(state, player);
  const own = output.tokens.find(token => token.id === player.characterId)!;
  assert.ok(own);
  assert.equal(output.terrain[own.y][own.x], '.');
  assert.equal(output.terrain[secretEnemy.y][secretEnemy.x], '?');
  assert.equal(output.objects.length, 0);
  assert.equal(output.tokens.length, 1);
  assert.equal(world(output).gmNotes, '');
  assert.deepEqual(world(output).scenes.map(scene => scene.id), ['harbor']);
  assert.ok(!output.combat.order.includes(secretEnemy.id));
  assert.equal(output.combat.remainingMovement, 0, 'a hidden current creature must not leak its movement budget');
  assert.ok(output.log.some(entry => entry.text === 'GM: The lantern flickers.'));
  const serialized = JSON.stringify(output);
  for (const forbidden of ['Secret Stalker', 'Hidden ritual instructions', 'Trap answer', 'Unseen Pocket Dimension', 'SECRET MAP', 'tokenHash', 'recoveryHash', 'accountHash', 'recovery-secret', 'account-secret']) assert.ok(!serialized.includes(forbidden), `${forbidden} must not enter a player snapshot`);
  assert.ok(state.tokens.some(token => token.id === secretEnemy.id), 'projection must not mutate authoritative creatures');
  assert.equal(data.gmNotes, 'Trap answer: obsidian');
  const gmOutput = visibleState(state, gm);
  assert.ok(gmOutput.tokens.some(token => token.id === secretEnemy.id));
  assert.equal(world(gmOutput).gmNotes, 'Trap answer: obsidian');
});

test('fog rejects actions against hidden targets and destinations, then allows revealed cells', () => {
  const state = createInitialState('WORLD6', gm);
  const player: Member = { id: 'guard-player', name: 'Mira', role: 'player' };
  addPlayer(state, player, 'wizard');
  worldData(state).fogEnabled = true;
  const enemy = state.tokens.find(token => token.kind === 'enemy')!;
  assert.throws(() => guardVisibility(state, player, { id: crypto.randomUUID(), type: 'move', x: 2, y: 9 }), /reveal this area/);
  assert.throws(() => guardVisibility(state, player, { id: crypto.randomUUID(), type: 'attack', targetId: enemy.id }), /not visible/);
  assert.throws(() => guardVisibility(state, player, { id: crypto.randomUUID(), type: 'interact', objectId: state.objects[0].id }), /not visible/);
  applyWorldAction(state, gm, action('reveal', { x: 2, y: 9, revealed: true }));
  assert.doesNotThrow(() => guardVisibility(state, player, { id: crypto.randomUUID(), type: 'move', x: 2, y: 9 }));
  assert.doesNotThrow(() => guardVisibility(state, gm, { id: crypto.randomUUID(), type: 'attack', targetId: enemy.id }));
});

function fogMovementFixture() {
  const state = createInitialState('FOGMOVE', gm, 'srd-5.2.1');
  const player: Member = { id: 'fog-mover', name: 'Mira', role: 'player' };
  addPlayer(state, player, 'rogue');
  const hero = state.tokens.find(token => token.id === player.characterId)!;
  state.width = 8;
  state.height = 6;
  state.terrain = ['########', '#......#', '#......#', '#......#', '#......#', '########'];
  state.objects = [];
  state.tokens = [hero];
  hero.x = 1;
  hero.y = 1;
  state.rules.allowDiagonal = false;
  state.combat = { active: true, round: 1, order: [hero.id], turnIndex: 0, remainingMovement: 30, actionUsed: false };
  worldData(state).fogEnabled = true;
  return { state, player, hero };
}

test('fog movement cannot cross unknown cells to reach an isolated revealed destination', () => {
  for (const hiddenTerrain of ['#......#', '#.#....#']) {
    const { state, player, hero } = fogMovementFixture();
    state.terrain[1] = hiddenTerrain;
    worldData(state).revealed = ['3,1'];
    const terrain = state.terrain;
    const command: Action = { id: crypto.randomUUID(), type: 'move', tokenId: hero.id, x: 3, y: 1 };
    assert.throws(() => applyVisibleAction(state, player, command), /no clear path/);
    assert.equal(state.terrain, terrain, 'failed actions restore the authoritative map');
    assert.equal(state.terrain[1], hiddenTerrain);
    assert.deepEqual([hero.x, hero.y, state.combat.remainingMovement], [1, 1, 30]);
    assert.ok(!state.processed?.some(entry => entry.id === command.id));
  }
});

test('fog movement charges the revealed route even when an unseen shortcut exists', () => {
  for (const hiddenTerrain of ['#......#', '#.#....#']) {
    const { state, player, hero } = fogMovementFixture();
    state.terrain[1] = hiddenTerrain;
    worldData(state).revealed = ['1,2', '1,3', '2,3', '3,3', '3,2', '3,1'];
    const terrain = state.terrain;
    const command: Action = { id: crypto.randomUUID(), type: 'move', tokenId: hero.id, x: 3, y: 1 };
    applyVisibleAction(state, player, command);
    assert.deepEqual([hero.x, hero.y, state.combat.remainingMovement], [3, 1, 0]);
    assert.equal(state.terrain, terrain, 'successful actions restore the authoritative map');
    assert.equal(state.terrain[1], hiddenTerrain);
    applyVisibleAction(state, player, command);
    assert.equal(state.combat.remainingMovement, 0, 'retries remain idempotent');
    assert.equal(visibleState(state, player).terrain[1][2], '?', 'traversal does not reveal unknown cells');
  }
});

test('fog movement respects diagonal corners and keeps the GM full-map authority', () => {
  const { state, player, hero } = fogMovementFixture();
  state.rules.allowDiagonal = true;
  worldData(state).revealed = ['2,2'];
  const command: Action = { id: crypto.randomUUID(), type: 'move', tokenId: hero.id, x: 2, y: 2 };
  assert.throws(() => applyVisibleAction(state, player, command), /no clear path/);
  worldData(state).revealed.push('2,1', '1,2');
  applyVisibleAction(state, player, command);
  assert.equal(state.combat.remainingMovement, 25);
  applyVisibleAction(state, gm, { id: crypto.randomUUID(), type: 'move', tokenId: hero.id, x: 3, y: 2 });
  assert.equal(hero.x, 3);
  assert.equal(state.combat.remainingMovement, 20);
});

test('ranged attacks at revealed targets cannot probe concealed sight lines', () => {
  const { state, player, hero } = fogMovementFixture();
  const enemy = { ...structuredClone(hero), id: 'visible-target', ownerId: undefined, kind: 'enemy' as const, x: 3, y: 1 };
  state.tokens.push(enemy);
  worldData(state).revealed = ['3,1'];
  const command: Action = { id: crypto.randomUUID(), type: 'attack', tokenId: hero.id, targetId: enemy.id };
  for (const hiddenTerrain of ['#......#', '#.#....#']) {
    state.terrain[1] = hiddenTerrain;
    assert.throws(() => applyVisibleAction(state, player, command), /reveal the line of sight/);
    assert.equal(state.combat.actionUsed, false);
    assert.equal(enemy.hp, enemy.maxHp);
  }
  worldData(state).revealed.push('2,1');
  assert.doesNotThrow(() => guardVisibility(state, player, command));
  assert.doesNotThrow(() => guardVisibility(state, gm, command));
});

test('world edits and scene placement reserve safe spaces for downed characters', () => {
  const state = createInitialState('DOWNWORLD', gm, 'srd-5.2.1');
  const heroes = state.tokens.filter(token => token.kind === 'hero');
  heroes[0].hp = 0;
  assert.throws(() => applyWorldAction(state, gm, action('terrain', { x: heroes[0].x, y: heroes[0].y, tile: '#' })), /Move the character/);
  assert.throws(() => applyWorldAction(state, gm, action('spawn', { x: heroes[0].x, y: heroes[0].y })), /empty floor/);
  applyWorldAction(state, gm, action('sceneCreate', { name: 'Recovery Camp', preset: 'forest' }));
  const moved = state.tokens.filter(token => token.kind === 'hero');
  assert.equal(new Set(moved.map(token => `${token.x},${token.y}`)).size, moved.length);
  for (const hero of moved) assert.equal(state.terrain[hero.y][hero.x], '.');
});
