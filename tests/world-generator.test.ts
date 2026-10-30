import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Native Node tests.
import {ARRANGEMENTS, DENSITIES, ENCOUNTERS, DEFAULT_GENERATION_OPTIONS, parseGenerationOptions, generateSceneLayout, type GenerationOptions, type GeneratedLayout} from '../lib/world-generator.ts';
// @ts-ignore Native Node tests.
import {SCENE_THEMES, sceneLayout} from '../lib/scenes.ts';

const options = (fields: Partial<GenerationOptions> = {}): GenerationOptions => ({...DEFAULT_GENERATION_OPTIONS, ...fields});
const cell = (x: number, y: number) => `${x},${y}`;

function assertPlayable(layout: GeneratedLayout, width = 20, height = 14) {
  assert.equal(layout.terrain.length, height);
  assert.ok(layout.terrain.every(row => row.length === width && /^[.#~]+$/.test(row)));
  assert.equal(layout.terrain[0], '#'.repeat(width));
  assert.equal(layout.terrain[height - 1], '#'.repeat(width));
  assert.ok(layout.terrain.every(row => row[0] === '#' && row[width - 1] === '#'));
  const occupied = new Set<string>();
  for (const object of [...layout.objects, ...layout.enemies]) {
    assert.equal(layout.terrain[object.y]?.[object.x], '.');
    assert.equal(occupied.has(cell(object.x, object.y)), false, 'Objects and encounters must not overlap.');
    occupied.add(cell(object.x, object.y));
  }
  for (let y = 1; y <= 2; y++) for (let x = 1; x <= 5; x++) {
    assert.equal(layout.terrain[y][x], '.', 'The party needs ten clear arrival squares.');
    assert.equal(occupied.has(cell(x, y)), false);
  }
  const reachable = new Set<string>([cell(1, 1)]), queue = [{x: 1, y: 1}];
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = queue[i].x + dx, y = queue[i].y + dy, id = cell(x, y);
    if (layout.terrain[y]?.[x] !== '.' || occupied.has(id) || reachable.has(id)) continue;
    reachable.add(id); queue.push({x, y});
  }
  const free = layout.terrain.flatMap((row, y) => [...row].flatMap((tile, x) => tile === '.' && !occupied.has(cell(x, y)) ? [cell(x, y)] : []));
  assert.equal(reachable.size, free.length, 'Every unoccupied floor must be reachable without diagonals or opening doors.');
  for (const creature of layout.enemies) {
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable.has(cell(creature.x + dx, creature.y + dy))), 'A creature must be approachable.');
  }
}

test('saved generation settings reproduce terrain, props and encounters after serialization', () => {
  const chosen = options({seed: 'The glass desert 42', theme: 'cavern', arrangement: 'rooms', density: 'dense', encounter: 'guardians'});
  const first = generateSceneLayout(chosen);
  assert.deepEqual(generateSceneLayout(JSON.parse(JSON.stringify(chosen))), first);
  assert.deepEqual(chosen, options({seed: 'The glass desert 42', theme: 'cavern', arrangement: 'rooms', density: 'dense', encounter: 'guardians'}), 'Generating a preview must not mutate its settings.');
});

test('variations produce different map geometry while themes and arrangements influence it', () => {
  const varied = Array.from({length: 80}, (_, i) => generateSceneLayout(options({seed: `varied-${i}`})).terrain.join('\n'));
  assert.equal(new Set(varied).size, 80, 'Different seeds must change actual terrain, not only names or colors.');
  const themes = SCENE_THEMES.map(theme => generateSceneLayout(options({theme, seed: 'same-world'})).terrain.join('\n'));
  assert.equal(new Set(themes).size, SCENE_THEMES.length);
  const arrangements = ARRANGEMENTS.map(arrangement => generateSceneLayout(options({arrangement, seed: 'same-world'})).terrain.join('\n'));
  assert.equal(new Set(arrangements).size, ARRANGEMENTS.length);
});

test('every generated theme, arrangement and density retains safe arrivals and connected floor', () => {
  for (const theme of SCENE_THEMES) for (const arrangement of ARRANGEMENTS) for (const density of DENSITIES) for (let seed = 0; seed < 12; seed++) {
    const encounter = ENCOUNTERS[seed % ENCOUNTERS.length];
    const layout = generateSceneLayout(options({theme, arrangement, density, encounter, seed: `invariants-${seed}`}));
    assertPlayable(layout);
    if (encounter === 'none') assert.equal(layout.enemies.length, 0);
    else assert.ok(layout.enemies.length >= 1, `${theme}/${arrangement}/${density} should contain its chosen example encounter.`);
  }
});

test('encounter choice changes only examples and does not redraw the generated map', () => {
  const peaceful = generateSceneLayout(options({seed: 'quiet-village', arrangement: 'settlement', encounter: 'none'}));
  const scouts = generateSceneLayout(options({seed: 'quiet-village', arrangement: 'settlement', encounter: 'scouts'}));
  const guardians = generateSceneLayout(options({seed: 'quiet-village', arrangement: 'settlement', encounter: 'guardians'}));
  assert.deepEqual(peaceful.terrain, scouts.terrain);
  assert.deepEqual(peaceful.objects, guardians.objects);
  assert.equal(peaceful.enemies.length, 0);
  assert.ok(scouts.enemies.every(enemy => enemy.name.startsWith('Scout ')));
  assert.ok(guardians.enemies.every(enemy => enemy.name.startsWith('Guardian ')));
  assertPlayable(scouts); assertPlayable(guardians);
});

test('blank canvases contain no forced adventure or encounters and templates remain explicit', () => {
  const blank = generateSceneLayout(options({layout: 'blank', encounter: 'guardians', seed: ''}));
  assert.equal(parseGenerationOptions(options({layout: 'blank', encounter: 'guardians'})).encounter, 'none');
  assert.deepEqual(blank.objects, []); assert.deepEqual(blank.enemies, []);
  assert.equal(blank.terrain.slice(1, -1).every(row => row === '#' + '.'.repeat(18) + '#'), true);
  assertPlayable(blank);
  for (const theme of SCENE_THEMES) {
    const authored = generateSceneLayout(options({layout: 'template', theme, encounter: 'none', seed: ''}));
    assert.deepEqual(authored.terrain, sceneLayout(theme).terrain);
    assert.deepEqual(authored.objects, sceneLayout(theme).objects);
    assert.deepEqual(authored.enemies, []);
  }
});

test('invalid controls and oversized inputs are rejected before map generation', () => {
  assert.deepEqual(parseGenerationOptions({}), DEFAULT_GENERATION_OPTIONS);
  for (const bad of [null, [], 'forest', {layout: '__proto__'}, {theme: 'lava'}, {arrangement: 'castle'}, {density: Infinity}, {encounter: 'dragon'}, {seed: 42}, {seed: ''}, {seed: ' '.repeat(64)}, {seed: 'a'.repeat(65)}, {seed: 'line\nbreak'}, {premise: 'place a dragon here'}, {seed: undefined}]) assert.throws(() => parseGenerationOptions(bad));
  assert.equal(parseGenerationOptions({seed: '  island  '}).seed, 'island');
  assert.equal(parseGenerationOptions({seed: 'a'.repeat(64)}).seed.length, 64);
  assert.throws(() => generateSceneLayout(options(), Infinity, 14));
  assert.throws(() => generateSceneLayout(options(), 20, 999));
  assert.throws(() => generateSceneLayout(options(), 11, 9));
  assert.throws(() => generateSceneLayout(options(), 20.5, 14));
  for (const [width, height] of [[12, 10], [40, 30]]) assertPlayable(generateSceneLayout(options({arrangement: 'rooms', encounter: 'guardians'}), width, height), width, height);
});
