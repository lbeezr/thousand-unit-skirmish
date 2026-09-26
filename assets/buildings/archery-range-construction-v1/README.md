# Archery Range construction sprite pilot

This pack adds a five-step construction sequence as a separate sprite-atlas-v1 runtime candidate. It does not replace the neighboring Archery Range art pack or change the game renderer.

| Order | State | Visible progress |
| --- | --- | --- |
| 1 | `foundation` | Stone footing and prepared floor |
| 2 | `frame` | Open timber skeleton with a clear target, bow rack, and team pennant |
| 3 | `rails` | Practice rails, target, bows, arrow rack, and the same pennant |
| 4 | `canopy` | Partial slate canopy with the training equipment and pennant carried forward |
| 5 | `complete` | Finished range with target, bows, arrows, and team pennant |

Each frame uses a 640 × 640 canvas at 128 pixels per world unit. The projected ground pivot is `(320, 441)`, marked as an unreviewed estimate. `recommendedTileFootprint` is 3 × 3 as an art hint; map/gameplay occupancy remains authoritative. The art bounds allow a 5 × 5 world-unit frame and 4.5 world units of height.

The page has one full `actor` layer and a grayscale team mask. The mask selects only blue pennants in the frame, rails, canopy, and complete states; target rings and arrow fletching retain their source colors. The foundation remains bare. No foreground occlusion split is included: the art needs renderer-owned depth sorting before a fixed foreground overlay can correctly handle units both in front of and behind the pavilion.

`previews/archery-range-identity-playzoom-unlabeled.png` places the frame, rails, and complete sprites on one Meadow game capture at zoom 0.91, with no stage labels. The sprite placements are static visual compositions, not live renderer results. `previews/archery-range-meadow-zoom-091-azure.png` shows the Azure pennant over an Azure capture. `previews/archery-range-meadow-zoom-048-ember-pennant-azure-hud.png` tints only the pennant for Ember; its captured HUD remains Azure. It is not Ember runtime evidence. `previews/archery-range-construction-grid.png` shows all five stages and the 3 × 3 footprint guide.

The first-pass generated images remain in `source/generated/`. Revised frame, rails, and canopy images are kept separately in `source/generated-v2/`; the packer uses those revised sources without overwriting the originals.

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
