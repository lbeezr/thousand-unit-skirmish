# Vesperra pod-vine worked appearance study

Built-in ImageGen, 1 October 2026. [Source](source.png) edits the
[four-view full plant](../vesperra-podvine-views-v1/source.png) into a disturbed
understory appearance: ragged foliage, exposed grey woody loops and pale clipped
stems. Violet pods remain attached. This depicts woodland disturbance, not an
independent pod harvest or a new resource rule.

[Exact prompt](PROMPTS.json) and [registration](registration.json) retain source
provenance. The selected PNG is unchanged, including its generated alpha.
Front/rear remain broad and the side views narrow; the palette and roots remain
recognizable. Clipped stems are larger than requested, so this reads as a fairly
strong disturbance rather than a barely worked plant.

The requested canvas preservation did not hold: the reference is 2206×713,
while this source is 2170×725. Occupied-column bounds are recorded separately.
They describe silhouettes, not anatomical root locations. Do not reuse the
full atlas's extraction rectangles directly or independently fit each pose to
its silhouette: that would risk scale and pivot drift.

This source is not runtime integrated. Next: align corresponding woody root
landmarks at a common scale, export padded frames, and compare full/worked poses
at identical fixed-camera pivots before binding woodland stock states. Existing
runtime pod-vines retain their full four-view atlas. Low/depleted poses and
independent pod gathering remain unfinished.
