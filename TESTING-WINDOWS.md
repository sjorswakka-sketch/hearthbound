# Test Hearthbound v0.3 on Windows

This package runs Hearthbound on Windows and opens it in your browser. It is a source-based test package, not a standalone EXE. You do not need Git or a developer account to run an extracted copy.

## First launch

1. Install **Node.js 24** from [the official download page](https://nodejs.org/en/download). Keep the default option to add Node to PATH; reopen terminal windows after installation.
2. Download **Hearthbound-Windows-test.zip** from [Hearthbound Releases](https://github.com/sjorswakka-sketch/hearthbound/releases). The repository is public; no repository invitation is needed. You can also receive the ZIP directly.
3. Right-click the ZIP and choose **Extract All**. Open its **Hearthbound** folder in a writable location such as Documents. Do not run inside the ZIP or Program Files.
4. Double-click **START-HEARTHBOUND.cmd**. Initial setup needs internet to download dependencies, build the app and prepare its database. Keep the launcher open while playing.
5. Your browser opens at **http://127.0.0.1:8787**. Create a table and choose D&D 2014/SRD 5.1 or D&D 2024/SRD 5.2.1.
6. Open **Adventure desk → Session**, copy your personal recovery code, and store it privately.

Stop the server with **Ctrl+C** in the launcher. Only one local copy can use port 8787. Both complete rulebooks and PDFs are included locally; after setup, local play and the rule library do not require an AI connection.

## Install an update

1. Save your personal recovery code, then stop the old version.
2. Download the new ZIP and extract it into a **new folder**.
3. Run the new folder's **START-HEARTHBOUND.cmd**. It installs changed dependencies and applies tracked migrations as needed.

Campaigns stay in **%LOCALAPPDATA%\Hearthbound**, outside the application folder. Keep the same browser profile and address to retain your session. Campaigns keep their rules edition; older prototype campaigns remain legacy campaigns. Only return to an older app version if its release notes support the current database format.

## Playing in the same world

**Everyone must use the same host.** Separate local installs create separate databases; matching table codes cannot connect them.

To test on one computer, use a normal browser for the GM and a private window or another profile for a player. Create a table, then share its invitation from **Adventure desk → Session** with the second window. End combat before adding a new player. Other clients may take a moment to show updates.

For friends on the **same home Wi-Fi or Ethernet**:

1. Choose one host computer. Only that person installs Node.js and downloads the package.
2. Stop any running Hearthbound launcher, then double-click **START-LAN-GAME.cmd** on the host. Keep this window and computer running for the whole session.
3. The launcher prints one or more addresses such as `http://192.168.1.50:8787` and opens one in the host's browser. Other players open a printed address in their own browsers. They do not run their own server or install Node.js.
4. Create the table on that shared host and send its invitation from **Adventure desk → Session**. The link must use the host's network address, not `127.0.0.1` or `localhost`.
5. If Windows asks whether to allow network access, use the private home-network profile. The launcher does not change firewall settings or configure your router. Guest Wi-Fi or network isolation may prevent devices from reaching each other.

LAN play uses HTTP and is intended for a trusted home network. Do not expose it through router port forwarding or use it as a public internet server. The ordinary **START-HEARTHBOUND.cmd** stays accessible only on the host computer. Both launchers use the same saved campaign database. Browser sessions are tied to the address: when moving from `127.0.0.1` to a LAN address, restore your existing seat with its personal recovery code. A changed host IP may also require restoration at the new address.

For friends elsewhere, everyone needs access to the same hosted Hearthbound site. The hosted Site currently remains owner-private; public GitHub downloads and game invitations do not grant site access.

## Invitations and table management

New tables require the GM's current invitation. The six-character table code identifies a table; the invitation allows a new player to join it. Existing campaigns remain open by table code until the GM creates an invitation.

In **Adventure desk → Session**, the GM can replace an invitation to revoke old links, or close joining without interrupting current players. Restoration still works at a closed table. Replacing an invitation does not reopen joining. Invitations are stored in the GM's browser; if that browser no longer has the current link, generate a replacement.

The GM can assign a hero to a member or release it for GM control outside combat. Each member owns at most one hero. **Remove & close table** revokes that player's current session and recovery code, preserves their hero and closes new joining. Replace the invitation before reopening if you want a different group; seat removal is not an account ban.

The GM can download a JSON campaign archive containing the world, sheets, hidden scenes and private notes. It omits access credentials. Keep it private. Archive import is not available in v0.3, so the download is a readable record, not a restorable backup; preserve the host's saved database for continued play.

## Restore a GM or player session

Your **table code** identifies the campaign, and the GM's **invitation** admits new players. Your **personal recovery code** restores your individual role and character and must stay private.

1. On the welcome screen, choose **Restore**.
2. Enter the table code and your personal recovery code.
3. Open **Adventure desk → Session** and save the replacement recovery code. Restoration invalidates the old code and browser session for that seat.

On a supported hosted server, leaving the recovery field blank can restore the single campaign seat linked to your signed-in account. Local and LAN play need the personal code. If your hosted account has multiple seats in a campaign, use that seat's code. Older sessions may have no saved recovery code; generate one from **Session** while the original browser still has access. Generating a replacement rotates both credentials and invalidates other browsers using the old seat. Switching tables retains saved credentials in that browser.

## What to try in v0.3

- **Rulebooks:** search both editions for a spell, class and monster, then open the original PDF at that page. The library contains all 403 SRD 5.1 pages and all 364 SRD 5.2.1 pages.
- **Characters:** join with any of twelve classes. Ask the GM to configure level, abilities and skills; save inventory/behavior notes; roll a check or save. Rebuilding a sheet resets derived statistics and resources.
- **Encounters:** move, attack and advance initiative; try Dash/Dodge, action resources, conditions, spell slots, concentration, death saves and rests. A player can end their own active turn, but must resolve a required death save first. They must not control another player's character or grant their own HP/resources.
- **Supported spells:** have the GM approve access/preparation for one of the eight supported spells outside combat, then try healing, a spell attack, a saving throw, Magic Missile dart allocation or an area spell. Confirm components and special traits with the GM before casting. Verify slot/action use, range and resulting HP against the chosen edition. Other spells still use the manual resource tracker.
- **Maps and scenes:** as GM, end combat, open **Maps, scenes & fog**, create a harbor, forest, crypt, tavern, cavern or ruins scene, paint terrain, add a door/chest or creature, then travel away and back. The location should remember edits, creatures, narration, theme and ambience. Place a shared ping and check that it briefly appears for other players.
- **Fog and secrets:** enable fog, reveal selected squares and compare GM/player windows. Unrevealed cells, objects and creatures should be absent from the player's view. Keep secrets in **Private GM notes**; visible character notes and shared narration are public. Fog suppresses mechanical logs that could disclose hidden information.
- **Invitations:** join using the current invitation, replace it and confirm the old link is rejected. Close joining; current players should still play and restore their seats, while new joins fail.
- **Ownership and removal:** assign a hero to another member outside combat and verify control changes without resetting HP/resources. Remove a player; their session and recovery code should fail, their hero should remain and joining should close. Other players should continue.
- **Recovery:** save a player's code, restore it in a third browser, and verify the same character returns while the old session and code lose access. Keep the GM's code separate. Test generating a replacement from an existing session too.
- **Archive:** download a GM archive and verify it contains private notes and scenes without session/recovery/invitation credentials. Players must not be able to download the GM archive. There is no import button yet.
- **AI assistant:** an unconfigured server should clearly say AI is not connected. This is expected. When the host configures it, only the GM can request a draft and decide whether to share it.

The complete SRDs are reference books, not a promise that every rule is automated. The eight supported spells are Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Magic Missile, Inflict Wounds, Burning Hands and Fireball. Their map areas use two-dimensional tile centers, with no creature-size or vertical-space simulation. The GM still resolves origins, subclasses, feats, many class features, spell eligibility, components, resistances/immunities, Shield/Counterspell, unsupported spell effects, equipment, cover, sight and unusual actions. Inventory does not automatically equip or consume items. Fog is manually revealed, and temporary statistics need manual removal. Scene creatures are examples for GM editing rather than complete SRD monsters. See [README.md](README.md) for scope.

## Get builds between releases

Successful **main** updates produce a download in [GitHub Actions](https://github.com/sjorswakka-sketch/hearthbound/actions/workflows/windows-test.yml). Open a successful **Windows test package** run and download **Hearthbound-Windows-test**. Extract GitHub's outer ZIP, then extract **Hearthbound-Windows-test.zip** inside it.

For a stable sharing link and public download, use [Releases](https://github.com/sjorswakka-sketch/hearthbound/releases). Actions artifact downloads may require GitHub sign-in. Hosted app updates are deployed separately.

## When something fails

- **Node.js is missing or too old:** install Node.js 24 and relaunch.
- **Dependency download fails:** check internet access and rerun. Do not delete campaign data.
- **Port 8787 is occupied:** stop the previous launcher first.
- **A friend cannot join:** check the host URL, current invitation and whether joining is closed; end combat before adding a player. On LAN, keep the host running and use the same home network. For a hosted site, check that everyone has site access.
- **The LAN page does not load:** use one of the addresses printed by the host, check its private-network firewall permission, and avoid isolated guest Wi-Fi. Do not open router ports.
- **Your role is missing:** try the original browser profile or **Restore** with the latest personal code.
- **A code fails after restoration:** use the replacement code saved by the restored session. A removed seat cannot be restored with its old credentials.
- **AI is unavailable:** local play works without it. The host must configure server credentials and a model; provider access and quota depend on that account.

Report the release/tag or commit, Windows version, whether you used solo/LAN/hosted play, clicks that caused the issue and the displayed message. Never include invitation links, recovery codes, browser credentials, API keys, private campaign archives or your local database in a bug report.
