# Medium search diagnosis — 2026-10-04

This follow-up uses the retained [Medium evaluation](qa-pve-medium-evaluation-2026-10-04.md)
at `afef1c2c03375af6f709326b3518a60534174732`. Riven Escarpment remains
human-only; fresh PvE remains Tiny-only. The native server, canonical map,
admission registry, production costs and 3,600-second diagnostic ceiling are
unchanged. This is headless source evidence, not deployment or human balance.

## Observed unfinished games

The existing policy gathers disclosed resources, pays for production, replaces
Workers, rebuilds producers, farms, defends, regroups and searches for visible
elimination targets. Both retained seed assignments finished the observation
window ongoing with no rejected orders. Their terminal states have different
causes; surviving units alone do not establish a balanced match.

- Seeds `[20260925, 0]`: Azure has no military, one living Worker, effectively
  zero food and 68.2 wood. Nearby food and wood are exhausted. A native Farm
  costs 60 wood, but the policy requires 85 including its 25-wood reserve, so
  the recovery purchase is blocked by policy rather than native affordability.
  Ember retains twelve military units and four Workers,
  searching away from Azure's still-undefeated home. This includes a real late
  economy stall and failure to finish target acquisition.
- Seeds `[0, 20260925]`: both sides retain military, Workers, production and
  damaged buildings. They paid for Farms and further production. This trace
  shows continued economy and combat, rather than the same zero-army stall.

An observation-only probe reproduces each entire retained result exactly. In
the first assignment, Ember chooses 84 remembered coarse goals while unknown
coarse cells remain. In the reversed assignment, Azure and Ember choose 92 and
93 respectively. Revisiting remembered territory is legitimate, but the policy
also chooses a remembered first candidate when unknown ground is available
within the same existing 64-candidate budget.

The route probe legally reissues Ember's actual late goal `(-91.5, -59.5)` from
its terminal checkpoint. All twelve native routes settle within 481 ticks
(16.033 seconds), without rejected or unreachable notices. Their endpoints
remain 8–14 cells from the requested point, which stays unknown inside blocked
terrain. A separate legal cold goal reaches its requested formation within
781 ticks. These observations distinguish projected blocked goals from a
disconnected native route. They support retaining the existing search deadline;
they do not justify increasing it to force completion.

## Bounded policy change

[The target policy](../src/pve-skirmish-targets.mjs) prefers unknown ground over
remembered ground within its existing 64-candidate scan. If no unknown candidate
is available, the original remembered fallback advances the cursor by one
candidate. Current visible enemies still take priority; no hidden entities,
enemy banks, raw terrain or authored spawn locations enter decisions.

Independent review rejected the first unknown-only candidate: with two
permanently hidden cells and 78 remembered cells, it selected only those two
hidden goals over 100 expired decisions. The final correction starts one
ordinary coprime cursor sweep after an unreached preferred goal expires while
still unknown. Each visited coarse cell consumes one sweep position, including
visible cells skipped by the policy. Unknown preference resumes after that
complete bounded sweep. The existing goal hold, 60-second deadline, retry
backoff, combat protection, ownership and generation checks remain intact.

The mixed-fog regression fails on the rejected candidate and passes with the
correction: all 80 cells receive a turn, including all 78 remembered cells.
Homogeneous unknown and remembered masks cover every coarse cell on 80×64,
80×88, 160×160 and 224×224 maps. A separate case proves the 65th candidate is
outside the scan budget and the remembered fallback still progresses.

## Paired native evidence

The [fixture provenance](../scripts/fixtures/pve-medium-search/README.md)
records two unedited checkpoints from the actual first retained Medium game.
Their isolated policy seeds exercise the candidate order; they are distinct
from the full-game seat seeds. Both cases repeat all native orders, notices,
fog disclosure, checkpoint and final state exactly.

| Seat | Native start tick | Isolated seed | Baseline first goal memory | Final first goal memory | Final disclosure / cold restart tick |
| --- | --- | --- | --- | --- | --- |
| Azure | 41,700 | 590 | Remembered | Unknown | 41,906 |
| Ember | 42,570 | 120 | Remembered | Unknown | 43,132 |

Each selected final goal is actually disclosed by native movement. The resulting
full checkpoint restores into a fresh fixture at the same tick with both peer
views matching, allowing only the established transient Worker receipt to
clear. A fresh policy then chooses another unknown goal and sends a legal native
order. The second goal's arrival is not asserted. Different goals take different
travel times; these cases prove legal discovery and cold recovery, not faster
travel or faster wins.

Both full Medium candidates use the exact corresponding retained initial
checkpoint, restore native state and fresh policies at 600 seconds, and repeat
the entire command/notice/sample/final/reset result exactly.

| Seat seeds (Azure, Ember) | Baseline commands | Final commands | Baseline first building assault seconds (Azure / Ember) | Final first building assault seconds (Azure / Ember) | Result / rejected orders |
| --- | --- | --- | --- | --- | --- |
| `20260925, 0` | 891 | 990 | 605 / 1,543 | 605 / 1,345 | Ongoing at 3,600 s / 0 |
| `0, 20260925` | 1,566 | 1,304 | 1,581 / 1,915 | 1,973 / 659 | Ongoing at 3,600 s / 0 |

Contact improves for Ember in both assignments, while Azure's is unchanged or
later. Final military counts are 1/12 and 10/11, with four living Workers per
seat in both games. The reversed assignment includes a damaged Ember Barracks
at 118.8 HP with a paid queue; the first assignment remains markedly asymmetric.
These changes do not resolve full-game qualification or establish balance.
Remembered goals still receive turns with unknown cells present, unlike the
rejected unknown-only candidate.

## Validation and remaining ownership

Focused fog/tactics checks pass 84 tests, including both native cold cases and
the mixed-fog regression. Economy, mode admission and recovery checks pass 55
tests. Tiny full-game checks pass four tests: both seed assignments complete
by elimination under native authored and Skirmish identities, with exact full
replay, 600-second restore/fresh policies, paid production and native reset.
These 143 distinct candidate checks preserve the admission contract. Tiny
search decisions and match pacing can change; this is not a claim of unchanged
winners or balance. Documentation links and runtime import boundaries also pass.

Opponent AI owner `01a10297` retains Medium full-game qualification and the
remaining search/economy investigation. Registry/runtime owner `01a103cc` owns
any future capability change; these unfinished games do not authorize admission.
Map owner `01a103e8` retains human rendered-play and balance validation. Central
staging owner `01a10227-2c6d` retains release/deployed acceptance. No Railway Agent
calls or deployments are part of this work under the user's current pause.
