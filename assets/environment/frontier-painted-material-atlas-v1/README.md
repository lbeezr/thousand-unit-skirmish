# Painted ground material atlas v1

**Status:** source/runtime candidate. Gameplay still uses individual ground textures.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Layout and sampling

Eight project ground paints occupy a 3 × 3 page, with the last slot empty.
Each slot has a 512 × 512 interior and 64 px mirrored gutters on every side.
The assembled page is 1920 × 1920, opaque sRGB RGB8, clamped at page edges.
Material repetition remains world-aligned with a 12-world-unit period.

`uvRectTopLeft` records normalized pixel-center bounds. Inset half a pixel,
flip the WebGL v coordinate, and split geometry at integer repeat boundaries
so mirrored UVs preserve the existing world alignment and feather alpha.

Six authored runtime mips are 1920, 960, 480, 240, 120, and 60 px square.
Levels 0–3 use WebP quality 86; 4–5 are lossless to avoid compression-block drift.
A future loader must cap sampling at level 5 to avoid neighboring-slot blending.

## Sources and rebuild

Original PNG paints remain in `../frontier-v1/`; `manifest.json` records their
paths and hashes. The assembled PNG is editable. `preview.png` repeats source
crops and is not an in-game comparison.

From the repository root, using Python and the Pillow version pinned in
`scripts/requirements-painted-material-atlas.txt`:

```sh
python3 scripts/build-painted-material-atlas.py
python3 scripts/build-painted-material-atlas.py --check
npm run validate:painted-material-atlas
node scripts/painted-material-atlas-uv-scenario.mjs
```

The builder writes atlas, mips, preview, and manifest. `--check` compares an
in-memory rebuild byte-for-byte. The Node validator checks shape, canonical paths,
source allowlist, hashes, image headers, mips, slot placement, and UV arithmetic.

## Adoption limits

Runtime loader, mip cap, split-quad UV integration, and game-zoom review are
separate work. This ground atlas is distinct from the GLB sample's material atlas
and the sprite-page format.
