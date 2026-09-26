# Town Center sprite pack v1

This pack replaces the current static Town Center map-prop mesh with a camera-authored sprite. It shares the Barracks and Archery Range **5 × 5 world-unit frame**, **640 × 640 pixels**, **128 px per world unit**, and neutral daylight palette. Its visible stone base uses a 4 × 4-cell visual support shape; the existing Town Center prop has no gameplay occupancy footprint or health/construction state.

The complete source image produces Azure and Ember runtime WebP frames by shifting only saturated blue cloth pixels to the Ember hue. It uses one fixed camera view. The pack does not yet support camera rotation, building rotation, terrain depth, or directional occlusion.

Regenerate its normalized source page, two runtime frames, review strips, and canonical sidecar from `sprite-grid.json` with:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset town-center
```

Validate and generate a browser preview from the sidecar with:

```sh
node scripts/validate-sprite-atlas.mjs assets/buildings/town-center-sprite-v1/sprite-atlas-pack-v1.json
node scripts/preview-sprite-atlas.mjs assets/buildings/town-center-sprite-v1/sprite-atlas-pack-v1.json --runtime --out assets/buildings/town-center-sprite-v1/preview/town-center-sprite-v1-atlas-preview.html
```

The sidecar deliberately omits `recommendedTileFootprint`: the outlined 4 × 4 visual base is a review guide, while this map-spawn prop has no gameplay occupancy. Its single `complete` state is static; no construction or damage states are implied. See [`sprite-grid.json`](sprite-grid.json) for the anchor and coverage, and [`PROVENANCE.md`](PROVENANCE.md) for the source prompt and hashes.

See the [building sprite production workflow](../../../docs/building-sprite-production-workflow.md) for the reusable complete-first design, lifecycle derivation, grid, review, and packaging method. This static landmark demonstrates the workflow's rule to author only states represented by gameplay.
