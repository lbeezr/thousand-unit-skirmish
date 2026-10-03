# Obstructed formation destinations — 3 October 2026

[Movement boundaries](qa-unit-pathing-2026-10-03.md) · [Water domain](water-navigation-foundation.md) · [Checks](testing.md)

## Reproduction and diagnosis

Baseline fork main `9e7aadbff2039edd220896c829565edfb2205937`, Linux cloud,
Node 24.19.0. Server SHA-256:
`243577d3cd812d9664ab2351d2af9e7e4c828953088f26016b875109c01c99ba`.
An ordinary validated 96 × 64 map has a one-cell stone-wall crossing,
declared starting food/wood and 64 Infantry per seat. Move the Azure group to
`(16.5, 0.5)`, then at tick 15 pay a Worker to build a House at that destination.
No positions or balances are injected.

The paid nine-cell footprint blocks some formation destinations.
`server.mjs:enqueueRouteRepairs` called `nearestOpenCell` independently for each
blocked destination. It reused surviving friendly destinations and other repair
destinations: 64 soldiers ended with only 55 distinct goals. Crowd separation
keeps some soldiers moving locally without advancing their remaining routes.
`lastMoveTick` therefore does not prove route progress. At 2,700 canonical ticks,
52 arrive and 12 retain reachable unfinished paths; maximum no-progress duration
is 2,159 ticks. Two exact fixed-tick traces match. The native two-seat run also
stalls 12, with eight shared goal sets, after 1,378 sampled relative ticks.
The focused distinct-goal regression fails on the isolated baseline (`55 != 64`).

Repeating the full baseline on current main
`a115774b46c9f941c78c34258ad154181fa1e9ae` reproduces the same seven arrival
counts/ticks and the same failing obstructed-goal case. Its server SHA-256 is
`6e4f76e0d301315585ea40e32cfb19b2e83d8e7ab8a0bb5b3d62d33b1b0f1f95`.

## Minimal correction

Reserve live friendly military destinations before relocating blocked goals,
then reserve each chosen replacement. Use the existing radius-eight search in
the unit's land component. Surviving walkable player destinations stay fixed.
Reservations are per team: an opponent's movement destination does not change
friendly replacement choice. Reserve the effective live pending destination when
planning has not applied a replacement to the unit field yet. Independent review
reproduced two paid Houses at `(16.5, 0.5)` and `(19.5, 0.5)` before draining
planning: the earlier fix left only 62 distinct goals. This was a reservation
defect; all 64 eventually arrived, so no persistent two-build stall is claimed.
Both-seat regressions now place those ordinary paid footprints without draining
between commands, then require 64 distinct reachable goals and arrival.
Worker repair destinations and build/cargo semantics
retain their existing rules; no new checkpoint or command fields are introduced.
An empty repair queue returns before scanning the army.

When the bounded search has no free candidate, the existing nearest-open fallback
remains. This change proves the reproduced formation overlap case, not universal
crowd deadlock recovery or unlimited distinct-goal admission. Combat pursuit,
water navigation, movement speed, ownership, fog and animation timing are outside
this correction. Land routing uses the existing walkable/component masks; the
standalone cardinal water graph remains a separate domain with no boat runtime.

## Baseline matrix and acceptance

The canonical diagnostic runs production server command/planning/tick function
bodies through a test-only entrypoint adapter. It drains planning callbacks
between ticks and disables listening and wall-clock tick timers in a temporary
copy. Each row repeats twice and hashes selected units' exact positions, paths,
goals, revisions and planning state. Every traversed edge passes the authoritative
terrain rule; every assigned goal remains in its unit's land component.

| Case / selected Infantry | Baseline ticks / arrivals | Fixed ticks / arrivals | Baseline maximum no-progress ticks |
| --- | --- | --- | --- |
| One-cell choke / 16 | 599 / 16 | 599 / 16 | 2 |
| One-cell choke / 64 | 688 / 64 | 688 / 64 | 59 |
| One-cell choke / 256 | 1,092 / 256 | 1,092 / 256 | 299 |
| Two-cell S-bend / 64 | 832 / 64 | 832 / 64 | 119 |
| Paid House across route / 64 | 714 / 64 | 714 / 64 | 55 |
| Paid House across goals / 64 | 2,700 / 52 | 696 / 64 | 2,159 |
| Sole crossing construction rejected / 16 | 599 / 16 | 599 / 16 | 2 |

The fixed obstructed-goal case retains 64 distinct goals, all arrive, and its
maximum no-progress interval is 77 ticks. All rows repeat exactly; invalid steps
and unreachable goals are zero. The static 256 group has 20 temporary episodes
of at least 150 ticks without measurable remaining-route improvement; all 20
recover. Congestion lasting about ten simulation seconds still warrants ordinary
play observation. The unchanged cases are retained as bounded baseline evidence,
not proof that all map layouts/groups recover.

The native candidate reaches all 64, with no shared destinations or unfinished
paths at 685 sampled relative ticks. Canonical and native candidate source is
`e10d30a60f5bf5402efc7088ea3dfc09bce5944b`, server SHA-256
`fbccaf7406733f7a62b25e3ecf1b1af1fe9ed73799038242928a9ed7d4a12310`.
[Retained checks](qa-evidence/pathing-goal-repair-2026-10-03/checks.json) contain
both repeated trace hashes, source provenance, timing attribution and native
orders. It exercises the unmodified asynchronous server and real WebSocket orders
with both seats connected, independently of the fixed-tick adapter. Focused
regressions cover both seats' relocation, preserved surviving destinations,
opponent-goal independence and rejection without navigation/goal mutation.
All 46 focused movement, facing, Return cargo, palisade, water graph and
CI-sharding regressions pass; syntax, documentation links and diff checks pass.
After current Dock, sheep/checkpoint, minimap and selected-construction changes
are integrated at `9b35f046da1ba63bb006b4f78dd6b7941ac27463`, all seven canonical
trace pairs still match the earlier candidate. All 68 focused integration checks
pass; native arrival remains 64/64 with no shared goals or unfinished paths
(718 sampled relative ticks). Server SHA-256:
`05adff89d895d22489fe4ed053d811d75441565884cebeda99af22071229a86a`.
The retained record includes this source and native order trace separately from
the earlier measured snapshot.

## Timing and limits

The baseline diagnostic records tick/simulation p50, p95 and maximum, planning
searches/expanded cells/slice maxima, and separation work. Cloud CPU reports
Intel Xeon Platinum 8573C; the host was not isolated. First-run baseline tick p95
ranges from 0.112 to 0.549 ms across the seven cases, with maxima up to 12.864 ms.
These observations exclude peers, checkpoint writes, rendering and normal timer
scheduling. They supply diagnostic cost attribution, not a comparable speedup,
hosted latency budget or supported-unit capacity claim. No optimization-loop
provider, paid art, credential or browser security change was used.
The current-main first-run baseline p95 range is 0.129–0.596 ms; candidate is
0.113–0.653 ms. These unisolated values are retained without a performance claim.

Run `node scripts/pathing-baseline.mjs all 2` for the full matrix or
`node scripts/pathing-baseline.mjs dynamic-goal-64 2` for the failing case.
Set `PATHING_BASELINE_RECORD` or `PATHING_NATIVE_RECORD` to retain JSON including
source hash, commit, exact trace hashes, progress episodes, native orders and
timing attribution. `--observe` after the native case records old-source failure
without asserting success. Native transport/rendering and arbitrary asynchronous
interleavings are not included in the deterministic claim. Integrated source and
review results are recorded in the owning PR.
