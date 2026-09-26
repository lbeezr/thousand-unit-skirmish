# Archery Range construction sprite pilot

This pack adds a five-step construction sequence as a separate sprite-atlas-v1 runtime candidate. It does not replace the neighboring Archery Range art pack or change the game renderer.

| Order | State | Visible progress |
| --- | --- | --- |
| 1 | `foundation` | Stone footing and prepared floor |
| 2 | `frame` | Corner posts and exposed timber frame |
| 3 | `rails` | Training rails and equipment structure |
| 4 | `canopy` | Partial slate canopy over the open bay |
| 5 | `complete` | Finished range with target, bows, arrows, and team pennant |

Each frame uses a 640 × 640 canvas at 128 pixels per world unit. The projected ground pivot is `(320, 441)`, marked as an unreviewed estimate. `recommendedTileFootprint` is 3 × 3 as an art hint; map/gameplay occupancy remains authoritative. The art bounds allow a 5 × 5 world-unit frame and 4.5 world units of height.

The page has one full `actor` layer and a grayscale team mask. The mask selects only the blue cloth pennant in the completed state; target rings and arrow fletching retain their source colors. Construction frames have no pennant yet. No foreground occlusion split is included: the art needs renderer-owned depth sorting before a fixed foreground overlay can correctly handle units both in front of and behind the pavilion.

`previews/archery-range-meadow-zoom-091-azure.png` and `previews/archery-range-meadow-zoom-048-ember.png` composite the sprite over actual Meadow game captures at the named zooms. The sprite placement is a static visual composition, not a live renderer result. `previews/archery-range-construction-grid.png` shows the full stage sequence and 3 × 3 footprint guide.

Regenerate the atlas, mask, previews, manifest, and checksums with:

```sh
python3 scripts/pack-archery-range-construction-v1.py
```

## Current limits

- This pack is not wired into gameplay yet.
- It contains one fixed elevated three-quarter view and static stages only.
- Pivots and world bounds are estimates pending an in-game placement review.
- Unit occlusion through the open bay remains renderer work.
- The map's existing 3 × 3 footprint remains the only source of occupancy.
