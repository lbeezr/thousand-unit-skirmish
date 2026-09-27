# Art direction and shared conventions

[Documentation index](README.md) · [Asset guide](assets.md)

## Visual target

Create an inviting frontier fantasy from moss meadow, worn earth, muted water,
weathered stone, timber, and slate. Use painterly material variation and broad
value shapes that survive game zoom. Simple geometry can support the silhouette;
fine noise cannot compensate for an unreadable role or building.

Azure and Ember are match identities. Keep the world original and coherent.
The medium can vary: environment cutouts, live unit geometry, or captured building
views must share scale, palette, light, and readable silhouettes.

![Generated direction study](art-direction/frontier-skirmish-direction-study-2026-09-26.png)

This generated illustration is a look-development reference. Its enlarged figures,
approximate marks, and texture density are not runtime scale or appearance evidence.

## Camera, scale, and team identity

| Convention | Rule |
| --- | --- |
| World scale | One world unit per map cell; Y up, +Z forward, grounded origins. |
| Review zoom | Ordinary 0.91 and strategic 0.48; 2.3 is optional close inspection. |
| Review viewport | 1280 × 720 CSS pixels; record DPR and actual output dimensions. |
| Unit scale | About 0.8 world units tall; improve role LOD rather than silently changing world scale. |
| Gameplay footprint | Barracks/Range occupy 3 × 3 cells; Town Centers use the server-owned four-cell-wide base footprint. Visible art bounds are separate. |
| World hues | Azure `#5AA7D7`, Ember `#E67A5E`; brighter UI colors stay in overlays. |
| Authored unit accent | Shared sash; equipment remains neutral. |
| Authored building accent | Small owner-selected standard; architecture and trim remain neutral. |
| Shape identity | Azure straight-cut pennant with centered bar and square marker; Ember forked tail/split mark and diamond marker. |

Worker: pack and broad tool. Infantry: spear and six-sided shield. Archer: bow
and quiver. Town Center: wide hall and rear tower. Barracks: enclosed gable and
gate. Archery Range: open canopy and target. Test these cues at native display size.

## Rules by asset family

- **Ground:** seamless opaque paint, quiet contrast, world-aligned repetition,
  connected brush edges. Terrain material does not set collision.
- **Environment cutouts:** transparent source/runtime pairs, consistent family
  canvas/pivot/world size, no baked team tint, rings, UI, or background.
- **Units:** rigid named parts, shared batch keys, neutral role equipment, and
  renderer-driven states. The textureless GLB v1 contract and painted-atlas
  experiments have different compatibility requirements.
- **Buildings:** preserve anchor and apparent scale across states/views. Selection,
  health, rally, and production cues stay renderer-owned.
- **Animation:** separate movement, task, attack events, damage, spawn, and defeat.
  Consume only fog-filtered state; defeat ends that generation's pose.
- **HUD:** preserve text labels and accessible names with icons. Native cursors
  follow the [current manifest](ui-cursor-icon-contract.md), including hotspots
  and keyword fallbacks.

Water should remain muted blue-green with restrained sand/shore transitions.
Reserve vivid team, interaction, and warning colors for their gameplay meaning.

## Implementation boundaries

The [asset guide](assets.md#know-what-is-actually-in-game) names current loaders
and candidates. Town Centers use captured directional views; Barracks and Ranges
use direct sprites. Their loaders retain procedural fallbacks. Authored unit GLBs
remain candidates; source previews do not prove runtime batching or readability.

Use manifests for exact dimensions and hashes. Follow the
[renderer contract](renderer-state-contract.md) for v1 GLBs/environment states,
[building pipeline](building-asset-production-pipeline.md) for captured models,
and [sprite-atlas contract](sprite-atlas-contract-v1.md) for pages and layers.

## Evidence for an appearance claim

1. Identify the code revision, asset manifest, loaded file hashes, map, team,
   viewport, DPR, zoom, and represented state.
2. Capture actual gameplay at normal and strategic zoom with appropriate visibility.
3. Inspect the pixels for role/team recognition, ground contact, silhouette,
   alpha edges, depth, and state differences.
4. State missing roles, directions, teams, materials, or states explicitly.

The unit-role matrix has eight views: two grounds × two viewing teams × two
zooms, with all three roles visible for both teams. The full environment matrix
has forty image-bearing state/theme/zoom frames plus a clear-ground assertion.
A smaller named pilot can support a smaller change.

A source sample can ship with documented limits. Full M2 visual evidence and M3
2,000-unit measurements support milestone claims; they are not routine approval
queues. Ordinary appearance captures need a working GPU/browser, not a numeric
quiet-host threshold. Performance comparisons need controlled conditions.

## Historical review

The [previous art-direction record](archive/2026-09/art-direction-contract-v1.md)
retains source-review findings, old branch/PR references, and unreviewed candidates.
The [environment pilot](qa-evidence/environment-state-pack-v1/pilot/README.md)
provides later runtime evidence for a four-frame subset. A source-only edge
cleanup or material candidate becomes runtime art only through an explicit
pack/loader update with matching hashes.
