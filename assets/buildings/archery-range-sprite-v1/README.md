# Archery Range sprites v1

**Status:** default gameplay artwork, with procedural loading/error fallback.
[Workflow](../../../docs/building-sprite-production-workflow.md) · [Provenance](PROVENANCE.md)

## Coverage and registration

Foundation, frame, complete, damaged, and critical each have Azure/Ember variants.
The 5 × 5 world-unit art frame is 640 × 640 pixels at 128 pixels/world unit.
Gameplay occupancy remains 3 × 3. One 45° azimuth is authored.

[sprite-grid.json](sprite-grid.json) owns the construction/health thresholds.
[sprite-atlas-pack-v1.json](sprite-atlas-pack-v1.json) records full-canvas frame
rectangles, alpha bounds, clips, team variants, draw/sort bounds, and the
unreviewed projected ground pivot. It retains original 1254 × 1254 source hashes
and aligned lossless 640 × 640 source pages.

## Rebuild and inspect

From the repository root:

```sh
python3 scripts/prepare-building-sprite-pack.py --asset archery-range
node scripts/validate-sprite-atlas.mjs assets/buildings/archery-range-sprite-v1/sprite-atlas-pack-v1.json
node scripts/preview-sprite-atlas.mjs assets/buildings/archery-range-sprite-v1/sprite-atlas-pack-v1.json --runtime --out assets/buildings/archery-range-sprite-v1/preview/archery-range-sprite-v1-atlas-preview.html
```

`source/` keeps transparent masters, `runtime/` normalized WebPs, and `preview/`
state strips with a footprint guide. Ember shifts saturated Azure cloth while
retaining neutral surfaces.

## Limits

The game loads individual WebPs through `src/building-sprites.mjs`; it does not
consume the generic atlas manifest. Construction uses 20%/90% transitions and
completed health uses 66%/33%. Depth testing and ground depth correction preserve
scene occlusion. Camera rotation, other views, season/light variants, and authored
per-pixel depth are absent. Docker includes the frames; a pack preview alone
does not establish game-zoom appearance.
