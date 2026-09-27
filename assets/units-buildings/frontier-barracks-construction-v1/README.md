# Barracks construction GLB sample

**Status:** source-review package; no gameplay GLB loader adopts it.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Contents

Raised foundation, open frame, wall shell, exposed rafters with one covered slope, then a completed slate roof and broad framed gate.
One GLB retains stable named parts for five construction stages. Five previews
share camera, footprint, origin, and Meadow background at zoom 0.91.
The editable scene opens with the completed Azure building.

The generator reuses mesh and atlas/UV helpers from the v0.2 sample; their hashes
are recorded in `source/authoring-manifest.json`. This authoring manifest is not
a renderer-v1 runtime manifest and must not be passed to its validator.

## Inspect

Run from this package directory with the optional game-dev CLI:

```sh
game-dev asset inspect models/barracks-construction-v1.glb --json
game-dev asset validate models/barracks-construction-v1.glb --request source/game-dev-package-barracks.json --json
```

`SHA256SUMS.txt` covers package files except itself.

## Limits

Source previews show Azure on Meadow. Ember, Cinder, runtime loading, compatible
manifest conversion, in-game appearance, and authored-GLB performance remain
separate work. Source images establish the sample's construction sequence, not
live gameplay adoption.
