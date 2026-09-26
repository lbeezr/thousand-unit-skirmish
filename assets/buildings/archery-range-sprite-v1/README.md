# Archery Range sprite pack v1

This source/runtime pack replaces the prototype Archery Range meshes in the next renderer migration. It uses the same **5 × 5 world-unit frame**, **640 × 640 pixels**, **128 px per world unit**, and projected ground-center anchor as the Barracks sprite test. The gameplay footprint remains 3 × 3 cells.

The five authored states are foundation, frame, complete, damaged, and critical. Construction uses the foundation/frame/complete frames at the thresholds in [`sprite-grid.json`](sprite-grid.json); completed health uses complete/damaged/critical. The runtime derivatives include Azure and Ember team colors, with only saturated Azure cloth pixels shifted to the Ember hue.

`source/` retains the generated full-size transparent PNGs. `runtime/` contains normalized 640 × 640 WebP frames. `preview/` contains labeled state strips with the 3 × 3 projected footprint overlay. Regenerate both team variants and the review strips with:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset archery-range
```

[`sprite-atlas-pack-v1.json`](sprite-atlas-pack-v1.json) is the canonical runtime-candidate sidecar. It retains hashes for the original 1254 × 1254 sources, links lossless aligned 640 × 640 PNG source pages to each Azure/Ember runtime page, and declares full-canvas frame rectangles, measured alpha bounds, both team variants, lifecycle-state clips, the projected ground pivot, and draw/sort bounds. The existing [`sprite-grid.json`](sprite-grid.json) remains unchanged as the source for the 5 × 5 art frame and construction/health thresholds. Its 3 × 3 gameplay footprint is carried only as a recommendation hint; map/gameplay data owns occupied cells. The ground pivot is marked `unreviewed-estimate` because the pack's projection formula has not received a separate visual review.

The generated [runtime atlas preview](preview/archery-range-sprite-v1-atlas-preview.html) uses the canonical sidecar and allows state, team, background, pivot, and alpha-bound inspection. Regenerate it with:

```sh
node scripts/preview-sprite-atlas.mjs assets/buildings/archery-range-sprite-v1/sprite-atlas-pack-v1.json --runtime --out assets/buildings/archery-range-sprite-v1/preview/archery-range-sprite-v1-atlas-preview.html
```

## Current limits

- One fixed 45-degree azimuth is authored. This pack does not support rotating the camera or building.
- It has color and alpha only; view-relative depth and scene-occlusion integration remain renderer work.
- Season and lighting variants are not authored.
- Runtime frame generation is complete, but the game has not yet been switched from the Archery Range model to this pack.
- The canonical manifest and browser preview describe the pack; renderer loading, state selection, and in-game appearance remain pending.

See [`PROVENANCE.md`](PROVENANCE.md) for source prompts, output IDs, and file hashes.

See the [building sprite production workflow](../../../docs/building-sprite-production-workflow.md) for the reusable complete-first design, lifecycle derivation, grid, review, and packaging method.
