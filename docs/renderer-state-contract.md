# Renderer state and asset-pack contract v1

[Documentation index](README.md) · [Asset guide](assets.md)

This is the compatibility contract for renderer-v1 GLB/environment manifests and
snapshot-driven visual cues. Captured buildings and sprite-atlas candidates have
[separate formats](assets.md). Source candidates may declare incompatibilities;
runtime adoption must resolve them explicitly.

The normative manifest is
[renderer-asset-pack-v1.schema.json](../schemas/renderer-asset-pack-v1.schema.json).

```sh
node scripts/validate-visual-pack.mjs path/to/manifest.json
```

## Coordinates, materials, and batches

- One world unit equals one map cell. GLBs use +Y up, +Z forward, +X right,
  ground-center origin `(0,0,0)`, and no baked root rotation.
- Units are roughly 0.8 units tall; Barracks/Range footprints are 3 × 3.
- V1 GLBs use static rigid named parts, flat/vertex colors, and no embedded
  image textures, skinning, or morph targets. Painted-atlas samples require a
  compatible extension and loader; they are not implicitly v1 runtime packs.
- Flatten unit parts once and instance them. No per-unit objects or materials.
  At most eight shared unit keys × two teams produce sixteen part batches.
- Material names begin with `neutral-` or `team-accent-` and match the manifest
  palette slot. Each part contains one slot. Authored gear stays neutral; a sash
  carries unit team tint. Reusing a batch key requires the same model file/node.
- World hues are Azure `#5AA7D7` and Ember `#E67A5E`; UI hues are `#73B8E8` and
  `#EF886C`. Ground/environment art is never team-tinted.
- Paths are manifest-relative. Every source/runtime file records hash, provenance,
  and license information.

The unit-key registry is `unit.humanoid-core`, `unit.team-accent`,
`unit.worker.backpack`, `unit.worker.tool`, `unit.infantry.shield`,
`unit.infantry.spear`, `unit.archer.bow`, and `unit.archer.quiver`.
Active entries resolve to exact source nodes; reserved entries can support later roles.

## Strategic unit rendering

At zoom ≤0.91, the current renderer uses role silhouettes plus square/diamond
team markers: three role batches per team plus two marker batches. Neutral gear
and the Worker backpack facet remain in the existing role geometry. Cargo adds
no batch and stays neutral at this LOD.

Update active-role and marker matrices only when their inputs change. Role changes
clear old/new slots; upload dirty batches. Full-detail pose/tint work can pause
while LOD is active and refresh on return. Focus rings likewise update on changed
focus, position, or scale. Batched implementation is not proof that every role
reads well; use the appearance matrix below.

## Unit visual states

| State | Source and rule |
| --- | --- |
| Idle | Living, stationary, no active task/event; restrained bounded idle motion. |
| Walk / turn | Position/facing changes. Movement suppresses a retained work swing. |
| Gather | Worker gathering task; generic while cargo type is unknown, wood/food pose once known. |
| Build | Worker building task, while stationary at work. |
| Attack | Fresh `lastAttackTick`; deduplicate and use target coordinates only if present. This is not proof of damage. |
| Hit | Positive HP decreases. |
| Defeat | HP reaches zero; terminal for that generation. |
| Spawn | New unit or reused ID with a new generation; reset transient state and the animation clock. |

Attack/hit are overlays; defeat takes precedence. Full-detail cargo can tint the
existing backpack leaf green for wood or amber for food. Flush changed color
buffers once per team after reconciliation. Authored material stays neutral.
The actual server task strings are documented in the
[command contract](gameplay-command-observation-contract.md#state-consumed-by-rendering).

A reused generation starts its first sprite frame at elapsed zero, including
when death and replacement are coalesced between snapshots or atlas loading is
still pending. The prior generation's clock cannot advance the new role's clip.

## Building parts and state

Buildings can use grouped parts because counts are low. Architecture is neutral;
team identity comes from one owner-matched standard. Barracks anchors include
ground, gate, standard, rally, and `productionCue`.

`teamVariant: {group, team}` is allowed only for paired building standards in the
`team-accent` slot. Each group needs Azure and Ember variants; units cannot use
this field. Barracks nodes are `barracks.standard.azure`/`.ember`, with part IDs
`standard-azure`/`standard-ember` in group `standard`. Draw shared parts plus
one matching variant. Production signal geometry remains renderer-owned.

| Visual state | Mapping |
| --- | --- |
| Procedural Barracks construction | Foundation/frame/walls/roof at 0/25/50/75%; details at 90% or authoritative complete. |
| Other procedural construction | Existing 90% roof reveal; ground cue lasts until complete. |
| Damage | `hp/maxHp`; procedural worn/critical thresholds 55%/25%. Pack-specific captured/sprite thresholds come from their own manifests. |
| Under attack | Visible `attackers` count. |
| Production active | Complete, queue nonempty, not blocked: active cue at `productionCue`. |
| Production blocked | Complete, queue nonempty, blocked: muted/static cue. |
| Production idle | Hide production cue. |

Keep footprint, selection, health, and rally readable. Barracks/Range direct
sprites use construction thresholds 20%/90% and completed-health thresholds
66%/33% in `src/building-sprites.mjs`; procedural geometry is their fallback.
The captured Town Center loader is a separate path: starting landmarks use
Complete, while constructed Town Centers pass live progress and health. The
loader exposes existing fallback art if the current state/view load fails.
Complete-only Frontier preview families also yield to fallback for
unavailable construction/damage states. Collision remains server-owned.

Captured-building manifest attempts are shared by URL. A manifest HTTP 404 keeps
fallback until `invalidateCapturedBuildingManifest(url)` is explicitly called;
other failures allow at most one shared retry every five seconds after failure.
The next renderer update admits retries. Invalidation bypasses the cooldown,
reloads that URL for all its consumers and ignores retired manifest/frame results.
Successful requests stay cached; other URLs remain independent. See the
[retry evidence](qa-building-manifest-retries-2026-10-01.md).

## Environment stages and fog

For ordinary resource nodes, compute
`floor(clamp(stock / startingStock, 0, 1) * 100)` from map initial stock and the
latest visible state. Hidden IDs are omitted deliberately; retain their last-known
stage and never infer offscreen depletion.

| Stage | Inclusive integer percent |
| --- | --- |
| `full` | 67–100 |
| `worked` | 34–66 |
| `low` | 1–33 |
| `depleted` | 0 |

Family variants share runtime dimensions, world size, and bottom-center pivot
`[0.5,1.0]`. Source/runtime aspect ratio stays within 1%; each file records its own
pixel dimensions. Move an instance between state batches and update only old/new
batches. Render only nonempty batches.

Construction ground uses no image for `clear`, `earthwork` below progress 0.4,
and `foundation` from 0.4 until completion. A completed structure clears its decal.
Forest-cell clearing uses its own visible stock data rather than inventing
ordinary resource IDs.

## Budgets and validation

The validator checks shape, safe paths, hashes, provenance, image dimensions/pivots,
GLB parts/anchors, declared origins/bounds, and projected batches/memory.
Building projection is shared parts plus the largest single team-variant set.
Environment projection counts nonempty asset/state batches.

Texture estimate: unique runtime pixels × four RGBA8 bytes × 4/3 mip allowance.
The first interactive environment pack estimates 83,884,376 bytes against a
100,663,296-byte (96 MiB) pack cap. This is not compressed transfer size or measured
whole-application GPU residency. If measurement/readability requires smaller
runtime images, compare 768/512-pixel longest-edge derivatives and preserve masters.

## Appearance checks

- `renderer-environment-state-preflight`: manifest/hash/dimension checks and matrix plan.
- `renderer-environment-state-pilot`: four representative stock-driven frames.
- `renderer-environment-state`: ten image-bearing states × two grounds × two zooms,
  plus a no-overlay assertion for clear construction.
- `renderer-appearance-lod`: two grounds × two viewers × two zooms with mixed roles.

The game-dev adapter defines these scenarios. Environment captures verify both
clients loaded exact files and that sampled nodes are visible. Gather from stock
100 to representative 100/50/20/0 stages. A 1280 × 720 CSS viewport at DPR 2 yields
2560 × 1440 PNGs. Generic fallback images preserve continuity but fail pack-specific
appearance claims. Inspect pixels before marking visual review complete.

See [environment evidence](qa-evidence/environment-state-pack-v1/pilot/README.md).
M2 appearance and M3 measured 2,000-unit performance are separate claims, with
proportionate checks for narrower changes.
