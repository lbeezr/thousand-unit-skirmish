# Worker sprite exploration v1

Source-only Worker cutout study for the fixed oblique RTS camera.

![Eight-facing Worker sprite atlas](worker-atlas-source.png)

The transparent sheet has eight approximate facing columns and six rows: idle, two walk poses, a gather chop, a build strike, and a defeated pose. Open the shared [animation test](../sprite-animation-test.html) to see it in a moving scene. Run the source-pack check with:

```sh
node scripts/validate-unit-sprite-atlas.mjs assets/units/worker-sprite-v1/manifest.json
```

See [`manifest.json`](manifest.json), [`PROMPT.md`](PROMPT.md), and [`PROVENANCE.md`](PROVENANCE.md) for frame metadata and source details.

The Worker silhouette uses the unit kit's warm cap, backpack, broad tool, and Azure sash. The work poses are single stills, not gather/build animation loops. There is no food-gathering pose, cargo state, Ember variant, team mask, calibrated pivot, or runtime integration.
