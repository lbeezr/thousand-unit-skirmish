# Thousand Unit Skirmish roadmap

Updated 26 September 2026 from `main` at `05901de`. This is the team's shared **next-work guide**. The [game bible](game-bible.md) defines the product, and the [QA plan](qa-vertical-slice.md) records acceptance evidence. Recheck live code and task history before claiming a checkpoint complete; this snapshot will age as agents merge.

## How to use it

Each owner has a long-running goal and chooses the next independently useful slice in its lane. Start with the first unmet checkpoint below, or a better slice that advances the same player outcome. Make a scoped PR, run checks proportionate to its change, merge it yourself when useful under repository rules and the user's standing staging authorization, and fix forward if staging breaks. A PR or a local script is progress, but claim a milestone only with the observation listed for it.

A shared interface change calls for direct coordination with the affected owner. A blocked host, asset, or browser test should not idle unrelated source work. QA records evidence and defects; Art, Infrastructure, and the producer help on their own scopes. None is a default approval queue for another owner's ordinary PR. There is no limit on parallel work or required number of PRs. Specific user-held publication, disclosure, production, and paid-provider decisions remain in force for their named scopes.

When a checkpoint changes materially, the owner can update its row and link the PR, build, capture, or result. This update is useful context, not a prerequisite for merging code. If a row has become stale, improve it rather than following it mechanically. Record evidence with commit or deployed build, environment, result, and link; use **implemented**, **merged**, **observed on staging**, and **demonstrated by players** precisely.

## Milestones

These are product outcomes, not main-merge gates. Art, playability, and scale work can proceed in parallel; the first external test needs a playable match, not every polish item.

| Milestone | Observable checkpoint | Evidence now / next proof |
| --- | --- | --- |
| **M1 · Complete invite match** | Two people on one deployed build can join Forked Vale, gather, build, produce, choose routes, contest signals, see the same winner, reconnect, and rematch. A host can save and reload the scenario through Map Studio. | The mechanics and scripted pieces are merged; a current-build, unassisted two-seat match is still needed. Use the [QA match protocol](qa-vertical-slice.md#lightweight-external-playtest-protocol) and record both seats, build SHA, decisions, failures, and result. |
| **M2 · Readable authored battlefield** | At ordinary and strategic zoom, players distinguish teams, Worker/Infantry/Archer roles, resources, objective, construction and depletion without losing command clarity. The authored world, cursor/UI, and feedback feel coherent in the running game. | Art samples and renderer contracts exist; integrated runtime appearance and player comprehension need proof. Capture representative Meadow/Cinder scenes with both teams, then ask fresh players what they can identify. |
| **M3 · Dependable large match** | A 2,000-total-unit match on intended hosting hardware meets measured simulation, browser, and network budgets while both seats can issue orders and recover from a disconnect. | Local measurements are mixed and a short hosted protocol run exists. Agree a host/network budget, then collect one comparable hosted two-seat run with tick, frame, egress, order acknowledgement, and recovery evidence. See the [performance baseline](performance-reliability-baseline-2026-09-25.md). |
| **M4 · External playtest learns something** | Two novice pairs can finish a match, explain one consequential decision and another option, and identify their main confusion without developer coaching. | Pending. Run the [QA protocol](qa-vertical-slice.md#lightweight-external-playtest-protocol), record exact observations, and turn the largest repeated confusion into the next lane checkpoint. |

## Parallel work lanes

“Next checkpoint” is the default next build or measurement, not an assignment to wait for another role. After it lands, choose the next gap in that lane against M1–M4.

| Lane and owner | Long-running goal | Next demonstrable checkpoint | Proof to record |
| --- | --- | --- | --- |
| **Gameplay systems** | Predictable authoritative orders, economy, combat, construction, and match recovery. | Make the custom-map Town Center spawn route work regardless of base orientation; then follow the highest-impact failed command or match-flow observation. | Mirrored custom-map scenario on both seats, relevant regression, and a current-build result when practical. |
| **Balance** | Both seats have fair openings and more than one viable response. | Compare mirrored Forked Vale economy/combat on current main; gather first real match timings before tuning costs. | Seed/map/seat-swapped results and human first gather/build/contest and win times; distinguish fixture parity from player balance. |
| **Maps and scenarios** | Authored maps offer visible choices, recognizable regions, and a complete contest at several scales. | Ship a selectable 160 × 160 map with shaped forests, working resource clusters, multiple routes, and a lake or stream region using today's assets. Iterate from play; a distinct 224 × 224 scale probe can follow. | Map counts and editor round trip for the first pass; then first-contact, expansion, route-use, and both-seat observations. |
| **Interface and controls** | New players can discover, issue, and understand commands at normal desktop sizes. | Observe first-glance select/move, edge scroll/fullscreen, objective, and result/rematch comprehension; fix the largest miss. | Short two-seat screen capture or timed novice observation, including window size and build. |
| **Audio and feedback** | Important orders and events have distinct, restrained, accessible feedback. | Observe whether fresh players recognize attack, move, and match-result cues using the existing Audio sample previews, first with captions off and then on; change a cue only for a specific misread. | The focused pre-unlock/muted/zero-output regression passed on [PR #79](https://github.com/lbliii/thousand-unit-skirmish/pull/79) and is included in current staging build `05901de` (`/ready` healthy). No player-recognition observation has been run yet; record each player's cue guess, caption state, and any misread. |
| **Renderer and animation** | Efficient, fog-safe visual state mapping from authoritative game state to a readable battlefield. | Support the small resource-state staging integration and independently improve water surfaces, shoreline transitions, and varied trees for dense 160 × 160 maps. Ship separate useful slices. | Exact asset/renderer revision, one representative state transition and water/forest view at game zoom; full 2,000-unit evidence belongs to M3. |
| **Environment art** | Original terrain, props, resources, and landmarks across a varied battlefield. | Fix staging packaging for the merged oak/berry state pack while broadening the palette with a small water/shoreline slice and two or three more tree or shrub silhouettes. Ship these independently without waiting for a full v1 screenshot matrix. | Versioned runtime files and a representative game-zoom view for each slice; record what is merged versus actually visible on staging. |
| **Character and building art** | Recognizable unit roles, team identity, and construction stages at game zoom. | Improve Worker/Barracks silhouettes from the six-frame preview, then hand a small usable sample to the renderer before broadening the pack. | Source/GLB manifest and named ordinary-zoom comparison; runtime capture once integrated. |
| **Art direction** | One coherent visual language across world, units, buildings, UI, and audio mood. | Review the next runtime pilot at ordinary/strategic zoom and name the few changes that most improve team/role/objective recognition. | Annotated captures and concrete corrections; review helps the owning lane move, without a standing signoff. |
| **Infrastructure and online** | Staging follows main reliably; invite rooms and recovery are understandable; large-match budgets are measurable. | Keep merge-triggered staging deploys healthy and determine a safe two-seat WSS/reconnect run when room capacity allows; separately prepare comparable hosted M3 measurements. | Deployment SHA, `/ready`, asset/WSS result, room-safe recovery observation, and measured host/network profile. |
| **QA and playtest** | Turn the game bible into current-build observations and reproducible bugs. | Run one complete two-seat Forked Vale path when a safe room is available, then the first novice pair; meanwhile keep source-level regressions specific. | Both seats, build, steps, expected/actual, screenshots or logs, and player words. Update the [acceptance matrix](qa-vertical-slice.md) without becoming a routine merge gate. |
| **Deterministic PvE** | A useful solo opponent that obeys fog, commands, and scenario rules. | On an authored map, have the bot complete an opening, contest an objective, and respond to defeat; this can run alongside the invite-match work. | Repeatable seeded match trace plus one solo-play observation; this lane can continue without blocking M1. |
| **Model opponent experiment** | Compare an optional model-driven opponent with deterministic PvE on quality, latency, and cost. | Keep the adapter default-off; design a replayable evaluation before any paid provider run. | Reproducible offline comparison proposal. Spending requires its separate user decision. |

## Candidate experiment

[Living land: elevation, regional crops, and regrowth](living-land-experiment.md) is a bounded 1v1 design pilot. Owners can ship its independent slices alongside M1–M4 work; it adds no new completion or merge gate.

[Larger, lived-in maps](map-scale-density.md) starts with a selectable 160 × 160 map with woodland and working resource clusters, then probes a distinct 224 × 224 scenario. Map, environment, interface, and renderer owners can ship their slices independently while measuring actual travel and scale.

## Choosing the next slice

1. Prefer the first missing player observation in the milestone your lane serves. If the environment cannot support that observation today, ship a source or local pilot that makes it easier.
2. Keep dependencies narrow: agree on a manifest, schema, or API directly with the affected owner and continue independent work.
3. If a checkpoint fails, record one reproducible failure and let the owning lane fix forward. Keep the other lanes moving.
4. Promote production only as a separate release decision. Normal author merges to `main` may trigger staging and are expected.
