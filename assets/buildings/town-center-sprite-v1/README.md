# Town Center direct sprite v1

**Status:** legacy complete-only comparison pack. Gameplay now uses the
[captured lifecycle pack](../town-center-lifecycle-meshy-v1/README.md).
[Provenance](PROVENANCE.md) · [Direct-sprite workflow](../../../docs/building-sprite-production-workflow.md)

## Coverage

One complete source produces Azure/Ember frames by shifting saturated blue cloth.
It uses a fixed view, 5 × 5 world-unit frame, 640 × 640 pixels, and 128 pixels/world
unit. The visible stone base spans a 4 × 4 guide; the Town Center landmark has no
gameplay occupancy or construction/health state.

The canonical sidecar deliberately omits `recommendedTileFootprint`. Its pivot,
complete-only clip, and bounds come from [sprite-grid.json](sprite-grid.json).

## Rebuild and preview

From the repository root:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset town-center
node scripts/validate-sprite-atlas.mjs assets/buildings/town-center-sprite-v1/sprite-atlas-pack-v1.json
node scripts/preview-sprite-atlas.mjs assets/buildings/town-center-sprite-v1/sprite-atlas-pack-v1.json --runtime --out assets/buildings/town-center-sprite-v1/preview/town-center-sprite-v1-atlas-preview.html
```

## Limits and related sources

No camera/building rotation, directional occlusion, or terrain depth is represented.
The [state concepts](../town-center-state-concepts-v1/README.md) supplied matched
lifecycle designs; their later modeled captures live in the active lifecycle pack.
