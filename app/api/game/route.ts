import { env } from "cloudflare:workers";
import { GameError, addPlayer, applyAction, cleanText, createInitialState, publicState, type Action, type GameState, type Member } from "@/lib/game";

export const dynamic = "force-dynamic";
type RoomRow = { code: string; revision: number; state_json: string };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function db() { if (!env.DB) throw new GameError("Campaign storage is not available yet. Please try again shortly.", 503); return env.DB; }
function roomCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z2-9]{6}$/.test(value.toUpperCase().trim())) throw new GameError("Enter the six-character room code.");
  return value.toUpperCase().trim();
}
async function digest(token: string) {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(data)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join(""); }
function generateCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return [...crypto.getRandomValues(new Uint8Array(6))].map(n => alphabet[n % alphabet.length]).join(""); }
async function getRoom(code: string) {
  const row = await db().prepare("SELECT code, revision, state_json FROM game_rooms WHERE code = ?").bind(code).first<RoomRow>();
  if (!row) throw new GameError("That table was not found. Check the room code.", 404);
  return { row, state: JSON.parse(row.state_json) as GameState };
}
async function identity(request: Request, state: GameState): Promise<Member> {
  const header = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(header)) throw new GameError("Join this table to continue.", 401);
  const hash = await digest(header.slice(7));
  const member = state.members.find(m => m.tokenHash === hash);
  if (!member) throw new GameError("This session does not have access to that table.", 403);
  return member;
}
function snapshot(state: GameState, member: Member) {
  const { tokenHash: _secret, ...me } = member;
  return { room: state.room, state: publicState(state), me };
}
async function save(state: GameState, revision: number): Promise<boolean> {
  state.revision = revision + 1;
  const result = await db().prepare("UPDATE game_rooms SET state_json = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?")
    .bind(JSON.stringify(state), state.revision, new Date().toISOString(), state.room, revision).run();
  return result.meta.changes === 1;
}
function failure(error: unknown) {
  if (error instanceof GameError) return reply({ error: error.message }, error.status);
  console.error("Campaign request failed:", error);
  return reply({ error: "The table could not be updated. Your last saved campaign is safe. Please retry." }, 500);
}
export async function GET(request: Request) {
  try {
    const code = roomCode(new URL(request.url).searchParams.get("room"));
    const { state } = await getRoom(code); const member = await identity(request, state);
    return reply(snapshot(state, member));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const raw = await request.text(); if (raw.length > 16000) throw new GameError("That request is too large.", 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new GameError("Invalid request."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new GameError("Invalid request.");
    if (body.type === "create") {
      const name = cleanText(body.name, 30) || "Game Master", token = randomToken();
      const member: Member = { id: crypto.randomUUID(), name, role: "gm", tokenHash: await digest(token) };
      for (let n = 0; n < 5; n++) {
        const code = generateCode(), state = createInitialState(code, member);
        const result = await db().prepare("INSERT INTO game_rooms (code, revision, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING")
          .bind(code, 0, JSON.stringify(state), new Date().toISOString()).run();
        if (result.meta.changes === 1) return reply({ ...snapshot(state, member), token }, 201);
      }
      throw new GameError("Could not create a table. Please retry.", 503);
    }
    if (body.type === "join") {
      const code = roomCode(body.room), name = cleanText(body.name, 30);
      if (!name) throw new GameError("Give your character a name.");
      const token = randomToken(), hash = await digest(token), memberId = crypto.randomUUID();
      for (let attempt = 0; attempt < 6; attempt++) {
        const { row, state } = await getRoom(code);
        const member: Member = { id: memberId, name, role: "player", tokenHash: hash };
        addPlayer(state, member, body.characterClass ?? body.class ?? "fighter");
        if (await save(state, row.revision)) return reply({ ...snapshot(state, member), token }, 201);
      }
      throw new GameError("The table is busy. Try joining again.", 409);
    }
    if (body.type === "action") {
      const code = roomCode(body.room), action = body.action as Action;
      if (!action || typeof action !== "object" || Array.isArray(action)) throw new GameError("An action is required.");
      for (let attempt = 0; attempt < 6; attempt++) {
        const { row, state } = await getRoom(code); const member = await identity(request, state);
        if (state.processed?.some(a => a.id === action.id && a.memberId === member.id)) return reply(snapshot(state, member));
        applyAction(state, member, action);
        if (await save(state, row.revision)) return reply(snapshot(state, member));
      }
      throw new GameError("Another player acted at the same time. Please retry your action.", 409);
    }
    throw new GameError("Unknown request.");
  } catch (error) { return failure(error); }
}
