# Human Worker land-action coverage — 4 October 2026

Owner: delegated Human Worker land-art task from
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Scope: Worker art/manifests,
deterministic admission and proportionate acceptance checks. Fishing is a separate
art owner; state bindings/productive receipts/shared clocks belong to animation
owner `01a103d4`. No economy, clock, state, server or fishing change.

Baseline: fork main `9351320d`, containing [PR222's coverage matrix](qa-unit-animation-audit-2026-10-03.md#functional-coverage-priority--4-october-2026).
User requests usable breadth now; cosmetic finish follows functional coverage.

## First usable slice: retained East walk

`cast-human-sprite-v3` v0.15.0 now supplies eight 100 ms East walk keys by default.
Existing `walk|east` selection consumes them, including Carry/Return while moving.
No new carry enum/clip or renderer opt-in. All 84 earlier frame rectangles,
pivots, dimensions, decoded RGBA pixels and all other clips are preserved. Atlas
dimensions remain 2048×4096; the eight new 256×256 cells use empty space at y=2560.
The zero team mask and existing role/world scale are unchanged. Maximum alpha
height remains 272 px, avoiding the loader's implicit whole-pack rescale.

The actual source is the already-public
[East v1 sheet](art-direction/human-roster-v1/source/worker-walk-east-v1.png),
with [eight prior extracted keys](art-direction/human-roster-v1/extracted/worker/walk/east/extraction.json).
No new generation, provider job, spend or private source. The current green vest,
white sleeves, backpack/bedroll, hair and axe match the shipped Worker. Actual
alternating legs and arm changes are retained. East faces screen-down-right;
SE's existing walk faces screen-right. Neither is relabelled as the other.

[Deterministic admission](../scripts/admit-worker-east-walk.py) uses one scale,
232/390, source column roots [196,600,976,1360], two layout-row baselines [472,944],
and a shared local root [128,244]. It retains source motion offsets instead of
centering or resizing each frame independently. Transparent RGB is sanitized at
the existing alpha threshold. Sources/earlier iterations remain untouched in
their original paths and Git history.

[Registration](qa-evidence/worker-land-art-2026-10-04/east-walk-registration.json)
records every source/cell hash and offset. [Key sheet](qa-evidence/worker-land-art-2026-10-04/east-walk-keys.png)
and [800 ms loop](qa-evidence/worker-land-art-2026-10-04/east-walk-loop.webp)
are source-pixel previews at ordinary/strategic sizes, not game/GPU captures.
Root estimates and slight source pose/size differences still need native review;
they do not create a cosmetic production hold.

## Inspect existing art before the next slice

Both nominated legacy candidates were decoded and their actual first-frame
headings and motion/action cells reviewed, rather than trusting manifest labels:

| Existing public candidate | Actual useful material | Admission decision for current Worker |
| --- | --- | --- |
| [Legacy cast Human v1](qa-evidence/worker-land-art-2026-10-04/cast-human-sprite-v1-reuse-preflight.png) | Genuine eight-view walk, two-part work/attack and defeat keys. | Blue apron, crossed back straps, no current backpack/bedroll or axe. A direct splice changes the Worker body/costume. Bare-hand generic work does not establish wood, food or Stone action. Retain as mechanics/source study; do not switch the default roster. |
| [Meshy Worker v3](qa-evidence/worker-land-art-2026-10-04/worker-sprite-v3-reuse-preflight.png) | Genuine eight-view walk, reused swing and defeat. | Different grey-haired brown-outfit body, no tools; shared swing cannot establish resource-specific work. Preserve public assets/provenance, no replacement. |
| [Worker v1](qa-evidence/worker-land-art-2026-10-04/worker-sprite-v1-reuse-preflight.png) / Worker v2 | Two-key walk, static land work/defeat. | Yellow cap/tunic and blue sash, different identity; v1 also has visible neighbouring-cell fragments. Not a current-roster motion supply. |
| Current-roster retained walk sources | NE/SE/SW variants and East v1/v2. | NE/SE/SW already used; East v1 is admitted here. v2 is the same bearing and further SE/NE iterations do not fill another direction. |
| Current-roster retained land-work/combat sources | Wood/food/build/repair/attack/defeat eight-key SE strips. | Already used. No matching N/NE/E/S/SW/W/NW action strip, or Stone strip, is present in this checkout. |
| Earlier [Vaelora Worker study](art-direction/human-vaelora-sprites-v1/README.md) | Matching-character Walk/Chop/Defeat labelled SE. | Follow-up connected-silhouette extraction recovers all eight complete Chop keys (whole-sheet margins intact); the actual pose comparison still reads SE and does not prove another heading. Defeat's final source view touches the sheet's right edge. Preserve studies; do not crop missing terminal pixels or relabel this SE strip as East to inflate coverage. |

That is an **art-input gap**, not an animation-binding defect. Rough short keys
are acceptable, but moving a whole idle image, copying SE into seven labels,
or swapping to a different legacy body does not provide the required motion,
identity and facing. This task does not authorize new provider charges or
publication of private pixels. Ready supplied current-roster keys can be admitted
immediately with the same manifest contract.

## Ranked retained backlog

| Rank | Next useful slice and bounded writes | Concrete dependency / acceptance |
| --- | --- | --- |
| 1 | Retain East walk through reviewed merge, release, containing staging/native build and game check. Art owner owns this pack/checkpoint. | Parent's existing delivery/Mac route runs the recipe below. Browser startup here fails with `sandbox-unavailable`, even with writable XDG storage. No bypass flags. |
| 2 | Fill remaining walk **N/S/W/NW** one actual heading at a time. Source, atlas/manifests, one registration record per slice. | Missing same-character, correct-camera articulated source keys. Assessed public legacy bodies do not preserve the current identity. Carry/Return reuse each completed walk with the existing cargo cue. |
| 3 | Fill wood/food/build/repair/attack/defeat's seven absent headings: **42 cells**. Preserve working SE keys. | Same-character action keys. Build/repair target bearing remains a producer/animation-owner contract gap from PR222; art can proceed independently, but no guessed heading closes ordinary-game acceptance. |
| 4 | Eight readable dedicated Stone-work headings. | Current assets contain no pick/mining sequence. Animation owner also needs the actual Stone state/resource selector enabled after artwork exists; current default intentionally returns idle. No economy edits. |
| 5 | Improve costume consistency, registration refinement and loop smoothing after usable breadth. | Functional native observations identify the needed refinements. Cosmetic perfection is not a gate for supplied usable keys. |

There are now 4 of 8 walk headings, eight distinct idle headings, SE land-action
motion and no Stone motion. **54 land-action/heading cells remain** (4+42+8).
Fishing's seven missing headings are excluded and retained by its separate owner.
The animation-owner ID is outside this executor's live collaboration tree; the
manifest contract and retained dependencies are recorded here for parent routing.

## Proportionate verification and native recipe

Focused checks use the real default manifest/decoded atlas and actual Three
instanced UV buffers: eight distinct complete East keys above the fixed root,
800 ms loop, correct exact-heading selection, unchanged world scale, both Human
seats, selected/unselected, advancing/looping playback, NE→E continuous phase,
Stop/resume and Carry/Return→idle/deposit. Existing work-receipt, attack/death
lifetimes, headings, generation reuse and fishing contact regressions are rerun.
Source-pixel preservation is measured against the baseline, not inferred from
PNG file hashes (PNG encoding changes when new cells are appended).

On an identified served revision containing this change, use normal Human art
without preview flags in **Bellweather · Millrace**. Order a Worker world +X
(screen-down-right/East); capture one full loop at ordinary and strategic zoom.
Compare E to existing NE (screen-down) and SE (screen-right), then turn through
E, stop and resume. Repeat selected/unselected. Carry one wood/food load along
the East bearing and Return cargo: existing cargo cue stays visible during walk,
then stops and clears after the actual bank deposit. Repeat with the other seat
configured Human where supported. Capture root/feet/axe clearance and action
changes; record revision, map, heading, seat and selection status.

Default source binding and package/HTTP inclusion are separate from a containing
deployment and native acceptance. Those final observations remain incomplete
until their exact revision and captures are recorded here.

The first slice is [PR226](https://github.com/lbeezr/thousand-unit-skirmish/pull/226),
initial code `7a31b1da`, refreshed with main `5200ffdf` at code head
`350350de0e8f5a02d09ca34e5439f7762c3f66b5`. All 57 focused/CI-sharding checks pass,
atlas validation/docs/whitespace pass, and `railway-release-scenario.mjs` passes
real packed HTTP/hash admission. [Clean release](qa-evidence/worker-land-art-2026-10-04/clean-release.json)
has 1,170 files and digest
`sha256:99a2a103d524f14d4ee2213e8de614cf71c2ac3319d3b7733ae87b4c021c0b47`
at that exact source head. Subsequent checkpoint-only commits are separate from
this measured release. [Browser preflight](qa-evidence/worker-land-art-2026-10-04/browser-preflight.json)
records the actual sandbox failure. Independent review is pending: this executor
has no live peer/parent reviewer route; no self-review is claimed as an independent
review. Main merge, containing deployment and native acceptance stay open.
