# Hearthbound — First Playable Prototype

Hearthbound is a shared visual fantasy tabletop. A human Game Master guides an adventure while players move their characters, roll dice, chat, interact with objects, and fight in the same persistent scene.

The accompanying **BUILD_PROMPT.md** describes the complete product vision. This prototype implements its first foundation; it is not yet a complete D&D rules engine.

## Start a session

1. Open the application and create a table as the GM.
2. Share the six-character room code with your players. They must also be able to access the same hosted application; a room code does not bypass the hosting site's access settings.
3. Each player joins from their own browser session, enters a character name, and chooses fighter, rogue, cleric, or wizard.
4. As GM, write the opening narration and use **Set Rule** to establish the table's rules.
5. Select a character and move across the map. Move beside a door or chest to interact with it. Use the dice controls and chat to resolve creative actions together.
6. Start combat as GM, follow initiative, and advance turns. End combat to return to exploration.

For a solo multiplayer check, use separate browser profiles or a private window for the players. Refreshing an existing browser session should restore its access.

## What works

- A shared 20 × 14 scene with terrain, walls, water, doors, a chest, companions, and enemies.
- One GM and up to seven players, with separate permissions and character ownership.
- Server-validated movement, blocked terrain, closed doors, and combat movement budgets.
- Server-generated polyhedral dice, modifiers, and d20 advantage/disadvantage.
- Basic initiative, turn order, attacks, armor class, damage, and downed characters.
- GM narration, shared chat, and the most recent 100 log entries.
- Enforced settings for friendly fire, diagonal movement, and movement limits.
- Separate free-text narrative rules for the GM to adjudicate.
- Campaign storage in a database, synchronized updates, and browser refresh recovery.
- GM-controlled party recovery outside combat (a simplified Rest party action).

Synchronization uses repeated server updates, so other clients may see a short delay. The GM controls enemies and unclaimed companions. New characters join outside combat.

## Current limits

All participants can see the whole map and every token. Fog of war, private GM notes, hidden creatures, and personal vision are not implemented. Do not enter secrets in shared narration or rules.

Character statistics and combat are simplified. The class choices are starter profiles, not full class implementations. Spells, class features, reactions, bonus actions, full rest rules, conditions, death saves, full character creation, inventory, and progression remain to be built. Opening the chest creates a story event; it does not add an inventory item.

There is no AI generation or autonomous character behavior yet. The GM's prompt publishes narration; it does not automatically build a new map. Narrative rules are visible guidance, while only the listed mechanical settings are enforced.

Session access is retained in the browser. Switch table preserves this browser's saved roles; re-enter the same room code to resume. Clearing browser storage or using a different browser can lose access to that character or GM role. Recovery, account-based ownership, player removal, and invitation rotation are not implemented yet. Keep the GM's original browser session.

## Continue development

Use **BUILD_PROMPT.md** for the next milestones and acceptance tests. Priority additions are durable account recovery, richer character sheets, complete combat and spells, privacy-aware fog of war, a map editor, and optional AI assistance.

The source is prepared for GitHub-based development. No repository has been created in your GitHub account. Deployment status and the application link are supplied separately when verified.

