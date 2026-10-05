# Finite Farm planting

[Game rules](game-bible.md) · [Earlier proposal](farm-capability-proposal.md)

Farm is one paid, finite planting in the Frontier roster. It costs **60 wood**,
takes **15 accumulated Worker-seconds**, occupies **3 × 3** cells and has **600 HP**.
Completing construction creates **200 food stock** on that building, once. All
values are provisional and configurable in `src/farm-harvest.mjs` and the shared
gameplay registry; changing them changes the content pin. No host-only multiplier
or hidden regrowth is enabled.

These values start below the 75-wood Mill/House investment and use the existing
15-Worker-second construction baseline. The 200-food pool is four Worker training
prices and takes at least 200 total harvesting Worker-seconds at the unchanged
1-food/second rate, plus trips. This is a bounded wood-and-labour investment in
local supply, not an adopted food/wood exchange rate or a claim of final balance.
The lower 600 HP leaves durability to observe in contested matches. No player
matches were measured to choose this initial prototype tuning.

The default [authored Farm family](../assets/buildings/frontier-economy-models-v1/README.md) follows construction, damage and finite depletion; exhausted stock uses harvested-field captures, and new planting restores productive art. [QA](qa-frontier-economy-art-2026-10-04.md) retains identified staging verification.

## Harvesting and ownership

Select Workers, then right-click the completed owned Farm (or use the ordinary
touch Orders target flow). Workers approach its reachable perimeter and carry
food to a friendly completed Mill, Storehouse or Town Center. Farm is not itself
a drop-off. It grants no units, population, passive bank credit or gathering bonus.
The existing per-Worker rate and 10-resource carry capacity apply; multiple
Workers share the same finite stock without a separate reservation/gatherer cap.

Farm is the plot itself, with no plot-production queue. Left-clicking it selects
the building and clears Worker selection. To plant more, select Workers and
choose Build Farm for another paid site. The
[building action audit](gameplay-foundation-plan.md#canonical-building-action-coverage--4-october-2026)
traces this path and its separate ordinary-game acceptance. Resource targeting
uses the same visible owned completed Farm body as selection, so roof/edge clicks
can harvest instead of silently becoming Move orders.

Only the planting's owner can harvest it. Authored map nodes remain neutral under
their existing rules. Enemy Farms can be attacked; their stock cannot be harvested
or captured. An unfinished planting supplies nothing. Stop preserves cargo;
Return cargo delivers it through the existing food routing and leaves the Worker
idle. An obstruction replans a Farm approach against its perimeter, rather than
an arbitrary open cell near the footprint's center.

At zero stock the completed plot remains in place. Its selected-building action
offers **Replant · 60 wood** and **Clear exhausted Farm · no refund**.
Select idle Workers, then select the exhausted owned plot: only those selected
Workers remain selected beside the building card. Replant replaces that plot
with a fresh building/source ID, 15 Worker-seconds of construction and another
finite 200-food pool. The original clear → paid Build Farm path remains available.
A plot selected without Workers explains this selection sequence; it recruits nobody. No productive
completed Farm can be canceled for a refund. Unfinished cancellation retains the
ordinary proportional refund and creates no food stock. Destruction loses the
remaining crop; already-carried food stays real cargo and routes to a friendly
drop-off. Repair follows the existing paid wood/HP contract and never refills stock.

## Resource and recovery boundary

`harvestStock` on the building is the single persisted crop pool. A `farm:<id>`
food-target adapter exposes it through ordinary Gather and wire observations;
the colon cannot collide with an authored map node ID. Crop stock is never added
to the map definition or its authored-node checkpoint array. The source lifetime
is the paid building's lifetime; IDs are not reused until a match reset, which
also clears old orders and all plantings.

This keeps the shared map/resource boundary compatible with the
[mineral audit](mineral-economy-readiness.md): Farm uses existing food, no new
resource enum, bank, cargo kind, neutral-node schema or ore cost. Map authoring
continues to own authored node admission; a subsequent Stone slice needs typed
bank/debit/refund work before any node type is admitted.

Farm was introduced at checkpoint schema 22; later wildlife and mode migrations
retain the same crop fields in the current shared checkpoint schema. Current content pins require valid
Farm stock, construction state and owned harvest references. The exact preceding
Skiff pin migrates Farm-free paid work, including Gate/Dock/Skiff rows, without changing
banks, crop sources or unit identity. The older Dock pin retains its existing
Gate-free migration. Older content pins cannot claim a Farm or planted stock. Restart
restores unfinished work, remaining crop, cargo and depletion; rematch starts
again from the authored map and initial banks.

## Prototype presentation and checks

The renderer explicitly uses the existing procedural House as a **Farm placeholder**;
the selected-building card/hint names its finite plot role, stock, exhaustion
and fresh paid planting. The placeholder status is retained here.
No crop artwork or paid model is claimed. Distinct field art can follow the actual
3 × 3 plot and its productive/exhausted stock states. The deterministic harvester
sees and gathers existing owned Farms through the same bounded node policy;
bounded automatic AI starvation planting/replanting is implemented in the
[later paid-Farm policy](qa-pve-paid-farm-2026-10-03.md). Broad farming strategy
and optimization remain outside that slice.
Owned Farm sources use owned-building visibility under fog; hidden neutral and
enemy sources retain their existing filtering.

### Farm selection feedback follow-on

Action/production owns a compact Food plot identity and reusable selected-building
detail fields, motivated by the player's report that the Farm did not look
harvestable or workable. The existing dismissible portrait → Selection panel
pattern keeps role, stock and instructions beside current health and lifecycle
actions. Productive, unfinished and exhausted plots have separate instructions;
desktop uses selected Workers/right-click, touch uses Gather / move then tap.
Enemy and hidden plots expose no private stock or assignment controls. The normal
hover uses the same visible building picker, names the role and action, and
marks exhausted harvest unavailable rather than suggesting a Gather can succeed.
Construction hover follows the actual context-order eligibility: Shift queued
Move, explicit Move, Patrol/Follow, attack-move and water selection retain their
earlier behavior. Only an eligible selected Worker receives finish-construction
help; a movement mode never advertises an impending Build command.

Visual backing: the admitted default [Frontier Farm lifecycle captures](../assets/buildings/frontier-economy-models-v1/README.md)
now supply the existing 52px portrait and 40px inline illustration. A fixed
view-01 CSS viewport preserves the planted field, construction scaffold or bare
exhausted soil; registered damage variants remain distinct. [Exact hashes and
framing](../assets/ui/portraits/PROVENANCE.md#farm-runtime-reuse--4-october-2026)
record original pixels inspected at both compact sizes in color/grayscale.
Authoritative completion controls food availability: unfinished plots never use
productive or exhausted art, even at 100% progress. Unknown state or image errors
retain the labelled [Food symbol](../assets/ui/icons/food.svg) and written facts.
The existing public [Farm design study](art-direction/frontier-economy-meshy-v1/farm-reference-v1.png)
link stays in its stable node; it remains a production reference. No new image,
private source or HTTP admission is published. The [world-art QA](qa-frontier-economy-art-2026-10-04.md)
establishes the default battlefield family; actual compact HUD framing,
keyboard behavior and identified containing delivery remain separate acceptance.

Small flow storyboard: click your plot → compact Food plot/stock identity;
open its portrait → current health, description, source-study link and Worker
instruction; Escape/close → focus returns to the same portrait. Server stock
updates keep those nodes stable. Completion changes construction instruction
to harvest instruction; zero stock changes READY to EXHAUSTED and offers the
existing no-refund clear. Selecting an enemy, dead plot or different unit hides
stale Farm details. No modal encyclopedia or decorative production action is added.

[Selection cue direction](ui-audio-direction.md#routine-commands) already calls
for one short, quiet acknowledgement. `selectBuilding` emits the existing
`select` event with `buildingType: farm`; the audio runtime resolves any existing
profile binding or its generic synthesized cue. Existing mute, volume, hidden-tab,
cooldown, bus and overlap limits continue to apply. No Farm-specific recorded
sound is approved/shipped; the existing generic acknowledgement is intentional.

Both-seat actual DOM/focus/audio-call and Three-picking/hover checks belong in
the next small PR, separate from the reviewed Farm body fix in
[PR339](https://github.com/lbeezr/thousand-unit-skirmish/pull/339). HUD01a101f7-35be
retains `renderer-novice-flow-scenario.mjs`; Building01a0fcf5 retains
`renderer-building-catalog-scenario.mjs`. Action/production retains this card's
ordinary Farm acceptance at 1280 × 720 with desktop/touch, both teams, fog and
normal/strategic zoom using the [qualified capture contract](renderer-qualification.md).
Capture should use paid Build Farm → construction → selected plot → Worker
body Gather → depot credit, then existing finite exhaustion/clear/replant;
it must not inject bank/stock or substitute the source study for game art.
Source/CPU/default release and deployed identity remain separate from those
ordinary-game pixels and listening/usability acceptance.

```sh
node --test scripts/farm-harvest.test.mjs scripts/farm-client.test.mjs scripts/roster-building-ui.test.mjs
node scripts/farm-scenario.mjs --output=NEW_DIRECTORY
node scripts/farm-scenario.mjs --fog --output=ANOTHER_NEW_DIRECTORY
node scripts/mature-settlement-scenario.mjs
node scripts/mature-settlement-scenario.mjs --reverse-seats
```

The Farm command scenario covers both seats, paid construction, prior content-pin
preservation, unfinished recovery, ownership rejection, retained cargo to Mill,
finite depletion, no-refund clearing, proportional unfinished cancellation,
fresh paid planting, destruction/cargo conservation, no duplicate recovery credit
and host reset. Banks, crop stock and cargo are never injected. Destruction uses
declared HP/position fixtures with existing initial Infantry. Numerical budget
checks tolerate accumulated floating-point noise; depleted crop stock is exactly
zero. Automated checks do not establish native visual quality or human balance.

The [natural mixed-profile proof](qa-farm-stone-paid-2026-10-04.md) adds paid
Farm/Watchtower coexistence on shipped maps and a retained Stone load ordered
onto an owned Farm. Stone is delivered before food gathering; Mill remains
food-only. Its untouched cold saves and proportional refunds preserve the
existing ledger without inventing a resource exchange rate.

The [paired opening measurement](qa-paired-farm-food-2026-10-04.md) compares
one and three Workers against nearby plain neutral food on shipped Millrace,
reversing seats and including construction, travel and first deliveries.
Recorded deposits depend on the selected plots and finite pools; they do not
settle contested balance or change the provisional planting values.

## Manual renewal ownership and active queue — 5 October 2026

Farm renewal owner: delegated task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`,
retaining default integration, review, packaging, containing staging identity and
ordinary-game acceptance. All unfinished rows below remain active; a blocked row
is not a completed milestone.

Selected Worker semantics are settled before implementation: only explicitly
selected, living friendly land Workers with build and Gather capabilities are
candidates. They must be idle, or approaching/working this exact exhausted plot.
Hold, Follow/Patrol, attack, another resource/construction intent, queued movement,
active delivery and unrelated movement remain busy. Idle cargo is retained.
Generation-stale selections are rejected; eligibility and reachability are
rechecked by authority. With no eligible reachable Workers, the action refuses
without a charge and explains that busy Workers keep their orders. In a mixed
selection only eligible Workers join; all others keep their work and cargo.

Authority admits only a living owned completed depleted explored plot and the
existing typed 60-wood debit. All checks precede replacement or payment. Its
footprint stays blocked, the old source ID dies, and a new unfinished ID contains
zero food. Double/stale clicks, including replay after recovery, cannot reuse the
old identity. Construction uses normal assigned Worker routing and existing
approved foundation/frame/complete/exhausted art; there is no passive growth,
new building, preview toggle or automatic spending. `workIntent` construction
adds optional `resumeFarmHarvest: true` for exactly one owned Farm ID, bound to
Worker generation. Existing saves without it remain valid. Cooperative builders
retain continuation until their safe completion endpoint settles. Stop, Move,
Return and replacement orders clear the continuation normally; destruction or
cancellation cannot transfer it to another plot at the same location. Completion
uses normal Gather and existing friendly food drop-offs, delivering retained
incompatible/full cargo before harvesting. Unselected gatherers lose only the
expired source and deliver carried food normally.

Storyboard/backing: existing [admitted Farm lifecycle art](../assets/buildings/frontier-economy-models-v1/README.md)
and [selection cue direction](ui-audio-direction.md#routine-commands). Select
Workers → select bare exhausted plot → Replant · 60 wood → paid foundation/frame
→ completed field → selected Workers carry food to existing depot. Rejection
leaves bare soil, banks and orders intact with written guidance. No new/private
pixels, source publication, paid generation or rejected art is admitted.

| Active slice / owner | Next action and bounded scope | Dependencies and observable acceptance |
| --- | --- | --- |
| Explicit manual renewal / Farm owner | Finish independent review and exact-head client/authority/native controls, then normal authorized PR integration. `farm-harvest`, optional construction intent validation, narrow server admission/completion hooks and existing lifecycle/selection UI only. | Existing crowd/access routing and architecture boundary stay owned by Crowd01a10933 and architecture; no steering, renderer or shared state schema replacement. Both seats, exactly-once debit, first food delivery, stale generations, invalid plot/funds, interruption, destroy/replacement and cold recovery must pass. |
| Default release and containing staging / Farm owner with existing public staging delivery owner | Pack clean exact merged source and verify server/client modules; identify an actually containing authorized staging build and smoke it. | Source, release digest and served/deployed source stay separate. No private-art publication or production promotion follows from this code scope. See [deployment guide](deployment.md). |
| Ordinary Farm renewal acceptance / Farm owner | Execute normal Tiny paid build → Gather → depletion → select Workers/plot → Replant → first depot credit on both seats, desktop/touch and normal/strategic zoom. | Cloud probe at base `6ee1cce4` failed `sandbox-unavailable` and `storage-unavailable`, zero frames/screenshots. Supported browser provider configuration is required; no security bypass or stopped Mac dependency. Record exact build, buttons/state, food/wood/cargo and rendered frames using [qualification](renderer-qualification.md). |
| Next disjoint readiness slice / Farm owner | Extend the owner-run ordinary Farm capture adapter to select actual Workers and use explicit Replant after depletion, with stock/cargo/bank assertions and no injected food/stock. | Do this after reviewed small source integration. Existing HUD novice/carcass/body pickers remain intact; modify only the Farm recipe and its controls. Actual rendered execution still depends on the qualified cloud renderer. |
