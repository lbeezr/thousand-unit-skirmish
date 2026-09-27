# Frontier environment art

[Documentation index](README.md) · [Asset guide](assets.md)

## Runtime approach

Eight opaque ground textures repeat in world coordinates with mirrored tiling
and feathered material-region edges. Transparent painterly props face the oblique
camera and repeat through instanced batches. Map data owns collision, sight, and
walkable elevation; sprite height never substitutes for those rules.

## Asset roles

| Family | Files / role |
| --- | --- |
| Living ground | `meadow`, `short-grass`, `long-grass`: quiet field through coarse growth. |
| Woodland ground | `forest-floor`: leaf/needle cover below trees and in clearings. |
| Worn/dry ground | `dirt`, `sand`, `scree`, `cinder`: routes and distinct regions. |
| Stone | `rock-outcrop`, `rock-boulder-cluster`, `basalt-ridge`, `basalt-ridge-cap`, `cliff`, `cliff-end-cap`. |
| Forest | `oak`, `pine`, `silver-birch`, `field-maple`, `hazel-thicket`; deterministic variants/scales. |
| Ordinary resource nodes | Oak for wood, berries for food, with stock-driven state art. |
| Objective landmark | `seamstone`; zone outline and ownership UI remain authoritative. |

Sources, exact prompts, hashes, and addition records are in
[Frontier provenance](../assets/environment/frontier-v1/PROVENANCE.md).
Vegetation/rock manifests record runtime paths and variant rules.
[Interactive states](environment-state-pack-v1.md) handle ordinary resource depletion.
Forest cells now support [cutting and clearing](harvestable-woodland-pilot.md).

## Review in game

1. Start with `npm start` and choose **Frontier Materials** in Match Controls.
2. Compare all eight grounds and three obstacle heights.
3. Inspect **Stone Pass**, **Cinder Ridge**, and **Frontier Reach** for regional
   palette, dense vegetation, water, and repeated modules.
4. In Map Studio, paint base/ground regions and obstacles, save, then reopen.
5. At ordinary/strategic zoom, check ground contrast, material boundaries,
   passability, resource visibility, landmarks, and both team colors.

Forest-floor rendering follows forest masks. Stone cutouts supply the visible
ridge shape while authoritative obstacle cells supply collision. Low-colored
water and shoreline geometry must preserve the same movement meaning.

## Current limits

- Corners, curved rock joins, and broader regional variation remain content work.
- Fixed-view cutouts need additional views or geometry for other camera angles.
- Repetition, forest/resources, and transparent edges need game-zoom review.
- WebP download bytes do not establish decoded memory or device performance.

## Directional cliff pilot

**Match Controls → Terrain Art Pilot** opens `/environment-review.html`.
The [cliff package](../assets/environment/frontier-cliff-pilot-v1/README.md)
contains the model, eight color/depth views, scripts, and provenance. It is an
isolated review page; normal battlefield terrain does not use that pilot.
