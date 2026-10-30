/** Shared scene presentation and authored layouts; contains no campaign secrets. */
export const SCENE_THEMES = ['harbor', 'crypt', 'forest', 'tavern', 'cavern', 'ruins'] as const;
export type SceneTheme = typeof SCENE_THEMES[number];
export type SceneInfo = { id: string; name: string; theme: SceneTheme; ambience: string; narration: string };
export type SceneTemplate = {
  id: SceneTheme; name: string; subtitle: string; description: string; ambience: string;
  narration: string; ground: string; wall: string; water: string; accent: string;
};
export const SCENE_TEMPLATES: readonly SceneTemplate[] = [
  { id: 'harbor', name: 'Lantern Harbor', subtitle: 'Quayside ruins', description: 'A warehouse, a watchtower, a locked vault and a moonlit quay.', ambience: 'Dusk · Salt air & distant bells', narration: 'Mist curls between the moored boats. Two lookouts keep watch beside a sealed storehouse, while a blue lantern burns above the old quay. The tide is turning.', ground: '#697266', wall: '#3f4742', water: '#294d52', accent: '#d6b979' },
  { id: 'crypt', name: 'Forgotten Crypt', subtitle: 'Ancient burial chambers', description: 'Burial aisles lead to a guarded inner chamber and a forgotten coffer.', ambience: 'Underground · Candlelight & cold stone', narration: 'The stairs end beneath a vaulted ceiling. Dust lies undisturbed between the burial chambers, but fresh candle wax marks a path toward the iron-bound door. Something shifts beyond it.', ground: '#62616d', wall: '#363640', water: '#3c5068', accent: '#b7abce' },
  { id: 'forest', name: 'Whispering Grove', subtitle: 'Woodland crossing', description: 'A winding stream divides clearings, old trees and a hidden cache.', ambience: 'Twilight · Leaves & running water', narration: 'Silver leaves stir without a wind. A shallow stream splits the clearing ahead, and a weathered trail crosses at a narrow ford. Someone has tied a red ribbon to the oldest tree.', ground: '#61734d', wall: '#344b38', water: '#356166', accent: '#bfd88c' },
  { id: 'tavern', name: 'The Copper Lantern', subtitle: 'Roadside inn', description: 'A common room, side rooms and a cellar door for a social opening.', ambience: 'Evening · Firelight & low voices', narration: 'Warm light spills from the Copper Lantern. A fire crackles behind the bar, and the room falls quiet when the cellar bell rings. The innkeeper looks to your table before anyone else.', ground: '#806849', wall: '#4d3b30', water: '#4e6260', accent: '#edbf78' },
  { id: 'cavern', name: 'Moonstone Hollow', subtitle: 'Flooded caverns', description: 'Stone pillars and underground pools protect a remote treasure shelf.', ambience: 'Underground · Dripping water & blue glow', narration: 'Moonstone veins throw pale light across the cavern walls. Water drips into a still pool, its surface broken by a single set of ripples. A narrow stone shelf leads deeper into the dark.', ground: '#5f6974', wall: '#343f4d', water: '#254b66', accent: '#8dc9e0' },
  { id: 'ruins', name: 'Sunken Sanctuary', subtitle: 'Overgrown temple', description: 'Broken walls, a central court and a guarded sanctuary beyond two doors.', ambience: 'Morning · Birdsong & crumbling stone', narration: 'Roots grip the pillars of the ruined sanctuary. Sunlight catches a bronze seal beyond the broken courtyard, and a pair of sentries turn toward the sound of your approach. The old doors are still standing.', ground: '#7b7961', wall: '#4e5149', water: '#3d615a', accent: '#d4d39b' },
];
export function isSceneTheme(value: unknown): value is SceneTheme { return SCENE_THEMES.includes(value as SceneTheme); }
export function sceneTemplate(value: unknown): SceneTemplate { return SCENE_TEMPLATES.find(template => template.id === value) ?? SCENE_TEMPLATES[0]; }
export type LayoutObject = { type: 'door' | 'chest'; x: number; y: number; open: boolean };
export type LayoutEnemy = { name: string; x: number; y: number; hp: number; ac: number; attackBonus: number; damageDie: number };

/** Small, editable encounter layouts. Creature profiles are GM-adjustable examples. */
export function sceneLayout(theme: SceneTheme, width = 20, height = 14): { terrain: string[]; objects: LayoutObject[]; enemies: LayoutEnemy[] } {
  const rows: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '#' : '.'));
  const put = (x: number, y: number, tile: string) => { if (x > 0 && y > 0 && x < width - 1 && y < height - 1) rows[y][x] = tile; };
  const line = (x1: number, y1: number, x2: number, y2: number, tile = '#') => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(x, y, tile); };
  const objects: LayoutObject[] = [], enemies: LayoutEnemy[] = [];
  const object = (type: LayoutObject['type'], x: number, y: number) => { if (x > 0 && y > 0 && x < width - 1 && y < height - 1) { put(x, y, '.'); objects.push({ type, x, y, open: false }); } };
  const enemy = (name: string, x: number, y: number, hp = 7, ac = 13) => { if (x > 0 && y > 0 && x < width - 1 && y < height - 1) { put(x, y, '.'); enemies.push({ name, x, y, hp, ac, attackBonus: 4, damageDie: 6 }); } };
  if (theme === 'harbor') {
    line(13, 2, 18, 8, '~'); line(4, 2, 8, 2); line(4, 2, 4, 6); line(8, 2, 8, 6); line(4, 6, 8, 6);
    line(10, 9, 13, 9); line(10, 9, 10, 11); line(10, 11, 13, 11); line(13, 9, 13, 11);
    object('door', 4, 5); object('door', 11, 9); object('chest', 7, 3); enemy('Harbor lookout', 11, 5); enemy('Quay guard', 15, 10);
  } else if (theme === 'crypt') {
    line(5, 2, 5, 5); line(5, 8, 5, 11); line(10, 2, 10, 11); line(14, 2, 14, 5); line(14, 8, 14, 11);
    put(10, 7, '.'); object('door', 10, 6); object('chest', 17, 3); object('chest', 7, 10);
    enemy('Crypt guardian', 13, 6, 13, 13); enemy('Restless sentry', 17, 9, 11, 12);
  } else if (theme === 'forest') {
    for (const [x, y] of [[4, 3], [5, 3], [4, 4], [7, 8], [8, 8], [7, 9], [15, 3], [16, 3], [16, 4], [15, 10], [16, 10]]) put(x, y, '#');
    line(10, 1, 11, 12, '~'); line(10, 6, 11, 7, '.'); object('chest', 17, 11); enemy('Grove prowler', 14, 7, 9, 12);
  } else if (theme === 'tavern') {
    line(7, 1, 7, 4); line(7, 8, 7, 12); line(12, 1, 12, 4); line(12, 8, 12, 12);
    line(1, 4, 6, 4); line(13, 8, 18, 8); line(9, 3, 10, 3); line(9, 10, 10, 10); line(15, 3, 16, 3);
    object('door', 4, 4); object('door', 15, 8); object('chest', 17, 11);
  } else if (theme === 'cavern') {
    line(4, 1, 5, 3); line(4, 9, 5, 12); line(9, 4, 10, 5); line(13, 1, 15, 2); line(15, 10, 18, 12);
    line(12, 6, 15, 8, '~'); line(2, 6, 4, 7, '~'); object('chest', 17, 4); enemy('Hollow lurker', 13, 4, 15, 13);
  } else {
    line(5, 2, 5, 5); line(5, 8, 5, 11); line(9, 3, 10, 3); line(9, 10, 10, 10);
    line(13, 2, 17, 2); line(13, 2, 13, 11); line(17, 2, 17, 11); line(13, 11, 17, 11);
    object('door', 13, 6); object('door', 13, 7); object('chest', 16, 4); enemy('Sanctuary sentry', 10, 6, 11, 14); enemy('Sanctuary warden', 15, 8, 18, 14);
  }
  return { terrain: rows.map(row => row.join('')), objects, enemies };
}
