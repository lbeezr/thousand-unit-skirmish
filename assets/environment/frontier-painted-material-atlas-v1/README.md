# Painted ground material atlas v1

**Status:** default runtime for the eight represented ground paints. Regional/quiet
replacements and other materials retain their individual textures. Deployed
appearance verification remains incomplete; [owner and evidence](../../../docs/qa-painted-ground-atlas-adoption.md).
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Layout and sampling

Eight project ground paints occupy a 3 × 3 page, with the last slot empty.
Each slot has a 512 × 512 interior and 64 px mirrored gutters on every side.
The assembled page is 1920 × 1920, opaque sRGB RGB8, clamped at page edges.
Material repetition remains world-aligned with a 12-world-unit period.

`uvRectTopLeft` records normalized pixel-center bounds. Inset half a pixel,
flip the WebGL v coordinate, and fold samples at integer repeat boundaries.
The runtime folds UVs at each shader read, after stochastic rotation/offset;
geometry splits alone cannot preserve that sampling. The existing split-quad
helper remains available for consumers that interpolate atlas UVs in geometry.
World alignment and the independent feather mask remain unchanged.

Six authored runtime mips are 1920, 960, 480, 240, 120, and 60 px square.
Levels 0–3 use WebP quality 86; 4–5 are lossless to avoid compression-block drift.
The loader supplies only these six authored mips, disables GPU mip generation,
and allocates a shared page through Three r180's immutable texture storage.
The sampling shader also caps the gradient footprint at mip 5 to keep distant
and anisotropic reads inside the mirrored gutters.

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
node --test scripts/painted-material-atlas-runtime.test.mjs
```

The builder writes atlas, mips, preview, and manifest. `--check` compares an
in-memory rebuild byte-for-byte. The Node validator checks shape, canonical paths,
source allowlist, hashes, image headers, mips, slot placement, and UV arithmetic.

## Adoption limits

Normal `createGroundSurfaces()` uses these paints through the
[runtime loader](../../../src/painted-material-atlas-runtime.mjs) and
[sampling shader](../../../src/terrain-texture-sampling.mjs), with no preview gate.
The manifest and six WebPs ship; source/preview PNGs are not runtime files.
If manifest/mip loading fails, existing individual paints remain usable.
Game-zoom review and exact deployed revision evidence remain owner-held work.
This ground atlas is distinct from the resource/cliff candidates, the GLB
sample's material atlas, and the sprite-page format.
