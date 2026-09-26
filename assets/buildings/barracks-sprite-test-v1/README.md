# Barracks sprite pack v1

This is the first complete building-sprite sample for Thousand Unit Skirmish. It contains foundation, frame, complete, damaged, and critical art, each with Azure and Ember team cloth. The same fixed scale and anchor are used across its 5 × 5 world-unit art frame; the gameplay footprint remains 3 × 3 cells.

The 640 × 640 WebP runtime frames use 128 source pixels per world unit. Construction progress selects foundation below 20%, frame from 20% to below 90%, and complete from 90%. Completed health selects complete at 66% or more, damaged from 33% to below 66%, and critical below 33%.

The pack contains one view at 45-degree azimuth and 46-degree downward pitch. It is ready as sprite source and runtime imagery, but the production renderer still needs sprite-atlas integration, world depth/occlusion handling, and a directional view set before camera rotation is supported. The surrounding terrain and gameplay coordinates remain world-space concerns.

Regenerate the two team variants and contact sheets with:

```sh
python3 scripts/prepare-barracks-sprite-test.py
```

See [`sprite-grid.json`](sprite-grid.json) for dimensions and view limits, and [`PROVENANCE.md`](PROVENANCE.md) for generation prompts and hashes.

See the [building sprite production workflow](../../../docs/building-sprite-production-workflow.md) for the reusable complete-first design, lifecycle derivation, grid, review, and packaging method.
