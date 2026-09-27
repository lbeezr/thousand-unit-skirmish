# Sprite atlas contract v1

[Documentation index](README.md) · [Asset guide](assets.md)

This format describes cutout sprite pages, clips, pivots, layers, masks, and art
bounds. It is separate from GLB and painted-material atlas contracts. A valid
manifest establishes packaging integrity, not renderer adoption or visual approval.

Normative schema: [sprite-atlas-pack-v1.schema.json](../schemas/sprite-atlas-pack-v1.schema.json).

## Validate, preview, and report

```sh
node scripts/validate-sprite-atlas.mjs path/to/manifest.json
node scripts/preview-sprite-atlas.mjs path/to/manifest.json
node scripts/report-sprite-atlas-handoff.mjs path/to/manifest.json
```

The preview exposes state/direction, layers, bounds, pivot, and team masks.
The report includes verified hashes, page/frame rectangles, pivot review status,
sequences, masks, depth crops, and art/occupancy separation. Add
`--require-reviewed-pivots` for a handoff requiring reviewed ground contact; the
report prints before returning a failure for an unreviewed pivot.

## Pages and files

Each page declares its own dimensions, color space, format, alpha/edge rules,
gutter, wrap, and sampler. No shared canvas/grid is implied. Relative file records
contain hash, format, and dimensions. Source/runtime versions of the same page
have identical dimensions; a page can contain either or both.

For no gutter, disable mip generation, use linear min/mag sampling, and inset
rectangles by exactly half a texel. With generated mips, declare `maxMipLevel`
and edge-extended padding of at least `2^maxMipLevel` pixels per side. Extend
color RGB while keeping padding alpha transparent. Team-mask padding extends
scalar edge values. `edgeRule` distinguishes bled RGB from zero RGB under full
transparency; it does not replace `alphaMode`.

## Frames, layers, and clips

- `rectPx` uses integer top-left pixel coordinates and half-open bounds:
  `[x,x+width) × [y,y+height)`.
- Every logical frame declares canvas size, a full-cutout `fallbackRectPx`, and
  canvas-local `groundPivotPx`. The pivot may lie on a canvas edge.
- `groundPivotStatus` is `unreviewed-estimate` or `reviewed`. Alpha bounds are
  informational, conventionally measured at alpha 96/255; they never replace
  ground registration.
- Cropped layers declare page rectangle and canvas-local `offsetPx`. Layers are
  `background`, `midground`, `actor` (default), or `foreground`, with optional
  batch key and renderer-owned `depthBiasWorld`.
- Layer and alpha rectangles must fit their page/canvas. Split-layer drawing
  retains the full cutout for fallback and review.
- Clips specify `stateId`, optional `directionId`, and an explicit frame sequence
  with durations. A static state is one frame; no view count or animation rate
  is assumed.
- A pack may include the optional top-level `capture` record described by
  [`sprite-atlas-capture-v1.schema.json`](../schemas/sprite-atlas-capture-v1.schema.json).
  It ties rendered frames to their source GLB, capture mode, fixed camera, and
  per-frame pose. Use `camera-orbit` for building turntables and `model-pose` for
  unit facing/animation sheets. Legacy orbit records may omit `captureMode` and
  `frameRecords`; new model-pose captures require yaw, clip, and sample time for
  every frame.

## Team masks and world bounds

An optional aligned grayscale8 mask matches its color page's dimensions and UVs.
R is linear scalar data: 0 preserves source color, 255 applies full team tint,
and intermediate values blend. Use identical inset/mip/gutter rules.

World bounds are `{min:[x,y,z], max:[x,y,z]}` relative to the ground pivot, Y up,
with one world unit per map cell. Keep `artBoundsWorld`, `heightWorld`, optional
`sortAnchorWorld`, `cullingBoundsWorld`, and `selectionBoundsWorld` distinct.
`recommendedTileFootprint` is an optional positive-integer art recommendation.
It does not create collision, occupancy, or placement authority.

Maps/snapshots refer to logical asset/state IDs, not page rectangles or UVs. The
renderer resolves state/direction and updates the instance frame rectangle when
needed. It owns depth test/write and scene occlusion; layer metadata alone does
not solve that behavior.

## Review and adoption

Validate exact source/runtime files, inspect pivots at ground contact, and compare
all authored states/directions at game zoom. Record unsupported views, missing
runtime encodes, unreviewed pivots, and source-only compositions. Pack-specific
previews and validators do not establish in-game appearance or performance.

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
