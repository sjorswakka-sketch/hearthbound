# Development

Node 24 is recommended (the API tests use Node's native TypeScript support and module hooks). The application uses React, TypeScript, Vinext, and Cloudflare D1. No AI key is required.

## Local setup

1. Install dependencies: `npm ci`.
2. Build the Worker configuration: `npm run build`.
3. Apply the initial local migration once:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_late_the_leader.sql`

4. Start the local app: `npm run dev`.
5. Open the printed local URL. Use two browser profiles for a GM and a player.

Local and hosted D1 data are separate. Never commit browser session tokens or database files. The repository ignores local runtime data, secrets, and generated builds.

## Verification

- Type check: `node node_modules/typescript/bin/tsc --noEmit`
- Mechanics and API tests: `node --test --experimental-strip-types tests/game.test.ts tests/game-api.test.ts`
- Production build: `npm run build`

Sixteen tests cover permissions, blocked movement, combat actions, dice validation, duplicate requests, concurrent updates, secret filtering, and party recovery. Live HTTP testing against the local D1 runtime also verified independent GM/player identities and shared movement. Browser smoke checks covered table creation, dice, and GM narration.

## Architecture and limitations

`lib/game.ts` contains pure authoritative state transitions. `app/api/game/route.ts` persists room JSON to D1 with optimistic revision checks and hashes opaque member session tokens. `app/page.tsx` polls authenticated snapshots and renders the SVG battle map. `db/schema.ts` and `drizzle/` define storage.

This is a small-table prototype with 1.2-second polling, a rolling log, bounded duplicate-action history, and simplified original character profiles. Before wide public deployment add rate limits, account recovery, revocable invitations, abuse controls, archival history, and privacy-filtered snapshots. The hosting platform's access gate and app room membership are separate.

The source retains the existing Sites project identity in `.openai/hosting.json`. Reuse it when updating this app. A separate deployment needs its own hosting configuration and D1 binding. The private source repository is `sjorswakka-sketch/hearthbound`; its `origin` remote is separate from Sites' source storage. Never force-push to reconcile those two destinations.

## Windows test distribution

See `TESTING-WINDOWS.md`. `START-HEARTHBOUND.cmd` invokes `scripts/windows/start.mjs`. It installs matching dependencies, builds the app, applies tracked migrations, and serves the Worker using durable per-user data. Use `HEARTHBOUND_DATA_DIR` to isolate test data and `--prepare-only` to verify setup without launching the browser.

`.github/workflows/windows-test.yml` validates Windows setup, type checks, and tests before packaging the committed source. Successful `main` pushes produce an Actions artifact. Push a new `v*` version tag to publish a release ZIP. Do not move existing release tags; make a new version for fixes.

See `BUILD_PROMPT.md` for the complete intended product and next milestones.
