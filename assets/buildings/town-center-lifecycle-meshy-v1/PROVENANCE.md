# Town Center Meshy Lifecycle Provenance

The four supplemental Town Center states were individually generated and optimized on 2026-09-26. Each pair of tasks consumed 35 credits; the four-state run used 140 credits total. The complete model was processed earlier for 35 credits. The optimized GLBs remain in local ignored `meshy_output/town-center-lifecycle-v1/models/`; this package checks in the 40 compact WebP color frames, 40 alpha team-color masks, and their verified lifecycle manifest.

All captures use the local Three.js reference renderer: 640 × 640 pixels, orthographic, 46° elevation, azimuths 0–315° in 45° steps, transparent background, fixed studio lighting, and ground anchor [320, 376]. Runtime WebPs are quality 92 conversions of the matching PNG color frames; camera framing and pixels are unchanged.

## Foundation

- Source concept: `../town-center-state-concepts-v1/source/town-center-foundation.png` (SHA-256 `2be54448fade7ea0cbbc2687cca47dce5561655985f93e2bc85ca25c1bcdbd87`).
- Image-to-3D task: `01a0dfa4-d488-73f7-8704-54ccfba44fb0` (30 credits).
- Optimization task: `01a0dfaa-e5ce-7361-bec9-7b349507ac38` (5 credits; 100,000-polygon target).
- Optimized local GLB: `meshy_output/town-center-lifecycle-v1/models/town-center-foundation-optimized.glb` (100,459 triangles; 61,915,288 bytes; SHA-256 `3b448a38bb1552b094b5b9dee6e341e19886e5ae01495a6f5940fd427b102c3e`).
- Contact sheet: `previews/town-center-foundation-eight-view.webp` (SHA-256 `105e57b6a97a4a473516a57825193776a16ba291c5f4e43d01f76acc688eb39b`).
- Eight 640 × 640 color views are indexed in `lifecycle-grid.json`; each runtime file has a SHA-256 digest there.

## Frame

- Source concept: `../town-center-state-concepts-v1/source/town-center-frame.png` (SHA-256 `713f0b200c732aa2c5da1d977255899bee5690382ee2c5c636bb247aca4344f8`).
- Image-to-3D task: `01a0dfaf-69e6-7051-a101-40cf327e8809` (30 credits).
- Optimization task: `01a0dfb7-2e73-74c1-835f-d7e008d1b350` (5 credits; 100,000-polygon target).
- Optimized local GLB: `meshy_output/town-center-lifecycle-v1/models/town-center-frame-optimized.glb` (100,207 triangles; 34,568,232 bytes; SHA-256 `8b8ef42c61443e06b65c87276297c0b2d64e3de27db287a8cdd352d1b11a81ad`).
- Contact sheet: `previews/town-center-frame-eight-view.webp` (SHA-256 `8e9224be6584520b12230b9737b7520d7ea8c5af76e5b92698342007becd29bb`).
- Eight 640 × 640 color views are indexed in `lifecycle-grid.json`; each runtime file has a SHA-256 digest there.

## Damaged

- Source concept: `../town-center-state-concepts-v1/source/town-center-damaged.png` (SHA-256 `30c7fdd1f01f2d249a6f603866f9cb999de9542225046d48844d24c91fae3446`).
- Image-to-3D task: `01a0dfba-cf2f-7469-a194-e8e9e19ba079` (30 credits).
- Optimization task: `01a0dfbf-0ff3-7611-8211-fffcc953cbb5` (5 credits; 100,000-polygon target).
- Optimized local GLB: `meshy_output/town-center-lifecycle-v1/models/town-center-damaged-optimized.glb` (99,409 triangles; 58,432,664 bytes; SHA-256 `f673dfbbea8861a958efb1e5a644b64c50d211f82ddea71fa6af42101ca0722a`).
- Contact sheet: `previews/town-center-damaged-eight-view.webp` (SHA-256 `92a7e6cf1c4c224b0643d0d19baf367d3d1f5dc17dd18cc0e09a4d91a9d7f740`).
- Eight 640 × 640 color views are indexed in `lifecycle-grid.json`; each runtime file has a SHA-256 digest there.

## Critical

- Source concept: `../town-center-state-concepts-v1/source/town-center-critical.png` (SHA-256 `1e7c6e2ac9121ea19ab1007d10921bc69a888394c60670ae5719f27dee34a1d5`).
- Image-to-3D task: `01a0dfba-fd70-77d4-a175-8a526f87584f` (30 credits).
- Optimization task: `01a0dfc4-32f5-7133-a390-c40bfdb9b9c1` (5 credits; 100,000-polygon target).
- Optimized local GLB: `meshy_output/town-center-lifecycle-v1/models/town-center-critical-optimized.glb` (101,278 triangles; 58,028,052 bytes; SHA-256 `6dc71fd459cbb4f85920e82efc58dea7685281d30f9eb83e4a52dbc2dd91dece`).
- Contact sheet: `previews/town-center-critical-eight-view.webp` (SHA-256 `6ee45214e63c450bcec5bd778095d4fa94e8cae1d8df2e60af959f136827df99`).
- Eight 640 × 640 color views are indexed in `lifecycle-grid.json`; each runtime file has a SHA-256 digest there.
