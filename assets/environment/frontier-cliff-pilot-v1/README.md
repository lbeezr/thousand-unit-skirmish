# Directional cliff pilot

**Status:** standalone review; normal battlefield terrain is unchanged.
[Environment guide](../../../docs/environment-pack-v1.md)

## Review

Open **Match Controls → Terrain Art Pilot** (`/environment-review.html`). Q/E or
camera buttons cycle eight views. The page compares the existing single-view
cliff with model captures and shows uncorrected repeated joins. Two moving
Infantry-shaped probes test depth visually; they are client-only review objects.

## Contents and registration

- [Eight-view sheet](eight-view-preview.png) and [manifest](manifest.json).
- Eight 640 × 640 color WebPs and eight 16-bit RG depth PNGs: 1,028,670 bytes total.
  Four instances share them; estimated decoded storage is about 29 MiB with color
  mips, before driver overhead.
- [Source GLB](source/cliff-source.glb): 37,809,628 bytes, 973,328 triangles, one
  material, three embedded 2048 × 2048 textures. It is an offline source.
- [Capture script](source/capture.py), [render page](source/render-cliff.html),
  inspection receipt, provider preview, and intermediate passes.

The capture scales the longest horizontal extent to four world units and grounds
the lowest point. Actual X/Y/Z bounds are 4 × 0.998 × 1.306: lower than the intended
cliff. Camera elevation is 45.4359°, azimuths 0–315° in 45° steps, with fixed light,
five-unit frame, and ground anchor `(320,376)`.

The shader decodes camera distance from RG and writes orthographic scene depth.
Normals remain inspection output; lighting is baked and no separate contact-shadow
pass is used. Missing explicit model tangents are recorded in `inspection.json`.

## Rebuild and provenance

From the repository root with Python/Pillow, Node, Three.js, and Chrome:

```sh
python3 assets/environment/frontier-cliff-pilot-v1/source/capture.py --overwrite
```

This overwrites local captures and makes no Meshy request. Original illustrated
input: [cliff reference](../frontier-v2-concepts/cliff-straight-reference.png).
Meshy task `01a0e003-8ecc-707f-9ca0-966ebfb6c52d` consumed 30 credits for textured
Image-to-3D, PBR/2K/GLB. There was no paid remesh or rerun. Original prompts remain
in the concept package. No third-party input or new exclusivity/license claim is implied.

## Findings and limits

The fractured silhouette survives reconstruction but reads as a low ridge.
Grass/moss are smoother than the illustration and repeated modules expose uneven
joins. Corners, caps, matching edges, and shape variants remain future work.
Eight-frame alpha/depth checks and the original local gallery passed; those
checks do not establish general terrain/foliage occlusion or game performance.
Gameplay collision and walkable elevation are unaffected by this review pack.

Read-only source geometry inspection:
`python3 scripts/inspect-cliff-end-bands.py`. It verifies the original GLB hash,
actual position bounds and capture normalization without Blender or GPU startup.
The 0.05-world-unit end bands have maximum heights 0.194 and 0.244, versus a
0.998 peak, and depth spans 0.758 and 0.724. These vertex-slab measurements do not
prove matching surfaces, safe overlap or caps. The concrete receiving-owner
questions are in [terrain readiness](../../../docs/terrain-candidate-readiness.md#contract-resolution-and-receiving-owners).
