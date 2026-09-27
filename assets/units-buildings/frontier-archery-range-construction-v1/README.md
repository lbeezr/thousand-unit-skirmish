# Archery Range construction GLB sample

**Status:** source-review package; no gameplay GLB loader adopts it.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Contents

Four corner posts, low rails, rear target rack, sloped canopy, and front target. The 75% stage leaves rafters and half the roof exposed.
One GLB retains stable named parts for five construction stages. Five previews
share camera, footprint, origin, and Meadow background at zoom 0.91.
The editable scene opens with the completed Azure building.

The generator reuses mesh and atlas/UV helpers from the v0.2 sample; their hashes
are recorded in `source/authoring-manifest.json`. This authoring manifest is not
a renderer-v1 runtime manifest and must not be passed to its validator.

## Inspect

Run from this package directory with the optional game-dev CLI:

```sh
game-dev asset inspect models/archery-range-construction-v1.glb --json
game-dev asset validate models/archery-range-construction-v1.glb --request source/game-dev-package-archery-range.json --json
```

`SHA256SUMS.txt` covers package files except itself.

## Limits

Source previews show Azure on Meadow. Ember, Cinder, runtime loading, compatible
manifest conversion, in-game appearance, and authored-GLB performance remain
separate work. Source images establish the sample's construction sequence, not
live gameplay adoption.
