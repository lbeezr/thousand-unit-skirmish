# Worker sprite exploration v2

Painterly Worker atlas revision focused on a clearer human silhouette at RTS game zoom. Compared with v1, this pass reduces the pack and gives the shoulders, arms, torso, and legs more visual weight. The atlas is a source-art candidate; its frame metadata, mask, runtime page, and canonical pack are deterministic derivatives.

![Eight-facing Worker sprite atlas](worker-atlas-source.png)

The sheet uses eight approximate facings and six aligned rows: idle, two walk poses, a gather chop, a build strike, and a defeated pose. The standing poses share the existing foot-pivot heuristic. This pass has visible red/yellow edge contamination around the cutouts. It is now available in the opt-in game renderer with `?workerSpritePreview=1`, so its scale and silhouette can be judged in gameplay context while the sheet remains an experiment. The pack still declares `runtimeReady: false`: repair the alpha edge and review its estimated pivots before considering a default renderer switch.

Validate and regenerate the derived files with:

    node scripts/prepare-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json
    node scripts/validate-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json

See PROMPT.md, PROVENANCE.md, manifest.json, and sprite-atlas-pack-v1.json. The three-role `?unitSpritePreview=1` comparison continues to use Worker v1 so the newer Worker pass can be judged independently.
