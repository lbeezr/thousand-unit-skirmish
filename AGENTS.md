# Thousand Unit Skirmish agents

## Start here

Read [the roadmap](docs/roadmap.md) when choosing your next slice; use [the game
bible](docs/game-bible.md), [art production lanes](docs/art-production-lanes.md), and [QA
evidence](docs/qa-vertical-slice.md) when they bear on that slice. Keep a long-running goal and own
each useful player-facing or production outcome through integration. Role lanes name the primary
owner, not exclusive files: edit adjacent systems when needed to finish the outcome.

The [documentation index](docs/README.md#which-document-answers-which-question)
defines where each decision belongs. Keep product intent in the game bible,
next outcomes in the roadmap, acceptance evidence in QA, and collaboration rules
here. Update the owning guide when implementation changes; preserve dated
measurements and source provenance as historical records.

## Product priority

The current product priority is an excellent, reusable RTS core proven in real matches. Favor work
that makes orders, movement, combat, economy, map/scenario rules, victory, recovery, and large-match
behavior dependable and understandable in solo and human 1v1 play. Use representative maps and
assets to expose core weaknesses; keep rules and content boundaries clear enough to support later
factions, civilizations, and visual styles without building speculative systems for them now. Record
the build, map, and concrete player observation that motivates a change when available. This
priority guides next-work choices, not PR approval or merge timing.

## Art outcomes

Unit characters and buildings are separate art outcomes. Merge useful source samples and runtime
slices progressively, stating what is unfinished or not yet visible in game. Unfinished polish, a
pending preview, a future loader, or milestone evidence does not create a publication hold. The
Worker/Barracks v0.2 source sample is explicitly released for an author-owned merge.

Generation, runtime export, a preview, and PR merge are milestones. A requested in-game
asset outcome is complete only when normal gameplay uses it by default, the served release
includes its files, the relevant user environment runs an identified revision containing it,
and actual in-game use is verified at that revision. Preserve sources and provenance. Keep
unfinished production, binding, release, deployment, and appearance work explicit in the
[asset adoption checklist](docs/asset-adoption-checklist.md), with an owner and next action.
Concepts and retained comparisons need not ship; label them honestly. A preview switch needs
a concrete experimental reason and an owner responsible for default adoption or retirement.

## Planning and decomposition

Use the [contributor planning guide](docs/contributor-planning.md) for substantive work.
Choose small vertical outcomes with observable acceptance, a named owner, relevant evidence,
dependencies, and a bounded write scope. Plan runtime integration, release inclusion,
deployment, and in-game verification from the start. Small fixes need only a short PR note.
Keep independent streams moving in parallel; agree on shared interfaces before overlapping
edits. Use short-lived incremental branches, and own conflicts and fix-forward work. Do not
accumulate a large disconnected PR or turn the producer into an approval queue.

## Shared work

Use code, focused PRs, and short decision notes as shared state. Read current `main` and the
relevant artifact before starting a dependent change. Do not send routine status requests,
broadcasts, acknowledgement requests, or review pings to other tasks. When a concrete shared
interface or conflicting edit blocks progress, contact only the affected owner with the exact file
or contract, a proposed resolution, and the smallest decision needed; keep other work moving while
they respond. The producer helps with unowned shared blockers and incidents, not routine handoffs.

## Checkpoints and messages

Each owner records its checkpoint in the code, PR, or task it already owns; the producer discovers
progress through read-only inspection. Do not send checkpoint summaries or copies of repository,
performance, or infrastructure details to the producer or peers as routine handoffs. If automatic
review denies a cross-task transfer, respect that denial and continue independent work; do not retry
or move the same payload to another channel. Only a concrete shared decision needs a direct message,
subject to the tool's permission boundary.

## Integration

The roadmap's milestone proofs are for claiming product progress, not default PR merge gates.
Authors own proportionate checks, their merges to `main` under the user's standing staging
authorization and repository rules, and fix-forward work after auto deploys. QA, Art,
Infrastructure, and the producer are not routine approval queues. If an actual restriction prevents
a named action, state its source, scope, owner, and next step in the relevant PR or task, and
surface a user decision promptly. Do not infer a hold from uncertainty or extend a specific held
decision to adjacent work.

The implementation owner retains the requested outcome through default integration,
packaging, deployment to the relevant user environment, and in-game verification. When a
downstream step belongs to another active owner, record that receiving owner and a linked
artifact/task; a handoff or merge does not close the outcome. Report exact source/release and
deployed revisions separately, and keep unverifiable steps incomplete. Use existing authority;
do not bypass protections, expand sensitive permissions, or infer deployment from a merge.
Do not wait for absent or queued hosted CI unless an actual repository protection requires it.

## Appearance and performance

Ordinary in-game visual checks, screenshots, and small appearance captures are owner-run iteration
tools. Start a bounded capture when useful; do not wait for a numeric host-load threshold, two quiet
readings, or Infrastructure clearance. If the browser or GPU actually fails, record that failure and
use a smaller preview or another available capture path. Reserve quiet-host coordination for
comparable performance measurements and other genuinely contended workloads; it does not govern
appearance review or merge timing.
