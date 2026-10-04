# Worker work-loop routes — 4 October 2026

## Reproduction and contract

At identified staging/main source `32b7179590f9cd8a0c59172bd9ebd9a8049c4fdf`,
manual Move uses a direct waypoint on clear flat ground while Gather and cargo
return use cardinal shared flow waypoints. The authority regression places a
Worker at `(-8.27, -9.19)` and orders the same Food cell `(13.5, 11.5)` on a
160 × 160 flat map. Manual Move has one waypoint; Gather has 43 on both seats.
The retained failing control is outside the checkout under
`/workspace/worker-flat-flow-evidence/2026-10-04/baseline-red.log`.

Economy owns `workerFlowPath`, the four Worker route assignments, the small
pure reducer in `src/unit-path-line.mjs`, focused fixtures and this record.
The reducer preserves the flow-selected final cell and checks the existing
supercover from the actual fractional position, including physical corner-step
clearance. Only uniform-level unobstructed travel becomes one final waypoint.
Drop-off candidates are scored before reduction. Original shared fields and
`pathFromAttackFlow` are unchanged: Sheep Herd still requires cardinal paths.
No new per-Worker A* search, target selection, interaction radius, work-intent
shape, terrain rule, crowd steering or checkpoint format is introduced.

The forest owner retains the returning-forester/deep-forest target-selection
report. The shared movement owner retains the remaining caller audit and
consistent rollout. Their implementations can consume this narrow route
contract without taking over Worker work-loop changes.

## Selected source acceptance

The focused authority suite covers both seats, manual/Gather matching geometry,
eight bearings from fractional starts, automatic return/deposit/resumption,
partial-cargo explicit Return, complete checkpoint recovery and unchanged seat
disclosure. Every sampled step remains legal. Straightness is checked within
the same travel phase; a deposit can start the next leg within one tick.

Stone and forest corners, one-level slopes, cliffs and fractional grazes retain
flow detours without repeated repair loops. Forest and paid Farm cases select
an endpoint different from `field.goal`, harvest actual finite stock, deposit
and resume. Existing depot fixtures prove original path lengths still choose
the shorter route even when both candidates would reduce to one waypoint.
The pure 1,000-assignee test bounds added supercover work by segment dimensions
and proves the shared input route stays unchanged; it does not claim a measured
whole-game speedup or capacity. Existing movement, cargo, Food/Stone continuation,
resource jobs, Sheep Herd, productive receipts and checkpoint regressions are
part of the selected check run, alongside both type boundaries, imports and
documentation links. This is a focused run, not the full CPU suite.

## Delivery and ordinary-game acceptance

Independent review, exact-head native work/recovery, clean package, normal merge
and postmerge evidence are recorded in the owning PR as they finish.
Source/release identity, platform deployment and actual rendered gameplay are
separate evidence. No new deployed or rendered pass is claimed here.

The cloud renderer lane qualified packed actual-game rendering in
[PR #323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323). The Worker
implementation owner retains a small actual-game Move/Gather/harvest/carry/
return/deposit/resume capture at an identified clean release; the cloud testing
and HUD owners retain the qualified hosted execution and frame review. Local
browser capability remains blocked and must not be bypassed. The capture helper
and its recipe are a separate bounded deliverable in this slice.
