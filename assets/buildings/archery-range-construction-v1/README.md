# Archery Range construction sprites

**Status:** sprite-atlas candidate; gameplay does not load this pack.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Coverage

| State | Visible construction |
| --- | --- |
| `foundation` | Footing and prepared floor. |
| `frame` | Open skeleton, target, bow rack, and pennant. |
| `rails` | Practice rails, bows, arrows, target, and pennant. |
| `canopy` | Partial slate roof over the training equipment. |
| `complete` | Finished range. |

One fixed view uses a 640 × 640 canvas at 128 pixels/world unit. Pivot `(320,441)`
is an unreviewed estimate. Art occupies a 5 × 5 frame and up to 4.5 world units
of height; the 3 × 3 footprint is a recommendation, while gameplay owns occupancy.

The actor layer has a grayscale team mask for pennants in all but Foundation.
Target rings and arrow fletching keep their source colors. There is no foreground
split; open-bay occlusion requires renderer depth handling.

## Files and commands

`source/generated/` retains originals; `source/generated-v2/` holds the revised
frame/rails/canopy sources used by the packer. The manifest, atlas/mask, checksums,
and labeled previews are generated with:

```sh
python3 scripts/pack-archery-range-construction-v1.py
node scripts/validate-sprite-atlas.mjs assets/buildings/archery-range-construction-v1/sprite-atlas-pack-v1.json
```

Run from the repository root. Exact prompts remain in [source/prompts.md](source/prompts.md).

## Review limits

The unlabeled Meadow placement sheet is a static composition over a game capture.
The Ember-pennant composition retains an Azure HUD; it is not Ember runtime evidence.
The grid sheet compares all five states and the suggested footprint.

Pivot/world bounds need an in-game placement review. Animation, other directions,
live state selection, and unit occlusion are not demonstrated by these previews.
