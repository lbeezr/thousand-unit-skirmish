# Worker sprite exploration v2

Painterly Worker atlas revision focused on a clearer human silhouette at RTS game zoom. Compared with v1, this pass reduces the pack and gives the shoulders, arms, torso, and legs more visual weight. The atlas is a source-art candidate; its frame metadata, mask, runtime page, and canonical pack are deterministic derivatives.

![Eight-facing Worker sprite atlas](worker-atlas-source.png)

The sheet uses eight approximate facings and six aligned rows: idle, two walk poses, a gather chop, a build strike, and a defeated pose. The standing poses share the existing foot-pivot heuristic. This pass has visible red/yellow edge contamination around the cutouts. It is available in the opt-in game renderer with `?workerSpritePreview=1`. The current wide full-game views do not establish readability at either zoom; 4× unit-cluster crops aid art inspection without changing in-game scale. The pack still declares `runtimeReady: false`: repair the alpha edge and review its estimated pivots before considering a default renderer switch.

The local sealed `renderer-worker-sprite-v2` game capture (`run_1790458381860_7b7077d0a4ca46b9a706ccb806154a79`) covers both teams, Meadow/Cinder, and play/strategic zoom on current main. Each full view has a 4× unit-cluster crop. Generated capture files live in the ignored `.game-dev/runs` output and are not included in this source branch. At standard scale the wide view does not establish character readability at either zoom; the magnified crops expose the sprite silhouette for inspection. The cutout halo remains visible. This is static appearance evidence and does not exercise live action transitions.

Validate and regenerate the derived files with:

    node scripts/prepare-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json
    node scripts/validate-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json

See PROMPT.md, PROVENANCE.md, manifest.json, and sprite-atlas-pack-v1.json. The three-role `?unitSpritePreview=1` comparison continues to use Worker v1 so the newer Worker pass can be judged independently.
