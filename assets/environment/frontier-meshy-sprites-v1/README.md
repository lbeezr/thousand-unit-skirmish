# Frontier tree and resource sprite capture

Review pack produced from the existing Frontier oak, pine, and berry concepts with the Meshy-assisted building workflow. These cover the current wood and food resource art. Models are generated once, reviewed, remeshed toward 100,000 triangles, and captured at eight azimuths.

Each asset folder contains a transparent 4 × 2 PNG/WebP atlas, eight lossless WebP frames, the full-resolution PNG intermediates, a labeled contact sheet, and `manifest.json`. Frames are 640 × 640. The orthographic camera uses a 46-degree elevation and azimuths 0, 45, 90, 135, 180, 225, 270, and 315 degrees. Azimuth 0 looks from +Z, 90 from +X. The model does not rotate; lighting remains fixed in world space, matching the building pilot.

The shared frame spans 5 world units, 128 pixels per world unit. The ground pivot is (320, 480), measured from the top left. Each model is fitted once across all views; the exact scale and projected size are recorded in its manifest. The anchor is lower than the building pilot's to accommodate tall trees. Use recorded scale rather than assuming all three occupy the same world footprint.

Original and optimized GLBs, source concepts, provider previews, and task receipts are retained locally (not in Git) in:

`meshy_output/20260926_212220_tree-resource-sprites_01a0e074/`

The committed `batch-manifest.json` records concept hashes, job identifiers, and credit usage. Per-asset manifests record optimized GLB hashes and measured model statistics. Concept PNG paths describe the original local inputs; only runtime WebP concepts are present in the baseline repository.

Reproduce capture with `scripts/render-resource-sprite-pack.py --help`. The script includes a standalone copy of the Town Center pilot renderer in `scripts/resource-sprite-capture.html` and preserves its lighting. Install project dependencies and Python Pillow first; place the matching optimized GLB inside the checkout. `--serve` prints a local browser URL, waits for its capture, then packs and checks all frames. It makes no provider calls. Use a fresh output directory for a new capture. Headless mode defaults to Chrome on macOS; `--serve` works with an existing WebGL browser.

This is an intact-state art review package. The intact-state sprites are the runtime default; see `preview/README.md`. Depletion variants and per-pixel depth passes are not included. Worked, low, and depleted resource states still use the older interactive pack. The separate active character-unit task owns the existing Meshy Infantry model and directional animation bake; this batch makes no duplicate character generation requests.

## Completed batch

All 24 views are saved and visually reviewed. Total provider cost: **105 credits**, from the six task receipts (30 generation + 5 remesh for each asset). Frame validation checked distinct views, no edge clipping, full transparency, and exact atlas-to-frame pixel correspondence.

- [Oak contact sheet](oak/contact-sheet.png) · [PNG atlas](oak/oak-atlas.png)
- [Pine contact sheet](pine/contact-sheet.png) · [PNG atlas](pine/pine-atlas.png)
- [Berries contact sheet](berries/contact-sheet.png) · [PNG atlas](berries/berries-atlas.png)

Measured optimized triangle counts are 103,712 for oak, 104,232 for pine, and 104,491 for berries. Each model has one material and three embedded images. The requested 100,000-triangle target was approximate.

## Camera alignment

View 01 looks from azimuth 45°, matching the game camera. The 46° capture elevation follows the building pilot; the game elevation is approximately 45.436°. Unit animation captures instead rotate the model under the game camera, so their direction indices are not interchangeable with this camera-orbit pack. A future exact-camera rebake needs no additional provider jobs.
