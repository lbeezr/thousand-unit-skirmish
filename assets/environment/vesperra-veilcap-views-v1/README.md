# Vesperra Veilcap authored views

Built-in ImageGen, 1 October 2026. [Source sheet](source.png) interprets the
[approved Veilcap source](../frontier-v1/vesperra-veilcap.png) as front/right/rear/left
views of one five-mushroom colony. Pale ivory stems, lilac-violet mottled caps
and restrained petrol/olive moss retain Vesperra's palette. Cap overlap, stem
occlusion and narrower side footprints distinguish the drawings. Some young
caps are hidden behind larger forms in rear/side views. These are approximate
authored interpretations, not measured 90° rotations or certified physical
continuity. [Exact prompt](PROMPTS.json) preserves generation provenance.

The unchanged 2172×724 PNG has unequal view cells. Explicit rectangular regions
isolate them, translate into common 560×591 canvases, and resize together to
512×540. Side profiles are not enlarged. The [manifest](manifest.json) records
hashes, crops, contact proxies, world dimensions and atlas rectangles. Alpha≥8
lower bounds and horizontal silhouette centers provisionally register the moss
footprint; these are not anatomical stem-root landmarks. The shared export has
a slightly tighter painted footprint than the original single view, so this
does not claim an exact size reconstruction of that image.

The instance loader now selects a stable cell-based heading from this atlas in
woodland companions and independent Vesperra margin beds. Cards retain the
registered 0.61614×0.65 size and bottom-center pivot. Mirroring and card yaw are
disabled for authored views, preserving lighting and zero screen roll. Positive
wood stock retains the selected full appearance, zero hides the companion, and
reset restores it. There are no worked/low fungus drawings or independent fungus
harvest rules. Margin placement, collision and resource yields remain unchanged.
`?plantViews=legacy` restores the original single view for both Veilcap and
pod-vines. This does not dynamically remap a freely orbiting camera.

```sh
python3 scripts/build-veilcap-views.py
python3 scripts/build-veilcap-views.py --write
```

The default checks selected source/reference hashes, exact decoded alpha,
extraction records and generated runtime configuration. `--write` exports the
2560×668 atlas with 64-pixel gutters and the neutral preview. The
[runtime evidence](../../../docs/qa-evidence/vaelora-veilcap-authored-views-2026-10-01/README.md)
checks all four headings, stock/reset, mixed woodland and release bytes. The
generic directional loader preserves pod-vine full/worked/low stock behavior.
