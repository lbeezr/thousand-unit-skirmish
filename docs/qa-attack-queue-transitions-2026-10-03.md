# Attack-target loss and queued routes — 3 October 2026

## Reproduced defect

Main `1850b3b9d7ace7db572470411167d90d217236f8` accepts a normal attack
from a paid Archer on a paid enemy Skiff beside a Dock. The Archer shoots it to
113 HP. Queue a ground Move, then sail the Skiff from `(.5, 11.5)` to
`(.5, 16.5)`. A friendly Worker at `(7.5, 14.5)` maintains ordinary authoritative
vision. The retreat ends beyond all walkable land firing positions.

On both seats, after 1,200 fixed ticks the live visible Skiff remains the target,
the Archer has one queued Move, and no new damage occurs. The Archer stays at
`(-6.5, 9.5)` instead of continuing its accepted queue. Both traces repeat
exactly. Three pre-fix assertions fail: the unreachable geometry predicate and
both authoritative-body queue cases. Server SHA-256:
`efc3e8f114fce2e5836ff2f49508f8d2fb7ecc4fdc2a2b043e4097dfb50c3440`.

The root cause is `getUnitAttackPath`: it snaps the target's actual blocked
water cell to a walkable land cell before checking connectivity. That falsely
creates a reachable approach outside the weapon's true range. The existing
queue waits for pursuit to end, so the falsely reachable target strands it.
Fog loss is ruled out in this reproduction by the stationary shore observer.

## Minimal correction and transition audit

The correction uses `worldToCell(target.x, target.z)` for the target, retaining
the existing nearest-open normalization of the mover's start. The existing
bounded range scan then finds legal reachable shore firing positions or reports
unreachable. The normal `clearAttackTarget` transition releases direct pursuit,
or restores an Attack Move's saved route, before later queued legs continue.
No planner, scan budget, weapon range, damage, speed, target eligibility,
visibility, protocol, recovery schema or AI-policy change.

The audit traced dead/replaced unit targets, friendly visibility loss, attack-move
leash and route restoration, and queued-leg advancement. Building-target death
and visibility use the same clearing helper; paid construction/gate admission
also checks active approach connectivity and revalidates it. This fix is specific
to unit-target geometry, with death/fog loss serving as transition controls.
It does not claim exhaustive building attack or all queued-order state coverage.

Existing in-range continuous shots and legal ranged approaches across shores or
disconnected elevation remain available. An unreachable direct attack is rejected
before replacing the existing order. Stop/Hold keep their explicit stationary
intent and clear pursuit/queue. The existing compatible target tags already make
the unarmed Skiff a damageable target; this adds no armed boat or naval balance.

## Candidate evidence

Candidate `cc5a2169a6a85507aeddb95b75c1775ee5dbdeb4` has server SHA-256
`abba7cfdedeb6c9eb31e22cc8478703ebd72cc10310209e616a3892576d97c7f`.
The [retained checks](qa-evidence/attack-queue-transitions-2026-10-03/checks.json)
include the failure, twelve candidate pairs and actual asynchronous results.

| Initial order / target loss | Azure arrival ticks | Ember arrival ticks | Target release ticks |
| --- | ---: | ---: | --- |
| Direct / death | 1,049 | 1,037 | 552 / 552 |
| Direct / hidden | 87 | 85 | 9 / 8 |
| Direct / unreachable | 524 | 512 | 27 / 27 |
| Attack Move / death | 1,049 | 1,037 | 552 / 552 |
| Attack Move / hidden | 481 | 469 | 7 / 7 |
| Attack Move / unreachable | 524 | 512 | 27 / 27 |

All twelve pairs repeat twice with identical traces and accepted final goals.
Direct cases queue Move; Attack Move cases queue Attack Move. These are actual
server function bodies with planning callbacks drained between fixed ticks.
Hidden targets cease taking attack damage, and release occurs no later than the
next fixed tick after the checked snapshot loses visibility. Hidden direct and
Attack Move controls have different staging positions, so their times are not
policy, seat-performance or timing comparisons.

Eighteen new tests include legal shore shots, blocked water targets, both-seat
death/fog/unreachable transitions and Stop/Hold interruption. The broader focused
run passes 121 checks, including attack-flow budgets/fairness, combat rules,
terrain movement, selected construction, cargo delivery, stationary authority,
Skiff/water contracts and CI sharding.

The native script uses independent actual two-seat WebSocket servers for Azure
and Ember attacking runs. Dock/Range construction and Skiff/Archer production are
paid and complete naturally; positions, HP and units are never injected. Each
Archer shoots a normally visible Skiff before queueing Move (Azure) or Attack
Move (Ember). Restart during pursuit preserves the accepted queue and water
retreat. Each Archer releases the living still-visible unreachable target and
reaches its queued goal; after 510 native ticks the boats remain alive at 106 /
113 HP. The shore observer still reveals them. Another restart preserves the
cleared target and empty queue without new damage.

The native run started on the uncommitted candidate atop `1850b3b`; its retained
HEAD field remains that value. Its captured server SHA-256 is identical to
committed `cc5a216`, and imported production files were unchanged. Native proof
covers the visible unreachable retreat and recovery. Death and fog loss have
the fixed-body tests above; rendered behavior, deployment, all target lifecycles,
naval balance and performance remain unverified. The owning PR records review,
final integration and postmerge checks. Prior [parked-Worker congestion](qa-stationary-worker-pathing-2026-10-03.md)
and [cargo delivery](qa-queued-cargo-return-2026-10-03.md) evidence and native
recipes retain their original scope.

## Reviewed main integration

Main's Stone economy and schema-23 recovery changes at `80cb855` were integrated
cleanly into `e6f20b415e6389c1d72313642cbc87414b00f3f4`. The production diff
against that main remains the one target-cell expression and its comment.
The integrated server SHA-256 is
`e1a2f15b19446559cf66c30e43a9a3a22cd8105b579075d3716a8924f1193b5f`.

All 121 focused checks pass again. All twelve replay pairs repeat exactly and
their trace hashes match the earlier candidate. A new native run on the clean
committed integration passes for both seats, with 510 ticks to arrival, boats
remaining visible at 106 / 113 HP, and both pursuit/arrival restarts stable.
Its recorded HEAD and source hash are retained alongside the original evidence.
Independent review reports no findings, with 94 integration checks passing and
the attack/visibility/queue helpers and CI registrations confirmed unchanged.
Documentation, syntax and diff checks pass. [PR 121](https://github.com/lbeezr/thousand-unit-skirmish/pull/121)
records exact-head merge and postmerge results; hosted CI is not claimed green.

## Reproduction and ordinary browser recipe

Run `node --test scripts/attack-target-geometry.test.mjs`,
`ATTACK_QUEUE_RECORD=/tmp/attacks.json node scripts/attack-queue-case.mjs`, and
`ATTACK_QUEUE_NATIVE_RECORD=/tmp/native-attacks.json node scripts/attack-queue-native-scenario.mjs`.
The replay's `--observe` records bounded non-arrival on the historical source
with the new read-only harness; it does not change production rules.

For a two-seat browser observation:

1. Import the [authored pond fixture](qa-evidence/attack-queue-transitions-2026-10-03/map.json)
   in Map Studio and publish it. One seat builds the central Dock at `(.5, 8.5)`
   and trains a Skiff. The other builds its Archery Range at `(-20.5, -8.5)` /
   `(20.5, -8.5)` and trains an Archer.
2. Move the defender's builders back home. The attacker puts one Worker on
   the east shore at `(7.5, 14.5)` and its Archer beside the Dock at
   `(-1.5, 9.5)` / `(2.5, 9.5)`. Attack the visible boat and observe a normal shot.
3. Shift queue a ground destination, then sail the boat to `(.5, 16.5)`.
   The observer continues revealing it. The Archer should abandon the unreachable
   pursuit and continue its accepted ground leg without another player order.
4. Repeat with Stop/Hold interrupting the attack and queue: the Archer stays
   where ordered. Separately withdraw the observer while attacking through its
   vision, or let a reachable target die, and observe the queue's continuation.

The script/checkpoint recipe owns exact source, range, visibility and recovery
assertions. This server work does not establish browser usability.
