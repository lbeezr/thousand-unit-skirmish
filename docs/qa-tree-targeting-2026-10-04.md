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
their received stock is zero. Fog-hidden cells retain last-known stock and are
excluded from visible-art picking.

Six authored wood nodes use their existing `nodeId` and a separate stock pool.
Forest wood remains 18,972 (3,162×6); authored node wood remains 7,950. No amounts,
map bytes, art pixels, server jobs or economy rules change in this fix.

## Demonstrated discrepancy and default fix

The former forest picker scans a fixed 30-pixel circle at the trunk plus1.25
world units. The new CPU regression decodes actual committed RGBA source pixels,
transforms opaque crown texels through the real factory's instance matrices,
and clicks those coordinates at closest game zoom. Several tall-tree crowns
miss the old circle. The shorter thicket can remain inside it. This is source
pixel/geometry evidence, not a rendered screenshot or a missing registration.
The highpine source page's alpha equals its runtime WebP alpha exactly.

The default context-order path now raycasts the current canopy/wood-node
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

Seven focused picker tests cover all five canonical families and normal
context-click→Gather serialization, alpha overlaps/gaps, all current atlas
attribute forms, generic stock-atlas map transforms, parent/mirror transforms,
inactive/hidden/clipped instances, stock/fog negatives, image replacement and
map identity lifetime. Real image decode is mocked only for factory loading;
the relevant actual PNGs are decoded by the existing Node RGBA decoder.
Architecture, both checked-JavaScript projects and the53-test focused client
suite pass at the source recorded in the owning PR.

```sh
node --test scripts/environment-instance-picking.test.mjs
```

## Remaining ordinary-game acceptance

The qualified hosted backend in [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323)
is proven; no repeated capability probe or Mac path is needed. The ordinary
adapter interface is being integrated by the CI/capture owner in
[PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331). Terrain owns a
bounded Terraced Vale tree case using that runner and its existing checkpoint
helper. Its exact registered entry is a concrete shared dependency: the initial
registry covers animation, novice flow, Worker routes and buildings, not trees.
Do not substitute the old forced Open Field pilot for this case.

Enter through the normal menu, create a Terraced Vale Tiny room, select one
Worker and click an opaque upper crown at ordinary and closest zoom. Capture
the same default rendered frame, actual issued Gather identity and received
forest/node stock. Check a decorative plant, fog-hidden cell and depleted tree;
they must not manufacture a wood target. Repeat after a legitimate rematch or
map rebuild and inspect lifecycle/root/depth registration. Preserve the
forest-mass/frontier behavior owned by the server forest task `01a1072a`.

Record tested source, clean release digest and deployed source separately in
the owning PR. Source/CPU/package checks do not close ordinary pixels or staging
acceptance. Terrain retains that outcome; CI owns the shared hosted dispatch.
