# Barracks sprites v1

**Status:** source/runtime image sample; procedural Barracks remain in gameplay.
[Workflow](../../../docs/building-sprite-production-workflow.md) · [Provenance](PROVENANCE.md)

## Coverage

Five states—foundation, frame, complete, damaged, critical—each have Azure/Ember
cloth. The art frame is 5 × 5 world units, 640 × 640 pixels, at 128 pixels/world
unit. Gameplay footprint is 3 × 3 cells. View: 45° azimuth and 46° downward pitch.
All states share scale and ground registration.

| Selector | Frame |
| --- | --- |
| Construction <20% | Foundation |
| Construction 20%–<90% | Frame |
| Construction ≥90% | Complete |
| Completed health ≥66% | Complete |
| Completed health 33%–<66% | Damaged |
| Completed health <33% | Critical |

These are this pack's thresholds, not the procedural renderer's damage thresholds.
See [sprite-grid.json](sprite-grid.json) for exact registration.

## Rebuild

```sh
python3 scripts/prepare-barracks-sprite-test.py
```

Run from the repository root to regenerate team variants and contact sheets.

## Limits

One camera-authored view; no directional rotation, per-pixel depth, or scene
occlusion integration. Image exports are available, but production sprite-atlas
loading and game-zoom appearance remain separate work.
