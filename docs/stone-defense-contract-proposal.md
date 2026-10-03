# Provisional Stone defense contract

[Readiness audit](mineral-economy-readiness.md) · [Map-owner preflight](stone-authoring-preflight.md) · [Balance guide](first-skirmish-balance.md)

Recommendation after the finite Farm slice, 3 October 2026. This specifies one
next experiment; Stone remains unimplemented. Current playable maps retain
food/wood rules and the current Watchtower price. No gold/copper ledger or ore
asset is adopted.

## One ID, one paid sink

| Contract | Provisional recommendation |
| --- | --- |
| Economic ID | `stone`, display **Stone**; a finite, neutral open-ground node, distinct from blocking stone terrain. |
| Rule profile | Explicit opt-in `stone-defense-v1`; absence means the preserved food/wood baseline. Map and server/client rules must agree. |
| First sink | New construction of the existing `watchtower`, with unchanged HP, weapon, footprint, build time and prerequisites. |
| Price in that profile | Existing 50 food + 150 wood, **plus 50 Stone**. No other unit, building or technology acquires a mineral price. |
| Initial bank | Zero Stone for each seat. Preserve authored food/wood banks. |
| Source budget | **200 total finite Stone per seat** in a symmetric first fixture. Use three neutral nodes per side, split 67/67/66, with stable IDs. |
| Gathering | Existing Worker rate and ten-unit cargo capacity; typed Stone cargo and bank dispatch. Town Center/Storehouse accept Stone; food-only Mill does not. |
| Cancellation | Existing proportional unbuilt refund, including Stone, once. A complete tower supplies no refund. |
| Repair/destruction | Preserve current wood-only repairs; no Stone yield from repair, demolition or tower destruction. |
| Regrowth | None. Zero stock persists through recovery. Rematch uses the authored finite starting stock. |

Fifty Stone makes one node expedition and drop-off relevant to an existing
consequential defense. Two hundred pays the Stone component of at most four
Watchtowers before contesting the opposing stock; food, wood, labour and
population rules still matter independently. This is a test budget, not a
food/wood/Stone exchange rate, an observed tower optimum, or final balance.
Paired control/candidate human matches must test whether mining creates a useful
expansion/defense choice rather than merely delaying towers.

The explicit profile keeps the existing 50-food/150-wood Watchtower usable on
ordinary maps and prevents a currency experiment from silently repricing paid
legacy work. The profile needs real selection/admission/dispatch; it does not
exist today. Adding `stone` to the current private supported-resource set would
leave deposits, affordability, refunds and UI incomplete and must remain rejected.

## Save policy to implement with the runtime

Use an explicit new checkpoint schema (proposed next version **23**, subject to
other merged schema work) with a persisted rule-profile ID and typed Stone bank,
cargo and stock validation. Pin the resolved costs/drop-offs/profile in the
ruleset revision.

Exact supported legacy checkpoints migrate to the food/wood baseline profile
with Stone bank zero. Retain every food/wood bank, cargo fraction, depleted node,
Farm crop pool, paid foundation progress, production queue and research payment.
Never upgrade those matches to Stone prices or grant ore. Refunds use the
construction's original profile price; do not retroactively charge its difference.
Profile switching requires a fresh match, with a new initial economy, rather than
mutating a running checkpoint.

Stone-profile recovery accepts only the matching schema/profile/content pin and
valid typed state, including remaining/depleted ore, carried Stone and partially
paid Watchtowers. Old clients cannot resume a Stone match: provide an explicit
compatible-client message and retain the file byte-for-byte. Unknown future pins
stay rejected and recoverable; never reset resources or bypass the mismatch check.
The schema-11 food/wood fixtures in the preflight remain compatibility fixtures,
not proof that Stone migration already works.

## Content and map ownership boundary

Content/balance owns `stone`, the Watchtower sink, 50-Stone price, 200-per-seat
budget, profile choice and paid/refund/recovery contracts. The map/resource owner
owns node admission, cluster/editor/authoritative round-trip and placement using
that contract. Runtime, UI and AI must deliver typed deposit/spend/observation
before the map owner admits Stone into playable editing or host publication.

The merged offline preflight uses 101 per seat (34/34/33) to expose conservation
errors. Keep that uneven rejection/compatibility fixture as historical test data;
add a distinct 200-per-seat candidate once the complete Stone loop exists. Reuse
its seeded mirrored anchors, approach clearance and stable namespace unless
actual placement evidence requires a change. Do not rename terrain obstacles or
add Farm crops to the authored resource-node pool.

Keep runtime admission closed until both seats can run node → cargo → permitted
depot → bank → one paid Watchtower → partial cancellation/depletion/recovery.
Verify exact once-only refunds, Stop/Return cargo, foreign ownership, fog filtering,
AI affordability/gather/spend, current Farm/Mill conservation, legacy baseline
recovery and fresh-match reset. The first native scene needs a truthful Stone
stock/cargo/shortfall/depleted cue; one supplied or procedural placeholder is
sufficient. No new mining building or paid art is needed for that proof.
