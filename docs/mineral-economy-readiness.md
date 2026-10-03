# Mineral economy readiness

Audit: 3 October 2026, fork main `e272e037d815f8db795507227c401ef4af3026d9`.
[Map authoring](map-authoring.md#resources-and-forests) ·
[Economy expansion decision](maps-resourcing-saga-plan.md#epic-5--economy-expansion-decision-experiment)

Food and wood are the only implemented economic resources. Stone obstacles are
blocking terrain, not finite harvestable Stone; gold and copper have no banks,
node types or paid consumers. Sheep and shore fish carry existing food identity,
not another currency. Ore artwork alone cannot complete this contract.

## Current two-resource boundaries

| Boundary | Existing contract | Required work for one mineral |
| --- | --- | --- |
| Content costs/drop-offs | [Gameplay definitions](../src/gameplay-definitions.mjs) require finite nonnegative food/wood costs and food/wood drop-off members. | Admit one chosen economic ID only with a matching paid consumer and debit/refund implementation. |
| Map authoring/admission | [Server](../server.mjs) `validateMapDefinition` and [client](../src/main.js) `validateImportedMap` admit food/wood nodes and starting banks. [Cluster helper](../src/resource-cluster-authoring.mjs) also restricts those types. | Extend all three admissions together; retain finite stock, stable IDs, bounds, collision, elevation, node cap and both-seat access. |
| Worker deposits | Server `teamFood`/`teamWood` are separate arrays. Deposit paths select wood when cargo is wood, otherwise food. | Explicitly dispatch the new bank; widening the node enum alone would miscredit its cargo as food. Use existing Worker capacity/rate and declared drop-offs. |
| Spending/refunds | Production, construction, research, cancellation and notices use food/wood fields. Repairs spend wood. | Charge and refund the mineral exactly once; decide repair policy explicitly rather than deriving it from a visual material. |
| Wire/UI/rendering | State publishes food/wood arrays with opponent banks hidden under fog. Client cargo decoders, HUD, cost labels and resource visuals assume two types. | Preserve filtering and old row layout; distinguish the new cargo, stock, shortfall and depletion. No food fallback label or decorative-only ore claim. |
| Recovery | Audited server checkpoint schema22 pins the ruleset revision and saves/validates/restores `teamFood`, `teamWood`, food/wood cargo and resource state. | Declare a versioned bank/cargo migration and old-client policy. Preserve legacy banks, cargo, consumed stocks, pending spends and refunds; never reset a depleted node. |
| AI | [Opponent](../src/pve-opponent.mjs) and [production policy](../src/pve-production.mjs) expose food/wood budgets, nodes, reserves and affordability. | Add the chosen mineral to the seat-filtered observation and bounded gather/spend policy; both AI and humans must reach the consumer. |

[Numeric ledger rounding](../src/economy-ledger.mjs) preserves fractional deposits;
it is not a resource registry or a third bank. Forest-cell wood remains a separate
source of the existing wood currency. Capture/timed rewards can stay food/wood
unless the mineral experiment actually needs another reward action.

## Concrete validation gap closed

Before this slice, adding `stone:100`, `gold:100` or `copper:100` to a unit,
building or technology cost passed shared definition validation. Payment code
still charged only food/wood. A prospective content author could therefore
declare a mineral price that the runtime ignored, including a supposedly paid
entry with `{food:0, wood:0, stone:100}`.

Shared validation now rejects unsupported cost keys, including zero-valued keys
and typos, and rejects non-object/array costs. Cost and drop-off validation use
the same private supported-resource set. Explicit food/wood zero prices remain
legal. This is a fail-closed boundary for the next content slice, not a general
resource registry or mineral implementation; adding a set member is insufficient.

No shipped definitions, maps, banks, wire rows or checkpoint schema change.
The audit-base canonical ruleset remained
`v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6`
before and after the guard. Existing valid saves retain the same pin.

## Proposed next mineral slice and ownership

The subsequent content recommendation is now explicit in the
[provisional Stone defense contract](stone-defense-contract-proposal.md): `stone`,
one Watchtower construction sink, 50-Stone price, 200 finite stock per seat and
an optional profile with preserved legacy food/wood prices. This audit's code
still admits only food/wood. The recommendation does not create a mineral bank
or authorize widening admission before the paid loop exists.

Recommend one **Stone** vertical slice with one consequential existing defense
spend, before evaluating one physical metal or separate gold/copper. This is a
proposal: no mineral identity, price or stock budget is adopted here. The
[decision plan](maps-resourcing-saga-plan.md#decision-register--recommendations-to-review)
still requires distinct roles and preserves the ordinary food/wood baseline.

Content/balance owns the first mineral's economic ID and one sink (candidate:
existing Watchtower construction or a registered defense upgrade), provisional
price/node budget, and the baseline/profile choice. Map/resource ownership starts
from that contract; it does not invent an ore price or create three ledgers.
Record the decision in the game bible and balance guide before admitting nodes.

The smallest useful player loop is a finite, seeded `type:"stone"` open-land node
→ Worker cargo → explicitly allowed Town Center/Storehouse drop-off → Stone bank
→ the approved paid defense → exact cancellation/refund/depletion/recovery. Reuse
existing IDs, stock and placement constraints; stone terrain remains terrain.
The first fixture should be symmetric, with food/wood unchanged and explicit
equal Stone stocks. No new mining building, metal roster or regenerating ore is
required to prove that loop.

Keep these responsibilities coordinated within that one vertical outcome:

1. Runtime/content owner supplies typed bank dispatch, cost/affordability/debit,
   cancellation/refund, snapshot filtering and an explicit compatible-save plan.
2. Maps/resource owner adds authoritative/editor/cluster validation together,
   seeded node placement, selection/stock editing, undo, JSON/draft/host round-trip
   and a truthful finite-node visual. Existing Sheep/fish/forest stocks remain intact.
3. UI/AI owners supply readable bank/cargo/shortfall/depletion cues and a filtered
   mineral gather/spend policy using the same authoritative commands.

A mineral-enabled rule profile must have an explicit map/ruleset selector and
matching server/client rules; none exists today. Preserve the old profile and
its saved prices. If the decision instead changes the default ruleset, provide
an explicit old-save migration or preserved legacy-load route. Simply deleting
the ruleset mismatch check or granting minerals to old saves is not compatible.

Acceptance: both seats deposit finite stock, pay the chosen price once, receive
only the defined cancellation refund, and recover through restart/reconnect and
rematch without minting resources. Add fog/AI and invalid map/content proofs.
Only then expose Stone in normal mineral-enabled map editing/play. Run paired
control/candidate matches before claiming better balance or approving gold/copper.

## Reproduction

The [offline Stone authoring fixture](stone-authoring-preflight.md) prepares
deterministic layout and compatibility proofs while the economic contract is
pending. It admits no new runtime resource and chooses no price or paid sink.

```sh
node --test scripts/gameplay-definitions.test.mjs scripts/ruleset-revision.test.mjs
node scripts/ruleset-checkpoint-scenario.mjs
```

The focused guard checks cover units/buildings/research, each unsupported mineral
and a typo at zero/positive amounts, malformed cost arrays, unchanged rejected
inputs, and supported zero-cost content. The native scenario proves registered
production, exact recovery and preservation/rejection of incompatible pins.
This slice adds no user-facing mineral controls or ore artwork; there is no new
Mac appearance to claim. The next Stone loop needs a native author/play recipe
after its actual ID, price, profile and stock budget are chosen.
