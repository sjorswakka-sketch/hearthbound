import { GameError, applyAction, publicState, type GameState, type Member, type Token, type GameObject, type Action } from '@/lib/game';
import { isSceneTheme, sceneLayout, sceneTemplate, type SceneInfo, type SceneTheme } from '@/lib/scenes';
import { publicSession } from '@/lib/session';
import { spellAreaCells, type SpellId } from '@/lib/spells';

type Scene = { id: string; name: string; terrain: string[]; objects: GameObject[]; enemies: Token[]; revealed: string[]; theme?: SceneTheme; ambience?: string; narration?: string };
export type MapPing = { id: string; memberId: string; x: number; y: number; createdAt: number; expiresAt: number };
export type WorldData = { fogEnabled: boolean; revealed: string[]; gmNotes: string; activeScene: string; scenes: Scene[]; pings?: MapPing[]; currentScene?: SceneInfo };
type WorldState = GameState & { world?: WorldData; session?: ReturnType<typeof publicSession> };
const key = (x: number, y: number) => x + ',' + y;

function legacyTheme(scene: Scene): SceneTheme {
  if (isSceneTheme(scene.theme)) return scene.theme;
  const name = scene.name.toLowerCase();
  return name.includes('crypt') ? 'crypt' : /forest|grove|wood/.test(name) ? 'forest' : /tavern|inn/.test(name) ? 'tavern' : /cavern|hollow|cave/.test(name) ? 'cavern' : /temple|sanctuary|ruins/.test(name) ? 'ruins' : 'harbor';
}
export function worldData(state: GameState): WorldData {
  const s = state as WorldState;
  const w = s.world ??= { fogEnabled: false, revealed: [], gmNotes: '', activeScene: 'harbor', scenes: [{ id: 'harbor', name: state.title, terrain: [], objects: [], enemies: [], revealed: [] }] };
  w.pings ??= [];
  for (const scene of w.scenes) {
    scene.theme ??= legacyTheme(scene);
    scene.ambience ??= sceneTemplate(scene.theme).ambience;
    scene.narration ??= scene.id === w.activeScene ? state.narrative : sceneTemplate(scene.theme).narration;
  }
  return w;
}
function sceneInfo(s: GameState, w: WorldData, scene: Scene): SceneInfo {
  return { id: scene.id, name: scene.name, theme: legacyTheme(scene), ambience: scene.ambience ?? sceneTemplate(scene.theme).ambience, narration: scene.id === w.activeScene ? s.narrative : scene.narration ?? sceneTemplate(scene.theme).narration };
}
function log(s: GameState, text: string) { s.log.push({ id: crypto.randomUUID(), kind: 'world', text, at: new Date().toISOString() }); s.log = s.log.slice(-100); }
function number(v: unknown, min: number, max: number) { if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new GameError('Choose a valid map value.'); return v; }
function text(v: unknown, max: number, allowEmpty = false) { if (typeof v !== 'string' || (!allowEmpty && !v.trim()) || v.length > max) throw new GameError('Enter text under ' + max + ' characters.'); return v.trim(); }
function occupied(s: GameState, x: number, y: number) { return s.tokens.some(t => t.x === x && t.y === y); }
function clear(s: GameState, x: number, y: number) { return s.terrain[y]?.[x] === '.' && !occupied(s, x, y) && !s.objects.some(o => o.x === x && o.y === y && (o.type === 'chest' || !o.open)); }
function saveScene(s: GameState, w: WorldData) {
  const current = w.scenes.find(c => c.id === w.activeScene);
  if (current) Object.assign(current, { terrain: [...s.terrain], objects: structuredClone(s.objects), enemies: structuredClone(s.tokens.filter(t => t.kind === 'enemy')), revealed: [...w.revealed], narration: s.narrative });
}
function switchScene(s: GameState, w: WorldData, scene: Scene) {
  const heroes = s.tokens.filter(t => t.kind === 'hero');
  const trial = { ...s, terrain: [...scene.terrain], objects: structuredClone(scene.objects), tokens: structuredClone(scene.enemies) };
  for (const hero of heroes) {
    let placed = false;
    for (let y = 1; y < s.height - 1 && !placed; y++) for (let x = 1; x < s.width - 1 && !placed; x++) if (clear(trial, x, y)) { trial.tokens.push({ ...hero, x, y }); placed = true; }
    if (!placed) throw new GameError('That scene has insufficient room for the party.');
  }
  saveScene(s, w);
  s.terrain = trial.terrain; s.objects = trial.objects; s.tokens = trial.tokens;
  w.activeScene = scene.id; w.revealed = [...scene.revealed]; w.pings = [];
  s.title = scene.name; s.narrative = scene.narration ?? sceneTemplate(scene.theme).narration;
}
function record(s: GameState, m: Member, a: Action) { s.processed = [...(s.processed ?? []), { id: a.id, memberId: m.id }].slice(-160); }

export function applyWorldAction(s: GameState, m: Member, a: Action) {
  if (typeof a.id !== 'string' || a.id.length < 8 || a.id.length > 100) throw new GameError('A valid action ID is required.');
  if (s.processed?.some(p => p.id === a.id && p.memberId === m.id)) return;
  if (a.op !== 'ping' && m.role !== 'gm') throw new GameError('Only the GM can edit the world.', 403);
  const w = worldData(s);
  if (a.op === 'ping') {
    if (!s.members.some(member => member.id === m.id)) throw new GameError('Join this table before placing a ping.', 403);
    const x = number(a.x, 0, s.width - 1), y = number(a.y, 0, s.height - 1);
    if (m.role !== 'gm' && w.fogEnabled && !w.revealed.includes(key(x, y)) && !s.tokens.some(t => t.ownerId === m.id && t.x === x && t.y === y)) throw new GameError('You can only ping a revealed square.');
    const now = Date.now(), active = (w.pings ?? []).filter(p => p.expiresAt > now);
    if (active.some(p => p.memberId === m.id && now - p.createdAt < 1200)) throw new GameError('Wait a moment before placing another ping.', 429);
    w.pings = [...active.filter(p => p.memberId !== m.id), { id: a.id, memberId: m.id, x, y, createdAt: now, expiresAt: now + 6000 }].slice(-12);
  } else if (a.op === 'notes') {
    if (typeof a.text !== 'string' || a.text.length > 10000) throw new GameError('Keep private notes under 10,000 characters.');
    w.gmNotes = a.text;
  } else if (a.op === 'fog') {
    if (typeof a.enabled !== 'boolean') throw new GameError('Choose fog on or off.');
    w.fogEnabled = a.enabled; log(s, 'The GM ' + (a.enabled ? 'enabled' : 'disabled') + ' shared fog of war.');
  } else if (a.op === 'reveal' || a.op === 'revealAll') {
    if (typeof a.revealed !== 'boolean') throw new GameError('Choose reveal or hide.');
    if (a.op === 'revealAll') w.revealed = a.revealed ? s.terrain.flatMap((row, y) => Array.from(row).map((_, x) => key(x, y))) : [];
    else {
      const x = number(a.x, 0, s.width - 1), y = number(a.y, 0, s.height - 1), radius = number(a.radius ?? 0, 0, 3), cells = new Set(w.revealed);
      for (let row = Math.max(0, y - radius); row <= Math.min(s.height - 1, y + radius); row++) for (let col = Math.max(0, x - radius); col <= Math.min(s.width - 1, x + radius); col++) a.revealed ? cells.add(key(col, row)) : cells.delete(key(col, row));
      w.revealed = [...cells];
    }
  } else if (a.op === 'sceneUpdate') {
    const current = w.scenes.find(scene => scene.id === w.activeScene);
    if (!current) throw new GameError('Scene not found.');
    const name = a.name === undefined ? current.name : text(a.name, 50), narration = a.narration === undefined ? s.narrative : text(a.narration, 2400, true), ambience = a.ambience === undefined ? current.ambience : text(a.ambience, 100, true);
    if (a.theme !== undefined && !isSceneTheme(a.theme)) throw new GameError('Choose a supported scene theme.');
    Object.assign(current, { name, narration, ambience, theme: a.theme ?? current.theme });
    s.title = name; s.narrative = narration;
    log(s, 'The GM updated ' + name + '.');
  } else {
    if (s.combat.active) throw new GameError('End the encounter before editing terrain or changing scenes.');
    if (a.op === 'sceneCreate') {
      if (w.scenes.length >= 12) throw new GameError('This campaign supports up to 12 scenes.');
      if (!isSceneTheme(a.preset)) throw new GameError('Choose a scene template.');
      const template = sceneTemplate(a.preset), layout = sceneLayout(a.preset, s.width, s.height);
      const scene: Scene = {
        id: crypto.randomUUID(), name: text(a.name, 50), theme: a.preset, ambience: template.ambience, narration: template.narration,
        terrain: layout.terrain, revealed: [], objects: layout.objects.map(o => ({ ...o, id: crypto.randomUUID() })),
        enemies: layout.enemies.map(enemy => ({ id: crypto.randomUUID(), name: enemy.name, kind: 'enemy', characterClass: 'goblin', hp: enemy.hp, maxHp: enemy.hp, ac: enemy.ac, speed: 30, x: enemy.x, y: enemy.y, color: template.accent, attackBonus: enemy.attackBonus, damageDie: enemy.damageDie, range: 1 })),
      };
      switchScene(s, w, scene); w.scenes.push(scene); log(s, 'The party enters ' + scene.name + '.');
    } else if (a.op === 'sceneSwitch') {
      const scene = w.scenes.find(c => c.id === a.sceneId); if (!scene) throw new GameError('Scene not found.');
      if (scene.id !== w.activeScene) { switchScene(s, w, scene); log(s, 'The party returns to ' + scene.name + '.'); }
    } else {
      const x = number(a.x, 0, s.width - 1), y = number(a.y, 0, s.height - 1);
      if (a.op === 'terrain') {
        if (!['.', '#', '~'].includes(String(a.tile))) throw new GameError('Choose floor, wall, or water.');
        if (a.tile !== '.' && (occupied(s, x, y) || s.objects.some(o => o.x === x && o.y === y))) throw new GameError('Move the character or remove the object before blocking this tile.');
        s.terrain[y] = s.terrain[y].slice(0, x) + a.tile + s.terrain[y].slice(x + 1);
      } else if (a.op === 'object') {
        if (!['door', 'chest', 'remove'].includes(String(a.kind))) throw new GameError('Choose a door, chest, or remove.');
        if (a.kind !== 'remove' && (s.terrain[y][x] !== '.' || occupied(s, x, y))) throw new GameError('Choose an unoccupied floor tile.');
        s.objects = s.objects.filter(o => o.x !== x || o.y !== y);
        if (a.kind !== 'remove') s.objects.push({ id: crypto.randomUUID(), type: a.kind as 'door' | 'chest', x, y, open: false });
      } else if (a.op === 'spawn') {
        if (!clear(s, x, y)) throw new GameError('Choose an empty floor tile.'); if (s.tokens.length >= 40) throw new GameError('This scene supports up to 40 creatures.');
        const hp = number(a.hp ?? 7, 1, 999), ac = number(a.ac ?? 13, 1, 30);
        s.tokens.push({ id: crypto.randomUUID(), name: text(a.name ?? 'Creature', 40), kind: 'enemy', characterClass: 'goblin', hp, maxHp: hp, ac, speed: 30, x, y, color: '#e47f73', attackBonus: 4, damageDie: 6, range: 1 });
      } else throw new GameError('Unknown world edit.');
    }
  }
  record(s, m, a);
}

export function visibleState(s: GameState, m: Member): GameState {
  const w = worldData(s), out = publicState(s) as WorldState, current = w.scenes.find(scene => scene.id === w.activeScene);
  out.members = out.members.map(p => ({ id: p.id, name: p.name, role: p.role, ...(p.characterId ? { characterId: p.characterId } : {}) }));
  out.session = publicSession(s);
  out.world = {
    fogEnabled: w.fogEnabled, revealed: [...w.revealed], gmNotes: m.role === 'gm' ? w.gmNotes : '', activeScene: w.activeScene,
    currentScene: current ? sceneInfo(s, w, current) : undefined,
    pings: (w.pings ?? []).filter(p => p.expiresAt > Date.now()).map(p => ({ ...p })),
    scenes: w.scenes.map(c => ({ ...(m.role === 'gm' || c.id === w.activeScene ? sceneInfo(s, w, c) : { id: c.id, name: c.name }), terrain: [], objects: [], enemies: [], revealed: [] })),
  };
  if (m.role === 'gm' || !w.fogEnabled) return out;
  const own = s.tokens.filter(t => t.ownerId === m.id), known = new Set([...w.revealed, ...own.map(t => key(t.x, t.y))]);
  out.terrain = s.terrain.map((row, y) => Array.from(row).map((c, x) => known.has(key(x, y)) ? c : '?').join(''));
  out.tokens = out.tokens.filter(t => known.has(key(t.x, t.y)));
  out.objects = out.objects.filter(o => known.has(key(o.x, o.y)));
  out.log = out.log.filter(l => ['chat', 'dice', 'world'].includes(l.kind) || (l.kind === 'story' && l.text.startsWith('GM:')));
  out.world.scenes = out.world.scenes.filter(c => c.id === w.activeScene);
  out.world.pings = out.world.pings?.filter(p => known.has(key(p.x, p.y)));
  if (out.combat.active) {
    const currentId = out.combat.order[out.combat.turnIndex], order = out.combat.order.filter(id => out.tokens.some(t => t.id === id)), index = order.indexOf(currentId);
    out.combat = { ...out.combat, order, turnIndex: index, ...(index < 0 ? { remainingMovement: 0, actionUsed: false } : {}) };
  }
  return out;
}

function requireKnownLine(view: GameState, from: { x: number; y: number }, to: { x: number; y: number }, verb = 'acting') {
  const dx = to.x - from.x, dy = to.y - from.y, steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
  for (let n = 1; n < steps; n++) if (view.terrain[Math.round(from.y + dy * n / steps)]?.[Math.round(from.x + dx * n / steps)] === '?') throw new GameError('Ask the GM to reveal the line of sight before ' + verb + '.');
}
export function guardVisibility(s: GameState, m: Member, a: Action) {
  if (m.role === 'gm' || !worldData(s).fogEnabled) return;
  const view = visibleState(s, m);
  if (a.type === 'move' && (typeof a.x !== 'number' || typeof a.y !== 'number' || !Number.isInteger(a.x) || !Number.isInteger(a.y) || !view.terrain[a.y]?.[a.x] || view.terrain[a.y][a.x] === '?')) throw new GameError('Ask the GM to reveal this area before moving there.');
  if (a.targetId && !view.tokens.some(t => t.id === a.targetId)) throw new GameError('That target is not visible.');
  if (a.objectId && !view.objects.some(o => o.id === a.objectId)) throw new GameError('That object is not visible.');
  const actor = view.tokens.find(t => t.id === a.tokenId && t.ownerId === m.id);
  if (a.type === 'attack') {
    const target = view.tokens.find(t => t.id === a.targetId);
    if (actor && target) requireKnownLine(view, actor, target, 'attacking');
  }
  if (a.type === 'spell') {
    if (a.targetIds !== undefined) {
      if (!Array.isArray(a.targetIds) || a.targetIds.length > 40 || a.targetIds.some(id => typeof id !== 'string' || !view.tokens.some(t => t.id === id))) throw new GameError('Choose visible spell targets.');
      if (actor) for (const id of a.targetIds) requireKnownLine(view, actor, view.tokens.find(t => t.id === id)!, 'casting');
    }
    let origin: { x: number; y: number } | undefined;
    if (a.origin !== undefined) {
      if (!a.origin || typeof a.origin !== 'object') throw new GameError('Choose a revealed spell origin.');
      const point = a.origin as { x: unknown; y: unknown };
      origin = { x: number(point.x, 0, s.width - 1), y: number(point.y, 0, s.height - 1) };
      if (view.terrain[origin.y]?.[origin.x] === '?') throw new GameError('Choose a revealed spell origin.');
      if (actor) requireKnownLine(view, actor, origin, 'casting');
    }
    if (actor && typeof a.spellId === 'string') {
      const area = spellAreaCells(view, actor, a.spellId as SpellId, origin, typeof a.direction === 'string' ? a.direction : undefined);
      if (area.some(({ x, y }) => view.terrain[y]?.[x] === '?')) throw new GameError('Ask the GM to reveal the entire spell area, or resolve this spell with the GM.');
    }
  }
}

export function applyVisibleAction(s: GameState, m: Member, a: Action) {
  if (s.processed?.some(p => p.id === a.id && p.memberId === m.id)) return;
  guardVisibility(s, m, a);
  if (m.role === 'gm' || !worldData(s).fogEnabled || a.type !== 'move') {
    applyAction(s, m, a);
    if (a.type === 'opening') { const w = worldData(s), current = w.scenes.find(scene => scene.id === w.activeScene); if (current) current.narration = s.narrative; }
    return;
  }
  // Resolve pathfinding only against revealed cells, and never persist the projection.
  const terrain = s.terrain; s.terrain = visibleState(s, m).terrain;
  try { applyAction(s, m, a); } finally { s.terrain = terrain; }
}
