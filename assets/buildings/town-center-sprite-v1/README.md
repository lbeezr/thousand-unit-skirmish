# Town Center sprite pack v1

This pack replaces the current static Town Center map-prop mesh with a camera-authored sprite. It shares the Barracks and Archery Range **5 × 5 world-unit frame**, **640 × 640 pixels**, **128 px per world unit**, and neutral daylight palette. Its visible stone base uses a 4 × 4-cell visual support shape; the existing Town Center prop has no gameplay occupancy footprint or health/construction state.

The complete source image produces Azure and Ember runtime WebP frames by shifting only saturated blue cloth pixels to the Ember hue. It uses one fixed camera view. The pack does not yet support camera rotation, building rotation, terrain depth, or directional occlusion.

Regenerate its two runtime frames and the review strip with:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset town-center
```

See [`sprite-grid.json`](sprite-grid.json) for the anchor and coverage, and [`PROVENANCE.md`](PROVENANCE.md) for the source prompt and hashes.

See the [building sprite production workflow](../../../docs/building-sprite-production-workflow.md) for the reusable complete-first design, lifecycle derivation, grid, review, and packaging method. This static landmark demonstrates the workflow's rule to author only states represented by gameplay.

A separate [Town Center state-concepts package](../town-center-state-concepts-v1/README.md) records exploratory Foundation, Frame, Damaged, and Critical designs. They are not Meshy models or runtime states; the game still uses this landmark as a complete-only static prop.
