# Resource sprite-atlas candidate

**Status:** the layer manifest remains source-only v0.1.0. A separate oak full-cutout
runtime export is unbound; the active interactive environment pack is unchanged.
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
npm run validate:resource-atlas-pixels
python3 scripts/resource-atlas-pixels.test.py
```

[preview.html](preview.html) exposes states, layers, rectangles, alpha bounds,
and pivots. Layer pages use sRGB/straight alpha, no gutter or mipmaps, linear sampling,
and half-pixel UV inset. Layer runtime encodes/hashes are absent because that
manifest is source-only. Split-layer adoption needs semantic depth review,
runtime exports and a loader.

The read-only pixel command checks the **committed** pages and canvas offsets,
independently of the builder's recorded claims: seven page hashes/dimensions,
eight original source hashes, fallback/source RGBA equality, disjoint layer alpha,
exact recomposition and recorded alpha bounds. It checks RGB channels even when
alpha is unchanged. The JSON report binds manifest/lineage hashes and keeps
`runtimeReady: false`; a pass does not approve pivots or semantic depth mattes.
It requires Python 3 and Pillow and writes no package/art files. Node CI does not
install Pillow; run this authoring check explicitly in a Pillow-capable environment.
See [candidate findings and ranked work](../../../docs/terrain-candidate-readiness.md).

## Oak full-cutout runtime export

[oak-fallback-runtime.json](oak-fallback-runtime.json) is a separate, hash-bound
export contract for the existing oak full/worked/low/depleted cutouts. A 2 × 2
layout (2752 × 2880) avoids the source row's 4904-pixel width. Six authored lossless
WebPs in `runtime/` use 64-pixel transparent-alpha/edge-RGB gutters, independent
premultiplied BOX cell filtering and a required mip-5 cap. Source samples in mip 0
remain exact; half-pixel UV insets and the active 4.1 × 3.75 bottom-center plane
registration are retained. Normal full oak must keep the existing Meshy directional
design; this full cutout applies only to `meshyResources=0`. Regional wood stays
on its current profiles. No HSV layers are used by this fallback path.

The reference export is 5,048,048 encoded bytes and 40.30 MiB of decoded RGBA
across six levels, before driver overhead. It is lossless, unlike the current
quality-86 WebPs (1,266,974 bytes for all four oak files); it does not establish a
transfer or memory improvement. A consuming slice must assess the cost and normal
zoom/state appearance. These files are unbound and omitted from the game release.
Terrain integration owns the subsequent consumer/admission work and acceptance.

Read-only acceptance, including actual current renderer factory registration:

```sh
npm run validate:oak-fallback-atlas
python3 scripts/oak-fallback-atlas.test.py
node --test scripts/oak-fallback-registration.test.mjs
```

To rebuild only the six oak exports and this companion contract from existing
public source pixels, run `python3 scripts/prepare-oak-fallback-atlas.py --write`.
Existing destinations are rejected unless `--overwrite` is also supplied. It
does not alter the source/layer manifest, original PNGs, gameplay or renderer.
