import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { GameState, Member } from "../lib/game";

// Exercise the real route, replacing only Cloudflare's unavailable local binding.
// Each query yields like a remote D1 request, so parallel actions race on revisions.
type Row = { code: string; revision: number; state_json: string };
type ApiSnapshot = { room: string; token?: string; recoveryCode?: string; state: GameState; me: Member; error?: string };
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
  if (specifier.startsWith("@/lib/")) return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith("./") && context.parentURL?.includes('/lib/') && !/\.[a-z]+$/.test(specifier)) return {url:new URL(specifier+'.ts',context.parentURL).href,shortCircuit:true};
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

test('recovery rotates both private credentials and invalidates the old session', async () => {
  const created = await post({ type: 'create', name: 'Recovery GM', ruleSetId: 'srd-5.1' });
  const { room, token, recoveryCode } = created.body;
  assert.match(recoveryCode!, /^[a-f0-9]{64}$/);
  const initial = await GET(new Request(`http://localhost/api/game?room=${room}`, { headers: { Authorization: `Bearer ${token}` } }));
  const initialBody = await initial.json() as ApiSnapshot;
  assert.equal(initialBody.state.ruleSetId, 'srd-5.1');
  assert.equal(initialBody.recoveryCode, undefined);
  for (const field of ['tokenHash', 'recoveryHash', 'accountHash']) assert.ok(!JSON.stringify(initialBody).includes(field));
  const wrong = await post({ type: 'recover', room, recoveryCode: 'not-the-private-code' });
  assert.equal(wrong.status, 403);
  const recovered = await post({ type: 'recover', room, recoveryCode });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.me.id, created.body.me.id);
  assert.equal(recovered.body.me.role, 'gm');
  assert.notEqual(recovered.body.token, token);
  assert.notEqual(recovered.body.recoveryCode, recoveryCode);
  const oldSession = await GET(new Request(`http://localhost/api/game?room=${room}`, { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(oldSession.status, 403);
  const oldRecovery = await post({ type: 'recover', room, recoveryCode });
  assert.equal(oldRecovery.status, 403);
  const currentSession = await GET(new Request(`http://localhost/api/game?room=${room}`, { headers: { Authorization: `Bearer ${recovered.body.token}` } }));
  assert.equal(currentSession.status, 200);
});

test('a player recovery code preserves the player role and cannot select a GM seat', async () => {
  const created = await post({ type: 'create', name: 'Seat GM' });
  const room = created.body.room;
  const player = await post({ type: 'join', room, name: 'Seat Player', characterClass: 'bard' });
  const recovered = await post({ type: 'recover', room, recoveryCode: player.body.recoveryCode, memberId: created.body.me.id, role: 'gm' });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.me.id, player.body.me.id);
  assert.equal(recovered.body.me.role, 'player');
  const denied = await post({ type: 'action', room, action: action('world', { op: 'notes', text: 'Not authorized' }) }, recovered.body.token);
  assert.equal(denied.status, 403);
  const gmStillWorks = await GET(new Request(`http://localhost/api/game?room=${room}`, { headers: { Authorization: `Bearer ${created.body.token}` } }));
  assert.equal(gmStillWorks.status, 200);
});

test('issuing a fresh recovery code requires the current seat credential', async () => {
  const created = await post({ type: 'create', name: 'Code GM' });
  const denied = await post({ type: 'recoveryCode', room: created.body.room });
  assert.equal(denied.status, 401);
  const renewed = await post({ type: 'recoveryCode', room: created.body.room }, created.body.token);
  assert.equal(renewed.status, 200);
  assert.match(renewed.body.recoveryCode!, /^[a-f0-9]{64}$/);
  assert.notEqual(renewed.body.token, created.body.token);
});

test('account recovery identifies one linked seat and rejects wrong or ambiguous accounts', async () => {
  const withAccount = async (body: unknown, account: string) => {
    const response = await POST(new Request('http://localhost/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': account }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() as ApiSnapshot };
  };
  const created = await withAccount({ type: 'create', name: 'Account GM' }, 'trusted-host-account-gm');
  const room = created.body.room;
  assert.equal(created.status, 201);
  assert.ok(!JSON.stringify(created.body).includes('trusted-host-account-gm'));
  assert.ok(!JSON.stringify(created.body).includes('accountHash'));
  const wrong = await withAccount({ type: 'recover', room }, 'trusted-host-unrelated-account');
  assert.equal(wrong.status, 403);
  const recovered = await withAccount({ type: 'recover', room }, 'trusted-host-account-gm');
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.me.id, created.body.me.id);
  assert.equal(recovered.body.me.role, 'gm');
  await withAccount({ type: 'join', room, name: 'Second seat', characterClass: 'rogue' }, 'trusted-host-account-gm');
  const ambiguous = await withAccount({ type: 'recover', room }, 'trusted-host-account-gm');
  assert.equal(ambiguous.status, 403);
  const specific = await post({ type: 'recover', room, recoveryCode: recovered.body.recoveryCode });
  assert.equal(specific.status, 200);
  assert.equal(specific.body.me.id, created.body.me.id);
});

test('the assistant is GM-only and fails honestly without host configuration', async () => {
  // @ts-ignore native Node TypeScript imports for tests.
  const assistant = await import('../app/api/assistant/route.ts');
  const created = await post({ type: 'create', name: 'Assistant GM' });
  const player = await post({ type: 'join', room: created.body.room, name: 'Assistant player', characterClass: 'wizard' });
  const call = (token: string | undefined) => assistant.POST(new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ room: created.body.room, mode: 'narration', prompt: 'Describe the harbor.' }) }));
  assert.equal((await call(player.body.token)).status, 403);
  const missing = await call(created.body.token);
  assert.equal(missing.status, 503);
  assert.match((await missing.json() as { error: string }).error, /not enabled by this host/);
  const availability = await assistant.GET(new Request(`http://localhost/api/assistant?room=${created.body.room}`, { headers: { Authorization: `Bearer ${created.body.token}` } }));
  assert.equal(availability.status, 200);
  assert.deepEqual(await availability.json(), { available: false });
});

test('configured assistant returns a private draft with one mocked provider request and no game effects', async t => {
  // The fake provider replaces fetch completely: this test cannot call a live API.
  // @ts-ignore native Node TypeScript imports for tests.
  const assistant = await import('../app/api/assistant/route.ts');
  const env = (globalThis as unknown as { __testGameEnv: { OPENAI_API_KEY?: string; OPENAI_MODEL?: string } }).__testGameEnv;
  const previousKey = env.OPENAI_API_KEY, previousModel = env.OPENAI_MODEL;
  env.OPENAI_API_KEY = 'test-only-provider-key-never-real';
  env.OPENAI_MODEL = 'test-only-model';
  t.after(() => {
    if (previousKey === undefined) delete env.OPENAI_API_KEY; else env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete env.OPENAI_MODEL; else env.OPENAI_MODEL = previousModel;
  });
  const providerCalls: { url: string; method?: string; headers: Headers; body: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    providerCalls.push({ url: String(input), method: init?.method, headers: new Headers(init?.headers), body: String(init?.body) });
    return Response.json({ output: [
      { type: 'reasoning', content: [{ type: 'output_text', text: 'Not a player-facing message.' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'Draft: violet lanterns illuminate the harbor.' }, { type: 'output_text', text: 'A ferryman waits by the pier.' }] },
    ] });
  });
  const createdResponse = await POST(new Request('http://localhost/api/game', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'private-test-account' },
    body: JSON.stringify({ type: 'create', name: 'Draft GM', ruleSetId: 'srd-5.2.1' }),
  }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as ApiSnapshot;
  const privateNotes = 'Hidden GM plan: the ferryman is the villain.';
  const noted = await post({ type: 'action', room: created.room, action: action('world', { op: 'notes', text: privateNotes }) }, created.token);
  assert.equal(noted.status, 200);
  const before = JSON.parse(rows.get(created.room)!.state_json);
  const available = await assistant.GET(new Request(`http://localhost/api/assistant?room=${created.room}`, { headers: { Authorization: `Bearer ${created.token}` } }));
  assert.deepEqual(await available.json(), { available: true });
  const call = () => assistant.POST(new Request('http://localhost/api/assistant', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.token}` },
    body: JSON.stringify({ room: created.room, mode: 'narration', prompt: 'Describe the harbor at night.' }),
  }));
  // The persisted revision/cooldown must protect even overlapping GM requests.
  const concurrent = await Promise.all([call(), call()]);
  assert.equal(concurrent.filter(response => response.status === 200).length, 1);
  assert.equal(concurrent.filter(response => [409, 429].includes(response.status)).length, 1);
  const draft = await concurrent.find(response => response.status === 200)!.json();
  assert.deepEqual(draft, { text: 'Draft: violet lanterns illuminate the harbor.\nA ferryman waits by the pier.', applied: false });
  assert.equal((await call()).status, 429);
  assert.equal(providerCalls.length, 1, 'only one provider request may pass the room cooldown');

  const sent = providerCalls[0], body = JSON.parse(sent.body), input = JSON.parse(body.input);
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.get('Authorization'), `Bearer ${env.OPENAI_API_KEY}`);
  assert.equal(sent.headers.get('Content-Type'), 'application/json');
  assert.equal(body.model, 'test-only-model');
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 1000);
  assert.deepEqual(input, { mode: 'narration', campaign: { ruleset: before.ruleSetId, title: before.title, narrative: before.narrative, houseRules: before.rules.narrative }, prompt: 'Describe the harbor at night.' });
  const privateValues = [env.OPENAI_API_KEY, privateNotes, created.token, created.recoveryCode, 'private-test-account', ...before.members.flatMap((m: { tokenHash?: string; recoveryHash?: string; accountHash?: string }) => [m.tokenHash, m.recoveryHash, m.accountHash])];
  for (const secret of privateValues.filter(Boolean)) {
    assert.ok(!sent.body.includes(secret!), 'provider body must exclude private session material');
    assert.ok(!sent.url.includes(secret!), 'private values must not appear in the provider URL');
    assert.ok(!JSON.stringify(draft).includes(secret!), 'draft response must not include credentials or private notes');
  }
  for (const name of ['tokenHash', 'recoveryHash', 'accountHash', 'gmNotes']) assert.ok(!sent.body.includes(name));

  const after = JSON.parse(rows.get(created.room)!.state_json);
  assert.equal(after.revision, before.revision + 1, 'only the cooldown persistence changes the revision');
  assert.equal(typeof after.assistantRequestedAt, 'number');
  delete after.assistantRequestedAt;
  after.revision = before.revision;
  assert.deepEqual(after, before, 'draft generation must not publish narration or change game state');
  const snapshot = await GET(new Request(`http://localhost/api/game?room=${created.room}`, { headers: { Authorization: `Bearer ${created.token}` } }));
  const snapshotText = JSON.stringify(await snapshot.json());
  assert.ok(!snapshotText.includes(env.OPENAI_API_KEY));
  assert.ok(!snapshotText.includes('Draft: violet lanterns'));
});
