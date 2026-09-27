# Resource sprite-atlas candidate

**Status:** source-only v0.1.0. The active interactive environment pack is unchanged.
[Sprite contract](../../../docs/sprite-atlas-contract-v1.md)

## Contents

Two resource assets, oak and berries, each provide static full/worked/low/depleted
clips. Seven lossless PNG pages retain a full-cutout fallback and cropped layers
with explicit canvas offsets. Oak canvas: 1226 × 1283; berries: 1536 × 1024.
Bottom-center pivots are unreviewed estimates. A 1 × 1 footprint is an art hint,
not gameplay occupancy.

| Asset | Layer | Draw role |
| --- | --- | --- |
| Oak | `foliage-back` | Background canopy |
| Oak | `wood-structure` | Actor trunk/branches/roots |
| Berries | `foliage-back` | Background foliage |
| Berries | `wood-structure` | Actor woody body |
| Berries | `fruit-front` | Foreground red fruit; omitted for depletion |

## Layer method

`build_atlas.py` reuses the eight approved interactive-pack PNGs without repainting.
HSV mattes assign foliage (hue 20–120, saturation ≥18/255) and fruit (hue 0–12 or
246–255, saturation ≥64/255). Remaining pixels are woody structure; the depleted
oak stays entirely there. Crops use alpha-nonzero bounds and original offsets.

The recorded recomposition check reconstructs every visible RGBA pixel exactly.
Only fully transparent RGB is zeroed. `build-report.json` retains input hashes
and dimensions; source edge artifacts are preserved. Color-based layers are an
occlusion proposal, not a reviewed semantic depth matte.

## Validate and preview

From the repository root:

```sh
node scripts/validate-sprite-atlas.mjs assets/environment/frontier-resource-atlas-v1-candidate/manifest.json
```

[preview.html](preview.html) exposes states, layers, rectangles, alpha bounds,
and pivots. Pages use sRGB/straight alpha, no gutter or mipmaps, linear sampling,
and half-pixel UV inset. Runtime encodes/hashes are absent because the pack is
source-only. Adoption needs pivot/layer-order review, runtime exports, and a loader.
