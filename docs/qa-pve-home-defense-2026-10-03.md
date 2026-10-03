# PvE visible economic raid response — 3 October 2026

Baseline: `main` at `1850b3b9d7ace7db572470411167d90d217236f8`.
The existing deterministic opponent gathers, replaces Workers, plants finite
paid Farms, builds and repairs its base, scouts, counters and reinforces.
Its ordinary army advances to objectives and retries stalled routes; Scouts
retreat from nearby visible danger and Siege Engines target visible defenses.
Production can build a Watchtower near a visible enemy. The tactical policy
does not recall an army holding its owned watch when a raider attacks its economy.

## Reproduced failure

[`pve-home-defense.test.mjs`](../scripts/pve-home-defense.test.mjs) uses the
existing [headless adapter](../scripts/pve-headless-fixture.mjs), preserving
authoritative command, simulation, observation and checkpoint function bodies.
Its test-only fogged 80 × 64 map starts the normal 24-unit PvE roster, ordinary
Town Centers, zero food/wood, a finite 1,000-food node near the tested seat,
and a center watch using the existing five-unit/nine-second capture rules.
The AI gathers and captures the watch. One ordinary enemy starting Infantry
approaches via three real queued movement legs around the objective army.
The raider selects Workers or a Town Center only from its own filtered view,
using ordinary `attack` / `attackBuilding` commands.

No positions, health, banks or units are injected. No shipped map changes.
On the unchanged baseline, all six Worker-raid seat/seed cases fail. Azure
first sees the raider at tick 870 and Ember at 840, but neither recalls troops
or defeats it through tick 6,000. All four starting Workers are lost while
the opening army remains at its owned watch.
All six Town Center-raid cases also leave the observed attacker undefeated
through tick 6,000: Azure sees it at 900 and Ember at 870, with no recall.

## Bounded fix and observed recovery

The policy identifies only currently observed armed non-Worker enemy units
within 12 cells of a living owned Worker or building. It sends up to four
nearest available combat units with ordinary `attackMove`, preserving current
unit generations. Surviving responders retain their job; losses open slots
for other observed units. Scouts and Siege Engines keep their existing roles.
Movement, arrival and active/recent combat suppress retries. Stalled responders
use the existing tactical timings: 300/600/1,200/1,800 ticks, capped at 1,800.
An initial fight is preserved, then its pending defense order is sent when
combat ends. A gathering-only turn cannot delay the local response.

When the observed threat disappears, responders rejoin the current objective
advance. If every objective is owned, they regroup at the nearest public owned
watch and retain ordinary per-unit tactical retries. The rest of the army
continues its objective job. Hidden/remembered enemies, civilian Workers and
unarmed boats do not trigger this military-raid response. The policy does not
infer attackers from resource depletion, hidden map coordinates or damage alone.

All policy seeds `0`, `20260925` and `4294967295` produce these measured outcomes:

| Seat / raid target | First visibility and response | Raider defeated | Responders back at watch | Starting Workers surviving | Minimum home HP |
| --- | --- | --- | --- | --- | --- |
| Azure / Workers | 870 | 1,290 | 1,590 | 3 of 4 | 2,400 |
| Ember / Workers | 840 | 1,260 | 1,560 | 3 of 4 | 2,400 |
| Azure / Town Center | 900 | 1,290 | 1,590 | 4 of 4 | 2,383.5 |
| Ember / Town Center | 870 | 1,260 | 1,530 | 4 of 4 | 2,385 |

Four responders defeat the raid; the other four Infantry retain their watch
positions. In every case, real food deposits continue after the attack by
tick 1,440. Town Center raids issue a valid observed building attack and cause
real damage before interception; the building survives.

Each of the 12 authoritative cases runs twice from the same unmodified initial
checkpoint, preserving randomly initialized unit generations. It compares the
entire command trace, casualties, response/death/return/deposit ticks, home HP
and responder identities. Shadow policies also compare every decision. Each
run restores a validated checkpoint while responders are marching and again
while regrouping, recreates the policy, and verifies that orders, raid state,
cargo, bank and fog survive. Server orders persist through restart; policy
memory is recreated from observations, as in existing PvE recovery.

## Strategic tradeoff and limits

This prioritizes a small local defense over some objective pressure. A visible
feint near an owned Worker or forward building can draw four combat units away.
It estimates neither army strength nor whether those four can win, and a larger
raid can still destroy the economy. Existing fights are preserved. The observed
single-Infantry raid saves three Workers; it does not establish overall balance,
competitive strength or human enjoyment. Worker evacuation, civilian raiders,
multi-front defense and unseen threats remain outside this slice.

```sh
node --test scripts/pve-home-defense.test.mjs
```

All 18 tests pass: 12 complete authoritative double replays and six seat/seed
guard matrices covering fog rechecks, distance and ownership, role exclusions,
repeated snapshots, capped retries, movement/combat preservation, pending orders,
lost/reused responders, gathering alongside defense, owned-watch regroup retries
and fallback army separation. The test is registered in the repository suite.
Exact broader checks, revision, review, merge and postmerge results belong in
the integration PR. No engine/navigation, price, combat-stat, provider API,
shipped map, art or deployment change.
