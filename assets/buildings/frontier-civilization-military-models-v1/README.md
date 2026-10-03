# Frontier military buildings: local Complete models and captures

Barracks and Archery Range authored from the already-public
[selected concepts](../frontier-civilization-concepts-v1/README.md), 3 October 2026.
These are original deterministic Blender models with project-authored textures,
not re-exports of the older military sample or concept-image billboards.
No provider, credits, rigging or animation purchase was used.

The [normal selector](../../../src/frontier-building-preview.mjs) binds their
Complete views. The older direct packs remain loading/construction/damage
fallback. Deployment and native gameplay appearance remain **unverified**;
the building workstream retains acceptance and the
[replacement guide](../../../docs/frontier-barracks-range-authoring.md).

## Registered views

Every image retains the full original 1024 × 1024 transparent canvas at 128
pixels/world unit, 46° elevation and eight 45° azimuths. Both grounded bases
measure 2.799999952316284 × 2.799999952316284 world units, rounded to 2.8 for the
capture contract, within existing 3 × 3 occupancy. No fitting or cropping is
used for runtime. The common analytical ground anchor is
`[512, 647.1527325565025]`; raw Blender float projections are retained in the
[capture manifest](captures/capture-manifest.json). Their maximum deviation is
0.000465686 pixel, below the declared 0.001-pixel roundoff tolerance.

| Azimuth | Barracks | Archery Range |
| --- | --- | --- |
| 0° | ![Barracks front](captures/barracks-complete-view-00.png) | ![Range front](captures/archery-range-complete-view-00.png) |
| 45° | ![Barracks 45 degrees](captures/barracks-complete-view-01.png) | ![Range 45 degrees](captures/archery-range-complete-view-01.png) |
| 90° | ![Barracks side](captures/barracks-complete-view-02.png) | ![Range side](captures/archery-range-complete-view-02.png) |
| 135° | ![Barracks 135 degrees](captures/barracks-complete-view-03.png) | ![Range 135 degrees](captures/archery-range-complete-view-03.png) |
| 180° | ![Barracks rear](captures/barracks-complete-view-04.png) | ![Range rear](captures/archery-range-complete-view-04.png) |
| 225° | ![Barracks 225 degrees](captures/barracks-complete-view-05.png) | ![Range 225 degrees](captures/archery-range-complete-view-05.png) |
| 270° | ![Barracks opposite side](captures/barracks-complete-view-06.png) | ![Range opposite side](captures/archery-range-complete-view-06.png) |
| 315° | ![Barracks 315 degrees](captures/barracks-complete-view-07.png) | ![Range 315 degrees](captures/archery-range-complete-view-07.png) |

## Authoring and provenance

[Model/source/material provenance](model-provenance.json) records both concept
hashes, exact rendered-source and published-source hashes, 19 original material
texture hashes, geometry measurements and model hashes. Published scripts differ
from the executed private source only in repository-relative paths, creating
output directories and publication wording. Editable Blend/GLB files, original
scripts and exploratory renders are retained privately; they are not runtime
meshes or public downloadable source files. No private Library identity or
review archive is published here.

From the repository root, using Blender 4.3.2, numpy and Pillow:

```sh
python3 assets/buildings/frontier-civilization-military-models-v1/source/prepare_materials.py
blender -b -t 4 --python assets/buildings/frontier-civilization-military-models-v1/source/build_military.py -- --asset barracks --views 0,1,2,3,4,5,6,7 --samples 48
blender -b -t 4 --python assets/buildings/frontier-civilization-military-models-v1/source/build_range.py -- --views 0,1,2,3,4,5,6,7 --samples 48
```

Run reproduction in a disposable checkout; these commands author local models,
textures and capture receipts. They do not regenerate renderer manifests or
approve changes. Source Cycles bump nodes remain in editable Blender materials;
the exported GLBs have UVs and embedded base-color textures, with no baked
normal-map claim. Physical Blender light powers share the recorded direction
with the previous set; they are not equivalent to Three light intensities.
Both portable scripts were run in a disposable source tree: nineteen generated
texture hashes matched, both view-01 RGBA pixel arrays matched exactly, and both
GLBs matched byte-for-byte. PNG file hashes differ because Blender adds local
file path/date/timing metadata. Original capture PNGs are preserved unchanged;
no all-eight reproduction or native renderer claim follows from this check.

## Acceptance and preserved limits

Direct inspection and independent source review covered all sixteen views.
The Barracks rear foundation duplication was corrected; rejected rear renders
were retained. The Range's targets were moved forward after the first capture
hid them behind its canopy; that first view was retained. Cream/oak/sage,
arched military entrance, sheltered stores, targets, bow rack and annex remain
recognizable. Both models simplify the illustration; Barracks is taller and
narrower. Actual Worker clearance, live team-standard legibility, native depth,
ordinary/strategic game appearance and matched-set style acceptance remain open.

There are no matched Foundation, Frame, Damaged or Critical captures and no
baked team flags/masks. Existing live team geometry and feedback stay outside
the captured fallback. Only the two manifests and sixteen original PNGs
(12,225,318 image bytes) are admitted to HTTP/Docker/release output. Source
scripts, provenance, models, textures and review galleries do not ship.
