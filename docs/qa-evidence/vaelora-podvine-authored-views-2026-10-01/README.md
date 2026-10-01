# Vesperra pod-vine authored views — 1 October 2026

Working branch `codex/vesperra-podvine-views`, based on main `e0de5bf0`.
Isolated local server at port 4178 with fresh Bellweather baseline storage.
No hosted or performance claim.

```sh
python3 scripts/build-podvine-views.py
RTS_QA_URL=http://127.0.0.1:4178 RTS_VEGETATION_REGION=vesperra RTS_VEGETATION_PODVINE_VIEWS=1 RTS_VEGETATION_UNDERSTORY=1 RTS_VEGETATION_JUNGLE=1 RTS_VEGETATION_PLANT_CONTRACT=1 RTS_VEGETATION_OCCUPATION=1 RTS_VEGETATION_OUTPUT=docs/qa-evidence/vaelora-podvine-authored-views-2026-10-01 node scripts/qa-vegetation-browser.mjs
```

[Close view lineup](podvine-views-close.png) shows front/right/rear/left at the
actual fixed-camera construction, with cyan ground-contact markers.
[Strategic lineup](podvine-views-strategic.png) verifies small-scale silhouettes.
Side views are visibly narrower; rear pods expose backs and different stem
surfaces. These are reviewed authored drawings, not measured geometry or proof
of exact angle/branch continuity. Alpha-based contact proxies remain approximate.

[View proof](podvine-views-proof.json) checks 80 instances across all four frame
indices (15/15/24/26), exact manifest rectangle binding, repeatable selection,
positive matrix determinants despite requested flips, upright fixed-camera
basis and successful WebGL rendering. The `plantViews=legacy` reload restores
the original `vesperra-spiral-podvine.webp` without authored atlas metadata.
The export checker verifies hashes, source extraction, shared scale, runtime
configuration and exact decoded alpha for all four atlas frames.

[Understory](understory-proof.json) retains 75 companions in four species
batches. [Margin proof](jungle-proof.json) retains 79 plants and four batches;
all margin point inputs match the preceding quiet-ground capture. Pod-vine
matrices now deliberately ignore flip/yaw because the authored frame supplies
orientation. [Plant contracts](plant-contract-proof.json) verify all 26
geometries, wrong-scale rejection, all 21 companion lifecycles and unchanged UV
selection through clearing/reset. All nine foundation occupation categories
hide and restore exact matrices. [Mixed woodland lineup](understory-renderer.png)
shows the default in context, and [ordinary margins](jungle-ordinary.png) show
the actual regional map.

Full browser run ends with ready boot, empty runtime error and no recorded
browser errors. [Disposable release proof](release-pack-proof.json) confirms
byte-identical server, loader, generated configuration and atlas in the release
context. Docker admits only the new runtime WebP from its source pack; the
source/prompt/review files are retained in Git. The disposable release context,
QA browser and local server were removed/stopped after verification.

The painted mound has a tighter width within the existing world card than the
original single source. Its physical branch identity and anatomical root
alignment remain approximate. There is no freely orbiting camera remapping,
independent pod gathering rule or worked/low/depleted artwork in this pack.
