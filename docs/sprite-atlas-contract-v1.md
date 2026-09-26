# Sprite atlas and manifest contract v1

**Status:** shared authoring and packaging contract for new painterly 2D/2.5D
unit, building, and prop art. It is not a renderer integration or production
promotion. Existing GLB authoring packs and environment packs remain references
while sprite pilots establish their canvas sizes, frame counts, and state
coverage.

This cutout-sprite contract is separate from the current GLB/material-atlas
path. It does not replace the roadmap's shared painted-material atlas or its
UV, export, and manifest checks.

The normative shape is
[`schemas/sprite-atlas-pack-v1.schema.json`](../schemas/sprite-atlas-pack-v1.schema.json).
Use `node scripts/validate-sprite-atlas.mjs <manifest.json>` for file integrity
and bounds checks. Use `node scripts/preview-sprite-atlas.mjs <manifest.json>`
to generate a local HTML preview with state/direction selection, layer
composition, frame rectangles, pivots, alpha bounds, and team-mask inspection.

## Authoring rules

- Every image page declares its own pixel dimensions, color space, pixel
  format, alpha mode, transparent-edge rule, gutter, wrap mode, and sampler
  settings. A pack does not imply a shared canvas size or fixed grid.
- File records include relative paths, SHA-256 hashes, file format, and
  declared dimensions. A page may carry a source file, a runtime file, or
  both. Source and runtime variants of one page must have the same dimensions.
- Frames use explicit top-left-origin pixel rectangles. Every frame has a full
  transparent `fallbackRectPx` cutout for review and simple runtime fallback.
  A logical frame also declares its canvas size and `groundPivotPx` in
  canvas-local pixels plus `groundPivotStatus` (`unreviewed-estimate` or
  `reviewed`). Optional `alphaBoundsPx` is informational (the visible
  alpha extent, conventionally measured at alpha 96/255); it never replaces
  the authored ground pivot.
- Cropped foreground/background layers refer to explicit pages and rectangles
  and declare their offset on the logical frame canvas. The `actor` layer is
  the default. Optional `background`, `midground`, and `foreground` layers can
  carry their own `batchKey` and renderer-owned `depthBiasWorld`. When split
  layers exist, the renderer draws those rectangles; the full cutout remains
  available for review and fallback.
- Clips name a `stateId`, optional `directionId`, and an explicit frame
  sequence with per-frame durations. No direction count, frame count, or
  animation rate is implied by the schema. Static art is a one-frame clip.
- Optional `recommendedTileFootprint` records the artist's non-authoritative
  footprint suggestion for preview and asset/map consistency checks. Unit
  sprites may omit it. Map/gameplay data remains authoritative for placement;
  the renderer never reads occupancy from the art pack. `artBoundsWorld`
  records visible extent relative to the ground pivot. `heightWorld` and optional
  `sortAnchorWorld` declare vertical extent and sorting location separately.
  Optional `cullingBoundsWorld` and `selectionBoundsWorld` stay separate
  because visible overhang is not gameplay occupancy or an interaction target.
- A page may provide an aligned grayscale8 team-color mask. It has the same
  pixel dimensions and frame UV rectangles as its color page. Its R value is
  linear data: black (0) preserves the source and white (255) applies the full
  renderer-supplied team tint; intermediate values blend between them. The
  mask is optional and does not require baking team variants.
- Maps and gameplay snapshots own occupancy and refer to logical IDs such as
  `assetId` or `visualAssetId`; they never store page rectangles or UVs. The
  renderer resolves the current logical state/direction to the selected frame.
  Frame selection may update an instance `frameRect` when the frame changes.
- Atlas pages use cutout alpha with declared edge behavior. `edgeRule` says
  whether RGB under fully transparent pixels is bled from the silhouette or
  zeroed; alpha remains governed by `alphaMode`. For `gutterPx: 0`, disable
  mipmap generation, use linear min/mag filters, and inset each frame rect by
  exactly half a texel. If mipmaps are generated, declare an edge-extended
  gutter and `maxMipLevel`; the gutter must be at least `2^maxMipLevel` pixels
  per side. Team masks use the same UV inset and mip/gutter policy as their
  color page, with scalar edge values extended into matching padding. An
  `edge-extended` cutout gutter copies edge RGB into padding while keeping the
  padding alpha transparent; grayscale mask padding copies the edge value.
  This
  prevents samples from reaching neighboring frames. The manifest owns
  draw-layer names and ordering metadata; maps do not set render order. The
  renderer retains its depth test/write policy and owns depth behavior.

## Bounds and coordinate conventions

`rectPx` is `{x, y, width, height}` with integer pixels, origin at the page's
top-left, x increasing right, and y increasing down. Rectangles are
half-open: `[x, x + width) × [y, y + height)`. `offsetPx` and `groundPivotPx`
use the logical frame canvas origin. A pivot may lie on the canvas edge but
must be inside or on the edge of the canvas. Alpha bounds and every layer
rectangle must fit within their declared canvas/page.

World bounds are axis-aligned `{min:[x,y,z], max:[x,y,z]}` relative to the
ground pivot, in world units; Y is up and the ground plane is X/Z. The map
coordinate uses one world unit per tile today. `recommendedTileFootprint`,
when present, is a positive integer rectangle in map tiles and a
non-authoritative authoring hint, independent of art bounds. Map and gameplay
data own the actual occupied cells; renderer placement and collision must not
be derived from this field. Map/asset tooling may compare the hint against the
gameplay footprint. Let art overhang without expanding gameplay placement
unless the map rules actually reserve those extra tiles.

For a multi-layer frame, every layer's `offsetPx` places its crop on the same
logical frame canvas. All layers therefore share the same `groundPivotPx` and
world anchor even if their source rectangles have different sizes. Preserve
the character's feet/root at the ground pivot through asymmetrical tools and
weapons; a bottom-center alpha bound is only a measurement aid. Mark generated
or otherwise unreviewed pivots `unreviewed-estimate` until an artist checks
them. A deliberately grounded defeated pose may use a distinct authored pivot
if the pose itself changes the root contact point. The renderer batches each
`drawLayer` separately and applies optional `depthBiasWorld` only as a
bounded renderer-level visual ordering adjustment. `sortAnchorWorld` is an
optional authored point relative to the ground root for depth ordering and
defaults to the ground root when absent; it does not alter
occupancy, culling, selection, or the stable ground anchor.

## Pilot evidence and limits

The available Worker, Infantry, and Archer sprite explorations now have
`runtime-candidate` manifests with source/runtime atlas pages, aligned team
masks, full-frame fallbacks, explicit actor crops, and named clips. The
canonical validator accepts all three packs. This verifies their declared
files and geometry; it does not mean that the live renderer loads them or that
their appearance has been approved. The Infantry README records its six-row
sheet, approximate facings and cell edges, heuristic unreviewed pivots, and
short two-frame walk. Its aligned grayscale mask has not been visually
reviewed in-game. The older `spriteRuntime` fields in the exploration
manifests are not the canonical consumer shape defined here.

Those values are evidence about these pilots only; they do not set this
contract's canvas, grid, state, direction, or frame counts. The environment v1
manifests use separate transparent images with family-specific dimensions and
remain unchanged. The specifically held unit/building pack and berry candidate
capture are outside this sprite-contract work.

For each new pilot, record the canvas sizes, directions, states, and layers it
actually needs. Renderer integration, appearance claims, staging, and
production promotion are separate decisions. This sprite contract does not
authorize external provider spending.

## Minimal manifest example

This abbreviated example illustrates the naming and coordinate shape; it is
not a project asset or a size recommendation:

```json
{
  "schemaVersion": 1,
  "packId": "sample-worker",
  "packVersion": "0.1.0",
  "maturity": "source-only",
  "provenance": { "license": "project-owned", "source": "painted pilot" },
  "files": [
    { "id": "page-source", "path": "worker.png", "usage": "source", "format": "png", "sha256": "0000000000000000000000000000000000000000000000000000000000000000", "dimensionsPx": { "width": 320, "height": 256 } }
  ],
  "pages": [
    { "id": "worker-color", "sourceFileId": "page-source", "dimensionsPx": { "width": 320, "height": 256 }, "colorSpace": "srgb", "pixelFormat": "rgba8", "alphaMode": "straight", "edgeRule": "bleed-rgb-under-transparent", "gutterPx": 0, "gutterRule": "none", "wrapMode": "clamp", "sampling": { "generateMipmaps": false, "minFilter": "linear", "magFilter": "linear", "uvInsetPx": 0.5, "maxMipLevel": 0 } }
  ],
  "assets": [
    {
      "id": "worker",
      "kind": "unit",
      "recommendedTileFootprint": { "widthTiles": 1, "heightTiles": 1 },
      "artBoundsWorld": { "min": [-0.35, 0, -0.2], "max": [0.35, 0.85, 0.2] },
      "heightWorld": 0.85,
      "sortAnchorWorld": [0, 0, 0],
      "layers": [{ "id": "actor", "drawLayer": "actor", "batchKey": "unit.worker" }],
      "frames": [{
        "id": "idle-south-0",
        "canvasPx": { "width": 64, "height": 64 },
        "groundPivotPx": { "x": 32, "y": 58 },
        "groundPivotStatus": "unreviewed-estimate",
        "alphaBoundsPx": { "x": 17, "y": 9, "width": 31, "height": 49 },
        "fallbackRectPx": { "pageId": "worker-color", "rectPx": { "x": 0, "y": 0, "width": 64, "height": 64 } },
        "frameRectsPx": [{ "layerId": "actor", "pageId": "worker-color", "rectPx": { "x": 0, "y": 0, "width": 64, "height": 64 }, "offsetPx": { "x": 0, "y": 0 } }]
      }],
      "clips": [{ "stateId": "idle", "directionId": "south", "loop": true, "sequence": [{ "frameId": "idle-south-0", "durationMs": 180 }] }]
    }
  ]
}
```
