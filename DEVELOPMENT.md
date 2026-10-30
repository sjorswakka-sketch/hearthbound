# Development

Use Node.js 24. The app uses React, TypeScript, Vinext and Cloudflare D1; tests use Node's native TypeScript support and module hooks. The game and bundled SRDs require no AI credentials.

## Local setup

1. Install dependencies: `npm ci`.
2. Build the Worker configuration: `npm run build`.
3. Apply the local database migration:

   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_late_the_leader.sql`

4. Run `npm run dev` and open its printed URL. Use separate browser profiles for the GM and player.

For the release-style server, use `START-HEARTHBOUND.cmd` on Windows. Its launcher handles dependencies, builds and tracked migrations. Data lives in `%LOCALAPPDATA%\Hearthbound`, separately from development and hosted D1 data. Set `HEARTHBOUND_DATA_DIR` to isolate tests; `node scripts/windows/start.mjs --prepare-only` validates setup without opening a browser.

`START-LAN-GAME.cmd` opts into `--lan`, binding the same server and database to `0.0.0.0:8787` and displaying private IPv4 addresses. Only the host installs the package; other people on the same trusted home network open its URL in a browser. The default launcher remains loopback-only. LAN transport is HTTP; no firewall rules or router mappings are changed. This is not a public internet deployment. Both Windows modes set `HEARTHBOUND_LOCAL_MODE=true` so client-supplied account identity headers cannot restore seats.

## Verification

```text
node node_modules/typescript/bin/tsc --noEmit
npm test
npm run build
```

`npm test` uses `scripts/run-tests.mjs` to discover every top-level `tests/*.test.ts` and `tests/*.test.mjs` file, including on Windows. Tests cover permissions, movement, turn/resources, edition differences, spell targeting and effects, death and concentration, replay/concurrency, fog privacy, persistent scenes, pings, invitation rotation, joining locks, ownership, removal, credential rotation, sanitized archives, assistant access without configuration, all 767 reference pages and Windows helpers. See [TESTING-WINDOWS.md](TESTING-WINDOWS.md) for a manual multiplayer checklist. Do not make live paid AI calls in the default test suite.

After starting the local server, run `node scripts/smoke-multiplayer.mjs` (defaults to `http://127.0.0.1:5173`), or pass `http://127.0.0.1:8787` for a Windows launcher instance. This real HTTP check creates one persistent test campaign and exercises GM/player synchronization, invitations, locks, permissions, restoration, credential rotation, export and removal. It rejects external hosts and redirects, does not call AI, and keeps credentials in memory without printing them. It does not start or stop the server. Use an isolated development database when test campaigns are unwanted in your regular saved games.

## Code and data

| Area | Responsibility |
| --- | --- |
| `lib/game.ts` | Authoritative base actions, turns, attacks and legacy-state normalization |
| `lib/characters.ts`, `lib/rules-engine.ts`, `lib/spells.ts` | Twelve single-class profiles, scaling resources, eight supported spells and edition-specific mechanics |
| `lib/world.ts`, `lib/scenes.ts` | Six scene templates, persistence, GM editing, pings, private notes and per-member fog/action checks |
| `lib/session.ts` | Invitations, joining locks, hero ownership, player removal and sanitized campaign archives |
| `lib/campaign-store.ts`, `app/api/game/route.ts` | D1 persistence, revision checks, hashed credentials, account recovery and management endpoints |
| `app/api/assistant/route.ts` | Optional GM-only OpenAI drafting with a per-room cooldown |
| `app/page.tsx`, `components/hearthbound-desk.tsx` | SVG map, polling and adventure tools |
| `public/rules/`, `lib/rules-library.ts` | Complete local SRDs, page text, metadata and reference helpers |
| `db/schema.ts`, `drizzle/` | Storage and migrations |

New campaigns pin `srd-5.1` or `srd-5.2.1`; unversioned campaigns normalize to `prototype` while retaining statistics. Do not silently upgrade rules editions. The table supports one GM, seven players and twelve scenes, with 1.2-second polling, a rolling 100-entry log and bounded replay history.

Session tokens, recovery codes and invitation codes are private bearer credentials; only hashes are stored in campaign state. Recovery rotates both seat credentials. Invitation rotation preserves the joining lock and invalidates the old invitation without revoking existing seats. Snapshots whitelist identity fields and expose only `locked`, `inviteRequired` and `inviteVersion` for session settings. Hosted account recovery uses the host-supplied authenticated identity and requires exactly one matching seat. A deployment must ensure this identity header is set by its trusted host, not accepted from arbitrary client input. Local/LAN configuration ignores that header entirely.

New frontend-created tables send `requireInvite:true`; the create API defaults to open joining for backward compatibility. Existing campaigns remain open until the GM enables invitations. `POST /api/game` with `type:'invite'` creates or replaces an invitation and returns its raw code once. `type:'action'` with `action.type:'session'` supports `lock`, `assign` and `remove`, all GM-only. Removing a seat also locks joining, deletes its credentials and leaves its hero unowned. Assignment preserves hero resources, allows one hero per member and requires combat to end. Mutations use D1 revision comparisons; session actions retain the bounded replay ledger.

GM-only `GET /api/game?room=CODE&download=campaign` returns a versioned JSON attachment, bounded to 2 MB. It preserves hidden scenes and private notes but strips session/recovery/account/invitation hashes, replay history and ephemeral pings. No import exists yet; do not describe these readable archives as restorable backups. Protect host database backups separately.

Fog filtering happens on the server. Hidden terrain, objects, tokens/sheets, inactive scene details and mechanical logs must never leak through player snapshots or initiative. Visible token notes are shared; `world.gmNotes` is GM-only. Keep visibility tests alongside new action or log types.

## Reference coverage and automation

Complete SRD 5.1 (403 pages) and SRD 5.2.1 (364 pages) are committed with source URLs, hashes and CC BY 4.0 attribution; see [RULES-LICENSE.md](RULES-LICENSE.md). Original PDFs remain authoritative for layout and tables; extracted text may retain source hyphenation. Python is not required to play or build.

To regenerate text from the committed PDFs, install Python and `pypdf`, then run `python scripts/import-srd.py`. Add `--download` only when deliberately fetching the pinned official sources again. Run library integrity tests afterwards. Keep both PDFs and JSON in Windows packages for offline reference access.

Automated mechanics are bounded: movement, checks, attacks, turn resources, selected condition effects, exhaustion, death saves, concentration, single-class slots/rest resources and eight spells: Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Magic Missile, Inflict Wounds, Burning Hands and Fireball. GM-approved spell access/preparation and caster confirmation of components/special traits precede automated resolution. Range, walls, closed doors, fog and friendly fire constrain targeting. Areas use two-dimensional tile-center geometry; 2014 Fireball spreads around corners, and Magic Missile supports per-dart allocation. Keep edition-specific healing dice, Inflict Wounds resolution, upcasting and cantrip scaling covered by tests.

Reference coverage does not mean every rule executes automatically. Origins, subclasses, feats, multiclassing, many features, unsupported spell effects, equipment effects, cover/vision and unusual interactions remain GM-adjudicated. Resistances, immunities, Shield, Counterspell, special senses, components and object fires need manual resolution; creature size and vertical space are not modeled. Scene creatures are editable examples rather than SRD stat blocks. Manual statistics changes have no automatic expiration. Preserve these distinctions in UI and release notes.

## Optional AI configuration

Configure `OPENAI_API_KEY` as a server secret and `OPENAI_MODEL` as the host's chosen accessible model in the Worker environment. Never place credentials in browser code, a ZIP, Git or screenshots. Local environment files are ignored. With either setting absent, availability returns false and GM requests receive a clear 503; players receive 403.

The route sends the GM prompt, campaign title, narration, rules edition and house rules to the provider. It requests text with `store: false`, a 1,000-token output limit and a 40-second timeout. Text stays a draft until the GM shares it; it never executes game actions. Rules discussions do not automatically retrieve the full SRDs, so the GM must verify exact wording in the library. Model access, quota, credits and charges depend on the configured provider account.

## Distribution and further work

Before broad public hosting, add stronger abuse/rate controls and a tested database backup/import strategy. Invitations, removal and credential-free readable archives are available in v0.3; import and durable full history remain future work. Room membership and the hosting platform's access gate are separate. The LAN launcher is for a trusted home network, not a substitute for authenticated HTTPS hosting.

Reuse `.openai/hosting.json` when updating this Site. Another deployment needs its own hosting configuration and D1 binding. The public repository is `sjorswakka-sketch/hearthbound`; `origin` is separate from Sites source storage. The hosted Site remains owner-private until its sharing settings are changed. Do not force-push to reconcile the two source destinations.

`.github/workflows/windows-test.yml` validates Windows setup and packages committed source. Successful `main` pushes provide an Actions artifact; new `v*` tags publish a release ZIP. Do not move released tags. GitHub packaging does not redeploy the Site. Never commit credentials, local databases or generated dependencies.

## Procedural campaign creation (v0.4)

`lib/world-generator.ts` is a deterministic, bounded layout generator shared by the preview and server. It uses a separate seeded PRNG; actual game dice retain cryptographic randomness. Blank maps have no objects or encounters. Generated maps reserve party arrival space and keep usable floor connected. Inputs are validated server-side before changing a campaign; previews never mutate saved worlds.

New UI campaigns send an explicit campaign configuration. Older clients that omit it preserve the legacy start, and existing saved campaigns keep their worlds. The campaign premise is public narration, not a program or AI instruction. Generation metadata is GM-only so players cannot reconstruct fogged maps from the seed. Keep source tests for layout variety, reproducibility, placement, connectivity, invalid inputs and privacy when changing the algorithm.
