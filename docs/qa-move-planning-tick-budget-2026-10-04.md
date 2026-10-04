# Fixed planning turns at the tick boundary

Movement owns this bounded experiment under the [phase allocation](movement-tick-phase-proposal.md).
Default production scheduling remains callback-based. This record measures the
opt-in candidates; it does not select a new default or complete command intake at
the tick boundary. [Workstream](movement-pathing-workstream.md).

## Source and policy

The qualified comparison runs commit `319d70bfe259437fa2712be8aaad3e8ee942ad90`,
based on fork main `3f3593d0`, with `server.mjs` SHA-256
`f5fce1e78a1fccee11758037a7fc0ae46810065967fa5cb06de3b544649e4904`.
Node is v24.19.0 on the shared Linux cloud worker. Timings are observational;
sequential execution and fresh fixtures do not establish comparable hardware
capacity. No renderer or deployed gameplay observation is included.

`RTS_MOVE_PLANNING_TURNS_PER_TICK` accepts only 0, 1, 4 or 8. Absent/0 retains
`setImmediate` service. A candidate services the existing FIFO planner once,
immediately before `simulateTick`. Partial jobs rotate after every turn. The
inner simulation and its mode, combat, Worker and wildlife phases are unchanged.
Job creation, searches, reservations, steering, generation/epoch checks and the
applied-notice contract retain their existing rules.

Each turn allows eight work items and starts another whole search only below
4,096 expanded cells. A search can overshoot that threshold once per turn.
One/four/eight turns therefore allow up to 8/32/64 work items, and **each turn**
can overshoot its own cell threshold. These are operation limits, not elapsed-time
caps. Repairs and continuations enqueued by simulation wait for the next service.

`queueWaitMs` retains its old selection-wait meaning. New `firstServiceWaitMs`
includes waiting for the first actual service; created/first-service/first-and-last
applied ticks identify authoritative delay. Tick diagnostics include planning work
only for candidates. Failed turns retain their attempted work counters, and a
controlled failure verifies that the next job still runs.

## Fixed accepted-tick replays

[Raw replay records](qa-evidence/movement-tick-budget-2026-10-04/replay.json) retain
two repeats for each policy and scene. All commands use their fresh fixture's
current generation tokens at tick 0. Trace fields normalize those varying tokens
by omission and are listed by the runner. Every pair repeats exactly; different
policies deliberately have different publication ticks and movement traces.
Every selected unit reaches its assigned goal, with zero illegal or disconnected
steps. A cleared path away from its goal is a tested failure condition.

| Turns/tick | Last route, 996 units seat 0 / 1 | All arrived, seat 0 / 1 | Planning p95 ms, seat 0 / 1 (repeat 1) | Largest planning tick ms across both repeats/seats |
| --- | --- | --- | --- | --- |
| Callback control | 0 / 0 | 1,214 / 1,259 | Outside tick timing | Outside tick timing |
| 1 | 144 / 145 | 1,355 / 1,389 | 2.136 / 1.639 | 6.727 |
| 4 | 36 / 37 | 1,243 / 1,274 | 7.332 / 6.972 | 24.419 |
| 8 | 18 / 19 | 1,219 / 1,263 | 16.806 / 17.745 | 17.745 |

Both large scenes are the existing 128×128 single-choke maps, naturally initialized
with 2,000 actors and 996 selected Infantry. The callback replay drains before its
first tick: its last-route tick 0 is a baseline adapter convention, not actual
socket-loop latency. All candidates first publish and start movement at tick 1.
Last movement start matches last-route availability. Initial searches/expanded
cells retain the existing 917/467,516 and 976/481,703 counters across policies.

The 64-unit S-bend arrives at ticks 711/725/732/711 for callback/1/4/8. Its last
route is ready at ticks 0/8/2/1. Earlier publication alone does not guarantee
earlier crowded arrival: four turns arrive 21 ticks after this callback control.

At 30 Hz the large candidates publish their last routes after approximately
4.8, 1.2 and 0.6 seconds respectively, before competing jobs. This is a response
tradeoff, not a route-search speedup.

## Guard, fairness and recovery checks

For each candidate, actual production-body tests cover publication only during
service, bounded aggregate work, Stop/replacement before service, Stop after a
serviced turn, paid-footprint invalidation of applied and pending goals, epoch
reset, pending-goal checkpoint recovery, and queued-route arrival. A small other-seat
order waiting behind a 256-unit job receives its first turn by tick 2 at one
turn/tick and tick 1 at four/eight. The large job completes too; this concrete
two-job control observes no starvation. It does not promise a fixed wait under
arbitrarily many queued orders.

The existing clock-independent slice tests retain oversized whole-search,
zero-expansion work, stale/dead/recycled actor, replacement and epoch coverage.
Independent review of `319d70bf` resolves both original findings (failed-work
undercount and incomplete arrival assertion), with no remaining findings and
31 focused checks passing. Review performed no load runs.

## Native comparison and recommendation

The [eight serial native records](qa-evidence/movement-tick-budget-2026-10-04/native.json)
use the existing two-seat loopback server, parked control, active and idle checkpoint
restart, eight stopped actors and eight replacement goals, without actor injection.
Every run reaches all 996 goals and preserves both restarts, stopped actors and
replacement goals. The callback control retains actual asynchronous service.
The committed summary keeps map generator/arguments/hash and accepted-order
counts/hashes; full local reports contain their original ID/generation arrays.

| Turns/tick | Last applied minus accepted tick, seat 0 / 1 | All arrived, seat 0 / 1 | Planning p95 / max ms, seat 0 | Planning p95 / max ms, seat 1 | Maximum planning work items / expanded cells per tick |
| --- | --- | --- | --- | --- | --- |
| Callback control | 6 / 6 | 1,230 / 1,290 | Outside tick timing | Outside tick timing | Per-callback threshold unchanged |
| 1 | 144 / 145 | 1,380 / 1,410 | 1.689 / 6.586 | 1.462 / 4.832 | 8 / 5,146 |
| 4 | 36 / 37 | 1,260 / 1,290 | 9.980 / 11.002 | 8.536 / 10.196 | 32 / 19,316 |
| 8 | 18 / 19 | 1,230 / 1,290 | 20.819 / 20.819 | 15.114 / 15.114 | 64 / 37,372 |

Each candidate first applies at accepted tick +1. `firstServiceWaitMs` on seats
0/1 is 18.748/0.641 ms for one turn, 20.841/10.086 ms for four, and
0.643/21.929 ms for eight. Callback controls wait 0.679/0.567 ms. These depend
on socket arrival relative to the next tick; the old `queueWaitMs` remains below
0.3 ms for these initially empty queues and must not be mistaken for service wait.
The separate FIFO test above measures a competing order rather than this empty
queue case. Initial jobs retain the same search/expanded counters and 144/145
turns at each policy.

| Turns/tick | Whole-tick p95 / max ms, seat 0 | Whole-tick p95 / max ms, seat 1 | Start lag p95 ms, seat 0 / 1 | Skipped slots, seat 0 / 1 |
| --- | --- | --- | --- | --- |
| Callback control | 22.711 / 44.342 | 18.563 / 28.649 | 27.218 / 1.679 | 6 / 1 |
| 1 | 10.949 / 30.449 | 10.112 / 22.907 | 1.316 / 0.970 | 0 / 1 |
| 4 | 16.329 / 26.674 | 16.730 / 29.191 | 0.980 / 1.171 | 1 / 2 |
| 8 | 20.963 / 44.034 | 26.576 / 34.424 | 6.564 / 1.156 | 1 / 1 |

These rolling windows include startup/map costs and have different lengths
because the order-completion health sample is taken after each policy finishes.
They are not controlled CPU comparisons. The eight-turn seat-0 maximum occurs
on its first Move service tick: 20.819 ms planning, 29.980 ms combined planning
and simulation, and 14.039 ms broadcast make a 44.034 ms tick. The callback
seat-0 maximum is instead startup tick 6. The eight-turn seat-1 maximum is
also the first Move service tick 32: 15.114 ms planning, 23.319 ms combined
planning and simulation, and 11.073 ms broadcast make a 34.424 ms tick.
Raw slowest-tick attribution is retained rather than labeling all maxima as
planner cost or hiding these outliers.

**Recommend four turns for the next default-policy decision.** It reduces the
one-turn last-route delay from about 4.8 seconds to 1.2 seconds while retaining
more observed tick headroom than eight. Four's native arrivals are 30 ticks later
on seat 0 and equal on seat 1 relative to callback controls; the S-bend replay
tradeoff is disclosed above. Eight gives about 0.6-second publication and matches
these native arrival samples, but its observed first-service burst exceeds the
33.333 ms tick budget. This finite shared-host result supports a conservative
candidate, not a guaranteed frame-time cap or a claim that eight always overruns.

**Keep absent/0 as the default in this PR.** The parent receives this recommendation
before any default change. Movement owns either adoption under a concrete follow-up
decision or retirement of the experiment; the broader command envelope and mode/AI
contract in the phase proposal remains separate. Replays prove equal commands
assigned to equal ticks repeat within each candidate. Socket/PvE command intake
still occurs outside the phase, so this is not all-command determinism.

Movement
retains the [rendered/deployed acceptance](movement-tick-phase-proposal.md#deployed-and-rendered-acceptance-retained)
for #193/#209: the available Chromium path fails sandbox startup, and read-only
deployment status cannot establish HTTP health or in-game use. The parent-owned
sandboxed WebGL2 capture resource remains the next concrete dependency. No
security flags, new credentials, art generation or explicit deployment are used.

## Reproduce

[Integration verification](qa-evidence/movement-tick-budget-2026-10-04/verification.json)
at `5f4c9aaa` incorporates fork main `966dc0a5` without conflicts. All seven
planner/outer-tick bodies match the qualified measurement source, and the inner
simulation body matches current main. 102 focused checks, browser/node types,
syntax and documentation checks pass. All twelve comparison pairs repeat and
match the qualified movement traces and publication/arrival ticks. The default
phase probe matches its original traces; default 16-unit replay still reaches all
goals at tick 623 with the exact #209 route and movement hashes. A previously
isolated VM test needed the new diagnostic marker binding; that fixture correction
changes no production behavior. Review's later attribution correction makes both
eight-turn maxima explicit first-Move service ticks.

```sh
MOVE_PLANNING_BUDGET_RECORD=/tmp/budget-replay.json \
  node scripts/move-planning-budget-replay.mjs 0,1,4,8 2
RTS_MOVE_PLANNING_TURNS_PER_TICK=8 \
  LARGE_PATHING_NATIVE_RECORD=/tmp/budget-native-seat0.json \
  node scripts/large-pathing-native-scenario.mjs 0 parked
```

Repeat the native command with seat 1 and policies 0/1/4/8, serially for the
observational comparison. The native subprocess inherits the candidate environment.
Unset the flag for ordinary production behavior.
