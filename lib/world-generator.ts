// @ts-ignore Explicit extension supports the native Node test runner.
import {isSceneTheme, sceneLayout, type SceneTheme, type LayoutObject, type LayoutEnemy} from './scenes.ts';

export const LAYOUT_MODES = ['generated', 'blank', 'template'] as const;
export const ARRANGEMENTS = ['wilderness', 'rooms', 'settlement'] as const;
export const DENSITIES = ['sparse', 'balanced', 'dense'] as const;
export const ENCOUNTERS = ['none', 'scouts', 'guardians'] as const;
export type LayoutMode = typeof LAYOUT_MODES[number];
export type Arrangement = typeof ARRANGEMENTS[number];
export type Density = typeof DENSITIES[number];
export type Encounter = typeof ENCOUNTERS[number];
export type GenerationOptions = {
  layout: LayoutMode; theme: SceneTheme; seed: string;
  arrangement: Arrangement; density: Density; encounter: Encounter;
};
export type GeneratedLayout = {terrain: string[]; objects: LayoutObject[]; enemies: LayoutEnemy[]};
export const DEFAULT_GENERATION_OPTIONS: Readonly<GenerationOptions> = Object.freeze({
  layout: 'generated', theme: 'forest', seed: 'first-light',
  arrangement: 'wilderness', density: 'balanced', encounter: 'none',
});

/** Geometry controls only. A story premise is never interpreted as an instruction. */
export function parseGenerationOptions(input: unknown): GenerationOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose valid world generation settings.');
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !Object.hasOwn(DEFAULT_GENERATION_OPTIONS, key))) throw new Error('Unknown world generation setting.');
  const options = {...DEFAULT_GENERATION_OPTIONS, ...data};
  if (!LAYOUT_MODES.includes(options.layout as LayoutMode)) throw new Error('Choose a generated map, blank canvas, or example map.');
  if (!isSceneTheme(options.theme)) throw new Error('Choose a supported visual theme.');
  if (!ARRANGEMENTS.includes(options.arrangement as Arrangement)) throw new Error('Choose wilderness, rooms, or a settlement.');
  if (!DENSITIES.includes(options.density as Density)) throw new Error('Choose sparse, balanced, or dense terrain.');
  if (!ENCOUNTERS.includes(options.encounter as Encounter)) throw new Error('Choose no creatures, scouts, or guardians.');
  if (typeof options.seed !== 'string' || options.seed.length > 64 || /[\u0000-\u001f\u007f]/.test(options.seed)) throw new Error('Use a map seed of up to 64 characters without line breaks.');
  const seed = options.seed.trim();
  if (options.layout === 'generated' && !seed) throw new Error('Enter a map seed or request another variation.');
  return {...options, seed, encounter: options.layout === 'blank' ? 'none' : options.encounter} as GenerationOptions;
}

type Point = {x: number; y: number};
const key = (point: Point) => point.y + ',' + point.x;
const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const arrival = (x: number, y: number) => x >= 1 && x <= 5 && y >= 1 && y <= 2;

/** This seeded PRNG is exclusively for map construction, never game dice. */
function randomSequence(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    let value = state += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function flood(rows: string[][], start: Point, blocked = new Set<string>()) {
  const seen = new Set<string>(), queue: Point[] = [];
  if (rows[start.y]?.[start.x] === '.' && !blocked.has(key(start))) {seen.add(key(start)); queue.push(start);}
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of directions) {
    const point = {x: queue[i].x + dx, y: queue[i].y + dy}, id = key(point);
    if (rows[point.y]?.[point.x] === '.' && !seen.has(id) && !blocked.has(id)) {seen.add(id); queue.push(point);}
  }
  return {seen, points: queue};
}
function floorPoints(rows: string[][]) {
  return rows.flatMap((row, y) => row.flatMap((tile, x) => tile === '.' ? [{x, y}] : []));
}
function shuffled<T>(values: T[], random: () => number) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]];}
  return copy;
}
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 12 || width > 40 || height < 10 || height > 30) throw new Error('Generated maps must be 12–40 squares wide and 10–30 squares high.');
}
function borderedFloor(width: number, height: number): string[][] {
  return Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => !x || !y || x === width - 1 || y === height - 1 ? '#' : '.'));
}
function connectFloor(rows: string[][], random: () => number) {
  // A corridor connects at least one new component each pass. The cell count
  // bounds work even when a future arrangement creates many tiny chambers.
  for (let pass = 0; pass < rows.length * rows[0].length; pass++) {
    const connected = flood(rows, {x: 1, y: 1}), missing = floorPoints(rows).find(point => !connected.seen.has(key(point)));
    if (!missing) return;
    let nearest = connected.points[0], distance = Infinity;
    for (const point of connected.points) {const d = Math.abs(point.x - missing.x) + Math.abs(point.y - missing.y); if (d < distance) {distance = d; nearest = point;}}
    let {x, y} = missing;
    const horizontal = () => {while (x !== nearest.x) {x += Math.sign(nearest.x - x); rows[y][x] = '.';}};
    const vertical = () => {while (y !== nearest.y) {y += Math.sign(nearest.y - y); rows[y][x] = '.';}};
    if (random() < .5) {horizontal(); vertical();} else {vertical(); horizontal();}
  }
  throw new Error('The map could not be connected. Choose another variation.');
}

function addEncounters(layout: GeneratedLayout, options: GenerationOptions, width: number, height: number) {
  if (options.encounter === 'none') return layout;
  const rows = layout.terrain.map(row => [...row]), floors = floorPoints(rows);
  const blocked = new Set(layout.objects.filter(object => object.type === 'chest' || !object.open).map(key));
  const random = randomSequence(`${options.seed}|encounters|${options.theme}|${width}|${height}`);
  const candidates = shuffled(floors.filter(point => !arrival(point.x, point.y) && point.x + point.y >= 9 && !blocked.has(key(point))), random);
  const count = options.encounter === 'guardians' ? 2 : options.density === 'dense' ? 3 : 2;
  // Existing authored maps may deliberately have rooms behind closed doors.
  const reachable = flood(rows, {x: 1, y: 1}, blocked).seen;
  const targetSize = options.layout === 'template' ? reachable.size : floors.length - blocked.size;
  let added = 0;
  for (const point of candidates) {
    if (added === count) break;
    if (!reachable.has(key(point))) continue;
    blocked.add(key(point));
    if (flood(rows, {x: 1, y: 1}, blocked).seen.size !== targetSize - added - 1) {blocked.delete(key(point)); continue;}
    const guardian = options.encounter === 'guardians';
    layout.enemies.push({name: `${guardian ? 'Guardian' : 'Scout'} ${added + 1}`, ...point, hp: guardian ? 18 : 7, ac: guardian ? 14 : 12, attackBonus: guardian ? 4 : 3, damageDie: guardian ? 8 : 6});
    added++;
  }
  return layout;
}

/** Stable, editable geometry. Same settings reproduce a map, not dice outcomes. */
export function generateSceneLayout(input: GenerationOptions, width = 20, height = 14): GeneratedLayout {
  const options = parseGenerationOptions(input);
  dimensions(width, height);
  if (options.layout === 'blank') return {terrain: borderedFloor(width, height).map(row => row.join('')), objects: [], enemies: []};
  if (options.layout === 'template') {
    const layout = sceneLayout(options.theme, width, height);
    return addEncounters({...layout, enemies: []}, options, width, height);
  }
  const rows = borderedFloor(width, height), objects: LayoutObject[] = [], proposedDoors: Point[] = [];
  const random = randomSequence(`${options.seed}|geometry|${options.theme}|${options.arrangement}|${options.density}|${width}|${height}`);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const density = DENSITIES.indexOf(options.density);
  const put = (x: number, y: number, tile: string) => {if (x > 0 && y > 0 && x < width - 1 && y < height - 1 && !arrival(x, y)) rows[y][x] = tile;};

  // Geography changes with theme. It never depends on reading the GM's prose.
  if (options.theme === 'harbor') {
    let shore = width - integer(3, 5);
    for (let y = 1; y < height - 1; y++) {shore = Math.max(width - 6, Math.min(width - 3, shore + integer(-1, 1))); for (let x = shore; x < width - 1; x++) put(x, y, '~');}
  } else if (options.theme === 'forest') {
    let stream = integer(6, width - 4);
    const crossing = integer(3, height - 4);
    for (let y = 1; y < height - 1; y++) {stream = Math.max(6, Math.min(width - 3, stream + integer(-1, 1))); if (Math.abs(y - crossing) > 1) {put(stream, y, '~'); if (density > 0) put(stream + 1, y, '~');}}
  } else if (options.theme === 'cavern') {
    for (let i = 0; i < 2 + density; i++) {const x = integer(5, width - 4), y = integer(3, height - 4); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (random() < .8) put(x + dx, y + dy, '~');}
  }

  if (options.arrangement === 'wilderness') {
    for (let i = 0; i < 6 + density * 6; i++) {
      const cx = integer(2, width - 3), cy = integer(3, height - 3), radius = integer(1, density === 2 ? 2 : 1);
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (Math.abs(dx) + Math.abs(dy) <= radius && random() < .7) put(cx + dx, cy + dy, '#');
    }
  } else {
    const roomCount = options.arrangement === 'rooms' ? 4 + density * 2 : 3 + density;
    for (let i = 0; i < roomCount; i++) {
      const roomWidth = integer(3, Math.min(6, width - 4)), roomHeight = integer(3, Math.min(5, height - 4));
      const x1 = integer(1, width - roomWidth - 1), y1 = integer(3, height - roomHeight - 1), x2 = x1 + roomWidth - 1, y2 = y1 + roomHeight - 1;
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(x, y, x === x1 || x === x2 || y === y1 || y === y2 ? '#' : '.');
      const first = {x: integer(x1 + 1, x2 - 1), y: y1}, second = {x: integer(x1 + 1, x2 - 1), y: y2};
      put(first.x, first.y, '.'); put(second.x, second.y, '.'); proposedDoors.push(first);
      if (options.arrangement === 'rooms' && random() < .5) {const sideY = integer(y1 + 1, y2 - 1); put(x1, sideY, '.');}
    }
  }
  for (let y = 1; y <= 2; y++) for (let x = 1; x <= 5; x++) rows[y][x] = '.';
  connectFloor(rows, random);
  const floors = floorPoints(rows), blocked = new Set<string>();
  const place = (point: Point, type: LayoutObject['type']) => {
    const id = key(point);
    if (arrival(point.x, point.y) || rows[point.y]?.[point.x] !== '.' || blocked.has(id)) return false;
    blocked.add(id);
    if (flood(rows, {x: 1, y: 1}, blocked).seen.size !== floors.length - blocked.size) {blocked.delete(id); return false;}
    objects.push({...point, type, open: false}); return true;
  };
  for (const point of proposedDoors.slice(0, 4)) place(point, 'door');
  const candidates = shuffled(floors.filter(point => point.x + point.y >= 10), random);
  let chests = 0;
  for (const point of candidates) {if (chests >= (density === 2 ? 2 : 1)) break; if (place(point, 'chest')) chests++;}
  return addEncounters({terrain: rows.map(row => row.join('')), objects, enemies: []}, options, width, height);
}
