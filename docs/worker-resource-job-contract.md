# Shared Worker work intent v1 — economy-owned boundary

Economy/content owns the shared checkpoint union and external cancellation,
plus bounded Wood continuation. Construction owner `01a103f5-cb1f` consumes the
construction variant and owns site targeting, adjacent-Gate priority and natural
reacquisition. Architecture edits no runtime. Live browser control remains with
Mac animation baseline `01a106da-40ec`.

The 12:24 user report reproduces locally at current runtime `278d133d` (harness
head `0ccce3cb`) and identified staging source `64cc391e`: a forest cell or ordinary
Wood node consumes six Wood, deposits six, then clears gather execution while
nearby Wood remains. The isolated prototype continues both paths and conserves
stock/bank/cargo. These are local native 160 × 160 source replays, not live staging
observations. The prototype still uses provisional `gatherWorkArea`; canonical
runtime adoption of the shared field below remains unfinished. No merge or
containing deployed build is asserted.

## Exact durable field

`src/work-intent.mjs` is the single shape/helper authority:

```js
workIntent: null
  | { version: 1, kind: 'gather', generation, resource: 'wood', anchor: { x, z } }
  | { version: 1, kind: 'construction', generation, siteIds: [id, ...],
      area: { minX, maxX, minZ, maxZ } }
```

Generation equals the owning Worker generation; intent has no orderRevision.
Existing gather/target/path/build fields remain execution state. Internal route
repair, cargo delivery, target change and orderRevision increments preserve the
durable intent. Only living matching generations execute it; new/recycled units
start with null. No intent or source stock enters the public unit-row protocol.

Gather anchors the original accepted Wood source. The fixed rule radius is eight
world units, never an editable checkpoint radius. Eligible replacement sources
are live visible reachable Wood nodes or forest cells inside that original circle.
Partial Wood cargo can continue filling; full or incompatible cargo returns to
an eligible owned drop-off. Empty/inaccessible areas return remaining cargo once
and finish without expanding the anchor or repeating failed searches.

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

Shared helpers exported now: createGatherWorkIntent(generation, source),
createConstructionWorkIntent(generation, siteIds, area), clearWorkIntent(unit),
clearGatherWorkIntent(unit), activeWorkIntent(unit), and
validWorkIntent(intent, unit, map, {buildings, nextBuildingId, maxSites}).
The last two bounds come from authoritative state/MAX_BUILDINGS, not client input.

## Checkpoint boundary

The optional v1 unit field is additive to existing schema 29/rules 6. Economy
owns capture cloning, validation, restore/migration and cancellation hooks.
Validate exact version/kind/keys, matching generation, finite bounded anchor/area,
distinct bounded historical IDs, and ownership of any still-existing sites.
Completed/missing historical site IDs below nextBuildingId remain legal so a
normal destruction checkpoint is not rejected; construction prunes them later.
Never resurrect a site, pay again or refund from an intent.

Absent legacy intent initializes from an active Wood target, valid wallBuildOrder
IDs, or the existing owned unfinished non-repair building target. It cannot infer
an older discarded wall job from every nearby unfinished structure. Preserve
existing cargo, target/path state, bank, paid progress and generations.

Nine independent-shape/area tests pass. Remaining work: replace the provisional
runtime field, cover external commands/internal deposit/queued precedence/cold
restore/area exhaustion/paid conservation, update old depletion tests that expect
stopping, independent review and normal merge/postmerge proof. Economy retains
that source outcome. Identified containing delivery and ordinary gameplay are
separate Railway/Mac acceptance; no deployment or browser-control claim.
