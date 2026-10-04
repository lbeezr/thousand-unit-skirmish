# Independent Human foot-art source review — 4 October 2026

Read-only review of `/workspace/thousand-unit-skirmish`. No merge, push, checkout, source modification, deployment, paid provider, or merge-denial bypass was performed. The working tree remained clean. Read `AGENTS.md`, `docs/contributor-planning.md`, and the loader contract.

## Exact review scope and conclusion

| PR | Exact head | Authored comparison | Source-merge review conclusion |
| --- | --- | --- | --- |
| 228 Infantry | `5a9d6ae7a863c2eed4386a81a918ef08b4fdd4dc` | `be656c47fb6ecb83291878791bff17f4eb8f4cf3` → head | **No blocking findings** within the accepted short-motion/costume tradeoffs. One P3 bounds-metadata issue below. |
| 230 Archer | `3de0b6c5f44d786f113bb8b21ac252f4fed45ab7` | PR228 head → head | **No blocking findings** within the accepted short-motion/costume tradeoffs. Same P3 bounds-metadata issue. |
| 241 Spearman | `90b111779545e24dac25829b4010f71aa5378259` | PR230 head → head | **No blocking findings** within the accepted rigid-pose/finish tradeoffs. Same P3 bounds-metadata issue. |

This conclusion addresses the reviewed source milestones. It does not authorize or perform a merge, alter the recorded automatic rejection of PR228, or close deployed/native acceptance.

## Ranked finding

### P3 — art/culling bounds underestimate the rooted billboard envelope; nonblocking for the current consumer

Locations: `scripts/register-legacy-foot-sprites.py:148`–150 (PR228 generator, also consumed by PR230); `scripts/package-public-spearman.py:47`–48 (PR241); generated `artBoundsWorld` and `cullingBoundsWorld` records in the three manifests.

Both generators set symmetric X/Z radius to half of the largest alpha-box width. A frame is placed relative to its canvas root, and the current runtime then rotates that offset by the fixed camera quaternion and applies terrain depth correction. Half width does not account for either the root offset or that rotation. For example, Spearman `defeat-south-east-3` extends from −2.2274 to +0.1422 in billboard X at its declared scale, while the declared radius is only 1.2322.

A read-only enumeration of actual alpha ≥8 pixel centers through the existing placement basis and `spriteGroundDepthBias`, relative to ground and excluding the common 0.018 lift, found:

| Pack | Declared X/Z radius | Actual visible world X extent | Actual visible world Z extent | Example exceeding declared bounds |
| --- | ---: | --- | --- | --- |
| Infantry v4 | 0.6264 | −1.1597…+0.4493 | −1.1976…+0.3640 | `attack-east-1`, Z −1.1976 |
| Archer v3 | 0.5525 | −0.8624…+0.3564 | −0.8778…+0.3456 | `attack-east-0`, Z −0.8778 |
| Spearman v2 | 1.2322 | −1.9105…+2.0256 | −1.9477…+2.1215 | `defeat-south-3`, Z +2.1215 |

Impact: a consumer that relies on these exported bounds can crop/cull weapon or fall poses too early. The current unit runtime never reads these bounds and sets `mesh.frustumCulled = false` (`src/unit-sprite-runtime.mjs:374`), so no current gameplay failure follows from this issue.

Remedy: derive conservative bounds from all root-relative frame placements in the declared fixed-camera basis, including the existing depth correction, and preserve the independent shared `heightWorld / maxAlphaHeight` scale. Verify representative off-center strike and terminal-fall pixels are enclosed. This correction can be tracked separately without withholding the current source milestone.

## Independent evidence

- Compared each exact authored diff. The only production-code changes are role version admission/defaults and exact HTTP admission; packaging admits the same manifest/runtime/mask trio. No combat, stance, Worker/fishing, Sheep, state selector, protocol, or timing implementation edits occur in these authored diffs. The no-option Human roster selects Infantry v4, Archer v3 and Spearman v2.
- Read the registration/bake/packaging scripts, all three READMEs/receipts, and the retained rejected-iteration notes. Inspected the three complete review sheets and enlarged north/north-east/south-west attacks and north/south Spearman idle/strike/fall images. Short walks, Infantry wind-up/strike, Archer draw/release, terminal corpses, and Spearman articulated stride/thrust/backward fall are recognizable at source-preview size. Bow strings/anatomy and rigid geometry remain rough as disclosed.
- Infantry and Archer: confirmed all 48 output cells per role are byte-for-byte reconstructions of the declared original public connected components and translations. Eight separate body views proceed through the physical source columns 5/4/3/2/1/0/7/6; no copied SE artwork is counted as the other headings. These paintings are approximate views, especially in attack pose/aim, rather than calibrated 3D rotations. The source registration cannot independently certify exact drawn yaw.
- Spearman: actual GLB import, positive Z-axis rotations in Blender (the glTF +Y world-yaw equivalent), and the fixed Blender `(0.78,-0.78,1.12)` camera produce the declared game bearings. The source code actually transforms distinct left/right leg and arm sets, moves spear vertices separately from the helmet, and falls all retained parts. Twelve authored pose samples rendered into 96 distinct directional frames; no sprite reuse or paid provider operation is present.
- Imported public GLB core bounds are Z `0.0149999857…0.7925000191`, span **0.7775000334**. Declared body reference 0.8 is approximately 2.9% larger than the core; it is a reasonable conservative calibration, not an order-of-magnitude mismatch. Spear vertices span Z `0.0700000226…1.0950000286`, length 1.025. The larger Spearman envelope is explained by the broad rigid model, spear and actual backward-fall offsets.
- Independently recomputed camera/root projection `(128.000061,153.662537)` and source pose projections without rendering or writing source files. Geometric projections agree with stored alpha bounds to raster/antialias tolerance. Common canvas root/scale and four-pixel crop padding remain coherent; existing depth correction is screen-position preserving. In-game planted-root acceptance remains open.
- Verified all manifest file hashes and all **13** probe-archive entries and **99** narrow-camera archive entries against preserved per-file hashes. Existing source atlases/GLB/packs are not changed by the authored diffs. Runtime file exposure is explicitly limited; raw PNGs, derived Blender scene, receipt, review and rejected archives are absent from HTTP and Docker admission.
- Verified that the currently inspected pack/receipt/README/review bytes equal each pack's exact PR head, including source file hashes. No report is inferred from a different head.
- Independently ran `node --test scripts/registered-foot-sprites.test.mjs scripts/unit-animation-runtime.test.mjs scripts/unit-sprite-clock.test.mjs` at the cumulative Spearman head: **25 passed, 0 failed**. These verify decoded crops, distinct keys, uniform lifetimes, default exact-heading UV selection, both teams/selection values, walk loops, fresh attack restart/end, terminal clamp, resume, clock recycling and depth correction. Earlier pack bytes are unchanged in the later stack; parent-owned exact-head release/type/HTTP checks are separate evidence.
- Existing authored lifetimes are preserved uniformly per heading: walk 800 ms; attack Infantry 850, Archer 1000, Spearman 880 ms; defeat Infantry/Archer 850, Spearman 1080 ms. Infantry/Archer death is honestly an idle 120 ms → terminal 730 ms transition, not an authored smooth collapse.

## Limits and remaining blockers

No native/GPU ordinary-game capture or identified containing deployment was performed. All **63 original deployed/native action-heading cells remain unverified**. Exact attack-bearing readability for the approximate painted views, Spearman root/contact and larger weapon/fall envelope, selection/fog/LOD behavior, both-seat paid production, costume/team-mask appearance, and ordinary-zoom legibility require the retained normal-game recipe on an identified containing build.

The existing automatic approval rejection of PR228 remains in force. This independent source review supplies the previously missing review evidence; it does not retry the denied action, supply user authorization, or establish native/deployment acceptance.
