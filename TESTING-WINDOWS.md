# Test Hearthbound v0.2 on Windows

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

**Everyone must use the same server address.** Separate local installs create separate databases; matching table codes cannot connect them.

To test on one computer, use a normal browser for the GM and a private window or another profile for a player. Join the same six-character table code. End combat before adding a new player. Other clients may take a moment to show updates.

For friends on different computers, open the same hosted Hearthbound site after its owner grants everyone access, then share the table code. The hosted Site currently remains owner-private; public GitHub downloads do not grant site access. The Windows launcher listens only on your computer; it does not expose an internet server or alter your firewall.

## Restore a GM or player session

Your **table code** is shared with the group. Your **personal recovery code** restores your individual role and character and must stay private.

1. On the welcome screen, choose **Restore**.
2. Enter the table code and your personal recovery code.
3. Open **Adventure desk → Session** and save the replacement recovery code. Restoration invalidates the old code and browser session for that seat.

On a supported hosted server, leaving the recovery field blank can restore the single campaign seat linked to your signed-in account. Local Windows play needs the personal code. If your hosted account has multiple seats in a campaign, use that seat's code. Older sessions may have no saved recovery code; preserve their original browser data. Switching tables retains saved credentials in that browser.

## What to try in v0.2

- **Rulebooks:** search both editions for a spell, class and monster, then open the original PDF at that page. The library contains all 403 SRD 5.1 pages and all 364 SRD 5.2.1 pages.
- **Characters:** join with any of twelve classes. Ask the GM to configure level, abilities and skills; save inventory/behavior notes; roll a check or save. Rebuilding a sheet resets derived statistics and resources.
- **Encounters:** move, attack and advance initiative; try Dash/Dodge, action resources, conditions, spell slots, concentration, death saves and rests. A player must not control another player's character or grant their own HP/resources.
- **Maps and scenes:** as GM, end combat, open **Maps, scenes & fog**, create a location, paint terrain, add a door/chest or creature, then travel away and back. The location should remember edits and creatures.
- **Fog and secrets:** enable fog, reveal selected squares and compare GM/player windows. Unrevealed cells, objects and creatures should be absent from the player's view. Keep secrets in **Private GM notes**; visible character notes and shared narration are public. Fog suppresses mechanical logs that could disclose hidden information.
- **Recovery:** save a player's code, restore it in a third browser, and verify the same character returns while the old session loses access. Keep the GM's code separate.
- **AI assistant:** an unconfigured server should clearly say AI is not connected. This is expected. When the host configures it, only the GM can request a draft and decide whether to share it.

The complete SRDs are reference books, not a promise that every rule is automated. The GM still resolves origins, subclasses, feats, many class features, spell legality/effects, equipment effects, cover, sight and unusual actions. Inventory does not automatically equip or consume items. Fog is manually revealed, and temporary statistics need manual removal. See [README.md](README.md) for scope.

## Get builds between releases

Successful **main** updates produce a download in [GitHub Actions](https://github.com/sjorswakka-sketch/hearthbound/actions/workflows/windows-test.yml). Open a successful **Windows test package** run and download **Hearthbound-Windows-test**. Extract GitHub's outer ZIP, then extract **Hearthbound-Windows-test.zip** inside it.

For a stable sharing link and public download, use [Releases](https://github.com/sjorswakka-sketch/hearthbound/releases). Actions artifact downloads may require GitHub sign-in. Hosted app updates are deployed separately.

## When something fails

- **Node.js is missing or too old:** install Node.js 24 and relaunch.
- **Dependency download fails:** check internet access and rerun. Do not delete campaign data.
- **Port 8787 is occupied:** stop the previous launcher first.
- **A friend cannot join:** check the exact URL and site access, and end combat before joining.
- **Your role is missing:** try the original browser profile or **Restore** with the latest personal code.
- **A code fails after restoration:** use the replacement code saved by the restored session.
- **AI is unavailable:** local play works without it. The host must configure server credentials and a model; provider access and quota depend on that account.

Report the release/tag or commit, Windows version, clicks that caused the issue and the displayed message. Never include recovery codes, browser credentials, API keys or your local database in a bug report.
