# Town Center State Concepts

This package contains a matched Town Center design for each visible construction and damage state. The images are separate transparent 1254 × 1254 PNGs and keep the same Azure heraldry, materials, footprint, and elevated three-quarter camera. The complete-state image is included as the visual baseline.

| State | Reference condition | Concept |
|---|---:|---|
| Foundation | 5% construction | [town-center-foundation.png](source/town-center-foundation.png) |
| Frame | 50% construction | [town-center-frame.png](source/town-center-frame.png) |
| Complete | Finished reference | [town-center-complete.png](source/town-center-complete.png) |
| Damaged | 60% health | [town-center-damaged.png](source/town-center-damaged.png) |
| Critical | 30% health | [town-center-critical.png](source/town-center-critical.png) |

See [state-concepts.json](state-concepts.json) for hashes and processing status. Foundation, Frame, Damaged, and Critical were each processed as separate Meshy image-to-3D and optimization jobs; their eight-view captures are in the sibling [Town Center Meshy lifecycle runtime pack](../town-center-lifecycle-meshy-v1/README.md). This package keeps the matched 2D source designs, while optimized GLBs remain in local production output. The sibling lifecycle runtime pack contains all five captured states; Complete is now the in-game Town Center art. The other states are ready for a building that supplies construction progress or health, which current Town Center landmarks do not expose.

The four lifecycle concepts were generated individually with Codex ImageGen on 2026-09-26. The generation prompts are not yet recorded in this package; source-file hashes are recorded in the manifest.

See the [Building Variant Atlas](../../../building-map.html) for the Meshy pilot views, current game sprites, and these unprocessed state designs side by side.
