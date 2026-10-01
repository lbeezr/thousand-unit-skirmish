# Vesperra Veilcap worked · source v2

[Selected source](source.png) retains the lilac/ivory mushroom colony with
opened moss dressing and small medium-cap rim nicks from nearby woodland work.
The tall cap stays intact. This is disturbance, not independent fungus gathering.
[Exact prompt](PROMPTS.json) references the [intact sheet](../vesperra-veilcap-views-v1/source.png).

The generator returned PNG bytes without a filesystem output hint. The source
is saved directly from those returned bytes, without repainting or alpha edits.
The first generated preview was not saved; this second output is selected.
Ground-dressing reduction is subtler than requested and needs game-scale review.

These four views are approximate paintings, not measured rotations. Camera
request: 45.436° orthographic elevation, zero roll. The runtime now loads an eight-frame full/worked atlas with paired source
coordinates.
Independent margin colonies must remain full; empty woodland companions hide.

The [atlas](veilcap-worked-atlas.webp) and [manifest](manifest.json) use common
564 × 591 canvases, resized together to 512 × 537 with 64-pixel gutters.
The rear/left separator is x1660, in the transparent gap of both source sheets;
the old x1680 crop included neighboring worked pixels. Four extra canvas pixels
prevent rear-edge clipping. Intact-reference horizontal anchors and paired
maximum lower bounds register both states. This is provisional, not anatomical
certification. Runtime dimensions remain 0.61614 × 0.65; the painting has a
slightly tighter footprint and modest aspect approximation, not exact old pixels.

Stock 6 uses full; 5–1 uses worked; 0 hides and reset restores full.
Independent margin colonies stay full. Distinct low art remains unfinished.
`python3 scripts/build-veilcap-worked.py --write` exports; without `--write`
it verifies source hashes, extraction, exact decoded alpha and configuration.
