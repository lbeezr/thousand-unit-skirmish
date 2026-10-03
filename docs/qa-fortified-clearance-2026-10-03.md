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
The loop bounds each awaited callback by the remaining 120-second deadline,
avoids repeatedly replacing pending movement, and conservatively includes
rounded snapshot borders. Native command filtering captures terminal errors so
unrelated build rejections retain their actual reason.

The rendered scale runner and new native scenario share that helper. The native
scenario uses the same map, seed, unit count and first move orders; ordinary
gathering begins after build acceptance. It proves both paid Barracks complete
and their actual checkpoint footprints contain no living units. No positions,
stock, costs or completed structures are injected. The
[candidate record](qa-evidence/fortified-clearance-2026-10-03/candidate.json) reports
the committed 1,000/2,000 construction openings and source hashes. The 2,000 run on
`06b7842` uses the same server/map bytes as the baseline, accepts both builds after
406 ticks and completes both by tick 810. The 1,000 integration run also includes
later main's cargo-return fix. A post-review 2,000 run on `ded3b82` also passes:
both builds accepted after 453 ticks, both complete by tick 840, with one
authoritative occupancy race retried successfully. These are functional opening
results, not evidence of a faster navigation algorithm.
After integrating main `ff1c168` (including paid palisades and water-rendering
changes), the 2,000 opening on `7ad859a` accepts both builds within 393 ticks and
completes both by tick 780. Both actual footprints remain empty.

Eight helper regressions cover late arrivals, placement races, unrelated errors,
bounded stalled evacuation, reused generations, seat/worker/death filtering,
rounded borders, callback deadlines, native rejection filtering, and the actual
1,000/2,000 formation geometry. Independent review of `2f053dc` reproduced two
harness issues (deadline overrun and hidden placement rejections); both received
focused regressions and corrections. The reviewer also completed a native
2,000-unit opening with both paid Barracks complete and empty footprints.
All 92 focused clearance, movement, villager facing, cargo-return, CI shard and
integrated audio-lifecycle tests pass, as do documentation links, syntax and diff
checks. Independent re-review of `ded3b82` reports no remaining findings and
passes 28 focused checks. The final main integration preserves the reviewed
harness code and passes 33 clearance, movement, facing, CI shard and palisade
checks. The legacy 1,000 replay mode also clears (272 ticks). The native 2,000
case is registered in CI. No hosted workflow runs or commit statuses were
reported for the pushed pre-integration head; these are local checks.

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
