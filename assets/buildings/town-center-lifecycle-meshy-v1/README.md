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
Other building types keep their existing renderers.

## Review and source storage

Open **Building Variant Atlas** from Match Controls to compare all state/view
sets. Optimized GLBs and full-resolution color, normal, depth, silhouette,
team-mask, and contact-shadow intermediates remain in local ignored
`meshy_output/`. Compact runtime files are checked in here.
