# Archery Range construction sample v1.0.0

This building-only checkpoint defines an open practice bay with four corner posts, low side rails, a rear target rack, one sloped canopy, a front bullseye, and the shared Azure/Ember standard language. One GLB retains stable named parts for all five construction stages. Five separate preview images use the same camera, footprint, origin, and Meadow backdrop at zoom 0.91.

**Scope:** source-review only. `source/authoring-manifest.json` is an authoring record outside runtime `manifest.json` discovery. This pack is not runtime-ready and must not be loaded by the game. The renderer still draws procedural buildings; a GLB loader, runtime manifest conversion, in-game appearance, and an authored-GLB 2,000-unit measurement remain separate work.

The open front and single-slope roof are the main silhouette cues. The 75% state keeps exposed rafters and half of the roof uncovered so it differs from completion. The source frames show Azure on Meadow only; Ember and Cinder review remain open.

The source scene opens with the completed Azure Archery Range. The generator imports the stable mesh and atlas UV helpers from the merged v0.2 source pack, whose hashes are recorded in `source/authoring-manifest.json`.

Useful read-only commands:

```sh
game-dev asset inspect models/archery-range-construction-v1.glb --json
game-dev asset validate models/archery-range-construction-v1.glb --request source/game-dev-package-archery-range.json --json
```

`SHA256SUMS.txt` covers every package file except itself.
