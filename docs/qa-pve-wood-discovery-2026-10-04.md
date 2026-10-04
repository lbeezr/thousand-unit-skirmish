# Medium native wood discovery and deposit qualification

[AI queue](pve-policy-backlog.md) · [Prior Scout gap](qa-pve-medium-recon-ring-2026-10-04.md) · [DTO contract](gameplay-command-observation-contract.md)

Opponent AI owner `01a10297`, 4 October 2026, Node 24.19.0. Audit base
`aacfee043ef0931e4e0a6973e3ea907295da969b`; integrated baseline
`bfdbb31eda6dea78c74f8052fdad606ca043940a`, containing forest owner
[PR341](https://github.com/lbeezr/thousand-unit-skirmish/pull/341) and Worker route
[PR330](https://github.com/lbeezr/thousand-unit-skirmish/pull/330).
Exact reviewed/merged identities and check exits belong to this PR's receipt.

## Demonstrated missing capability

The unedited unfinished PR281 Riven endpoint is still native Skirmish@1,
Azure seed 20260925 / Ember 0, tick 108000. PR338's retained one-minute replay
shows Azure's paid Scout revealing five currently visible living forest cells
from an initial zero. Ember starts with 37 and ends with 39 visible living trees.
Neither seat emits a forest Gather. The adapter only projects ordinary nodes,
Farms and Sheep; the policy only emits `nodeId`. Thus native Scout discovery
can never become a forest job. This is an AI input/output capability gap,
separate from the shared forest final-approach defect already corrected by PR341.

## Small AI-owned correction and shared boundary

The DTO adds `forestCells: [{cell,x,z,stock}]`, separate from ordinary resource
node IDs. Only currently visible authored tree addresses qualify. Current
peer-filtered changed stock overrides the native initial six Wood; cleared,
remembered and unknown cells are omitted. Missing legacy stock tables produce
no forest work. Hidden stock changes cannot affect the DTO or decisions.
Neither raw terrain nor the global stock table is a policy input.

When no currently disclosed positive ordinary Wood node remains, the existing
gather policy admits those trees as Wood sources and sends the existing
`gather {ids,forestCell}` packet. Ordinary-node preference, idle-Worker/load
rules, retry timing, production, Scout travel, fog, prices and victory remain
unchanged. Local model proposals remain node-only. No external model call occurs.

Forest owner `01a1072a` retains authority-side reachable visible frontier/group
selection, final approach, harvest range and work intent. Worker route owner
`01a101f7-5683` retains route shortening and original depot scoring. Concrete
packet/disclosure coordination is recorded on
[PR341](https://github.com/lbeezr/thousand-unit-skirmish/pull/341#issuecomment-5982504700)
and [PR330](https://github.com/lbeezr/thousand-unit-skirmish/pull/330#issuecomment-5982561260).
AI edits no authority, forest job, movement, map, admission or central CI file.

## Native paid prelude and outcome

The [helper](../scripts/pve-wood-discovery-case.mjs) uses the canonical unmodified
224×224 Riven map under native Skirmish@1. Both armies receive ordinary Hold
Position during the human setup; the opposing seat retains that legal defense.
Four ordinary Workers pay 200 Wood for a Stable, train a Scout for 40 Food/30 Wood,
then gather and deposit all 975 home Wood. The depleted boundary has empty
Worker cargo, zero local stock,995 bank Wood and no currently visible tree.
No position, casualty, stock, bank, order or checkpoint field is edited.

The unchanged full deterministic seed 20260925 policy then owns the tested seat.
The Scout moves through native authority and sight before the forest fallback
can issue Gather. The other military/economy decisions continue normally.
Both branches use the same legally obtained prepared checkpoint; the cold
branch saves immediately after the first accepted forest Gather and restores
a fresh fixture/policy without time advance. Complete both-seat observations
survive, with only the existing documented transient Worker-activity clear.

Times below are relative to the native depleted boundary:

| Seat | Scout forest disclosure | Accepted forest Gather | Warm deposit | Cold deposit | Delivered |
| --- | --- | --- | --- | --- | --- |
| Azure | 2s | 42s | 72.1s | 72.1s | 10 Wood |
| Ember | 1s | 42s | 98.133s | 98.1s | 10 Wood |

The bank increase equals the actual delivered cargo of the same living owned
generation assigned forest Gather. Native forest stock decreases. Complete
Wood accounting reconciles initial/final ordinary and forest stock, both banks,
living cargo and paid continuation spending; a planned command cannot satisfy
these witnesses. Each warm/cold branch repeats its own full trace/notices,
sampled two-seat views and final checkpoint exactly. Warm and cold are not
normalized into each other; Ember's one-tick difference is retained.

Two matched controls keep the Scout and all other native activity. One removes
only forest projection from the policy's input; the other retains projection
and planned Gather but suppresses only forest Gather delivery. Both still
discover the trees, but leave forest stock unchanged and have no forest-worker
deposit through the original 180-second bound. Each negative branch repeats
exactly. The paid prelude itself repeats from the same untouched opening.

```sh
node --test scripts/pve-wood-discovery.test.mjs scripts/pve-forest-disclosure.test.mjs
```

These cases are imported by the existing registered Worker-recovery and
wildlife-disclosure test entries. Each native branch runs in its own process
to release fixture module memory. The central CI registry is untouched.

## Qualification limits and next action

This closes the bounded paid depletion/discovery/forest-deposit capability;
it does not complete the historical 3600-second self-play, prove balanced
difficulty, or qualify general recovery against a competent opponent. The human
prelude holds the other army and begins with a substantial legitimately earned
bank; it is not a zero-bank survival or contested-economy benchmark. No new long
match, duplicate Millrace collector, rendered capture or deployment ran here.

Medium remains human-only with admission owner `01a103cc`. Next AI evidence is
an unchanged-ceiling completion check with both retained seed assignments and
a separately qualified opponent, followed by distinct ordinary process/entry
qualification. Human pacing/balance remains with `01a103e8`. Tiny actual rendered
entry/fog/economy/loss/reconnect/rematch acceptance uses the qualified shared
cloud capture interface and identified served source; this native proof does
not close it. CI's original-order Millrace shard passed 368/368 independently;
its historical timeout did not reproduce and no cause is inferred.
