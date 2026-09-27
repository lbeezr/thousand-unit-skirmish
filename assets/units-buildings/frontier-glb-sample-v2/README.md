# Frontier character and Barracks GLB sample

**Status:** v0.2 source-review package; the game does not load these GLBs.
[Asset guide](../../../docs/assets.md) · [Provenance](PROVENANCE.md)

## Contents

| File | Content |
| --- | --- |
| `models/unit-art-v2.glb` | Shared humanoid core/sash and Worker pack/tool, Infantry shield/spear, Archer bow/quiver. |
| `models/barracks.glb` | Foundation, frame, walls, roof, complete parts and owner-specific standards. |
| `source/frontier-material-atlas.png` | 768 × 512 material atlas; each GLB embeds a separate copy. |
| `source/frontier-character-pack-v2.blend` | Editable scene, opening on Worker and complete Azure Barracks. |
| `source/pose-samples.json` | Sampled rigid-part transforms. |
| `source/authoring-manifest.json` | Bounds, anchors, keys, variants, materials/UVs, states, review coverage, provenance, hashes. |
| `source/game-dev-package-*.json` | Requests for later canonical packaging/validation. |

The earlier v0.1.2 package is superseded; its builder remains for provenance.
Town Center and Archery Range are not included.

## Intended runtime mapping

Eight unit bins per team: humanoid head/torso to `bodyMeshes`, sash to
`teamAccentMeshes` replacing the old head-sphere slot, and six role-gear bins.
The sash inherits core pose/local transform; independent head-sphere bob is dropped.
Role equipment remains neutral.

Barracks has ten part groups including mutually exclusive Azure/Ember standards,
so at most nine are active. Stages share one ground pivot. `productionCue` is an
anchor only. Architecture stays neutral; the standard supplies team identity.

Both GLBs embed the same atlas independently: estimated 4 MiB resident with full
mips and no sharing. The authoring manifest is incompatible with renderer-v1's
textureless runtime schema. Do not use `validate-visual-pack.mjs` on it or load
these files without a compatible manifest/shared-texture integration.

## Inspect

From this package directory with game-dev installed:

```sh
game-dev asset inspect models/unit-art-v2.glb --json
game-dev asset inspect models/barracks.glb --json
```

`SHA256SUMS.txt` covers package files except itself. Canonical packaging is a
separate write from read-only inspection.

## Review limits

Six source frames show one Azure Worker and five Barracks states on Meadow at
zoom 0.91. The roof/complete states are too similar at about 50 px building width.
A cyan production-cue stand-in in the complete preview is absent from the GLBs
and is not proof that the team standard reads.

The Worker is about 12 px tall at 0.91; pack/tool readability remains unresolved.
Infantry, Archer, Ember, Cinder, strategic view, other poses, and runtime loading
are outside that source review. The atlas passes the project's 512 px policy
but receives generic guidance warnings for non-power-of-two size and a short
edge below 1024 px. Inspect actual game views before accepting finish or performance.
