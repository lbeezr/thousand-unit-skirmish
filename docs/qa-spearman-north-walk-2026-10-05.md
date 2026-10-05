# Spearman North walk increment — 5 October 2026

[East checkpoint](qa-spearman-east-walk-2026-10-05.md) · [Coverage backlog](human-foot-unit-coverage.md) · [Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains selectors/clocks; shared cloud transport owner `01a10378` retains permitted ordinary-game capture execution. Foot art retains appearance acceptance. Combat/stances and other art lanes are separate.

## Own-direction input and motion backing

PR472 merged East at `90cbae99ae75b0c87ae003422ad3439a59f658b7`. This increment uses the existing `idle-north-0` runtime crop, 226×278 with inherited pivot (98,271), from the already-public [North seed](art-direction/human-roster-v1/extracted/spearman/idle/03.png). The established direction mapping, helmet, face, cream/sage clothing, two-handed grip and long spear remain unchanged. The [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/north-local-v1/registration.json) pins the original public input, registered crop and four selected output hashes.

Free Blender 4.3.2 CPU authoring uses source-UV planes, one fixed orthographic camera, a shared scale and a four-key scene. No matching approved 3D master was located; no inferred master, paid/provider job, mirror, other heading, private input or held v2 art is used. The rigid upper body ends at source y190. Two lower-leg planes retain complete original boots. The lower shaft separates at `x < 228-.9*y`, y≥190, through the existing transparent shaft/leg gap: **781 exact source RGBA samples** remain rigid, and **zero hidden samples are reconstructed**. Both textures recombine to the exact original visible RGBA. The masks, script, scene and all outputs are retained privately.

| Runtime interval | Selected own-view pose | Intended change |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/north-local-v1/00.png) | Left boot advances; right boot retreats. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/north-local-v1/01.png) | Right boot lifts and passes the support leg. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/north-local-v1/02.png) | Opposite boot advances; silhouette opens. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/north-local-v1/03.png) | Left boot lifts; return to first contact. |

Labels identify screen partitions. The torso and shaft are rigid; this is a deliberately rough guarded shuffle. Source-size and calculated ordinary/useful/strategic-size sheets are retained privately and clearly labelled as calculations. Earlier rectangular-toe and incomplete-shaft partitions remain private iterations, not registered art. Independent source review found **no blocking defects** and all **65,072 pose-triangle instances positive**; complete boots, shaft, cloth seams and four distinct silhouettes were checked. Anatomical planting, pacing and rendered readability remain open.

## Default registration and real accounting

Pack **0.6.0** adds **four newly authored North poses**, preserving **all 40 prior registered poses** including NE/East and **31 other clips** exactly. Only `walk|north` replaces its own idle placeholder. Canvas 320×352 pads by (44,24), giving inherited pivot (142,295). HeightWorld `1.6722564697265625`, world-per-pixel `0.0052421832906788795` and maximum alpha height 319 are unchanged. Four explicit 200ms keys form an 800ms loop; authoring 20FPS is not runtime FPS. Bounds use alpha≥8; normalization changes only RGB under alpha zero, retaining every visible RGBA/alpha sample.

Four empty slots to the right of NE/East preserve the 2048×2048 page and encoded zero mask. Every prior frame record/crop/calibration stays exact. The ordinary no-option Human binding remains Spearman v1, with existing manifest/runtime/mask server admission and Docker/release paths. No loader, preview switch, state implementation or simulation changes.

The full `scripts/build-human-spearman-preview.py` builder reconstructs baseline, NE, East and North stages. The reviewed-stage append verifies source hashes, 40 prior poses, 31 other clips, asset/page metadata and mask before writing. Repeating North at 0.6 must change no files. Older append scripts intentionally guard their construction stage; use the full builder for the current pack.

| Source checkpoint | Spearman missing | Military family missing |
| --- | ---: | ---: |
| Merged East 0.5.0 | 19 | 61 |
| This North source increment 0.6.0 | **18** | **60** |

Exact remaining Spearman cells: walk × S/SW/W/NW; attack and defeat × N/NE/E/S/SW/W/NW. Infantry/Archer retain 21 each. The existing capture adapter derives four missing walks from decoded pixels and twelve animated role/heading rows (eight Worker plus SE/NE/East/North Spearman). Gaps remain false. Historical NE/East tests pin the actual unaffected clip subsets; North independently pins every prior clip except this exact replacement.

## Checks and unfinished acceptance

Focused checks verify prior registered RGBA/records/calibration, exact source crops, four distinct silhouettes, frozen-action rejection, inherited pivot and existing real-camera terrain-depth correction. Actual CPU instanced playback exercises both teams/selection values, all four keys, looping, Stop to the original North idle and fresh resume. Canonical/registry, rebuild/idempotence, repository and clean package/HTTP receipts accompany independent review.

Containing served/deployed source and ordinary-game contact, pacing and readability remain **unverified**. Zero game/GPU frames are claimed; all 63 original native/deployed cells remain open. The unavailable permitted capture route is not retried here; no browser sandbox bypass, Mac test or provider operation is attempted. Foot art retains appearance acceptance via shared permitted `worker-animations` transport owner `01a10378` at an identified release.

1. Continue own-seed South, Southwest, West and Northwest walk increments; preserve each registered baseline and obtain independent source/integration review.
2. Produce matched attack and terminal defeat headings as separate useful slices.
3. Capture identified default Move/Stop/resume; inspect actual game PNGs, planted support roots, speed, identity and ordinary/useful zoom through the permitted route. Source previews and merges do not close this outcome.
