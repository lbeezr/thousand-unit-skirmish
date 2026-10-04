# Native forest Worker loss and paid economy recovery

[AI queue](pve-policy-backlog.md) · [Paid discovery/deposit](qa-pve-wood-discovery-2026-10-04.md) · [Movement boundary](movement-pathing-workstream.md)

Opponent AI owner `01a10297`, 4 October 2026, Node 24.19.0. Audit base
`f747c45beec79252603755ace583289f1e10aba0`, containing the paid forest-income
loop from [PR360](https://github.com/lbeezr/thousand-unit-skirmish/pull/360),
forest [PR341](https://github.com/lbeezr/thousand-unit-skirmish/pull/341), Worker
routes [PR330](https://github.com/lbeezr/thousand-unit-skirmish/pull/330) and
browser resume [PR361](https://github.com/lbeezr/thousand-unit-skirmish/pull/361).
Exact reviewed/merged source and check exits belong to this PR's receipt.

## Diagnosis and chosen scope

An initial unmodified full-policy live raid did not reproduce the same loss on
both seats. Azure's targeted Worker survived at the 180-second cutoff. Ember
lost a builder, paid 50 Food for a replacement, and retained a progressing
ordinary-node Wood haul. Those raw audits and their original diagnostic helper
are retained separately. They do not prove an idle economy or justify AI tuning.
Generic visible-target tactical Attack rejections are retained with their
commands/player rows and routed to the movement owner; no route defect is
inferred or patched here.

The bounded case follows the existing ordinary human-controlled paid-loss
scenario pattern. It asks whether a lost active forester is actually replaced
with productive labor and whether a newly assigned Wood job restores income.
The existing policy passes. No production/gather/defense decision, deadline,
price, map, victory, movement or gameplay authority changes are justified.
Art backing is N/A for this internal native regression.

## Ordinary loss prelude, then full policy

The [helper](../scripts/pve-contested-wood-case.mjs) first runs the unchanged
canonical Riven Skirmish@1 paid depletion/discovery/Gather/10-Wood-deposit loop.
It restores that untouched first-deposit checkpoint into the native fixture.
During a declared human setup, the tested military receives ordinary No Attack
and Hold Position. Workers continue their native jobs. Eight opposing Infantry
Move from their real spawn toward a fixed public rendezvous. The raider selects
a living Worker only from its current player-visible units, then issues focused
Attack with the disclosed generation. There is no position, casualty, bank,
stock, order, map or checkpoint edit.

Actual native damage kills exactly one Worker with durable `forest-group` Wood
intent. The raiders receive ordinary No Attack/retreat, the tested military
returns to Aggressive, and the full deterministic seed 20260925 policy takes over.
This comparable single-loss setup is not an unassisted or balanced raid-defense
benchmark. Azure loses 3.766666667 carried Wood; Ember loses no carried Wood.
Native stock/cargo/bank accounting includes that real cargo loss without refund.

The policy pays the normal 50 Food for one Worker at 10 seconds after the loss;
native production spawns it at 35 seconds. Acceptance requires both an actual
deposit from that replacement's accepted Gather and an actual Wood deposit from
a newly accepted post-loss Wood job. Either can involve Food or Wood allocation
for the replacement; an old surviving forest delivery cannot qualify the new
Wood-job witness. Credits match the living actor/generation's actual cargo and
all simultaneous deliveries match the native bank increase.

| Seat / branch | Replacement's first qualified cargo | Replacement deposit after loss | New Wood-job deposit after loss |
| --- | --- | --- | --- |
| Azure warm | 10 Food | 50.9s | 134.633333s, 10 Wood |
| Azure cold | 10 Wood | 94.7s | 81.333333s, 10 Wood |
| Ember warm | 10 Wood | 78.1s | 78.1s, same 10 Wood |
| Ember cold | 10 Wood | 78.1s | 78.1s, same 10 Wood |

Each warm branch regenerates the entire paid loop and loss/recovery from its
retained untouched opening. Cold saves just after the actual Worker purchase,
then restores fresh authority/policies without advancing time. Complete both-seat
views match except the existing documented transient Worker-activity clear.
Each cold branch repeats itself exactly; distinct valid warm/cold choices are
retained without normalization. Four living Workers are restored and native
Skirmish remains ongoing at each positive endpoint.

Two controls keep the same real casualty and paid replacement. One withholds
only Gather delivery for the replacement; it has no qualified replacement
deposit. The other withholds only new Wood Gather delivery; it has no newly
assigned Wood-job deposit. Both continue all other native activity for the
unchanged 180-second recovery bound. Other Workers' existing jobs can still
produce income; these are precise causal negatives, not whole-bank-zero claims.
Both controls exactly repeat and conserve Wood within 0.0001, including the
small rounded-stock residue.

## CPU fixture correction and shared owners

PR361 adds a random per-process `serverInstanceId` to peer snapshots. Exact CPU
replay/fresh-fixture comparisons consequently failed solely in that transport
field. AI's [headless adapter](../scripts/pve-headless-fixture.mjs) fixes that
one nonce to `pve-headless-replay`, alongside its existing I/O scheduling
adaptation. Production server randomness and browser reset/epoch semantics are
unchanged; command, simulation, snapshot and checkpoint function bodies remain
intact. This fixture does not qualify real process-instance/browser recovery.
The failing comparison log is retained; complete corrected results are compared
without dropping any fields.

Concrete consumer boundaries are recorded with
[Forest](https://github.com/lbeezr/thousand-unit-skirmish/pull/341#issuecomment-5982970670),
[universal movement](https://github.com/lbeezr/thousand-unit-skirmish/pull/332#issuecomment-5982971530),
[the live tactical observation](https://github.com/lbeezr/thousand-unit-skirmish/pull/332#issuecomment-5983188283),
and [browser resume](https://github.com/lbeezr/thousand-unit-skirmish/pull/361#issuecomment-5983162536).
Forest `01a1072a`, Resource `01a101f7-5683` and universal movement `01a107ba`
retain job selection/continuation, final approach, route tails, depot scoring,
clearance and shared execution. This slice writes AI scenarios, the CPU fixture
transport hook and its owning plan/evidence only. The new cases are imported by
the existing registered Worker-recovery check; central CI is unchanged.

## Remaining qualification

This is one supported single-loss native capability, not sustained pressure,
competent-opponent recovery, zero-bank survival, balance or general completion.
Medium stays human-only with admission owner `01a103cc`; map/human balance stays
with `01a103e8`. Next AI work starts from an unassisted both-seat contested replay
with a separately qualified opponent; fix only an actual bounded policy failure.
Both retained full-game seed assignments keep the original completion ceiling.
Ordinary process/entry and identified served/rendered acceptance remain distinct
with their existing owners. No deployment, external model, paid asset, new long
self-play or duplicate Millrace collection occurs in this slice.
