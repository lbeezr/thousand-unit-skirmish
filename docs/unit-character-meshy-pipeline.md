# Unit character Meshy-to-sprite feasibility checkpoint

**Status:** comparison only. The user asked to stop further Worker capture iteration and learn the Meshy-assisted method used for building references. This does not change the painterly 2D production direction. No character Meshy task has been submitted and no character generation credits were used.

## What the building method actually does

The [building asset pipeline](building-asset-production-pipeline.md) starts with approved 2D state concepts, submits one image-to-3D job per state, inspects the generated model, remeshes an accepted model, then captures registered views and packages them with provenance. The open [PR #155](https://github.com/lbliii/thousand-unit-skirmish/pull/155) contains a review-only Town Center sample: one Meshy model was remeshed to 98,940 triangles and rendered as eight 640 × 640 WebP views at 45-degree azimuth steps and 46-degree elevation. The tracked views, camera/frame metadata, task IDs, hashes, and costs are present; the optimized GLB and full-resolution render intermediates are not in this checkout. The provenance records 35 credits for that one historical building pilot, not a current estimate for a character.

Those views were rendered with the project's local Three.js browser renderer, not by manually modeling each view in Blender. The PR gallery displays the saved frames; it does not generate them or replace the in-game Town Center. The separate `frontier-glb-sample-v2` unit/building pack was authored in Blender and uses rigid parts without skeletal skinning, so it is not a Meshy rigging example.

## What a future character comparison would test

If a later user instruction explicitly reopens Meshy character production, adapt the building sequence as follows:

1. **Choose one role and lock its visual contract.** Start with Infantry: the six-sided shield, spear, steel-grey cap, neutral gear, and team sash give the pilot a specific silhouette and a clear attack to judge. Make the character reference clean and full-body, with a rig-friendly A-pose or T-pose. Include front, side, back, and three-quarter views when possible; a single three-quarter image leaves unseen equipment and back details to inference. Keep the sash as an isolated material or mask so Azure/Ember does not require two models.
2. **Generate and inspect the 3D source.** Use Meshy's image-to-3D workflow from the approved character reference. Inspect the face, hands, feet, shield, spear, pack, and silhouette from all around before accepting it. Keep the model and task metadata with the source image, prompt/settings, and hashes.
3. **Remesh, then auto-rig.** Preserve the original and optimized GLBs and record actual face count, bytes, materials, and texture count. Meshy's rigging documentation says its auto-rig works best on clearly defined humanoid bipeds; models above 300,000 faces must be reduced before API rigging. A/T pose is the intended input shape for downstream rigging.
4. **Apply animation clips to that rig.** First check Meshy's preset library for idle, walk, attack, hit, and defeat clips. If the preset attack does not hold and thrust the spear correctly, try a short text-to-motion clip and inspect the retargeted result. The API supports applying multiple preset clips to one rig and applying a generated motion clip to a rigged biped; the motion source is retained for only three days, so it must be applied and saved promptly.
5. **Render the animated model into sprite frames.** Extend the building capture approach to advance each clip at fixed timestamps and render eight azimuths, 45 degrees apart, at the established 46-degree elevation. Keep world scale, orthographic camera, studio light, canvas, and ground pivot fixed across frames. Save transparent PNG source frames; create compressed runtime pages, contact sheets, gray8 sash masks, explicit frame rectangles, pivots, clip timing, hashes, and a manifest using the existing sprite-atlas contract.
6. **Review in the existing opt-in game path.** Compare native game-scale Infantry frames with the current atlas on Meadow/Cinder, both teams, and both zoom settings. Check role silhouette, weapon attachment, foot/root stability, team tint, frame continuity, edge quality, and actual order-driven attack/defeat transitions. Keep the default renderer unchanged until a useful candidate is integrated; do not claim performance savings without a comparable large-army measurement.

If the user later reopens this method, the likely division of labor is Meshy for model creation, remeshing, rigging, and motion; a saved Three.js capture tool for repeatable turntable animation renders; and the existing sprite packer/runtime for frame metadata, masks, batching, and gameplay preview. Blender modeling would not be required for that route.

## Questions a future pilot would settle

- Whether Meshy produces a clean, recognizable Infantry from the project's reference art, especially from rear and side views.
- Whether auto-rigging preserves the shield and spear through walking, attacking, hit, and defeat clips, or whether those props need a separate attachment contract.
- Whether a generated animation can be sampled into consistent eight-direction frames without foot/root drift or direction-to-direction equipment changes.
- Whether the rendered sprite frames retain the desired painterly fit and read at actual gameplay scale. Higher-resolution modeling does not by itself solve the current small-on-screen readability problem.
- How much atlas memory and alpha overdraw the direction × clip-frame set requires. A sprite output still needs the current batched sprite runtime; Meshy does not solve runtime animation selection.

If the user later explicitly changes the production direction, one Infantry comparison covering idle, walk, spear attack, and defeat would be a bounded first check beside the existing hand-authored atlas. That is not the current production plan. This note records the method only; it does not authorize paid provider work or select Meshy as the final art source.

## References

- Project workflow: [Meshy-assisted building reference pipeline](building-asset-production-pipeline.md), [Town Center Meshy review pack](https://github.com/lbliii/thousand-unit-skirmish/pull/155), and [sprite atlas contract](sprite-atlas-contract-v1.md).
- Meshy: [Image to 3D](https://docs.meshy.ai/en/api/image-to-3d), [Rigging](https://docs.meshy.ai/en/api/rigging), [Animation](https://docs.meshy.ai/en/api/animation), [Animation library](https://docs.meshy.ai/en/api/animation-library), and [Text to Motion](https://docs.meshy.ai/en/api/text-to-motion).
