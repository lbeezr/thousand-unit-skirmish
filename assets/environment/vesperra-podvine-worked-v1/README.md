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

The original source checkpoint preceded runtime binding. The shared-scale
review and binding below now provide full/worked appearances. Anatomical root
certification, separate low/depleted poses and independent pod gathering remain
unfinished.

## Shared-scale comparison export

[Review manifest](review-manifest.json) and [paired renderer evidence](../../../docs/qa-evidence/vaelora-podvine-worked-registration-2026-10-01/README.md)
now compare eight full/worked frames at common scale and unchanged world pivots.
The review adds crop padding to retain the worked left leaf tip and uses an
aspect-matched, slightly taller card. Contact registration remains provisional; the runtime binding below preserves
the existing registered card dimensions.

```sh
python3 scripts/build-podvine-worked-review.py
python3 scripts/build-podvine-worked-review.py --write
node scripts/preview-podvine-worked.mjs
```

## Woodland stock binding · 1 October 2026

The default instance loader uses this eight-frame atlas. Full woodland stock
uses the full row; positive stock below six uses the worked row; zero stock
hides the companion. Reset restores full. Stable cell-based direction selection
persists through every state. Independent margin plants remain full because
they have no stock binding. `?plantViews=legacy` retains the original single
view. No new resource, yield or collision rule is introduced.

Runtime cards retain the registered 1.10431×0.55 size. All eight frames therefore
share a roughly 1.5% vertical compression relative to the aspect-matched review
card; individual views/states are not resized separately. The
[configuration](../../../src/podvine-worked-pack.mjs) explicitly records runtime
dimensions, while the review manifest records both review and runtime dimensions.
[Runtime evidence](../../../docs/qa-evidence/vaelora-podvine-worked-runtime-2026-10-01/README.md)
checks frame transitions, matrices, clear/reset, margin independence and release
bytes. The worked row also serves low positive stock; no distinct low pose is
claimed.
