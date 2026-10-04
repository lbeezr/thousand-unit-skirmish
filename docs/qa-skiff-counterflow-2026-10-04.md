# Confluence opposing-Skiff passing — 4 October 2026

[Arena evidence](qa-confluence-grounds-2026-10-04.md) · [Movement contract](skiff-water-movement.md) · [Naval backlog](naval-workstream.md)

Naval owner `/root` retains this correction through independent review, ordinary
merge, release inclusion and actual deployed/browser acceptance. The map owner
reported opposing paid boats stalling after PR251. This slice writes only the
water movement module, dedicated tests/process scenario, CI registration and
naval documentation. It changes no `snapshotUnits` allocation, server snapshot
format, schema, authored geometry, shoreline/occupancy radius, price or art.

## Reproduced defect and bounded correction

Containing baseline `2fd14ca3f9d07700923963ebe233290bce3c6538` contains the requested
`faa3a168377d468365529858c4bb6b06efe0bcbb` arena revision. The deterministic
reproduction uses its actual map and the admitted Dock exits at grid `(31,106)`
and `(128,106)`, with the documented opposite goals `(122,128)` / `(37,128)`.
Both routes have 114 cells. Without the correction they stop at x
`-0.4200000000000114` / `0.4200000000000114`, z `40.5`, path index 63, and
remain blocked for the rest of a 120-second simulation. These positions and
paths match the map owner's tick-14130 observation exactly. Three of the six
new regression cases fail on the unchanged baseline: normal/reversed actor
order and blocked queue recovery. This is process/simulation evidence, not a
rendered native play session.

Current-hull-only replanning repeats the symmetric stalemate in a nearby row.
After an ordinary Move has waited one second on a hull collision, the correction
retries its same accepted goal while also reserving other boats' remaining
transit, active goals and pending destinations. A safe found route replaces only
that route; cargo, queued Moves and the destination are retained. A failed retry
waits another second with its old intent intact. Replanning caps at 16 attempts
and 16,384 total expansions per movement tick, at most 4,096 per attempt. The
existing `repathTimer`, path, goal and revision fields suffice for cold recovery.
Fishing jobs retain their source/owned-Dock retry rules. No new checkpoint field
or general water traffic/capacity guarantee is introduced.

One-cell static shore clearance, cardinal movement and both seats' swept hull
checks remain authoritative. A channel without a safe bypass stays blocked;
the runtime never squeezes through another hull, snaps to shore, relocates the
goal or discards pending commands. Stop/hold and replacement remain player
commands rather than traffic directives.

## Repeatable checks

```sh
node --test scripts/skiff-counterflow.test.mjs scripts/water-unit-runtime.test.mjs scripts/water-route-graph.test.mjs scripts/skiff-group-orders.test.mjs scripts/skiff-waypoints.test.mjs scripts/skiff-fishing-next-move.test.mjs scripts/skiff-fishing.test.mjs scripts/skiff-contracts.test.mjs scripts/dock-placement.test.mjs
node scripts/skiff-counterflow-scenario.mjs --output=/tmp/skiff-counterflow-NEW
```

All 88 focused checks pass locally, including reversed actor order, exact
counterflow geometry, every-tick cardinal/nonoverlapping hull checks, saved
blocked routes and pending Moves, stopped cargo/boat stability, replacement
goals, an unavailable bypass and unchanged fishing jobs. Architecture, syntax
and diff checks pass. Two unavailable packages in the restored executor were
installed from the committed npm lockfile; no dependency manifest was changed.

The dedicated scenario uses the actual root Practice DOM handler/room API,
selects canonical Confluence and pays for two Docks and two Skiffs from the
ordinary 250-wood-per-seat opening. Expected bank receipts are 150 after each
Dock and 75 after each Skiff. It stops/restarts the real supervisor at the
opposing collision with pending Moves, checks both arrivals, exercises actual
selected Stop/replacement, then stops/restores positive fish cargo and deposits
it once at each owned Dock. It never writes a position, bank, cargo, resource or
checkpoint fixture. Scenario source/runtime/map hashes and exact revision are
retained in its optional report; sessions and full checkpoints remain private.
At clean integrated source `f143a6194f312f1591a771e879ab263c90de16c7`, containing
main `c347a774`, all 164 focused water/Dock/Skiff, arena, entry, Practice and
launch checks pass. The paid process/DOM proof passes every phase; its
[retained report](qa-evidence/skiff-counterflow-2026-10-04/report.json) preserves
exact source/runtime/map hashes and seven measured stages without sessions or
checkpoint injection. It pays 175 wood per seat, cold-restores both documented
blocked routes with one pending Move each and reaches `(+44.5,49.5)` /
`(-44.5,49.5)`. On the reverse crossing, actual selected Stop clears one queue
and holds its position through 60 further ticks. Replacement reaches
`(-42.5,52.5)` while the other original Move reaches `(+42.5,50.5)`.

Positive stopped/recovered cargo is `1.7666666666666688` /
`2.5666666666666673` food in this run. Exact owned-Dock bank deltas deliver those
loads once, ending food `[151.76666666666668,152.56666666666666]` and wood
`[75,75]`. Partial amounts vary with timing; assertions conserve food and compare
actual retained loads rather than a fixed fraction. Legacy selected-group and
shipped minimap-waypoint process proofs also pass, ending food `[1031,1031]`.
The independent reviewer passes its own full paid counterflow process proof,
88 movement/fishing checks and 65 entry/lobby checks. Exact final-head review,
normal merge and postmerge evidence are retained on
[PR260](https://github.com/lbeezr/thousand-unit-skirmish/pull/260).

A clean 1,177-file release of source `87347443` contains both the fix and arena,
digest `sha256:bccca3801fb6975a0083ee1bafda59a6c37e6b75d7b18b4eec932f73c25d5d4b`.
Its packaged supervisor boots, serves the arena bytes exactly and admits
one-player Practice/canonical selection. The packed runtime matches the current
fix byte-for-byte (SHA-256
`f7e47052f14b6444e7612a5a98da158390fde37dad87b946c2be4e16ccf4c0f6`).
The later branch changes integrate entry UI and adjust only proof/docs outside
this module. This is local release/HTTP evidence, not deployment or rendering.

## Deployed/browser acceptance remains open

Normal path: root Practice → choose authored testing arena → Confluence Grounds,
use owned Workers to build each inner Dock at world `(-48.5,23.5)` /
`(48.5,23.5)`, train a 75-wood Skiff, and send both opposite cross-bay Moves to
`(42.5,48.5)` / `(-42.5,48.5)` simultaneously. Queue one further water Move,
refresh/rejoin near the encounter, then verify both original and queued arrivals.
On a return crossing Stop one selected boat; verify it stays idle and clears its
pending intent, then issue a different destination and observe both boats finish.
Repeat Stop/rejoin/Return with positive food and check the owned Dock's exact
bank increase. Observe hull spacing and shoreline turns through real mouse and
minimap input; retain screenshots and the identified deployed revision.

The process scenario does not render frames or prove native pointer usability,
GPU appearance, deployment, balance or traffic capacity. Dock and Skiff art
remain placeholders with a separate coastal art owner. Coordinated deployment
and browser follow-up remain with delivery task `01a10227-2c6d`; this naval owner
retains the passing fix and naval acceptance. At 03:47 UTC on 4 October, fresh
bounded probes still fail before game access: the staging CONNECT tunnel returns
HTTP 403; Chromium aborts because its SUID sandbox helper is owned by `nobody`
rather than root. No bypass or credentials were used. Read-only Railway metadata
identifies active SUCCESS staging deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a`, source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, with one running replica and no issues.
That source predates both the requested arena and this correction. Deployment
and actual received game bytes remain unverified for the fix; merging it cannot
close this outcome. PR260 owns the current checkpoint and recovery action.
