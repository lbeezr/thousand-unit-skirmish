# Spearman Southwest walk increment — 5 October 2026

[South checkpoint](qa-spearman-south-walk-2026-10-05.md) · [Coverage backlog](human-foot-unit-coverage.md) · [Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains selectors/clocks; shared cloud transport owner `01a10378` retains permitted ordinary-game capture execution. Foot art retains appearance acceptance. Combat/stances and other art lanes remain separate.

## Own-view source and motion backing

[PR476](https://github.com/lbeezr/thousand-unit-skirmish/pull/476) merged South at `53951d6b60921d707a94d23652d8e4dd511b7a3c`. This slice inspected that exact own-view Southwest idle crop, 231×283 with inherited pivot (111,283), before authoring. The already-public [Southwest seed](art-direction/human-roster-v1/extracted/spearman/idle/06.png) and [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/registration.json) pin the identity, crop, raw CPU outputs and normalized selected-source hashes. No matching existing Southwest walk frames were found; existing other facings stay distinct.

Free Blender 4.3.2 CPU source-UV authoring keeps one fixed orthographic camera/root/scale for all four keys. Upper material is rigid through source y188. The leg split at x138 follows the transparent gap; left weights span y205–253 and right y200–248, preserving complete cuffs/boots. Exact source-right shaft separation at `x > .6*y+72`, y≥188, retains **509 alpha-positive original RGBA samples** (17 fully opaque). Masks recombine the complete seed with **zero reconstruction**. Packed textures and UVs remain exact; CPU transparent-material rendering resamples original seed RGBA, while rendered upper pixels stay frozen across the new keys.

| Runtime interval | Own-view source pose | Intended change |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/00.png) | Left screen boot advances; right retreats. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/01.png) | Right screen boot lifts and passes. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/02.png) | Opposite contact opens the silhouette. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/south-west-local-v1/03.png) | Left screen boot lifts; return to first contact. |

Independent source review found no blocking findings: four distinct PNG/silhouette/GIF keys, complete toes/cuffs/shaft and all **66,456 pose-triangle instances positive** (minimum signed area ratio 0.563257853). Source-size and calculated ordinary/useful/strategic-size previews, packed scene, scripts, masks and all art iterations remain retained privately. Calculated sheets are not game captures. No matching 3D master was located; no provider/paid job, mirror, borrowed facing, private input or held v2 art is used. This is deliberately rough source motion; native planting, pace and readability remain unverified.

## Default registration and preservation

Default Spearman v1 pack **0.8.0** adds **four newly authored Southwest poses**, preserving **all 48 previous registered poses** and **31 other clips** exactly. All 32 clip entries remain; only `walk|south-west` replaces its own idle sequence. All idle facings, SE attack/defeat and SE/NE/E/N/S walks remain unchanged. Fixed 320×352 canvas and padding (44,24) give inherited pivot (155,307); heightWorld `1.6722564697265625`, world-per-pixel `0.0052421832906788795` and maximum alpha height 319 remain exact. Four explicit 200ms keys produce an 800ms loop. Normalization zeros only RGB beneath alpha zero, preserving every visible raw CPU RGBA and all alpha samples.

Page dimensions stay **2048×3200**, and the encoded zero mask stays byte-identical. Four declared previously empty cells receive the new images; all old RGBA outside those cells, every old rectangle/canvas/pivot and calibration remain exact. Restoring only those four slots to transparent zero reconstructs the entire prior page hash. The shared append now checks this whole prior-page identity on repeated same-page stages as well as downward extensions, and rejects any nonzero RGBA in a new slot before writing. It also compares complete own frame records, preserving the South guard fix.

| Served file | South 0.7 bytes | Southwest 0.8 bytes | Increase |
| --- | ---: | ---: | ---: |
| Runtime atlas | 2,176,858 | 2,312,646 | 135,788 |
| Zero mask | 6,432 | 6,432 | 0 |
| Manifest | 65,833 | 70,819 | 4,986 |

The three served pack files increase by **140,774 bytes**. The separately retained source atlas adds another 135,788 bytes. Texture dimensions/base-level memory are unchanged from South; no measured GPU claim is made. Existing normal no-option Spearman v1 binding, exact HTTP admission and Docker/release packaging consume the same files. Runtime loader/state/protocol/simulation/stance implementations are unchanged.

The full builder reconstructs baseline→NE→East→North→South→Southwest. Each reviewed stage pins its prior records/crops/clips/calibration/source/whole-page/mask identity. Older standalone stages intentionally guard their construction stage; use the full builder for the current pack. Valid Southwest repeat appends must change no files.

## Actual coverage and unfinished acceptance

| Source checkpoint | Spearman missing | Military family missing |
| --- | ---: | ---: |
| Merged South 0.7 | 17 | 59 |
| This Southwest 0.8 slice | **16** | **58** |

Exact remaining Spearman cells: walk × **W/NW**; attack and defeat × **N/NE/E/S/SW/W/NW**. Infantry/Archer retain 21 each. Six genuine Spearman walks and eight Worker walks produce 14 animated capture rows; West/Northwest gaps stay explicit. Historical tests pin actual retained subsets; Southwest independently pins all 31 other clips. Frozen pose, wrong direction/clock/transform, false fallback and loader failure controls remain active.

**72 focused CPU tests** pass for prior records/RGBA/calibration, new source crops/silhouettes, whole-page recovery and unchanged mask, terrain-depth correction and actual instanced UV advancement for both teams/selection values. Loop, own idle Stop and fresh resume are checked. Canonical/capture registration, deterministic rebuild/idempotence, configured repository checks, independent integration review and clean package/HTTP receipts accompany the bounded source/default/release milestones.

Identified containing delivery and ordinary rendered contact, pace, readability, selection/fog/strategic/crowded behavior remain **unverified**. Zero game/GPU frames are claimed; all 63 original native/deployed cells remain open. No denied browser/capture route, sandbox bypass, stopped Mac testing or provider operation is retried. Foot art retains actual appearance acceptance through permitted `worker-animations` transport owner `01a10378` and parent delivery support.

1. Continue own-seed West and Northwest four-key slices, preserving the 52-pose baseline and each subsequent reviewed stage.
2. Produce matched attack and terminal defeat as separate useful slices.
3. Inspect identified default Move/Stop/resume in actual game frames for planted roots, speed and identity at ordinary/useful zoom through the permitted route.
