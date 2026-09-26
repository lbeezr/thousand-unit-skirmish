# Provenance

- Generated 2026-09-26 with OpenAI ImageGen, output `exec-1361d4d2-fa43-4ae8-8420-48b3e5c799de`.
- Original project art for Thousand Unit Skirmish; no third-party reference imagery or game assets were used.
- `infantry-atlas-source.png` is copied unchanged from the ImageGen output. Its SHA-256 and decoded dimensions are in `manifest.json`.
- The source image has not been cleaned, recolored, or team-swapped. `team-accent-mask.png` is a deterministic derived gray8 mask generated from blue-hue/saturation pixels; frame bounds, pivots, and sequences are derived from source alpha and manifest row metadata.
- `scripts/prepare-unit-sprite-atlas.mjs` regenerates the mask and runtime metadata. The game does not yet consume either.
- The generation prompt and its seven-row request are summarized in `PROMPT.md`; the generated image visibly contains six rows.
