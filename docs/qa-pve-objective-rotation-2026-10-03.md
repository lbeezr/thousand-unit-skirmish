# PvE capture target rotation after paid obstruction

[Ranked AI work](pve-policy-backlog.md) · [Testing](testing.md) · [Regroup](qa-pve-regroup-2026-10-03.md)

Owner: Opponent AI. This fix uses ordinary public capture goals on the existing
authored/Objective Control policy. Skirmish keeps its separate target helper.
Navigation, building placement, server authority and checkpoint schemas are unchanged.

## Reproduced failure

On the authoritative fixed-tick engine at `269854ba`, an opposing seat gathers
real wood, pays 300 wood for twenty legally admitted wall segments and completes
an enclosure around an **empty** capture post. Builders move outside before the
last line closes and then return home. No unit, base, resource or active route is
enclosed; no position, HP, unit or bank injection occurs. Another public post is
reachable by the same army through an ordinary attack-move.

The pre-fix policy selects the nearest post and retries it forever. Per-unit
crowd movement and new recruits can refresh retry watches while nobody enters
the capture zone. A matching pair of baselines runs 360 simulation seconds after
the paid checkpoint, including a cold policy/authoritative checkpoint restart at
30 seconds: both posts remain unclaimed and no alternative order occurs.

## Small policy change

The existing public eligibility/prerequisite/priority/distance sort now supplies
ranked candidates to `pve-objective-rotation.mjs`. It remembers one approach
watch and at most four temporary target cooldowns. Sixty seconds without a
half-cell improvement in the closest soldier's distance, own squad occupancy,
visible capture progress or active/recent combat allows an eligible alternative.
The failed goal is eligible again after 120 seconds. No alternative means normal
single-goal retry behavior. Ownership/prerequisite changes prune cooldowns; a
clock reset clears the watch. Cooldown expiry preserves a healthy rotated goal,
including its bounded approach window. Existing defense/rally/Scout reservations remain.

The helper reads only filtered squad positions and public objectives. It neither
inspects terrain/routes nor learns authoritative path failures. It cannot promise
that the alternative is reachable; temporary rotation is useful pressure, not a
general path planner. Several blocked goals can still cycle. A cold policy
restart resets its bounded wait instead of persisting private policy state.

## Observed matched result

Both policies use the same engine, exact initial paid checkpoint and seeds. Each
baseline and candidate is run twice; every command/notice and complete final
checkpoint matches its repeat. Candidate and baseline initial checkpoints are
byte-equivalent. All twenty completed enemy walls remain alive, all orders are
admitted, and enemy stock+cargo+bank+300 wood spending reconcile.

| Seat | Baseline at cap | Baseline attack-moves | Candidate alternative | Candidate victory | Candidate attack-moves |
| --- | --- | --- | --- | --- | --- |
| Azure | Ongoing at 360.0 seconds | 87 | 91 seconds | 107.6 seconds | 31 |
| Ember | Ongoing at 360.0 seconds | 85 | 91 seconds | 109.7 seconds | 27 |

Times are authoritative ticks / 30 from the common checkpoint. Both restart at
30 seconds. Candidate victories come from legal capture of `open-watch`;
`blocked-watch` stays unclaimed. No wall damage or free troops/resources explain
the improvement. Baselines are timeouts, not draws. The fixture has no connected
WebSocket seats and its scenario clock is stopped, so these are simulation-time
policy regressions, not ordinary-entry timing or browser acceptance.

Eight dedicated checks cover oscillation/reinforcements, cooldown expiry, reset,
single-goal behavior, approach/occupancy/capture/combat protection, both paid
physical captures and exact restart replay. They are registered in CI. Existing
Skirmish/economy/defense/regroup and ordinary socket checks remain required for
this integration. Raw matched checkpoints, source-pinned baseline module,
harnesses and outputs are retained in
`/workspace/pve-target-rotation-evidence-2026-10-03`.

## Retained acceptance

Ordinary PvE New Game/rematch must show the identified served revision, real paid
obstruction, unchanged home economy and resumed legal capture pressure through
filtered sight. Opponent AI retains that check and any fix; coordinated delivery
and an available browser session are still needed. No independent deployment is
authorized by this source change. Keep this observation separate from Skirmish
readiness and regroup's remaining ordinary-game acceptance.
