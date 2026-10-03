# Clock-independent formation planning work

The formation planner at `4467986` decides each queue turn with a five-millisecond
timer. In an actual-function-body fixture, a clock advancing ten milliseconds
between observations performs zero searches; a clock returning the same value
finishes all 24 destinations before another waiting order receives a turn.
Six of the first seven scheduler checks fail on that source; the superseded-order
guard control passes. A missing fixture `navigationRevision` was corrected before
recording those failures.

The correction limits each turn to eight work items and stops before starting
another search after 4,096 expanded cells. Empty/stale start groups also consume
work items. A whole A* search remains atomic: one search can cross the node
threshold, after which the job yields. The theoretical bound is `4095 + CELL_COUNT`,
not a hard 4,096-node or millisecond ceiling. Group scans, setup and finalization
remain roster-bounded rather than separately preempted.

## Source and checks

After current-main stance integration, fixed-tick checks run at `b98f6f2` and
native checks at `2be3cf0`; both have server SHA-256
`8da27f1aa21612266acac78e602a0736ba26639f2ece3b1d3a630a88da018a15`.
The production change is confined to planning constants, `processMovePlanningSlice`
and its diagnostic record. Route search, command assignment, generation checks,
ownership, fog, combat and movement timing retain their existing contracts.

209 combined movement, persistent/Stop, queued cargo, pursuit, attack-target,
military stance and CI-sharding checks pass. Scheduler controls include dead/recycled
actors, match cancellation and zero-search stale groups. Browser/server type checking, syntax,
documentation links and whitespace checks pass. The nine scheduler cases enter
normal CI. The first dependency install failed because the default npm cache was
unwritable; installing the unchanged lockfile with a private `/tmp` cache succeeds.
The earlier integration at `8b7d5a2` (server `216ef785…`) passed 157 checks plus
two new controls and native arrival at 2,070 / 2,040 ticks. The final native control
goals use opposite clear-ground z signs to avoid the new idle enemy stance behavior.

## Routes and native recovery

[Replay evidence](qa-evidence/move-planning-work-2026-10-03/replay-summary.json)
retains source identity, initial route hashes, movement hashes and operation counts.
All nine cases repeat twice and match the baseline routes, arrival ticks and
movement traces, with zero illegal terrain steps or disconnected goals.
The seven original cases still finish at ticks 606, 682, 1,031, 769, 700, 692 and 606.

The mirrored 128×128 scenes each contain a natural 2,000-unit roster and send
996 Infantry through a one-cell choke. All arrive at ticks 1,990 / 1,936 in the
fixed-tick adapter. Initial jobs retain 917 / 976 searches and 467,516 / 481,703
expanded cells; turns increase from 26 / 27 to 146 / 147. Maximum expanded cells
per turn are 5,059 / 5,146, including the documented atomic-search overshoot.
The final 300-tick separation window is retained separately from whole-route work.

Actual asynchronous two-seat WebSocket servers pass for
[seat 0](qa-evidence/move-planning-work-2026-10-03/native-seat0.json) and
[seat 1](qa-evidence/move-planning-work-2026-10-03/native-seat1.json): all 996 original
routes finish after a restart during active travel. Three overlapping ordinary
orders then preserve eight Stops and eight newer Move destinations; exact applied
goals and revisions survive arrival and a second idle restart. Native arrival
ticks are 2,040 / 2,070. Planning diagnostics are captured before process restarts.

## Preserved failure and limits

An earlier secondary control ordered eight units into the parked 996-unit
formation. Seat 1's initial route completed, but two replacement units retained
paths near `z=8.321` until the 120-second checkpoint timeout. The
[observed failure](qa-evidence/move-planning-work-2026-10-03/parked-crowd-failure.json)
is a separate crowd-steering candidate in the
[movement backlog](movement-pathing-workstream.md). The disposable checkpoint was
removed on timeout; recorded values come from its prior read-only inspection.
The successful scheduler controls use clear ground and do not close that failure.

[Browser startup](qa-evidence/move-planning-work-2026-10-03/browser-preflight.json)
fails with sandbox and profile-storage errors. No rendered, hosted or deployed
acceptance is claimed. Fixed-tick replay drains planning callbacks between ticks;
native checks cover asynchronous interleaving, but neither completes a central
tick-phase command/result redesign. Host timings are observational and do not
demonstrate hardware speedup or supported player capacity.
