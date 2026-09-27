# Provenance

- Generated 2026-09-26 with OpenAI ImageGen, output `exec-fcf36d84-c483-4152-90b0-e9dfdadbdf58`.
- Original project art for Thousand Unit Skirmish; no third-party reference imagery or game assets were used.
- `worker-atlas-source.png` is copied unchanged from the ImageGen output. Its SHA-256 and decoded dimensions are in `manifest.json`.
- The source image has not been cleaned, recolored, or team-swapped. `team-accent-mask.png` is a deterministic derived gray8 mask generated from blue-hue/saturation pixels; frame bounds, pivots, and sequences are derived from source alpha and manifest row metadata.
- `worker-atlas-runtime.png` copies the source image and bleeds nearby RGB into fully transparent pixels within each atlas cell for safer linear sampling. It preserves every visible RGB and alpha value.
- `sprite-atlas-pack-v1.json` is generated with the mask, runtime page hash, canonical frames/clips, and visual bounds. `scripts/prepare-unit-sprite-atlas.mjs` regenerates these derived outputs. The game does not yet consume them.
