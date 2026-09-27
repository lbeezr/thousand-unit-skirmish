# Town Center Meshy reference views

**Status:** finished-state source/review set. Gameplay uses a self-contained copy
in the [lifecycle pack](../town-center-lifecycle-meshy-v1/README.md).
[Pipeline](../../../docs/building-asset-production-pipeline.md) · [Provenance](PROVENANCE.md)

## Contents

Eight indexed color views of the optimized model use 640 × 640 frames, a
5 × 5 world-unit frame, 128 pixels/world unit, and a shared ground anchor.
[sprite-grid.json](sprite-grid.json) records view mapping; `runtime/` holds WebPs.

The large optimized GLB and full-resolution render intermediates remain in local
`meshy_output/` production storage, outside this checked-in review pack.

## Review and limits

Open **Match Controls → Building Variant Atlas** (`/building-map.html`) to compare
views, direct sprites, and concepts. This pack covers Complete only. The sibling
lifecycle pack adds Foundation, Frame, Damaged, Critical, and team masks.
A review page does not demonstrate those states as live Town Center gameplay.
