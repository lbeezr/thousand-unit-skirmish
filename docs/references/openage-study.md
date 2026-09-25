# Openage Source Study

- **Purpose:** use openage as a detailed architectural and design reference for Thousand Unit Skirmish.
- **Checked:** 25 September 2026.
- **Source snapshot:** [`SFTtech/openage` at `abfc45a`](https://github.com/SFTtech/openage/tree/abfc45a2563656bd10bc14c25756cf26391612b5).
- **Asset snapshot:** [`SFTtech/openage-data` at `7a1beff`](https://github.com/SFTtech/openage-data/tree/7a1beff0533083faf46ebfc847b3469101f3537e).

For the project-owned feature tracker derived from this study, see the [RTS Feature Coverage Inventory](feature-coverage-inventory.md). Openage does not provide one authoritative, complete product checklist: relevant material is spread across reverse-engineering notes, engine design documents, and idea pages. The inventory labels those evidence types separately and maps them to this project's current scope.

I cloned both public repositories into a temporary study directory, read the project and subsystem documentation, inspected the simulation and pathfinding modules, checked the asset repository’s file inventory and license notes, and viewed its two terrain PNGs. No Openage code or assets were copied into this project.

## What Openage is

Openage describes itself as a free engine clone of the Genie engine used by Age of Empires, Age of Empires II HD, and Star Wars: Galactic Battlegrounds. Its goal includes reproducing the old games’ behavior and converting their game data. The project explicitly says it does not ship the original commercial assets. At the source snapshot above, its README warns that gameplay is largely non-functional while the team rebuilds the internal simulation. That makes its documents and subsystem code valuable study material; it is not a ready engine to embed or a playable reference build we can adopt.

Its documented stack is C++20 for the engine core, Python 3 for conversion and scripting, Cython for glue, Qt 6 for UI, and OpenGL for rendering. Our current prototype uses JavaScript, Node.js, and Three.js. The language gap does not block us from adopting useful ideas, but a direct engine port would also import different runtime, rendering, content, and compatibility goals.

## What transfers well

| Openage idea | Why it is useful | Application here |
| --- | --- | --- |
| Keep simulation separate from input, rendering, networking, and scripting. | A game rule can change without coupling it to a particular screen or renderer. | Preserve the current authoritative Node simulation and browser renderer boundary. Treat UI state as a view of server state. |
| Compose entities from small components; keep systems stateless; represent longer behavior as activities and queued commands. | Units can share capabilities without a giant per-unit class, and order behavior is easier to follow. Openage itself cautions that this is not a conventional ECS. | Borrow the separation principle. If worker and combat behaviors grow, make explicit command/activity state machines in JavaScript rather than copying the C++ class structure. |
| Schedule events against simulation time. | Timed work can execute when due instead of checking every possible timer on every unit each frame. | Keep scenario triggers data-authored. Consider a small simulation-time scheduler if profiling shows that timer polling is material; retain checkpoint-safe event state. |
| Use cost, integration, and flow fields, with portals/sectors and field caching. | Shared route guidance can amortize pathfinding when many units head through the same map corridors. | This is the strongest performance experiment to borrow. Compare it against our current A* and shared-path approach on repeated 1,000-unit orders and choke maps before replacing anything. Measure route quality, choke throughput, order latency, tick p95, and memory. |
| Separate persistent unit definitions from runtime match state; describe packages with dependencies, versions, and manifests. | Static balance/content can be validated and distributed independently from a live match. | Keep the present JSON map workflow. When sharing authored scenarios becomes a real playtest need, add a versioned scenario package and asset manifest rather than inventing a new data language immediately. |
| Document the original game’s observed rules and unknowns. | Reverse-engineering notes preserve evidence and prevent assumptions from becoming folklore. | For each design touchpoint, record the observed mechanic, source, our interpretation, and the decision it changes. Do not assume a behavior is desirable just because AoE2 has it. |

## What does not transfer directly

- **The compatibility mission:** Openage seeks an authentic Genie-engine recreation and legacy data conversion. This project is an original browser-first skirmish with its own rules, no campaign, and no requirement to load commercial game data.
- **The engine stack:** C++/Cython/Python, Qt, OpenGL, nyan, and Openage’s build and asset-conversion pipeline do not plug into our Node/Three application as a small library.
- **The current gameplay implementation:** Openage’s own README describes its gameplay as largely non-functional at the checked snapshot. Its goals, reverse-engineering material, and subsystem designs are more useful than treating current code as a complete game blueprint.
- **The networking material:** Openage documents reverse-engineered Age of Empires II packet behavior and lists multiplayer/matchmaking goals. That is useful historical research, but it is not evidence of a drop-in, modern server-authoritative service. Our existing worker isolation, invite rooms, reconnects, checkpoints, and custom snapshots remain the reference implementation for this project.
- **Every AoE2 rule:** formation, selection, pathing, economy, or unit behavior should be studied as a candidate. Our taste floor is readable command of large armies; exact compatibility is not a requirement.

## Asset crawl and provenance

The main Openage repository says it uses original game assets but does not distribute them. It contains engine resources, shaders, interface files, tests, and technical documentation; it is not a legal source of Age of Empires II art or audio for this game.

The separately cloned `openage-data` repository describes itself as a set of free replacement assets for Openage. Its root license states that data is **CC BY-SA 4.0 or later** and code is **GPLv3 or later**, with file authorship and headers to preserve. At the checked commit, its `data/` tree contains six Opus audio files, two 512 × 512 grass textures, and 25 empty `.todo` placeholders. I viewed the two grass images: they are subtle ground-color textures, not a complete terrain kit, unit set, or building set.

Before reusing any external file, inspect its individual provenance and terms, then record attribution and any share-alike obligations in the project’s asset ledger. This study did not vendor any files. The prototype should continue toward its own coherent asset library rather than treating this small partial set as production-ready art.

## Recommended study path

1. **Read the simulation overview and entity/activity docs.** Carry over clean boundaries and explicit per-unit behavior states; leave the C++ details behind.
2. **Prototype one flow-field workload only if needed.** Use the existing 2,000-unit performance harness and compare the same maps/orders. Keep A* if the new pathfinder does not improve the measured bottleneck without hurting movement quality.
3. **Keep authored content data-driven.** Validate and version map/scenario JSON first. Introduce package dependencies or a mod repository only when players need to share or update content at that scale.
4. **Study original networking docs as history.** They may explain familiar RTS expectations, but design our server protocol around our own authority, recovery, security, and bandwidth requirements.

## Sources

All Openage source links below are pinned to the checked commit so later upstream changes do not silently alter what this note refers to.

- [Openage README: goals, stack, assets, licensing, and declared gameplay status](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/README.md)
- [Simulation subsystem overview](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/code/game_simulation/README.md)
- [Game entities, components, systems, and activities](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/code/game_simulation/game_entity.md)
- [Simulation event loop](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/code/event_system.md)
- [Flow-field integration and caching code](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/libopenage/pathfinding/integrator.cpp)
- [Typed nyan content data](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/nyan/README.md)
- [Modpack format, dependencies, versions, and licensing](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/media/openage/modpacks.md)
- [Reverse-engineered AoE2 sync packet notes](https://github.com/SFTtech/openage/blob/abfc45a2563656bd10bc14c25756cf26391612b5/doc/reverse_engineering/networking/03-sync.md)
- [Openage-data README and license summary](https://github.com/SFTtech/openage-data/blob/7a1beff0533083faf46ebfc847b3469101f3537e/README.md)
- [Openage-data copying and attribution instructions](https://github.com/SFTtech/openage-data/blob/7a1beff0533083faf46ebfc847b3469101f3537e/copying.md)
- [Example dry-grass texture](https://github.com/SFTtech/openage-data/blob/7a1beff0533083faf46ebfc847b3469101f3537e/data/terrain/grass/15007_dry_grass.png)
- [Example normal-grass texture](https://github.com/SFTtech/openage-data/blob/7a1beff0533083faf46ebfc847b3469101f3537e/data/terrain/grass/15009_normal_grass.png)
