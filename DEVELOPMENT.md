# Development

Use Node.js 24. The app uses React, TypeScript, Vinext and Cloudflare D1; tests use Node's native TypeScript support and module hooks. The game and bundled SRDs require no AI credentials.

## Local setup

1. Install dependencies: `npm ci`.
2. Build the Worker configuration: `npm run build`.
3. Apply the local database migration:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_late_the_leader.sql`

4. Run `npm run dev` and open its printed URL. Use separate browser profiles for the GM and player.

For the release-style server, use `START-HEARTHBOUND.cmd` on Windows. Its launcher handles dependencies, builds and tracked migrations. Data lives in `%LOCALAPPDATA%\Hearthbound`, separately from development and hosted D1 data. Set `HEARTHBOUND_DATA_DIR` to isolate tests; `node scripts/windows/start.mjs --prepare-only` validates setup without opening a browser.

## Verification

```text
node node_modules/typescript/bin/tsc --noEmit
node --test --experimental-strip-types tests/game.test.ts tests/rules-engine.test.ts tests/game-api.test.ts tests/world-session.test.ts tests/rules-library.test.mjs tests/windows-launcher.test.mjs
npm run build
```

Tests cover permissions, movement, turn/resources, edition differences, death and concentration, replay/concurrency, fog privacy, persistent scenes, recovery, assistant access without configuration, all 767 reference pages and Windows helpers. See [TESTING-WINDOWS.md](TESTING-WINDOWS.md) for a manual multiplayer checklist. Do not make live paid AI calls in the default test suite.

## Code and data

| Area | Responsibility |
| --- | --- |
| `lib/game.ts` | Authoritative base actions, turns, attacks and legacy-state normalization |
| `lib/characters.ts`, `lib/rules-engine.ts` | Twelve single-class profiles, scaling resources and supported edition-specific mechanics |
| `lib/world.ts` | Scene persistence, GM map editing, private notes and per-member fog/action checks |
| `lib/campaign-store.ts`, `app/api/game/route.ts` | D1 persistence, revision checks, hashed session/recovery credentials and account recovery |
| `app/api/assistant/route.ts` | Optional GM-only OpenAI drafting with a per-room cooldown |
| `app/page.tsx`, `components/hearthbound-desk.tsx` | SVG map, polling and adventure tools |
| `public/rules/`, `lib/rules-library.ts` | Complete local SRDs, page text, metadata and reference helpers |
| `db/schema.ts`, `drizzle/` | Storage and migrations |

New campaigns pin `srd-5.1` or `srd-5.2.1`; unversioned campaigns normalize to `prototype` while retaining statistics. Do not silently upgrade rules editions. The table supports one GM, seven players and twelve scenes, with 1.2-second polling, a rolling 100-entry log and bounded replay history.

Session tokens and recovery codes are private bearer credentials; only hashes are stored in campaign state. Recovery rotates both credentials. Snapshots whitelist identity fields and exclude credential/account hashes. Hosted account recovery uses the host-supplied authenticated identity and requires exactly one matching seat. A deployment must ensure this identity header is set by its trusted host, not accepted from arbitrary client input.

Fog filtering happens on the server. Hidden terrain, objects, tokens/sheets, inactive scene details and mechanical logs must never leak through player snapshots or initiative. Visible token notes are shared; `world.gmNotes` is GM-only. Keep visibility tests alongside new action or log types.

## Reference coverage and automation

Complete SRD 5.1 (403 pages) and SRD 5.2.1 (364 pages) are committed with source URLs, hashes and CC BY 4.0 attribution; see [RULES-LICENSE.md](RULES-LICENSE.md). Original PDFs remain authoritative for layout and tables; extracted text may retain source hyphenation. Python is not required to play or build.

To regenerate text from the committed PDFs, install Python and `pypdf`, then run `python scripts/import-srd.py`. Add `--download` only when deliberately fetching the pinned official sources again. Run library integrity tests afterwards. Keep both PDFs and JSON in Windows packages for offline reference access.

Automated mechanics are bounded: movement, checks, attacks, turn resources, selected condition effects, exhaustion, death saves, concentration and single-class slots/rest resources. Reference coverage does not mean every rule executes automatically. Origins, subclasses, feats, multiclassing, many features, spell legality/effects, equipment effects, cover/vision and unusual interactions remain GM-adjudicated. Manual statistics changes have no automatic expiration. Preserve this distinction in UI and release notes.

## Optional AI configuration

Configure `OPENAI_API_KEY` as a server secret and `OPENAI_MODEL` as the host's chosen accessible model in the Worker environment. Never place credentials in browser code, a ZIP, Git or screenshots. Local environment files are ignored. With either setting absent, availability returns false and GM requests receive a clear 503; players receive 403.

The route sends the GM prompt, campaign title, narration, rules edition and house rules to the provider. It requests text with `store: false`, a 1,000-token output limit and a 40-second timeout. Text stays a draft until the GM shares it; it never executes game actions. Rules discussions do not automatically retrieve the full SRDs, so the GM must verify exact wording in the library. Model access, quota, credits and charges depend on the configured provider account.

## Distribution and further work

Before broad public hosting, add stronger abuse/rate controls, revocable invitations, player removal and durable archive/export tools. Room membership and the hosting platform's access gate are separate.

Reuse `.openai/hosting.json` when updating this Site. Another deployment needs its own hosting configuration and D1 binding. The public repository is `sjorswakka-sketch/hearthbound`; `origin` is separate from Sites source storage. The hosted Site remains owner-private until its sharing settings are changed. Do not force-push to reconcile the two source destinations.

`.github/workflows/windows-test.yml` validates Windows setup and packages committed source. Successful `main` pushes provide an Actions artifact; new `v*` tags publish a release ZIP. Do not move released tags. GitHub packaging does not redeploy the Site. Never commit credentials, local databases or generated dependencies.
