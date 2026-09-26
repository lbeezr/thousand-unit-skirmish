# Archer sprite exploration v1

Source-only Archer cutout study for the fixed oblique RTS camera.

![Eight-facing Archer sprite atlas](archer-atlas-source.png)

The transparent sheet has eight approximate facing columns and six rows: idle, two walk poses, bow draw, arrow release, and a defeated pose. Open the shared [animation test](../sprite-animation-test.html) to see the walk and attack sequence. Run the source-pack check with:

```sh
node scripts/validate-unit-sprite-atlas.mjs assets/units/archer-sprite-v1/manifest.json
```

See [`manifest.json`](manifest.json), [`PROMPT.md`](PROMPT.md), and [`PROVENANCE.md`](PROVENANCE.md) for frame metadata and source details.

The Archer silhouette uses a moss hood, bow, quiver, and Azure sash. Attack states are two still poses without a projectile. There is no Ember variant, team mask, calibrated pivot, hit/spawn state, or runtime integration.
