# Frontier commander cursor sources

Approved Meshy pointer and hammer, rendered to transparent 512 px PNGs from the optimized models. Runtime images are 40 px native cursors, with dark contours and small 2D command marks. Iron, brass and oak match the frontier art direction. The pointer tip is the hotspot; construction uses an explicit reticle.

Rebuild with `python3 scripts/build-cursor-pack.py` (Pillow required). This does not contact Meshy or spend credits. The source renders and models are not served to players. All 16 PNGs together are under 64 KB.

| Source | Image-to-3D task | Remesh task | Optimized triangles |
| --- | --- | --- | ---: |
| pointer.png | 01a0e012-8769-71dc-857c-42623af66b50 | 01a0e017-b7af-7143-b163-4a7ce0a0f16f | 1,971 |
| hammer.png | 01a0e013-0a1d-7036-8bcc-9c9889aaad9d | 01a0e017-c775-7238-9347-913ec760c59a | 2,013 |

Meshy optimization is part of the pipeline: generate, remesh to approximately 2,000 triangles, inspect silhouette, then render sprites. This pilot cost 70 credits total including remeshing. No additional generation is required for this runtime release.

Cursor mapping lives in `src/battlefield-cursor.mjs`; images, sizes and hotspots are declared in `assets/ui/cursors/manifest.json`. Camera panning retains native grab/grabbing cursors. Enemy targeting precedes resource targeting, matching context orders. Only movement orders show the Shift queue mark. Selection uses plus/minus and window/crossing marks. Browser cursors are not drawn through the game render loop.

Future glove, sword, axe, basket and banner models can replace the 2D marks after approval. Existing SVGs are retained as legacy art sources; the game uses the PNG pack.
