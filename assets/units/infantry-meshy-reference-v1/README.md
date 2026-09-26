# Infantry Meshy reference v1

**Status:** this one-image source pack was used for the approved 26-credit Meshy Infantry pilot. It produced a textured model, rig, walk, attack, and defeat clips. The model omitted the reference spear and shield. It is exploratory source material, not a game-ready unit or sprite atlas.

This pack contains exactly one full-body Infantry concept image: [`source/infantry-reference.png`](source/infantry-reference.png). Meshy's Image-to-3D workflow accepts a single PNG or JPG, so extra side, back, or turntable concept images are not needed to start a model. Meshy will infer unseen surfaces from this view; inspect the generated model from all angles before deciding whether it is usable. [Meshy Image to 3D](https://docs.meshy.ai/en/api/image-to-3d)

The reference follows the unit visual contract: full-height body, steel-grey cap, dark six-sided shield, upright spear, neutral brown equipment, and one blue sash as the team-accent surface. It is a standing pose with shield and spear in hand, not a neutral rigging pose.

This is a modeling reference, not a game-ready unit. The generated GLBs and Meshy task records are retained in the local `infantry-meshy-pilot` worktree under `meshy_output/20260926_192615_infantry-meshy-pilot_01a0e00a/`; they are not part of this source pack. The animation preview plays the existing walk, attack, and defeat clips from eight camera headings, but no directional sprite frames or game runtime integration exist yet. See [`PROVENANCE.md`](PROVENANCE.md) and the [Meshy workflow checkpoint](../../../docs/unit-character-meshy-pipeline.md) for task IDs, costs, and limits.

## Files

- `source/infantry-reference.png` — the sole Meshy input image, 1024 × 1536.
- `reference-set.json` — view and integrity metadata for the single input.
- `PROVENANCE.md` — source and current task status.
- `REFERENCE-BRIEF.md` — concise design cues for review and future reproduction.
- `SHA256SUMS.txt` — hash of the packaged reference image.

No buildings were modified for this unit-only reference pack. See [`docs/unit-character-meshy-pipeline.md`](../../../docs/unit-character-meshy-pipeline.md) for the planned Meshy-to-sprite flow.
