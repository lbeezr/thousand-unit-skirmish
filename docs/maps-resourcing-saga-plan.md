# Maps and resourcing saga

**Status, 2 October 2026:** proposed epic plan, grounded in fork main `9990ed3`.
The user requested the plan; recommendations below are not approved economy,
balance, currency or capacity decisions. This document expands the
[roadmap](roadmap.md), which remains the single next-outcome queue. The
[game bible](game-bible.md) owns product intent, [map authoring](map-authoring.md)
owns implemented formats/tools, and [QA](qa-vertical-slice.md) owns acceptance.

## Current reconciliation — 4 October 2026

Documentation reconciliation owner: the architecture boundary worker, delegated
by the coordinating parent. Source checked against main `cade7c8b`; implementation
and acceptance remain with the existing map/scale, economy, wildlife, renderer,
art and delivery owners linked below. This assigns the reconciliation, not new
executors for all nine proposed epics.

The **2 October `9990ed3` baseline, its hash/stock calculation, story tables and
decision register remain historical**. They are not current catalog/default
claims. In particular, Millrace is now a compact internal/legacy map; ordinary
human Skirmish has Tiny 160, Small 192, Medium 224 and Large 256, with Tiny the
default and only accepted fresh ordinary AI choice. [Current tier inventory](map-tier-inventory-2026-10-04.md)
records source-qualified geometry, finite budgets, route/entry evidence and
remaining acceptance. [Confluence's correction](qa-confluence-opening-2026-10-04.md)
preserves old paid worlds through exact compatibility while fresh/reset games
use corrected openings. Map authoring stops at Large in that owning queue;
XL and the territorial world retain separate decisions and owners.

| Proposed epic | Integrated slices / owning evidence | Remaining acceptance or decision |
| --- | --- | --- |
| 1 — contracts, diagnostics, seeds | Shared resource/profile rules, versioned source audits and seeded layouts exist. [Tier inventory](map-tier-inventory-2026-10-04.md) separates stock, banks, forest potential, geometry and capacity. [Paid Farm/Stone](qa-farm-stone-paid-2026-10-04.md) and [paired Farm/food measurements](qa-paired-farm-food-2026-10-04.md) supply concrete conservation/throughput slices. | Map/economy owners retain broader frontage/path-cost and matched allocation experiments. One/three-worker opening measurements do not complete every proposed one/three/six-worker diagnostic or establish balance. |
| 2 — constrained placement/fair starts | [Millrace seeded clusters](map-authoring.md#resources-and-forests), protected campuses/expansions on the four tiers and finite forest/depletion rules are implemented. [PR283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283) adds bounded Wood continuation and cold recovery; [PR293](https://github.com/lbeezr/thousand-unit-skirmish/pull/293) records unchanged Food/Stone depletion behavior. | Map/scale and economy owners retain paid both-seat trip/frontage/congestion and human pacing proof. Equal stock/static reachability is not equal delivered income; Wood policy is not extended to Food/Stone by this reconciliation. |
| 3 — editor/presets/budget preview | [Map authoring](map-authoring.md) has seeded resource-patch preview/apply/cancel, bounded resource-only history, live-ground admission, JSON/save/load and scenario history. Wildlife import/publication parity is integrated in [PR221](https://github.com/lbeezr/thousand-unit-skirmish/pull/221). | Authoring owner retains terrain gesture history, higher-level Grove/Orchard presets, combined access/budget diagnosis and uncoached author observation. Resource-only undo is not complete terrain/resource history. |
| 4 — wildlife lifecycle | [Sheep workstream](wildlife-bellweather-sheep.md) records merged motion PR165, automatic claims PR194 and Herd/Stop PR205, with finite food, fog, snapshot/checkpoint/recovery/reset contracts. [Millrace Sheep receipt](qa-millrace-sheep-2026-10-03.md) preserves its dated source/default context; current ordinary tiers also contain Sheep. | Wildlife/art/delivery owners retain actual normal-game motion/ground/occlusion acceptance at a containing release. Hunt/hostile/decorative roles, breeding and decay remain separate proposals. Static art/CPU/native proofs do not close the whole lifecycle/art milestone. |
| 5 — economy expansion experiment | The explicit [Stone profile](stone-runtime-interface.md) integrates typed bank/cargo/node/payment/refund/repair/recovery and a 50-Stone Watchtower debit; [finite Farm](farm-finite-planting.md) uses paid Wood and conserved Food. The compact Stone lab remains an explicit internal Practice choice. | Economy/opponent owners retain Stone gather/spend policy and human balance decisions. Ordinary food/wood remains the baseline. Metal, gold/copper, new producers and general currency adoption are unapproved future decisions; historical D1/D4 are not rewritten as current policy. |
| 6 — mature settlement | Existing [paid mature-settlement harness](../scripts/mature-settlement-scenario.mjs) exercises current producers/research, paid construction, mixed army and recovery/reset. Tier source audits prove static city-fit examples with registry footprints. | Gameplay/map owners retain representative mature matches and congestion on the ordinary tiers. A static 30-building fit is not a paid city or capacity guarantee. No Castle/Blacksmith or new initialization schema is introduced. |
| 7 — readability/density | Renderer/environment guides and [asset adoption](asset-adoption-checklist.md) record default state bindings, LOD/resource contracts and retained calibration. Terrain faces PR295 is a source/rendering slice; the forest discovery proposal PR297 remains a draft. | Renderer/delivery owners retain supported-cloud packed-game frames and ordinary/strategic control/occlusion recognition. Capability, atlas or process checks are separate from pixels; a draft fog-rule change is not accepted behavior. |
| 8 — biome kits/art history | [Regional kits](regional-environment-kits.md), tracked source/iteration history and the asset ledger document Bellweather/Underbough and other admitted plant/ground/state slices. | Retained asset owners own missing species/state coverage and actual whole-kit acceptance. No new generation/spend, publication release or full-roster completion follows from this inventory. |
| 9 — regressions/scale/accessibility | Seeded/native conservation, interruption/recovery and tier entry proofs exist. [Testing strategy](testing-strategy.md) now has scoped CPU lanes and explicit graphics capability versus game-render boundaries. | Map/scale, delivery and playtest owners retain identified human sessions, controls/recognition and comparable combined simulation/browser/network workloads. No supported 2,000-unit capacity or fresh rendered-game pass is established here. |

**Milestone status:** M-E1 has integrated resource/layout and paid measurement
slices; its combined coherent ecosystem/match proof remains incomplete. M-E2
has resource authoring and Sheep command/recovery slices; combined uncoached
author/player acceptance remains incomplete. M-E3 has paid harness and kit/state
slices; an identified polished mature game and combined readability/performance
proof remain incomplete. M-E4 has contrasting regional source/integration work;
whole-kit repeatability and acceptance remain with the asset owners. Preserve
the original milestone definitions below; none is reopened as a blanket project.

The next useful action is the map/scale queue's containing-build human pacing
and paid crossing observation, with exact source/release/served identity; an
actual observed defect then selects its owning runtime or art slice. Unassigned
future epic execution is routed by the coordinating parent only when such a
bounded outcome is selected. Mac testing and canceled deployments remain
stopped; this reconciliation schedules neither replacement execution nor spend.

## Player outcome and ambition

Make a landscape that players can read, exploit, defend, reshape and author.
A pasture, orchard, woodland margin or quarry should offer a clear economic
choice, with believable habitat and dependable simulation. Pursue excellent RTS
quality through useful decisions, confident controls, strong art and repeatable
matches. Resource count and feature parity are not proxies for that quality.

Deliver this as incremental integrated slices: first a coherent Millrace
food/wood ecosystem, then reusable editor/wildlife rules, then a polished biome
and mature-settlement scenario, then regional kits. Existing matches remain the
regression floor. More elaborate economy is an experiment with an explicit
decision, not a prerequisite for improving the current game.

## Verified baseline

Source baseline: `9990ed3bb441fb0120a5aaad53d69798c18a66cc`. The checks below
were run on that checkout on 2 October; they do not certify hosted behavior.

| Surface | Verified state | Remaining gap |
| --- | --- | --- |
| Resource economy | Map validation, production costs, cargo/drop-offs and AI use `food`/`wood`. Finite nodes and separately addressed harvestable forest cells exist. | No stone/metal/gold/copper bank or wildlife lifecycle. Stone obstacles are terrain, not a mined currency. |
| Millrace | 80 × 72, terrain seed 93000; eight nodes: 2,800 food and 2,800 wood. 234 unique forest cells × six wood = 1,404 additional wood; total harvestable wood **4,204**. | Stock totals do not prove throughput, fair trip times, opening balance or match duration. |
| Starting bank | Millrace grants **150 food / 250 wood per seat**. | Exclude banks, objective rewards and timed-event grants from terrain-stock totals; report them separately. |
| Roster | Seven units: Worker, Infantry, Spearman, Archer, Scout, Rider, Siege Engine. Eight buildings: Town Center, House, Storehouse, Barracks, Archery Range, Stable, Watchtower, Workshop. | No Castle or Blacksmith type. An advanced-looking settlement must use real current types. |
| Research | Six technologies: Infantry Attack, Archer Attack, Military Tier II, Military Armor, Mounted Attack, Siege Engineering. | Fixture setup must obey prerequisite, payment and producer rules. |
| Map/editing | Seeded regional shapes, elevation, round blocker strokes, resource-node editing, named regions/events, scenario undo/redo, JSON export/import and Save & Play exist. | Terrain/resource-brush undo, shared habitat presets, economy-budget previews and wildlife authoring remain work. |
| Authority | Room worker owns resources, movement, collision, fog, checkpoints and rematch. Client selects/renders and sends commands. | New entities/resources require all these boundaries, plus filtered AI observations; art does not supply rules. |

Source owners: [Millrace JSON](../maps/bellweather-millrace.json),
[registry](../src/gameplay-definitions.mjs), [server](../server.mjs),
[map utilities](../src/map-utils.mjs), [landscape compiler](../src/landscape-authoring.mjs),
[scenario history](../src/scenario-authoring.mjs) and [architecture](architecture.md).
Millrace JSON SHA-256:
`1775ea219618bc9db2f1205d034dcee85ff570f4148bb7bd1cf1fe2bd4ecb209`.

A read-only check expanded non-overlapping obstacle rectangles, added the actual
[Town Center footprint cells](../src/town-center-spawn.mjs), then used shared
elevation/resource/objective connectivity helpers. All eight nodes and three
objective zones are reachable for both seats; both bases are clear. No new
throughput measurements, wildlife match or visual runtime proof was performed.

Reproduce the **named baseline's** stock calculation from repository root. Read
the pinned map from Git so a later map merge does not rewrite this historical
measurement:

```sh
node --input-type=module - <<'JS'
import { execFileSync } from 'node:child_process';
const revision = '9990ed3bb441fb0120a5aaad53d69798c18a66cc';
const m = JSON.parse(execFileSync('git', ['show', `${revision}:maps/bellweather-millrace.json`], { encoding: 'utf8' }));
const stock = { food: 0, wood: 0 }, forest = new Set();
for (const n of m.resourceNodes) stock[n.type] += n.stock;
for (const o of m.obstacles) if (o.material === 'forest')
  for (let r = o.row; r < o.row + o.height; r++)
    for (let c = o.column; c < o.column + o.width; c++) forest.add(r * m.width + c);
console.log({ seed: m.terrainSeed, nodes: stock, forestCells: forest.size,
  forestWood: forest.size * 6, totalWood: stock.wood + forest.size * 6,
  startingBankPerSeat: m.startingResources }); // six wood/cell at this baseline
JS
```

Use [the existing regional layout scenario](../scripts/vaelora-map-layout-scenario.mjs)
for broader access checks; it also rewrites the layout SVG, so review its output
diff. Reverify the owning server constant and map hash after a baseline changes.
The concurrent [Millrace cluster pilot](https://github.com/lbeezr/thousand-unit-skirmish/pull/22)
proposes 40 nodes and 5,604 total wood; that candidate is distinct from the eight-node
baseline above. Each implementation report must name its actual revision and
budgets rather than carry this historical total forward as current state.

## Metrics and evidence contract

Every candidate records source revision, map/schema/generator version, layout
seed, separate cosmetic/behavior seeds, asset hashes and seat configurations.
Store one dated report and link it from the owning guide. Include:

- **Supply:** remaining node/forest/carcass stock without double counting; starting
  banks, carried cargo, production spending, rewards and any losses in separate
  ledgers. State which supply is actually reachable for each opening.
- **Throughput:** deposited food/wood per simulated minute and worker-minute,
  at fixed one/three/six-worker allocations. Separate active gather time, travel,
  queuing and blocked time. Nominal gather rate is not measured delivery rate.
- **Travel and access:** shortest legal route cost and round-trip time to valid
  drop-offs, return space, gathering frontage, safe exits and key route widths.
  Straight-line distance alone cannot establish fairness.
- **Depletion:** time and stock at exhaustion, route/sight changes after forest
  removal, worker retarget/cargo behavior and restored state after recovery/reset.
- **Appearance and cost:** ordinary/strategic captures, visibility/depth/pivots,
  entity counts, simulation/path work, client frame time and snapshot bandwidth.

Recommended symmetric pilot: equal opening stock, no blocked home exits, and
report both seats' trip/throughput differences. A provisional 5% trip-time / 10%
throughput tolerance is a comparison target to review, not an approved balance
gate. Asymmetric scenarios declare intended advantages and counterplay instead
of passing a symmetry metric. Hardware and player-facing budgets remain explicit
decisions; existing 2,000-unit evidence does not establish supported capacity.

## Epic 1 — Resource and biome contracts, diagnostics and seeds

**Outcome:** authors can explain a map's economy and reproduce its layout.
**Dependencies:** current map/registry/forest contracts; no new currency decision.

| Story | Incremental PR outcome |
| --- | --- |
| 1.1 | Extract/share resource metadata for existing food/wood and distinguish resource identity, visual species, biome and decorative props. Preserve old maps and current node IDs. |
| 1.2 | Add a read-only diagnostic report for stock, reachability, Town Center exits, gathering frontage and path-cost distributions. Separate forest-cell and node supplies. |
| 1.3 | Record generator version and layout seed; isolate cosmetic and behavior RNG streams so an art change cannot move economic entities. Add replayable seed fixtures. |
| 1.4 | Add a bounded one/three/six-worker delivery experiment and bank/cargo/spend conservation report using authoritative state. |

**Acceptance:** the pinned Millrace baseline reproduces 2,800 food / 4,204 wood /
234 forest cells, and each later candidate reports its own declared supply;
legacy maps retain state/IDs; repeated seeds produce the same economic
layout; invalid resource/biome combinations identify their field; both-seat
reports include real deposited stock and all excluded grants. **Risks:** schema
churn, double counting, visual fields gaining simulation authority, and treating
reproducibility as proof of balance.

## Epic 2 — Organic constrained placement and fair starts

**Outcome:** groves, berry/orchard groups and clear routes form a believable,
playable economy. **Dependencies:** 1.1–1.3 and shared connectivity/elevation rules.

| Story | Incremental PR outcome |
| --- | --- |
| 2.1 | Define habitat anchors and bounded clustered placement, with dense cores, margins and clearings; return useful rejection reasons. Start with food/wood only. |
| 2.2 | Redistribute existing Millrace stock into irregular species groups while preserving opening budgets, routes, legal base/expansion footprints and production exits. |
| 2.3 | Validate both-seat access/trip/frontage and an explicit asymmetric comparison map; add a small fixed seed corpus with sparse/crowded edge cases. |
| 2.4 | Replay resource exhaustion and forest-cleared shortcuts, updating path/sight blocks and resource silhouettes together. |

**Acceptance:** every admitted seed has reachable gathering sites, declared
stock totals and protected required routes; placement ends within a documented
attempt budget; actual both-seat cargo runs expose congestion; depleted forest
opens the intended route and recovery/rematch restores it. **Risks:** equal totals
with unequal throughput, unreachable decorative-looking resources, excessive
rejection, and coupling every grove to one map's symmetry.

## Epic 3 — Shared editor brushes, presets and budget preview

**Outcome:** a creator makes a coherent economy without hand-editing JSON.
**Dependencies:** Epics 1–2; existing round strokes and scenario undo are the base.

| Story | Incremental PR outcome |
| --- | --- |
| 3.1 | Add a resource/biome draft model and shared validation/placement entry points consumed by editor previews and shipped-map generation. |
| 3.2 | Ship one Grove and one Orchard/Berry preset with explicit density, stock budget, clear-path preview and bounded seed controls. |
| 3.3 | Extend history to terrain/resource edits as atomic gestures, with bounded memory and exact undo/redo restoration, including displaced/deleted nodes. |
| 3.4 | Show stock/access diagnostics before Save & Play; round-trip seeds/presets or their compiled versioned result through download, reload and room launch. |

**Acceptance:** native pointer/keyboard authoring previews exactly the committed
cells/entities; undo/redo restores resource IDs/stock and terrain; exported maps
run under the same server rules; invalid edits preserve the last valid map and
name a remedy; an uncoached creator explains the budget preview. **Risks:** preview
drift, unbounded edit snapshots, destructive overlap, stale caches and leaking
runtime-only state into authored files.

## Epic 4 — Authoritative wildlife lifecycle

**Outcome:** a small flock creates an understandable food/escort decision.
**Dependencies:** 1.1, placement constraints from Epic 2, generation-safe identity,
filtered snapshots and one source-art candidate. The
[separate wildlife/art-index draft](https://github.com/lbeezr/thousand-unit-skirmish/pull/21)
defines the first Bellweather Sheep proposal; it is not integrated gameplay.

| Story | Incremental PR outcome |
| --- | --- |
| 4.1 | Define four distinct roles: tame/herd, hunt/flee, hostile/retaliate and decorative. Admit only Sheep to the first playable slice; other roles remain bounded contracts. |
| 4.2 | Ship visible claim, selection, slow movement/Stop, pasture wandering limits and blocked-route feedback. Cap active animals/path work per map; do not use hidden state for targeting. |
| 4.3 | Ship one harvest/death-to-carcass transition, conserved food stock, gatherer access, existing cargo/drop-offs, depletion and a clear exhausted target. |
| 4.4 | Add biome counts, Map Studio serialization, AI observation/actions and checkpoint/reconnect/rematch coverage; verify contention and duplicate-death rejection. |

**Acceptance:** two seats see a single authoritative claim result and resource
pool; explicit gather removes the living animal once; carrying/deposits conserve
stock; interruption, death, blocked routes, fog, recovery and reset retain correct
state; decorative creatures never become hidden blockers or income. **Risks:**
claim-order bias, abuse of livestock as scouts/blockers, hostile chase explosions,
carcass duplication, and assuming hunt behavior is just a sheep reskin.

## Epic 5 — Economy expansion decision experiment

**Outcome:** decide whether another currency earns its UI/AI/content cost.
**Dependencies:** reliable Epics 1–2 diagnostics and a food/wood control match.
Implement no new currency until the user explicitly chooses the experiment.

| Story | Incremental PR outcome |
| --- | --- |
| 5.1 | Compare unchanged food/wood, stone plus one physical metal, and stone with separate gold/copper roles. Specify a consequential spend/expansion choice for each extra resource and reject redundant roles. |
| 5.2 | After an explicit decision, prototype one small map/roster variant behind an opt-in rule profile, preserving the ordinary baseline. Use existing producers before proposing Castle/Blacksmith buildings. |
| 5.3 | Complete typed costs, bank/cargo/drop-offs, HUD/tooltips/icons, command validation, filtered AI budget policy, map import diagnostics, checkpoint migration and old-client/map handling. |
| 5.4 | Run paired control/candidate matches with fixed seeds and mirrored seats; record timing, expansion decisions, starvation/deadlocks, novice errors and recovery. Decide adopt/revise/remove. |

**Acceptance:** a written decision names each resource's distinct purpose and
costs; prototype can be disabled without losing old saves/maps; no unsupported
cost is silently ignored; AI and humans can complete the same progression;
players explain the added decision rather than only another stock bar. **Risks:**
currency inflation, artificial technology gating, reserve deadlocks, permanent
UI complexity and lore material names accidentally becoming currencies.

## Epic 6 — Mature-settlement and composition fixtures

**Outcome:** test economy/routes under a real developed RTS settlement.
**Dependencies:** Epics 1–2, current lifecycle/research rules; wildlife may join
later. Existing schema does not author arbitrary prebuilt settlements.

| Story | Incremental PR outcome |
| --- | --- |
| 6.1 | Build a paid setup harness: per seat a starting Town Center plus paid expansion, Storehouse, Houses, Barracks, Range, Stable, Watchtower and Workshop, with registry prerequisites/upgrades and a declared fixture bank. |
| 6.2 | Save/reset a versioned resulting checkpoint or add an explicitly validated scenario-initialization format. Preserve unit/building identity, queues, cargo, research and all map clocks. |
| 6.3 | Add mirrored mature fixtures and an intentional asymmetric constrained-resource fixture, with mixed current unit types, congestion, siege and alternate expansion choices. |
| 6.4 | Exercise production exits, repair/research/depletion, disconnect/recovery, elimination, objective victory and rematch; publish exact setup ledger and replay steps. |

**Acceptance:** construction and research payments reconcile against current
registry costs; every placed entity is a real type; Workshop/Siege prerequisites
are satisfied; both seat/order arrangements finish the same scripted loop;
checkpoint reload and clean reset recreate the named fixture. **Risks:** secretly
free setup, fabricated building types, unsupported map fields, prefilled queues
that bypass constraints, and a showcase concealing crowded movement failure.

## Epic 7 — Environmental readability and density cost

**Outcome:** dense, attractive habitat preserves confident control.
**Dependencies:** representative Epic 2/4/6 fixtures and the
[renderer contract](renderer-state-contract.md) / [measured camera](art-direction/environment-camera-v1/README.md).

| Story | Incremental PR outcome |
| --- | --- |
| 7.1 | Calibrate one environment family beside real Workers/buildings: scale, camera, root/pivot, alpha bounds, depth and selection bounds. |
| 7.2 | Correct occlusion/fog and source-state/depletion selection in an actual grove/river/pasture view; keep hover/target meaning clear under canopy. |
| 7.3 | Add staged density/LOD controls and measure simulation, renderer and network cost separately; retain a lower-density fallback. |

**Acceptance:** identified loaded hashes and native-scale ordinary 0.91 / strategic
0.48 captures show truthful resource targets, foot/ground contact and readable
ownership; simple identification trials record mistakes; density comparisons use
named hardware, seed, viewport/DPR and workload. **Risks:** painting hides collision,
alpha bounds distort body scale, eye-catching detail overwhelms commands, and
offscreen/static previews get treated as live performance proof.

## Epic 8 — Biome production kits and visible art history

**Outcome:** one cohesive biome is reusable, with its artistic evolution visible.
**Dependencies:** [regional kits](regional-environment-kits.md), selected zone
images and Epic 7 calibration. Work can begin alongside schema/map diagnostics.

| Story | Incremental PR outcome |
| --- | --- |
| 8.1 | Inventory tracked references, prompts, source IDs, rejected iterations and Mac-only gaps. Extend the art-process wiki from [the preservation draft](https://github.com/lbeezr/thousand-unit-skirmish/pull/21), retaining before/after sources. |
| 8.2 | Produce/admit one Bellweather family with compatible ground, trees, resource vegetation, stone/banks and a bounded animal source; keep harvested states distinct from directional views. |
| 8.3 | Integrate one versioned kit with hashes/manifests and a compatible missing-file fallback; prove it in the coherent ecosystem/mature fixture. |
| 8.4 | Expand one region at a time, beginning with a contrasting Underbough kit; keep Ru’Lora fringe/interior separate and record each region's missing species/states. |

**Acceptance:** each admitted output has reviewed provenance, exact prompt/input
roles where available, version filename, checksum and wiki link; rejected attempts
remain findable; chosen views/states correspond to real source coverage; one
loaded landscape passes Epic 7 checks. **Risks:** missing originals, accidental
private-story publication, unverified licenses, large duplicated binaries,
regional mismatch and treating a generated painting as runtime completion.
No Meshy, paid generation or external asset reuse is authorized by this plan.

## Epic 9 — Balance, performance, accessibility and regressions

**Outcome:** improvements survive real play and stay affordable at scale.
**Dependencies:** accompanies every epic; broader milestone proof uses the
combined candidate and the [testing guide](testing.md).

| Story | Incremental PR outcome |
| --- | --- |
| 9.1 | Add fixed-seed baseline/candidate regressions for budgets, routes, cargo conservation, contention, depletion and checkpoint/reset. Require no hidden-state AI shortcuts. |
| 9.2 | Run unassisted solo and two-seat sessions; record expansion/escort decisions, interruptions, resource recognition, keyboard/label usability and color-independent ownership cues. |
| 9.3 | Measure the combined ecosystem at 250/500/1,000 and diagnostic 2,000 total units with explicit wildlife/prop counts, hardware and order/planner/client/network budgets. |
| 9.4 | Fix the first observed blocking defect, replay its scenario and publish a dated acceptance/limits record; retain the old result as history. |

**Acceptance:** scoped regression checks and required PR CI pass; observed human
decisions and identification errors are documented; new density does not exceed
chosen budgets; recovery/rematch is repeated on the integrated build. A failed
2,000 case is reported diagnostically, never promoted to a capacity claim.
**Risks:** flaky timing tests, synthetic-only acceptance, inaccessible icon-only
feedback, hardware drift and tuning several variables without a control.

## Evidence milestones and dependency order

| Milestone | Required evidence, rather than an invented date |
| --- | --- |
| M-E1: coherent Millrace ecosystem | Epics 1–2 and a bounded 7/8 art slice: seed/stock/access report, native runtime resource/depletion captures, both-seat deposited-stock runs and one complete match. Existing food/wood remains enough. |
| M-E2: reusable editor and wildlife vertical slice | Epic 3 author/export/undo/load proof and Epic 4 Sheep claim/move/harvest/recovery/rematch proof on an authored map; one uncoached author/player observation. |
| M-E3: polished biome and mature scenario | Epic 6 paid current-roster fixture, one completed Epic 8 kit, Epic 7 recognition/density evidence and Epic 9 real-match/accessibility results on the integrated build. |
| M-E4: regional kit expansion | A contrasting second region repeats the same contracts/authoring/runtime proofs before more kits; remaining regions advance as individually bounded source/integration slices. |

Epic 5 produces a decision record alongside these milestones. Currency adoption
is conditional and does not block the food/wood milestones. Each milestone names
exact build, assets, map, seeds, seats and observed limits. Authors may merge
useful scoped PRs before a whole milestone is proven; these are product-evidence
targets, not new publication holds.

## Decision register — recommendations to review

| ID | Decision and recommended default | Evidence needed / decision boundary |
| --- | --- | --- |
| D1 | Keep food/wood for M-E1/M-E2; separate simulation resource from biome/visual species. | Legacy-map parity and diagnostics; no currency is implied by schema metadata. |
| D2 | Equal reachable opening budgets for competitive symmetric maps; declare asymmetric intent separately. | Both-seat trip/throughput, frontage and actual matches before approving tolerances. |
| D3 | Sheep as first tame/herd creature; explicit claim/harvest, finite stock, bounded movement; postpone breeding/decay and other species behavior. | Two-seat conservation and control observations; draft Sheep stock/gatherer cap remain trial values. |
| D4 | Evaluate stone plus one physical metal before separate gold/copper; leave both absent until an explicit user decision. | Distinct spend/expansion roles, control/candidate matches, UI/AI/save cost and migration plan. Gold as payment and copper as material would need different uses; names alone add no choice. |
| D5 | Build mature fixtures through paid current commands first; adopt initialization schema only if repeatable setup needs it. | Setup-time/ledger and reset/recovery results; no pretend Castle/Blacksmith. |
| D6 | Polish Bellweather, then contrasting Underbough; preserve all generated revisions and selection reasons. | Runtime source coverage and local recovery audit before deleting unseen artwork. |
| D7 | Set hardware, workload and player-facing budgets before a supported-scale claim. | Controlled combined measurements; current defaults/numeric capacity are not a new promise. |

Record resolution with date, owner, rationale, candidate/control evidence and
dependent docs. Update the game bible only when product intent is actually
adopted; update map/schema/QA guides as each implementation lands.

## Two-worker ownership and integration

At most **two project workers** run concurrently. Use isolated branches/worktrees
and focused PRs; do not spawn a third review/CI/producer queue.

| Worker | Primary slices and files | Shared-file boundary |
| --- | --- | --- |
| A — map/economy/editor | Epics 1–3, approved 5 and 6; `src/map-utils.mjs`, `src/landscape-authoring.mjs`, map generators/JSON, diagnostics, editor/AI economy tests and map guides. | Own shared resource/map serialization patches. Keep placement changes out of the wildlife art/design PR. |
| B — wildlife/art | Epics 4, 7 and 8; a bounded wildlife module/contract, wildlife tests, renderer/asset bindings, versioned art packs, ecology/design and wiki archive. | Own wildlife simulation/state patches after a resource/entity interface is agreed. Do not independently rewrite resource placement or currency rules. |

Both `server.mjs` and `src/main.js` are integration surfaces, not exclusive files.
Before dependent edits, agree the smallest typed interface and name the patch
owner for the shared section. Prefer isolated helpers and atomic adapters over
two simultaneous broad rewrites. The second worker progresses on independent
source art, diagnostics or tests while a shared boundary lands. Epic 9 is owned
within each author's slice; Worker A owns the combined map fixture, with B's
asset/state evidence linked once.

Under [AGENTS.md](../AGENTS.md) and standing staging authorization, each author
owns review, proportionate checks, required CI, conflicts, merge through repository
protections and postmerge verification. The parent is not a merge bottleneck.
Draft deliverables remain draft when explicitly requested. This plan grants no
new spend, app/account permissions, protection bypass, deployments or credentials.
Do not publish private manuscripts; do not delete Mac artwork/dirty worktrees
because the cloud cannot see them. Record actual blockers with their owner and
next step; ordinary uncertainty is not an approval queue.

## Research register and transfer limits

These primary references inform proposals; none proves a feature is implemented
in this repository. Existing [openage research](references/openage-study.md),
[Warcraft inventory](references/warcraft-rts-inventory.md) and
[RTS coverage](references/feature-coverage-inventory.md) retain broader context.

| Reference, checked 2 October 2026 | Supported lesson and boundary |
| --- | --- |
| [AoE II official resource lessons](https://www.ageofempires.com/learn-to-play/control-resources-aoe2/) | Distinguish herdable, aggressive hunt, wild hunt and other food access; resource/drop-off roles create choices. This is **II**, not a universal rule for all Age games; this plan's Worker-only claim is a project proposal. |
| [AoE IV official quickstart](https://www.ageofempires.com/news/quickstart-guide-age-of-empires-iv/) | IV names food, wood, gold and stone in its basic economy. Its progression/content must be evaluated separately from II. |
| [AoE III official support resource names](https://support.ageofempires.com/hc/en-us/articles/24960667788948-Age-of-Empires-III-Definitive-Edition-Cheat-Codes) | III names food, wood and coin, alongside other game-specific stocks. This support list establishes names, not balanced rates or a recipe to import III's economy into this game. |
| [openage ability API](https://github.com/SFTtech/openage/blob/master/doc/nyan/api_reference/reference_ability.md) | Separate Gather, Harvestable/stock/activation/gatherer limits, DropSite, Herd/Herdable and Restock. An API contract is not finished-runtime proof. |
| [Archived official 0 A.D. StartingAnimal placement](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/maps/random/rmgen-common/player.js) | Group counts, spacing/distance, constraints and bounded attempts motivate reproducible placement. The GitHub archive is not current Wildfire Gitea behavior; no current upstream validation is claimed. |
| [Blizzard Warcraft III resource guide](https://classic.battle.net/war3/basics/resources.shtml) | Expansion exposure, mine exhaustion feedback and differing collection/drop-off methods affect decisions. Warcraft's gold/lumber/upkeep is its own economy, not a mandate for ours. |
| [Blizzard classic StarCraft resource guide](https://classic.battle.net/scc/GS/res.shtml) | Worker saturation, trip distance and resource-center placement distinguish supply from delivered throughput. These classic rules/numbers are not SCII or this game's current gatherer model. |
| [Official Civilization VI manual, Resources](https://downloads.2kgames.com/civilization/vi/manuals/eu/CIV_VI_25TH_ONLINE_MANUAL_ENG.pdf) | Bonus, strategic and luxury are distinct categories; use the distinction to ask whether an ingredient provides yield, gates production or serves another role. The indexed manual passage was available; full 22,014,533-byte PDF retrieval exceeded the web reader limit. This turn-based reference is not RTS pacing or later-expansion verification. |

Read source/license terms before any code, texture, model or sound reuse.
This plan paraphrases design lessons and links references; it imports no external
assets/code. Official guides do not license their artwork, and available source
does not erase attribution or license obligations. New Vaelora visuals need
their own provenance and preserved iterations, as specified in Epic 8.
