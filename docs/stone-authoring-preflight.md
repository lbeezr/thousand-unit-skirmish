# Proposed Stone authoring fixture

This is preparation for the [mineral decision](mineral-economy-readiness.md),
not a playable map or an adopted economy. Content/balance is currently completing
Farm. Its Stone report must select the economic ID, distinct paid sink, price,
node budget, and baseline/profile compatibility policy before runtime admission.
`stone` is only the proposed ID here; renaming the fixture after that report is
part of the coordinated implementation.

The [content recommendation](stone-defense-contract-proposal.md) now keeps ID
`stone` and proposes an optional Watchtower sink at 50 Stone, with 200 finite
stock per seat and explicit legacy-profile migration. The 101-stock preflight
below remains uneven compatibility test data; the later playable candidate uses
a separate 67/67/66 stock split. Runtime admission remains closed meanwhile.

## Deterministic layout and node shape

[The offline fixture](../scripts/stone-authoring-fixture.mjs) loads Open Field
without changing any existing field. It separately returns six proposed nodes:
three on each side, mirrored in world space, seed 93000, radius four, anchors
at (-12.5, 10.5) and (12.5, 10.5). Each seat has test stock 101 split 34/34/33.
These deliberately uneven numbers test stock conservation, not approved prices
or yields. Stable IDs begin `stone-candidate-s0-` / `stone-candidate-s1-`.
Each node uses the existing `{id, type, x, z, stock}` shape; no terrain rectangle,
wildlife metadata, renewable stock, starting Stone bank or new catalog map is added.

The fixture reuses the existing wood cluster geometry internally, then labels
only the offline candidates with proposed type `stone`. No alias enters a
playable map, deposit path or bank. Tests prove bounds, distinct cells/IDs,
spacing, mirrored world-space travel distances, explicit equal stock, reserved
Town Center/build space, both-seat reachability, and unchanged food/wood nodes.
This establishes layout constraints, not contested-match balance or path parity.

## Compatibility proof and future migration contract

Run `node --test scripts/stone-authoring-fixture.test.mjs`. Native host publication
rejects proposed Stone nodes and zero/positive starting Stone banks without
changing the live map, food/wood banks or saved catalog. Normal brush authoring
also rejects Stone. A real schema-11 checkpoint fixture migrates with exact
fractional food/wood banks, cargo, partial stock and depleted stock preserved;
it receives no mineral grant. These are injected compatibility fixtures, not
proof of a live Stone harvest or paid spend.

Current rules reject Stone map/cargo saves and an incompatible future ruleset
pin carrying a hypothetical Stone bank; each rejected file remains byte-exact.
This does not define a Stone schema or migration. The eventual runtime owner
must preserve old paid queues/refunds and depleted nodes, explicitly initialize
any new bank under the agreed legacy policy, and keep incompatible saves
recoverable. Adding a field to a same-pin save is not a supported mineral profile.

## Placement and visual brief for the later vertical slice

Keep candidate mineral nodes on open ground with Worker approach space; preserve
the tested two-cell spacing and six-cell base clearance, and leave existing
food/wood, forest, road and elevation placement intact. Stone terrain remains
blocking terrain with no economic stock. A finite mineral visual must have a
distinct selection/stock label, cargo identity and depleted state tied to the
authoritative node; ore art alone must never advertise a harvest command.
Use one readable Stone silhouette at normal and strategic zoom before metal
variations. Do not replace terrain obstacles with resource nodes or obstruct
the approach with decorative rocks. No ore asset or appearance acceptance is
claimed here. Native art/play capture follows the approved ID and complete
node → cargo → deposit → bank → paid sink → refund/depletion/recovery loop.
