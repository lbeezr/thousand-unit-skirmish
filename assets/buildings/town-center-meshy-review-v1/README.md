# Town Center Meshy Reference Sprite Set

This pilot follows the [building asset production pipeline](../../../docs/building-asset-production-pipeline.md).

This review-only pack turns the optimized Meshy Town Center model into eight indexed color views. The [Building Variant Atlas](../../../building-map.html) shows the views beside the current team sprites and the lifecycle source concepts. These frames are references for art review; the gameplay Town Center has not been switched to the Meshy output.

The frames are 640 × 640 pixels and use the current Town Center pack's 5 × 5 world-unit frame, 128 px per world unit, and projected ground-center anchor. Only the finished state is in this Meshy reference pack. Separate Foundation, Frame, Damaged, and Critical concepts are ready in the sibling [Town Center state-concepts package](../town-center-state-concepts-v1/README.md), but are not yet Meshy models. The atlas presents all of these as review references and does not assign them to gameplay buildings.

See `sprite-grid.json` for the view and frame layout, and `PROVENANCE.md` for Meshy task ids, renderer settings, and hashes. The compressed WebP review frames are checked in under `runtime/`. The optimized GLB and full-resolution PNG intermediates remain in the local `meshy_output/` production output and are not part of this review pack.
