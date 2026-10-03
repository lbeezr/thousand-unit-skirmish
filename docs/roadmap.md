# Roadmap

[Documentation index](README.md) · [Game bible](game-bible.md) · [QA plan](qa-vertical-slice.md)

## Current priority

Build a reusable gameplay foundation and one complete faction. The
[gameplay foundation plan](gameplay-foundation-plan.md) defines the implementation
sequence and acceptance criteria. Existing solo/two-seat checks are the regression
floor; expansion of gameplay functionality is the next development outcome.
Art proceeds separately against stable presentation interfaces.

Use the [RTS capability inventory](references/feature-coverage-inventory.md) as
a loose roadmap for further maturity. AoE, openage and Warcraft identify systems
we may match, adapt or improve; prioritize dependable player control, useful
scenario tools and reusable content/feedback interfaces. Select concrete outcomes
from the inventory rather than treating comprehensive parity or its proposed
milestone sequence as a prerequisite for progress. Art direction and character
production can develop independently of these engine capabilities.

## Foundation milestones

The [authorized custom-skirmish milestone](custom-skirmish-milestone-plan.md)
is integrated in main `eecc2d0` through [PR #289](https://github.com/lbliii/thousand-unit-skirmish/pull/289):
Patrol/Follow, visual named-region and completion-trigger authoring, and versioned
shipped audio delivery with bounded execution feedback. Combined authoritative
matches prove economy, event chains, combat, recovery, victory and rematch;
the stable hosted author-to-friend browser proof also passes native audio
mute/Stop/reset checks. [Combined QA](qa-custom-skirmish.md) owns exact builds,
deployments, acceptance and limits.

The rendered combined workload passes at 250/500/1,000 units. The diagnostic
2,000 case cannot clear its construction site within the bounded attempt and
never reaches the full workload; crowded movement/placement is a concrete core
follow-up, not a supported capacity claim. Unassisted author and human-pair
observations are still needed for discoverability and listening. Art remains
independent. Authored entity placement/identity and death triggers remain later
candidates from the loose capability inventory.

### Integrated core workstreams — 1 October 2026

These foundations are implemented. Their dated checks establish specific
behaviors; unassisted use, creative acceptance and broader reference parity
remain separate outcomes.

| Workstream | Integrated surface | Evidence and limits |
| --- | --- | --- |
| Army commands | Stop/Hold interruption and stationary defense; two-endpoint Patrol and bounded catch-up Follow, HUD controls and persisted both-seat intent. | [Stationary orders](qa-command-foundations-2026-09-30.md), [persistent orders](qa-persistent-orders-2026-09-30.md) and [combined proof](qa-custom-skirmish.md). Follow does not establish convoy formations; human discoverability remains open. |
| Scenario authoring | Graphical named regions, typed completion conditions, undo/redo, host diagnostics, validated import/export and checkpoint-safe execution. | [Combined authoring audit](qa-custom-skirmish.md#current-acceptance-audit). Arbitrary scripts, entity/death triggers and unassisted authoring remain later work. |
| Unit audio engineering | Lifecycle/food/wood/repair routing, bounded work playback, recovery-safe deduplication and verified versioned shipped delivery. | [Runtime contracts](audio-runtime-packs.md), [import provenance](qa-zone-audio-import-provenance-2026-10-01.md) and [cache accounting](qa-shipped-audio-cache-accounting-2026-10-01.md). Technical checks do not establish listening or cue recognition. |

| Milestone | Observable outcome |
| --- | --- |
| F1 — Extensible roster | Shared validated definitions drive existing rules; a Spearman and House exercise the complete runtime pipeline. |
| F2 — Base development | Population, drop-offs, expansion, defenses and lifecycle rules create dependable economic choices. |
| F3 — Composition and progression | Mounted/scouting and siege roles, counters and a small technology tree work for players and AI. |
| F4 — Presentation and variants | Two visual variants preserve identical simulation; a bounded gameplay variant and mixed-roster scale measurements prove the extension boundaries. |

Registry parity, the second Barracks production option and the initial
presentation binding are implemented; see the
[foundation completion record](gameplay-foundation-plan.md#2026-09-30--f1f3-integrated-completion).

The registry, base lifecycle, mounted roster, bounded research, siege, Scout
reconnaissance, AI counter-slot reservation and contextual HUD slices are
integrated into main. QA records include a full seeded Forked Vale AI match,
both-seat field-role and paid siege interactions, current staging gameplay and
deployed HUD/recovery observations. Live AI base expansion is integrated through PR #252, with all three CI shards
passing. Exact merge `496d387` deployed successfully to staging and passed fresh
packaging and 250-unit gameplay/recovery smoke. F1–F3 and early presentation
binding are complete; continue usability/balance iteration and F4 presentation,
variant and scale proofs. The evidence and its limits are recorded in
[QA](qa-vertical-slice.md).


## First-civilization building art

The [Frontier style kit](frontier-civilization-art-style.md) defines eight coherent Complete building concepts for the [architecture wiki](lore/frontier-architecture.md). Next: calibrate House/Town Center beside Workers, derive registered directions and lifecycle states, and integrate useful building packs progressively. Use the [atlas production plan](building-atlas-production-plan.md) for role coverage and scale targets. Source concepts do not claim runtime replacement.

## Match evidence and continuing checks

Use these observations to evaluate foundation additions. They are continuing
product proofs, not a substitute for implementing the foundation milestones.

1. **Complete and understand a match.** Run the Forked Vale loop in seeded solo
   play and human 1v1. Record the first order, production, objective, result, or
   recovery failure that prevents completion or requires coaching; fix and replay it.
   [Automated staging checks](qa-integrated-core-2026-09-27.md) now cover both-seat
   reconnect, elimination, and rematch at `8b6bcbb`; an unassisted human match
   remains the next product proof.
2. **Verify the integrated battlefield.** Main `eef9aa4` makes Barracks/Range
   sprites the default and adds Town Center collision. Check both teams through
   construction/damage, exits and nearby placement, fog, ordinary/strategic zoom,
   and narrow HUD layouts. Packaged assets are present; current deployed
   appearance now has a [host editor and Ember opening observation](qa-staging-browser-2026-09-27.md)
   at `bcd5fec`; construction/damage, zoom, and narrow-layout checks remain.
3. **Test decisions on representative maps.** Use Forked Vale for opening and
   objective play, then Frontier Reach/Highland Grove for routes, forest access,
   and elevation. Record the decision a player made and the alternative they saw
   before adding more map mechanics or changing balance.
4. **Establish the supported scale.** Agree on the device, hosting, network, and
   player-facing budgets, then measure both seats at increasing loads through
   2,000 total units. Keep simulation, rendering, bandwidth, and order delay as
   separate measurements.
   The [September 27 local combat sample](qa-checkpoint-scale-2026-09-27.md)
   passes its existing simulation/checkpoint limits; it does not establish the
   intended hosting or browser budget.

The current implementation provides these test surfaces. It does not by itself
prove M1–M4 complete. Use the [asset guide](assets.md) for loader status and
[QA records](qa-vertical-slice.md#known-findings-and-historical-evidence) for
observations at earlier builds.

## Milestones

These are product evidence targets. Scoped changes can ship before a whole
milestone is demonstrated. The linked QA records describe evidence at named
builds; they do not certify today's deployment.

| Milestone | Observable outcome | Next proof |
| --- | --- | --- |
| **M1 — Complete invite match** | Two people join Forked Vale, gather, build, produce, contest, agree on the result, reconnect, and rematch. Map Studio saves and reloads the scenario. | A complete unassisted two-seat session on one identified deployed build. |
| **M2 — Readable authored battlefield** | Players distinguish teams, unit roles, resources, objectives, construction, and depletion at normal and strategic zoom. | Representative mixed-role captures on Meadow/Cinder followed by fresh-player identification. |
| **M3 — Dependable large match** | A 2,000-total-unit match meets simulation, browser, network, and recovery budgets on intended hosting hardware. | Comparable hosted two-seat measurements with named hardware/network conditions and agreed limits. |
| **M4 — Useful external playtest** | Two novice pairs finish a match and explain a consequential decision, an alternative, and their main confusion. | The [external protocol](qa-vertical-slice.md#lightweight-external-playtest-protocol), followed by fixes for repeated failures. |

## Work areas

The [first lore wiki](lore/README.md) is delivered as a connected reference covering the ten regions, peoples, institutions, history and supernatural anchors. The user's current lore direction is to deepen and reconcile this reference; additional scenes and a scenario are optional later uses. The earlier [L1 foundation](lore-foundation-m1.md) remains a drafting record, separate from gameplay M1. Lore proposals do not alter the current gameplay priority.

### Next-action queue — 1 October 2026

The [maps and resourcing saga](maps-resourcing-saga-plan.md) expands the map
stream into nine incremental epics and evidence milestones: coherent Millrace,
shared editor/wildlife rules, one polished biome with a mature current-roster
scenario, then regional kits. It preserves the verified food/wood baseline and
records recommended economy choices for explicit later decisions. This roadmap
remains the next-outcome queue; the saga is its detailed plan, not a second queue.

Based on integration baseline `25488c8`, choose one bounded outcome in a stream.
Keep existing automated proofs as regression checks and record the build and
conditions of any new observation.

| Stream | Next testable outcome | Evidence gap or dependency |
| --- | --- | --- |
| Gameplay | Reproduce the diagnostic 2,000-unit construction-site blockage on a named current build; fix the first observed movement/placement failure and replay that workload. | [Combined scale audit](qa-custom-skirmish.md#current-acceptance-audit) stops before the full workload. Intended device/network budgets are still needed before claiming supported capacity. |
| Maps | Observe contested economy-to-watch matches on Millrace and Rootways, then compare one channel, basin or ridge layout for congestion and expansion choices. | [Regional rules](maps.md), [paid 250-unit recovery/rematch proof](qa-underbough-gameplay-proof-2026-10-01.md) and [harvested-shortcut traversal](qa-rootways-woodland-shortcut-2026-10-01.md) supply automated regressions; human route decisions and balance remain unobserved. |
| Art | Bound retries for an unavailable opt-in building preview manifest and verify existing-art fallback. Scope any hosted preview packaging separately to one family. | The [bounded asset audit](https://github.com/lbeezr/thousand-unit-skirmish/pull/14) identifies six local Complete-only preview families absent from Docker, with missing lifecycle art/team masks and no separate Boughward building family. Default unit bindings still need directional motion and fresh-player readability acceptance; see [art lanes](art-production-lanes.md). |
| Audio | Audition the eleven regional music/ambience palettes at comparable perceived loudness; run ten-trial cue recognition with captions off and on, recording mix settings and confusions. | [Source evidence](qa-zone-audio-2026-09-30.md) and [recognition protocol](audio-design.md#recognition-check) do not yet supply creative listening or fresh-player results. |
| Player experience | Observe an unassisted author and a human pair completing author/join/play/result/rematch; replay a fix for the first repeated confusion. | [External playtest protocol](qa-vertical-slice.md#lightweight-external-playtest-protocol) requires actual participants and an identified build/device/browser; scripted matches do not supply this observation. |
| Tooling | Produce one real-game PNG with source revision, browser, viewport, applied map, connection state and image hash, then inspect the pixels. | [Browser/capture contract](testing.md#browser-and-art-checks) is implemented. A working Chrome sandbox and WebGL2 runtime are prerequisites; startup and injected-CDP tests do not prove rendering. |

Recent gameplay regressions also cover [Scout affordability](qa-ai-scout-affordability-2026-10-01.md)
and [Rootways retreat/resumption](qa-rootways-scout-retreat-2026-10-01.md).
They establish bounded automated behavior, with contested play still to observe.

### Continuing work areas

| Area | Useful next outcome | Record |
| --- | --- | --- |
| Gameplay | Fix a reproduced command, combat, economy, pathing, or recovery failure. | Build, reproduction, both-seat regression. |
| Balance | Observe contested openings without changing established baselines prematurely. | [Opening and combat evidence](first-skirmish-balance.md), timings, losses, stocks, player explanations. |
| Maps | Test Frontier Reach and Highland Grove routes, resources, elevation, and forest access in a match. | Layout/round-trip checks and actual route choices. |
| Interface | Make selection, production, objectives, and rematches discoverable in the compact HUD. | Viewport, interaction capture, novice observation. |
| Audio | All-zone source milestone is implemented: 44 originals across ten zones and eleven palettes, a comparison player, and Audio Studio import. Next: creative audition, loop edits, discovery/conflict arrangements and in-match cue recognition. | [All-zone evidence](qa-zone-audio-2026-09-30.md), [source pack](../assets/audio/vaelora-zones-v1/README.md), and later ten-trial results with mix/caption settings. |
| Renderer | Integrate useful asset states while preserving fog, batching, and camera readability. | Exact pack/revision, representative runtime frame, focused checks. |
| Art | Finish small independent unit, building, environment, vegetation, or material samples. | Source/runtime status, manifests, provenance, known limits. See [art lanes](art-production-lanes.md). |
| Unit characters | The [default runtime binding](../src/main.js) selects Human/Boughward packs for Worker, Infantry, Spearman, Archer, Scout, Rider and Siege Engine, with nearest-authored action reuse. Verify the opposing rosters in a live match; refine directional animation and team accents. | [Sprite role mapping](../src/unit-sprite-runtime.mjs), [Human production history](art-direction/human-roster-v1/README.md) and [unit sprite exploration](unit-sprite-exploration.md) distinguish implementation from acceptance. Record runtime visibility, rights/provenance and player readability separately. Meshy remains deferred for this pass. |
| Infrastructure | Keep staging healthy and measure hosted match/recovery behavior. | Deployment identity, ready/assets/WSS smoke, recovery and capacity evidence. |
| QA | Convert player failures into repeatable defects and current-build observations. | [QA protocol](qa-vertical-slice.md) and dated evidence. |
| PvE | Observe and improve the seeded opponent's opening, objective contest, and retake behavior. | Seeds, assigned seats, trace, solo-match observation. |
| Model research | Design an offline comparison with deterministic PvE. | Default-off fake-provider tests; paid provider use remains a separate decision. |

## Experiments

- [Living land](living-land-experiment.md): elevation is implemented; specialty
  crops and regrowth remain proposals. Highland Grove currently uses a food placeholder.
- [Map scale and density](map-scale-density.md): Frontier Reach and Woodland
  Expanse provide larger layouts; another size needs observed gameplay reasons.
- [Harvestable woodland](harvestable-woodland-pilot.md): forest-cell gathering and
  clearing are implemented; berry brushwood and organic forest-opening work remain follow-ups.
- Voice commands (deferred experiment, 2 October 2026): consider push-to-talk
  orders such as “build three houses,” “send five workers to the nearest wood
  pile,” “queue as many scouts as capacity allows,” and short action series.
  Future questions include typed intents with authoritative server validation,
  visible cancelable previews, placement/target ambiguity, batch/cancel behavior,
  and voice latency, cost and privacy. No active spike or implementation is scheduled.

## How to choose and finish a slice

1. Start from current code and a concrete player observation or reproducible gap.
   Write the expected player outcome and the smallest check that can demonstrate it.
2. Own the useful outcome through integration and proportionate checks.
3. Use code, a focused PR, and a short decision note as shared state. Contact an
   affected owner only for a specific blocking interface or conflicting edit.
4. Record whether work is implemented, merged, observed on a deployment, or
   demonstrated by players. These are different claims.
5. Keep source samples moving with their limits stated. Ordinary appearance
   captures do not require quiet-host approval; comparable performance work does
   need controlled conditions.
6. Close with the source/build, relevant checks, observed outcome, and remaining
   limitation. Update the owning guide when behavior or a decision changed.
7. Follow [repository working rules](../AGENTS.md). Staging integration and
   production promotion remain separate decisions.

The previous task-by-task ledger is preserved in the
[September roadmap archive](archive/2026-09/roadmap.md). Use it to trace past
choices, rather than copying its dated statuses into new work.

## Army-command foundations

Stop and Hold Position establish explicit task/route interruption and stationary
in-range defense, with both-seat authority and checkpoint/rematch regressions.
Patrol and Follow are integrated bounded additions to these semantics. Use the
[stationary-command evidence](qa-command-foundations-2026-09-30.md) and
[persistent-order evidence](qa-persistent-orders-2026-09-30.md) as the regression
floor; two-endpoint Patrol and catch-up Follow do not imply arbitrary waypoint
routes or rigid convoy formations.

## Regional map roster — 30 September 2026

The user identified rectangular terrain composition as a visual priority.
The [regional environment kit plan](regional-environment-kits.md) responds to the
player's follow-up about clashing materials, single-species forests and missing
rotated views. Complete an Underbough pilot with compatible ground roles, four
distinct tree forms, shrubs and actual authored directional views; prove the
whole kit in the woodland rather than validating isolated assets. Extend the
same complete-kit workflow across the ten zone rosters. The new palette study
does not claim that those production assets or loader bindings exist yet.

The [organic landscape plan](map-authoring.md#organic-landscape-composition)
separates the gameplay grid from natural authored shapes. A first local pass
shapes all twelve regional layouts, connects Underbough/Vesperra woodland,
removes the default battlefield grid and bevels shore corners. Next: deepen
Underbough's composition and continuous shore contours, then habitat margins,
settlement dressing and reusable Studio brushes. Do not expand the roster as a
substitute for making an existing landscape beautiful. Both-seat route and stock
observations must accompany blocker changes.

Twelve Vaelora maps now provide playable destinations for the ten regional asset
families and eleven audio palettes. Registered regional defaults, separate terrain
ambience, distinct flagship objectives/expansions and pre-match rolling-ground
authoring/rendering are integrated; see the [roster and rules](maps.md) and
[regional slice evidence](qa-vertical-slice.md#regional-ground-and-soundscape-slice--30-september-2026).
Ground authoring currently uses three logical levels with derived visual corners;
independent corner sculpting and in-match terraforming remain future work.
Next proof: contested both-seat economy-to-watch matches on Bellweather Millrace
and Underbough Rootways, then congestion/expansion comparison on channel, basin
and ridge layouts. Human 1v1 observations, creative loop listening, dedicated
living-fringe vegetation and slope/build-pad appearance still need work.
