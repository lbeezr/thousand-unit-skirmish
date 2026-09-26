# Worker sprite exploration v2

Painterly Worker atlas revision focused on a clearer human silhouette at RTS game zoom. Compared with v1, this pass reduces the pack and gives the shoulders, arms, torso, and legs more visual weight. The atlas is a source-art candidate; its frame metadata, mask, runtime page, and canonical pack are deterministic derivatives.

![Eight-facing Worker sprite atlas](worker-atlas-source.png)

The sheet uses eight approximate facings and six aligned rows: idle, two walk poses, a gather chop, a build strike, and a defeated pose. The standing poses share the existing foot-pivot heuristic. This pass has visible red/yellow edge contamination around the cutouts; keep it as a source experiment until the alpha edge is repaired and the silhouettes are reviewed in game. It is not the Worker runtime input.

Validate and regenerate the derived files with:

    node scripts/prepare-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json
    node scripts/validate-unit-sprite-atlas.mjs assets/units/worker-sprite-v2/manifest.json

See PROMPT.md, PROVENANCE.md, manifest.json, and sprite-atlas-pack-v1.json. This source has not replaced the current Worker candidate in the opt-in game preview yet.
