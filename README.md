# Hearthbound — v0.4 test edition

Hearthbound is a shared visual fantasy tabletop for one Game Master and up to seven players. Everyone at a table explores the same persistent map, with character sheets, dice, turns, narration and GM-controlled rules.

Choose **D&D 2014 · SRD 5.1** or **D&D 2024 · SRD 5.2.1** when creating a campaign. Both complete official SRDs are included: **403 + 364 = 767 pages**, with searchable text and original PDFs available locally. A campaign keeps its selected edition across app updates.

**Complete reference coverage is not complete rules automation.** The app implements the mechanics below; the human GM resolves the remaining rules using the sourcebooks. The SRDs do not contain every published D&D book, subclass or supplement. See [RULES-LICENSE.md](RULES-LICENSE.md) for sources, Creative Commons attribution and extraction notes.

## Windows testing and updates

Download **Hearthbound-Windows-test.zip** from [Releases](https://github.com/sjorswakka-sketch/hearthbound/releases), extract it fully, and double-click **START-HEARTHBOUND.cmd**. Install Node.js 24 first. Initial setup downloads dependencies and builds the local app; keep the launcher open while playing. This is a source-based test package, not a standalone EXE.

For an update, stop the old version and extract the new release into a new folder. Campaign data stays in `%LOCALAPPDATA%\Hearthbound`. Keep the same browser and `http://127.0.0.1:8787` address, and save your personal recovery code before switching browsers. See [TESTING-WINDOWS.md](TESTING-WINDOWS.md).

For friends on the same home Wi-Fi or Ethernet, one person runs **START-LAN-GAME.cmd** instead. The launcher shows the host's network address and opens it in the host's browser. Everyone else opens that address in a browser; only the host needs to install Hearthbound and Node.js. Keep the host running. This uses HTTP on a trusted home network; it is not internet hosting and does not configure your firewall or router. See [the multiplayer instructions](TESTING-WINDOWS.md#playing-in-the-same-world).

The [GitHub repository](https://github.com/sjorswakka-sketch/hearthbound) is public. The hosted Site currently remains private to its owner. Remote players need access to the same hosted server URL. Separate Windows hosts have separate worlds; a release download, table code or invitation does not grant hosted site access.

## Start a session

1. Enter your GM name and choose **Design your world**. Name the campaign, write your own opening and preview a generated map, a blank canvas or an authored template. Choose its rules edition. New tables require an invitation; share it from **Adventure desk → Session**.
2. Players join from separate browser sessions and choose one of twelve classes. The GM reviews each starting profile against the selected SRD.
3. Open **Adventure desk → Session** and privately save your personal recovery code. Each participant has their own code.
4. Use the GM panel to publish opening narration and **Set Rule** for movement, friendly fire and house rules.
5. Use **Adventure desk** for Rulebooks, Character and Actions. Select a map token to move, attack or interact with an adjacent door or chest.
6. The GM can edit maps, create scenes, reveal areas, keep private notes, and start or advance encounters. Players can end their own active turn. End combat before changing scenes, editing terrain or assigning heroes.
7. In **Session**, the GM can replace an invitation, close or reopen joining, assign heroes, remove a player and download a private campaign archive. Removing a player also closes joining and preserves their hero under GM control.

For a multiplayer check on one computer, use a normal browser for the GM and a private window for a player. Updates appear after a short polling delay.

## What v0.4 supports

- **Characters:** all twelve single-class starting profiles, GM-controlled levels 1–20 and ability/skill setup, derived statistics, inventory notes and character behavior notes. The GM can adjust statistics with a recorded reason.
- **Core play:** authoritative movement, walls, water and closed doors; initiative, attacks, armor class, critical damage and supported Extra Attack progression; ability/skill checks, saves and advantage/disadvantage.
- **Resources:** action, bonus action and reaction tracking; Dash, Dodge, Disengage, Help, Ready and standing from prone; conditions with selected mechanical effects, edition-specific exhaustion, death saves and GM-approved HP changes/revival.
- **Spellcasting and rests:** eight spells with GM-approved access and automatic supported outcomes: Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Magic Missile, Inflict Wounds, Burning Hands and Fireball. Includes edition-specific effects, upcasting, cantrip scaling, attacks/saves, HP changes, concentration checks, slot/action use and map targeting. Other spells retain a manual resource tracker. Single-class spell/Pact Magic slots, Hit Dice and GM-granted rest recovery remain available.
- **Creative starts:** your own campaign name and shared opening premise; generated layouts with fresh variations, a blank canvas, or an authored template. Choose the setting, arrangement, density and optional example encounters. Sample heroes are opt-in. Preview and reroll before creation; use a saved seed to repeat an intentional layout. The generator does not interpret free text or use AI.
- **World building:** up to twelve persistent scenes with harbor, forest, crypt, tavern, cavern and ruins templates; terrain/object painting, creature placement and area fog brushes. Scene travel carries the party together and preserves terrain, objects, creatures, narration, theme and ambience. Shared map pings briefly highlight a location for the group.
- **Privacy:** GM-controlled fog with server-filtered concealed terrain, objects and creatures, private GM notes, and hidden-scene filtering. Players cannot act on unrevealed destinations or targets. Shared chat and narration remain public to the table.
- **Sessions:** database persistence, concurrent update checks, revocable invitations, joining locks, hero assignment, player removal, rotating private recovery codes and supported hosted-account recovery. GM archives omit access credentials; importing an archive is not yet supported.
- **Reference and assistance:** both complete offline SRDs, plus an optional GM-only AI drafting assistant when the host configures it.

## Where the GM still makes the ruling

The twelve profiles are starting sheets, not complete character builders. Origins/species, backgrounds, subclasses, feats, multiclassing, many class features and equipment effects require GM review. Rebuilding a sheet recalculates statistics and resets resources; manual statistics changes last until the GM changes them again.

The eight automated spells need the GM to approve class/origin access and preparation outside combat. The caster confirms components and special traits before casting. Supported casts check range, walls, closed doors, fog and friendly-fire settings; Magic Missile supports individual dart targets. Area templates use two-dimensional tile centers: a 15-foot directional cone or a 20-foot-radius circle, with the 2014 Fireball's spread around corners. Vertical space and creature sizes are not modeled. Resistances, immunities, Shield, Counterspell, special senses and object fires still need a GM ruling. Use the manual casting tracker and GM adjustments for unsupported interactions or other spells; that tracker only spends declared resources.

Inventory entries do not automatically equip, consume or grant items. Opening a chest is a story event. Scene creatures are editable examples, not complete SRD monster stat blocks.

Condition handling is partial. Cover, line of sight, automatic lighting/vision, opportunity-attack triggers, detailed grappling, feature durations and many special interactions need a ruling. Help and Ready track action use; their precise effects and triggers are manual. Rest eligibility, elapsed time, daily limits and additional feature recovery are also manual. Free-text house rules and character behavior are guidance, not executable instructions.

Fog is manually revealed by the GM; it does not calculate individual sight or darkvision. Character notes on visible tokens are shared, so put secrets in **Private GM notes**. With fog enabled, non-public mechanical logs are withheld from players to avoid revealing concealed information. History retains the most recent 100 log entries.

Map generation is procedural: the same seed and settings reproduce a layout, while a fresh seed changes its geometry and placements. It does not generate adventures from the meaning of a prompt, simulate arbitrary fantasy settings, or change D&D rules. Your premise is shared verbatim and the GM builds on it. Existing campaigns and edited maps stay as saved until the GM creates or edits a location.

The optional AI assistant drafts narration, NPC dialogue or rules discussion for GM review. It does not automatically build maps, act for characters or apply game changes. It stays disabled without host configuration; play and rulebooks work without AI. Provider access, available credits and usage costs depend on the host's provider account.

## Restore your place

Choose **Restore** on the welcome screen, enter the table code and your private recovery code. Restoration preserves your role and character, rotates both credentials, and invalidates the old session. Save the replacement code from **Adventure desk → Session**. Recovery still works while joining is closed. Share invitations with your group; keep your recovery code private.

On a hosted server that supplies authenticated account identity, leaving the recovery field blank can restore a single linked seat. If the account has no linked seat or multiple seats in that campaign, use the personal code. Local and LAN play need the code. Older campaigns may have no saved recovery code; use their original browser session to generate one in **Session**. Switching tables preserves this browser's saved sessions. Moving between a loopback address and a LAN address uses separate browser storage, so restore your seat with its private code.

Existing campaigns remain joinable by table code until the GM creates an invitation. Replacing an invitation revokes the previous link without disconnecting current players. Removing a seat revokes its session and recovery code and closes joining; replace the invitation before deliberately reopening to a new group. This is seat removal, not an account ban. Archives contain private GM notes and hidden scenes, so keep them private. They are readable exports, not restorable backups; the host's database remains the saved game.

## Continue development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup and checks, and [BUILD_PROMPT.md](BUILD_PROMPT.md) for the broader vision. Existing legacy campaigns retain their prototype rules rather than silently changing edition. Remaining work includes broader rules automation, structured character choices, richer vision, archive import, longer history and stronger controls for public hosting.

Successful `main` checks produce a Windows testing artifact; version tags produce release downloads. GitHub pushes and hosted Site deployments are separate, so publishing a test build does not redeploy the hosted app.
