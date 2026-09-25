# Renderer visual-state and asset-pack contract v1

This contract separates authoritative match state from the visual cues that consume it. It is the integration boundary for character/building GLB packs and environment state sprites. The current procedural Three.js objects remain the shipped visual baseline until a later renderer-integration checkpoint.

The machine-readable manifest shape is in [renderer-asset-pack-v1.schema.json](../schemas/renderer-asset-pack-v1.schema.json). Validate a pack with:

    node scripts/validate-visual-pack.mjs path/to/manifest.json

## Coordinate, material, and batching rules

- Project world units are map-cell units. Three-dimensional assets use +Y up, +Z forward, +X right, with a ground-center root at (0, 0, 0) and no baked root rotation.
- A worker is about 0.8 world units tall. The Barracks footprint is 3 by 3 world units.
- The character/building source pack uses glTF 2.0 binary files. Unit meshes are static rigid geometry with stable part node names and pivots. The renderer flattens those parts once and updates per-instance matrices; no per-unit Three.js objects, per-unit materials, skinning, or morph targets.
- Character/building GLBs use flat base colors and vertex colors in v1, without embedded image textures. This keeps the palette slots explicit and avoids another texture-memory path in the first pack.
- Unit parts use a shared geometry set across Azure and Ember. There are at most eight distinct unit batch keys across all unit roles and at most sixteen team-part batches total. Unit team variants reuse the same geometry; only separated cloth, shield, banner, and ownership-trim material slots receive team tint. Neutral materials stay shared.
- The camera keeps its 0.48 strategic zoom. Full unit meshes serve the 0.91 ordinary view; at zoom 0.62 and below, a renderer-owned instanced LOD shows worker body/tool, infantry spear/shield, and archer bow/quiver silhouettes. Azure uses a square hue marker and Ember a diamond hue marker. The LOD has eight fixed batches (three roles for each team plus two team markers), replaces the full unit batches at far zoom, and creates no per-unit objects or text.
- GLB material names begin with neutral- or team-accent- to match the corresponding manifest paletteSlot. Each part node contains one palette slot so the renderer can tint only the intended surfaces.
- The shared v1 unit-key registry is: unit.humanoid-core, unit.team-accent, unit.worker.backpack, unit.worker.tool, unit.infantry.shield, unit.infantry.spear, unit.archer.bow, and unit.archer.quiver. The first Worker sample uses the first four keys; the last four are reserved for the later Infantry and Archer samples. Reusing a key requires the exact same source model file and node, not a role-specific lookalike.
- Building meshes are grouped per structure because building counts are low. The Barracks model provides ground, gate, standard, rally, and productionCue anchors. The production cue is a renderer-owned signal attached at productionCue and is not baked into the model. A building part may declare `teamVariant: { group, team }` for a team-specific silhouette. Each group must have one Azure and one Ember part, both in the `team-accent` palette slot. For the Barracks standard, the GLB nodes are `barracks.standard.azure` and `barracks.standard.ember`; the manifest part IDs are `standard-azure` and `standard-ember`, both in group `standard`. Runtime includes shared parts plus only the variant matching the building owner. Unit parts cannot use `teamVariant`.
- Environment props remain fixed-camera, camera-facing transparent cutouts. Each state has a full-resolution source PNG and runtime WebP, batched by asset and state. Runtime WebPs may be downsampled; each file records its own pixel dimensions, aspect ratio must stay within 1%, and the asset `dimensionsPx` records the runtime size. Variants in one resource family share runtime pixel dimensions, world dimensions, and the bottom-center [0.5, 1.0] pivot. Runtime width and height are declared in world units. This keeps the current texture loader and avoids a custom atlas shader.
- Team color never tints ground or environment cutouts. Azure uses #5AA7D7 and Ember uses #E67A5E in the world. The brighter #73B8E8 and #EF886C values are UI-only.
- Every source and runtime file records its SHA-256, license, and provenance. Paths are relative to the manifest directory.

## Unit state mapping

The renderer derives these states from the current filtered state snapshots. No new server fields are required.

| Visual state | Current source | Renderer interpretation |
| --- | --- | --- |
| idle | Living unit, no movement, work, or one-shot event | Rest pose; low-amplitude idle motion may continue at a bounded cadence. |
| walk | Position changes between snapshots | Walk pose and stride phase. Worker task moving or returning uses this state; cargo remains a separate carried-resource cue. |
| turn | Client-facing angle changes | Turn pose or turn overlay; it may overlap a walk transition. |
| gather | Worker task is gathering | Generic work pose until cargoType is known. Then wood maps to chopping and food maps to berry-gathering; no resource-specific cue is inferred before cargoType appears. |
| build | Worker task is building | Work pose for construction. |
| attack | A fresh lastAttackTick arrives | One-shot strike/release. The optional target point is used only when supplied by the fog-filtered snapshot. |
| hit | HP decreases and remains above zero | Brief recoil and damage flash. |
| defeat | HP changes from positive to zero or below | One-shot defeat pose, then hide the unit. |
| spawn | A reused unit ID has a new generation, or a produced unit first appears | Short spawn-in pose. |

Attack and hit are transient overlays. Defeat takes precedence and is terminal for that generation. Movement, turning, worker task, cargo, and team remain separate facts so an attack cue does not erase task state. Enemy positions and attack target coordinates continue to follow the server's visibility filtering; the renderer does not infer hidden state.

The first authored review pack provides four concrete samples: Worker idle, Worker build, Barracks mid-construction, and Barracks complete. A static review board is optional when browser policy disallows it; the game-rendered screenshots in the integration checkpoint are the appearance review. The manifest can add more state samples without changing the renderer contract.

## Building state mapping

| Visual state | Current source | Renderer interpretation |
| --- | --- | --- |
| construction | progress in [0, 1] and complete | Reveal construction layers from the normalized progress value; complete selects the finished silhouette. |
| damage | hp and maxHp; hp changes identify a fresh hit | Derive health ratio and damage stage from hp/maxHp. Initial worn and critical cut points reuse the current UI breakpoints at 55% and 25%; art review may tune them. |
| under attack | attackers count | Optional localized under-attack feedback. |
| production active | queue has at least one item and productionBlocked is false | Show the renderer-owned cue at productionCue. Training progress may drive its pulse or fill. |
| production blocked | queue has at least one item and productionBlocked is true | Keep the cue visibly paused or subdued. Do not show an active-production cue. |

Barracks state is derived from existing fields: progress, complete, hp, maxHp, attackers, queue, trainingProgress, and productionBlocked. Queue length is read from the current queue representation. State art must not obscure the footprint, selection outline, health indicator, or rally marker.

## Resource and construction-site state mapping

Resource percentage is floor(clamp(stock / startingStock, 0, 1) * 100), using the map definition's starting stock and the latest visible resource-node snapshot. The stage names and inclusive integer bands are:

| Stage | Percent |
| --- | --- |
| full | 67–100 |
| worked | 34–66 |
| low | 1–33 |
| depleted | 0 |

The environment manifest contains these four stages for wood and food nodes. Within a resource family, all stages use the same runtime pixel dimensions, world dimensions, and pivot so swapping stages does not move the prop. A depleted wood or food node remains an understandable map feature; its existing resource ring can continue to communicate stock state.

Construction ground treatment uses the same server progress:

| Stage | Condition |
| --- | --- |
| clear | No incomplete building or building is complete; no decal is rendered. |
| earthwork | Incomplete building and progress below 0.4. |
| foundation | Incomplete building and progress from 0.4 up to, but not including, 1. |

The clear state has no image file. Site decals are grouped by state and remain under the building footprint.

## Manifest budgets and validation

The manifest validator is intentionally scoped to these first packs. It checks the v1 shape, per-file hashes and provenance, GLB part and anchor names, declared dimensions and origins, source/runtime image dimensions and pivots, estimated runtime texture memory, and projected instancing/draw-call counts. Character/building manifests include the eight-key unit registry with active or reserved entries. Every active key resolves to one model file and node; unit assets reference those exact entries. Barracks draw calls count shared parts plus the larger of the two team-specific variant sets, since only one set is shown for a structure at runtime.

Runtime texture memory is estimated as unique runtime image pixels times four bytes per pixel with a 4/3 mip allowance. This is a conservative RGBA8 estimate, not compressed download size. The agreed budget for the first environment state pack is 100,663,296 bytes (96 MiB) per pack. Its current 83,884,376-byte projection leaves about 20% headroom; this is not a whole-application GPU cap. The integration review still measures actual residency at 2× display density and max camera zoom 2.3. If that exceeds the pack budget or the states need more detail, compare 768- and 512-pixel longest-edge runtime WebPs while retaining the PNG masters. Unit batch projection is the count of active unique unit batch keys times two teams. Environment projection is the count of distinct non-empty asset/state batches. Building projection is the shared part count plus the maximum team-variant part count for one structure, because each structure is a small grouped object.

The game-rendered play-zoom view is the appearance gate for the sample pack. The next renderer-code checkpoint must separately show zoom 0.91 and strategic zoom 0.48, both teams, fog-safe visibility, and a measured 2,000-unit browser run. Zoom 2.3 is optional close-up review and cannot substitute for either required view. Contract documentation and manifest validation do not substitute for that runtime evidence.
