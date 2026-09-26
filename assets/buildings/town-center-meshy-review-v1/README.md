# Town Center Meshy Reference Sprite Set

This pilot follows the [building asset production pipeline](../../../docs/building-asset-production-pipeline.md).

This review-only pack turns the optimized Meshy Town Center model into eight indexed color views. The [Building Variant Atlas](../../../building-map.html) shows the views beside the current team sprites and the lifecycle source concepts. These frames remain the source and review set. The gameplay renderer consumes a self-contained copy in the sibling lifecycle runtime pack, where team masks and all five states are available.

The frames are 640 × 640 pixels and use the current Town Center pack's 5 × 5 world-unit frame, 128 px per world unit, and projected ground-center anchor. This pilot pack covers the finished state. Foundation, Frame, Damaged, and Critical now have separate optimized Meshy models and captured views in the sibling [Town Center Meshy lifecycle runtime pack](../town-center-lifecycle-meshy-v1/README.md). The atlas presents the pilot beside the current sprites; gameplay uses the matching Complete frames from the lifecycle runtime pack.

See `sprite-grid.json` for the view and frame layout, and `PROVENANCE.md` for Meshy task ids, renderer settings, and hashes. The compressed WebP review frames are checked in under `runtime/`. The optimized GLB and full-resolution PNG intermediates remain in the local `meshy_output/` production output and are not part of this review pack.
