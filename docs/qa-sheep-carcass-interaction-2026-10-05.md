# Sheep carcass interaction — 5 October 2026

Motivation: the user reported that the first Sheep carcass looked like a blob,
could not be selected, and did not explain its remaining Food. Audit of main
`446d5a99374b3aaf06d30948ad9c01cb3f6080e5` confirmed two independent causes:
the renderer intentionally uses a low ellipsoid food-cache marker, and client
selection admitted only owned living Sheep. Positive carcass stock, public
pose and authoritative cold recovery already existed.

## Small default interaction increment

Owner: this carcass-interaction slice, source thread `01a0f784`. Default
left-click/touch picking admits currently disclosed positive-food carcasses of
either former owner or no owner, preserving friendly unit/building priority.
String resource IDs stay outside army selection and control groups. The compact
strip identifies **Sheep carcass**, shows remaining Food (`<1` for a positive
fraction), and supplies **Harvest · idle Worker** and **Select workers**.
Harvest sends one nearest idle owned Worker with empty cargo through existing
Gather and generation binding. Busy/carrying Workers remain untouched; the
manual Worker right-click path continues to accept shared food. No simulation,
checkpoint schema, map, economy tuning, wildlife motion, sprite or art bytes change.

Alive→carcass keeps inspection and cancels armed Herd targeting. Remaining Food
updates from actual snapshots. Depletion removes the selection and renderer
target; fog, omission, epoch/map/seat changes and welcome clear stale selection.
Freshly restored disclosed carcasses can be selected again. Herd/Stop still
require an owned live Sheep.

Art backing: reuse the existing compact labelled command strip and
[approved static Sheep lineage](../assets/wildlife/bellweather-sheep-static-v1/README.md).
The bounded treatment adds text and a standard button, leaving the existing
marker explicit pending actual carcass art. This is no adoption of rejected UI
explorations or new rendered art.

## Focused evidence and limits

- `sheep-carcass-client.test.mjs`: both-seat production input/picking and
  contextual DOM; shared former ownership; food updates/fractional readout;
  numeric generation-bound Worker Gather; busy/cargo exclusion; fog/epoch/
  omission/depletion/welcome cleanup; live→carcass armed-target cancellation.
- Its production-server fixed-tick replay case begins with ordinary Worker
  Gather, saves untouched partial carcasses and cargo, restores the checkpoint,
  proves exact state equality after the same 60 ticks, then drives the actual
  client Harvest buttons through both carcass depletions and restores exhaustion.
  Original 45 Food equals remaining stock + cargo + both banks throughout.
- Existing wildlife client/state, placement, relocated renderer and Herd/Stop
  checks cover neighboring contracts. The input fixture binds the existing
  building fog helper and executes the actual contextual strip; unrelated
  portrait/layout effects remain stubbed and do not prove pixels.
- Existing `wildlife-food-scenario.mjs` uses real HTTP/WS commands and cold
  process restart to prove shared carcass harvesting, food conservation,
  partially harvested/carrying recovery, depleted recovery and rematch.
- Syntax, strict type projects, runtime import boundaries, documentation links,
  whitespace and clean release/packed authenticated HTTP checks are separate
  source/package evidence. Exact checked head, review and release digest belong
  in this slice's PR; no full-suite claim follows from focused checks.

Cloud Chromium capability is **blocked**: normal Linux sandbox and browser
profile/configuration storage failed. Zero game frames/screenshots. No sandbox
bypass or Mac execution. Staging source/digest and actual ordinary Tiny rendered
selection→Harvest→depletion remain incomplete until verified at a containing
served release. Implementation owner retains that acceptance; the existing
Railway delivery/cloud capture owners support their established paths.

## Separate art assessment

The [public producer contract](../assets/wildlife/bellweather-sheep-static-v1/source/capture-contract.json)
identifies the approved textured unrigged original: 44,244,524 bytes, SHA-256
`f26faaa05e40da6c9b2bb629a22cd78297d74a65405956dd332d0039303cb30f`.
Eight approved idle PNGs are present; no resting/dead source frames or Sheep
model bytes are available in this checkout. Supported Library search resolves
the original, but private transfer requires the user's explicit approval.
No model was downloaded, posed, rendered or published in this increment.

A rigid side rotation may supply a recognizable first resting silhouette
without a rig, but this is a proposal, not verified anatomy or rendered art.
Needed input: permission for a supported private cloud copy of that exact GLB
and its preserved capture scene/contract, or approved eight-heading carcass PNGs
with matching manifest/registration. Keep fleece/head/legs and painterly texture,
uniform scale, +Y up/body heading (turned nose differs by ~42°), existing fixed
oblique camera, 512×512 canvas, root [256,256], 256 px/world unit and neutral
team treatment. Ground-contact/pivot and game-scale silhouette require actual
renders; never flatten/mirror standing sprites to claim a carcass pass.

Canonical art owner remains Sheep task `01a101a8-fba6-7323-a40c-27efd0112007`
in the [adoption ledger](asset-adoption-checklist.md), with
[private walk/inspection lineage](sheep-local-walk-candidate.md). This slice
does not duplicate its rig/motion/export work. Any later private trial must
stay in supported Library with confirmed preview IDs. Zero paid provider calls,
generation credits, rejected-art adoption or private public publication.
