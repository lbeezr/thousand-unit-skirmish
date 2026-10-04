# Generic oak depletion atlas

Default full-cutout worked/low/depleted textures for generic oak resource nodes
in `environment-art.mjs`. Normal full Meshy/directional oak, legacy full oak,
regional wood, berries and gameplay stock/occupancy stay on their existing paths.
[Acceptance and retained owner](../../../docs/qa-oak-depletion-atlas-adoption.md).

Existing public candidate/interactive PNGs provide all pixels; sources are not
repainted or replaced. The manifest binds original source hashes, inherited
1226 × 1283 canvases, bottom-center `(613,1283)` pivots and 4.1 × 3.75 world planes.
Quality-86 WebP RGB follows the current individual codec setting. Alpha remains
exact at all six levels relative to isolated premultiplied BOX source-cell
filtering. No HSV layer order or new semantic depth matte is introduced.

Three 1312 × 1376 cells form a 3936 × 1376 page with 32-pixel transparent-alpha/
edge-RGB gutters. The loader hash-verifies and decodes each mip once from local
blob URLs, shares one texture source, disables generated mips and uses half-pixel
insets. The map shader caps sampling at authored mip 5 with anisotropy 1.
Any manifest, hash, decode or dimensions failure retains the existing individual
state images. Original fallback files still ship; they are not fetched when atlas
loading succeeds.

The six files total **1,191,760 bytes**, plus manifest, and **28,877,940 decoded
RGBA bytes (27.54 MiB)** before driver overhead. The three previous individual
images total 817,940 encoded bytes and about 23.99 MiB with generated mips: this
adds 373,820 encoded bytes and 3.55 MiB decoded. It is a bounded atlas adoption,
not a payload or draw-call reduction claim. Per-state instance batches remain.
The earlier 5.05 MB four-state lossless reference remains unbound/unpacked.

From the repository root:

```sh
npm run validate:oak-depletion-atlas
python3 scripts/oak-depletion-atlas.test.py
node --test scripts/oak-depletion-atlas-runtime.test.mjs
```

Rebuild only this manifest and six encodes with
`python3 scripts/build-oak-depletion-atlas.py --write --overwrite` in a
Python/Pillow environment. The normal validator writes no files. GPU appearance,
actual deployed delivery and ordinary-game stock-transition acceptance remain
separate from source/alpha/hash and mocked-image tests.
