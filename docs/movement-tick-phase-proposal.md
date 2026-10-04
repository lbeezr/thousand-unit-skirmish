# Movement planning at the server tick boundary

Proposed 4 October 2026 by the movement owner. This is an allocation and experiment
contract, not an implemented policy or a claim that all commands use the tick
pipeline. [Backlog](movement-pathing-workstream.md) · [Existing planning proof](qa-move-planning-work-2026-10-03.md).

## The remaining scheduling difference

Inspected main `aa6621411c710fddd0620c615091e533cba3222a`, with `server.mjs`
SHA-256 `d84d3a605d8443d0b3a3896c84a6c925b9d60c0c9393634a00ea8707f794f5ba`.
`scheduleNextMovePlanning` schedules `processMovePlanningSlice` with `setImmediate`.
That callback calls `applyPlannedMoveAssignment` and sends the final applied
notice before another simulation tick is required. Socket commands run through
each peer's Promise chain; PvE commands run through a separate interval.

The [real-body phase probe](qa-evidence/movement-tick-phase-2026-10-04/phase-probe.json)
uses the same natural 16-Infantry roster, IDs and Move, with each command carrying
its fixture's current generation tokens. Fresh fixtures randomize those tokens;
the compared selected movement-state hash omits them and lists its fields in the
report. Equivalent movement state is accepted at tick 0. Eleven searches expand
753 cells in each run. Servicing callbacks
before tick 1 starts all 16 moving at tick 1. Servicing them after tick 3 starts
them at tick 4. Positions after eight ticks differ. Each schedule repeats twice
with identical traces. A separate Move/Stop control preserves all stopped state
and reports `ORDER SUPERSEDED · 0 UNITS`.

The adapter controls callback opportunities; this is not a captured network or
host-load incident. It demonstrates why #193's fixed work per callback does not
give fixed work or route publication per tick. Merely buffering asynchronously
ready results until the next tick would still make readiness depend on callback
opportunities. It cannot establish identical committed outcomes from identical
commands assigned to ticks.

[Verification](qa-evidence/movement-tick-phase-2026-10-04/verification.json) records
55 passing focused checks and the adapter/script hashes. The default 16-unit
replay repeats twice, arrives at tick 623, and preserves both route and movement
trace hashes from exact #209 postmerge `64cc391`. Only the optional diagnostic
controls change callback opportunities; the production server is unchanged.

## Next bounded production experiment

Allocate movement ownership of the planner service and one call immediately
before `simulateTick()` in `runSimulationTick`. Keep search, formation assignment,
steering, attack paths and simulation rules intact. The proposed phase receives
`stepTick = tickNumber + 1`; `simulateTick` retains its current increment and
all internal ordering. Do not introduce an `await` in the tick callback.

| File / function | Proposed edit | Contract |
| --- | --- | --- |
| `server.mjs` / `scheduleNextMovePlanning` | Select the next FIFO job without scheduling a callback. | Existing enqueue callers keep their API; selection does not apply routes. |
| `server.mjs` / new `serviceMovePlanningForTick(stepTick, turnLimit)` | Execute a fixed number of existing queue turns once per server tick. | No wall-clock cutoff, callback or unbounded drain. Partial jobs rotate to the tail after each turn; a waiting job gets its turn. |
| `server.mjs` / `processMovePlanningSlice` | Run only from this service; keep eight work items / 4,096 expanded cells per turn. | Whole searches stay atomic, including their documented overshoot. Empty/stale groups consume work. |
| `server.mjs` / `applyPlannedMoveAssignment`, `completeMovePlanningJob` and failure finalization | Add source-qualified commit-tick diagnostics; publish paths and final notices only during the service. | A final notice still counts only currently valid applied assignments. Partial/error outcomes remain explicit. |
| `server.mjs` / `runSimulationTick` | One planner call before `simulateTick`. | Wildlife claims, combat preparation/damage, Worker begin/finish-step, economy, vision, victory, broadcast and checkpoint order remain owned and unchanged. |
| `scripts/pathing-replay-fixture.mjs`, focused planning tests and native scenario | Exercise the production phase at controlled ticks. | Default current replay draining remains available as a historical baseline; no changed old trace is relabeled as unchanged. |

No result mailbox is needed for this first experiment: planning and application
occur synchronously in the same phase, so no topology or command callback can
interleave between them. `pendingMoveAssignmentsByUnit` still sees the selected
job and queued jobs. Existing building/gate connectivity checks, reservations and
`replanPathsBlockedBy` therefore retain pending goals without adding a second
registry. The existing epoch, unit object identity, HP and `orderRevision` guards
remain mandatory at selection, application and final notice calculation.

Service still occurs while the server loop runs. Lobby/result movement remains
gated inside `simulateTick`; this proposal does not reinterpret that gate as a
paused server loop. Reset/map activation must continue cancelling old jobs through
the existing epoch. Do not add victory/setup edits to the planner patch.
Repairs, Patrol/Follow continuations and restored pending goals enqueued inside
or after a step become eligible at the next service phase. Tactical combat paths
that are computed inside `simulateTick` keep their existing separate budget.

### Select the work limit by evidence

The probe's one-turn-per-tick experiment commits eight units at tick 1 and the
other eight at tick 2, repeating exactly. It is not a proposed shipping limit.
The retained 996-unit initial jobs report 146/147 diagnostic slices; that counter
includes setup and finalization, leaving 144/145 search turns. At one turn per
30 Hz tick, last-route availability would take approximately 4.8 seconds before
interleaved competing jobs. That response change must be measured and accepted.

Compare fixed limits of 1, 4 and 8 queue turns per tick with the existing native
harness: accepted/applied ticks, first/last route commit, FIFO delay, whole-search
overshoot, tick lag, route legality, Stop/replacement and active/idle recovery.
Each candidate retains eight work items / 4,096 expanded cells per turn; multiple
turns multiply the maximum work and permit an overshoot in each turn. Record that
aggregate explicitly. Select a constant from measured responsiveness and tick
cost, not from elapsed time while serving a tick. This is an owned experiment,
not a hardware-capacity assertion or a requirement for a new CLI.

## Required cross-owner decision

The smallest decision for the next patch is allocation of the five planner
functions above and that single pre-`simulateTick` call to movement, with the
inner simulation body reserved to its active owners. The experiment does not
change command intake. The parent can allocate this nonoverlap now; a final
shipping turn limit follows the bounded comparison.

For the subsequent all-command pipeline, agree this interface before editing
the transport or mode/AI entry points:

| Owner / surface | Required contract |
| --- | --- |
| Mode/setup owner / `handleCommand` control branches, reset/map publication | Separate synchronous gameplay dispatch from async publication/setup. Define an epoch barrier for completed setup; preserve lobby/result rejection. Never await publication in the tick. |
| Transport and movement / `dispatchPeerTextMessage` and gameplay dispatch | Queue envelopes with epoch, authoritative eligibility tick, global acceptance sequence, peer/session/team and existing command generations. Drain an eligible FIFO prefix before planner service with fixed command/byte limits. Preserve per-peer ordering and count/byte reservations until applied or rejected; a closed peer's queued command is discarded as today. Stop has no reorder priority. |
| Mode/AI owner / `drivePveOpponent`, activation and interval | Feed AI gameplay commands through the same envelope path. Agree fixed decision ticks and observation timing if reproducible AI inputs are claimed. Keep team-1 observation/fog restrictions and count issued commands when dispatched. |
| Combat/stance owner / existing `simulateTick` preparation and repair enqueue | Proposed order is gameplay-command drain → planner service → existing simulation. Internal combat/stance intent remains inside the step; its newly enqueued repairs become eligible next step. No targeting, stance or damage refactor. |
| Worker owner / `workerPerformingActions.beginStep` and `finishStep` | Preserve current step boundaries and actual-work reporting. Moving command dispatch must not fabricate work activity or suppress the finish-step snapshot. |
| Wildlife owner / wandering, claims and harvest | Commands precede existing `updateWildlifeClaims`; the claim/motion update stays inside simulation. Keep ownership, fog and resource availability checks at dispatch. No animal art/atlas changes. |
| Recovery owner / `captureMatchCheckpoint`, `restoreMatchCheckpoint` | Route planner jobs remain transient; persisted pending goals rebuild as today. Checkpoint after the complete command/planner/simulation step. Explicitly decide durability for queued commands before adding a receipt acknowledgement; current applied notices are not durable receipts. |

Until this second interface lands, the result is a planner-phase improvement;
it is not completion of the user's all-command tick-pipeline objective. The
acceptance log must include eligibility ticks and sequence, not just wire arrival
times. Tests should replay Move → Stop/new Move, queued turns, building/gate
topology changes, dead/recycled actors, epoch reset, stance repairs, Worker work,
wildlife gather/claim, both seats and pending/active/idle checkpoints. Repeat with
different callback/clock observations and compare committed route/state hashes.

## Deployed and rendered acceptance retained

Movement retains #193/#209's deployed appearance acceptance. Railway's read-only
state on 4 October identifies staging service `game` in project
`thousand-unit-skirmish`, sourced from this fork's `main`, at successful deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a`, commit
`64cc391e6d9c4164dca7bd45696cf3862fe19729`. It includes both fixes. The
[deployment record](qa-evidence/movement-tick-phase-2026-10-04/deployment-capture.json)
distinguishes platform status from an HTTP/game observation: shell DNS returned
`EAI_AGAIN`; the web read could not access the health URL. No health success is
claimed.

A bounded Linux launch using writable private TMP/XDG directories removed the
earlier storage error, but [preflight](qa-evidence/movement-tick-phase-2026-10-04/browser-preflight.json)
still reports `sandbox-unavailable`, zero screenshots. No sandbox option changed.
The concrete remaining resource is a provider/parent-coordinated browser with a
working sandbox and WebGL2; the movement owner runs and assesses its evidence.
Do not retry this same runtime or substitute native completion for pixels.

Use `FORTIFIED_SCALE_RECORD=... node scripts/fortified-crossing-browser-scale.mjs 20 2000`
on an identified source containing #193/#209 to complete both rendered
seats, paid Barracks/research/economy, movement/patrol/follow, casualties, audio
scheduling and restart. Preserve failure stage, source, browser and workload;
retain screenshots of the choke/parked left/right motion and authoritative
positions. That harness starts disposable local servers: its success proves
that source/runtime, not staging. Separately verify ordinary staging orders at
the identified deployed commit in a disposable room using existing approved
access. No new credential retrieval or deployment is proposed. Headless/native
completion does not establish supported hardware capacity or human acceptance.
