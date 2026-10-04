# Food source continuation proposal — 4 October 2026

**First-slice decision adopted.** The authorized implementation covers only
**plain neutral land Food** assigned to selected
land Workers. Paid Farms, live/carcass wildlife, shore fishing and Skiffs keep
their current source-only jobs. This reduces ordinary Food depletion clicks
without choosing a paid plot, dispatching another Sheep or changing water work.
Economy/content owns the implementation and its source/release checks. The
[published Worker intent](worker-resource-job-contract.md) now adds a Food-only
`sourceKind: 'neutral-land-food'` while retaining existing Wood/Stone and
construction record shapes. [Implementation/QA](qa-plain-food-job-continuation-2026-10-04.md)
tracks source checks separately from staged delivery and actual cloud gameplay.
The following inventory preserves the inspected pre-extension source.

## Existing source inventory

Inspected runtime and authored maps at main `908d80f6`, after merged
[Stone PR305](https://github.com/lbeezr/thousand-unit-skirmish/pull/305).
All rows below carry the same `food` currency; that alone cannot identify a job.

| Source / actor | Current identity and authority | Current interaction, delivery and exhaustion |
| --- | --- | --- |
| Plain neutral land Food / land Worker | Authored `type: 'food'` with neither `wildlifeSpecies` nor `resourceVariant`; no Farm adapter. There is no registered berry subtype. Neutral nodes have no harvest owner. Accepted commands select living owned reachable gather-capable units. | Ordinary point access; repeatedly harvests the selected finite node and delivers typed cargo. Depletion returns the final load and stops. The server's manual `assignGather` has no explicit visibility check for this plain subtype; automatic successors must require current visibility under the proposal below. |
| Farm / land Worker | `farm:<buildingId>` is an adapter over the building's sole `harvestStock`; only a live completed owned Farm can be gathered. Its 200-Food planting is paid with 60 Wood and construction work. | Routes to the Farm footprint perimeter and repeats on that plot only. Exhausted Farm persists until explicit Clear; no refund, refill or automatic paid replant. Destruction loses remaining crop, preserves carried Food and returns it through the existing owned drop-off route. Repair never refills. [Farm contract](farm-finite-planting.md). |
| Sheep, alive or carcass / land Worker | `wildlifeSpecies: 'bellweather-sheep'`, lifecycle and separate `wildlifeTeam` claim label. Gather requires current visibility, but **does not require ownership of the claim**. Herd/Stop require an owned visible live Sheep. | Accepted Gather cancels Herd; reaching interaction range changes alive → carcass without creating cargo or a second stock pool, and freezes movement. Harvest debits finite Food; stock zero becomes depleted. No automatic next Sheep/carcass. [State/claim authority](../src/wildlife-state.mjs) and [Herd authority](../src/wildlife-herding.mjs). |
| Shore fish / land Worker | `type: 'food', resourceVariant: 'shore-fish'`, no wildlife metadata. Authored point is dry level-zero bank access adjacent to authored water; Gather requires current visibility. | Land routing and ordinary Food drop-offs. Finite node repeats until depletion, then final delivery and stop; no next fishing site or water entry. [Shore contract](shore-fishing-foundation.md). |
| Same shore fish / Skiff | Same finite stock, reached from a derived water approach. Selected owned Skiffs require distinct reachable approaches and completed owned Dock berths; queued Gather is rejected. | Water routing and Dock delivery only. Repeats on that fish site until depletion. Accepted Shift Move bounds fishing to one current load/delivery, then starts the queued route; partial depletion delivers first. Missing Dock access retains cargo/queued intent under existing retries. No automatic next school. [Fishing](skiff-fishing.md) / [queued Move](skiff-fishing-next-move.md). |

Land Food drop-offs are completed owned Town Centers, Storehouses and Mills;
Farm is a source, not a drop-off. A Mill accepts Food only; a Dock's fishing
delivery belongs to the water actor. Current Worker/Skiff capacity is ten and
gather rate one per second. No proposed change retunes those values.

The difference occurs in shipped content, not just synthetic fixtures:

| Authored map at inspected source | Plain Food nodes / stock | Sheep nodes / stock | Shore-fish nodes / stock |
| --- | --- | --- | --- |
| Frontier Reach (`frontier-160`, 160 × 160) | 32 / 9,600 | 0 / 0 | 0 / 0 |
| Terraced Vale (`veyrholds-terraced-vale`, 160 × 160) | 2 / 2,800 | 4 / 3,300 | 0 / 0 |
| Shore Fishing laboratory (`shore-fishing`, 40 × 32) | 0 / 0 | 0 / 0 | 2 / 120 |

These are authored starting counts, excluding dynamically paid Farms; they do
not measure travel, balance, served bytes or rendered gameplay. Frontier remains
the implemented civilization. Human/Boughward artwork supplies no additional
asymmetric gameplay rules.

## Recommended rules for the first implementation

1. **Explicit assignment only.** An accepted manual Gather on plain neutral land
   Food installs a source-class-bound job only on the supplied living owned land
   Workers that pass current command admission. Unselected Workers never join;
   no opponent policy, claim assignment or stock reservation is added. Manual
   Gather on Farm/Sheep/fish retains its existing source-only job.
2. **Fixed area and class.** Remember the original assignment position and Worker
   generation. Reuse the existing eight-world-unit circle without tuning it.
   Candidates must be positive finite plain neutral land Food, currently visible
   to that Worker’s team, inside the original circle and actually reachable by
   the current land route. Sort by distance from the Worker, then stable node ID.
   Exclude Farms, all wildlife states, all resource variants, water actors and
   other resources. Future source categories require explicit admission, rather
   than falling into this class because their cargo happens to be Food.
3. **Existing delivery and accounting.** On depletion, compatible partial Food
   may fill from a candidate; a full or incompatible load uses the existing
   compatible owned drop-off first. Each harvest debits the existing node once.
   Workers may share stock under current debit rules; there is no second pool,
   free Food, refill, reservation cap or automatic purchase. A new accepted
   manual source replaces the class and anchor after preserving typed cargo.
4. **Player orders win.** Preserve the current accepted Move/AttackMove,
   Stop/Hold, Attack, Patrol/Follow, Return Cargo, Build/Resume and repair
   cancellation boundary. Accepted queued movement also removes the work job
   while existing active-delivery/queue precedence remains intact. Rejected,
   stale-generation, foreign and full-queue commands preserve current authority.
   Do not reinterpret `queue: true` on land Gather as a newly supported queued
   harvest job; current accepted land Gather clears pending waypoints.
5. **Bounded finish.** If no visible reachable candidate remains, deliver any
   remaining cargo once through existing routing and clear the Food job. An
   unavailable drop-off follows existing cargo-preserving behavior; no remote
   deposit is added. No anchor creep, expanding search, hidden-resource wake-up
   or idle-worker recruitment follows a finished job.
6. **Durable identity, deliberate recovery.** The Food-only intent variant
   persists the Food **source class**, original anchor and matching Worker
   generation. Cargo type and a temporary target cannot recover that class.
   Keep existing v1 Wood/Stone/construction records valid and reject cross-class
   targets before restore mutates authority. Leave legacy Food/Farm/Sheep/fish
   checkpoints source-only; only a new accepted assignment acquires this policy.
   The economy-owned additive variant uses version one, kind Gather and the
   required `sourceKind: 'neutral-land-food'`; Wood/Stone and construction keep
   their exact existing shapes. Widening the resource union alone is insufficient.

Current manual visibility and claim rules are inventoried above, not rewritten
by these candidate-selection rules. A global manual-order visibility change or
exclusive Sheep harvest ownership would need a separate decision and regression
scope.

## Design test matrix and acceptance boundary

This matrix records intended coverage. The implementation QA identifies checks
actually run; the matrix alone establishes neither test completion nor cloud-game
acceptance.

| Boundary | Required future proof |
| --- | --- |
| Positive continuation | Both seats, two finite plain nodes, partial and full loads over several deposits. Original anchor and neutral metadata persist; only explicitly selected Workers change. Exact total stock + typed cargo + banks is conserved. |
| Mixed source identity | Place reachable nearer Farm, alive Sheep, carcass, fish, Wood and Stone around the same depleted node. Only plain Food can follow; unrelated actors, plots, wildlife/Herd state and fish stock stay unchanged. An unregistered future variant fails closed. |
| Area / disclosure / routes | Exactly-eight boundary included; farther chain from a temporary target excluded. Undisclosed and explored-but-currently-hidden nodes excluded. Component/path failures stop cleanly; identify injected route cuts as synthetic tests, then add an admitted-map native case. |
| Shared exhaustion | Two selected Workers race for fractional final stock. Zero/empty/missing candidates never debit twice, lose fractional cargo, bank remotely or rescan forever. A stopped unselected Worker stays unchanged. |
| External authority | Accepted/rejected manual replacements, Stop/Hold/Return, combat, Build/repair, Patrol/Follow and queued movement through both-seat authority. Queue delivery precedence beats continuation; stale/foreign/full-queue rejection retains the job. |
| Typed handoff | Food → Wood/Stone and Wood/Stone → Food deliver incompatible cargo before harvest. Farm/Sheep/fish manual replacements clear the proposed area job; old source class is never inferred from leftover cargo. |
| Checkpoint / generation | Current Wood/Stone/construction and legacy source-only Food fixtures stay legal. New Food records preserve original class/anchor through deposits and real untouched cold restart with a strictly newer checkpoint. Reject wrong source subtype, mixed resource, malformed/unknown variant and recycled-generation jobs atomically. |
| Negative neighboring policies | Existing Farm ownership, paid replant/destruction/refund; Sheep visibility, manual opposing-claim harvest and Herd; land fish shared stock and Skiff one-load queued Move keep passing without implementation edits. |

Existing checks cover the **current** rules: `food-stone-continuation.test.mjs`,
`farm-harvest.test.mjs`, `wildlife-state.test.mjs`, `wildlife-claims.test.mjs`,
`wildlife-herding.test.mjs`, `shore-fishing.test.mjs`, `skiff-fishing.test.mjs`,
`skiff-fishing-next-move.test.mjs` and `queued-cargo-return.test.mjs` in
[`scripts`](../scripts/). The current inventory run exposed missing shared-intent
helpers in the two synthetic Sheep Gather test fixtures; this slice imports the
actual helpers and asserts that live/carcass Food installs no area intent.
That fixture repair introduces no runtime policy and is not a native gameplay
proof. Later implementation needs its own exact-source, clean-release,
served/deployed identity and actual cloud-game acceptance.

## Decision and next-content backlog

The adopted choice is **plain neutral land Food only** as the first
continuation slice. It removes depletion micro on ordinary Food while Workers
still stop beside Farm/Sheep/fish stock that the player did not assign. Keeping
all Food source-only preserves current choices but leaves that ordinary-node
gap. Mixing all Food reduces more clicks while introducing paid-plot, wildlife,
visibility and movement decisions; it is a larger policy change.

After source integration, retain identified served/rendered Food acceptance and
take one later content decision at a time: consider owned-existing-Farm reselection with
**no automatic planting or payment**; consider carcass-only wildlife only after
an explicit claim/Herd policy decision; let the fishing owner decide any
site-to-site land/boat continuation using its existing domain and Dock rules.
Do not invent another civilization or fold these choices into one cargo-wide
automation change.
