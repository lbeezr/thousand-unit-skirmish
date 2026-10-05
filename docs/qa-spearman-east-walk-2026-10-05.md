# Spearman East walk increment — 5 October 2026

[NE source checkpoint](qa-spearman-ne-walk-2026-10-05.md) ·
[Coverage backlog](human-foot-unit-coverage.md) ·
[Adoption](asset-adoption-checklist.md)

Owner: Human foot-unit art lane. Animation-state owner `01a103d4` retains
selectors/clocks; shared cloud transport owner `01a10378` retains the permitted
ordinary-game capture route. Combat/stances and other unit-art lanes stay separate.

## Approved input and motion backing

PR467 merged four NE walking poses at `82eb2dfb`. This increment uses the
Spearman's own already-public East seed, `idle-east-0`, from that registered
painted pack. The 197×285 crop has inherited pivot (57,273). Its face, cream/sage
clothing, two-handed grip and long spear remain the same. The original
[East source](art-direction/human-roster-v1/extracted/spearman/idle/00.png)
and [registration receipt](art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/registration.json)
pin the actual input and resulting pixels.

A matching approved 3D rig/master was not located. Free Blender 4.3.2 CPU
authoring uses fixed-camera 2D source-UV planes. Zero paid/provider calls,
outside/private pixels, mirrors, borrowed headings or held v2 art are used.
The original shaft crosses the nearer shin: retain its rigid source corridor,
then reconstruct 272 interior occluded leg samples from adjacent same-row
public-seed donor RGBA. All 922 separated shaft samples equal the original seed;
no new palette or hidden character reference supplies those samples. The private
source masks, exact donor coordinates, script, scene and render outputs are retained.

| Explicit runtime time | Own-direction pose | Intended readable change |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/00.png) | Nearer boot advances; farther leg moves back. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/01.png) | Farther boot lifts and passes the support leg. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/02.png) | Opposite boot advances; silhouette opens. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/east-local-v1/03.png) | Nearer boot lifts; return to the first contact. |

Source and accurately calculated ordinary/useful/strategic-size comparisons are
retained privately; they are not game screenshots. Source review verifies four
distinct poses, unchanged identity/camera/root, coherent shaft and no visible
cloth split or folded triangles. All 54,912 pose-triangle instances are positive,
minimum signed-area ratio 0.435336. This is deliberately rough, torso-rigid motion;
support-foot planting and pacing against 2.6 world units/second remain open.

## Default registration and real source accounting

Pack 0.5.0 reuses **all 36 prior registered poses unchanged**, including the four
NE poses, and adds **four newly authored East poses**. This increment changes only
`walk|east`. Existing 31 other clips retain their exact keys/timing and all prior
frame geometry/RGBA/calibration are pinned by the baseline fingerprint.

Source canvas 320×352 pads by (60,24), giving pivot (117,297) and the same character
root. World-per-pixel stays `0.0052421832906788795`, heightWorld stays
`1.6722564697265625` and maximum alpha height stays 319. Four explicit 200 ms
keys loop for 800 ms; Blender's 20 FPS authoring timeline does not set runtime FPS.
Bounds use the established alpha≥8 threshold; every visible RGBA/alpha sample is
preserved. Only hidden RGB under alpha zero is normalized before registration.

Normal Human binding remains Spearman v1. Existing manifest/runtime/mask admission
and Docker paths include the same default pack; there is no preview flag, new
loader or second state implementation. The full builder reconstructs the retained
baseline, appends NE, then appends East. The guarded East append verifies all 36
prior poses and unaffected clips; repeating it must change no files. Rebuild must
reproduce the five output files exactly. The older NE append is a version-0.4
construction stage; run the full builder for the current version-0.5 pack.

| Source checkpoint | Spearman missing | Human military missing |
| --- | ---: | ---: |
| Merged NE default pack 0.4.0 | 20 | 62 |
| This East default-pack source increment 0.5.0 | **19** | **61** |

Exact remaining Spearman cells: walk × N/S/SW/W/NW; attack and defeat ×
N/NE/E/S/SW/W/NW. Infantry and Archer retain 21 each. The capture adapter derives
five walk gaps from decoded pixels and accepts eleven animated role/heading rows
(eight Worker plus SE/NE/East Spearman); each missing heading remains false.
Its bounded loader diagnostics and shared transport contracts are preserved.

## Validation and remaining acceptance

Focused checks cover original/NE pose preservation, four exact source keys,
distinct silhouettes, frozen-action rejection, existing real-camera depth
correction and actual CPU instanced playback for both teams/selection states,
800 ms looping, Stop to original East idle and fresh resume. Independent source
and integration reviews and exact build/release receipts are retained by the owner.

All 63 original native/deployed acceptance cells remain unverified. The recovered
temporary exec-server disconnect affected preview assembly only; the completed
four-frame CPU render was not repeated. No browser, Mac, paid job, denied dispatch
or deployment was attempted. The existing permitted capture route is unavailable;
that blocks rendered acceptance rather than further public-seed production.

1. Capture identified default NE/East Move/Stop/resume through the permitted
   `worker-animations` route. Inspect actual two-phase game PNGs, anatomical contact,
   velocity, identity and useful/ordinary zoom. Shared transport owner `01a10378`
   supports execution; foot-art owner retains appearance acceptance.
2. Produce the five remaining walk headings from their own retained seeds,
   correcting concrete functional faults as found. Attack/defeat remain separate
   small increments; motion polish follows usable coverage.
3. Keep exact clean source/release digest separate from identified served/deployed
   revision. Packing, merging and source previews do not establish delivery or GPU use.
