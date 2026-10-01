# Vesperra pod-vine authored views v1

[Selected source sheet](source.png), 1 October 2026, Built-in ImageGen.
[Exact prompt chain](PROMPTS.json) records two rejected single-view drafts and
the selected shared sheet. It interprets the approved pod-vine as an oblong
woody mound: broad front/rear, narrower sides, three violet pods with changing
occlusion. These are authored front/right/rear/left drawings, not measured
3D renders or proof of exact 90° rotations and physical continuity.

The selected PNG remains unchanged. The generated sheet's unequal view cells
are isolated through explicit rectangular regions. All four are translated
into 884×440 source canvases and resized together to 512×255; side views are
not independently enlarged. Contact proxies use alpha≥8 lower bounds and
horizontal silhouette centers. They are visible-footprint registration aids,
not certified anatomical root landmarks. [Manifest](manifest.json) records
those crops/translations, source/reference hashes and atlas rectangles.

The 2560×383 atlas contains four 512×255 frames with 64-pixel transparent
gutters. Source/decoded atlas alpha is checked exactly. The shared 1.10431×0.55
world card and bottom-center pivot remain the registered plant dimensions.
The new painted mound occupies a tighter footprint inside this card than the
original source; this is not an exact size/branch reconstruction of that art.

`createEnvironmentSpriteInstances` now uses the atlas for pod-vines. A stable
cell-based view choice supplies fixed-camera orientation variety in woodland
companions and independent margin beds. The renderer disables mirroring and
billboard yaw for this plant, keeping upper-left lighting and its view through
clear/reset and foundation restoration. `?plantViews=legacy` restores the
original single-view sprite. The fixed RTS camera is unchanged; these frames
are not dynamically selected by a freely orbiting camera.

```sh
python3 scripts/build-podvine-views.py
python3 scripts/build-podvine-views.py --write
```

The default command verifies the current pack. `--write` rebuilds the atlas,
preview and generated runtime configuration; it rejects changed selected
source/reference bytes. [Runtime and release evidence](../../../docs/qa-evidence/vaelora-podvine-authored-views-2026-10-01/README.md)
checks all four frame bindings, fixed-camera roll, no mirroring, repeatability,
legacy selection and existing vegetation lifecycle contracts.

This pack has one full appearance across four authored views. Independent pod
harvesting and its worked/low/depleted poses remain absent. No new yield,
collision, route rule or map-authoring resource is introduced.
