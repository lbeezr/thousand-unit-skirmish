# Barracks construction sample v1.0.0

This building-only checkpoint revises the Barracks silhouette and construction sequence. It contains one GLB with the raised foundation, open timber frame, wall shell, unfinished rafters with one covered slope, and completed slate roof, gate, and team standards. Five separate preview images use the same camera, footprint, origin, and Meadow backdrop at zoom 0.91.

**Scope:** source-review only. `source/authoring-manifest.json` is an authoring record outside runtime `manifest.json` discovery. This pack is not runtime-ready and must not be loaded by the game. The renderer still draws procedural buildings; a GLB loader, runtime manifest conversion, in-game appearance, and an authored-GLB 2,000-unit measurement remain separate work.

The completed roof and pale framed gate are broad silhouette cues. The 75% state retains exposed rafters and leaves one slope open so it differs from completion. The source frames show Azure on Meadow only; Ember and Cinder review remain open.

The source scene opens with the completed Azure Barracks. The generator imports the stable base mesh and atlas UV helpers from the merged v0.2 sample, whose hashes are recorded in `source/authoring-manifest.json`.

Useful read-only commands:

```sh
game-dev asset inspect models/barracks-construction-v1.glb --json
game-dev asset validate models/barracks-construction-v1.glb --request source/game-dev-package-barracks.json --json
```

`SHA256SUMS.txt` covers every package file except itself.
