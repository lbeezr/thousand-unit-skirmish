# Tree artwork and Gather targets — 4 October 2026

Terrain integration owns the reported visible-tree targeting issue through the
default client, release, identified staging revision and ordinary cloud capture.
The report suggested that newer designs lacked harvestable registration. The
canonical **Terraced Vale Tiny** (`veyrholds-terraced-vale`, 160×160) audit instead
found complete registration and a smaller client picking discrepancy.

## Actual mapping

Every one of the map's 3,162 forest cells has exactly one returned canopy slot,
using the existing `forestCell = row * width + column`. There are no extra slots
and no missing IDs. The canonical factory produces these current families:

| Family | Slots | Rendering and authoritative identity |
| --- | ---: | --- |
| Veyrholds highpine | 605 | Instanced lifecycle atlas, one existing forest cell |
| Oak | 628 | Eight Meshy directional views, one existing forest cell |
| Silver birch | 630 | Individual image, one existing forest cell |
| Field maple | 640 | Individual image, one existing forest cell |
| Hazel thicket | 659 | Individual image, one existing forest cell |

The same factory returns forest-cell slots for the other regional canopies,
regional groves and age variants. Lifecycle atlases, individual-state fallbacks
and directional views change presentation, not their IDs. Regional understory
is attached to its host forest cell and clears with that cell. Canonical ridge
grass and suncrest, other land vegetation, rocks and broken trunks are decorative;
they have no separate wood stock. Depleted slots can retain stump artwork while
their received stock is zero. Unexplored forest is excluded from picking.
Remembered forest scenery can name its public authored forest group; that does
not disclose hidden current stock. The server chooses a live visible frontier.

Six authored wood nodes use their existing `nodeId` and a separate stock pool.
Forest wood remains 18,972 (3,162×6); authored node wood remains 7,950. No amounts,
map bytes, art pixels, server jobs or economy rules change in this fix.

## Demonstrated discrepancy and default fix

Visual development backing reuses the committed
[highpine lifecycle page](../assets/environment/frontier-v1/veyrholds-lifecycle-atlas.png),
[oak view](../assets/environment/frontier-meshy-fixed-camera-v3/oak/references/frames/color/view-00.png),
[silver birch](../assets/environment/frontier-v1/silver-birch.png),
[field maple](../assets/environment/frontier-v1/field-maple.png) and
[hazel thicket](../assets/environment/frontier-v1/hazel-thicket.png).
The bounded comparison is the same opaque crown texel against the former
30-pixel trunk circle and the existing instance geometry at closest zoom.
No new visual treatment is produced. Capture plumbing has N/A creative backing.

The former forest picker scans a fixed 30-pixel circle at the trunk plus1.25
world units. The new CPU regression decodes actual committed RGBA source pixels,
transforms opaque crown texels through the real factory's instance matrices,
and clicks those coordinates at closest game zoom. Several tall-tree crowns
miss the old circle. The shorter thicket can remain inside it. This is source
pixel/geometry evidence, not a rendered screenshot or a missing registration.
The highpine source page's alpha equals its runtime WebP alpha exactly.

The default context-order and hover paths now raycast the current canopy/wood-node
instance and tests its actual image alpha. It follows the material map matrix,
per-instance atlas rectangle, flips, world/parent transforms, active stock
stage, camera clipping and alpha threshold. Transparent foreground pixels let
the tree behind remain targetable. The original trunk/label targets remain
available, including when image decode or alpha readback is unavailable. A
depleted wood node no longer emits Gather from the old label target.

The picker returns only the supplied authoritative `forestCell`/`nodeId`; pixels
cannot create an ID, resource or stock. New map slots, lifecycle UVs and replaced
decoded images are read on each click. Alpha bytes are cached by image identity,
without adding image requests or GPU textures. Level-zero alpha models ordinary
magnified art; distant mip coverage still requires visual acceptance.

Nine focused picker tests cover all five canonical families and normal
context-click→Gather serialization, alpha overlaps/gaps, all current atlas
attribute forms, generic stock-atlas map transforms, parent/mirror transforms,
inactive/hidden/clipped instances, stock/fog negatives, image replacement,
map identity lifetime and bounded browser alpha caching/failure fallback. Real image decode is mocked only for factory loading;
the relevant actual PNGs are decoded by the existing Node RGBA decoder.
Architecture, both checked-JavaScript projects and the53-test focused client
suite pass at the source recorded in the owning PR.

```sh
node --test scripts/environment-instance-picking.test.mjs
```

## Remaining ordinary-game acceptance

The qualified hosted backend in [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323)
is proven; no repeated capability probe or Mac path is needed. The ordinary
version1 adapter interface from merged
[PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331) is reused by
[`renderer-tree-targeting-scenario.mjs`](../scripts/renderer-tree-targeting-scenario.mjs),
exporting `tree-targeting`, `contextVersion=1` and `run(context)` without a
launcher or import-time work. Terrain owns this bounded Terraced Vale case.
CI owns its shared registry/dispatch entry, requested on PR331; the initial
registry covers animation, novice flow, Worker routes and buildings. No tree
GPU run has occurred and the absent tree entry is not a passed capture.

The adapter enters through Create Room and the visible host lobby map control,
connects a second ordinary seat, readies both players and launches Skirmish.
It selects an own-seat Worker with pointer input and clicks a real home wood
node. The canonical opening has no currently visible forest cells: the adapter
issues a native Move to an open ground neighbor of public authored forest
geometry and waits for actual movement and received visibility. It then clicks
opaque forest pixels at ordinary zoom. It zooms through wheel input and
clicks a crown beyond the old circle, records the actual native Gather send and
applied-order acknowledgement, waits for legitimate harvested depletion,
checks unexplored/depleted exclusions, then uses Reset battlefield, readies and
launches the two-seat lobby again. It approaches the previously depleted
identity, requires its full six wood and a new forest epoch, and clicks that
same restored identity. Empty/partially restored target lists cannot pass.
Source-bound before/issued/negative/reset PNGs
receive small sanitized `tree-target.json` receipts. Stock, units, clips and
map state are never injected. A bounded read-only diagnostic describes existing
instances/seat stock and has no independent draw or command consumer. Hidden
current stock and opponent Worker rows are omitted. Remembered last-known
forest stock is omitted from current-stock capture targets while ordinary
authored-group picking is preserved. Six CPU adapter contracts cover
version/import, send privacy/bounds, independent-instance matching, open-ground
selection and the real canonical authority Move/Gather sequence. The fixed-tick
authority case reaches a visible frontier and depletes a real cell inside the
adapter deadlines; it does not execute the browser lobby or render pixels.

Inspect those actual images for root/depth/zoom/depletion, and click a visible
decorative plant separately; it must not manufacture wood. Decorative exclusion
is proven at source/CPU level but is not yet a separate image checkpoint in the
bounded adapter. Preserve the forest-mass/frontier behavior owned by server
forest task `01a1072a`. Missing negative targets return blocked checks; a phase
timeout/error fails and cannot become an ordinary-game pass.

Record tested source, clean release digest and deployed source separately in
the owning PR. Source/CPU/package checks do not close ordinary pixels or staging
acceptance. Terrain retains that outcome; CI owns the shared hosted dispatch.
