# Preferred Meshy Building Sprite Pipeline

Use this as the default workflow for new building art. It turns matched 2D state designs into optimized 3D models and camera-registered sprite views. The [direct sprite workflow](building-sprite-production-workflow.md) documents existing 2D pack conventions and remains a fallback for assets that do not benefit from modeling.

## Production sequence

1. **Confirm which states the game supports.** Write down the construction and health thresholds first. Foundation, Frame, Complete, Damaged, and Critical are useful only when gameplay can actually show those states. Distinguish the occupied gameplay footprint from the visible base.
2. **Design one concept per state.** Create separate transparent source images with matching identity, materials, camera, scale, ground contact, palette, and lighting. Use the approved Complete design as the visual reference for each derived state. Review all concepts together on a labeled contact sheet. Do not send a multi-state sheet as one Meshy input.
3. **Process states as separate Meshy jobs.** Submit one approved state image per Image-to-3D task. Record the source-image hash, prompt/settings, Meshy task ID, preview, and credit cost. Check each model for silhouette, openings, roof shape, unwanted ground, and props before accepting it.
4. **Optimize each accepted model.** Remesh only after reviewing the source model. Keep both GLBs and record target and actual triangle counts, file bytes, material/texture counts, task ID, and spend. Treat a provider's target as a request; inspect the produced model.
5. **Capture matching perspectives from the optimized models.** Use one orthographic camera, elevation, lighting, frame, world scale, and ground anchor for every state. The Town Center pilot used eight azimuths at 45-degree intervals, 46-degree elevation, and 640 × 640 transparent color frames. Preserve the angle-to-filename mapping. Add normal, depth, silhouette, or team-color passes only when the renderer has a concrete use for them.
6. **Build a source and runtime package.** Retain concept PNGs, source and optimized GLBs, render intermediates, compressed runtime frames, and a labeled contact sheet. Include a manifest with dimensions, pixels per world unit, gameplay footprint, visible base, anchor, camera settings, state thresholds, team variants, source links, task IDs, and SHA-256 hashes.
7. **Review the result beside the current art in game.** Compare each state and camera step at gameplay zoom. Check scale, anchor, readability, transparency fringes, texture artifacts, and occlusion. Keep existing gameplay art until the review passes; promote the candidate only after explicit art review.

## Variants and state coverage

Create a separate model for a state when its silhouette or painted materials change. Do not spend a separate 3D job just to change team colors: use a documented material variant or verified color mask when that preserves the art. Inspect any heuristic recolor across every view.

Track every gameplay state in the manifest. Reuse a state only when the game should show the same art in both cases; do not silently substitute a finished model for a missing construction or damage state. Keep exploratory concepts distinct from supported runtime states.

## Town Center pilot

The finished Azure concept was processed as one Meshy image-to-3D task (`01a0df25-dcfd-763f-9534-5a12bd9539a3`) and one remesh task (`01a0df34-9701-7722-9099-dec985b42824`). The source model had 2,233,210 triangles and was 93,827,260 bytes. Remeshing with a 100,000-polygon target produced 98,940 triangles and a 55,713,384-byte GLB with one PBR material and three embedded images: 95.6% fewer triangles and 40.6% less file size. The two tasks used 35 credits total (30 for image-to-3D and 5 for remesh). These are measurements from one pilot, not a price guarantee. The eight compressed camera views are checked in under the [Town Center Meshy review pack](../assets/buildings/town-center-meshy-review-v1/README.md); the large GLB and full-resolution render intermediates remain in local production output.

The four additional concepts—Foundation (5% build progress), Frame (50%), Damaged (60% health), and Critical (30% health)—are source art only. They have not been uploaded to Meshy, modeled, optimized, or rendered into sprite frames. Each needs its own approved Meshy task before it enters the reference set. The current game uses Town Centers as static map landmarks, so these exploratory states are not supported runtime states yet. The source images and checksums are listed in the [Town Center state concept package](../assets/buildings/town-center-state-concepts-v1/README.md). The [Building Variant Atlas](../building-map.html) compares the checked-in Meshy views with the current sprites and concepts.
