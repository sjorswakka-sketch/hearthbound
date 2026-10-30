# Build Prompt: A Shared, Visual, D&D-Style Multiplayer World

Build a working browser-based multiplayer fantasy role-playing application, with the working title **Hearthbound**. The core experience should feel as close to playing Dungeons & Dragons together as the supported, openly licensed rules allow, while making the world visible and interactive. Everyone should inhabit the same persistent world. Players should not need to imagine the map, everyone's position, an enemy's location, an open door, or the result of an action solely from narration.

Do not stop at a concept, landing page, attractive mockup, or single-player simulation. Implement and verify a real, playable multiplayer foundation, then expand it in milestones. Make reasonable implementation decisions and proceed without asking about routine choices. Clearly distinguish working features, GM-adjudicated mechanics, and future features.

## 1. Product vision and guiding principles

The Game Master (GM) creates a campaign, sets its rules, writes the opening prompt, and guides the adventure. Players create or select characters, join through an invitation, and act in a shared visual environment. They can move, speak, investigate, negotiate, fight, cast spells, manipulate objects, and describe creative actions that the interface does not anticipate.

The GM can control NPCs and enemies, introduce encounters, adjust the world, conceal information, resolve unusual actions, and override mechanical outcomes. An optional AI assistant can support narration, NPC dialogue, scene planning, and controlled AI companions. Human play and GM controls must remain functional when AI is unavailable.

Prioritize these principles:

- One authoritative shared world, with different views based on each character's knowledge and visibility.
- D&D-style rules, character choices, dice, exploration, social interaction, and turn-based combat.
- Player freedom supported by free-text action proposals and GM adjudication.
- A visual world that communicates positions, terrain, objects, changes, and consequences.
- Persistent campaigns and reliable reconnection.
- Honest functionality: no fake multiplayer, fake AI responses, decorative buttons, or unimplemented features presented as complete.

## 2. Rules foundation and original identity

Use **SRD 5.2.1** as the initial versioned rules baseline. Pin the rules version per campaign. Do not silently mix different editions or SRD versions. Implement the mechanics faithfully within the declared feature scope; identify unsupported edge cases for explicit GM adjudication.

Use original branding, maps, artwork, locations, characters, adventures, and interface design. Package only content available under an appropriate license. Do not scrape proprietary rulebooks or treat D&D Beyond's online Basic Rules as an interchangeable licensed data source. The aim is a familiar tabletop experience with an original world and product identity.

Include source and license records for bundled rules and assets. Include the attribution required by the SRD and identify modifications or original additions. Keep rules content separate from application code so content and code licenses remain clear. Refer to these verified primary sources:

- Official SRD page: https://www.dndbeyond.com/srd
- Official English SRD 5.2.1: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
- Creator FAQ: https://www.dndbeyond.com/creator-faq
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

The complete rules implementation can be delivered incrementally. Do not claim full D&D compatibility merely because a d20 and character sheet are present.

## 3. Roles, campaigns, and joining

Support one human GM and initially two to six human players per active session. Design for optional spectators, additional GMs, and AI-controlled companions later.

The GM creates a campaign and receives GM controls. Generate an invitation that admits players without granting GM privileges. A player joins, chooses a display name, creates or claims an available character, and appears in the shared scene. Character ownership is enforced on the server. Spectators cannot mutate the world.

Persist campaigns, members, characters, maps, items, quests, journal entries, rules, encounters, world time, and significant events. Saving and resuming should work across browser refreshes and server restarts. Players reconnect to the authoritative current state rather than creating a new world. Clearly show connection state and prevent accidental duplicate submissions during reconnects.

Provide campaign settings, character reassignment by the GM, invitation revocation or rotation, player removal, and safe export/import as the product matures. Do not expose account credentials or private GM access in an invitation URL.

## 4. Opening prompt and the “Set Rule” system

Give the GM a session-start screen with:

- Campaign and session titles.
- The opening narrative prompt.
- An initial scene, with a visual map preview.
- Characters, NPCs, objectives, atmosphere, and time of day.
- Public campaign rules and private GM notes.
- A preview-and-start action that publishes the scene and opening narration to players.

Example opening prompt:

> You arrive at the gates of Lanternfall as the last daylight fades. The town's beacon has gone dark, and travelers have disappeared along the northern road. The gate captain will allow you inside only if you agree to investigate. Magic is distrusted here, and the city gates close at sunset.

The prompt must establish real session content: the starting location, visible objects and NPCs, opening narration, and initial objectives. In the first milestone, use an editable prepared map and explicitly configured entities. If AI generation is later enabled, let the GM review structured proposed changes before applying them. Do not pretend arbitrary prose automatically produces a complete playable map without an implemented generation pipeline.

Provide a clear **Set Rule** control for campaign, scene, and character rules. Separate three kinds of rules:

1. **Narrative and behavior rules:** personality, motivations, vows, world customs, and NPC or AI behavior. Example: “This knight refuses to abandon a helpless person.” For human-controlled characters, these guide role-play rather than silently taking away control.
2. **Mechanical rules:** structured, validated settings actually enforced by the server, such as an explicitly supported movement or rest house rule. Show the supported options, their scope, and their mechanical effect.
3. **Adjudicated rules:** free-text house rules that the GM resolves manually until supported mechanically. Label them honestly.

Never execute free-text rules as arbitrary code. A natural-language rule must not silently change mechanics. If the assistant interprets a rule, it produces a structured proposal for GM approval. Show rule precedence, conflicting settings, the current effective rules, version history, and the time a change takes effect. Log GM overrides with a reason and the resulting state change.

## 5. Shared visual world

Start with an attractive, responsive **2D top-down virtual tabletop**. An isometric or 3D renderer can follow after the game loop and synchronization are dependable.

The play screen should give most of its space to the world. Include:

- A pannable, zoomable scene with optional five-foot grid and a readable scale.
- Distinct character tokens with names, health indicators, selection state, and conditions.
- Terrain, buildings, interiors, walls, doors, cover, containers, hazards, and interactive objects.
- Click-to-move or drag-to-move, with path and movement-cost previews.
- Collision and path validation against authoritative terrain and object state.
- Visible door opening, item transfer, defeated enemies, spell effects, and environmental changes.
- Range measurement, line-of-sight indicators, and spell-area templates as the relevant mechanics are added.
- Shared pings and optional cursors, with respectful visual noise limits.
- Map transitions within the same campaign, with persistent state when returning.
- Fog of war and visibility rules, introduced deliberately and tested for information leaks.

The GM may see the entire scene. Players see only information their characters are allowed to receive. Concealed tokens, unrevealed rooms, private notes, and secret rolls must be omitted from unauthorized responses, not merely hidden with CSS. Any optional shared-party-vision mode must be an explicit setting.

Use a restrained fantasy aesthetic: charcoal and deep forest colors, warm amber highlights, readable typography, textured surfaces, and clear iconography. Avoid clutter, tiny text, excessive glow, or decorative elements that obscure the map. Support keyboard controls, visible focus, adequate contrast, tooltips, and reduced motion. Optimize for desktop and tablet, with a useful mobile companion view.

## 6. Characters and mechanical play

Build a character sheet that can grow to cover species, class, level, background, ability scores, skills, proficiency, saving throws, armor class, hit points, temporary hit points, speed, initiative, attacks, equipment, currency, spells, resources, conditions, and personality.

Start with a small set of usable, original pregenerated characters and then implement character creation from the licensed content. Keep derived statistics consistent with equipment, abilities, conditions, and the selected rules version.

Implement the core mechanics in stages:

- Server-generated dice rolls with expressions such as d20, 2d6+3, and supported advantage/disadvantage.
- Ability checks and saving throws with an understandable result breakdown.
- Initiative order and a visible active turn.
- Movement allowance, actions, bonus actions, and reactions as supported.
- Attack rolls versus armor class, hit/miss results, damage, healing, and unconscious/dead states according to the supported rules.
- Spell selection, valid targets, range, resource expenditure, saving throws, concentration, durations, and effects as those systems are implemented.
- Conditions, rest, resource recovery, inventory, loot, and advancement.

Do not apply attack-specific natural-one/natural-twenty behavior to every type of check. Handle ties, advantage/disadvantage cancellation, and other details from the chosen rules rather than guessing.

During exploration, allow free movement within valid terrain and GM constraints. During combat, enforce the active turn, movement budget, ownership, and relevant action economy. The GM can pause, begin or end combat, advance initiative, control opponents, and make recorded rulings.

Keep the resolution chain transparent: requested action → validation → any GM decision → roll → outcome → state update → shared visual feedback. Animated dice display an already authoritative result; the animation never decides game state.

## 7. Free-form actions, narration, and optional AI

Provide a chat and action panel where players can distinguish in-character dialogue, out-of-character chat, and action proposals.

Example action:

> I move behind the crates, try to stay unnoticed, and shoot the goblin if I have a clear line of sight.

Translate supported structured actions into validation and resolution. Send ambiguous or unsupported actions to the GM with a clear proposed ruling. Never silently invent a successful result or bypass initiative because an action was described in prose.

The GM can approve, reject, request a roll, revise the proposal, or resolve it manually. The event log records what actually happened. Narration follows committed outcomes and should not contradict health, positions, inventory, or visibility.

AI is optional and uses a real configured provider. If credentials are absent, explain that AI assistance is unavailable and keep normal play working. Do not substitute canned text while claiming a live AI response.

AI helpers receive only authorized context and propose bounded actions. They cannot directly write campaign state, reveal GM secrets, change system permissions, create arbitrary assets or items, spend resources, or control a human player's character without the intended approval. Treat player messages, uploaded lore, and campaign text as content, not instructions that override permissions. Limit autonomous companion turns to avoid infinite loops and uncontrolled cost.

## 8. Technical architecture and multiplayer integrity

Use a maintainable modern web stack suited to the deployment environment. A good default is TypeScript, a component-based frontend, a separate rules module, a server-side game service, durable database storage, and a real-time transport. Prefer reliable implementation over fashionable dependencies.

The server owns campaign state. Clients submit commands; the server authenticates the member, checks campaign access and role, validates ownership and rules, commits the change, and broadcasts an authorized update. Never trust a client-supplied role, user identity, dice result, damage total, or inventory balance.

Use WebSockets where supported, or another clearly documented synchronization method that actually works across independent clients. A shared state object in one browser, local storage, BroadcastChannel, or switching between demo characters is not internet multiplayer.

Use command identifiers and state revisions to prevent duplicate effects and resolve concurrent actions. Apply sensitive changes transactionally, including movement conflicts, health changes, item transfers, resource spending, and combat turn advancement. Reconnecting clients must detect missing events and obtain a fresh filtered snapshot.

Keep the rules engine deterministic given a validated command, current state, and injected random result. Separate it from rendering, network transport, storage, and narration. Maintain an event history and useful debugging records without logging credentials or hidden information to unauthorized users.

Use secure role/session handling, input validation, output escaping, request limits, and environment-based secrets. Provide data migrations, backups or export, and a clear deployment configuration. If a public deployment is not yet configured, describe how real remote players can connect and do not label a localhost-only app as publicly available.

GitHub may be used for source control and collaboration. Use the user's authorized destination if provided. Otherwise prepare a clean repository and explain how to connect it; do not choose an unrelated existing repository or make the source public by default. Include a README, setup instructions, environment example without secrets, architecture overview, rules-support matrix, attribution, and meaningful automated checks.

## 9. Delivery milestones

### Milestone 1 — A real playable multiplayer slice

Deliver campaign creation and joining; distinct GM and player permissions; one polished interactive map; character selection/ownership; validated movement; shared chat and event history; server-generated dice; the GM opening prompt; public narrative rules plus a clearly identified supported mechanical subset; basic initiative and attack resolution; persistent campaign state; reconnect support; and an original sample encounter.

At this stage, a GM and at least two independent player clients must be able to enter the same campaign, explore, change the visible world, resolve an encounter, reload, and continue. Any simplified combat or manually adjudicated mechanics must be stated in the rules-support matrix.

### Milestone 2 — Deeper tabletop fidelity

Expand character creation, inventory and loot, rests, conditions, class features, spells, concentration, death saves, line of sight, fog of war, terrain costs, map editing, campaign journals, quests, and GM overrides. Increase rules coverage through explicit tests and versioned data.

### Milestone 3 — AI and richer presentation

Add configurable AI narration, structured prompt-to-scene drafting, NPC dialogue, controlled AI companions, richer animation, audio, and optional voice communication. Consider 3D only after the existing shared-world systems remain reliable under load.

Work toward the complete vision, but finish and verify each milestone before claiming its features. If time or infrastructure limits delivery, leave a runnable foundation, an accurate implementation-status document, and the next concrete steps.

## 10. Acceptance tests and definition of done

Demonstrate the following with independent clients and automated tests where appropriate:

1. A GM creates a campaign, sets the opening text and rules, and starts a visible scene.
2. Two players join the same campaign through the invitation and control different characters.
3. Player A moves; Player B and the GM see the same committed position without reloading.
4. A player cannot move another player's token, use GM controls, or mutate another campaign by forging a request.
5. An opened door or changed object remains consistent for everyone and survives a reload.
6. A roll is generated once on the server, includes its modifier breakdown, and appears consistently to the intended audience.
7. Duplicate action submissions do not duplicate damage, items, movement costs, or resource consumption.
8. Combat follows initiative and validates turn ownership, movement, range, and implemented action costs.
9. A narrative rule is visibly separate from an enforced mechanical setting; unsupported prose rules are marked for GM adjudication.
10. A free-text creative action reaches the GM and can be resolved into a recorded world change.
11. Hidden entities and GM notes cannot be retrieved through the player's network responses.
12. Disconnecting and reconnecting restores the correct current state and ownership.
13. Restarting the server preserves the campaign and does not create an empty replacement.
14. Concurrent attempts to take the same item or otherwise compete for a resource produce one consistent outcome.
15. With no AI key configured, the game remains playable and never claims AI generation occurred.
16. The main play screen works at common desktop and tablet sizes, supports keyboard operation, and communicates errors clearly.

Deliver the running application or a runnable local package, source code, complete setup instructions, the demo campaign, tests and their results, source/asset attributions, and a concise honest list of implemented and remaining features. Lead the final handoff with how to open the game, create a session, and invite the other players.

**Success means the group can actually play together in one visible, persistent world, with the GM's rules and D&D-style mechanics shaping what happens.**
