# RTS Feature Coverage Inventory

- **Purpose:** turn the Openage and Age of Empires II study into a project-owned checklist for features we may build in our own way.
- **Status baseline:** prototype 0.95 · 25 September 2026.
- **Related documents:** [Game Bible](../game-bible.md) · [Openage Source Study](openage-study.md) · [Warcraft RTS Feature Coverage Inventory](warcraft-rts-inventory.md).

This is a tracking inventory, not a promise to reproduce Age of Empires II or ship every item below. The project target is an original, invite-first multiplayer RTS with large armies and player-authored maps and scenarios. There is no campaign in the current goal. Every reference behavior still needs a design decision, an original implementation, and an explicit scope lane.

## How to read the ledger

**Prototype status** describes the current implementation, not its finish quality:

- **Present** — a working version exists in prototype 0.95.
- **Partial** — a narrow version exists; the listed reference area is broader.
- **Absent** — not implemented in the prototype.

**Project lane** describes how to treat the item:

- **Slice** — needed to make the first complete multiplayer scenario understandable, finishable, and trustworthy.
- **Candidate** — evaluate after the first slice through playtests or measured engineering need.
- **Out** — excluded by the current product goal.
- **Open** — decide from the first complete match or editor playtest.

Openage's reverse-engineering notes, its own engine/design documents, and its idea pages are different kinds of evidence. An idea page is not evidence that Age of Empires II has that mechanic, and a reverse-engineered mechanic is not automatically a feature we should copy. Warcraft RTS references have their own [separate inventory](warcraft-rts-inventory.md), so features that differ across the Warcraft I–III design lineage are not flattened into one checklist.

## Feature ledger

### 1. Match setup and session

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Lobby/player slots, team assignment, map and match setup; Openage has reverse-engineered lobby and sync protocol notes. | **Partial** — invite rooms, Azure/Ember seats, host map selection, reset controls, and isolated match workers; product is a two-side match. | **Slice** — make the invite flow and match settings clear and dependable. **Candidate** — more team/player slots and a broader settings surface. |
| Disconnect/resign, save or restore, chat, diplomacy, game speed, spectator, and post-match flow appear in Openage's networking notes or project ideas. | **Partial** — reconnect windows, server checkpoint recovery, and match result/reset; no in-game chat, spectator mode, diplomacy, or save-slot UI. | **Slice** — clear disconnect/recovery, match end, and rematch. **Candidate** — chat, spectating, and other social controls based on playtest need. |

### 2. World, maps, and visibility

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Map dimensions, terrain and passability, obstacles, resources, start locations, water/land, and terrain-aware routes. Openage's terrain editor proposal is an idea document. | **Partial** — finite tile maps, stone/forest/water obstacles, Azure/Ember starts, food/wood resource nodes, five authored maps, resize and painting in Map Studio. | **Slice** — map validation, readable routes, fair starts, and authored maps that play well at target army size. **Candidate** — richer terrain types and elevation if they improve tactical choices. |
| Line of sight, fog of war, minimap, and visibility-sensitive state. | **Partial** — team fog of war, explored/visible state, tactical minimap, and hidden enemy information in tested cases. | **Slice** — reliable privacy and useful visibility feedback. **Candidate** — scouting, stealth, and more detailed sight rules. |
| Weather, fire, day/night, bridges, infinite maps, and other environment proposals in Openage's gameplay ideas. | **Absent.** | **Candidate/Open** — treat each as a separate design question; none is a baseline requirement. |

### 3. Economy and worker behavior

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Resource stock, gather rates, carried goods, drop-off, task switching, build work, and repair costs/speeds. Openage has notes on rates, task switching, building speed, and repair. | **Partial** — food and wood, worker gathering, starting stock, building costs, and host-authored resource nodes. The economy is intentionally small. | **Slice** — tune a complete opening economy and explain why workers cannot perform an order. **Candidate** — additional worker tasks and resource types if they create meaningful choices. |
| Markets, buy/sell prices, trade routes, tribute, and resource conversion. | **Absent.** | **Candidate** — track as familiar RTS options, not assumed requirements. |
| Town Bell, back-to-work, and automated villager responses. | **Absent.** | **Candidate** — only add if the worker-control workload warrants them. |

### 4. Units, factions, and technology

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Unit roles and definitions, costs, rates, attack/armor data, civilization identity, unit lines, and technology effects. Openage has civilization and unit-stat reference files plus technology research notes. | **Partial** — workers, infantry, archers, Town Center, Barracks, Archery Range, population cap, production queues, and a small set of attack upgrades. | **Slice** — make the small roster and its roles legible and balanced. **Candidate** — more roles, faction asymmetry, and a larger technology tree after the core loop works. |
| Age progression, civilization bonuses, unique units/technologies, tech prerequisites, and broad unit counters. | **Absent or very limited** — no ages or civilization roster; only a narrow upgrade system exists. | **Candidate/Open** — do not assume AoE2 breadth; test whether asymmetry helps the game's army-scale promise. |
| Campaign characters, heroes, campaign missions, and authored campaign progression. | **Absent.** | **Out** — no campaign in the current product goal. |

### 5. Selection and command vocabulary

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Single selection, drag box, double-click/class selection, groups, queued commands, and selection feedback. | **Present/Partial** — single, box, class, double-click, and control-group selection; order feedback and queued waypoints exist. | **Slice** — reliable selection and command acknowledgment with large groups. Study AoE2 and Warcraft usability, but do not inherit their legacy selection caps; the project must support large selections. The [Warcraft inventory](warcraft-rts-inventory.md) records the remaster-specific changes. |
| Stop, move, attack, attack-move, attack-ground, delete, stance, guard, follow, patrol, formation, and waypoints appear in Openage's reverse-engineered action list. | **Partial** — move, attack, attack-move, direct attack, queued move/attack waypoints, and box/line/column destination layouts. Several other orders are absent. | **Slice** — finish and teach the small set of high-value army orders. **Candidate** — add a command only when it solves a demonstrated tactical need. |
| Building rally points and idle-worker selection. | **Present/Partial** — production rally, control groups, and idle worker selection exist; polish and consistency remain part of the slice. | **Slice** — clear, predictable production and worker control. |

### 6. Movement, pathfinding, and formations

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Terrain-aware path planning, waypoints, blocked-route handling, and movement around structures and choke points. | **Present/Partial** — server-side pathfinding, queued routes, route repair after obstruction, and large-army choke workloads have dedicated scenarios. | **Slice** — formations must keep moving and recover from map changes in real matches. Retain performance measurements with route quality and order latency. |
| Formation composition, subformations, unit ordering, spacing, arrival coordination, and movement behavior. Openage's formation note studies these as separate problems. | **Partial** — box, line, and column destinations plus formation assignment; the richer grouping/cohesion behaviors described in the reference are not all implemented. | **Slice** — predictable mass movement through narrow routes. **Open** — choose the amount of cohesion that remains readable and responsive at 1,000+ units. |
| Shared flow/integration fields, sectors/portals, caching, and other pathfinding approaches. | **Research only** — Openage provides useful algorithms and code; this project has not adopted its flow-field implementation. | **Candidate** — compare against measured bottlenecks before replacing the current pathfinder. |

### 7. Combat and unit interaction

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Attack damage, armor interaction, projectile accuracy, range, target size, friendly fire, and damage from projectiles. Openage has dedicated reverse-engineering notes for damage and accuracy. | **Partial** — units attack units/buildings and ranged units fire; attack upgrades and focus-fire behavior are exercised. Full class-based armor, accuracy, and projectile rules are not implemented. | **Slice** — combat should produce readable outcomes and meaningful counters with the small roster. **Candidate** — deeper damage formulas where they improve choices. |
| Garrisoning, conversion, healing, relics, and special interactions; Openage has notes on garrison, monk conversion, and relic rates/actions. | **Absent.** | **Candidate** — each creates new unit roles and UI needs; evaluate as a coherent feature group. |
| Damage alarms, destruction effects, defeat/elimination, and cleanup. | **Partial** — attack state, destruction, elimination, and victory are represented; richer alerts and presentation remain. | **Slice** — communicate threats, losses, and match end without obscuring command. |

### 8. Buildings, construction, and production

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Placement rules, construction work, repair, production queues, research, and rally points. | **Partial** — placement and construction for current building types, production queues, population reservations, rally points, and selected research. No general repair system. | **Slice** — finish build placement and production feedback, and keep orders robust under congestion. |
| Walls, gates, gate toggles, garrison capacity, Town Bell, and back-to-work behavior appear in Openage's building/network action notes. | **Absent.** | **Candidate** — do not add until maps and playtests show a strong need for these defense/worker controls. |
| Detailed building footprints, collision, path opening after destruction, and placement validation. | **Partial** — buildings occupy map space; attack/destruction and movement through a cleared footprint are covered by focused scenarios. Broad placement edge cases still need game-level review. | **Slice** — maps and orders must remain valid as structures are placed, attacked, and removed. |

### 9. Objectives, triggers, and scenario rules

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Scenario objectives, prerequisites, timed victory, event conditions/effects, and win/loss feedback. | **Present/Partial** — capture objectives, prerequisites, hold/deadline victory, timed/capture/completed-event triggers, branching/joining chains, repeat deliveries, rewards, announcements, and match result. | **Slice** — author and finish one full scenario; validate unreachable or contradictory setups and give clear runtime feedback. |
| General scripting, arbitrary triggers/actions, campaign/editor systems proposed in Openage idea docs. | **Partial/Absent** — current event types are deliberately bounded and data-authored; no general-purpose script runtime or campaign editor. | **Slice** — keep event authoring understandable and validated. **Candidate** — expand trigger vocabulary from scenario needs. Campaign editing is **Out**. |

### 10. Map and scenario authoring

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Terrain painting, dimensions, resources, player starts, objectives, scenario settings, and editor validation. Openage's editor pages are proposals, not a complete shipped editor specification. | **Present/Partial** — Map Studio paints terrain and map objects, sets dimensions/fog/starting resources, edits capture objectives and event chains, validates JSON, imports/exports, autosaves local drafts, and publishes maps to the room. | **Slice** — a host can make, validate, save, reload, and play a balanced scenario without hand-editing JSON. Improve error guidance and cover normal authoring workflows. |
| Unit/building placement, arbitrary trigger scripting, terrain height tools, campaigns, and shared mod packages. | **Absent or limited.** | **Candidate** — prioritize only from authoring playtests. Campaign tools are **Out**. |
| Scenario compatibility/version migration, asset manifests, moderation, and public sharing. | **Absent/Partial** — room-persisted JSON maps exist; no public catalog or package ecosystem. | **Candidate** — needed if sharing expands beyond invite rooms; retain safe validation and versioned formats. |

### 11. Multiplayer, reliability, and operations

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Lobby and action synchronization, networked commands, disconnect/resign, chat, and game settings. Openage packet notes document the legacy protocol; they are historical evidence, not a modern service blueprint. | **Partial** — authoritative Node match worker per room, invite links/codes, two player seats, isolated room state, reconnect windows, and periodic checkpoint recovery. No in-game chat or public matchmaking. | **Slice** — prove deployed 1v1 under measured latency/loss and make recovery understandable. Keep server authority and room isolation. |
| 1,000+ units, state bandwidth, tick performance, browser rendering, and concurrent rooms. | **Partial** — local scenarios and browser/performance harnesses cover 2,000 total units; local measurements do not prove hosted capacity or internet quality. | **Slice** — establish the target hardware/network budgets and verify them in a deployed environment. Scale room count from measurements. |
| Accounts, matchmaking, ranked play, moderation, spectator/casting, tournaments, replays, and persistent progression. | **Absent.** | **Candidate** — accounts, public matchmaking, and ranked play are explicitly later in the Game Bible; evaluate the remaining service features when player needs are clear. |

### 12. Interface, communication, and after-match review

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| Minimap, command and selection feedback, objective display, status alerts, configurable hotkeys, zoom, picture-in-picture, and warplanning ideas. | **Partial** — tactical minimap, selection/command HUD, objective/event cards, camera controls, and match result. Keyboard customization, PIP, and warplanning are not present. | **Slice** — controls and status must stay legible and teachable. **Candidate** — advanced planning and display tools based on playtests. |
| End-of-match statistics, replay/observer tools, and social presentation. | **Absent or basic** — match result exists; no detailed post-match statistics or replay. | **Candidate** — decide after players can finish and discuss a full match. |
| Audio cues, unit acknowledgments, music, and original art/animation coverage. | **Partial/Absent** — visual placeholders and alerts exist; no complete original audio/animation set. | **Slice** — build a coherent readable visual/audio language. All production art, sounds, names, and writing must be original or properly cleared. |

### 13. AI, campaigns, and content ecosystem

| Reference coverage to track | Prototype 0.95 | Project lane and note |
| --- | --- | --- |
| AI command interfaces and behaviors appear in Openage networking notes and an early AI idea draft. | **Absent** — the prototype is designed around two human players. | **Candidate/Open** — first prove the multiplayer skirmish. A basic opponent may help testing or solo play later; the Openage idea draft is not a requirements spec. |
| Campaign missions, campaign editor, and story progression. | **Absent.** | **Out** — no campaign in the current goal. |
| Modding, replacement data, packages/dependencies, asset conversion, and compatibility with original game data. | **Research only** — Openage's engine has its own mod/data architecture and compatibility goal. | **Candidate** — versioned original scenario sharing may be useful later. Exact Genie compatibility and commercial-game data conversion are **Out**. |

## Current vertical-slice gates

Use these as the active acceptance checklist; feature counts alone do not make a game ready:

- [ ] A new player can join, select a map, understand controls and objectives, and start play without developer coaching.
- [ ] At least one original scenario can be authored in Map Studio, validated, saved, reloaded, and played from opening economy through a clear victory.
- [ ] The small roster and economy create at least two viable responses to the scenario's main tactical problem.
- [ ] Large-army orders stay predictable through chokes, combat, building placement, destruction, and reconnection.
- [ ] Both players receive clear command results, objective changes, recovery notices, match end, and rematch/reset options.
- [ ] A deployed 1v1 is measured under realistic latency and packet loss; performance budgets are based on target hosting hardware.
- [ ] A small outside playtest confirms that players can finish a match and explain which choices mattered.

## Source map and evidence quality

Links are pinned to the Openage source snapshot used by the [Openage Source Study](openage-study.md), so future upstream changes do not silently change the research basis.

| Evidence label | Where to look | How to interpret it |
| --- | --- | --- |
| **AoE2 reverse-engineering notes** | [Game mechanics](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/game_mechanics), [networking/action notes](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/networking), [unit stats](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/unit_stats), [civilizations](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/civilizations.md). | Useful observed/reconstructed mechanics and protocol behavior. Coverage and confidence vary; protocol details explain the legacy game and are not a recommended modern architecture. |
| **Openage architecture/design** | [Simulation overview](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/code/game_simulation), [event system](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/code/event_system.md), [nyan data](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/nyan). | Shows how Openage intends to structure its engine/content. It is a design and implementation reference, not proof of feature parity. |
| **Openage ideas/proposals** | [Gameplay ideas](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/ideas/gameplay.md), [interface ideas](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/ideas/interface.md), [AI draft](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/ideas/ai.md), [editor proposals](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5/doc/ideas/editor). | Brainstorming and proposals, sometimes experimental or humorous. Use as candidate ideas only, not as an AoE2 feature checklist. |
| **Implementation limits** | [Openage README](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/README.md), especially its gameplay-status note; [building-placement note](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/game_mechanics/building_placement.md). | At the checked snapshot, Openage says gameplay is largely nonfunctional during a simulation rebuild. Some mechanic pages explicitly say they are incomplete; building placement says it remains to be filled out. |

## Maintenance rule

When a playtest or engineering result changes a row, record the decision here and update the concise product contract in the [Game Bible](../game-bible.md). Keep a reference observation separate from the project decision. Do not change a row to “present” until the feature works in a complete match or authoring flow, not merely because a data field, prototype control, or isolated helper exists.
