// @ts-ignore Explicit extension also supports native Node test execution.
import { CLASS_PROFILES, CHARACTER_CLASSES, makeSheet, derivedStats, modifier, newTurn, attacksPerAction } from './characters.ts';
// @ts-ignore Explicit extension also supports native Node test execution.
import { applyExpandedAction, changeHitPoints, effectiveSpeed, incapacitated, attackAdvantage, rollD20, saveModifier, movementAllowance, syncMovement, spendMovement } from './rules-engine.ts';
import type { CharacterClass, CharacterSheet, TurnResources, RuleSetId } from './characters';
export type { CharacterClass } from './characters';
export type Member = { id: string; name: string; role: "gm" | "player"; characterId?: string; tokenHash?: string };
export type Token = {
  id: string; name: string; kind: "hero" | "enemy"; characterClass: string;
  hp: number; maxHp: number; ac: number; speed: number; x: number; y: number;
  color: string; ownerId?: string; attackBonus: number; damageDie: number; range: number;
  sheet?: CharacterSheet; turn?: TurnResources;
};
export type GameObject = { id: string; type: "door" | "chest"; x: number; y: number; open: boolean };
export type GameState = {
  room: string; title: string; revision: number; width: number; height: number; terrain: string[];
  tokens: Token[]; objects: GameObject[]; members: Member[];
  rules: { friendlyFire: boolean; allowDiagonal: boolean; movementLimit: number; narrative: string };
  narrative: string;
  combat: { active: boolean; round: number; order: string[]; turnIndex: number; remainingMovement: number; actionUsed: boolean };
  log: { id: string; kind: string; text: string; at: string }[];
  processed?: { id: string; memberId: string }[];
  ruleSetId?: RuleSetId; schemaVersion?: number;
};
export type Action = Record<string, unknown> & { id: string; type: string };
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const CLASSES: Partial<Record<CharacterClass, { hp: number; ac: number; attackBonus: number; damageDie: number; range: number; color: string }>> = {
  fighter: { hp: 12, ac: 16, attackBonus: 5, damageDie: 8, range: 1, color: "#daa85c" },
  rogue: { hp: 10, ac: 14, attackBonus: 5, damageDie: 6, range: 6, color: "#ad93df" },
  cleric: { hp: 10, ac: 16, attackBonus: 4, damageDie: 6, range: 1, color: "#8dc8be" },
  wizard: { hp: 8, ac: 12, attackBonus: 4, damageDie: 4, range: 4, color: "#75b6dc" },
};

export function die(sides: number): number {
  const ceiling = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return (buffer[0] % sides) + 1;
}
export function cleanText(value: unknown, max: number, fallback = ""): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new GameError("Please enter text.");
  const text = value.trim();
  if (text.length > max) throw new GameError(`Please keep this under ${max} characters.`);
  return text;
}
function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new GameError(`Invalid ${label}.`);
  return value;
}
function log(state: GameState, kind: string, text: string) {
  state.log.push({ id: crypto.randomUUID(), kind, text, at: new Date().toISOString() });
  state.log = state.log.slice(-100);
}
export function createInitialState(room: string, gm: Member, ruleSetId: RuleSetId = 'prototype'): GameState {
  if (!['prototype','srd-5.1','srd-5.2.1'].includes(ruleSetId)) throw new GameError('Choose a supported rules edition.');
  const state: GameState = {
    ruleSetId, schemaVersion: 2,
    room, title: "The Lantern Harbor", revision: 0, width: 20, height: 14,
    terrain: [
      "####################", "#..................#", "#...####.....~~~~~~#", "#...#..#.....~~~~~~#",
      "#...#..#.....~~~~~~#", "#......#.....~~~~~~#", "#...####...........#", "#..................#",
      "#.........###......#", "#.........#.#......#", "#..................#", "#.........###......#",
      "#..................#", "####################",
    ],
    objects: [{ id: "door-vault", type: "door", x: 4, y: 5, open: false }, { id: "chest-vault", type: "chest", x: 6, y: 3, open: false }, { id: "door-tower", type: "door", x: 10, y: 10, open: false }],
    tokens: [
      { id: "companion-eira", name: "Eira Ashford", kind: "hero", characterClass: "fighter", hp: 12, maxHp: 12, ac: 16, speed: 30, x: 3, y: 8, color: "#daa85c", attackBonus: 5, damageDie: 8, range: 1 },
      { id: "companion-finn", name: "Finn Reed", kind: "hero", characterClass: "rogue", hp: 10, maxHp: 10, ac: 14, speed: 30, x: 4, y: 8, color: "#ad93df", attackBonus: 5, damageDie: 6, range: 6 },
      { id: "goblin-1", name: "Mossfang", kind: "enemy", characterClass: "goblin", hp: 7, maxHp: 7, ac: 13, speed: 30, x: 9, y: 4, color: "#e47f73", attackBonus: 4, damageDie: 6, range: 1 },
      { id: "goblin-2", name: "Briar", kind: "enemy", characterClass: "goblin", hp: 7, maxHp: 7, ac: 13, speed: 30, x: 14, y: 9, color: "#e47f73", attackBonus: 4, damageDie: 6, range: 1 },
    ],
    members: [gm], rules: { friendlyFire: false, allowDiagonal: true, movementLimit: 30, narrative: "Magic is feared in Lanternfall. Describe unusual actions and let the GM decide the ruling." },
    narrative: "Mist rolls over the old harbor. Beyond the broken watchtower, two figures guard a sealed vault. The last lantern burns blue. What do you do?",
    combat: { active: false, round: 0, order: [], turnIndex: 0, remainingMovement: 0, actionUsed: false },
    log: [{ id: crypto.randomUUID(), kind: "story", text: "The adventure begins at the Lantern Harbor.", at: new Date().toISOString() }], processed: [],
  };
  normalizeState(state);
  if(ruleSetId!=='prototype') for(const token of state.tokens) if(token.kind==='hero') Object.assign(token,derivedStats(token.characterClass,token.sheet!));
  return state;
}
export function normalizeState(state: GameState): GameState {
  state.ruleSetId ??= 'prototype'; state.schemaVersion = 2;
  for(const token of state.tokens){ token.sheet ??= makeSheet(token.characterClass,state.ruleSetId); token.turn ??= newTurn(); }
  return state;
}
export function addPlayer(state: GameState, member: Member, characterClass: unknown): void {
  normalizeState(state);
  if (state.members.length >= 8) throw new GameError("This table is full (one GM and seven players).", 409);
  if (state.combat.active) throw new GameError("The GM must end combat before a new adventurer can join.", 409);
  if (typeof characterClass !== "string" || !CHARACTER_CLASSES.includes(characterClass as CharacterClass)) throw new GameError("Choose one of the twelve SRD classes.");
  const sheet=makeSheet(characterClass,state.ruleSetId!);
  const stats = state.ruleSetId==='prototype'&&CLASSES[characterClass as CharacterClass] ? CLASSES[characterClass as CharacterClass]! : derivedStats(characterClass,sheet);
  const slots = [[2, 10], [3, 10], [2, 11], [3, 11], [4, 10], [4, 11], [2, 9], [3, 9], [4, 9]];
  const slot = slots.find(([x, y]) => !state.tokens.some(t => t.x === x && t.y === y));
  if (!slot) throw new GameError("The arrival area is full. Ask the GM to move a character.", 409);
  member.characterId = crypto.randomUUID();
  state.members.push(member);
  state.tokens.push({ id: member.characterId, name: member.name, kind: "hero", characterClass, maxHp: stats.hp, ...stats, speed: 30, x: slot[0], y: slot[1], ownerId: member.id, sheet, turn:newTurn() });
  log(state, "system", `${member.name}, the ${characterClass}, joined the party.`);
}
export function publicState(state: GameState): GameState {
  const result = structuredClone(state);
  result.members = result.members.map(({ tokenHash: _secret, ...member }) => member);
  delete result.processed;
  return result;
}
function requireGm(member: Member) { if (member.role !== "gm") throw new GameError("Only the GM can do that.", 403); }
function controlledToken(state: GameState, member: Member, tokenId: unknown): Token {
  const token = state.tokens.find(t => t.id === tokenId);
  if (!token) throw new GameError("Character not found.", 404);
  if (member.role !== "gm" && token.ownerId !== member.id) throw new GameError("You can only control your own character.", 403);
  if (token.hp <= 0) throw new GameError("That character is down and cannot act.");
  if (incapacitated(token)) throw new GameError('That character is incapacitated and cannot act.');
  return token;
}
function requireTurn(state: GameState, token: Token) {
  if (state.combat.active && state.combat.order[state.combat.turnIndex] !== token.id) throw new GameError("Wait for this character's turn.");
}
function blocked(state: GameState, x: number, y: number, tokenId?: string): boolean {
  return x < 0 || x >= state.width || y < 0 || y >= state.height || state.terrain[y][x] !== "." || state.objects.some(o => o.x === x && o.y === y && (o.type === "chest" || !o.open)) || state.tokens.some(t => t.id !== tokenId && !t.sheet?.deathSaves.dead && t.x === x && t.y === y);
}
function pathLength(state: GameState, token: Token, x: number, y: number): number {
  if (blocked(state, x, y, token.id)) throw new GameError("That space is blocked.");
  const queue = [[token.x, token.y, 0]], visited = new Set([`${token.x},${token.y}`]);
  const dirs = state.rules.allowDiagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy, steps] = queue[i];
    if (cx === x && cy === y) return steps * 5;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
      if (visited.has(key) || blocked(state, nx, ny, token.id)) continue;
      if (dx && dy && (blocked(state, cx + dx, cy, token.id) || blocked(state, cx, cy + dy, token.id))) continue;
      visited.add(key); queue.push([nx, ny, steps + 1]);
    }
  }
  throw new GameError("There is no clear path to that space.");
}
function clearSight(state: GameState, from: Token, to: Token): boolean {
  const dx = to.x - from.x, dy = to.y - from.y, steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
  for (let n = 1; n < steps; n++) {
    const x = Math.round(from.x + dx * n / steps), y = Math.round(from.y + dy * n / steps);
    if (state.terrain[y][x] === "#" || state.objects.some(o => o.type === "door" && !o.open && o.x === x && o.y === y)) return false;
  }
  return true;
}
function beginTurn(state: GameState) {
  const current = state.tokens.find(t => t.id === state.combat.order[state.combat.turnIndex]);
  // Slot-per-turn restrictions reset on EVERY creature's turn, reactions reset
  // only when the reacting creature's own turn begins.
  for(const token of state.tokens) if(token.turn){ token.turn.slotSpent=false;token.turn.bonusSpellCast=false;token.turn.nonCantripCast=false;token.turn.otherSpellCast=false; }
  if(current) current.turn=newTurn();
  state.combat.remainingMovement = current ? Math.min(effectiveSpeed(state,current), state.rules.movementLimit) : 0;
  state.combat.actionUsed = false;
}
export function applyAction(state: GameState, member: Member, action: Action): void {
  normalizeState(state);
  if (typeof action.id !== "string" || action.id.length < 8 || action.id.length > 100) throw new GameError("A valid action ID is required.");
  if (state.processed?.some(a => a.id === action.id && a.memberId === member.id)) return;
  if(applyExpandedAction(state,member,action,{die,log,fail:(message:string,status=400):never=>{throw new GameError(message,status);},requireGm,requireTurn,controlledToken})){state.processed=[...(state.processed??[]),{id:action.id,memberId:member.id}].slice(-160);return;}
  switch (action.type) {
    case "move": {
      const token = controlledToken(state, member, action.tokenId); requireTurn(state, token);
      const x = integer(action.x, 0, state.width - 1, "destination"), y = integer(action.y, 0, state.height - 1, "destination");
      if(effectiveSpeed(state,token)===0&&(x!==token.x||y!==token.y))throw new GameError('This character has no movement speed available.');
      const distance = pathLength(state, token, x, y)*(token.sheet!.conditions.includes('prone')?2:1);
      const budget = state.combat.active ? state.combat.remainingMovement : Math.min(effectiveSpeed(state,token), state.rules.movementLimit);
      if (distance > budget) throw new GameError(`That path needs ${distance} ft; you have ${budget} ft available.`);
      token.x = x; token.y = y;
      spendMovement(state,token,distance);
      if (distance) log(state, "move", `${token.name} moved ${distance} ft.`);
      break;
    }
    case "attack": {
      const token = controlledToken(state, member, action.tokenId); requireTurn(state, token);
      const target = state.tokens.find(t => t.id === action.targetId);
      if (!target || target.id === token.id || target.sheet?.deathSaves.dead) throw new GameError("Choose another living character to attack.");
      if (!state.combat.active) throw new GameError("The GM must start combat before an attack.");
      const maximumAttacks=state.ruleSetId==='prototype'?1:attacksPerAction(token.characterClass,token.sheet!.level);
      if (state.combat.actionUsed&&(!token.turn!.attacksMade||token.turn!.attacksMade>=maximumAttacks)) throw new GameError("This character already used their action.");
      if (!state.rules.friendlyFire && token.kind === target.kind) throw new GameError("Friendly fire is disabled by the GM.");
      if (Math.max(Math.abs(token.x - target.x), Math.abs(token.y - target.y)) > token.range) throw new GameError(`Target is outside your ${token.range * 5} ft attack range.`);
      if (!clearSight(state, token, target)) throw new GameError("A wall or closed door blocks the attack.");
      const roll = rollD20(die,attackAdvantage(state,token,target));
      const penalty=state.ruleSetId==='srd-5.2.1'?2*(token.sheet?.exhaustion??0):0;
      const hit = roll !== 1 && (roll === 20 || roll + token.attackBonus-penalty >= target.ac);
      const critical=roll===20||((target.sheet?.conditions.some(c=>['paralyzed','unconscious'].includes(c)))&&Math.max(Math.abs(token.x-target.x),Math.abs(token.y-target.y))<=1);
      const damage = hit ? Math.max(0,die(token.damageDie) + (critical ? die(token.damageDie) : 0) + (state.ruleSetId==='prototype'?2:token.sheet?.damageModifier??2)) : 0;
      if(damage)changeHitPoints(state,target,-damage,{die,log},critical); state.combat.actionUsed = true;token.turn!.attacksMade++;
      log(state, "combat", `${token.name} attacks ${target.name}: d20 ${roll} + ${token.attackBonus}${penalty?` − ${penalty}`:''} = ${roll + token.attackBonus-penalty} vs AC ${target.ac}. ${hit ? `${critical ? "Critical hit! " : "Hit! "}${damage} damage.${target.hp === 0 ? ` ${target.name} is down.` : ""}` : "Miss."}`);
      break;
    }
    case "interact": {
      const token = controlledToken(state, member, action.tokenId); requireTurn(state, token);
      const object = state.objects.find(o => o.id === action.objectId);
      if (!object) throw new GameError("Object not found.", 404);
      if (Math.abs(token.x - object.x) + Math.abs(token.y - object.y) > 1) throw new GameError("Move beside the object first.");
      if (state.combat.active && state.combat.actionUsed) throw new GameError("Your action has already been used.");
      if (object.type === "chest" && object.open) throw new GameError("This chest is already open.");
      if (object.type === "door" && object.open && state.tokens.some(t => t.x === object.x && t.y === object.y)) throw new GameError("Someone is in the doorway.");
      object.open = !object.open;
      if (state.combat.active) state.combat.actionUsed = true;
      log(state, "story", object.type === "chest" ? `${token.name} opens the vault chest and discovers a silver compass. Ask the GM what it reveals.` : `${token.name} ${object.open ? "opens" : "closes"} the door.`);
      break;
    }
    case "roll": {
      const sides = integer(action.sides, 4, 100, "die");
      if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) throw new GameError("Choose a standard polyhedral die.");
      const modifier = integer(action.modifier ?? 0, -20, 30, "modifier");
      const advantage = action.advantage ?? "normal";
      if (!["normal", "advantage", "disadvantage"].includes(String(advantage)) || (sides !== 20 && advantage !== "normal")) throw new GameError("Advantage and disadvantage apply to d20 rolls only.");
      const first = die(sides), second = advantage !== "normal" ? die(sides) : first;
      const selected = advantage === "advantage" ? Math.max(first, second) : advantage === "disadvantage" ? Math.min(first, second) : first;
      log(state, "dice", `${member.name} rolled d${sides}${advantage === "normal" ? `: ${first}` : ` with ${advantage}: [${first}, ${second}], kept ${selected}`}${modifier ? ` ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)}` : ""} = ${selected + modifier}.`);
      break;
    }
    case "chat": {
      const text = cleanText(action.text, 700); if (!text) throw new GameError("Write a message first.");
      log(state, "chat", `${member.name}: ${text}`); break;
    }
    case "opening": {
      requireGm(member); const text = cleanText(action.text, 2400); if (!text) throw new GameError("Write an opening scene first.");
      state.narrative = text; log(state, "story", `GM: ${text}`); break;
    }
    case "rest": {
      requireGm(member);
      if (state.combat.active) throw new GameError("End combat before resting the party.");
      for (const token of state.tokens) if (token.kind === "hero") {
        // A standing token may have moved onto a fallen hero's square.
        if (blocked(state, token.x, token.y, token.id)) {
          const candidates: { x: number; y: number; distance: number }[] = [];
          for (let y = 1; y < state.height - 1; y++) for (let x = 1; x < state.width - 1; x++) {
            if (!blocked(state, x, y, token.id)) candidates.push({ x, y, distance: Math.abs(x - token.x) + Math.abs(y - token.y) });
          }
          candidates.sort((a, b) => a.distance - b.distance);
          if (!candidates.length) throw new GameError("There is no free space for the party to recover.");
          token.x = candidates[0].x; token.y = candidates[0].y;
        }
        token.hp = token.maxHp;
      }
      log(state, "story", "The GM grants the party a rest. All adventurers recover their hit points.");
      break;
    }
    case "rules": {
      requireGm(member);
      if (typeof action.friendlyFire !== "boolean" || typeof action.allowDiagonal !== "boolean") throw new GameError("Choose the rule settings.");
      const limit = integer(action.movementLimit, 5, 120, "movement limit");
      if (limit % 5) throw new GameError("Movement must be a multiple of 5 ft.");
      const current=state.tokens.find(t=>t.id===state.combat.order[state.combat.turnIndex]),previousMovement=current?movementAllowance(state,current):0;
      state.rules = { friendlyFire: action.friendlyFire, allowDiagonal: action.allowDiagonal, movementLimit: limit, narrative: cleanText(action.narrative, 1400) };
      if(current)syncMovement(state,current,previousMovement);
      log(state, "system", "The GM updated the table rules."); break;
    }
    case "combat": {
      requireGm(member);
      if (action.mode === "start") {
        if (state.combat.active) throw new GameError("Combat has already started.");
        const initiative = state.tokens.filter(t => !t.sheet?.deathSaves.dead&&(t.hp>0||t.kind==='hero')).map(t => ({ id: t.id, value: die(20) + (state.ruleSetId==='prototype'?(t.characterClass === "rogue" ? 3 : t.characterClass === "goblin" ? 2 : 1):modifier(t.sheet!.abilities.dex)-(state.ruleSetId==='srd-5.2.1'?2*t.sheet!.exhaustion:0)) })).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
        if (initiative.length < 2) throw new GameError("At least two living characters are needed.");
        state.combat = { active: true, round: 1, order: initiative.map(t => t.id), turnIndex: 0, remainingMovement: 0, actionUsed: false };
        beginTurn(state); log(state, "combat", `Initiative: ${initiative.map(t => `${state.tokens.find(p => p.id === t.id)?.name} ${t.value}`).join(" · ")}.`);
      } else if (action.mode === "next") {
        if (!state.combat.active) throw new GameError("Combat has not started.");
        if (state.tokens.filter(t => !t.sheet?.deathSaves.dead&&(t.hp>0||t.kind==='hero')).length < 2) throw new GameError("Only one living character remains. End combat.");
        for (let n = 0; n < state.combat.order.length; n++) {
          state.combat.turnIndex = (state.combat.turnIndex + 1) % state.combat.order.length;
          if (state.combat.turnIndex === 0) state.combat.round++;
          const candidate=state.tokens.find(t => t.id === state.combat.order[state.combat.turnIndex]);
          if (candidate&&!candidate.sheet?.deathSaves.dead&&(candidate.hp>0||candidate.kind==='hero')) break;
        }
        beginTurn(state); const current = state.tokens.find(t => t.id === state.combat.order[state.combat.turnIndex]);
        log(state, "combat", `Round ${state.combat.round}: ${current?.name}'s turn.`);
      } else if (action.mode === "end") {
        if (!state.combat.active) throw new GameError("Combat has not started.");
        state.combat = { active: false, round: 0, order: [], turnIndex: 0, remainingMovement: 0, actionUsed: false };
        log(state, "combat", "Combat ended. The party returns to exploration.");
      } else throw new GameError("Unknown combat command.");
      break;
    }
    default: throw new GameError("Unknown action.");
  }
  state.processed = [...(state.processed ?? []), { id: action.id, memberId: member.id }].slice(-160);
}
