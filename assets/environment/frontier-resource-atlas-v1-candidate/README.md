# Frontier resource sprite-atlas candidate v0.1.0

**Maturity:** source-only. This additive candidate keeps `frontier-interactive-v1` and its runtime path unchanged. Renderer adoption, runtime encodes, and in-game layer ordering remain separate work.

## Contents

The manifest contains two canonical `kind: "resource"` assets, `oak` and `berries`, each with static clips named `full`, `worked`, `low`, and `depleted`. Every state retains a full-cutout fallback and provides canvas-local cropped layer rectangles with explicit `layerId` and `offsetPx` values.

The original canvases are retained: oak is 1226 × 1283 px and berries is 1536 × 1024 px. Each frame uses the existing bottom-center registration as `groundPivotPx` (`x = canvas width / 2`, `y = canvas height`); the pivot is marked `unreviewed-estimate` until a human reviews ground contact. `recommendedTileFootprint` is a 1 × 1 hint only; map/gameplay placement remains authoritative.

| Asset | Layer ID | Draw layer | Contents |
| --- | --- | --- | --- |
| Oak | `foliage-back` | `background` | Green and yellow-green canopy pixels |
| Oak | `wood-structure` | `actor` | Trunk, branches, roots, and remaining pixels |
| Berries | `foliage-back` | `background` | Green and yellow-green foliage pixels |
| Berries | `wood-structure` | `actor` | Woody base and remaining pixels |
| Berries | `fruit-front` | `foreground` | Saturated red fruit pixels; omitted from the depleted frame |

## Source and layer method

All eight inputs are the approved PNG states from `assets/environment/frontier-interactive-v1/`. `build_atlas.py` packs them into lossless source pages and assigns existing pixels with HSV color mattes; it does not repaint, generate, or retouch the art. Foliage uses hue 20–120 with saturation at least 18/255. Berry fruit uses hue 0–12 or 246–255 with saturation at least 64/255, except in the depleted state. Remaining visible pixels go to the woody structure; the depleted oak stump is kept entirely in that layer.

The full-cutout fallback is included for each state. The build report records all eight original input hashes and dimensions. Layer rectangles use the smallest alpha-nonzero crop and its original canvas offset. A recomposition check passed for all eight frames: every visible source RGBA pixel and alpha value is reconstructed exactly. RGB is zeroed only where alpha is exactly zero, matching the declared `zero-rgb-under-transparent` page rule.

This is a deterministic color-based depth proposal, not a hand-painted semantic matte. Its composited appearance matches the approved sprites; whether foliage, wood, and fruit should occlude workers in this order is for art and renderer review. The source contains existing edge color artifacts, which this candidate preserves rather than silently correcting.

Source lineage hashes are included in `manifest.json` provenance notes and `build-report.json`. The manifest records SHA-256, format, and dimensions for all seven atlas source pages. Runtime hashes are absent by design because this pack is `source-only`; any runtime encodes belong to a later renderer-owned adoption step.

## Atlas and validation

Seven RGBA8 PNG source pages use sRGB, straight alpha, zero RGB under fully transparent pixels, no gutters, no mipmaps, linear sampling, and a 0.5 px UV inset. Each four-state family is laid out horizontally; manifest rectangles and offsets point to the individual fallback or layer crop.

Validated with `scripts/validate-sprite-atlas.mjs` from Technical Art contract worktree commit `a21cec6bda2cc92e87e85667a0f4d04c63167e37`: **7 files, 7 pages, 2 assets; valid**. The HTML preview shows state clips, layer composition, page rectangles, alpha bounds, and the unreviewed pivot.
