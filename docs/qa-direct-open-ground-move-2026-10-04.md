# Direct open-ground Move trajectories — 4 October 2026

The user observed units taking forced angles, “up then left instead of a direct
line anywhere,” possibly concealing sprite headings. Movement owns this small
path-planner fix and its integration. Mac Astra task
`01a106da-40ec-7288-8580-07d11e961034` owns the separate live eight-direction
animation reproduction. No local browser was started for this investigation.

## Demonstrated cause and result

At main `723bd381`, `server.mjs`'s `findPathAStar` first calls
`findDirectManhattanPath`: all horizontal cells, then all vertical cells (or
the reverse). Its fallback A* also uses four cardinal neighbors. There is no
line-of-sight smoothing. `getMoveVector` follows every cell center; it does not
quantize the velocity. These are actual authoritative right-angle trajectories,
independent of sprite selection.

[The retained baseline](qa-evidence/direct-open-ground-move-2026-10-04/baseline.json)
uses the real Move command, planner and fixed server tick bodies. Twelve isolated
Infantry orders repeat twice with identical trajectory hashes. Eight headings
include world axes and diagonals; four additional goals have non-grid click
coordinates and fractional start positions. Actual step legality and arrival
are checked. Goal-cell quantization is measured separately.

| Workload | Baseline actual distance / straight distance | Candidate |
| --- | --- | --- |
| Four world diagonal bearings | 1.412728 | 1.000000 |
| Four world axis bearings | 1.000000 | 1.000000 |
| Four arbitrary click bearings | 1.265402–1.408958 | 1.000000 |

[Candidate trajectories](qa-evidence/direct-open-ground-move-2026-10-04/candidate.json)
have one sustained world bearing each, no illegal steps and no arrival drift.
The four arbitrary baseline routes deviate 5.07–9.69 world units from the direct
line; candidate error is below `3e-14`. These are correctness measurements, not
wall-clock speed, CPU capacity or rendered appearance claims. The accepted goal
remains the existing cell center; this change does not introduce sub-cell goals.

## Bounded implementation and safety

`src/unit-path-line.mjs` visits the straight segment's supercover, including both
sides of exact corners and tile-boundary lines. It also includes both corner
sides when their boundary crossings could fit within the largest physical
movement step. A geometrically clear line alone is insufficient: the existing
`canTraverseUnitStep` rejects such near-corner diagonal steps. Independent review
reproduced initial and later-route repair loops in the first candidate; both
are retained as regressions and corrected without weakening collision rules.

`findPathAStar` returns one destination waypoint only when that complete segment
is open on a uniform elevation level. Obstacles and elevation changes retain
the existing Manhattan/weighted A* fallback. Each assignee's actual fractional
position is checked too; an unsafe offset first rejoins its safe start center.
Shared planned arrays remain unmodified. Work is bounded by map dimensions and
runs during planning, rather than scanning the full segment every simulation tick.

Construction's route-intersection check visits long waypoint segments, including
the physical corner clearance, so a paid wall across the interior immediately
repairs the order. Goals, formation reservation, transient planner generations,
queued destination format, cancellation and checkpoint format remain intact.
The existing per-step traversal and position guards continue to apply.

## Camera and sprite interpretation

The fixed camera is `[0.78,1.12,0.78]`. Screen right is world `(+X,-Z)`;
screen up is `(-X,-Z)`. World cardinal routes therefore appear as screen
diagonals. Sustained screen-left/right/up/down requires world diagonal velocity,
which the old open-ground Manhattan routes largely omitted. Client interpolation
sets yaw with `atan2(serverX-renderX, serverZ-renderZ)` and the sprite runtime
then selects one of eight world headings. This establishes a path explanation
for missing sustained travel bearings; it does not prove any sprite pixels face
the correct way.

Standing berry gathering uses its authoritative work heading separately from
the travel route. Worker flow-field travel and combat pursuit remain unchanged,
as do renderer selection, art, ownership/fog disclosure and animation clocks.
Missing authored directional motion still uses the existing exact-heading idle
hold. No animation or sprite source was generated to mask the movement issue.

## Validation and acceptance

The focused regressions exercise Worker/Infantry on both seats, all eight
headings, arbitrary clicks, blocked corners, cliffs, fractional start rejoining,
initial/later near-corner controls, paid interior-wall repair, queued turns,
active checkpoint restore, Stop/replacement and 64-unit formation arrival.
Existing planner, crowd, parked-Worker, dynamic wall/gate and recovery checks
remain the regression floor. `scripts/open-ground-trajectories.mjs` reproduces
the retained geometry records; `scripts/open-ground-move.test.mjs` and
`scripts/unit-path-line.test.mjs` are included in ordinary local CI.

The author passes 148 focused checks; independent review passes 64 checks and
reports no remaining gameplay finding after resolving its corner reproduction.
All nine terrain/crowd cases complete twice with identical traces and zero
illegal steps, including both 996-unit choke cases; [the matrix](qa-evidence/direct-open-ground-move-2026-10-04/terrain-matrix.json)
retains their route hashes, stalls and observational timings. A stall window
is not a stranded route when it subsequently completes.

[The native run](qa-evidence/direct-open-ground-move-2026-10-04/native-cold-recovery.json)
uses actual both-seat WebSocket orders, a queued turn, checkpoint writes, process
shutdown/start and session resume. Both Infantry finish at the preserved queued
cell, retaining generation/revision through restart. The restart is a fresh
server process, not only an in-memory restore. Syntax, both strict type projects,
runtime import boundaries, docs and whitespace checks pass.

The baseline server SHA-256 is
`29753b61a89c966e00349edeaf70c1cbba294bcbbc4f23be2e2a647ecba60416`.
Candidate records were collected from the working diff on `723bd381`, before
commit; their server hash
`5fe92df439782e3f0b5cf81a5d142f78ff30ce0b9184c765316fb72e225e56f6`
and line helper hash
`9e1d246a57b452c96e7a916665cde63ea3ac9058aca986db04d35f58fce99889`
match committed source `0f26b8f73ca2642fd4ada5f9328cb61c27766edf` exactly.
The unchanged runtime includes refreshed main `6d7cb40c` (PR #282's separate
Palisade construction targeting); integration checks cover that client consumer.

The clean Docker release at that source contains 1,184 files, including the new
server helper, with digest
`sha256:df978c0d8e6ad59b8e50aa40411678c1e30147aa000a32b5a3417933cffc4651`.
Its packaged server starts, answers health and completes a normal seat's
WebSocket welcome. This is local packaging/runtime proof, not deployment.

Identified hosted deployment
and actual pixels remain open with the movement owner and the named Mac animation
task above. No callable outbound cloud-task tool was exposed in this execution
environment, so this task could not request that worker's live trajectory artifact.
No held foot-art candidate was merged by this task.
