# Bounded army search retention — 2026-10-04

This follows the [Medium search diagnosis](qa-pve-medium-search-2026-10-04.md)
and read-only final-five-minute investigation at merged source
`b99876b70068c903d2f72734322b9ce0c246dd3e`. Implementation starts from
`d6367b185645627419323dd06d1924dcc3f64aa9`; its intervening server changes
concern historical Confluence recovery/reset compatibility, not these Riven
Escarpment routes. The AI admission registry, map, economy, authoritative
combat/movement and 3,600-second full-game diagnostic ceiling remain unchanged.
Medium remains human-only. No deployment or Railway calls are part of this work.

## Demonstrated missed discovery

Two actual full-game checkpoints supply an unknown progressing goal and a
genuinely stalled one. Observation-only capture preserves every retained
command, notice, sample, checkpoint and rematch result exactly. Each route
comparison starts at its real expiry checkpoint, with all surviving units,
resources, existing orders and native combat intact. One branch sends the actual
replacement order; the other continues the original native route. Both run for
the same additional 60 seconds and repeat exactly. No later AI orders enter this
controlled route comparison; it is not a counterfactual full-match win claim.

| Ember route, reversed full-game seeds | Actual expiry tick | Actual replacement | Continue original native route |
| --- | --- | --- | --- |
| Progressing `(-35.5, -107.5)` | 105,690 | Original point stays unknown; 273 new cells, 69 near that point | Point disclosed at 106,500, 27 s later; formation settles at 106,860; 433 new cells, 195 near that point |
| Stalled `(-67.5, 84.5)` | 103,260 | Original point stays unknown; army settles on replacement route and reveals 117 new cells | Already settled at projected endpoints, 4.373 cells from requested point; original point stays unknown and no new cells are revealed |

All eleven progressing soldiers are the same living generation-bound cohort.
Before expiry they move 18.042 cells in ten seconds, with 87.442 cells remaining
and no visible living enemy. Holding that reachable route demonstrates discovery
missed by the fixed deadline. The stalled comparison demonstrates why escape
must remain. A supplementary remembered long-route comparison also re-observes
its original point only when held; it does not add new local unknown terrain.

## Policy change and limits

[The target policy](../src/simulation/ai/policies/skirmish-targets.mjs) preserves the admitted Tiny
policy and applies this larger-map qualification only to Small-or-larger public
size tiers; Tiny and internal fixture tiers keep their previous policy. It
extends a goal only when its
initial straight-line distance divided by the original cohort's slowest public
movement speed already exceeds the ordinary 60-second window. This uses owned
positions and public unit definitions; terrain, hidden enemies and enemy banks
are not inputs. Short direct routes retain their original deadline even when
formation retries cause movement. Unrestricted and distance-only candidates
failed Tiny's completion checks; both are retained as rejected diagnostic
evidence. The explicit scope preserves Tiny behavior instead of adjusting a
deadline to pass its full-game ceiling.

An eligible long goal is retained while an original generation-bound soldier
has moved at least 0.5 cells within the existing ten-second retry window. New
reinforcements and reused identities cannot refresh that progress. No goal can
remain held beyond 5,400 ticks (180 seconds), even with continuous motion.
Stationary goals keep their original initial 60-second grace; after an extension,
ten seconds without original-cohort movement releases the goal. Current visible
enemies still interrupt search. Arrival, fog legality, retry backoff, combat
protection, and bounded 64-candidate remembered-territory coverage remain intact.

Progress history is private policy state. Native orders/checkpoints require no
new fields. A fresh policy recomputes its target and direct travel bound from the
restored owned observation. The three-minute bound applies to a goal selected
by that policy instance; restart does not fabricate persisted AI history.

## Native regressions and validation

The [fixture provenance](../scripts/fixtures/pve-progress-search/README.md)
records unedited native starts and distinct isolated regression seeds. The warm
progressing regression discloses the original goal after 87 seconds and chooses
another frontier after disclosure. A fresh fixture and policy at 61 seconds
restore both full peer views without advancing a tick, then disclose the same
goal at the same native tick. The short blocked route still escapes at its
original deadline. Every full regression repeats commands/notices/final state
exactly; no rejected or unreachable order is permitted.

Both-seat logic checks cover movement past the base deadline, ten-second stall
escape, a hard three-minute bound under continuous motion, new/reused identities,
short-route deadlines and visible enemy interruption. Existing coverage, fog,
ownership, paid production, home defense, regrouping and reconnaissance checks
remain the regression floor. Final Tiny/full-Medium outcomes and independent
review are recorded in the PR checkpoint and sealed evidence.

The older QA's Farm price is corrected: native cost is 60 wood; the policy
normally requires 85 including its 25-wood reserve. The older endpoint's 68.2
wood could afford a native Farm but not the policy reserve. No economy rule is
changed by this search slice.

Opponent AI owner `01a10297` retains full-game Medium qualification. Registry/
runtime `01a103cc` owns admission; map owner `01a103e8` retains independent human
rendered-play/balance, and central staging `01a10227-2c6d` retains deployed
acceptance. Source evidence does not authorize a new fresh Medium PvE entry.
