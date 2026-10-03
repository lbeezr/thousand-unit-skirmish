# Queued formations across paid walls and manual gates — 3 October 2026

[Previous goal repairs](qa-pathing-goal-repair-2026-10-03.md) ·
[Gate contract](palisade-gates.md) · [Checks](testing.md)

## Reproduction and correction

Baseline main `e272e037d815f8db795507227c401ef4af3026d9`, reproduced again on
`75f4b7b` after manual Gate PR #87 and fractional cargo PR #92 merged. Linux
cloud, Node 24.19.0. The ordinary validated 96 × 64 map declares 500 starting
food/wood per seat and a one-cell stone-wall crossing; no positions, balances or
completion flags are injected. Select 16 or 64 Infantry, move to `(-8.5, 0.5)`,
queue `(16.5, 0.5)`, then at tick 15 use one selected Worker to pay for a
seven-cell Palisade line across some future formation destinations.

`server.mjs:advanceQueuedWaypoints` independently called `nearestOpenCell` for
each newly blocked waypoint. This collapsed 16 distinct future destinations to
13, or 64 to 57. Azure eventually arrived despite overlapping destinations;
Ember reached only 13/16 or 62/64 within 2,700 fixed ticks. This is bounded
nonarrival evidence, not proof of a permanent deadlock. The distinct-goal
regression fails on the isolated original server.

The 25-line production correction lazily reserves effective current/pending and
still-walkable queued friendly military destinations before relocating a
blocked future goal. Each replacement is reserved for the remainder of that
dequeue pass. It reuses the existing radius-eight search in the current land
component; the existing nearest-open fallback remains if the pool is exhausted.
Walkable assigned destinations stay fixed. Workers, attack-move flags, later
waypoints, planning slices, ownership, fog, client code and animation timing
retain their existing behavior. The reservation scan runs only when a blocked
military waypoint actually dequeues.

## Repeated paid-wall cases

Each case repeats twice through the production server command, planning and
tick bodies in the test-only fixed-tick adapter. Trace hashes include exact
selected-unit positions, paths, destinations, revisions and queued records.
Every step uses the authoritative terrain edge rule; every destination remains
in its unit's land component. "Removal" cancels the paid unfinished line at tick
40 before the later leg starts. The active-route case intersects actual current
paths with a nine-cell line while preserving the unblocked assigned goals.

| Seat / Infantry / case | Baseline ticks / arrivals / distinct goals | Fixed ticks / arrivals / distinct goals |
| --- | --- | --- |
| Azure / 16 / active route | 722 / 16 / 16 | 722 / 16 / 16 |
| Azure / 16 / queued target | 869 / 16 / 13 | 594 / 16 / 16 |
| Azure / 16 / removal | 596 / 16 / 16 | 596 / 16 / 16 |
| Azure / 64 / active route | 773 / 64 / 64 | 773 / 64 / 64 |
| Azure / 64 / queued target | 724 / 64 / 57 | 688 / 64 / 64 |
| Azure / 64 / removal | 703 / 64 / 64 | 703 / 64 / 64 |
| Ember / 16 / active route | 859 / 16 / 16 | 859 / 16 / 16 |
| Ember / 16 / queued target | 2,700 / 13 / 13 | 1,120 / 16 / 16 |
| Ember / 16 / removal | 1,119 / 16 / 16 | 1,119 / 16 / 16 |
| Ember / 64 / active route | 982 / 64 / 64 | 982 / 64 / 64 |
| Ember / 64 / queued target | 2,700 / 62 / 57 | 1,233 / 64 / 64 |
| Ember / 64 / removal | 1,272 / 64 / 64 | 1,272 / 64 / 64 |

All trace pairs repeat exactly. All eight active-route/removal control traces
also match before and after the correction. Illegal steps and unreachable goals
are zero. Original walkable destinations stay fixed; canceled-wall cases retain
all original future destinations. Only the named Worker receives construction.

## Actual manual gate integration

The integrated test uses main's owner-operated one-cell Gate: closed blocks both
teams; open passes both; its placement footprint remains reserved. It pays for
the gate, lets the selected Worker complete it naturally, explicitly opens it,
and gives that Worker an ordinary return order. The army queues a leg whose
formation includes the open gate cell, then the owner closes the clear gate.
Navigation advances once; current goals and future queue records remain intact.
At dequeue the original code leaves 63 distinct destinations for both seats;
both groups still arrive in this case. The correction retains 64 distinct
destinations and all arrive: Azure 708 and Ember 1,228 relative fixed ticks.
Both exact trace pairs repeat. The Gate worker's occupied-cell, route-cut,
owner authority and shared traversal checks remain in their own tests.

A separate `--observe --park-builder` probe deliberately leaves the construction
Worker nearby. The fixed Azure group arrives 64/64; Ember reaches 63/64 after
2,700 ticks despite 64 distinct reachable destinations. Unit 127 remains near
`(17.399, 1.5)` on an unfinished route to `(18.5, 3.5)`, beside the stationary
Worker at `(17.5, 1.5)`. Both traces repeat. This physical congestion observation
is outside the duplicate-destination correction and remains a follow-up; no
general crowd recovery claim is made.

## Source, native proof and limits

[Retained checks](qa-evidence/queued-wall-pathing-2026-10-03/checks.json) preserve
source hashes, both replay trace hashes, baseline failures, gate checks, the
parked-Worker limit and the native order results. Candidate production at
`c3d6dd2eaa1f24d3cffa6d35ace305a84f542015` has server SHA-256
`4e38cfffe73fa3d637e0427994f86f509c3e10c17a9d3ebad164089c00a2c527`;
the gate harness was committed at `8371f8357408e9aa0ccf6c6bc0cd28db4e53743e`.
The actual asynchronous WebSocket server, with both seats connected, reaches
all 64 with 64 distinct destinations after paid queued-target walls for each
seat (Azure 690 and Ember 1,200 sampled relative ticks). It checks selected-only
construction and preservation of surviving destinations.

Independent review reports no findings in the production correction or current
main integration and independently reproduces the parked-Worker limit. All 66
focused movement, queued wall/gate, selected construction, facing, cargo,
Gate-contract and CI-sharding checks pass; syntax and diff checks pass. CI
registers the eight replay regressions and the actual native two-seat scenario.

The fixed-tick adapter drains planning between ticks and excludes wall-clock
scheduling/listening; native results are independent of that adapter. The cloud
host was not isolated: diagnostic tick durations are observational, with no
speedup or hosted-capacity claim. No renderer, deployed staging, Mac appearance,
universal destination uniqueness or permanent-deadlock proof is claimed. The
existing bounded fallback and stationary-unit congestion remain explicit limits.

The recorded parked-Worker stall is addressed by the subsequent bounded
[moving-unit detour slice](qa-stationary-worker-pathing-2026-10-03.md). The
measurements above retain their original source and behavior.
