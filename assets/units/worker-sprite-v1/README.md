# Worker sprite exploration v1

Painterly Worker cutout exploration for the fixed oblique RTS camera. The atlas remains source art; explicit runtime metadata and a derived team-accent mask are now packaged beside it.

![Eight-facing Worker sprite atlas](worker-atlas-source.png)

The transparent sheet has eight approximate facing columns and six rows: idle, two walk poses, a gather chop, a build strike, and a defeated pose. Open the shared [animation test](../sprite-animation-test.html) to see it in a moving scene. Run the source-pack check with:

```sh
node scripts/validate-unit-sprite-atlas.mjs assets/units/worker-sprite-v1/manifest.json
```

See [`manifest.json`](manifest.json), [`PROMPT.md`](PROMPT.md), and [`PROVENANCE.md`](PROVENANCE.md) for frame metadata and source details.

The manifest now records 48 frame rectangles, thresholded pose bounds, bottom-center ground pivots, eight-direction idle/walk/gather/build/defeat sequences, and world bounds. `team-accent-mask.png` is a derived gray8 mask: black preserves the source and white applies the team hue while preserving luminance and alpha. The source atlas is unchanged.

The Worker silhouette uses the unit kit's warm cap, backpack, broad tool, and Azure sash. Gather and build remain single action poses, not timed action loops. There is no food-carry state or combat attack pose, and the metadata is not yet consumed by the live renderer.
