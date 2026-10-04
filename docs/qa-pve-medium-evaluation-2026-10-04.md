# Medium opponent evaluation — 2026-10-04

## Scope and source

Riven Escarpment is admitted for two-human Skirmish by [PR 266](https://github.com/lbeezr/thousand-unit-skirmish/pull/266),
merge `99f60e28`. Fresh PvE remains Tiny-only. This evaluation starts from
`48735b95b96382cb1311d1a8fd015feeb285f4bc`, using the canonical 224×224 map
with 24 opening units, 150 food and 250 wood per seat, and native `skirmish@1`.
The map SHA-256 is `42824ee5b4a4f9ef63df3961c2737ca37d3f71a61937d55860dec830ec38d2eb`.
The server SHA-256 is `269ba44cda8dc64434af811d06dbcd5ae81f9a1bb2bbf56ac8907c0687af409c`.

Both seats run the configured deterministic policy against peer-specific
observations through the existing [native fixed-tick fixture](../scripts/pve-headless-fixture.mjs).
Authoritative orders, economy, combat, fog, checkpoint validation and reset
bodies remain intact. This is a source-qualified diagnostic on a human-admitted
map, not a fresh Medium PvE room, rendered match, deployed check or balance claim.

The current policy gathers disclosed resources, spends normal production costs,
replaces Workers, rebuilds a lost Barracks, replants finite Farms, defends visible
raids, regroups after losses and searches fog for elimination targets. No external
model or paid service participates.

## Full-game evidence

Both seed assignments ran to a 3,600-second ceiling, with a checkpoint restore
and fresh policies at 600 seconds. Each complete run then repeated from its
unchanged initial checkpoint. Full orders, notices, samples, final checkpoint
and native rematch state matched exactly. Enemy-bank and hidden-entity mutations
in shadow observations did not alter the opening policy inputs or decisions.

| Seat seeds (Azure, Ember) | Unchanged policy | Worker recovery fix | Rejected orders |
| --- | --- | --- | --- |
| `20260925, 0` | Ongoing; 890 commands | Ongoing; 891 commands | 0 / 0 |
| `0, 20260925` | Ongoing; 1,558 commands | Ongoing; 1,566 commands | 0 / 0 |

All four traces bought and completed a Barracks from each seat and spent actual
food and wood. The fix uses exactly the same starting checkpoints as the two
unchanged-policy runs. Neither updated Medium trace reached elimination within
the ceiling; search and late economy progress still need a separate bounded
investigation. These results do not support Medium PvE admission.

## Reproduced defect and bounded fix

In both unchanged full games, Azure lost every Worker while retaining a completed
Town Center with available Worker production. Its final food was approximately
50 and 85 respectively, with no queued Worker. The policy demanded the 50-food
Worker price **plus** a 50-food reserve, so an otherwise legal recovery could not
start. Native manual orders from the controlled six-Worker-loss checkpoints at
ticks 4,030 and 4,099 charged 50 food and produced a Worker successfully.

The [production policy](../src/pve-production.mjs) now waives that reserve only
when no living Workers remain. Once one survives, the normal reserve applies.
Existing authoritative production options, population, queue, roster, opening
delay and retry checks still govern the order.

The [native regression](../scripts/pve-zero-worker-case.mjs) purchases two Workers
for 100 food from the ordinary opening bank, then loses all six Workers through
legal movement and visible attacks. It makes no checkpoint edits, resource
grants, casualty injections or hidden policy inputs. The unchanged policy bought
no replacement for 80 seconds from either seat. With the fix:

| Seat | Real loss tick | Paid replacement / cold queue tick | Spawn tick | First deposit tick | Loss-to-deposit seconds |
| --- | --- | --- | --- | --- | --- |
| Azure | 4,030 | 4,330 | 5,080 | 6,361 | 77.7 |
| Ember | 4,099 | 4,399 | 5,149 | 6,281 | 72.733 |

Both paid queues restore at the exact purchase tick with full peer-observation
parity, allowing only the established transient Worker activity receipt to clear.
All native stock, cargo, banks and paid spending reconcile. Both complete
regressions repeat exactly, and the legal loss checkpoints match their unchanged
policy counterparts. Dead Worker rows count as casualties, not an operating
economy. Budget cases cover 0/1/3 living Workers at 49/50/99/100 food, both seats,
three seeds, and retain blocked-exit, queue, population and ownership guards.

## Recovery and resource accessibility

The unchanged policy recovered from actual opening-army and paid-Barracks losses
from both seats using the existing [paid loss case](../scripts/pve-skirmish-loss-case.mjs).
The replacement foundation survived a fresh native restore without advancing
its actual observation tick. Full command/notice/checkpoint replay matched:

| Seat | Rebuild purchase after retreat | Completed replacement | Five-unit advance | Paid food / wood |
| --- | --- | --- | --- | --- |
| Azure | 118 s | 142 s | 227 s | 260 / 370 |
| Ember | 113 s | 138 s | 223 s | 260 / 370 |

Independent human-controlled Worker orders reached, harvested and deposited from
all eight paired home/shelf/rift/crown nodes and both contested nodes per seat:
20 successful deposits, with no rejected or unreachable orders. Ordinary stock,
cargo and banks reconciled without grants or producer purchases. First deposits
ranged from 16.1 to 131.367 seconds. This proves native resource accessibility;
it does not claim the policy chooses every expansion pocket.

## Validation and remaining ownership

The existing CI-registered [Worker recovery tests](../scripts/pve-worker-recovery.test.mjs)
include the new budget and both-seat native regressions. Focused checks also cover
finite Farm recovery, population, native mode/checkpoint activation, production
budgets, Tiny full-game replay/reset, cold foundation recovery and the previously
admitted maps' paid loss cases. Tiny defaults and the Medium human-only registry
contract are unchanged.

Opponent AI task `01a10297` retains Medium qualification and the unfinished
full-game investigation. Registry/runtime owner `01a103cc` owns any future
capability change and must coordinate with this evidence before enabling Medium
PvE. Map owner `01a103e8` retains human rendered-play/balance follow-up, and central
staging owner `01a10227-2c6d` retains release/deployed acceptance. No Railway Agent
calls or deployments are part of this evaluation under the user's current pause.
