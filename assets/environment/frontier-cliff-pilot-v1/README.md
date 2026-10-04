# Directional cliff pilot

**Status:** low-ridge source/review pilot; normal battlefield terrain is unchanged.
Parent selected the low-ridge role on 3 October 2026. The mesh must not be stretched
into a tall wall; current tall cliff/cap defaults remain.
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

## Low-ridge placement constraints

Terrain integration owns technical validation and any later default consumer.
This role selection is not default admission. A future binding must satisfy:

- Replace scenery on an **existing authored nonwalkable stone obstacle** with an
  explicit low-ridge art assignment. Add no collision/navigation obstacles,
  occupancy, elevation patches or vision blockers. A generic `stone` label or
  the current cliff selector is not sufficient. Keep elevation ≥1.75 on current
  tall cliff/cap art; retain current artwork whenever eligibility fails.
- Preserve the normalized 4 × 0.9981259313 × 1.3063873986 source scale. Place its
  grounded root at the actual `groundHeight(x,z)`; compare the resulting peak and
  taper with that obstacle's authoritative `elevation`/vision height. Do not
  silently substitute the default 1.12 height, change server sight rules or draw
  this as a walkable plateau. Uniform server blocker height versus tapered ends
  is a concrete readability/occlusion check, not a proven match.
- Keep the whole visual footprint inside the existing blocked region, including
  end treatment. At unit scale the axis-aligned source needs at least 4 × 2 map
  cells (or 2 × 4 after a 90° rotation). Do not qualify one-cell-wide barriers
  merely because their center line exists. Require flat support across the
  footprint; slopes, water and discontinuous elevation edges retain old art
  until specifically validated. Ground level steps are 0.8 world units and are
  separate from obstacle height.
- Match world-axis orientation to the source's long X axis and select the
  corresponding color/depth camera view together. Use the fixed 45.4359°
  orthographic capture, five-unit frame and `(320,376)` root. Do not introduce
  the current decorative random scale/flip into a modular join before validating
  its effect on depth and registration.
- Prove straight-repeat and terminal handling at actual placement spacing.
  Existing stone placements occur every two cells; a four-unit source overlaps
  by two units there. Measured 0.05-unit end bands peak at only 0.194/0.244 and do
  not define matching join faces. Validate gaps, double surfaces, end silhouette,
  color/depth pairing, unit/foliage occlusion and blocked-route readability on
  flat and raised-ground ordinary matches before binding. Corners are deferred
  until a consumer needs them; caps/ends and straight joins are first.

Static color/depth alpha and encoded range coherence pass in all eight views.
Actual join/cap/terrain/foliage pixels remain unverified in this executor. No new
geometry, generation, spending or default obstacle binding was introduced here.
