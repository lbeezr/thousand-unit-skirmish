# Spearman Northeast attack increment — 5 October 2026

[Foot coverage](human-foot-unit-coverage.md) · [Adoption ledger](asset-adoption-checklist.md) · [Source registration](art-direction/human-roster-v1/extracted/spearman/attack/north-east-local-v1/registration.json)

The approved default Spearman v1 now has a short own-facing Northeast attack:
its exact existing idle opening, then ready, shaft-aligned thrust and recovery.
It plays once for 880 ms with explicit key durations 120/200/160/400 ms. The
existing state selector and attack timestamps control playback; combat, stance,
Worker/fishing/Sheep and protocol code are unchanged. This is usable rough source
motion. Identified ordinary-game appearance acceptance remains open.

## Actual source inspected and selected

Baseline main is `446d5a99374b3aaf06d30948ad9c01cb3f6080e5` (PR480). Actual
legacy manifests contain eight Spearman walks but only Southeast attack and
defeat motion. Other action headings hold their own idle. The existing
Southeast eight-key attack sheet supplies wind-up/thrust/recovery intent only;
none of its pixels is used as Northeast art.

The approved own seed is the registered `idle-north-east-0` crop, 217×279,
SHA256 `0f049b4ed4ceb11132fa45211c995bbfd529e25de0e9ac8bb3b6e53a9bf70a21`.
Its already-public original is
[Spearman idle02](art-direction/human-roster-v1/extracted/spearman/idle/02.png),
SHA256 `a1ec9294586ed22bfad9e27d1fa1fd5432bd2d4723d5532e7d0a9b188eae010e`.
The face, helmet, cream/sage/brown clothes, long two-handed spear and boots
remain that character and facing. No matching approved 3D master was located.
No paid rigging, image generation, provider job, private input, mirrored facing
or held replacement identity is used.

Exactly **one original opening pose is reused and three new action poses are
authored**. All 60 preceding registered frames remain exact; the pack has 63
unique frame records: 32 original frames, 28 earlier authored walk keys and
three newly authored attack keys. The reused opening is already among the 60;
it is not counted as an additional new frame.

## Retained local authoring and independent source review

Free Blender 4.3.2 Cycles CPU renders fixed orthographic source-UV planes.
The complete visible spear and both hands move as one rigid piece. Independent
upper/forearm pieces meet their wrist targets; a small torso lean leaves all
source body vertices at y≥180 fixed. Ready rotates the weapon 25° and translates
(0,-6); thrust adds (24,-12) along the lowered shaft and a (6,-2) torso lean;
recovery returns toward the original grip angle. The 416×352 canvas has fixed
padding (80,24), inherited padded pivot (168,297) and unchanged source pixel scale.
Vertical camera fit was checked from the saved scene: one source pixel projects
to one output pixel, with pivot approximately (167.999996,297).

Restoration is explicit: **1,985 body donor pixels plus 337 newly exposed far-arm
donor pixels, 2,322 total**, all exact RGBA copies from this own seed. An additional
375 existing elbow pixels overlap on attached planes; those are not hidden-pixel
reconstruction. Independent review verified all donor coordinates/destination
parts and all 244,404 positive triangle instances (minimum area approximately
1.499975 source-pixel squared). Complete grips, shaft, point, tail, boots and
attachments are present in the actual reviewed images. Repeated paint and simple
sleeve shading remain acceptable finish limitations for this slice.

All original trials, rejected gaps, donor maps, scenes, scripts, raw PNGs,
corrections, geometry checks and independent review receipts remain retained
privately. Earlier trials had sleeve/arm gaps, pants edge defects and incorrect
landscape camera fitting; those do not supply the selected keys. The registration
exports normalize RGB only at alpha0 (224/190/205 pixels respectively), preserving
every alpha value and every alpha-positive RGBA byte. Raw renders remain intact.
The exact reviewed normalized hashes and process receipt hashes are pinned in
the linked public registration. Private Library previews and reports are saved;
their private identifiers are not published here.

The source magnification preview is explicitly 0.2×. A separate CPU scale
prediction uses 0.07987624× at viewport720/zoom0.91/frustum43. Neither is a game
capture. At that prediction the 24 px thrust spans about 1.9 CSS pixels; ordinary
readability and reach still need actual game observation.

## Default integration and proportionate verification

Pack0.11.0 retains all prior rectangles, pivots, complete frame records and 31
other clips. The entire old 2048×3200 decoded page/mask prefix is unchanged;
three disjoint new 416×352 slots sit below it on a 2048×3584 page. Encoded files
and UV denominators change. The page gains 3 MiB of RGBA8 storage per texture
(25→28 MiB), a layout calculation rather than measured GPU allocation. Existing
body calibration remains 0.0052421832906788795 world units per pixel. Exported
art/culling bounds expand conservatively for rooted, camera-rotated weapon
corners using the existing bounds helper; other asset metadata remains exact.

The full builder replays every prior walk stage and this action stage.
Deterministic registration validates reviewed inputs, the old prefix, complete
old frame pixels/records, unchanged clips/calibration, exact new crops/timing,
whole appended page and root/bounds metadata before writes. Full rebuild and
two repeat appends are byte-identical across all five pack files.

87 focused CPU checks pass: historical art preservation, default Northeast
one-shot playback for both teams and selection states, explicit phase boundaries,
return to idle or walking, fresh-event reset, registered source pixels, inherited
root/depth correction and unchanged Worker capture contracts. The final root
check also covers every retained frame against expanded exported bounds. Both
strict type projects, architecture, Markdown links, whitespace, canonical atlas
validation and the existing worker-animations registration check pass. Exact
head/tree review, clean release digest, packed HTTP and merged-source comparison
are recorded in the owning PR; these source/CPU checks are not deployed evidence.

## Coverage and continuing ownership

Spearman source coverage is eight walks and two attacks (SE/NE). Exact remaining
Spearman source cells: attack × N/E/S/SW/W/NW, defeat × N/NE/E/S/SW/W/NW:
**13**. Infantry and Archer retain21 each: **55 military source gaps**.
All **63 original native/deployed cells remain unverified**.

The next useful source slice is own-view East attack, followed by the remaining
attack headings, matching terminal defeat, then established Infantry/Archer
coverage. Inspect each own seed and occlusion before reuse; preserve this pilot
and every preceding frame at each increment. Cosmetic polish follows functional
coverage. Foot art owns appearance acceptance; animation-state owner `01a103d4`
retains clocks/selectors. Parent delivery support and capture owner `01a10378`
retain the permitted identified-release execution route. No denied dispatch,
browser-security bypass, stopped Mac dependency or deployment inference is used.
