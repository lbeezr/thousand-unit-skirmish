# Gameplay foundation implementation plan

[Roadmap](roadmap.md) · [Game bible](game-bible.md) · [Architecture](architecture.md)

## Outcome

Deliver one complete medieval-frontier faction on an extensible RTS foundation.
A new unit, building, technology or faction variant should be a validated content
change when it uses supported behaviors. A new behavior still requires explicit
simulation work. Sprite/model/animation changes must not change gameplay rules.

This is the next development tranche. Existing match/recovery checks remain the
regression floor; another validation-only tranche is not the primary outcome.
Human sessions inform usability and balance while implementation proceeds.
Art production stays independent and placeholders remain usable throughout.

The [current building action coverage](#canonical-building-action-coverage--4-october-2026)
below is the maintained production/research/unlock audit and bounded starter
progression backlog. Original F1–F4 requirements and dated completion records
remain historical scope and evidence.

## Current boundaries

The authoritative simulation is in `server.mjs`; browser integration/rendering
is in `src/main.js`. Existing queues, rally points, construction connectivity,
food/wood gathering, combat, fog, objectives, persistence and seeded PvE should
be extended rather than replaced.

`src/gameplay-definitions.mjs` now owns validated unit, building, technology and
faction content, stable wire identities and the canonical gameplay revision.
Authoritative queues/actions, HUD availability, editor validation and filtered AI
observations consume these definitions. Houses and completed Town Centers provide
gameplay capacity separately from safety ceilings; friendly drop-offs, repair,
cancellation and shared combat/progression rules extend the existing simulation.
`src/gameplay-presentation.mjs` binds content to declared procedural profiles.
Sprite/GLB loaders remain renderer capabilities; skeletal animation and full F4
variant/scale proofs are still separate work.

## Milestones and shipping slices

### F1 — Extensible roster and rules

**Deliverable:** existing gameplay consumes one versioned, validated registry;
a Spearman and House exercise it through the real match pipeline.

1. Extract shared unit, building, technology and faction definitions. Begin by
   reproducing current behavior exactly. Units define stats, costs, training
   time, population cost, capabilities and combat tags. Buildings define
   footprint, construction, HP, functions and production lists. Technology
   definitions describe costs, prerequisites, duration and supported effects.
2. Use stable content IDs and a deterministic resolved ruleset revision. Keep
   wire IDs compact through a registry mapping; retain compatibility with the
   existing roster until a deliberate protocol migration is ready.
3. Route authoritative affordability, queues, command validation and research
   through definitions. Expose derived legal actions/rejection reasons to HUD
   and filtered AI observations; clients never choose authoritative costs.
4. Replace closed role lists in selection, production UI, editor validation and
   AI capabilities. Policies retain explicit strategy choices, rather than
   assuming the registry itself decides strategy.
5. Add Spearman as a melee production option with placeholder art. Add House as
   the first non-production building; complete population behavior in F2.

**Acceptance:** Worker/Infantry/Archer behavior and known scenario outcomes are
preserved during extraction. Spearman and House reach selection, construction or
training, fog-filtered snapshots, save/reload, reconnect and rematch without new
hardcoded kind branches in generic systems. Multiple products can share one
building. Missing references, duplicate IDs, prerequisite cycles and invalid
values fail validation with actionable messages. Each real addition includes
both-seat and AI coverage; clients cannot bypass prerequisites or affordability.

### F2 — Complete base and economy lifecycle

**Deliverable:** players decide where to expand, how much capacity to build and
where to defend. Initial roster: Town Center, House, Storehouse, Barracks,
Archery Range, Stable, Watchtower and Workshop. Workshop arrives in F3.

1. Make Houses add gameplay population capacity, separate from the 1,000-per-seat
   safety ceiling. Reserve queued population atomically; show used/reserved/cap
   and explain blocked production. Destruction reduces cap without deleting
   living units; prevent further reservations until capacity is available.
2. Add Storehouse as a food/wood drop-off. Workers choose a reachable friendly
   completed drop-off; destruction or route blockage reassigns them without
   duplicating or losing cargo. Keep the current Town Center valid.
3. Allow additional constructible Town Centers and worker production. Define
   footprint, access, rally/exit search, population and elimination behavior;
   a single lost Town Center must not accidentally eliminate a surviving army.
4. Add Watchtower using shared targeting/damage rules and explicit sight/range.
   Give it a clear counter and avoid making objectives trivially unassailable.
5. Complete cancel/refund and repair rules for construction, training and research.
   Specify refund timing, builder interruption/resumption, queue destruction,
   access blocking and checkpoint behavior before implementation.

**Acceptance:** a two-seat match can expand to a second resource region, shorten
worker trips with a Storehouse, hit and relieve a population block, and destroy
an expansion/defense without broken pathing, lost resources or stale queues.
AI builds capacity, expands and recovers from losses using visible information.
Manual large-army fixtures retain their separate stress-testing mode.

### F3 — Army composition and progression

**Deliverable:** a bounded combined-arms roster and small technology tree, not a
large civilization catalog.

1. Introduce shared attack/armor classes and tag-based modifiers with a documented
   damage formula. Define target eligibility, minimum damage, attack timing,
   range and structure interactions. Preserve deterministic simultaneous combat.
2. Add Stable and Scout/Rider: a fast reconnaissance/raiding role. Make Spearman
   an effective answer to mounted units; retain Infantry and Archer roles.
3. Add Workshop and a siege unit whose advantage against defenses is balanced
   by vulnerability to mobile armies. Add projectile/area effects only if this
   concrete role requires them, with bounded queries and friendly-fire rules.
4. Generalize existing attack research into a small progression tree: a second
   military tier, weapon/armor upgrades and the siege unlock. Apply effects by
   supported stat modifiers; define stacking, current/new units and save state.
5. Teach the deterministic AI mixed production, prerequisite acquisition and
   counter responses. Use only its filtered observation and bounded planning.

**Acceptance:** representative matches demonstrate scouting, a mounted raid,
its Spearman response, and an assault on a defended position. Costs, modifiers,
unlocks and availability agree between server, HUD and AI. Technology purchase
and completion survive reconnect/restart and reset correctly on rematch.
Balance numbers are tuned from these interactions rather than declared final
in this plan.

### F4 — Interchangeable presentation and variants at scale

Start the presentation interface during F1; finish the interchangeability proof
after the roster exercises it. Do not wait for finished graphics.

1. Bind gameplay definitions to presentation profiles rather than asset paths
   or renderer types. Profiles declare backend, asset references, dimensions,
   facing, selection bounds, team accent, attachments and supported states.
2. Normalize idle, move, gather, build, attack, hit, death and spawn states/events.
   Deduplicate attacks and deaths by tick/entity generation; animation duration
   must not determine authoritative hits, movement or construction completion.
3. Define optional animation clips and capability negotiation. Static/sprite
   fallback remains valid. Extend existing schemas/loaders deliberately before
   claiming animated or skinned assets are supported. Reuse batching/LOD paths;
   avoid one scene object, mixer or material per unit by default.
4. Make faction variants resolve explicit roster/stat/technology/presentation
   overrides. Team identity stays separate. Pin the resolved ruleset to each
   room/checkpoint and reject or migrate incompatible saved rules explicitly.
5. Prove two presentation variants and one bounded gameplay variant. A developer
   adds supported content through definitions/assets, validation and release
   packaging; no simulation edits are needed for a visual swap.

**Acceptance:** the same seeded commands produce identical authoritative results
under both visual variants. All supported states have a real asset or declared
fallback; missing assets fail usefully. Mixed-role/building sessions work at
ordinary and strategic zoom. Measure 250/500/1,000/2,000 total units using the
[scale profile](core-playtest-tranche.md#scale-measurement-profile--proposed),
including animation/batch memory, browser CPU, snapshots and command delay.
Compare against recorded baselines; do not claim hardware support from an
uncontrolled capture. Package and staging smoke resolve all new dependencies.

## Dependency order and boundaries

Ship small PRs in this order: registry parity → shared production/actions →
Spearman/House → population → drop-offs/expansion → defenses/lifecycle → combat
classes/Stable → siege/progression → variant and presentation proofs. Define
presentation binding early alongside registry parity; art can target it while
other gameplay work proceeds. Each slice owns server, HUD, persistence, AI,
authoring and focused checks that it changes, through staging integration.

No new ECS, scripting VM, generic plugin engine, naval layer, campaign, public
account service or full civilization tree is needed for this tranche. Do not
rewrite working movement/room systems just to reorganize files. Keep runtime
entity storage compact; version schema changes and preserve visibility filters,
planning budgets, generation handling and order feedback.

Exact costs, starting capacity, tier prices, repair/refund values and combat
multipliers are implementation proposals to settle in their focused slices.
The content list and system outcomes above define the target scope; they are
not claims of implemented functionality or finished art.

## First implementation goal

Extract and validate the current rules registry without changing gameplay, then
prove a second Barracks product can train, appear in the HUD, persist, reconnect
and be used by the AI. Establish the presentation-profile interface in that
slice. This tests the architecture with a real addition before widening it.

### Ruleset contract slice

The F1 contract now validates compact wire identities, faction rosters and
prerequisite cycles; canonical gameplay revisions are published in snapshots and
pinned in schema-12 checkpoints. Incompatible pinned saves are preserved as
rejected files. Generic product availability is authoritative and shared with
HUD and filtered AI observations. Building rules and footprint geometry derive
from definitions, and building presentation profiles join the earlier unit
profiles. Focused checks cover both-seat prerequisite rejection before spending,
HUD reasons, canonical identity, legacy save migration and mismatched-save
preservation. The full F2/F3 outcomes remain in progress.

### Storehouse economy slice

Storehouses add completed friendly food/wood drop-offs, route-length selection
among reachable candidates, and cargo-preserving replanning on destruction or
navigation changes. The generic building menu consumes definitions; producers'
rally controls use registered product lists. The AI may build/resume/rebuild one
remote Storehouse using its own visible resource observation and bounded retries.
Both-seat runtime evidence covers costs, restart selection, deposits, destruction
and return to the surviving home drop-off. Focused checks cover wrong-team,
unfinished and disconnected choices, menu affordability, and AI recovery.
The prior schema-12 roster revision has an explicit compatible migration for this
addition; unknown revisions remain rejected and preserved. Town Center expansion,
defenses and cancellation/repair are still outstanding F2 work.

### Cancellation and repair slice

Construction, active/pending military and Worker queues, and research now have
explicit proportional refund semantics. Completed friendly structures support
paid Worker repairs, including interrupted save recovery and a zero-wood pause.
Contextual controls expose building cancellation and repair; the legacy Worker
queue has its own cancellation control. Both-seat runtime checks demonstrate
exact foundation refunds, proportional repair spending, preserved repair orders,
queue/research cancellation and remaining population reservations. The AI can
repair observed damage without repeating active work. Expansion Town Centers,
Watchtower defenses, and the F3 composition/progression roster remain outstanding.

### Town Center expansion slice

Town Centers now have a registered five-cell expansion footprint, 100 food /
400 wood cost, 60-second construction, 2,400 HP, five capacity slots, Worker
production and food/wood drop-off. Starting centers retain their existing map
placement/collision shape and compatibility Worker queue; they are selectable,
repairable and destructible entities. Expansion queues, rally points and cargo
routing use the shared production/building rules. Surviving units, paid queues
or an affordable reachable producer prevent elimination after a center is lost.
The deterministic policy can construct/resume one visible-resource expansion
and replace Workers at a surviving center. Procedural geometry and existing
captured Town Center art remain placeholders independent of authoritative rules.

### Watchtower defense slice

Watchtower is a non-production defense: 50 food / 150 wood, 35-second build,
three-cell footprint, 1,200 HP, seven-cell attack range and ten-cell sight from
its access perimeter. A completed tower deals eight unit damage every 1.25
seconds. It uses team visibility and the same pending-damage resolution as unit
attacks; unfinished towers cannot fire. Nearest inspected targets are chosen
with deterministic ties and rotating spatial scans capped at 64 enemy visits.
Idle scans back off for a quarter-second. Siege supplies the intended dedicated
defense counter in F3; the present numbers are provisional rather than final
balance. AI builds at most one tower for a visible threat near its own base.

### Shared combat classes and effects slice

Units and defenses now resolve hits through the same pure combat module. Content
specifies attack class, target tags, attack mode, armor, capability permissions
and matching tag multipliers. Damage is `max(0.5, base × completed technology
multipliers × matching tag multipliers − target class armor − technology armor)`;
ineligible targets take zero. Structure hits retain their own base damage.
Multipliers stack multiplicatively and armor effects add, with a stable technology
order. Existing Infantry/Archer upgrades retain their role scope; current and new
units derive effects from team completion state rather than rewriting entity stats.
Spearman declares its mounted multiplier for the following Stable/Rider slice.
Generic ranged-building access uses the content's mode/range. Gathering,
construction, repair and structure attacks use supported capabilities, and the
military selection control includes the full registered military roster.

### Stable and mounted roster slice

Stable supplies Scout and Rider through the shared producer registry. Its three-cell
foundation costs 200 wood, builds in 25 seconds and has 1,600 HP. Scout costs
40 food / 30 wood, trains in 16 seconds, uses one population, moves at 4.5 cells
per second and sees eleven cells; 60 HP and weak attacks make it reconnaissance
rather than a frontline fighter. Rider costs 85 food / 25 wood, trains in 20
seconds and uses two population. Its 130 HP, 3.8-cell speed and melee/pierce armor
support raids, while Spearman's mounted bonus remains a direct answer. These are
provisional numbers grounded in the first both-seat combat trades.

Mounted procedural placeholders share one instanced horse mesh per team and a
mounted silhouette at strategic zoom. Stable currently uses the procedural
Barracks presentation profile as its declared fallback. The bounded policy can
acquire/resume one Stable and train at most one Scout and two Riders, prioritizing
Spearmen for currently visible mounted threats. Workshop, siege, second-tier
progression and representative defended-position/scouting matches remain F3 work.

### Bounded technology progression slice

Military Tier II researches at any completed Town Center for 200 food / 150 wood
in 35 seconds. It enables military armor (Barracks, 100 / 100, 25 seconds) and
mounted forging (Stable, 120 / 100, 25 seconds). Armor adds one melee and one
pierce armor to Infantry, Spearman, Archer and mounted/siege tags; Workers stay
outside that scope. Mounted forging multiplies mounted damage by 1.2. Existing
Infantry forging and Archer fletching remain the initial weapon choices. Effects
resolve from completion state for current and newly produced units.

Shared research actions now derive prerequisites, ownership, completed-building,
economy, completion and single-active-project checks. HUD/contextual choices,
filtered AI options and Map Studio technology rewards enumerate the registry.
Checkpoint completion flags are generic; schema 18 explicitly migrates known
schema-17 state and validates active research at the correct surviving home as
well as constructed producers. AI acquires available progression after a viable
army while retaining food/wood reserves. Workshop/siege supplies the next concrete
tier unlock; representative raid, scouting and defended-position proofs remain.

### Workshop and siege slice

Tier II enables a three-cell Workshop (250 wood, 30 seconds, 1,600 HP). Siege
engineering researches there for 150 food / 150 wood in 30 seconds and unlocks
the Siege Engine: 80 food / 160 wood, 30-second training, three population,
90 HP, 1.8-cell movement, eight-cell range and a 2.5-second attack period.
Its siege-class hits deal six unit damage or 24 structure damage, multiplied
by two for defense tags. No area effect or projectile simulation is necessary
for this single-target role. Full-health both-seat checks show an engine at the
outer firing edge destroying a tower in 25 shots without return fire, while an
engine exposed inside tower range dies first. Rider defeats an engine with
112 HP remaining. These initial interactions inform provisional balance.

Procedural siege carts remain instanced and have a separate strategic silhouette;
Workshop declares the existing Range geometry as its placeholder. AI can build
one Workshop for a visible defense, acquire the unlock and train at most two
engines. Up to two engines assault the nearest inspected visible defense among
at most 64 candidates; army orders exclude those engines. Observed movement or
attacks preserve the order, a ten-second stall permits a retry, and loss of the
visible target returns them to army orders. Mixed-terrain/scouting/raid matches,
full CI and staging evidence are still required for claiming F3 completion.

### AI composition during siege acquisition

When a defense is visible, ordinary recruitment reserves the last two slots of
the twelve-unit military target for engines, including while the tier or unlock
is pending. Capacity planning uses the engine's registered three-population cost;
two free population triggers a House instead of leaving the counter unavailable.
The normal army and twenty-four-unit roster bounds remain in force. Losing sight
of the defense releases the counter reservation; no hidden target state is used.

The live acquisition check isolates the production policy and siege assault orders
while ordinary troops hold their opening positions. It purchases the tier, builds
one Workshop, researches engineering, trains two engines and demolishes the
opposing full-health tower from both seats. This component interaction proof does
not replace a full AI match. The separate Forked Vale reconnaissance/raid check
demonstrates fog discovery, retreat and a timely Spearman response in both seats.
Integration, staging and representative full-match evidence remain required.

### 2026-09-30 — Completion audit checkpoint

F1–F3 remain the active implementation scope; F4's complete variant and scale
proofs are separate. The following maps the original requirements to current
authoritative check surfaces, rather than declaring all acceptance complete.

| Requirement | Current proof surface | Remaining verification |
| --- | --- | --- |
| F1.1–2 registry, stable IDs, revision and compatibility | gameplay-definitions, ruleset-revision and ruleset-checkpoint checks | Integrated main CI remains the regression floor. |
| F1.3–5 shared actions, open roster, Spearman/House | roster-options runtime scenarios, roster UI, population and editor checks | Deployed Firefox empty-selection/catalog observation recorded in QA; local narrow-layout evidence retained. |
| F2.1 capacity and atomic reservations | population and production-lifecycle scenarios | No new implementation gap identified in these checks. |
| F2.2 reachable food/wood drop-offs | storehouse-routing tests and Storehouse runtime scenario | Runtime destruction/cargo proof complements disconnected-route selection tests. |
| F2.3 additional centers and survival | Town Center runtime and Worker exit scenarios | Corrected live both-seat expansion run passed at tick 4560; PR #252 integration/CI pending. |
| F2.4 defenses and counter | Watchtower and siege-defense scenarios, shared combat tests | Field-role and paid AI siege evidence cover distinct interactions. |
| F2.5 construction, training, research, repair lifecycle | base-lifecycle and production-lifecycle scenarios | Includes cancellation, interruption, repair funding and persisted reservations. |
| F3.1 shared deterministic combat | combat-rules tests and simultaneous lethal runtime scenario | Damage rules are documented in architecture/game bible. |
| F3.2–3 mounted/scouting and siege roster | mounted/siege roster scenarios, field-roles and siege-defense scenarios | These role fixtures do not claim one full match exercises every role. |
| F3.4 technology progression | progression and siege roster scenarios, research action tests | Both-seat purchase rejection, active/completed restart and rematch covered. |
| F3.5 bounded filtered AI | production/reconnaissance tests, paid siege runtime and contested-match scenarios | Live expansion passed; outstanding PR integration and final evidence review pending. |
| Early presentation binding | gameplay-presentation validation and runtime profile consumption | Full F4 interchangeability/animated asset proof is outside this goal. |
| Staging integration | Deployment fcc377e8 at abce656; readiness/assets/WSS and 250-unit gameplay smoke | Deployed contextual catalog and automatic art-deploy recovery observed separately in Firefox. |

Read the dated QA records for build identities, measured observations and limits.
A listed test is a proof surface, not an assertion that every original acceptance
criterion has passed merely because its filename exists. Final completion still
requires review of the results and integration of outstanding focused PRs.

### 2026-09-30 — F1–F3 integrated completion

F1–F3 and the early presentation binding are implemented and integrated in main.
PR #252 merged as `496d387` after all three CI shards passed at `c8539cf`; the
new live expansion check passed in CI at tick 4560. The requirement audit above
is resolved by those results together with the named registry, lifecycle,
combined-arms, progression, filtered AI, authoring and recovery runtime evidence.

Staging deployment `d0707391-06ce-4e74-9972-d74e4301ea93` succeeded at exact
merge `496d387bcd7d8b3d2a720ca53aa167b36a04d292`. Packaging/transport smoke and
a fresh 250-unit authored room passed readiness, both seats/reconnect, map
save/reload, elimination victory and synchronized rematch (`qa-staging-muo1git3`).
The deployed HUD observation and earlier narrow-layout evidence remain in QA.
These proofs establish the requested foundation; they do not certify final
balance, finished art, unassisted novice usability or full F4 variants/scale.

## Canonical building action coverage — 4 October 2026

Inspected main `e445d344bafe68823b51babe60ccdad6508ce8ad`: all thirteen Frontier
building definitions and all six technologies. This owns action/production/unlock
coverage, not another asset catalog or planning queue. Source establishes current
behavior; dated receipts establish only their named revisions. Ordinary rendered
and novice acceptance remain open unless a receipt explicitly establishes them.

The authorized progression restart adds one seventh technology, Food Tools, at
Mill. The dated six-technology inspection remains historical; the current Mill
row and [bounded slice](#food-tools-progression-slice--4-october-2026) describe this
new design and its implementation rather than claiming an old wiring defect.

**Farm answer:** Farm is itself one owned finite harvest plot. Its definition
has `products: []` and `harvest: {type: 'food', stock: 200, access: 'owner'}`.
It is neither a farmhouse producer nor an unimplemented plot factory. Selected
Workers → Build Farm → valid 3 × 3 site → 60 wood debit → 15 accumulated
Worker-seconds → 200 food on that same building is implemented. Left-click
selects the Farm and clears unit selection; select Workers again, then right-click
its body/base (or arm Gather / move and tap) to harvest. Clicking the selected
Farm cannot produce another plot. Mill, Storehouse or Town Center receive carried
food; only delivery credits the bank. Repair never refills it. Clear exhaustion
without refund, then build a fresh paid Farm to replant.

Two narrow client defects reproduced on both seats against the inspected source:
visible Farm body hits outside the 26-pixel base target issue Move, and its card
says `Population capacity +0`. The correction reuses the normal visible owned
completed building picker for Farm resource targeting, retains construction/enemy
target priority, and describes finite stock/exhaustion. Utility cards name actual
defense/gate/wall/drop-off roles; unfinished utilities no longer promise production.
Research completion also falsely promised `+20% ATTACK` for Tier II, armor and
engineering; it now reports `UPGRADE ACTIVE`, preserving the research audio cue.
These corrections change targeting/feedback, not tuning or progression.

### Coverage matrix

`F/W/S` mean food/wood/Stone. Building times are accumulated Worker-seconds;
unit/research times are simulation seconds. Product entries give price, time and
population. Values are provisional. Food rates below are base rates; completed
Food Tools multiplies only land Worker food gathering by 1.2, preserving finite
supply and delivery. Ordinary builds need selected living owned reachable
Workers, a clear level connected site, affordability and room below
the 128-building limit. Workshop is the only technology-gated building. Every
building shares unfinished cancellation/refund and completed paid repair; shared
queue/research lifecycle is traced below. `A` means one of the eight default
Complete-art families, with per-state fallbacks; `P` means a declared procedural
placeholder. Neither marker claims appearance acceptance. Script names below
refer to the existing [test command guide](testing.md) and CPU registry.

| Building / role | Requirements / building price / work / footprint | Implemented production, research, upgrades and unlocks | Target / feedback / persistent effect | Missing design versus missing wiring | Default integration / tests / actual playable acceptance |
| --- | --- | --- | --- | --- | --- |
| Town Center — economy hub / expansion | 100F + 400W; 60s; 5 × 5 expansion. Authored home retains existing bounds and compatibility queue. | Worker 50F, 25s, 1 pop; Military Tier II 200F + 150W, 35s. Rally; +5 capacity; F/W drop-off (+S in Stone profile). Tier unlocks Workshop, armor and mounted forging. | Select owned center → contextual Train / research; reachable land rally. Population, depot, units and research recover; other viable forces/producers can survive home loss. | No new age tree required. No missing action handler found. Training card omits secondary functions; proposed B2 addresses role summaries. | A; registry/actions/server/main. `town-center-scenario`, `worker-production-spawn-scenario`, `expansion-ai-runtime-scenario`, `progression-scenario`; [integrated F1–F3 proof](#2026-09-30--f1f3-integrated-completion). Fresh normal-entry expansion/unassisted proof pending. |
| House — population | 75W; 15s; 3 × 3 | +8 completed capacity. No units/research. | Select → capacity role. Completion adds cap; destruction reduces it without deleting living units. | No missing production design: training controls intentionally absent. No capacity wiring gap found. | A; registry/population/server/main. `population-scenario`, contextual HUD tests, integrated F2 and paid settlement. Ordinary population-block/recovery observation pending. |
| Storehouse — mixed depot | 100W; 20s; 3 × 3 | F/W drop-off (+S in Stone profile). No units, research or gather bonus. | Workers choose reachable completed friendly depot; selected card lists accepted resources; loss replans carried cargo. | Economy upgrades are future design, not disconnected buttons. No depot handler gap found. | A; registry/profile/routing/server. `storehouse-routing.test`, `storehouse-scenario`, economy tests; [depot study](qa-mill-depot-economy-2026-10-03.md). Ordinary travel-choice proof pending; routes remain Resource-owned. |
| Mill — food depot / food research | 75W; 15s; 3 × 3 | Food-only drop-off. Completed owned Mill offers Food Tools: 100F + 75W, 25s, ×1.2 land Worker food gathering. No military tier prerequisite, passive supply, plots or units. | Workers return food automatically; research cost/effect and active/completed state appear on selected Mill. Wood/Stone need another compatible depot. Completion affects current/new Workers; flags/work recover. | Food Tools is the new bounded economy design adopted at restart; broader depot/economy upgrades remain proposals. | P (House); registry/profile/server/main. `mill-contract.test`, `mill-scenario`, `food-tools.test`, `food-tools-scenario` (both profiles); [historical paid Mill QA](qa-mill-food-dropoff-2026-10-03.md). Current native/default/deployment and rendered acceptance are recorded separately in the slice PR. |
| Farm — finite food plot | 60W; 15s; 3 × 3 | One 200-food pool; owned Workers Gather at 1 food/Worker-second, carry 10. Clear exhausted plot, then fresh paid Build Farm. No products/research/drop-off. | Select shows stock/exhaustion; Worker right-click/touch sends Gather `farm:<id>`. `harvestStock` persists once; crop destruction preserves cargo. | Farmhouse/child plots, growth/regrowth/upgrades absent design. Body target and +0 card are reproduced wiring/feedback defects corrected here. | P (House); registry/farm-harvest/server/main. `farm-harvest.test`, `farm-client.test`, `farm-scenario --fog`, `pve-farm-policy.test`; [native Farm QA](qa-finite-farm-2026-10-03.md). New body targeting proves Three CPU ray + actual command serialization, not pixels. Ordinary cycle remains B1. |
| Barracks — melee producer | 175W; 20s; 3 × 3 | Infantry 50F, 12s, 1 pop; Spearman 60F + 20W, 12s, 1 pop. Infantry Forging 100F + 75W, 25s, ×1.2 Infantry damage. Tier II enables Military Armor 100F + 100W, 25s, +1 melee/+1 pierce armor to military tags. Rally/cancel. | Completed owned selection → exact product/research prices/refusals; ordered paid queue spawns units. Forging excludes Spearman; armor includes it. | No registered producer handler gap found. Blacksmith not required for existing forging. Spearman weapon research undecided design. | A; registry/production/research/combat/server/main. `roster-options-scenario`, `production-lifecycle-scenario`, `research-scenario`, `progression-scenario`; integrated F1–F3. Fresh mixed-product ordinary proof remains B1. |
| Archery Range — ranged producer | 150W; 20s; 3 × 3 | Archer 25F + 45W, 7s, 1 pop; Archer Fletching 125F + 125W, 25s, ×1.2 Archer damage. Rally/cancel. | Select → Train Archer/research with authoritative refusals; blocked exit preserves paid queue. | No registered wiring gap found. Earlier selected-Range concerns remain in [HUD backlog](hud-controls-backlog.md); require exact state/button evidence for another fix. | A; registry/production/research/combat/server/main. `roster-options-scenario`, `research-scenario`, contextual HUD; historical deployed observations exist, current rendered interaction remains B1/HUD. |
| Stable — scouting / mounted producer | 200W; 25s; 3 × 3 | Scout 40F + 30W, 16s, 1 pop; Rider 85F + 25W, 20s, 2 pop. Tier II enables Mounted Forging 120F + 100W, 25s, ×1.2 mounted damage. Rally/cancel. | Both units available before Tier II; research waits for tier. Current/new mounted units derive effects from team completion flags. | No Scout/Rider age gate exists. Further tiers are undecided design; no hidden product found. | A; registry/production/research/combat/server/main. `roster-options-scenario --mounted`, `field-roles-scenario`; integrated F3. Scripted roles do not establish novice progression. |
| Workshop — siege producer / unlock | Tier II; 250W; 30s; 3 × 3 | Siege Engineering 150F + 150W, 30s, requires Tier II; unlocks Siege Engine 80F + 160W, 30s, 3 pop. Rally/cancel. | Build button shows research requirement; completed selection exposes engineering and locked product/reason; engineering flag enables production. | Engineering `effects: []` is a real unlock, not no-op research. No missing product handler found. | A; registry/prerequisites/production/research/server/main. `roster-options-scenario --siege`, `siege-defense-scenario`, `siege-ai-runtime-scenario`; integrated F3. Fresh ordinary tier→build→research→train→counter loop remains B1. |
| Watchtower — stationary defense | 50F + 150W; Stone profile adds 50S; 35s; 3 × 3 | Automatic 8 pierce damage / 1.25s, 7-cell range, 10-cell sight; completed only. No unit/research/rally/manual attack. | Select → defense role; visible eligible enemy targeting/shared damage; recovers after save. | Military armor/forging do not affect towers. Tower tiers/target control absent design. +0 utility card was misleading feedback, corrected here. | A; registry/combat/targeting/profile/server/main. `watchtower-scenario`, `watchtower-targeting.test`, `farm-stone-paid-scenario`; [mixed paid QA](qa-farm-stone-paid-2026-10-04.md). Human range/counter recognition pending. |
| Palisade — land barrier | 15W per unique segment; 5s; 1 × 1; atomic connected-line payment | Drag-line Build wall; sequenced Worker construction/connections; cancel unfinished/repair complete. No product/research/rally. | Full reserved cell resumes unfinished work; blocks land. Completion adds no population/bank credit. | Automatic gates, stone walls/upgrades absent design. +0 utility feedback corrected. | P; palisade profile/planner/build intent/server/main. Wall/gate/construction target tests/native scenarios; [palisade UI QA](qa-palisade-drag-ui-2026-10-03.md). Normal drag/keyboard rendered proof pending with HUD/qualified capture. |
| Palisade Gate — manual shared passage | 15W; 5s; 1 × 1 | Owner Open / Close; open admits both teams; closure refuses occupation or lost connectivity. Cancel/repair. No product/research. | Selected state/button → `setGateOpen`; traversal/`gateOpen` recover. | Friendly-only/automatic operation absent design. +0/generic hint corrected. | P; wall definition/gate transition/server/main. Gate/construction tests/native scenarios; [gate QA](qa-palisade-gates-2026-10-03.md). Rendered occupied/refused closure pending. |
| Dock — shoreline fishing producer / depot | 100W; 20s; 3 × 3 plus valid connected level-zero water berth | Skiff 75W, 10s, 1 pop; owned boat food drop-off. No research; rally deliberately unsupported. | Select → Train Skiff; boats Move/Gather/Return on water. Reserved/occupied berth preserves blocked paid queue. Land Workers cannot deposit here. | Transport/combat boats/naval upgrades/rally absent design. Lack of rally is validated, not a dead UI action. | P (House foundation/Skiff box); shoreline/water/fishing/server/main. Dock/Skiff/shoreline scenarios; [ordinary entry QA](qa-skiff-normal-entry-2026-10-03.md). Source/normal-entry proofs exist; identified rendered fishing proof remains naval/HUD-owned. |

### End-to-end action and persistence trace

Definitions: [gameplay registry](../src/gameplay-definitions.mjs),
[production availability](../src/production-actions.mjs),
[research availability](../src/research-actions.mjs),
[profile prices/drop-offs](../src/economy-profile.mjs). No Market, Blacksmith,
farmhouse, temple or building level-up is registered. Mill Food Tools is the
single new economy technology.
Artwork/lore/reference names grant no gameplay function.

Visible actions: [client](../src/main.js) `updateRosterBuildingOptions` and
the retained House/Barracks/Range controls reach the same placement flow.
`beginBuildPlacement` / `submitBuildPlacement` send selected Worker IDs with
tracked generation/token. `pickFriendly` / `selectBuilding` clear unit selection
and establish one owned building context. `updateRosterProductionOptions` lists
that producer's products; `updateResearchOptions` lists all its research with
inspectable locked reasons. `updateBuildingLifecycleActions` exposes cancel,
repair, exhausted clear and Gate operation in their real states. Non-producers
have no product buttons; build controls require Worker context. Normal Gather
uses `issueContextOrder` → `pickResourceNodeAt` → `issueGather`, including the
Farm body correction. Touch armed Orders uses the same context handler.

Authority: [server](../server.mjs) `buildBuilding` / `buildWallLine`, `trainUnit`
(home Worker compatibility delegates to `trainWorker`), `researchUpgrade`,
`assignGather`, `setGateOpen`, cancel and repair validate ownership, state,
prerequisites, generation, costs and spatial contracts. Production reserves roster
and population at queue admission; five entries per producer. Build validates
site/access/connectivity before one profile-aware debit/foundation insertion.
Invalid commands create no paid effect. Tick consumers finish construction,
advance queues, pause blocked exits, spawn units, initialize Farm stock once, or
set generic technology flags. One active research project per team; training and
research can run together, not a separate research queue per building.

Cancellation refunds unbuilt fraction, untrained head fraction, full pending
training price or unresearched fraction, rounded to six decimals; the next head
starts at full duration. Destruction loses queues/research without refund.
Exhausted Farm clear gives zero refund; replant uses a new paid identity. Repair
spends wood proportionally at 40 HP/Worker-second, full repair price
`max(10, 0.3 × building wood price)`; zero wood pauses and crop never refills.
These are existing lifecycle rules, not proposed completed-building refunds.

Persistence: `captureMatchCheckpoint` saves buildings/progress, paid queues,
remaining training, team research/completions, gate state, crop stock and Worker
cargo/orders. Schema 29 validates roster/content/economy/mode pins, products,
research producer and valid Farm stock/owned references. Restore retains paid
progress/effects; rematch rebuilds authored initial state. The
[Farm adapter](../src/farm-harvest.mjs) exposes `farm:<id>` from building stock
without adding authored map nodes. HUD/filtered AI consume owned options and
sources; enemy queues/research stay private.

All six military technologies are consumed: Infantry/Archer/mounted damage and military
armor resolve team flags for current/new units; Tier II gates Workshop/armor/
mounted research; engineering gates Siege Engine. Empty Tier/Engineering effect
arrays create real unlocks. Completion feedback was inaccurate, not missing stat
implementation. No unconsumed registered product/research action was found.
Utility destruction still emits generic `PRODUCTION QUEUE LOST` with no queue;
B2 retains that small feedback cleanup rather than inventing a capability.

Default/source boundary: all thirteen roles are normal roster/menu/server content
without preview flags. Eight Complete families use
[default captured bindings](../src/frontier-building-preview.mjs); Farm/Mill/Dock
use House placeholders and walls/gates procedural geometry via
[presentation profiles](../src/gameplay-presentation.mjs). Existing packaging/
static admission carries the modified client/server and existing imports; no
new asset, service, import admission or content pin is needed. Read
[building asset coverage](building-atlas-production-plan.md) for states/doorways,
owned by Building01a0fcf5, rather than duplicating its catalog.

### Recommended starter progression and executable backlog

**Proposed teaching/acceptance order, not new rules:** existing Town Center/
Workers → gather F/W → buy Worker/House → choose Mill versus Storehouse for trips
→ plant one Farm when nearby finite food is inconvenient/exhausted. Choose
Barracks, Range or Stable for the first army and role-relevant forging. Scout/
Rider already work in tier one. Food Tools at an owned Mill is an optional
100F / 75W food-labor investment competing with the first army. Research Tier II at Town Center, then choose
armor, mounted forging or Workshop → engineering → siege for visible defenses.
Tower/walls/manual Gate and shoreline Dock are optional map-dependent branches.
Do not add prerequisite gates to open buildings to force this teaching sequence.

**Recommended Farm model:** retain `farm` as one buildable food plot and Mill as
its optional depot. Describe Build Farm as planting finite food; make the existing
target/stock/clear cycle discoverable before another entity. A farmhouse with
child plots would require explicit producer, footprint/placement/radius, work,
price/yield, ownership, cancel/refund/destruction and child persistence decisions.
This audit does not adopt it. Growth/regrowth/fertilizer/economy research remain
separate decisions; no decorative button should promise them.

The following details the roadmap's existing Interface/Content streams, not a
second queue. Owner IDs retain existing task lanes.

| Slice / status | Bounded outcome / write scope | Owner / dependencies | Observable acceptance / evidence |
| --- | --- | --- | --- |
| B0 — narrow correction implemented here | Visible-body Farm Gather; truthful utility selection and six-tech completion. `src/main.js`, one server notice, existing Farm/HUD/research/audio tests and owning guides only. | Action/production owner (this task); preserves Resource routes, Forest work, Universal movement. Retains exact-head independent review, clean pack and authorized integration. | Both-seat pre-fix controls fail with Move/+0. Corrected actual Three picking/serialization and DOM role checks pass. All six actual completion handlers set flags/preserve audio without false damage promises. Exact-head/native/package results belong in the PR; no pixels inferred. |
| B1 — next ordinary acceptance | Paid Farm build/gather/clear/replant from normal Tiny entry; execute each producer's real queue/research choice through proposed progression. Existing native scenarios plus one separately owned ordinary-capture adapter; no shared renderer rewrite. | Action/production retains completion; HUD01a101f7-35be owns novice capture. [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323) supplies qualified packed renderer; [ordinary adapter PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331) supplies execution after integration. Resource01a101f7-5683 retains route acceptance. | Frozen reviewed source/clean digest, actual normal entry, screenshot plus button/target/state and bank/crop/cargo assertions, no injected bank/stock. Both seats for ownership; cold recovery; fresh-player Farm/Mill explanation. Qualification alone cannot close this feature. |
| B2 — compact role/effect explanations, partly implemented | Food Tools prices/effect are explained; the research-only Mill's existing progress and Details controls are now exposed independently of rally/unit production. Remaining: secondary producer capacity/depot summaries, exact Workshop prerequisite, and no queue-loss text for queue-less utility destruction. Existing text/buttons/notices only. | Action/production + HUD; reproduced both-seat hidden Mill progress at `968c7bdd` justifies the bounded correction below; further confusion fixes follow B0/B1 observations. No new tech/assets/architecture. | Thirteen-building capability checks, inspectable locks, shortages, active project/completion/cancellation and retained focus. Exact review/default evidence belongs in the correction PR; normal narrow HUD acceptance remains B1. |
| B3 — progression/balance observation, proposed | Paired Tiny openings compare neutral food versus Farm, Mill/Storehouse trips and one Tier II siege decision; record spend/deposits/labor/travel/exhaustion/losses/player alternatives. Retain tuning absent evidence. | Action/production + Maps; B1, [paired Farm measurement](qa-paired-farm-food-2026-10-04.md) and paid AI Farm tests. | Contested/recovery records distinguish conservation/usefulness from timing/balance. Current AI already plants/replants one bounded starvation Farm; no broad farm optimization is silently added. |
| B4 — farmhouse/regrowth decision, deferred proposal | Decide only if B1/B3 expose need; settle plot lifecycle/parent-child contract before any new registered action. One paid recoverable plot cycle first. | Product decision + Action/production; Building owns any resulting brief; depends on observed use. | Small written contract and executable paid acceptance precede a button. No automatic economic tier, giant tech tree, paid generation, gold/copper ledger or new service follows. |

Source/CPU tests establish the correction contract. The one normal-sandbox
renderer capability attempt in this cloud workspace at inspected main was blocked
by `sandbox-unavailable` and `storage-unavailable`: zero game frames/screenshots.
PR323's qualified hosted path is separate capability, not a current Farm capture.
Deployment identity/digest and ordinary rendered acceptance remain separate B1
evidence; a merge does not establish them.

### Food Tools progression slice — 4 October 2026

The user authorized restarting progression. The thirteen-building audit found
the six military technologies wired; Mill was a food depot with no economy
research. One completed-Mill purchase creates a real economic choice without a
new building, Blacksmith, age tree or second Farm system. Food Tools costs
100 food / 75 wood and 25 seconds; its only effect is ×1.2 productive land Worker
food gathering. A Farm still supplies 200 food, carry stays 10 and bank credit
still requires delivery. Wood, Stone, boats, travel and combat stay at their
prior rates. This tuning is provisional, not a measured balance conclusion.

Owner: Action/production retains review, exact source/pack, default integration,
staging identity and playable acceptance. Shared boundary with HUD art owner
01a101f7-35be: the existing selected-building/contextual research controls consume
`food-tools` from the registry and show its price, 25s and bounded effect; stable
focus, locks, progress and completion use existing controls. No HTML/CSS, HUD
skin, manifest, new art or audio binding is required. Movement owner
01a107ba retains routes, formations, arrival and fractional intent; this slice
changes only the productive food grant in `updateWorkerEconomy`. There is no
movement API or placement/orientation change. The existing resource-work intent,
source identities and carrying contract remain the coordination boundary.

Backing: the existing [compact HUD contract](hud-controls-backlog.md),
[Food symbol](../assets/ui/icons/food.svg) and
[Mill reference](art-direction/frontier-economy-meshy-v1/mill-reference-v1.png)
support existing treatment and food identity; the reference is production input,
not newly approved runtime art. State storyboard: paid Mill completion → select
Mill → inspect cost/time/effect → Research → one paid team project with progress
→ completed effect for current/new Workers. Short funds, wrong owner/producer,
unfinished Mill, another active project and duplicate completion refuse purchase.
Cancel refunds the unfinished fraction; destruction loses active work; rematch
clears completion. Enemy research remains private.

Default integration uses existing registry-derived client buttons, server
validation/debit/research lifecycle and flags. The exact immediately preceding
Food/Wood and Stone content pins migrate with Food Tools false; paid stock,
cargo, banks and work are preserved. Current/unknown pins cannot use migration
to invent completion. Earlier explicitly supported legacy migrations initialize
the same false flag after their existing content decision. No save is replayed
as a free purchase. Existing packaging includes the authoritative helper and
modified registry/client; no new static asset admission or service is needed.

Acceptance: both-seat actual DOM selection and command checks; actual authority
price/ownership/unfinished/duplicate refusals; paid Mill/Farm placement; exact
prior-content recovery in both economy profiles; active cold recovery and
proportional cancellation; actual 1.2 versus 1.0 productive grants; current/new
Workers; finite stock/cargo/deposit conservation; completed recovery and reset.
The slice PR records exact source, scoped checks, clean release, default and
provider status. Native commands and DOM checks do not claim ordinary pixels,
listening or unassisted use. B1 retains qualified normal Tiny entry, selected
Mill research and paid Farm/depot observations at the identified release. Next
progression decision follows that observation; no further economy tech is staged.

Implementation and scoped evidence are retained in
[PR #377](https://github.com/lbeezr/thousand-unit-skirmish/pull/377). Its current
review, default release and deployment status are recorded separately there;
the proposed HUD/movement boundaries above are not a claim of direct owner
agreement or ordinary-game rendered acceptance.

### Research-only Mill details correction — 4 October 2026

After Food Tools, the registry audit found no missing implemented product or
technology consumer. A real selection/actual-DOM check at main `968c7bdd`
instead reproduced an existing-action wiring gap in both seats: Mill exposes
the paid research button, but the compact research readout and Details opener
are hidden because the building has no unit products. Orders also hides its
research details behind rally capability. The existing cancellation button is
reachable; research purchasing and its persistent effect already work.

The correction derives research capability from the technology registry
independently of production/rally. Selecting Mill exposes the existing research
progress/completion readout and a “Research details” opener, with the rally row
hidden. Other buildings expose only their actual rally/research capabilities;
Dock retains Skiff production without a dead details entry. Existing actions,
prices, ownership, queues, refunds, worker grants, content pins and checkpoints
are unchanged. Action/production owns `src/main.js`, the existing DOM/consumer
regressions and this canonical plan. The exact HUD boundary is recorded on
[active HUD PR387](https://github.com/lbeezr/thousand-unit-skirmish/pull/387#issuecomment-5984725249);
owner confirmation and independent review are separate from the proposal.
Current movement PR385 changes no part of this client-only contract.

Backing reuses the existing compact HUD contract, Food symbol, Food Tools
description and Orders/Details controls. State storyboard: select completed
Mill → inspect price/time/effect → purchase → see progress/remaining time →
cancel with existing proportional refund or observe completion. Escape/Close
returns to the same Details control. This corrects discoverability of an
existing economic choice; it introduces no new research or visual assets.

Both-seat real selection/snapshot tests cover visible compact/drawer progress,
available/active/cancelled/completed/unfinished/opponent states, exact command
target and focus. Fixed expectations for all thirteen buildings protect producer
and utility boundaries. Source checks are separate from normal Tiny screenshots
and narrow-layout acceptance, still owned under B1 with HUD novice capture and
the existing qualified workflow. Exact-head review, clean package, default
integration and identified deployment remain recorded in the slice PR. Further
progression design depends on B1/B3 observations; no additional economy
technology or farmhouse action is justified by this source audit alone.
