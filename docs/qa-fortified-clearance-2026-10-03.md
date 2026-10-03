# Fortified construction clearance — 3 October 2026

[Combined audit](qa-custom-skirmish.md) · [Testing](testing.md)

## Baseline and diagnosis

Fork main `7f9c8fd8fbe4e667735db08346d1b690ace12fc6`, Node 24.19.0,
Linux cloud host, native two-seat WebSockets, authored Fortified Crossing map and
terrain seed 881. The workload matches the rendered opening: start at 1,996 units,
order each seat's 994 infantry to the box centered at `(±12.5, 10.5)`, wait three
seconds, redirect current Barracks-site occupants to `(±30.5, -10.5)` once, then
wait up to 120 seconds for the sites to empty. The map's ordinary Scout supply
brings each seat to 999 living units during this opening.

Replay the old stopping condition with
`FORTIFIED_CLEARANCE_RECORD=<output.json> node scripts/fortified-construction-clearance-scenario.mjs 2000 --baseline`.
That diagnostic exits nonzero if the sites still contain units after 120 seconds.
The default mode runs the corrected paid-construction proof.

The real box generator produces a 32 × 32 shape spanning the future Barracks
footprints. A focused test proves nine initial destination slots in each site;
the 1,000-unit control's box has none. Late arrivals refill the footprints after
the single evacuation. The [baseline record](qa-evidence/fortified-clearance-2026-10-03/baseline.json)
shows 7 Azure and 4 Ember occupants at 18 seconds, unchanged through the end of
the 120-second/3,601-tick attempt. Each has `pathIndex === path.length`, no pending
plan, and a completed destination at its current cell inside the footprint.
The old 1,000-unit control clears both sites in 266 ticks.

This explains the reported stopping condition: these units follow their assigned
destinations. It does not establish a navigation or local-avoidance deadlock.
The final diagnostic window still has 120 movement-vector calls per tick elsewhere;
broader convergence and congestion remain unproved.

The final rolling tick window reports median 0.430 ms, p95 9.078 ms, max 38.822 ms
against a 33.333 ms budget, and 26 cumulative skipped scheduler slots. Simulation
continues for 3,601 ticks while the named occupants remain correctly idle at their
goals. Timings are observations on an unisolated cloud host, not a comparable
hardware benchmark or speedup claim. The performance skill was inspected; its
`game-dev` sealed-run CLI is unavailable in this environment.

## Scoped correction and evidence

`scripts/fortified-site-clearance.mjs` observes new footprint occupants throughout
the clearance window and redirects each ID/generation once. It attempts the
ordinary paid build immediately when the observed site is empty; only an
authoritative `UNITS IN FOOTPRINT` race is retried. Other errors fail the run.
The loop retains the 120-second bound, avoids repeatedly replacing pending
movement, and conservatively includes rounded snapshot borders.

The rendered scale runner and new native scenario share that helper. The native
scenario uses the same map, seed, unit count and first move orders; ordinary
gathering begins after build acceptance. It proves both paid Barracks complete
and their actual checkpoint footprints contain no living units. No positions,
stock, costs or completed structures are injected. The
[candidate record](qa-evidence/fortified-clearance-2026-10-03/candidate.json) reports
the 1,000/2,000 construction openings. The first corrected 2,000 case accepts both
builds after 403 ticks and completes both by tick 780. These are functional
opening results, not evidence of a faster navigation algorithm.

Five helper regressions cover late arrivals, placement races, unrelated errors,
bounded stalled evacuation, reused generations, seat/worker/death filtering,
rounded borders, and the actual 1,000/2,000 formation geometry. Existing movement,
villager facing and CI shard checks pass. The native 2,000 case is registered in CI.

## Remaining proof

The current cloud browser preflight fails with `sandbox-unavailable` and
`storage-unavailable`; no sandbox bypass was used. The rendered adapter's new
callbacks have not run in Chrome here. Native construction proof does not cover
the complete 2,000-unit economy/research/combat/audio/render/recovery workload,
windowed GPU costs, internet transport, or a supported hosting capacity. Preserve
the September 30 Apple M2 measurements as evidence of the old failed warmup.
Future crowded movement should be traced by actual goal/path progress, separately
from this harness stopping condition. Lobby and wildlife delivery handlers are
outside this correction.
