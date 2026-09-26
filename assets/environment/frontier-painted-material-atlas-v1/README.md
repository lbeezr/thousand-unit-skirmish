# Frontier painted material atlas v1

This package is a shared surfacing sample built from the eight existing, project-owned Frontier ground paints. It establishes a repeatable atlas, mirrored-repeat UV contract, hand-authored mip chain, and file-integrity check for later ground and prop work. It does not contain the held unit/building sample or berry candidate.

## Layout

The source atlas is a 3 × 3 page with 512 × 512 material interiors and a 64-pixel mirrored gutter on every side of each slot. Page size is 1920 × 1920, which fits a 2048-pixel texture limit. Slots are row-major in the order listed by `manifest.json`; the last slot is empty. The atlas is opaque sRGB RGB8 and clamps at the page edge. Each material retains mirrored-repeat behavior at a 12-world-unit period.

`uvRectTopLeft` stores normalized pixel-center bounds in image coordinates. Runtime UVs use a half-pixel inset to keep linear and anisotropic filtering inside the material interior. The WebGL v coordinate is flipped when mapping from top-left image coordinates. Geometry splits at integer repeat boundaries and mirrors each tile in UV space, preserving the existing world-aligned repeat and feather alpha.

The runtime WebP files provide custom levels 0–5 at 1920, 960, 480, 240, 120, and 60 pixels square. Levels 0–3 use WebP quality 86; levels 4–5 are lossless because their slot pitches are not aligned to lossy compression blocks. The renderer must cap the texture at level 5 so distant filtering cannot blend adjacent material slots.

The original editable PNG sources remain in `assets/environment/frontier-v1/` and are referenced by path and hash in the manifest. The atlas PNG is the editable assembled page. `preview.png` shows each source crop repeated with mirrored UVs; it is a source preview, not an in-game comparison.

## Rebuild and validate

Use Python 3 and Pillow 12.3.0, pinned in `scripts/requirements-painted-material-atlas.txt`.

```sh
python3 scripts/build-painted-material-atlas.py
python3 scripts/build-painted-material-atlas.py --check
npm run validate:painted-material-atlas
node scripts/painted-material-atlas-uv-scenario.mjs
```

The builder writes the source atlas, six runtime mips, preview, and manifest. `--check` rebuilds in memory and compares each output byte-for-byte. The Node validator checks the JSON schema, safe canonical paths, source allowlist, SHA-256 hashes, PNG/WebP headers, mip dimensions, slot non-overlap by exact placement, and material UV arithmetic without requiring Pillow.

## Integration status

This is an authored source and runtime candidate package. The existing game renderer still uses the eight individual ground textures until the atlas loader, mip limit, and split-quad UV path are integrated and reviewed at ordinary gameplay zoom.
