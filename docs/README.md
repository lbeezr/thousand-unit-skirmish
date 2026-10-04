# Documentation

Start with the task you want to do. The root [README](../README.md) is the quick
start; this index covers maintained guides, contracts, experiments, and evidence.

## Which document answers which question?

| Question | Owning document |
| --- | --- |
| What experience are we building, and what is outside scope? | [Game bible](game-bible.md) |
| What outcome should we pursue next? | [Roadmap](roadmap.md) |
| How many planning queues exist, and are they advancing? | [Planning inventory](#planning-inventory--4-october-2026) |
| What evidence supports a product claim? | [QA plan](qa-vertical-slice.md) |
| How do we choose tests, qualify cloud rendering and close verification? | [Testing strategy](testing-strategy.md) |
| How should the game look and read? | [Art direction](art-direction-contract-v1.md) |
| What are Vaelora’s selected zone maps and ecology keys? | [Art checkpoint](art-direction/vaelora-v1/README.md) |
| Where do I read and extend Vaelora's lore? | [Lore wiki](lore/README.md): world, regions, peoples, institutions, history and magic |
| Where are saved art iterations and preservation gaps? | [Art evolution](lore/art-evolution.md) |
| Which new art is bound, and what supplies depth, motion and atmosphere? | [Building/environment runtime audit](art-runtime-audit-2026-10-03.md) |
| What informs Vaelora's prose, continuity and world-building plan? | [Voice bible](lore-voice-bible.md), [research](lore-research.md), [strategy and plan](lore-strategy.md) |
| Where is the first reviewable lore foundation? | [L1 writing package](lore-foundation-m1.md): principles, history, settlements, institutions and calibration fiction |
| Who carries an art outcome through delivery? | [Art lanes](art-production-lanes.md) |
| What art is still absent from normal play or unverified on the user build? | [Asset adoption checklist](asset-adoption-checklist.md) |
| How do we split work without losing integration ownership? | [Contributor planning](contributor-planning.md), [PR checklist](../.github/pull_request_template.md) |
| How do contributors coordinate and integrate? | [AGENTS.md](../AGENTS.md) |
| What does the implementation currently do? | Task guides and contracts, checked against source |

Change the owning document when a decision changes, then update affected links
and summaries. Resolve a disagreement with source for present behavior, the game
bible for product intent, and AGENTS.md for working rules. Record a planned change
as a proposal until it is implemented. Dated evidence and archives describe only
the build they name.

## Play and operate

| Task | Guide |
| --- | --- |
| Install, run locally, host on LAN, troubleshoot | [Local setup](getting-started.md) |
| Learn controls, economy, objectives, and rematches | [Player guide](playing.md) |
| Start a fresh game, join a room, or explicitly resume a saved seat | [Main menu entry](game-entry.md) |
| Create a PvP lobby, ready and launch; inspect its protocol | [Pregame rooms](room-lobby.md) |
| Reproduce a solo match | [Play vs AI](play-vs-ai.md) |
| Find server defaults and limits | [Configuration](configuration.md) |
| Package, deploy, recover, and back up | [Deployment](deployment.md) |

## Develop and test

| Task | Guide |
| --- | --- |
| Understand runtime boundaries and files | [Architecture](architecture.md) |
| Run focused checks, browser scenarios, or measurements | [Testing](testing.md) |
| Reuse deterministic test lanes, record evidence and prioritize missing automation | [Testing strategy and execution contract](testing-strategy.md) |
| Change commands, snapshots, or bot observations | [Gameplay contract](gameplay-command-observation-contract.md) |
| Understand missing Stone/gold/copper and the next integration contract | [Mineral readiness audit](mineral-economy-readiness.md) |
| Understand overload behavior | [Simulation timing](simulation-timing.md) |
| Follow the ranked movement/pathing backlog and shared write boundaries | [Movement workstream](movement-pathing-workstream.md) |
| Verify deterministic planning turns, large routes and native recovery | [Planning work QA](qa-move-planning-work-2026-10-03.md) |
| Compare opt-in planning turns per tick while retaining default scheduling | [Tick budget experiment](qa-move-planning-tick-budget-2026-10-04.md) |
| Qualify the complete paid battle tick budget and understand the retained callback default | [Paid battle tick qualification](qa-paid-battle-tick-budget-2026-10-04.md) |
| Compare callback/four whole ticks and inspect private payload, allocation and vision costs | [Tick cost attribution](qa-tick-cost-attribution-2026-10-04.md) |
| Inspect the measured snapshot base-row allocation change and exact wire regressions | [Snapshot row allocation](qa-snapshot-row-allocation-2026-10-04.md) |
| Understand the remaining maximum-tick tail and rejected zero-separation probe | [Remaining tick tail](qa-remaining-tick-tail-2026-10-04.md) |
| Understand forced open-ground turns and their relation to screen headings | [Direct open-ground Move](qa-direct-open-ground-move-2026-10-04.md) |
| Check displacement-driven sprite clocks, UV advancement and real atlas-cell differences without a browser | [CPU animation integration](qa-unit-displacement-animation-2026-10-04.md) |
| Verify route progress through a parked army and preserved Stop intent | [Crowd forward-progress QA](qa-crowd-forward-progress-2026-10-03.md) |
| Author and validate scenario JSON | [Map authoring](map-authoring.md) |
| Work on connected walls and explicit manual gates | [Palisade runtime](palisade-runtime.md), [gates](palisade-gates.md) |
| Inspect isolated water routes before dock/boat integration | [Water navigation foundation](water-navigation-foundation.md) |
| Place Dock foundations and inspect their land/water berth contract | [Dock shoreline foundation](dock-shoreline-foundation.md) |
| Produce a provisional Skiff, move on water, and inspect queue/recovery rules | [Skiff water movement](skiff-water-movement.md) |
| Gather shared finite fish food with Skiffs and deliver at owned Dock berths | [Skiff fishing cargo](skiff-fishing.md) |
| Move/fish/Return exactly selected boat groups with per-boat cargo and goals | [Selected Skiff groups](skiff-selected-groups.md) |
| Queue selected Skiff water destinations from the battlefield or minimap | [Skiff water waypoints](skiff-water-waypoints.md) |
| Finish one Skiff fishing load before its queued Move | [Fishing before the next Skiff Move](skiff-fishing-next-move.md) |
| Verify Dock/Skiff through the normal game | [Ordinary entry and pending deployed acceptance](qa-skiff-normal-entry-2026-10-03.md) |
| Choose the next justified naval gameplay task | [Ranked naval workstream and execution dependencies](naval-workstream.md) |
| Choose a map | [Catalog](maps.md), [Forked Vale](forked-vale-scenario.md), [Three Crowns](three-crowns-layout.md) |
| Change the compact objective HUD | [Objective behavior and validation](battlefield-objectives-validation.md) |
| Change owned population feedback | [Population header behavior and validation](population-header-validation.md) |
| Change selection-dependent command visibility | [Contextual HUD behavior and validation](contextual-hud-validation.md) |
| Continue the compact HUD and controls lane | [Ranked HUD backlog and interfaces](hud-controls-backlog.md) |
| Add selected-unit portraits or connect future field notes | [Worker HUD art and integration contract](hud-art-integration.md) |
| Change cues or captions | [Audio design](audio-design.md) |
| Design each command, notice, alert and result sound | [UI sound direction](ui-audio-direction.md) |
| Produce reusable effects and music | [Audio kit plan](audio-kit-plan.md) |
| Plan Vaelora regional music, ambience and generation requests | [Zone audio plan](vaelora-zone-audio-plan.md) |
| Build Audio Studio and sampled playback | [Audio Studio implementation](audio-studio-implementation-plan.md) |
| Audition every Vaelora zone | [All-zone source pack](../assets/audio/vaelora-zones-v1/README.md), [milestone evidence](qa-zone-audio-2026-09-30.md) |

## Product and experiments

- [Game bible](game-bible.md): product promise, design principles, quality floor, scope.
- [Roadmap](roadmap.md): next outcomes and milestone evidence.
- [Maps and resourcing saga](maps-resourcing-saga-plan.md): verified economy baseline, nine scoped epics, ecosystem milestones, decisions and two-worker boundaries.
- [Custom-skirmish milestone](custom-skirmish-milestone-plan.md): three parallel lanes for tactical orders, visual scenario authoring and shared audio feedback, with a combined match proof.
- [Custom-skirmish evidence](qa-custom-skirmish.md): current acceptance audit, combined scenario checks and scale evidence limits.
- [Gameplay foundation plan](gameplay-foundation-plan.md): extensible roster, base development, combat/progression, and presentation/variant milestones.
- [Core match tranche](core-playtest-tranche.md): next human session, observation record, and proposed scale profile.
- [Balance](first-skirmish-balance.md): current no-tune baseline and next observations.
- [Victory audit and mode proposal](victory-modes-audit-2026-10-03.md): exact authored victories, recoverable base defeat, and separate Skirmish/custom-inspired directions.
- [Mode contract](match-mode-contract.md) and [playable-modes backlog](playable-modes-backlog.md): shared versioned identity, map/lobby/AI boundaries and ranked incremental acceptance.
- [Mill depot simulation](qa-mill-depot-economy-2026-10-03.md): paid travel comparisons and separate currency tradeoffs; [finite Farm contract](farm-finite-planting.md) and [Farm QA](qa-finite-farm-2026-10-03.md): provisional paid planting, stock, cancellation and recovery. The [earlier proposal](farm-capability-proposal.md) preserves its design history.
- [Provisional Stone contract](stone-defense-contract-proposal.md): one optional Watchtower sink, finite budget and preserved legacy prices; implementation remains pending.
- [Stone runtime interface](stone-runtime-interface.md): explicit profile selector, typed price/refund helpers and map/runtime ownership; live admission remains closed.

- [QA and external playtests](qa-vertical-slice.md): acceptance and repeatable protocol.
- [Map scale](map-scale-density.md), [living land](living-land-experiment.md), and
  [harvestable woodland](harvestable-woodland-pilot.md): implemented slices and proposed follow-ups.
- [Model-opponent research](model-controlled-opponent-research.md): default-off fake-provider boundary.

## Planning inventory — 4 October 2026

At source `53a47ee379660f30b65776ea813f3a986d29aa37`, this bounded inventory has
**23 canonical planning surfaces: one product roadmap, 16 execution/acceptance
queues, and six umbrella or production plans**. Count one owning guide per
continuing workstream or major multi-slice outcome with remaining work, including
paused/blocked proposals. Do not count its epics, feature contracts, dated QA,
individual PRs or historical archives again. This is **not 23 active workers or
23 approved unfinished projects**. Other feature-specific proposals remain
reachable from the task index; this count is the explicitly listed portfolio,
not a filename search for every use of “plan.”

The [roadmap](roadmap.md) is the one product priority source, owned by the
coordinating parent. Its current direction is dependable RTS matches and one
complete faction; linked implementation/acceptance queues supply the work.
Owner names below are the roles recorded in their guides, not verified current
worker liveness. “Open” means incomplete in that record; a source merge, a tool
pass and a deployed/human acceptance result are different evidence.

| Execution/acceptance queue (16) | Recorded owner | Progress and concrete next step at this audit |
| --- | --- | --- |
| [Playable modes](playable-modes-backlog.md) | Mode runtime; entry and delivery owners for their boundaries | Human Tiny/Small/Medium/Large, Tiny-only PvE and Bannerfall source slices have evidence. Identify a containing served build and finish ordinary match acceptance; no broader AI or territorial mode is approved by this inventory. |
| [Map scale/playability](map-scale-playability-backlog.md) | Map scale owner; mode/entry receivers | Four ordinary tiers and Confluence are authored/admitted; opening compatibility [PR280](https://github.com/lbeezr/thousand-unit-skirmish/pull/280) is merged. Next: representative paid play/capacity proof; XL remains a separate runtime proposal. Some candidate labels in older rows lag the closing aggregate paragraph. |
| [Movement/pathing](movement-pathing-workstream.md) | Movement owner | Planning/crowd [PR193](https://github.com/lbeezr/thousand-unit-skirmish/pull/193)/[PR209](https://github.com/lbeezr/thousand-unit-skirmish/pull/209), allocation [PR259](https://github.com/lbeezr/thousand-unit-skirmish/pull/259), and direct Move [PR285](https://github.com/lbeezr/thousand-unit-skirmish/pull/285) are merged. The queue predates PR285: reconcile that evidence; rendered 2,000-unit acceptance stays open and callback scheduling remains default. |
| [Combat/stances](combat-backlog.md) | Combat owner; HUD/animation consumers | Four stances and target-continuation corrections are integrated. Next: containing-build normal controls/damage/recovery proof, or a reproduced command failure. Attack appearance remains the animation owner's acceptance; this is not evidence of an unimplemented stance system. |
| [Opponent AI](pve-policy-backlog.md) | Opponent AI owner; mode receiver | Tiny policy/replay/process evidence and progress-retention [PR281](https://github.com/lbeezr/thousand-unit-skirmish/pull/281) are merged. Queue still discusses PR255 integration as pending: refresh it against history. Next: identified served Tiny PvE proof; larger-map AI remains unqualified. |
| [Economy/content](economy-content-workstream.md) | Economy/content owner | Worker action receipts and paid Farm/Stone measurements shipped. [PR283](https://github.com/lbeezr/thousand-unit-skirmish/pull/283) is an open draft for the reported wood-job continuation gap; next is coordinated job-record integration and paid recovery evidence. Existing ledger does not yet describe that draft. |
| [Naval gameplay](naval-workstream.md) | Fishing/naval owner; delivery receiver | Paid Skiff movement/fishing/counterflow have source/process evidence including [PR260](https://github.com/lbeezr/thousand-unit-skirmish/pull/260). Next: normal Confluence input, opposing crossings, cargo and recovery on a containing build. Reported proxy/browser failures block that lane's actual play acceptance. |
| [HUD/controls](hud-controls-backlog.md) | HUD integration owner | Glyphs, keyboard/stance controls and selection-availability corrections have focused evidence. Next: ordinary selection/producer/focus/recovery proof and capture a concrete completed-Range failure if it persists. Dense/subtle/dismissible direction remains; old redesign concepts are held. |
| [Architecture/organization](architecture.md#continuing-boundary-workstream) | Architecture boundary owner; parent routes overlap | Import/cycle/served guards and four nested modules exist. This audit replaces the exhausted leaf backlog with eight scoped candidates. Next: review the guard scope, then assign an unconflicted migration; no runtime migration has started in this plan update. |
| [Code extraction](code-extraction-backlog.md) | Code extraction owner | Audio reader/action rules/frame/deflate seams shipped with focused contracts. Retained transport/audio runtime acceptance is open. Broader file migrations belong to Architecture above; do not restart a duplicate extraction program here. |
| [Error boundaries](code-quality-error-boundaries.md) | Error-handling owner | Capture/audio/validator recovery fixes and exact evidence exist; the source queue reports no further reproduced candidate after PR190. Next: update any integration-tracked status from its PR and finish Audio Studio retry/import observation when browser/build dependencies exist. |
| [Testing/types](testing.md) | Testing-strategy owner `01a103db-7bbd` | Runtime guards, strict JS/Node boundaries and registered suites exist. Owner is revising strategy/AGENTS per the current task; its unpublished result is unknown here. Next: reconcile its concrete checks/discovery with this migration plan without duplicate package/CI edits. |
| [Asset adoption and terrain backlog](asset-adoption-checklist.md) | Each asset's retained implementation owner | Default building/environment/unit/audio bindings have source/release evidence; several user-build/appearance steps remain open. Next: reconcile the dated deployment/Stone/character rows against current source and exact containing receipts. This is the aggregate delivery ledger, not another independent art roadmap. |
| [Human foot-unit coverage](human-foot-unit-coverage.md) | Human art lane; animation-state receiver | Identity restoration [PR286](https://github.com/lbeezr/thousand-unit-skirmish/pull/286) is merged; different-identity Archer/Spearman PR230/241 remain held drafts. Next: established-character directional pilot and actual motion proof. CPU displacement diagnostic [PR287](https://github.com/lbeezr/thousand-unit-skirmish/pull/287) is an open draft, not a browser result or replacement art. |
| [Coastal/barrier art](coastal-barrier-art-workstream.md) | Coastal technical-art owner | Private Skiff readiness and barrier reference fit are documented. Skiff publication/default art depends on its existing visual/publication condition; barrier Complete/gate production is separate. Execution/publication remains blocked where that guide says so; this index releases neither hold. |
| [Runtime audio backlog](audio-runtime-packs.md#ranked-audio-backlog) | Audio owner | Shipped regional references, shared decode and synthesized interruption fixes have source evidence. Next: existing-source listening/mute/loop proof; mix or binding changes follow an actual heard defect/accepted audition. No paid production is scheduled here. |

| Umbrella/production plan (6) | Owner/status and useful next action |
| --- | --- |
| [Gameplay foundation F1–F4](gameplay-foundation-plan.md) | Foundation/integration owner: F1–F3 are integrated with explicit completion evidence; F4's interchangeability/variant/scale proof is incomplete. Use the existing rule/presentation owners for a bounded proof; do not reopen completed F1–F3 from older audit rows. |
| [Core playtest tranche](core-playtest-tranche.md) | Coordinating playtest owner: prepared human-session and scale protocol, with [dated tranche evidence](qa-core-tranche-2026-09-29.md). Next: identified build and unassisted human sessions; no fresh human completion is verified by this audit. |
| [Maps/resourcing saga: nine epics](maps-resourcing-saga-plan.md) | Historical map/economy and wildlife/art lanes; current active assignments are not established by that proposal. Its 2 October baseline remains historical, while Stone/Farm/wildlife have since advanced in their owning guides. Next: reconcile accepted epic slices and unresolved decisions, not execute all nine epics as approved work. |
| [Regional environment kits](regional-environment-kits.md) | Environment/vegetation owners: substantial Underbough/plant/canopy slices are documented; full roster and whole-kit appearance remain incomplete. Next: one justified missing state/direction or identified whole-kit observation; keep candidates and dated source studies distinct from current defaults. |
| [Building atlas production](building-atlas-production-plan.md) | Building art owner: calibrated Complete families and the [Barracks/Range pair](frontier-barracks-range-authoring.md) now have default integrations. The plan's “remaining six Complete families” next step lags source. Refresh the queue toward identity/clearance/lifecycle and actual-game acceptance; new spend remains separately authorized. |
| [Lore strategy/wiki](lore-strategy.md) | Lore author: connected reference wiki exists; next is a small unresolved continuity decision and affected entries. Active executor/PR is unknown here. Scene/campaign applications remain optional, and private prose stays outside the repository. |

Two implementation plans are retained as **completed implementation milestones**,
not counted again above: [Custom skirmish](custom-skirmish-milestone-plan.md)
([combined evidence](qa-custom-skirmish.md), remaining unassisted/scale proof)
and [Audio Studio v1](audio-studio-implementation-plan.md#integrated-checkpoint--29-september-2026)
([evidence](qa-audio-studio-2026-09-29.md), later delivery/retry acceptance owned
by the runtime-audio/error queues). Preserve their original planning baselines.

**Deferred/reference material** is also separate: voice commands (roadmap;
no active spike), [model-opponent research](model-controlled-opponent-research.md)
(default-off fake-provider experiment), [audio kit](audio-kit-plan.md)/
[zone audio](vaelora-zone-audio-plan.md) creative proposals, speculative full
territory/XL/campaign/GLB finish work and historical/reference inventories.
Held art drafts, including [HUD archive PR25](https://github.com/lbeezr/thousand-unit-skirmish/pull/25),
remain held; an index is not publication approval.

There is active source progress: main's recent merges include AI progress281,
Palisade continuation282, walk direction284, direct Move285 and identity286.
However, a few canonical queues still show resolved source items as pending,
and many rows retain delivery/browser/human dependencies. Update the owning
queue after its next slice; use this index to find it rather than append another
status plan. Unknown worker liveness, absent current served receipts and missing
human observations remain unknown. This audit performs no deployment, Mac run,
security change, paid generation or automation change.

## Art and assets

Start with the [asset guide](assets.md), which distinguishes active runtime paths
from source/candidate packs. Then use the relevant contract:

- [Art direction](art-direction-contract-v1.md) and [production lanes](art-production-lanes.md).
- [Wildlife draft](wildlife-bellweather-sheep.md): inspected regional fauna, one Sheep proposal, behavior, habitat and future perspective/sprite coverage.
- [Asset angle-reference standard](asset-angle-reference-standard.md): labeled rotations appropriate to asset type, verified runtime yaw/camera mapping, scale/root acceptance and angle-specific sprite-source provenance.
- [Sheep model-reference pilot](bellweather-sheep-model-reference-pilot.md): preserved 2 October input and static-capture contracts; private model and later runtime adoption remain separate.
- [Default low-bank shade](qa-shore-bank-shade-2026-10-03.md): contour-following land value cue, bounded geometry and preserved before/after CPU studies with native-render limits.
- [Renderer state/GLB/environment contract](renderer-state-contract.md).
- [Finished Frontier runtime](frontier-building-runtime.md): all six default finished building families, state fallback, packaging, shared depth/texture ownership and open normal-match QA.
- [Ordinary-game building acceptance](qa-frontier-building-adoption.md): exact paid maps/sites, selected/hover/team semantics and pending deployed Mac coverage owned by the building workstream.
- [Barracks and Archery Range replacement](frontier-barracks-range-authoring.md): inspected new concepts versus old default sprites, precise production gaps and retained ownership through default gameplay verification.
- [Water surface and fish cues](water-surface-study.md): default apparent depth and directional motion, live visibility-gated shore-fish activity, static quality and reduced motion.
- [Native water first-pass review](qa-water-surface-native-2026-10-03.md): Mac shader/appearance results, saved image provenance, resolved fallback comparison and remaining visual limits.
- [Sprite-atlas format](sprite-atlas-contract-v1.md).
- [Generated strip adoption](sprite-strip-adoption-contract.md): shared scale/ground anchors, exact color/mask seed lock, explicit timing and reviewed helper boundaries.
- [Worker performing-action v1](worker-performing-action-contract.md): authoritative positive-progress receipt, wire privacy/lifetime, producer acceptance and remaining animation delivery.
- [Economy/content workstream](economy-content-workstream.md): ranked bounded outcomes, write scopes, dependencies and delivery ledger.
- [Worker fishing pilot](worker-fishing-animation.md): private crouched hand-net study, exact-heading default integration and unchanged food authority.
- [First civilization style](frontier-civilization-art-style.md) and [illustrated architecture wiki](lore/frontier-architecture.md).
- [Building atlas production plan](building-atlas-production-plan.md): roster, references, scale and generation order.
- [Building model/capture pipeline](building-asset-production-pipeline.md) and
  [direct 2D workflow](building-sprite-production-workflow.md).
- [Frontier Town Center authoring preparation](frontier-town-center-authoring.md): empty Blender state/part collections and verified camera scaffold; source import and lifecycle artwork remain blocked.
- [Unit/building kit](unit-building-art.md) and [GLB finish proposal](unit-building-art-output-proposal.md).
- [Environment library](environment-pack-v1.md), [regional kit production](regional-environment-kits.md), and [interactive states](environment-state-pack-v1.md).
- [Terrain candidate readiness](terrain-candidate-readiness.md): read-only resource pixel checks, inspected cliff limits and the [ranked terrain backlog](asset-adoption-checklist.md#terrain-workstream-backlog).
- [Generic oak depletion adoption](qa-oak-depletion-atlas-adoption.md): default state atlas, payload/runtime cost and retained deployment/game acceptance.
- [Cursor/icon contract](ui-cursor-icon-contract.md).
- [Asset directory index](../assets/README.md) for individual pack READMEs and provenance.

## Research and evidence

- [RTS coverage](references/feature-coverage-inventory.md),
  [Openage study](references/openage-study.md), [Warcraft study](references/warcraft-rts-inventory.md).
- QA checkpoints: [25 September](qa-checkpoint-2026-09-25.md),
  [26 September](qa-checkpoint-2026-09-26.md).
- [Performance baseline, 25 September](performance-reliability-baseline-2026-09-25.md).
- [Environment runtime pilot](qa-evidence/environment-state-pack-v1/pilot/README.md).
- [Technical-art checkpoint](technical-art-surfacing-checkpoint-2026-09-26.md).
- [Building sprite body occlusion](qa-building-sprite-occlusion-2026-10-03.md):
  shared-art depth pass, source alpha evidence, draw bound and pending native observation.
- [Native building occlusion comparison](qa-building-occlusion-native-plan-2026-10-03.md):
  crowded paired fixture, 128/129 boundary tests, actual draw/GPU counters and exact Mac recipe; native results pending.
- [Historical archive](archive/README.md): original measurements, ledgers, and prototype history.

## Keep these docs useful

- Put instructions in the guide for that task; link to them instead of copying them.
- Keep runtime claims tied to code. A generated asset is not necessarily integrated.
- Keep proposals explicit. A milestone needs its stated evidence, not a feature count.
- Record measurements once with build, conditions, result, and limitations.
- Preserve exact prompts, source IDs, hashes, and provenance; they are factual records.
- Update manifest/checksum entries if their covered documentation changes.
- Use relative repository links and commands from the repository root unless stated otherwise.
- Run `npm run docs:check` after edits; CI checks local paths and heading anchors.
- Keep the README short. Put detailed schema in contracts and old chronology in the archive.

This rewrite describes source baseline `eef9aa4`. Future changes should update
the owning guide rather than append repeated status to several files. Repository
coordination rules remain in [AGENTS.md](../AGENTS.md).
