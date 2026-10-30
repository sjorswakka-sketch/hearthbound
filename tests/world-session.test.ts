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
// @ts-ignore native Node TypeScript imports for tests.
const { SCENE_THEMES, sceneLayout, sceneTemplate } = await import('../lib/scenes.ts');
const gm: Member = { id: 'gm-world', name: 'GM', role: 'gm', tokenHash: 'secret-gm-token-hash' };
const action = (op: string, fields: Record<string, unknown> = {}): Action => ({ id: crypto.randomUUID(), type: 'world', op, ...fields });
const world = (state: GameState) => (state as GameState & { world: WorldData }).world;

test('custom scenes persist their own map, narration and GM-only generation settings across travel', () => {
  const state = createInitialState('CUSTOM', gm, 'srd-5.1');
  const narration = 'A clockwork orchard hangs beneath an unfinished moon.';
  const options = {name: 'Clockwork Orchard', preset: 'forest', layout: 'generated', seed: 'an-unfinished-moon', arrangement: 'wilderness', density: 'dense', encounter: 'none', narration, ambience: 'Still air · Distant gears'};
  applyWorldAction(state, gm, action('sceneCreate', options));
  const firstScene = world(state).activeScene, firstMap = [...state.terrain];
  assert.equal(state.narrative, narration);
  assert.equal(state.ruleSetId, 'srd-5.1');
  assert.equal(state.tokens.filter(token => token.kind === 'enemy').length, 0);
  const metadata = world(visibleState(state, gm)).currentScene!;
  assert.equal(metadata.generation?.seed, options.seed);
  assert.equal(metadata.ambience, options.ambience);
  applyWorldAction(state, gm, action('sceneCreate', {...options, name: 'Another Orchard', seed: 'a-different-moon'}));
  assert.notDeepEqual(state.terrain, firstMap);
  applyWorldAction(state, gm, action('sceneSwitch', {sceneId: firstScene}));
  assert.deepEqual(state.terrain, firstMap);
  assert.equal(state.narrative, narration);
  assert.equal(world(visibleState(state, gm)).currentScene?.generation?.seed, options.seed);
  const player: Member = {id: 'custom-player', name: 'Explorer', role: 'player'};
  addPlayer(state, player, 'bard');
  assert.ok(!JSON.stringify(visibleState(state, player)).includes(options.seed));
  worldData(state).fogEnabled = true;
  const fogged = visibleState(state, player);
  assert.ok(!JSON.stringify(fogged).includes(options.seed));
  assert.equal(world(fogged).currentScene?.narration, narration);
});

test('blank and template creation honor explicit encounter choices without silently adding a story', () => {
  const state = createInitialState('BLANKS', gm);
  applyWorldAction(state, gm, action('sceneCreate', {name: 'An empty canvas', preset: 'crypt', layout: 'blank', seed: '', encounter: 'guardians'}));
  assert.equal(state.objects.length, 0);
  assert.equal(state.tokens.filter(token => token.kind === 'enemy').length, 0);
  assert.equal(state.narrative, '');
  assert.equal(world(visibleState(state, gm)).currentScene?.generation?.encounter, 'none');
  applyWorldAction(state, gm, action('sceneCreate', {name: 'A peaceful ruin', preset: 'ruins', layout: 'template', seed: '', encounter: 'none', narration: '', ambience: ''}));
  assert.equal(state.tokens.filter(token => token.kind === 'enemy').length, 0);
  assert.equal(state.narrative, '');
  assert.equal(world(visibleState(state, gm)).currentScene?.ambience, '');
  assert.ok(state.objects.length > 0, 'authored architecture is retained when encounters are removed');
});

test('invalid scene generation cannot replace a current scene or bypass GM authority', () => {
  const state = createInitialState('BADMAP', gm);
  worldData(state);
  const original = structuredClone(state);
  const fields = {name: 'Invalid map', preset: 'forest', layout: 'generated', seed: 'safe-seed'};
  for (const mutation of [{seed: ''}, {layout: 'anything'}, {arrangement: '__proto__'}, {density: 'infinite'}, {encounter: 'dragon'}, {narration: 'x'.repeat(2401)}, {ambience: 'x'.repeat(101)}]) {
    assert.throws(() => applyWorldAction(state, gm, action('sceneCreate', {...fields, ...mutation})));
    assert.deepEqual(state, original);
  }
  assert.throws(() => applyWorldAction(state, {id: 'player', name: 'Player', role: 'player'}, action('sceneCreate', fields)), /Only the GM/);
  assert.deepEqual(state, original);
});

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

test('six authored templates have connected floor plans and valid encounter placements', () => {
  const signatures = new Set<string>();
  for (const theme of SCENE_THEMES) {
    const layout = sceneLayout(theme);
    signatures.add(layout.terrain.join(''));
    assert.equal(layout.terrain.length, 14);
    assert.ok(layout.terrain.every(row => row.length === 20));
    assert.ok(layout.terrain[0].split('').every(tile => tile === '#'));
    assert.ok(layout.terrain[13].split('').every(tile => tile === '#'));
    assert.ok(layout.terrain.every(row => row.startsWith('#') && row.endsWith('#')));
    const placements = [...layout.objects, ...layout.enemies];
    assert.equal(new Set(placements.map(item => `${item.x},${item.y}`)).size, placements.length);
    for (const item of placements) assert.equal(layout.terrain[item.y][item.x], '.');
    const visited = new Set(['1,1']), queue = [{ x: 1, y: 1 }];
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const x = current.x + dx, y = current.y + dy, cell = `${x},${y}`;
        if (layout.terrain[y]?.[x] === '.' && !visited.has(cell)) { visited.add(cell); queue.push({ x, y }); }
      }
    }
    assert.equal(visited.size, layout.terrain.reduce((total, row) => total + [...row].filter(tile => tile === '.').length, 0), `${theme} has no permanently inaccessible floor islands`);
    assert.ok(sceneTemplate(theme).narration.length > 70);
  }
  assert.equal(signatures.size, 6, 'each template has a different floor plan');
});

test('each scene retains its introduction and atmosphere, including later GM narration', () => {
  const state = createInitialState('SCENESTORY', gm, 'srd-5.2.1');
  const initialTerrain = [...state.terrain];
  applyWorldAction(state, gm, action('sceneUpdate', { name: 'Storm Harbor', theme: 'harbor', ambience: 'Storm · High tide', narration: 'A storm is coming.' }));
  applyWorldAction(state, gm, action('sceneCreate', { name: 'Warm Inn', preset: 'tavern' }));
  const innId = worldData(state).activeScene;
  assert.equal(state.narrative, sceneTemplate('tavern').narration);
  assert.equal(world(visibleState(state, gm)).currentScene?.theme, 'tavern');
  applyVisibleAction(state, gm, { id: crypto.randomUUID(), type: 'opening', text: 'The innkeeper reveals a new clue.' });
  applyWorldAction(state, gm, action('sceneSwitch', { sceneId: 'harbor' }));
  assert.equal(state.title, 'Storm Harbor');
  assert.equal(state.narrative, 'A storm is coming.');
  assert.deepEqual(state.terrain, initialTerrain);
  assert.equal(world(visibleState(state, gm)).currentScene?.ambience, 'Storm · High tide');
  applyWorldAction(state, gm, action('sceneSwitch', { sceneId: innId }));
  assert.equal(state.narrative, 'The innkeeper reveals a new clue.');
  state.combat.active = true;
  applyWorldAction(state, gm, action('sceneUpdate', { theme: 'crypt', narration: 'The candles go out.' }));
  assert.equal(state.narrative, 'The candles go out.', 'narration can change during an encounter without changing terrain');
});

test('scene metadata validation is atomic and inactive scene narration is private', () => {
  const state = createInitialState('SCENESECRET', gm, 'srd-5.2.1');
  const player: Member = { id: 'scene-player', name: 'Mira', role: 'player' };
  addPlayer(state, player, 'rogue');
  applyWorldAction(state, gm, action('sceneCreate', { name: 'Secret Temple', preset: 'ruins' }));
  applyWorldAction(state, gm, action('sceneUpdate', { narration: 'Secret reveal: a sleeping dragon.' }));
  applyWorldAction(state, gm, action('sceneSwitch', { sceneId: 'harbor' }));
  const before = structuredClone(state);
  assert.throws(() => applyWorldAction(state, gm, action('sceneUpdate', { name: 'Should not change', theme: 'invalid' })), /supported scene theme/);
  assert.deepEqual(state, before);
  assert.throws(() => applyWorldAction(state, player, action('sceneUpdate', { narration: 'Player overwrite' })), /Only the GM/);
  assert.ok(!JSON.stringify(visibleState(state, player)).includes('sleeping dragon'));
  worldData(state).fogEnabled = true;
  const output = JSON.stringify(visibleState(state, player));
  assert.ok(!output.includes('sleeping dragon'));
  assert.ok(!world(visibleState(state, player)).scenes.some(scene => scene.name === 'Secret Temple'));
});

test('GM reveal brushes clip to the board, hide areas, and never accept invalid radii', () => {
  const state = createInitialState('BRUSHWORLD', gm, 'srd-5.2.1');
  applyWorldAction(state, gm, action('reveal', { x: 0, y: 0, radius: 2, revealed: true }));
  assert.equal(worldData(state).revealed.length, 9);
  assert.ok(worldData(state).revealed.includes('2,2'));
  const before = [...worldData(state).revealed];
  assert.throws(() => applyWorldAction(state, gm, action('reveal', { x: 0, y: 0, radius: 999, revealed: true })), /valid map value/);
  assert.deepEqual(worldData(state).revealed, before);
  applyWorldAction(state, gm, action('reveal', { x: 1, y: 1, radius: 1, revealed: false }));
  assert.equal(worldData(state).revealed.length, 0);
  applyWorldAction(state, gm, action('revealAll', { revealed: true }));
  assert.equal(worldData(state).revealed.length, state.width * state.height);
  applyWorldAction(state, gm, action('revealAll', { revealed: false }));
  assert.deepEqual(worldData(state).revealed, []);
});

test('shared pings expire, respect hidden areas, deduplicate and leave resources untouched', () => {
  const { state, player, hero } = fogMovementFixture();
  const before = structuredClone({ combat: state.combat, sheet: hero.sheet, turn: hero.turn });
  const command = action('ping', { x: hero.x, y: hero.y });
  applyWorldAction(state, player, command);
  applyWorldAction(state, player, command);
  assert.equal(worldData(state).pings?.length, 1);
  assert.equal(world(visibleState(state, player)).pings?.[0].memberId, player.id);
  assert.throws(() => applyWorldAction(state, player, action('ping', { x: 3, y: 1 })), /revealed square/);
  assert.throws(() => applyWorldAction(state, player, action('ping', { x: hero.x, y: hero.y })), (error: unknown) => (error as { status: number }).status === 429);
  applyWorldAction(state, gm, action('ping', { x: 3, y: 1 }));
  assert.equal(world(visibleState(state, gm)).pings?.length, 2);
  assert.equal(world(visibleState(state, player)).pings?.length, 1, 'hidden GM pings do not reveal coordinates');
  for (const ping of worldData(state).pings ?? []) ping.expiresAt = Date.now() - 1;
  assert.deepEqual(world(visibleState(state, gm)).pings, []);
  assert.deepEqual({ combat: state.combat, sheet: hero.sheet, turn: hero.turn }, before);
});

test('spell fog guards prevent hidden targets, trajectories, origins and area probes', () => {
  const { state, player, hero } = fogMovementFixture();
  const enemy = { ...structuredClone(hero), id: 'spell-target', ownerId: undefined, kind: 'enemy' as const, x: 3, y: 1 };
  state.tokens.push(enemy);
  const targeted: Action = { id: crypto.randomUUID(), type: 'spell', tokenId: hero.id, spellId: 'fire-bolt', targetIds: [enemy.id] };
  assert.throws(() => guardVisibility(state, player, targeted), /visible spell targets/);
  worldData(state).revealed = ['3,1'];
  assert.throws(() => guardVisibility(state, player, targeted), /reveal the line of sight/);
  worldData(state).revealed.push('2,1');
  assert.doesNotThrow(() => guardVisibility(state, player, targeted));
  const area: Action = { id: crypto.randomUUID(), type: 'spell', tokenId: hero.id, spellId: 'fireball', origin: { x: 3, y: 1 } };
  assert.throws(() => guardVisibility(state, player, area), /entire spell area/);
  assert.throws(() => guardVisibility(state, player, { ...area, origin: { x: 4, y: 4 } }), /revealed spell origin/);
  applyWorldAction(state, gm, action('revealAll', { revealed: true }));
  assert.doesNotThrow(() => guardVisibility(state, player, area));
  assert.doesNotThrow(() => guardVisibility(state, gm, area));
});
