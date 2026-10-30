import { test } from "node:test";
import assert from "node:assert/strict";
// Node 24 supports executing this TypeScript test directly with --experimental-strip-types.
// @ts-ignore allow TypeScript extension for native Node test execution.
import { addPlayer, applyAction, createInitialState, die, publicState } from "../lib/game.ts";
import type { Action, GameState, Member } from "../lib/game";

const gm: Member = { id: "gm", name: "GM", role: "gm", tokenHash: "never-public" };
function fresh() { return createInitialState("ABC234", structuredClone(gm)); }
function act(state: GameState, member: Member, type: string, fields: Record<string, unknown> = {}) {
  const action: Action = { id: crypto.randomUUID(), type, ...fields }; applyAction(state, member, action); return action;
}
function player(state: GameState): Member {
  const member: Member = { id: crypto.randomUUID(), name: "Mira", role: "player", tokenHash: "also-secret" }; addPlayer(state, member, "rogue"); return member;
}

test("terrain dimensions match the board and every row has a closed boundary", () => {
  const state = fresh(); assert.equal(state.terrain.length, state.height);
  for (const row of state.terrain) { assert.equal(row.length, state.width); assert.equal(row[0], "#"); assert.equal(row.at(-1), "#"); }
});
test("only the GM can rest heroes, and only outside combat", () => {
  const state = fresh(), member = player(state), hero = state.tokens[0], enemy = state.tokens.find(t => t.kind === "enemy")!;
  hero.hp = 0; enemy.hp = 2;
  assert.throws(() => act(state, member, "rest"), /Only the GM/);
  act(state, gm, "combat", { mode: "start" });
  assert.throws(() => act(state, gm, "rest"), /End combat/);
  act(state, gm, "combat", { mode: "end" }); act(state, gm, "rest");
  assert.equal(hero.hp, hero.maxHp); assert.equal(enemy.hp, 2);
});
test("resting a fallen hero does not stack it on a standing token", () => {
  const state = fresh(), fallen = state.tokens[0], other = state.tokens[1];
  fallen.hp = 0; other.x = fallen.x; other.y = fallen.y;
  act(state, gm, "rest");
  assert.equal(fallen.hp, fallen.maxHp); assert.notDeepEqual([fallen.x, fallen.y], [other.x, other.y]);
});

test("only the GM can change rules or manage combat", () => {
  const state = fresh(), member = player(state);
  assert.throws(() => act(state, member, "rules", { friendlyFire: true, allowDiagonal: true, movementLimit: 30, narrative: "" }), /Only the GM/);
  assert.throws(() => act(state, member, "combat", { mode: "start" }), /Only the GM/);
  assert.equal(state.rules.friendlyFire, false);
});
test("a player cannot control another token or impersonate ownership", () => {
  const state = fresh(), member = player(state);
  assert.throws(() => act(state, member, "move", { tokenId: "goblin-1", x: 9, y: 5 }), /own character/);
  const token = state.tokens.find(t => t.id === member.characterId)!;
  act(state, member, "move", { tokenId: token.id, x: 2, y: 9 });
  assert.deepEqual([token.x, token.y], [2, 9]);
});
test("movement rejects walls, water, long paths and diagonal corner cutting", () => {
  const state = fresh();
  assert.throws(() => act(state, gm, "move", { tokenId: "companion-eira", x: 4, y: 6 }), /blocked/);
  assert.throws(() => act(state, gm, "move", { tokenId: "companion-eira", x: 14, y: 3 }), /blocked/);
  assert.throws(() => act(state, gm, "move", { tokenId: "companion-eira", x: 18, y: 12 }), /needs/);
  const token = state.tokens[0]; token.x = 3; token.y = 5;
  state.rules.movementLimit = 5;
  assert.throws(() => act(state, gm, "move", { tokenId: token.id, x: 4, y: 4 }), /blocked/);
  assert.throws(() => act(state, gm, "move", { tokenId: token.id, x: 5, y: 5 }), /needs|path/);
});
test("closed doors block movement and open doors become passable", () => {
  const state = fresh(), token = state.tokens[0]; token.x = 3; token.y = 5;
  assert.throws(() => act(state, gm, "move", { tokenId: token.id, x: 4, y: 5 }), /blocked/);
  act(state, gm, "interact", { tokenId: token.id, objectId: "door-vault" });
  act(state, gm, "move", { tokenId: token.id, x: 5, y: 5 });
  assert.equal(token.x, 5);
});
test("combat enforces active turn and action economy", () => {
  const state = fresh(); act(state, gm, "combat", { mode: "start" });
  const actor = state.tokens.find(t => t.id === state.combat.order[0])!;
  const other = state.tokens.find(t => t.id !== actor.id)!;
  assert.throws(() => act(state, gm, "move", { tokenId: other.id, x: other.x, y: other.y }), /turn/);
  const target = state.tokens.find(t => t.kind !== actor.kind)!;
  actor.x = 8; actor.y = 7; target.x = 9; target.y = 7;
  act(state, gm, "attack", { tokenId: actor.id, targetId: target.id });
  target.hp = target.maxHp;
  assert.equal(state.combat.actionUsed, true);
  assert.throws(() => act(state, gm, "attack", { tokenId: actor.id, targetId: target.id }), /already used/);
});
test("friendly fire and walls block attacks", () => {
  const state = fresh(); act(state, gm, "combat", { mode: "start" });
  state.combat.order = ["companion-finn", "companion-eira", "goblin-1", "goblin-2"]; state.combat.turnIndex = 0;
  assert.throws(() => act(state, gm, "attack", { tokenId: "companion-finn", targetId: "companion-eira" }), /Friendly fire/);
  const finn = state.tokens[1], target = state.tokens[2]; finn.x = 3; finn.y = 3; target.x = 8; target.y = 3;
  assert.throws(() => act(state, gm, "attack", { tokenId: finn.id, targetId: target.id }), /wall/);
});
test("retrying the same action does not duplicate a roll", () => {
  const state = fresh();
  const action = act(state, gm, "roll", { sides: 20, modifier: 3, advantage: "advantage" });
  const count = state.log.length; applyAction(state, gm, action); assert.equal(state.log.length, count);
});
test("public snapshots never expose session token hashes or internal action ledger", () => {
  const state = fresh(); player(state); act(state, gm, "chat", { text: "Hello" });
  const snapshot = publicState(state), serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes("never-public"), false); assert.equal(serialized.includes("also-secret"), false);
  assert.equal("processed" in snapshot, false); assert.equal(state.members[0].tokenHash, "never-public");
});
test("rule inputs and dice ranges are validated", () => {
  const state = fresh();
  assert.throws(() => act(state, gm, "rules", { friendlyFire: "false", allowDiagonal: true, movementLimit: 30, narrative: "" }), /settings/);
  assert.throws(() => act(state, gm, "rules", { friendlyFire: false, allowDiagonal: true, movementLimit: 31, narrative: "" }), /multiple/);
  assert.throws(() => act(state, gm, "roll", { sides: 7 }), /polyhedral/);
  assert.throws(() => act(state, gm, "roll", { sides: 6, advantage: "advantage" }), /d20/);
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) for (let n = 0; n < 200; n++) { const result = die(sides); assert.ok(result >= 1 && result <= sides); }
});
test("new players cannot join during combat and capacity is enforced", () => {
  const state = fresh(); act(state, gm, "combat", { mode: "start" });
  assert.throws(() => player(state), /end combat/);
  act(state, gm, "combat", { mode: "end" });
  for (let n = 0; n < 7; n++) player(state);
  assert.throws(() => player(state), /full/);
});
