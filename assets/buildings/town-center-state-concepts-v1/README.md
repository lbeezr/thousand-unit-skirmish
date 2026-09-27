# Town Center state concepts

**Status:** matched 2D sources, subsequently modeled for the
[captured lifecycle pack](../town-center-lifecycle-meshy-v1/README.md).

## Designs

Each transparent PNG is 1254 × 1254 with matching Azure heraldry, materials,
footprint, and elevated three-quarter camera.

| State | Reference condition | Source |
| --- | --- | --- |
| Foundation | 5% construction | [PNG](source/town-center-foundation.png) |
| Frame | 50% construction | [PNG](source/town-center-frame.png) |
| Complete | Finished baseline | [PNG](source/town-center-complete.png) |
| Damaged | 60% health | [PNG](source/town-center-damaged.png) |
| Critical | 30% health | [PNG](source/town-center-critical.png) |

[state-concepts.json](state-concepts.json) contains hashes and processing status.
Each added state used its own Meshy generation/optimization jobs. Optimized GLBs
remain in local production storage; checked-in captured views are in the sibling
lifecycle pack.

## Provenance and limits

The four lifecycle concepts were generated individually with Codex ImageGen on
26 September 2026. Source hashes are recorded; exact generation prompts have not
been recovered into this package.

Use the [local Building Variant Atlas preview](../../../docs/assets.md#review-locally) to compare concepts and captured models. The game
uses captured Complete art; Town Center landmarks do not yet expose the other
lifecycle states in gameplay.
