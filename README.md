# Hearthbound — v0.2 test edition

Hearthbound is a shared visual fantasy tabletop for one Game Master and up to seven players. Everyone at a table explores the same persistent map, with character sheets, dice, turns, narration and GM-controlled rules.

Choose **D&D 2014 · SRD 5.1** or **D&D 2024 · SRD 5.2.1** when creating a campaign. Both complete official SRDs are included: **403 + 364 = 767 pages**, with searchable text and original PDFs available locally. A campaign keeps its selected edition across app updates.

**Complete reference coverage is not complete rules automation.** The app implements the mechanics below; the human GM resolves the remaining rules using the sourcebooks. The SRDs do not contain every published D&D book, subclass or supplement. See [RULES-LICENSE.md](RULES-LICENSE.md) for sources, Creative Commons attribution and extraction notes.

## Windows testing and updates

Download **Hearthbound-Windows-test.zip** from [Releases](https://github.com/sjorswakka-sketch/hearthbound/releases), extract it fully, and double-click **START-HEARTHBOUND.cmd**. Install Node.js 24 first. Initial setup downloads dependencies and builds the local app; keep the launcher open while playing. This is a source-based test package, not a standalone EXE.

For an update, stop the old version and extract the new release into a new folder. Campaign data stays in `%LOCALAPPDATA%\Hearthbound`. Keep the same browser and `http://127.0.0.1:8787` address, and save your personal recovery code before switching browsers. See [TESTING-WINDOWS.md](TESTING-WINDOWS.md).

The [GitHub repository](https://github.com/sjorswakka-sketch/hearthbound) is public, so testers can download releases or receive the ZIP directly. The hosted Site currently remains private to its owner. A multiplayer group must open **the same hosted server URL** after site access is arranged for everyone. Separate Windows installations have separate worlds. A public GitHub download or table code does not grant hosted site access.

## Start a session

1. Create a table as GM and choose its rules edition. Share the server URL and six-character table code.
2. Players join from separate browser sessions and choose one of twelve classes. The GM reviews each starting profile against the selected SRD.
3. Open **Adventure desk → Session** and privately save your personal recovery code. Each participant has their own code.
4. Use the GM panel to publish opening narration and **Set Rule** for movement, friendly fire and house rules.
5. Use **Adventure desk** for Rulebooks, Character and Actions. Select a map token to move, attack or interact with an adjacent door or chest.
6. The GM can edit maps, create scenes, reveal areas, keep private notes, and start or advance encounters. End combat before changing scenes or editing terrain.

For a multiplayer check on one computer, use a normal browser for the GM and a private window for a player. Updates appear after a short polling delay.

## What v0.2 supports

- **Characters:** all twelve single-class starting profiles, GM-controlled levels 1–20 and ability/skill setup, derived statistics, inventory notes and character behavior notes. The GM can adjust statistics with a recorded reason.
- **Core play:** authoritative movement, walls, water and closed doors; initiative, attacks, armor class, critical damage and supported Extra Attack progression; ability/skill checks, saves and advantage/disadvantage.
- **Resources:** action, bonus action and reaction tracking; Dash, Dodge, Disengage, Help, Ready and standing from prone; conditions with selected mechanical effects, edition-specific exhaustion, death saves and GM-approved HP changes/revival.
- **Spellcasting and rests:** single-class spell and Pact Magic slots, edition-specific casting restrictions, concentration saves, Hit Dice, and GM-granted short/long rest recovery.
- **World building:** up to twelve persistent scenes with harbor, forest and crypt templates; terrain/object painting and creature placement. Scene travel carries the party together and preserves each location's terrain, objects and creatures.
- **Privacy:** GM-controlled fog with server-filtered concealed terrain, objects and creatures, private GM notes, and hidden-scene filtering. Players cannot act on unrevealed destinations or targets. Shared chat and narration remain public to the table.
- **Sessions:** database persistence, concurrent update checks, per-character ownership, private recovery codes and supported hosted-account recovery.
- **Reference and assistance:** both complete offline SRDs, plus an optional GM-only AI drafting assistant when the host configures it.

## Where the GM still makes the ruling

The twelve profiles are starting sheets, not complete character builders. Origins/species, backgrounds, subclasses, feats, multiclassing, many class features and equipment effects require GM review. Rebuilding a sheet recalculates statistics and resets resources; manual statistics changes last until the GM changes them again.

Casting records a declared spell and spends resources. It does not validate preparation, components, targets, range or the spell's effects. The GM resolves those from the chosen SRD, then applies HP, condition or statistic changes. Inventory entries do not automatically equip, consume or grant items. Opening a chest is a story event.

Condition handling is partial. Cover, line of sight, automatic lighting/vision, opportunity-attack triggers, detailed grappling, feature durations and many special interactions need a ruling. Help and Ready track action use; their precise effects and triggers are manual. Rest eligibility, elapsed time, daily limits and additional feature recovery are also manual. Free-text house rules and character behavior are guidance, not executable instructions.

Fog is manually revealed by the GM; it does not calculate individual sight or darkvision. Character notes on visible tokens are shared, so put secrets in **Private GM notes**. With fog enabled, non-public mechanical logs are withheld from players to avoid revealing concealed information. History retains the most recent 100 log entries.

The optional AI assistant drafts narration, NPC dialogue or rules discussion for GM review. It does not automatically build maps, act for characters or apply game changes. It stays disabled without host configuration; play and rulebooks work without AI. Provider access, available credits and usage costs depend on the host's provider account.

## Restore your place

Choose **Restore** on the welcome screen, enter the table code and your private recovery code. Restoration preserves your role and character, rotates both credentials, and invalidates the old session. Save the replacement code from **Adventure desk → Session**. Share only the table code with friends.

On a hosted server that supplies authenticated account identity, leaving the recovery field blank can restore a single linked seat. If the account has no linked seat or multiple seats in that campaign, use the personal code. Local Windows play needs the code. Older campaigns may have no saved recovery code; preserve their original browser access. Switching tables preserves this browser's saved sessions.

## Continue development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup and checks, and [BUILD_PROMPT.md](BUILD_PROMPT.md) for the broader vision. Existing legacy campaigns retain their prototype rules rather than silently changing edition. Remaining work includes broader rules automation, structured character choices, revocable invitations, player removal, richer vision and campaign export/history.

Successful `main` checks produce a Windows testing artifact; version tags produce release downloads. GitHub pushes and hosted Site deployments are separate, so publishing a test build does not redeploy the hosted app.
