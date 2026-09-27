# Unit and building art kit

[Documentation index](README.md) · [Art direction](art-direction-contract-v1.md) · [Renderer contract](renderer-state-contract.md)

## Silhouettes

| Role | Shape | Neutral material cue |
| --- | --- | --- |
| Worker | Compact body, pack, broad tool | Ochre leather and worn timber. |
| Infantry | Upright spear, six-sided shield | Steel-grey cap and dark shaft. |
| Archer | Narrow profile, bow, quiver | Moss hood and weathered wood. |
| Town Center | Wide hall and taller rear tower | Pale stone and charcoal slate. |
| Barracks | Enclosed pitched roof and gate | Dark timber and slate. |
| Archery Range | Open posts, sloped canopy, target | Timber, slate, and training equipment. |

Authored unit role gear stays neutral; the named sash takes team tint. Authored
buildings carry team identity on their small owner-selected standard. Azure and
Ember use shape as well as hue. See the shared art conventions for exact colors.

## State cues

The renderer derives movement from position and task from filtered snapshots.
Movement suppresses work swings; known cargo can distinguish wood/food work.
Fresh attack ticks trigger an attack overlay, while HP loss triggers hit/defeat.
Spawn and generation changes reset transient animation.

Production is hidden when idle, active while a nonblocked queue runs, and muted/
static when blocked. `productionCue` is an anchor, not baked queue geometry.
Resource stages and construction-ground states follow the
[renderer contract](renderer-state-contract.md).

At strategic zoom, neutral role glyphs and square/diamond team markers replace
full detail. Keep batch counts bounded and avoid per-unit scene objects/text.

## Current packages

- [Rigid character/Barracks sample](../assets/units-buildings/frontier-glb-sample-v2/README.md):
  authoring package with GLBs, atlas, sources, pose samples, and limits.
- [Barracks construction](../assets/units-buildings/frontier-barracks-construction-v1/README.md)
  and [Range construction](../assets/units-buildings/frontier-archery-range-construction-v1/README.md):
  independent source samples.
- [Town Center lifecycle captures](../assets/buildings/town-center-lifecycle-meshy-v1/README.md):
  integrated captured views; only Complete appears for current landmarks.

Authored GLB samples are not loaded by the game at this documentation baseline.
The [format review](unit-building-art-output-proposal.md) explains compatibility
and finish work without overriding the current runtime contracts.

## Appearance evidence

Review all three roles, both teams, building lifecycle/production cues, and
resource stages at zoom 0.91 and 0.48 on Meadow and Cinder. Source contact sheets
support source review; loaded game frames support M2. Measure the integrated
2,000-unit renderer for M3. Close zoom 2.3 is useful for craft but cannot replace
ordinary or strategic views.
