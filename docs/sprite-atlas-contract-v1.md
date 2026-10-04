# Sprite atlas contract v1

[Documentation index](README.md) · [Asset guide](assets.md)

This format describes cutout sprite pages, clips, pivots, layers, masks, and art
bounds. It is separate from GLB and painted-material atlas contracts. A valid
manifest establishes packaging integrity, not renderer adoption or visual approval.

Normative schema: [sprite-atlas-pack-v1.schema.json](../schemas/sprite-atlas-pack-v1.schema.json).

Generated action strips enter this format through the
[strip adoption contract](sprite-strip-adoption-contract.md), preserving declared
scale, ground anchors, seed color/mask identity, direction and timing.

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

## Current unit-loader binding subset

The schema above is general. The shipped [unit consumer](../src/unit-sprite-runtime.mjs)
uses this narrower adapter; a schema-valid new pack is not automatically selected.
These are existing bindings, not new art requirements or a schema migration.
Animation integration task `01a103d4` owns bounded adapter extensions when an art
owner reports a concrete mismatch. Preserve supplied pixels/registration and
complete usable action/headings before cosmetic polish.

| Binding | Current unit consumer |
| --- | --- |
| Role and default path | Human server `worker` maps to asset ID **`human`**, `assets/units/cast-human-sprite-v3/`. Human Infantry uses `infantry` / `infantry-sprite-v4`; Spearman `spearman` / `spearman-sprite-v2`; Archer `archer` / `archer-sprite-v3`, from the [foot-unit coverage slices](human-foot-unit-coverage.md). Boughward IDs are `boughward-{kind}` in their v1 directories. The matching asset must have `kind: unit`. |
| Version adoption | `packVersion` describes the manifest. Directory versions and role defaults are separately enumerated in the consumer and [main](../src/main.js). A new directory/version needs explicit selector/default/HTTP/release admission; it cannot replace a current role by changing `packVersion` alone. Keep existing source/provenance. |
| Page and layer | One selected page supplies the role's frames and aligned mask; the loader chooses the first frame's fallback page, otherwise the first page. One actor layer is drawn, otherwise fallback rectangles. General multi-page/split-layer metadata does not implement extra unit draws. Coordinate such an extension before exporting a required action solely on another page/layer. |
| Runtime files | The selected page needs both `runtimeFileId` color and `maskFileId` records; the unit loader currently requires the mask even though the general schema permits an optional one. Filenames resolve relative to that role's directory. Masks use the identical color registration and dimensions. |
| Clip lookup | One clip per `stateId\|directionId`, with explicit ordered `frameId` / `durationMs` and `loop`. Headings are `north`, `north-east`, `east`, `south-east`, `south`, `south-west`, `west`, `north-west`. Labels represent world yaw; copied SE keys do not supply the other views. |
| Existing states | `idle`, `walk`, `attack`, `defeat`; Worker `build`, `repair`, `gather-wood`, `gather-food`, and `gather-fish`. Generic `gather` is a declared fallback, not proof of resource-specific work. Carry/Return and Hold/Patrol/Follow reuse existing states/cues. |
| Stone addition | Producer `gather-stone` is already agreed, but the current sprite selector deliberately uses idle because no dedicated Stone frames exist. Supplied `gather-stone` clips need the animation owner's bounded selector/test change before default adoption; do not silently bind generic wood pixels. |
| Timing | Walk/work loop; defeat clamps to its last key; fresh attack events use their receipt timestamp and deduplicate. Role/state event lifetime currently uses the longest **authored** clip, excluding `idle-` frame placeholders. Preserve reviewed loop flags and state durations. Shorter looping attack headings can replay within a longer state lifetime: differing heading durations require selected-clip lifetime review or aligned durations, rather than an unnoticed clock reset. |
| Registration and scale | Canvas-local ground pivots and crop offsets drive placement; alpha bounds do not replace the root. Current `worldPerPixel = asset.heightWorld / max(frame.alphaBoundsPx.height \|\| frame.canvasPx.height)` across the pack. Check that adding a taller prop/frame preserves the accepted pixel-to-world scale for existing actions. Do not independently resize each key to its changing alpha box. |
| Facing and precedence | Fixed camera `[0.78, 1.12, 0.78]`; zero yaw +Z, increasing toward +X, rounded to eight headings. Defeat → walk → fresh attack → confirmed Worker work → idle. Gathering has actual row-15 bearing; build/repair bearing remains an agreed producer extension, not a distance guess. |

Use the accepted role pack as the registration reference and validate actual
frame IDs/rectangles against this adapter. `validate-sprite-atlas`, preview and
handoff report check exported files; the actual-frame runtime tests and
[functional game recipe](qa-worker-performing-action-consumer-2026-10-04.md#ordinary-game-capture-recipe)
check binding/playback, selected/unselected, interruption/resume, root/contact,
fog/LOD and generation reset. HTTP/release and an identified containing game
build remain separate proof. Report a mismatch with the role/pack revision,
action, heading, exact frame/clip IDs and expected versus observed selection so
the integration owner can change the smallest affected boundary.

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
