# Shared Worker work intent v1 — economy-owned boundary

Economy/content owns the shared checkpoint union and external cancellation,
plus bounded Wood, Stone and plain neutral land Food continuation. The construction implementation owner consumes the
construction variant and owns site targeting, adjacent-Gate priority and natural
reacquisition. Architecture edits no runtime. Ordinary deployed gameplay belongs
to the cloud testing owner. Staged release delivery and actual rendered gameplay
acceptance remain separately identified cloud outcomes; source/native checks
alone do not establish either.

The 12:24 user report reproduces locally at current runtime `278d133d` (harness
head `0ccce3cb`) and identified staging source `64cc391e`: a forest cell or ordinary
Wood node consumes six Wood, deposits six, then clears gather execution while
nearby Wood remains. The isolated prototype continues both paths and conserves
stock/bank/cargo. These are local native 160 × 160 source replays, not live staging
observations. PR #283 adopts the canonical `workIntent` below for runtime capture,
validation, restore, external cancellation and Wood continuation. Construction
reacquisition remains with its named owner; the shared field alone does not fix it.
Source merge and a containing deployed build are recorded separately in QA evidence.

Wood source merge is `8200ec6c`; Stone source merge is `839f0737`. The release
delivery owner records staging deployment `6fcca7ce-cc91-4009-bec1-59648d979d94`
SUCCESS at 15:04:53 UTC on 4 October, source `839f0737`, containing both. Earlier
staging `53a47ee` lacked Wood; `c487990a` source `1acaf9a4` contained Wood only.
This confirms platform delivery only. Served-byte identification and rendered
ordinary gameplay remain open for both extensions.
The [economy/content queue](economy-content-workstream.md) retains these outcomes
with the release delivery and cloud testing owners.

## Exact durable field

`src/work-intent.mjs` is the single shape/helper authority:

```js
workIntent: null
  | { version: 1, kind: 'gather', generation, resource: 'wood' | 'stone', anchor: { x, z } }
  | { version: 1, kind: 'gather', generation, resource: 'wood',
      sourceKind: 'forest-group', anchor: { x, z } }
  | { version: 1, kind: 'gather', generation, resource: 'food',
      sourceKind: 'neutral-land-food', anchor: { x, z } }
  | { version: 1, kind: 'construction', generation, siteIds: [id, ...],
      area: { minX, maxX, minZ, maxZ } }
```

Generation equals the owning Worker generation; intent has no orderRevision.
Existing gather/target/path/build fields remain execution state. Internal route
repair, cargo delivery, target change and orderRevision increments preserve the
durable intent. Only living matching generations execute it; new/recycled units
start with null. No intent or source stock enters the public unit-row protocol.

Ordinary-node and legacy Gather anchors the original accepted Wood, Stone or plain neutral land Food source. Stone requires the
explicit `stone-defense-v1` map profile; a baseline Stone intent is rejected.
The fixed rule radius is eight
world units, never an editable checkpoint radius. Eligible replacement sources
are live visible reachable nodes of the exact intended resource inside that
original circle; only Wood also scans forest cells. Partial compatible cargo can continue filling; full or incompatible cargo returns to
an eligible owned drop-off. Empty/inaccessible areas return remaining cargo once
and finish without expanding the anchor or repeating failed searches.
Food requires the exact durable `sourceKind: 'neutral-land-food'`. Its source
must be an ordinary neutral Food node without Farm adapter/team, wildlife or
resource-variant metadata. `isPlainNeutralFoodSource` is the single classifier;
candidate filtering and checkpoint source consistency use it. Neither Food
cargo nor a temporary target determines the durable class. Farms, all wildlife
states and land/Skiff fishing retain source-only jobs; a manual assignment to
any of them clears the area intent. Stone cannot take Food, Wood or another
ore; Food never scans forests or takes Wood/Stone. A newly accepted manual
plain-Food assignment creates its own class and original anchor.
The [adopted Food decision](food-source-continuation-proposal.md) and
[Food continuation QA](qa-plain-food-job-continuation-2026-10-04.md) retain the
bounded implementation and its separate delivery/acceptance status.

New forest clicks instead carry `sourceKind: 'forest-group'`: the original exact
cell-center anchors its immutable authored four-neighbor group, including after
clearing. A deep public anchor identifies the forest; only current-visible live
trees with reachable access/routes can become execution targets. Nearest distance
plus a soft two-unit penalty per friendly target reservation spreads selected
Workers without exclusive locks. Separate groves and ordinary nodes are excluded.
All pending cuts refresh navigation/LOS before retargeting. After deposit, return
to the remembered worksite before inspecting successors; hidden stocks never
choose destinations or exhaustion feedback. If no reachable visible trees remain,
return cargo once with a source-free execution, finish and report that precise
condition. The unchanged range1.5 is checked against actual positions; a finished
flow goal outside range receives its legal cell-center final approach.
The existing tagged version1/schema29 union admits this source class and validates
its anchor/generation/target membership atomically. Legacy jobs retain radius8.
[Forest diagnosis and acceptance](qa-forest-group-jobs-2026-10-04.md) distinguish
source/native proof from containing-build rendered acceptance. Terrain presentation
owns tree registration; resource movement owns flat-flow route construction.

Farm and land drop-off route selection consume the transient
[`economy-perimeter-access`](../src/economy-perimeter-access.mjs) helper. One
synchronous operation lazily indexes at most 2,000 live unit slots, using every
registered land body's actual radius on both teams. It prefers body-clear
unclaimed endpoints; prospective Return Cargo clones register preferences before
subsequent selection and rebind them on live acceptance. Claims grant no motion
authority and never enter checkpoints. Per scope: at most 256 perimeter checks,
32 cells per candidate and 64 combined body/claim visits per check. Incomplete
or exhausted queries defer the preference and preserve existing static admission;
all physical guards remain authoritative. The existing fixed Farm/drop-off flow
key is invalidated when its exact goal membership changes; the eight-field cache
cap remains unchanged. Arrival, harvest/deposit rates, typed cargo and source or
recipient ownership still use the existing actual-position checks. An endpoint
occupied after selection retains the strict crowd wait: persistent-wait recovery
is the separate next economy slice, rather than a saved flag in this contract.

Construction remembers only explicitly assigned paid owned site IDs, in priority
order. Area is the initial sites' footprint bounding rectangle plus two world
units, clipped to map bounds, and remains fixed. An explicitly assigned adjoining
Palisade Gate inside that area can be prepended as temporary priority while
remembered walls remain; unrelated/outside construction replaces the old intent.
Do not scan for or take unrelated unfinished buildings. Completed/destroyed IDs
can be pruned on reacquisition; a blocked remembered site preserves intent for
bounded construction-specific retry. Gates are legal construction-intent sites.
Legacy wallBuildOrder stays transient execution/compatibility, not durable intent.

## Clear/preserve ownership

- Economy owns accepted external Move/AttackMove, Stop/Hold, Attack,
  Patrol/Follow, Gather, Return Cargo and repair cancellation, per actually accepted
  living owned unit. Rejected/full-queue/foreign/stale-generation orders preserve
  the current intent. Accepted queued movement cancels work intent too, preserving
  the existing queue-versus-active-work behavior.
- Construction owns accepted Build/Resume/Wall/Gate installation: replace the
  old intent, or perform the explicit adjoining-Gate priority extension above.
  Install the resulting intent before starting its internal builder route.
- `clearWorkIntent(unit)` is for accepted external replacement only.
  `clearGatherWorkIntent(unit)` clears only kind gather and preserves construction.
  Generic cancelGatherOrder must clear execution only. An internal
  assignFormationMove with a buildingTargetId preserves intent; explicit repair
  still cancels it. Construction resumes must use this internal route path.
- Natural completion removes completed remembered sites; all done clears the
  construction intent. Resource-area completion clears only gather intent.
  No automatic return to an unrelated previous job is introduced.

Shared helpers exported now: createGatherWorkIntent(generation, source, resource = 'wood'),
createConstructionWorkIntent(generation, siteIds, area), clearWorkIntent(unit),
clearGatherWorkIntent(unit), activeWorkIntent(unit), and
validWorkIntent(intent, unit, map, {buildings, nextBuildingId, maxSites}).
Food construction rejects sources outside `isPlainNeutralFoodSource`; the
classifier and `PLAIN_FOOD_SOURCE_KIND` are exported with the shared helpers.
The last two bounds come from authoritative state/MAX_BUILDINGS, not client input.

## Checkpoint boundary

Worker resource travel consumes shared flow fields, then reduces only a clear,
uniform-level leg from the Worker's actual fractional position to the original
path's final cell. The actual endpoint may differ from the field's first goal
for Farm, forest or drop-off access. Compare drop-off candidates using original
flow path lengths before reducing the winning leg. Obstructed/nonflat routes,
interaction radii, targets, work intent and cargo retain their existing rules.
`pathFromAttackFlow` stays cardinal for other consumers, including Sheep Herd.
The [Worker route QA](qa-worker-flat-flow-routes-2026-10-04.md) owns this bounded
correction; forest target/job selection and universal movement are separate
owner-led slices.

The optional v1 unit field is additive to existing schema 29/rules 6. Economy
owns capture cloning, validation, restore/migration and cancellation hooks.
Validate exact version/kind/keys, matching generation, finite bounded anchor/area,
distinct bounded historical IDs, and ownership of any still-existing sites.
An explicit gather intent must match its referenced finite node/Farm resource;
Food additionally requires a plain neutral node, rejecting Farm/wildlife/fish
targets even though they carry Food. A forest execution target requires Wood.
Null/missing legacy and source-free
records remain admissible. Carried cargo may differ during a legitimate manual
handoff and is not compared against intent type.
Completed/missing historical site IDs below nextBuildingId remain legal so a
normal destruction checkpoint is not rejected; construction prunes them later.
Never resurrect a site, pay again or refund from an intent.

Absent legacy intent initializes from the existing active Wood or Stone target, valid wallBuildOrder
IDs, or the existing owned unfinished non-repair building target. It cannot infer
an older discarded wall job from every nearby unfinished structure. Preserve
existing cargo, target/path state, bank, paid progress and generations.
Active legacy Stone uses its current finite node as the anchor; no discarded
older area is inferred. Legacy Food/Farm/wildlife/fishing does not acquire an area.
Food area intent is installed only by a newly accepted plain-node assignment;
legacy missing/null Food intent remains source-only after each economy tick.

The independent-shape/area tests and full-authority resource-job replays cover
external commands, internal deposit, queued precedence, cold restore, area
exhaustion and paid conservation. Native scenarios also restart an actual server
process against its untouched checkpoint. Older geometry/depot proofs explicitly
control individual cuts and account for incidental partial continuation instead
of assuming natural depletion cancels a job. Dated exact-source results belong in
QA evidence. Economy retains the source outcome through review/merge/postmerge.
Identified containing staged delivery remains with the release delivery owner;
actual rendered ordinary gameplay remains with the cloud testing owner. Both
remain open until their identified evidence is recorded; no deployment or
browser-control claim is inferred from source checks or merge.


### Manual Farm renewal continuation — 5 October 2026

[Farm owner and active queue](farm-finite-planting.md#manual-renewal-ownership-and-active-queue--5-october-2026)
adds optional `resumeFarmHarvest: true` only to a generation-bound construction
intent with exactly one Farm site. It resumes normal Gather on that exact fresh
paid identity after safe construction completion. Busy unrelated work is
ineligible; cargo is preserved. Stop/Move/Return and a new assignment supersede
it; destroyed/cancelled site IDs cannot transfer to later buildings. Generic
construction sequencing, neutral-food/forest intent and crowd/access policy
remain unchanged. Current saves without the optional field remain valid.
