# Test Hearthbound on Windows

This package runs the current Hearthbound web app on your Windows computer and opens it in your browser. It is a source-based test package, not a standalone EXE. You do not need Git or a developer account to run an extracted copy.

## First launch

1. Install **Node.js 24** from [the official Node.js download page](https://nodejs.org/en/download). Keep the installer's default option to add Node to PATH. If Node was just installed, close and reopen any existing terminal windows.
2. Download **Hearthbound-Windows-test.zip** from [Hearthbound Releases](https://github.com/sjorswakka-sketch/hearthbound/releases). If the repository is private, the owner must first grant your GitHub account access. The owner may also send you the ZIP directly.
3. Right-click the ZIP, choose **Extract All**, and open the extracted **Hearthbound** folder. Use a folder you can write to, such as Documents. Do not run it inside the ZIP or inside Program Files.
4. Double-click **START-HEARTHBOUND.cmd**. The first launch downloads dependencies, builds the app, and prepares its local database. Internet is required for setup. Keep the window open while playing.
5. Your browser opens at **http://127.0.0.1:8787**. Create a table as GM or join a table in that server using its six-character code.

To stop the local server, return to the launcher window and press **Ctrl+C**. If another copy is already running, use that copy or stop it before starting a new version.

## Install an update

1. Stop the old version.
2. Download the newest testing ZIP and extract it into a **new folder**.
3. Run the new folder's **START-HEARTHBOUND.cmd**. New dependencies and database migrations are applied as needed.

Local campaigns are stored separately in **%LOCALAPPDATA%\Hearthbound**, so replacing the application folder does not remove them. Your browser holds the credentials for your GM/player role: keep using the same browser profile and the same address, and do not clear its site data. New releases should preserve existing campaigns; return to an older version only when its release notes explicitly support that database version.

## Playing in the same world

**Everyone must connect to the same server address.** Installing a separate local copy on each computer creates separate databases and separate worlds; matching room codes will not connect those copies.

For a local multiplayer check on one computer, use the normal browser for the GM and a private window or another browser profile for a player. Enter the same table code in both.

For friends on different computers, use the same hosted Hearthbound app after its owner has granted everyone access. Then share the table code inside that app. GitHub repository access does not grant access to the hosted site. The Windows launcher deliberately listens only on your computer; it does not expose a server to the internet or change your firewall.

## Get builds between releases

Every successful update to **main** produces a testing download in [GitHub Actions](https://github.com/sjorswakka-sketch/hearthbound/actions/workflows/windows-test.yml). Open a successful **Windows test package** run and download its **Hearthbound-Windows-test** artifact. GitHub wraps the files in an outer ZIP; extract that, then extract **Hearthbound-Windows-test.zip** inside it.

For a stable link to share, prefer the [Releases page](https://github.com/sjorswakka-sketch/hearthbound/releases). Repository collaborators can subscribe to release notifications through GitHub's Watch menu. Access to private repository downloads still requires signing in with an invited account.

## When something fails

- **Node.js is missing or too old:** install Node.js 24 from the official page, then relaunch.
- **Dependency download failed:** check the internet connection and rerun the launcher. Do not delete your campaign data.
- **Port 8787 is occupied:** stop the earlier Hearthbound launcher before trying again.
- **A friend cannot join:** confirm they are using the exact same server URL and have site access; the GM must end combat before a new player can join.
- **Your GM role disappeared:** use the original browser profile. Switching tables preserves saved credentials in that browser; clearing browser storage does not.

When reporting a bug, include the release/tag or commit, Windows version, what you clicked, and the message shown. Do not share browser session tokens or your local database.
