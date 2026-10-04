# Frontier Mill identity brief

[Building atlas plan](building-atlas-production-plan.md) · [Frontier style](frontier-civilization-art-style.md)

Mill is implemented as a **food-only drop-off**, not a food generator or a Farm.
Workers carry existing food to it. It produces no units or population and grants
no gathering bonus. The current `building.mill` presentation explicitly reuses
the procedural House; this brief requests a distinct useful art slice using
existing owned sources or procedural authoring. It does not authorize a new paid
model or provider call.

**4 October source update:** the user's later request explicitly authorizes
missing Frontier models to be sent to Meshy. The [economy source slice](art-direction/frontier-economy-meshy-v1/README.md)
records the selected isolated Mill reference, producing task and source-delivery
limits. That bounded authorization supersedes the earlier no-paid-job scope
for this Mill model; it does not change its gameplay or capture contract.

## Identity and placement contract

- Registry ID `mill`, presentation ID `building.mill`, square **3 × 3** occupancy.
  Ordinary legal land placement applies; there is no water, shore or river requirement.
- Distinguish it from House's domestic cottage and Storehouse's general loading
  shed. A compact timber grain mill with a visible stationary wind wheel, grain
  sacks and a food-handling entrance is a suitable first silhouette. A watermill
  would imply a placement rule that the current game does not have.
- Preserve the existing footprint, ground pivot and construction/repair access.
  Visible buildings use the atlas plan's common world scale; overhangs cannot
  conceal neighboring occupancy or make a Worker entrance appear unreachable.
- Ownership cues must remain visible for Azure and Ember at ordinary and strategic
  zoom. Food cues must survive the same views without relying on text labels.
- Current provisional gameplay values are 75 wood, 15 Worker-seconds and 1,000 HP.
  Art dimensions, machinery and texture states must not change those rules.

## Small initial delivery

Start with one editable Complete source and the established eight-view capture
contract, matching the current Frontier camera, density, grounding and lighting.
Record source provenance and rights. Reuse the building asset pipeline's manifests,
measured alpha bounds, pivots and frame hashes rather than inventing a second
pack format. Compare the result beside the current Worker, House and Storehouse.

Construction, damage and team masks can follow through the existing lifecycle
contract; publish useful source/capture work with its limits stated. Static sails
are sufficient for this first slice. Rotation, milling sound or mechanical
animation would need a separate supported layer/clip and are not implied here.
Do not show planted fields as an interactive Farm or invent persistent ruins.

Renderer adoption is a separate concrete step: add the actual Mill pack binding,
check food identity, both teams, fallback, construction/damage/repair, adjacent
placement, fog and both zoom ranges. A source model or this brief does not claim
that authored Mill artwork is already in the game.
