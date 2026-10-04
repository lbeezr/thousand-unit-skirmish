# Parked crowd route progress

The [planning investigation](qa-move-planning-work-2026-10-03.md) preserved a
native failure after redirecting eight Infantry into a parked 996-unit formation.
The [baseline replay](qa-evidence/crowd-forward-progress-2026-10-03/parked-baseline.json)
at `331df72` reproduces it twice for each one/two-tick command lag on seat 1:
units 1018 and 1019 keep their assigned goals and active paths but oscillate before
the next waypoint for 1,500 ticks. Seat 0 completes both controls. All unselected
actors and eight Stops retain their position and intent.

The natural roster first receives a Move through a one-cell choke. After arrival,
24 units receive another Move, advance one/two ticks, then eight Stop and eight
receive newer destinations. Two newly parked units can share the next waypoint.
Their summed repulsion overcomes the mover's intended direction. It oscillates
just beyond the `2.6 / 30` step-distance threshold instead of advancing that waypoint.
No actor, stock or position is injected to produce this failure.

## Correction and checks

`getMoveVector` now scales accumulated separation to a maximum strength of 0.62
before combining it with the unit-length intended direction. Its forward projection
stays positive. A single neighbor keeps the existing force and vector; lateral
deflection remains. Spatial queries, local Worker detours, terrain checks, speed,
order generations, ownership, fog, combat and parked actors retain their contracts.
Movement continues to use the existing soft overlap behavior.

17 of 18 focused real-function checks fail on baseline source. The correction
passes both seats in all eight headings, unchanged parked actors, lateral deflection
and the single-neighbor vector control. That control's first expected-value formula
used `hypot` instead of the existing `sqrt`; the rounding mismatch was corrected
before final acceptance. Independent review covers the force bound and runtime harness.

Current-main integration at `9b28054298ecd2100af506f665865b7cc8ea2560`, server
SHA-256 `bf78f947dc21fd514a15562fc0c13f6ffba09f608041962bea001deebd408508`, passes
228 movement, command-intent, cargo, pursuit, military stance and scheduler checks,
browser/server type checking, syntax, documentation and whitespace checks.

## Route and native evidence

The [corrected parked cases](qa-evidence/crowd-forward-progress-2026-10-03/parked-candidate.json)
cover both seats, one/two-tick lags and two identical repeats per case. All 16
moving controls arrive, exact newer goals/revisions are preserved, eight Stops stay
fixed and unselected actors retain position, intent and queued paths. The former
seat-1 failures complete in 415 / 414 ticks.

All [nine terrain-route cases](qa-evidence/crowd-forward-progress-2026-10-03/route-summary.json)
repeat twice, retain their initial planned routes and finish with zero illegal
steps or disconnected goals. Steering changes movement hashes and arrival ticks:
996-unit chokes finish at 1,214 / 1,259 instead of 1,990 / 1,936; maximum temporary
no-progress windows shrink from 939 / 837 to 55 / 59 ticks. The small 16-unit choke
takes 623 instead of 606 ticks. These are simulation progress observations,
not a comparable CPU/GPU speedup or supported-capacity result.

Actual asynchronous two-seat servers pass on
[seat 0](qa-evidence/crowd-forward-progress-2026-10-03/native-seat0.json) and
[seat 1](qa-evidence/crowd-forward-progress-2026-10-03/native-seat1.json). Each natural
2,000-roster scene completes all 996 selected routes after active-travel restart,
then redirects eight units into the parked formation. Eight Stops and exact newer
goals/revisions survive overlapping commands, arrival and an idle restart.
Initial route arrival is at 1,230 / 1,290 native ticks. Ordinary commands create
the fixture; no actor injection or renderer shortcut participates.

## Integration and remaining evidence

[PR #193](https://github.com/lbeezr/thousand-unit-skirmish/pull/193) merged at
`331df727201c091741f55431d4b83021f479a7b5`. Its
[postmerge record](qa-evidence/crowd-forward-progress-2026-10-03/planning-postmerge.json)
passes 209 checks and all nine route pairs with unchanged premerge hashes.

The [browser startup failure](qa-evidence/move-planning-work-2026-10-03/browser-preflight.json)
still blocks the rendered workload. No deployed revision, hardware speedup,
universal crowd guarantee or completed tick-phase command/result migration is claimed.
The [movement backlog](movement-pathing-workstream.md) retains those boundaries.

## 4 October postmerge acceptance

[PR #209](https://github.com/lbeezr/thousand-unit-skirmish/pull/209) merged at
`64cc391e6d9c4164dca7bd45696cf3862fe19729`. The exact merge source has server
SHA-256 `d84d3a605d8443d0b3a3896c84a6c925b9d60c0c9393634a00ea8707f794f5ba`.
[Postmerge evidence](qa-evidence/crowd-forward-progress-2026-10-03/postmerge.json)
records 235 passing checks, browser/server type checks, nine terrain-route pairs
and four parked-formation pairs with unchanged qualified candidate hashes.
Both actual native scenes rerun at that merge source: all 996 original routes
complete after active-travel restart; the parked replacements, eight Stops and
exact newer goals/revisions survive arrival and idle restart. Native initial arrival
is at 1,260 / 1,290 ticks. Review confirms the force combination and generation,
terrain, query and timing contracts; the separate postmerge checkout is clean.
