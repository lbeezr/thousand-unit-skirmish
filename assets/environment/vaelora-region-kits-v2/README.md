# Vaelora regional environment kits v2

New source production in response to the 30 September player observation about
clashing palettes, homogeneous forests and missing rotated asset views.
[Production plan](../../../docs/regional-environment-kits.md).

`underbough/palette-study.png` is an unmodified built-in ImageGen direction board
derived from the selected Underbough ecology key and the existing copperleaf
sprite. It proposes four distinct canopy forms, complementary shrubs and fungi,
and six compatible ground roles. Board swatches are not seamless runtime tiles.

Three ground masters (`clearing-grass-01`, `worn-dirt-01`, `root-soil-01`) have
RGB WebP exports under `frontier-v1/underbough-*-v2.webp`. The local regional
loader and map/minimap/Studio colours use them for Underbough's matching paint
roles. Paired browser review and cache-isolation proof pass; staging integration
is pending. Hashes, sizes and encodings are in `underbough/source-manifest.json`.

`underbough/root-oak-full-000.png` is a new transparent intact Root Oak source.
This dark moss/olive species complements the copperleaf; it is not a recolour of
the existing runtime tree. Its designated orientation is 0° relative to the fixed
oblique camera. This is authored painted artwork, not a measured model capture.
Further directions and harvest states remain in production. It has no consuming
runtime loader yet; the game still uses its previous forest families.

`underbough/moss-hornbeam-full-000.png` adds a narrower airy crown, ascending
branches and lighter warm bark. It is also a fixed-view source, awaiting root
registration, complete harvest states and consistent model/directional views.

`underbough/old-plum-full-000.png` adds a compact burgundy crown with low
spreading branches and a short crooked trunk. This third new species source has
the same outstanding registration, harvest-state and model-view work.

`underbough/root-oak-view-090-rejected.png` retains an unsuccessful directional
attempt for provenance. It changes branches and silhouette but does not verify
a quarter-turn of the same tree. It must not enter an atlas or count as an
accepted 90° view. Only the designated 0° intact source is presently supplied.

Original generated files retain their pixels and alpha. Later atlas packaging
must measure crop/root registration and preserve source images. Rights and
provenance: project-owned generated artwork; built-in ImageGen; only existing
project-owned selected keys and sprite references. Exact prompts are recorded
beside the source assets. Generation does not prove view consistency, gameplay
readability or a complete kit.

## Root Oak lifecycle sources — 1 October 2026 UTC

Four fixed-view source states now exist: full, worked, low and depleted.
Unmodified 1254 × 1254 RGBA canvases and exact prompts remain alongside the
source manifest. The [registration review](underbough/root-oak-registration-review.json)
records visible bounds and lower-root silhouette overlap (0.925–0.938). This
supports a shared registration candidate; it does not prove runtime scale,
harvesting, reset or directional coverage. Reduced frames retain faint
low-alpha generated remnants in their original masters. Do not silently
repaint or discard source pixels. Runtime packaging and renderer review remain
outstanding.
