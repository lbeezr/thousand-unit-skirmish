# Human foot-unit functional coverage

[Coverage priority matrix](qa-unit-animation-audit-2026-10-03.md#functional-coverage-priority--4-october-2026) · [Assets](assets.md) · [Adoption checklist](asset-adoption-checklist.md)

Owner: delegated Human foot-unit art lane; animation-state integration owner `01a103d4` retains state clocks and protocol. Worker/fishing/Sheep/Coastal and combat/stances are separate lanes. The user's task authorizes public reuse, default wiring and packaging without paid generation or private-source publication.

## Infantry slice — 4 October 2026

Source inspected at main `9351320d68b3b9c949166b7d5991973004b7553d`, including all three Infantry packs, both Archer packs and the only Spearman pack. The Meshy Infantry v2 bake has 264 real directional poses but lacks weapons/shield. The painted Infantry v1 retains readable equipment and distinct physical views; its old floor-grid registration is unusable because feet/weapons cross cell borders. The v3 SE keys work but cannot face the other seven headings.

The new [Infantry v4 pack](../assets/units/infantry-sprite-v4/README.md) reuses **48 unique original poses**, with **0 new, generated, interpolated or mirrored poses**. It recovers complete connected actors, excludes adjacent-row pixels, registers eight real source columns and translates one coherent role into a shared padded canvas/root/scale. Two-key walks/thrusts and idle-to-terminal defeat are the functional minimum. The old SE eight-key art remains in v3; the new default's short SE sequence is a consistency tradeoff for complete directional coverage, not cosmetic refinement. No combat or stance implementation changes.

| Coverage checkpoint | Infantry missing | Spearman missing | Archer missing | Total missing |
| --- | ---: | ---: | ---: | ---: |
| PR222 baseline ordinary defaults | 21 | 21 | 21 | **63** |
| This Infantry default candidate, source/CPU checks | 0 | 21 | 21 | **42** |
| Verified deployed/native coverage | Unchanged baseline until identified delivery and capture | 21 | 21 | **63 remains unverified** |

The remaining cells are exactly walk/attack/defeat × N/NE/E/S/SW/W/NW for Spearman and Archer. The candidate has every idle/walk/attack/defeat heading. Defeat coverage means a readable two-key terminal transition; it does not claim intermediate collapse motion.

Default binding is `src/main.js`'s ordinary no-option Human roster. `spriteDirectory` admits v4; the server admits exactly its manifest/runtime/mask, and Docker/release includes those same three files. No protocol, action enum, state-selection or approximate-direction algorithm changes. Equal authored durations for every heading preserve the animation owner's existing role/state lifetime interface: walk 800, attack 850, defeat 850 ms. Existing clocks, fresh-event deduplication and generation reset are retained.

The shared edit is limited to one supported-version addition in `src/unit-sprite-runtime.mjs`; its state/facing helpers are untouched. Direct cross-thread messaging to `01a103d4` is unavailable in this executor. This tracked contract is ready for that owner's independent review; the parent retains routing to the existing owner rather than creating a second state implementation.

Checks: canonical manifest/file-hash validation; 48 decoded full-pose bounds with four-pixel padding and shared pivot; eight distinct pixel hashes per action; real default no-option configuration; exact-heading CPU instanced UV keys for both teams and selection values, loop/end/fresh event/defeat/resume. The existing animation-runtime and sprite-clock suites also pass. Local browser preflight returns `sandbox-unavailable`, zero screenshots. No sandbox bypass, native or deployment claim.

## Archer slice — 4 October 2026

Built on [Infantry PR228](https://github.com/lbeezr/thousand-unit-skirmish/pull/228), refreshed against contract PR225 at main `26ac28db1435623b519add48ccac5a0eb92f2447`. PR228's refreshed source `9c686953cdd5fc54433cda45c902cfc3e927fdad` passes 21 focused checks and a clean release with digest `sha256:c20065dc9a3d68e0c1a3e7502874f231943098bd114bb55e97786470848050c3`; its three exact runtime files are included. These are source/package proofs, not deployed evidence.

The [Archer v3 pack](../assets/units/archer-sprite-v3/README.md) recovers all 48 separate painted v1 actors, including complete feet cut by its old row grid. The same public-source registration contract supplies eight views, two-key walk/draw/release and a short idle-to-terminal defeat. It reuses **48 poses**, adds **0 new/generated/mirrored/interpolated poses**, retains v1/v2, and changes only default/version admission, HTTP/Docker admission and candidate tests/docs. Per-heading durations are uniform: walk 800, attack 1,000, defeat 850 ms. No animation-state or Worker productive-work changes. The combined 23 focused tests, canonical Archer manifest, packed Basic Auth/MIME/hash/source-denial scenario, documentation links, both strict type projects and whitespace pass.

| Coverage after each source/CPU slice | Infantry missing | Spearman missing | Archer missing | Total missing |
| --- | ---: | ---: | ---: | ---: |
| PR222 baseline | 21 | 21 | 21 | **63** |
| Infantry PR228 | 0 | 21 | 21 | **42** |
| Stacked Archer candidate | 0 | 21 | 0 | **21** |

Across both slices: **96 unique reused poses, 0 newly authored poses**. The remaining 21 cells are exactly Spearman walk/attack/defeat × N/NE/E/S/SW/W/NW. Neither candidate has an identified containing deployment or native capture yet, so deployed/observed coverage is not claimed. Two-key terminal transitions supply usable endpoint feedback, not smoothly articulated defeat.

Read [PR225's shared loader contract](sprite-atlas-contract-v1.md#current-unit-loader-binding-subset) before further exports: role identity, one page/mask, canvas-local pivots/crop offsets, shared world scale and existing clip/state/event timing apply. These exports stay within that subset. The one-line Archer version addition is the only further helper edit for animation owner `01a103d4` to review. No new enum or multiple-heading lifetime ambiguity.

## Spearman slice — 4 October 2026

There is no directional legacy Spearman sprite action pack, so the next ready
no-charge path uses the already-public Frontier humanoid/spear geometry and its
authored neutral palette. The Blender source is compressed in a newer format
that installed Blender 4.3.2 cannot open; the portable GLB imports correctly and
contains no skeleton/animation. The local bake authors separate rigid leg/arm
stride poses, independent spear wind-up/thrust/recovery, and four backward-fall
poses. A source-material COLOR_0/root-matrix probe and a clipped narrow-camera
capture were rejected and retained before the full shared-envelope bake passed.
The [Spearman v2 pack](../assets/units/spearman-sprite-v2/README.md) is deliberately
coarse, with blocky anatomy and a different costume; functional motion and real
directions are the goal. No original source was overwritten, no private pixels
were used, and no provider/rigging/generation charges were incurred.

Checks: 25 combined decoded-pixel/CPU scene/animation/clock tests, canonical
manifest/file hashes, actual fixed-camera root projection and all-frame terrain
depth clearance; every authored sequence has distinct image keys, all headings
select their own clips, and every captured frame has a nonempty sash mask. The
packed authenticated HTTP/WebSocket/MIME/atlas-hash/source-denial scenario, import
boundaries, both strict type projects, docs and whitespace pass. Rejected-capture
archives were verified byte-for-byte against per-file SHA256 records. These are
local source/release checks; browser preflight remains sandbox-unavailable.

Exactly **0 sprite frames reused, 12 pose samples newly authored, 96 directional
frames newly rendered locally**. Public geometry/palette is reused. One fixed
camera and geometric origin, shared scale and crop offsets serve all eight real
rotations. Mask derives the source team sash; torso/helmet/weapon remain neutral.
Walk 800, attack 880 and defeat 1,080 ms preserve the old Spearman lifetimes in
every heading. The new default path and the exact three HTTP/Docker runtime files
are included; no selector/state/stance/combat/Worker semantics change.

| Coverage after each source/CPU slice | Infantry missing | Spearman missing | Archer missing | Total missing |
| --- | ---: | ---: | ---: | ---: |
| PR222 baseline | 21 | 21 | 21 | **63** |
| Infantry PR228 | 0 | 21 | 21 | **42** |
| Archer PR230 | 0 | 21 | 0 | **21** |
| Spearman PR241 local-bake candidate | 0 | 0 | 0 | **0 source cells missing** |

The final source candidate supplies every role's idle/walk/attack/defeat ×
N/NE/E/SE/S/SW/W/NW. Across all three slices: **96 retained painted poses reused**
plus **96 new local Spearman render frames**, from 12 authored pose samples.
Rejected captures are not included in accepted-frame totals. The original 63
deployed/native gaps remain **unverified** until a containing revision and actual
game observations are recorded; decoded pixels/CPU playback do not establish GPU
appearance. Shared contract PR225 remains unchanged except its current-default
directory row, which now names these three default candidates.

## Ranked retained backlog after all source slices

1. **Infantry merge/delivery/acceptance:** finish independent review of the corrected exact heads below, rerun checks and have the parent obtain the precise remaining approval required by the preserved automatic denial. Then merge PR228 through repository rules, identify the containing staging revision and run the ordinary recipe below. Review is an owned action; native acceptance remains separately open. Art owner retains the outcome with parent Railway/Mac support.
2. **Archer integration/acceptance:** [PR230](https://github.com/lbeezr/thousand-unit-skirmish/pull/230) has author diff/source review and clean packaging; retarget onto refreshed main after PR228 merges, resolve conflicts and rerun proportionate checks, then own release/deployed/native steps through paid Range production. It is wired into default candidates and packaging, not an export-only packet. Native browser sandbox remains unavailable here.
3. **Spearman integration/acceptance:** review the local rigid poses, fixed camera/root and per-heading timing at the exact candidate head; retarget after the preceding PRs merge and verify clean release/containing staging/native use. Both-seat paid Barracks Spearman production and ordinary zoom must prove the coarse helmet/long-spear role, planted stride, thrust/recovery and terminal fall. Four real keys are a functional minimum; blocky finish is later work. Art owner retains this outcome with parent Railway/Mac support. No missing source cells remain after this candidate; no deployed/native closure is claimed.
4. **Polish after function:** smoother loops, more defeat intermediates, costume/finish and team-mask refinement. Do not delay usable direction coverage for this work.

## Ordinary-game acceptance

At a named served source/release SHA, enter Millrace or Terraced Vale through Create Room and normal map selection, without art query flags. Use both seats and normal paid Barracks Infantry/Spearman and Range Archer production. For each Human foot role capture idle, move/Stop/resume, attack/fresh attack and lethal defeat along N/NE/E/SE/S/SW/W/NW. Verify the actual direction's keys advance, Infantry's wind-up/strike ends at 850 ms, Spearman's thrust at 880 ms and Archer's draw/release at 1,000 ms; a new event restarts. Terminal corpse/fall clamps and fades; selection clearing/fog/strategic LOD must not freeze state. Inspect planted roots, weapon/role recognition and team sash at ordinary zoom, especially Spearman's coarse local geometry and ground-depth correction. Include enemy views through disclosed fog. Save chronological clips with SHA, map, seat, action, heading and selected/unselected status.

A release/hash/CPU pass is a milestone. Review, deployed identity and actual in-game function remain incomplete until recorded here; there is no cosmetic approval gate.

The [contributor planning guide](contributor-planning.md) requires independent
review before a merge. Earlier author-only checks did not satisfy that step.
The art owner obtains review, resolves findings and reruns exact-head checks;
parent obtains any precise approval still required by the preserved tool denial.
Ordinary native acceptance remains separate and open because this executor's
browser preflight cannot start its sandbox.

## Initial published checkpoint and preserved merge denial

All three branches were refreshed against main
`545ef48095c3e7aa410118c3226d6122b47d835a`, including the separate Worker East
walk slice. [Infantry PR228](https://github.com/lbeezr/thousand-unit-skirmish/pull/228)
head `ca02319bea4ec89355f7e7be21894c1f8043cb87` passes 21 focused tests and
[clean release](qa-evidence/human-foot-art-2026-10-04/infantry-clean-release.json).
[Archer PR230](https://github.com/lbeezr/thousand-unit-skirmish/pull/230) head
`14576bc18a4e43358626d958445fea9379e2f917` passes 23 focused tests and
[clean release](qa-evidence/human-foot-art-2026-10-04/archer-clean-release.json).
[Spearman PR241](https://github.com/lbeezr/thousand-unit-skirmish/pull/241) art
commit `dcad82a5572979da512fe38e5da938a0a4df5981` passes 25 combined focused
tests and [clean release](qa-evidence/human-foot-art-2026-10-04/spearman-clean-release.json).
Each packed HTTP scenario also passes. Later provenance/evidence commits do not
change these sprite/default bytes. Author review covers actual direction/pose
provenance, geometry articulation, root/scale/crop, timings, source preservation
and the exact default/version/HTTP/Docker changes. At this initial checkpoint,
independent review had not been recorded; the later review is below.

The final tracked-file audit found that the global `capture.json` ignore rule
had excluded Spearman's two capture receipts from its first art commit. Exact
exceptions now retain both public-source receipts, without changing sprite or
release bytes. A tracked-file export passes all 25 focused checks and canonical
manifest/file validation, proving the source inputs exist in another checkout.

Automatic approval review rejected the expected-head merge of PR228. Its stated
reason was that default-branch history/release mutation is consequential,
independent exact-head review and deployed/native acceptance remain pending, and
the general request for reviewed PRs does not clearly authorize merging before
those gates. The merge did not occur; no alternate merge route was attempted.
PR230 and PR241 remain stacked, and no deployment was changed. This is an actual
automatic-approval restriction. Its result is retained, with no alternate route
or retry. Independent review is required and is obtained below; after its
findings and exact-head checks are complete, the parent obtains any precise
remaining merge authorization. That approval requirement is distinct from
identified deployment and native acceptance. The art owner retains all three
outcomes; parent Mac/Railway support is needed for exact deployment/native
observation. Source gaps are zero; all 63 original deployed/native cells remain
unverified here.

## Independent review and corrected bounds — 4 October 2026

A separate read-only reviewer found no blocking source-merge issues at refreshed
heads Infantry `5a9d6ae7a863c2eed4386a81a918ef08b4fdd4dc`, Archer
`3de0b6c5f44d786f113bb8b21ac252f4fed45ab7`, and Spearman
`90b111779545e24dac25829b4010f71aa5378259`, all containing main
`be656c47fb6ecb83291878791bff17f4eb8f4cf3`. The
[independent report](qa-evidence/human-foot-art-2026-10-04/independent-source-review-first-pass.md)
records actual source reconstruction, physical views/model rotations,
articulation, root/scale/crop, timing, public provenance and exact admissions.
It preserves limits on approximate painted bearings and native acceptance.

The reviewer found one P3 metadata issue: half-width bounds did not contain all
root-offset, camera-rotated strike/fall pixels. The current renderer ignores
those fields and disables frustum culling, so it was nonblocking. The generators
now derive conservative bounds from every root-relative opaque box in the fixed
game-camera basis, including the existing screen-preserving depth correction.
`heightWorld`, world-per-pixel, frames, pivots, clips and all color/mask/source PNG
hashes are unchanged. A new actual Three-camera corner-enclosure assertion fails
on the former metadata and passes on the corrected manifests. The reviewer must
confirm the final corrected heads before merge; no denied action is retried.

Current corrected implementation heads: Infantry
`ac6ae3c921908174c255e3f77a6e1afde98bbe05`, Archer
`1cc1602d5597b29e8f67c4a94780e9ec61862854`, Spearman
`6eb72e939b85eaf4373a5bfedd85a22585fe9650`. Focused tests including the separate
Worker coexistence suite pass 29/31/33 respectively; canonical manifests pass.
Exact-head type/HTTP/release checks and final review are recorded in each PR.

Small [Infantry](qa-evidence/human-foot-art-2026-10-04/source-previews/infantry-source-preview.webp),
[Archer](qa-evidence/human-foot-art-2026-10-04/source-previews/archer-source-preview.webp)
and [Spearman](qa-evidence/human-foot-art-2026-10-04/source-previews/spearman-source-preview.webp)
previews replay retained keys at one declared world scale on a neutral
background. Their [receipts](qa-evidence/human-foot-art-2026-10-04/source-previews/preview-receipts.json)
identify source atlas hashes. These create no new artwork and establish no
deployed/native appearance or acceptance.
