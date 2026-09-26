# Town Center sprite provenance

- Generated: 2026-09-26 with the built-in Codex ImageGen tool.
- Asset: original static Town Center landmark art for Thousand Unit Skirmish.
- Third-party reference art: none. The original project Barracks sprite was supplied only as a style, material, and camera reference.
- Camera: fixed elevated orthographic three-quarter view, 45-degree azimuth and 46-degree downward pitch.
- Source format: 1254 × 1254 RGBA PNG.
- Runtime processing: [`scripts/prepare-building-sprite-pack.py`](../../../scripts/prepare-building-sprite-pack.py) fixes scale from the complete source, crops transparent bounds without axis stretching, aligns the visible base to the 4 × 4 support diamond, writes two 640 × 640 team WebP frames, and builds the preview.
- Coverage and anchor: see [`sprite-grid.json`](sprite-grid.json). The game currently treats Town Centers as decorative spawn landmarks without placement, construction, or damage lifecycle.

## Exact generation prompt (`exec-51f8626e-8e6c-47bf-8f4f-4417f710c22c`)

> Create an original isolated transparent-background Town Center sprite for the same browser RTS project, using the reference image only for painterly material style, lighting, palette, orthographic three-quarter camera, and sprite cutout quality. Do NOT repeat its Barracks architecture. Subject: a compact frontier Town Center in a 3 by 3 world-unit footprint: sturdy pale limestone-and-timber hall, taller than a home but much smaller than a castle, broad rectangular base, one central arched dark timber doorway on the near-facing front, a single slate hipped roof with a modest square lookout/cupola, tiny Azure-blue cloth pennant mounted on the roof. Read as a safe civic/economic landmark, not military. Show front and right side from elevated orthographic three-quarter camera, about 45 degrees around and 46 degrees down. Match the reference scale, projection, and lower-center ground contact placement. Square canvas, entire silhouette visible with modest transparent padding. Transparent alpha, no environment, no ground plane, no cast shadow, no people, no text, no labels, no grid, no UI, no watermark, no logos, no commercial-game resemblance. Neutral soft daylight, subdued moss/timber/slate/limestone palette, restrained detail, strong legible silhouette.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `source/town-center-complete.png` | `7b69eff0c2fdb033248b8ae606b3d9fae0ff593e2423002d93fbf3f9b5cae8a5` |
| `runtime/town-center-complete-azure.webp` | `9905ce978102a194db384356e6f3bcad2ba03144e24b2b09375dcccfbf11590e` |
| `runtime/town-center-complete-ember.webp` | `9cc174d22a53cb4b66b351bf3a10eaf7b0d3f484dc86b5098ca600248b90845b` |
