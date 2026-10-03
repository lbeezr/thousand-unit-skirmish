# Stone profile authoring and natural-loop proof

This prepares map/schema integration for the [Stone contract](stone-defense-contract-proposal.md).
The selected experimental ID is `stone`, with a 50-Stone Watchtower component
and 200 finite stock per seat. Finite Farm is integrated; its owned crop pool
stays separate from neutral authored nodes. Explicit Stone maps use the merged
typed ledger, client surfaces and schema-23 recovery; this slice adds matching
node admission and deterministic placement.

The [content recommendation](stone-defense-contract-proposal.md) now keeps ID
`stone` and proposes an optional Watchtower sink at 50 Stone, with 200 finite
stock per seat and explicit legacy-profile migration. The 101-stock preflight
below remains uneven compatibility test data; the later playable candidate uses
a separate 67/67/66 stock split. Baseline maps continue rejecting Stone nodes.

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
rejects Stone under the baseline profile. A real schema-11 checkpoint fixture migrates with exact
fractional food/wood banks, cargo, partial stock and depleted stock preserved;
it receives no mineral grant. These are injected compatibility fixtures, not
proof of a live Stone harvest or paid spend.

Baseline rules reject Stone map/cargo saves and an incompatible ruleset pin;
each rejected file remains byte-exact. The merged runtime owner supplies the
schema-23 migration, preserving old paid prices with a zero Stone bank.
Adding a field to a same-pin baseline save is not a supported mineral profile.

## Profile-aware schema and placement interface

The [runtime interface](stone-runtime-interface.md) owns `map.economyProfileId`:
omission means `food-wood-v1`; the experiment is `stone-defense-v1`. Null, empty
and unknown IDs reject. Pure cluster helpers now use its shared `economyResources`
registry, so the exact Stone selector can materialize typed `stone` nodes without
a wood alias. The agreed candidate keeps the historical anchors, seed,
geometry and stable namespace, with stocks 67/67/66 per seat. The historical
101-stock rejection fixture remains unchanged. The ordinary map catalog now includes
[Lab · STONE DEFENSE FIELD](../maps/stone-defense-field.json), using this agreed
200-stock layout and the explicit Stone profile.
Brush previews and undo/redo history include the resolved profile in their placement
fingerprint, so changing the profile requires a fresh preview/history. Omitted and
explicit baseline selectors retain the exact legacy fingerprint.

Normal import and native host publication admit Stone nodes only under the named
Stone profile, with the shared profile pin and paid Watchtower price. Omitted
selectors remain absent for legacy checksums. A mislabelled baseline checkpoint
is rejected and retained byte-exact. No ledger or migration implementation is duplicated.

To play Stone, choose **Create Room → Map → Lab · STONE DEFENSE FIELD**, then
both players ready and the host launches. No import or debug flag is needed.
To author another Stone map, import a map with `"economyProfileId":"stone-defense-v1"`.
The existing Resource Patches brush then includes Stone; a 200-stock patch with
three markers splits 67/67/66. Preview/apply/undo/redo use the normal controls.
Food/wood-only maps keep their original choices. The map editor uses a gray
`S` marker distinct from berries; terrain Stone remains blocking terrain.

Run `node --test scripts/stone-map-profile.test.mjs scripts/stone-authoring-fixture.test.mjs`.
The native test creates an ordinary invite room, selects the shipped map with the
actual lobby UI, readies both seats and launches without publishing custom JSON.
It never modifies saved banks, cargo or stock. Both seats start with zero Stone,
recover real carried Stone after a restart, return it
to their Town Center and exhaust their first 67-stock node. A Watchtower spends
50 food / 150 wood / 50 Stone. A restart preserves the frozen paid foundation;
cancellation refunds only its unbuilt fraction, and replay cannot refund twice.
Remaining nodes deplete to zero, with stock + cargo + bank + paid/lost construction
equal to 200 per seat through another restart. Food/wood nodes remain exact.
This is an authoritative server/client-command proof, not a human match or ore-art
acceptance. Room checkpoints are disposable; the map itself comes from the
checked-in shipped catalog. No generated ore asset is added.

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
