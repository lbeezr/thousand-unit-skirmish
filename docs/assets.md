# Asset guide

[Documentation index](README.md) · [Art direction](art-direction-contract-v1.md)

## Choose the right path

| Work | Guide / contract |
| --- | --- |
| Shared palette, scale, team identity, readability | [Art direction](art-direction-contract-v1.md) |
| Who owns an asset outcome | [Art production lanes](art-production-lanes.md) |
| Match state → rendering | [Renderer contract](renderer-state-contract.md) |
| New building concepts → models → captured views | [Preferred building pipeline](building-asset-production-pipeline.md) |
| Direct 2D building frames | [Sprite production workflow](building-sprite-production-workflow.md) |
| Sprite pages, layers, pivots, masks, and clips | [Sprite-atlas contract](sprite-atlas-contract-v1.md) |
| Unit roles and building silhouettes | [Unit/building kit](unit-building-art.md) |
| Ground, rocks, vegetation, and terrain review | [Environment pack](environment-pack-v1.md) |
| Resource depletion and construction ground | [Environment states](environment-state-pack-v1.md) |
| Native cursors and HUD icons | [UI asset contract](ui-cursor-icon-contract.md) |

## Know what is actually in game

At the documentation baseline `e4a3731`:

- Environment art uses painted ground and instanced cutouts, including the
  interactive oak/berry/construction state pack.
- Units use procedural instanced geometry and strategic role/marker batches.
  Authored GLB samples remain source candidates.
- Town Centers use the eight-view captured lifecycle pack, with procedural
  fallback. Gameplay supplies only their Complete landmark state.
- Barracks and Archery Ranges use procedural buildings. Their direct sprite and
  construction-atlas packs are candidates awaiting runtime adoption.
- The 40 px Meshy cursor PNGs are integrated. Older 32 px SVGs remain source history.

A file under `runtime/` means an export intended for loading; it does not prove
that the game loads it. Check the loader and pack README before claiming adoption.

## Review locally

Start the game, then open Match Controls:

- **Building Variant Atlas** (`/building-map.html`): building states and methods.
- **Terrain Art Pilot** (`/environment-review.html`): directional cliff/depth pilot.
- **Frontier Materials** map: ground materials and obstacle heights.

Review pages and contact sheets explain an asset. In-game screenshots establish
runtime appearance only when the actual files and state are identified.

## Validate a package

Run the validator that matches its manifest:

```sh
node scripts/validate-visual-pack.mjs assets/environment/frontier-interactive-v1/manifest.json
node scripts/validate-sprite-atlas.mjs assets/buildings/archery-range-construction-v1/sprite-atlas-pack-v1.json
npm run validate:painted-material-atlas
```

`source/authoring-manifest.json` in the GLB samples is not a renderer v1 manifest.
Do not pass it to the runtime validator. Read the sample's own inspection commands.

## Keep the package reviewable

Each pack README should state purpose, maturity, contents, build/validation
commands, integration status, and known limits. Manifests own dimensions, anchors,
state thresholds, paths, and hashes. Provenance owns source lineage, exact prompts,
provider IDs, and recorded spend. Preserve these factual records when editing prose.

Keep source, runtime-candidate, integrated, and visually reviewed statuses distinct.
Update hash records when their covered documentation changes. Use ordinary and
strategic game views for readability; reserve measured performance claims for a
comparable run on the integrated renderer.
