# Archery Range sprite pack v1

This source/runtime pack replaces the prototype Archery Range meshes in the next renderer migration. It uses the same **5 × 5 world-unit frame**, **640 × 640 pixels**, **128 px per world unit**, and projected ground-center anchor as the Barracks sprite test. The gameplay footprint remains 3 × 3 cells.

The five authored states are foundation, frame, complete, damaged, and critical. Construction uses the foundation/frame/complete frames at the thresholds in [`sprite-grid.json`](sprite-grid.json); completed health uses complete/damaged/critical. The runtime derivatives include Azure and Ember team colors, with only saturated Azure cloth pixels shifted to the Ember hue.

`source/` retains the generated full-size transparent PNGs. `runtime/` contains normalized 640 × 640 WebP frames. `preview/` contains labeled state strips with the 3 × 3 projected footprint overlay. Regenerate both team variants and the review strips with:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset archery-range
```

## Current limits

- One fixed 45-degree azimuth is authored. This pack does not support rotating the camera or building.
- It has color and alpha only; view-relative depth and scene-occlusion integration remain renderer work.
- Season and lighting variants are not authored.
- Runtime frame generation is complete, but the game has not yet been switched from the Archery Range model to this pack.

See [`PROVENANCE.md`](PROVENANCE.md) for source prompts, output IDs, and file hashes.
