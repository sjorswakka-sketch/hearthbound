import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { GameState, Member } from "../lib/game";

// Exercise the real route, replacing only Cloudflare's unavailable local binding.
// Each query yields like a remote D1 request, so parallel actions race on revisions.
type Row = { code: string; revision: number; state_json: string };
type ApiSnapshot = { room: string; token?: string; state: GameState; me: Member; error?: string };
const rows = new Map<string, Row>();
const binding = {
  prepare(sql: string) {
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async first() {
        const row = rows.get(String(values[0])); await Promise.resolve();
        return row ? structuredClone(row) : null;
      },
      async run() {
        await Promise.resolve();
        if (sql.startsWith("INSERT")) {
          const [code, revision, stateJson] = values;
          if (rows.has(String(code))) return { meta: { changes: 0 } };
          rows.set(String(code), { code: String(code), revision: Number(revision), state_json: String(stateJson) });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE")) {
          const [stateJson, revision, , code, previous] = values, row = rows.get(String(code));
          if (!row || row.revision !== previous) return { meta: { changes: 0 } };
          rows.set(String(code), { code: String(code), revision: Number(revision), state_json: String(stateJson) });
          return { meta: { changes: 1 } };
        }
        throw new Error(`Unexpected query ${sql}`);
      },
    };
  },
};
(globalThis as unknown as { __testGameEnv: unknown }).__testGameEnv = { DB: binding };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__testGameEnv", shortCircuit: true };
  if (specifier === "@/lib/game") return { url: new URL("../lib/game.ts", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
// @ts-ignore native Node TypeScript imports for tests.
const { GET, POST } = await import("../app/api/game/route.ts");
async function post(body: unknown, token?: string) {
  const response = await POST(new Request("http://localhost/api/game", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() as ApiSnapshot };
}
const action = (type: string, fields: Record<string, unknown> = {}) => ({ id: crypto.randomUUID(), type, ...fields });
test("API protects campaigns, assigns GM authority only on creation, and strips secrets", async () => {
  const created = await post({ type: "create", name: "GM" }); assert.equal(created.status, 201);
  const { room, token } = created.body;
  assert.equal(created.body.me.role, "gm");
  const unauthenticated = await GET(new Request(`http://localhost/api/game?room=${room}`)); assert.equal(unauthenticated.status, 401);
  const joined = await post({ type: "join", room, name: "Mira", characterClass: "rogue", role: "gm" });
  assert.equal(joined.status, 201); assert.equal(joined.body.me.role, "player");
  assert.equal(JSON.stringify(joined.body.state).includes("tokenHash"), false);
  const forbidden = await post({ type: "action", room, action: action("opening", { text: "Hacked" }) }, joined.body.token);
  assert.equal(forbidden.status, 403);
  const allowed = await post({ type: "action", room, action: action("opening", { text: "Welcome to the harbor." }) }, token);
  assert.equal(allowed.status, 200); assert.equal(allowed.body.state.narrative, "Welcome to the harbor.");
  const other = await post({ type: "create", name: "Other GM" });
  const wrongRoom = await post({ type: "action", room, action: action("chat", { text: "Wrong table" }) }, other.body.token);
  assert.equal(wrongRoom.status, 403);
});
test("concurrent route actions retain both changes with sequential revisions", async () => {
  const created = await post({ type: "create", name: "GM" }); const { room, token } = created.body;
  const actions = ["First message", "Second message", "Third message"].map(text => post({ type: "action", room, action: action("chat", { text }) }, token));
  const results = await Promise.all(actions); assert.ok(results.every(r => r.status === 200));
  const response = await GET(new Request(`http://localhost/api/game?room=${room}`, { headers: { Authorization: `Bearer ${token}` } }));
  const saved = await response.json() as ApiSnapshot; assert.equal(saved.state.revision, 3);
  for (const text of ["First message", "Second message", "Third message"]) assert.ok(saved.state.log.some((entry: { text: string }) => entry.text.includes(text)));
});
test("simultaneous duplicate retries commit an action only once", async () => {
  const created = await post({ type: "create", name: "GM" }); const { room, token } = created.body;
  const request = { type: "action", room, action: action("roll", { sides: 20 }) };
  const results = await Promise.all([post(request, token), post(request, token)]);
  assert.ok(results.every(r => r.status === 200));
  const saved = JSON.parse(rows.get(room)!.state_json);
  assert.equal(saved.revision, 1); assert.equal(saved.log.filter((entry: { kind: string }) => entry.kind === "dice").length, 1);
});
