# Vaelora entry art

The ordinary front page loads `bellweather-map.png` through `src/game-menu.css`.
It is an unchanged copy of the selected source at
`docs/art-direction/vaelora-v1/bellweather-map.png` (1536 × 1024, 3,845,695 bytes,
SHA-256 `53fd821208acfe8c40fbe516469f71553b3b8feb98b61913ca58c0e6f0e9732d`).
The source checkpoint records built-in image generation on 29 September 2026,
with no third-party image inputs. No new environment/building art is produced.

This is world concept art, visibly labeled in the portal, not a gameplay image.
The original stays preserved. CSS composes it with gradients and live text;
there is no raster alteration. The uncompressed source is retained in this
first slice; visual-preserving delivery compression is a later optimization.
The three exact public image paths are the Bellweather PNG and the two WebP
materials below. The Dockerfile already copies `assets/ui/`; source mockups
and original material PNGs stay under docs and do not ship with the game.

## Separate material layers

`brass-surface.webp` and `oak-corner.webp` are original built-in image-generation
outputs from 11 October 2026, guided by the user-selected immersive client study.
The [source pack and prompts](../../../docs/art-direction/vaelora-brand-v1/README.md#material-iteration--11-october-2026)
are retained. [materials-manifest.json](materials-manifest.json) records exact
source/runtime hashes, dimensions and export evidence. Pillow 12.3.0 encoded
lossless WebP with `lossless=True, exact=True, method=6`; decoded RGBA bytes
were verified identical to the source. No crop, resize or creative raster edit
was applied. The oak's alpha is retained.

The CSS layers these separately with the code-native frame and live controls.
They add 2,949,170 bytes combined, fetched once and reused within the portal.
Delivery-size reduction is still an optimization opportunity; the current
slice prioritizes exact source preservation. Only the image paths are public;
this README and the manifest stay outside the HTTP allowlist.

Brand plan: [Vaelora](../../../docs/vaelora-brand.md).
Owner: branding/portal chat `01a12b79`, including deployed appearance verification.
