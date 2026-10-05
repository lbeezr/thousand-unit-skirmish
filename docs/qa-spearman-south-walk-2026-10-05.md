# Spearman South walk increment — 5 October 2026

[North checkpoint](qa-spearman-north-walk-2026-10-05.md) · [Coverage backlog](human-foot-unit-coverage.md) · [Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains selectors/clocks; shared cloud transport owner `01a10378` retains permitted ordinary-game capture execution. Foot art retains appearance acceptance. Combat/stances and other art lanes are separate.

## Own-direction source and motion backing

[PR 474](https://github.com/lbeezr/thousand-unit-skirmish/pull/474) merged North at `dcbbea857097db2b7bd9e24801ec3bcbcf624db9`. This slice inspected its exact registered South crop before authoring: 239×285, inherited pivot (132,285), from the already-public [South seed](art-direction/human-roster-v1/extracted/spearman/idle/07.png). The [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/south-local-v1/registration.json) pins input, crop, selected raw CPU outputs and normalized source hashes. No existing matching South walk frames were found; the North/East outputs are retained rather than relabelled.

Free Blender 4.3.2 CPU authoring uses the own-view source UV textures and one fixed orthographic camera/root/scale for all four keys. The upper body through source y 190 is rigid. Left/right legs divide at x 148; weight spans y 205–255 and y 201–242 respectively preserve complete cuffs and boots. The full lower shaft separates at `x > 23+.9*y`, y≥190, through the existing transparent shaft/leg gap: **550 alpha-positive original RGBA samples** (19 fully opaque) remain rigid. Shaft and leg masks recombine the exact seed with **zero reconstruction**. Original packed textures and UVs stay exact; CPU transparent-material sampling changes rendered seed RGBA, while upper rendered pixels stay frozen between the four outputs. This distinction prevents a false claim of byte-exact original rendering.

| Runtime interval | Own-view source pose | Intended change |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/south-local-v1/00.png) | Left screen boot advances; right retreats. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/south-local-v1/01.png) | Right screen boot lifts and passes. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/south-local-v1/02.png) | Opposite contact; silhouette opens. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/south-local-v1/03.png) | Left screen boot lifts; loop returns to first contact. |

Independent source review found no blocking findings: complete boots/cuffs/shaft, four distinct poses/GIF keys, fixed camera and all **69,632 pose-triangle instances positive** (minimum area ratio 0.488718669). All private source scene/scripts/masks/previews and iterations remain retained. Source and calculated game-size sheets are not game/GPU captures. Inherited root contact, speed and ordinary readability remain unverified. No matching 3D master was located; no paid/provider job, mirror, borrowed facing, private input or held v 2 art is used.

## Default registration and page extension

Pack **0.7.0** adds **four newly authored South poses**, retaining **all 44 prior registered poses** and **31 other clips** exactly. All 32 clip entries remain; only the `walk|south` placeholder sequence changes. SE/NE/East/North walks and all legacy idle/SE attack/SE defeat keys remain exact. Canvas 320×352 adds fixed padding (40,24), producing inherited pivot (172,309). HeightWorld `1.6722564697265625`, world-per-pixel `0.0052421832906788795` and maximum alpha height 319 remain unchanged. Four 200 ms keys form one 800 ms loop. Normalization zeros only RGB under alpha zero; all visible selected-output RGBA and every alpha sample stay exact.

The aligned page/mask extend downward from **2048×2048 to 2048×3200**. The entire old RGBA page and grayscale mask prefix remain exact, including unused transparent pixels. New South slots begin below the old page at y 2052; all old pixel rectangles, canvas/pivot records and scale remain fixed. Normalized UV denominators reflect the new dimensions, checked through actual CPU instanced playback for old and new headings. Padding outside the four new slots and the entire enlarged zero mask remain empty. Reserved transparent slots admit later Southwest/West/Northwest slices without another page resize.

| File | Previous bytes | Current bytes | Increase |
| --- | ---: | ---: | ---: |
| Runtime atlas | 2,072,692 | 2,176,858 | 104,166 |
| Source atlas (retained separately) | 2,072,692 | 2,176,858 | 104,166 |
| Zero mask | 4,145 | 6,432 | 2,287 |
| Manifest | 60,931 | 65,833 | 4,902 |

The three served pack files increase by **111,355 bytes**. One RGBA 8 page grows from 16 MiB to 25 MiB (+9 MiB); if both runtime/mask textures are held as RGBA 8, total base-level texture storage grows 32→50 MiB (+18 MiB), without mips. These are dimension-based byte counts, not measured GPU usage. Encoded mask bytes/hash change even though all old mask pixels remain exact.

The normal no-option binding remains Spearman v1; existing manifest/runtime/mask HTTP admission and Docker/release paths already consume this pack. No runtime loader, state, simulation or stance implementation changes. The full builder replays baseline, NE, East, North and South. Reviewed-stage append pins all prior poses/crops, 31 clips, calibration, whole page prefix, source hashes and planned page/mask metadata before writing; repeat South at 0.7 changes no files. Older append scripts intentionally guard their construction stage.

## Actual coverage and remaining acceptance

| Source checkpoint | Spearman missing | Military family missing |
| --- | ---: | ---: |
| Merged North 0.6 | 18 | 60 |
| This South 0.7 slice | **17** | **59** |

Exact remaining Spearman cells: walk × **SW/W/NW**; attack and defeat × **N/NE/E/S/SW/W/NW**. Infantry/Archer retain 21 each. Five genuine Spearman walks (SE/NE/E/N/S) and eight Worker walks produce 13 animated capture rows; three remaining Spearman gaps stay explicit. Historical tests pin actual unchanged clip subsets, and South independently pins all 31 other clips. Frozen/wrong-heading/clock/load and fallback rejection controls remain active.

Focused checks cover preserved records/RGBA/calibration/page prefix, exact new crops, silhouettes, bounds/depth, and real CPU instanced playback for both teams/selection values: four keys, loop, Stop to original South idle and fresh resume. Canonical pack/capture registration, deterministic full rebuild/idempotence, repository checks, clean package/HTTP evidence and independent integration review establish source/default/release milestones separately.

Containing served/deployed source and ordinary-game contact, pace, readability, selection/fog/strategic/crowded behavior remain **unverified**. Zero game/GPU frames are claimed; all 63 original native/deployed cells remain open. The unavailable permitted capture route is not retried here; no sandbox bypass, stopped Mac test or provider operation is attempted. Foot art retains identified-release appearance acceptance via shared `worker-animations` transport owner `01a10378` and parent delivery support.

1. Continue own-seed Southwest, West and Northwest as independently reviewed four-key increments, preserving each prior baseline.
2. Produce matched attack and terminal defeat as separate useful slices.
3. Capture identified default Move/Stop/resume and inspect actual game PNGs, roots, pace and identity at ordinary/useful zoom through the permitted route.
