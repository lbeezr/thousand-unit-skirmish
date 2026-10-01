# Vaelora regional environment kits v2

New source production in response to the 30 September player observation about
clashing palettes, homogeneous forests and missing rotated asset views.
[Production plan](../../../docs/regional-environment-kits.md).

`underbough/palette-study.png` is an unmodified built-in ImageGen direction board
derived from the selected Underbough ecology key and the existing copperleaf
sprite. It proposes four distinct canopy forms, complementary shrubs and fungi,
and six compatible ground roles. Board swatches are not seamless runtime tiles.

`underbough/root-oak-full-000.png` is a new transparent intact Root Oak source.
This dark moss/olive species complements the copperleaf; it is not a recolour of
the existing runtime tree. Its designated orientation is 0° relative to the fixed
oblique camera. This is authored painted artwork, not a measured model capture.
Further directions and harvest states remain in production. It has no consuming
runtime loader yet; the game still uses its previous forest families.

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
