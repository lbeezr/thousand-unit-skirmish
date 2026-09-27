# Openage source study

[Documentation index](../README.md) · [RTS coverage](feature-coverage-inventory.md)

**Historical study:** checked 25 September 2026 against Openage
`abfc45a2563656bd10bc14c25756cf26391612b5` and openage-data
`7a1beff0533083faf46ebfc847b3469101f3537e`. Links below are pinned to those snapshots;
this rewrite does not claim a new upstream audit.

## Scope and findings

The recorded study inspected project/subsystem documentation, simulation and
pathfinding code, asset inventories/license notes, and two terrain images. No
Openage code or assets were copied into this project.

At the checked snapshot, Openage described a Genie-engine recreation and warned
that gameplay was largely nonfunctional during a simulation rebuild. Its
C++20/Python/Cython/Qt/OpenGL stack and commercial-data compatibility goals differ
from this project's Node/Three.js authoritative skirmish.

## Useful principles

| Observation | Application here |
| --- | --- |
| Separate simulation from input, rendering, networking, and scripting. | Keep server rules independent of browser presentation. |
| Compose capabilities and represent longer behavior as activities/commands. | Use explicit worker/combat state transitions when complexity warrants it. |
| Schedule against simulation time. | Preserve checkpoint-safe authored event timing. |
| Share/cached flow fields and route guidance. | Compare against existing A*/shared paths only for a measured bottleneck. |
| Separate static definitions from runtime state. | Validate maps/content independently from match checkpoints. |
| Record observed behavior and unknowns. | Keep reference observation, project interpretation, and decision separate. |

## Boundaries

Legacy packet notes explain a historical game; they are not a ready authoritative
network service. Idea pages are proposals, not completed feature evidence.
Exact Genie compatibility, commercial-data conversion, and engine porting are
outside this project's current scope.

The asset audit found six audio files, two 512 × 512 grass textures, and 25 empty
placeholders in the checked openage-data tree. The recorded repository terms
were CC BY-SA 4.0-or-later for data and GPLv3-or-later for code, with per-file
authorship to retain. Nothing was vendored; inspect current per-file terms if a
future task proposes reuse. Original project art remains the production direction.

## Follow-up research

Study a specific simulation boundary or pathfinding workload when a concrete
problem calls for it. Compare route quality, throughput, acknowledgement latency,
ticks, and memory under the same scenario. Keep the current implementation if a
replacement does not improve the measured problem.

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
