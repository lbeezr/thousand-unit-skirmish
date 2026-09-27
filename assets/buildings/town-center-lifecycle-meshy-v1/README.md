# Town Center captured lifecycle pack

**Status:** integrated Town Center artwork with procedural loading/error fallback.
[Pipeline](../../../docs/building-asset-production-pipeline.md) · [Provenance](PROVENANCE.md)

## Coverage

Five separately modeled states share eight camera directions: forty 640 × 640
color captures and forty alpha team masks under `runtime/`. The Complete model
originated in the [reference pilot](../town-center-meshy-review-v1/README.md).

| State | Reference condition | Views | Recorded credits |
| --- | --- | ---: | ---: |
| Foundation | 5% construction | 8 | 35 |
| Frame | 50% construction | 8 | 35 |
| Complete | Intact | 8 | 35, earlier pilot |
| Damaged | 60% health | 8 | 35 |
| Critical | 30% health | 8 | 35 |

The four added generation/remesh pairs consumed 140 credits; 175 including the
complete pilot. These are completed-job costs, not future pricing.

## Manifest and runtime

[lifecycle-grid.json](lifecycle-grid.json) records state thresholds, camera,
task IDs, optimized-model hashes, view hashes, and masks. The loader verifies
image hashes, selects the nearest of eight azimuths, and tints banners through
masks. The generic resolver supports construction and damage values.

Current Town Centers are static landmarks without construction progress or
health, so only **Complete** appears during a match. Other states are ready
for a future gameplay source; their presence does not implement that mechanic.
Barracks and Archery Ranges use a separate direct-sprite loader.

## Review and source storage

Use the [local Building Variant Atlas preview](../../../docs/assets.md#review-locally) to compare all state/view
sets. Optimized GLBs and full-resolution color, normal, depth, silhouette,
team-mask, and contact-shadow intermediates remain in local ignored
`meshy_output/`. Compact runtime files are checked in here.

The source server serves this pack, and Docker includes its manifest and runtime
images. Town Centers have a server-owned collision footprint, but still expose
no construction or health state. Verify actual hosted appearance on a named build.
