# Mill food-only drop-off — 3 October 2026

[PR #63](https://github.com/lbeezr/thousand-unit-skirmish/pull/63) adds Mill to
Frontier through the existing content registry and lifecycle. Its provisional
values are 75 wood, 15 Worker-seconds, 1,000 HP and a 3 × 3 footprint. The
procedural House profile is an explicit placeholder; no Mill art was authored
or purchased. Frontier remains the only registered playable faction.

The validated ruleset is
`v1:c8a30de45cf9bfa527046662d022a0dc2cb28efc3ddd8b24521c5992eae328c2`.
Removing Mill and its faction reference reproduces the immediately prior
`v1:fe00d0541953e6ed6d2c4e121789dd26fa6a962abce9ab8b4de1f067064ad801`;
all existing building, unit and technology values are unchanged.

## Paid Mill and retained cargo proof

`node scripts/mill-scenario.mjs` uses a published 64 × 64 open-field-derived
map, 24 starting units, 1,000 food/wood per seat and real 1,000-stock food/wood
nodes. Both seats issue ordinary commands to pay for Mill, resume unfinished
construction after restart, gather and deposit food at Mill, and deposit wood
at their Town Center. Stock plus cargo plus banks reconcile with authored stock
and paid costs. No bank credit or carried cargo is injected.

The scenario also checks foreign build/cancel/resume/repair/Return cargo rejection,
paid repair across restart, proportional cancellation with replay rejection,
Mill destruction and food rerouting, and no duplicate deposit after recovery.
Damage and attacker positions are declared checkpoint fixtures; construction,
harvest, spending and deposits remain real commands.

Stop followed by Return cargo delivers retained food to Mill and retained wood
to Town Center, clears source intent and leaves each Worker idle after deposit.
The contract test rejects wood when only Mill is reachable, preserving cargo
and prior orders. The existing final sheep-food scenario also passes unchanged:
both depleted nodes remain empty, both seats bank exactly 0.5 food, and duplicate
orders and restart never credit the last food twice.

The checkpoint scenario starts with real funded Worker queues and paid palisade
sites/orders. Re-pinning that valid save to the exact prior ruleset preserves
match identity, banks, Worker training, building IDs and wall construction orders.
Older content pins cannot claim Mill entities; unknown revisions remain rejected.

## Complete-roster regression evidence

Both normal and reversed-seat settlement dispatch passed with clean source
`17a5a65faef73ce55c80fecc848b2980658d9c97`. Each executed 52 actual paid
commands, built all ten registered buildings, completed all technologies and
products, restored queues/research/cargo, and passed host reset. Each seat spent
1,385 food and 2,720 wood. The layout has 264 blocked and 3,832 connected free
cells. See the [normal result](qa-evidence/mill-food-dropoff-2026-10-03/settlement.json)
and [reversed result](qa-evidence/mill-food-dropoff-2026-10-03/settlement-reverse.json).

Repeatable checks:

- `node --test scripts/mill-contract.test.mjs scripts/roster-building-ui.test.mjs scripts/return-cargo.test.mjs scripts/mature-settlement-scenario.test.mjs`
- `node scripts/mill-scenario.mjs`
- `node scripts/ruleset-checkpoint-scenario.mjs`
- `node scripts/interrupted-cargo-return-scenario.mjs`
- `node scripts/paid-palisade-scenario.mjs`
- `node scripts/mature-settlement-scenario.mjs` and the same command with `--reverse-seats`

Independent review found no remaining actionable issues. Focused registry,
combat, lifecycle, routing, presentation, HUD, population, snapshot and CI-shard
checks passed, as did documentation links, client module serving and clean
release packaging. Native browser visual QA was not captured in this slice.

Next content work: compare Mill's price and durability against actual food-trip
savings in player matches; author distinct Mill construction/damage artwork;
retain complete-roster fixture coverage as future registered content is added.
