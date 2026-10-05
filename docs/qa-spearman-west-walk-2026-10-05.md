# Spearman West walk increment — 5 October 2026

[Southwest checkpoint](qa-spearman-south-west-walk-2026-10-05.md) · [Coverage backlog](human-foot-unit-coverage.md) · [Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains selectors/clocks; shared transport owner `01a10378` retains permitted ordinary-game capture. Foot art retains appearance acceptance. Combat/stances and other characters remain separate.

## Own-view source and rough motion

[PR477](https://github.com/lbeezr/thousand-unit-skirmish/pull/477) merged Southwest at `122ef2f9d83f8445bc7706890fb7804901645f55`. This slice inspected West's own registered idle crop, 237×285 with inherited pivot (110,285), and the already-public [West seed](art-direction/human-roster-v1/extracted/spearman/idle/05.png) before authoring. No matching existing approved West walk keys were located. The [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/west-local-v1/registration.json) pins source, selected raw CPU outputs, normalized sources and the complete preceding stage.

Free Blender 4.3.2 CPU source-UV articulation keeps one fixed camera/root/scale. The rigid upper extends through source y195; the transparent split is x154, preserving the far boot's x155 toe fringe. Left weights span y205–253 and right y195–243. Exact lower-shaft separation at `x > .65*y+73`, y≥195, retains **263 alpha-positive original source samples** (one fully opaque), with **zero reconstructed pixels**. Mask and leg textures recombine the entire seed exactly. Packed textures/UVs remain exact; CPU rendering resamples seed RGBA, while rendered upper pixels stay frozen across the keys.

| Interval | Selected own-view key | Motion |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/west-local-v1/00.png) | Left boot advances, right retreats. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/west-local-v1/01.png) | Right boot lifts and passes. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/west-local-v1/02.png) | Opposite contact opens the silhouette. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/west-local-v1/03.png) | Left boot lifts, returning to contact. |

Independent source review found no blockers: complete boots/cuffs/shaft, four distinct PNG and alpha≥8 silhouettes, and **67,000 positive pose-triangle instances**, minimum signed area ratio 0.563257853. Canvas stays 320×352 with fixed padding (40,24) and inherited pivot (150,309). Alpha≥8 bounds end at y285/291/297/277, exposing 24/18/12/32 px clearance above the fixed inherited pivot. These image-space facts do not establish support-foot contact. Source-size, calculated ordinary/useful/strategic sheets, GIF, scripts, masks, packed scene and all iterations remain retained privately. No provider/paid job, held v2 art, mirror, borrowed facing or private input is used; no matching 3D master is claimed.

## Registration and preservation

Default Spearman v1 pack **0.9.0** contains **56 registered frames**: 52 retained prior frames and four newly authored West poses. All 32 clip entries remain; only `walk|west` changes its own idle-placeholder sequence. The other 31 clips, all prior RGBA crops/frame records and asset calibration remain exact. Four 200ms keys form an 800ms loop. HeightWorld `1.6722564697265625`, world-per-pixel `0.0052421832906788795` and maximum alpha height 319 stay fixed. Normalization changes only RGB beneath alpha zero, preserving every raw visible RGBA and alpha sample.

Page metadata stays **2048×3200**, with the encoded zero mask byte-identical. Four declared previously zero-RGBA cells receive West keys; all prior page RGBA outside those slots stays exact. Restoring only those slots reconstructs the preceding whole-page hash. Existing shared guards reject nonzero hidden RGBA in new slots and compare complete own records/timing on repeat appends. Full builder replays baseline→NE→East→North→South→Southwest→West; use it for the current stage. Earlier standalone stages retain their reviewed construction boundaries.

| Served file | Southwest 0.8 bytes | West 0.9 bytes | Increase |
| --- | ---: | ---: | ---: |
| Runtime atlas | 2,312,646 | 2,401,311 | 88,665 |
| Zero mask | 6,432 | 6,432 | 0 |
| Manifest | 70,819 | 75,755 | 4,936 |

The three served pack files add **93,601 bytes**; the retained source atlas adds another 88,665. Texture dimensions and base-level allocation are unchanged; no measured GPU claim is made. Normal no-option v1 binding, exact HTTP admission and existing release/Docker paths consume the same pack. Loader, runtime state/protocol, capture implementation, simulation and stances are unchanged.

## Coverage and acceptance

Source gaps change from **16 Spearman / 58 military** at merged Southwest to **15 Spearman / 57 military** here. Exact remaining Spearman cells: walk × **NW**; attack and defeat × **N/NE/E/S/SW/W/NW**. Infantry and Archer retain 21 each. Seven genuine Spearman walks plus eight Worker walks produce 15 animated capture rows and one explicit Northwest walk gap. Historical frame/clip subsets remain pinned; prior Southwest whole-page recovery clears the explicitly later West slots as well.

**94 focused CPU tests pass**, including exact prior records/crops/calibration, four own source images/silhouettes, whole-page recovery/mask, terrain-depth correction, real instanced UV advancement for both teams/selection states, looping, own idle Stop and fresh resume. Frozen-key, wrong heading/clock/transform, fallback and loader failure controls remain active. Deterministic full builder/repeat checks, required repository checks, independent integration review and clean package/HTTP receipts accompany source/default/release milestones.

All **63 original native/deployed cells remain unverified**. Identified containing delivery and ordinary rendered planting, pace, readability, fog/selection/strategic/crowded behavior stay open. Calculated sheets and CPU/pack checks are not game captures. No denied capture route, sandbox bypass, stopped Mac testing or provider operation is retried.

1. Finish own-seed Northwest walk as the next separately reviewed increment; inspect its overlapping boot/cuff contour before authoring.
2. Continue matched attack and terminal defeat as separate useful slices.
3. Inspect identified default Move/Stop/resume and appearance through the permitted `worker-animations` capture route, retaining foot-art acceptance with transport owner `01a10378` and parent delivery support.
