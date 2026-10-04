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

## Second usable slice: North walk first pass

Following actual retained-source inspection, the user authorized a bounded
approved-image-tool candidate. [North v1 sources and review](art-direction/human-roster-v1/generated/worker-walk-north-v1/README.md)
retain the public default North idle seed, exact tool prompt/layout, raw iteration
and eight complete extracted silhouettes. No private source, paid rigging or
external provider job was used. North's actual facing is screen-down-left,
distinct from East/SE; no mirror or repeated facing is relabelled.

Default v0.16.0 adds `walk|north`: eight 100 ms keys, loop 800 ms, spare row
at y=2816. [Admission](../scripts/admit-worker-north-walk.py) uses shared scale
232/438, fixed column roots [192,576,960,1344], layout-row baselines [478,960]
and ground pivot [128,244]. All 92 pre-North frames/decoded pixels, every other
clip, mask, 2048×4096 dimensions and max-alpha-height 272/world scale remain
intact. Existing Carry/Return consumes North with its cargo cue and no new enum.

[Registration](qa-evidence/worker-land-art-2026-10-04/north-walk-registration.json),
[key sheet](qa-evidence/worker-land-art-2026-10-04/north-walk-keys.png) and
[800 ms loop](qa-evidence/worker-land-art-2026-10-04/north-walk-loop.webp)
retain source/cell hashes and ordinary/strategic pixel review. The same costume,
axe and backpack remain recognizable. The gait, planted forward leg, slight
registration drift and loop seam are rough and retained for later polish.
Functional breadth takes priority; no cosmetic perfection hold is imposed.

Exact default Three UV checks prove advancement, looping, N→NE→N continuous
phase, Stop/resume and cargo Return→idle on both Human seats, selected/unselected.
Fishing preservation permits only explicitly verified admitted East/North walk
sequences before reconstructing its original metadata hash; all fishing keys and
other clip/pixel guarantees remain unchanged. [Preservation receipt](qa-evidence/worker-land-art-2026-10-04/north-walk-preservation.json)
records the preceding 92 frames, all other clips, mask and byte-idempotent rebuild.
All 82 focused pixel/default-runtime/receipt/clock/heading/fishing/sharding checks,
atlas validation and documentation links pass. Native appearance remains open.
For North's native recipe, order world +Z (screen-down-left), then turn to NE
(screen-down) and back; repeat the remaining East slice's Stop/cargo/zoom recipe.

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

That initial source inventory was an **art-input gap**, not an animation-binding defect. Rough short keys
are acceptable, but moving a whole idle image, copying SE into seven labels,
or swapping to a different legacy body does not provide the required motion,
identity and facing. No new paid provider charges or publication of private pixels are authorized.
The user subsequently authorized bounded approved image/Blender tools for first-pass
current-roster candidates; North is the first such continuation. Ready supplied
current-roster keys can also be admitted with the same manifest contract.

## Ranked retained backlog

| Rank | Next useful slice and bounded writes | Concrete dependency / acceptance |
| --- | --- | --- |
| 1 | Retain all eight walk headings through reviewed merges, releases, containing staging/native build and game checks. Art owner owns this pack/checkpoint. | Parent's existing delivery/Mac route runs the recipe below. Browser startup here fails with `sandbox-unavailable`, even with writable XDG storage. No bypass flags. |
| 2 | Keep all eight authored walk headings functional; Carry/Return uses their existing cargo cue. | Default Three playback/registration is checked. Native root/turn/cargo observations identify further refinements; no walk heading input remains missing. |
| 3 | Fill wood/food/build/repair/attack/defeat's seven absent headings: **41 cells**. Preserve working SE keys. | Same-character action keys. Build/repair target bearing remains a producer/animation-owner contract gap from PR222; art can proceed independently, but no guessed heading closes ordinary-game acceptance. |
| 4 | Seven remaining readable dedicated Stone-work headings and SE selector adoption. | SE now has dedicated pick poses; the broad eight-view attempt failed strike facing in the other rows. Animation owner also needs the actual Stone state/resource selector enabled after artwork exists; current default intentionally returns idle. No economy edits. |
| 5 | Improve costume consistency, registration refinement and loop smoothing after usable breadth. | Functional native observations identify the needed refinements. Cosmetic perfection is not a gate for supplied usable keys. |

There are now 8 of 8 walk headings, eight distinct idle headings, SE land-action
motion and SE Stone artwork awaiting default selector adoption. **48 land-action/heading cells remain** (41+7).
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
records the actual sandbox failure. Subsequent independent agent review at
`0fec667bb52a21416a93c144187c17861f8bcc67` passed all 60 focused checks and found
no blockers; [review receipt](https://github.com/lbeezr/thousand-unit-skirmish/pull/226#pullrequestreview-5403763778)
identifies shared-account agent review. PR226 merged at `f08a32ae5921933170140fad6cf3b3dd3d1e4368`.
Containing deployment and native acceptance remain open; merge does not claim either.

After the parent supplied [PR225's merged unit-loader binding subset](sprite-atlas-contract-v1.md#current-unit-loader-binding-subset)
at main `26ac28db`, it was read in full and included at refreshed code head
`e7beead69d2d687581a1fe1607cb3ffe0da65a54`. This slice matches `human` / existing
v3 directory, one selected actor/color page with aligned mask, exact `walk|east`,
eight 100 ms looping keys, shared root and unchanged max-alpha-height/world scale.
Atlas validation and both new decoded-pixel/runtime-playback checks pass after
the refresh. No new selector, state or shared timing extension is required;
Stone still requires the animation owner's bounded extension when supplied art
exists. The earlier clean release remains a receipt for its stated source, not
the later documentation-only contract merge.

North measured code head `ce5f797f49b5d940f6a1ff4d29ea28636da08796`
passes the packed Railway HTTP/hash scenario and live WebSocket→CPU client
productive-receipt scenario. [Clean North release](qa-evidence/worker-land-art-2026-10-04/north-clean-release.json)
retains exact source, three runtime file hashes and digest
`sha256:ef838b9190777ada66a48a00434154c97b12992da8aa967b0ee36e5b4ddbae03`.
A read-only Railway observation at 01:35 UTC found staging SUCCESS deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a`, source `64cc391e6d9c4164dca7bd45696cf3862fe19729`.
That revision predates East/North; neither slice is claimed delivered. The parent
delivery route must supply a containing build; its Mac capture route retains
native root/turn/cargo acceptance. This is an actual identified delivery gap,
separate from the sandbox-unavailable browser capture gap.

## Third usable slice: South walk first pass

[South v1](art-direction/human-roster-v1/generated/worker-walk-south-v1/README.md)
retains the public default `idle-south-0` seed, exact prompt/reference, raw and
eight whole extracted silhouettes. Correct South facing is world -Z,
screen-up-right/back view; backpack/bedroll and right-hand axe match the seed.
Eight actual leg/arm/tool poses are a usable rough gait; loop seam and source
drift stay polish items. No private pixels or paid external provider/rigging job.

Default v0.17.0 supplies `walk|south`, eight 100 ms looping keys, spare row y=3072.
[Admission](../scripts/admit-worker-south-walk.py) uses one scale 232/455, fixed
source column roots [224,608,992,1376], row baselines [489,979] and local pivot
[128,244]. All 100 pre-South frame records/pixels and every other clip, team mask,
2048×4096 dimensions and whole-pack pixel-to-world scale remain intact. Carry/Return
uses the existing moving walk/cargo path. No state/economy/shared-clock changes.

[Registration](qa-evidence/worker-land-art-2026-10-04/south-walk-registration.json),
[ordinary/strategic keys](qa-evidence/worker-land-art-2026-10-04/south-walk-keys.png)
and [800 ms loop](qa-evidence/worker-land-art-2026-10-04/south-walk-loop.webp)
are source-pixel evidence. Native recipe: world -Z/South → SW (screen-up) → South,
Stop/resume and cargo Return→idle, both Human seats selected/unselected at ordinary
and strategic zoom. Parent delivery/Mac route must identify a containing build and
record actual root/action acceptance. The sandbox capture gap remains unchanged.

North [PR236](https://github.com/lbeezr/thousand-unit-skirmish/pull/236) merged at
`ddf7b55fdb1020e9de291124161f6b5e4326eec6` after [independent agent review](https://github.com/lbeezr/thousand-unit-skirmish/pull/236#pullrequestreview-5403793245)
of exact head `11c974961d138c9db92c3678a225b65473599b4b`. All 63 reviewer-focused
checks and packed HTTP/hash scenario passed; native/deployed acceptance stays open.

[South preservation](qa-evidence/worker-land-art-2026-10-04/south-walk-preservation.json)
records all 100 preceding frame records/pixels, other clips, mask and idempotent
admission against that merged North baseline. Actual Three checks cover all three
admitted walks, including S→NE→S continuous phase, loops, Stop/resume and cargo
Return on either Human seat selected/unselected. Fishing metadata permits only
verified admitted East/North/South sequences while freezing its original keys.

South all 85 focused pixel/runtime/receipt/clock/heading/fishing/sharding checks,
atlas/docs/whitespace and packed HTTP/hash scenario pass.
[Clean South release](qa-evidence/worker-land-art-2026-10-04/south-clean-release.json)
records source `186fdec778832bd79fa299c5879b7d51aabeaaf6`, 1173 files and
`sha256:707ad98940dfede9163ef9ccc918ee6a90064fd84521ef46300926352e18952d`. Deployment/native acceptance remains open.

## Fourth usable slice: all walk headings complete

[West source iteration](art-direction/human-roster-v1/generated/worker-walk-west-v1/README.md)
and [NW source iteration](art-direction/human-roster-v1/generated/worker-walk-north-west-v1/README.md)
use their actual public default idle seeds, preserved tool prompts/layouts/raws and
eight whole silhouettes each. West is back/screen-up-left with its axe far-side
occluded as in the seed; NW is left-facing side profile. These are distinct correct
camera views and actual articulated poses, with retained first-pass loop/drift
polish. No private pixels, paid external provider/rigging jobs or facing relabels.

Default v0.19.0 has all eight walks, each eight100ms looping keys. West/NW append
at y=3328/3584; all108 earlier frame records/pixels, every other clip, mask,
2048×4096 dimensions and pixel-to-world scale are preserved. Registration is
one shared scale/root per source (West232/442 roots[192,576,960,1344], baselines
[490,977]; NW232/427 same roots, baselines[477,975]); local pivot[128,244].
Carry/Return uses each actual walk and the existing cargo cue.

[West registration](qa-evidence/worker-land-art-2026-10-04/west-walk-registration.json),
[West keys](qa-evidence/worker-land-art-2026-10-04/west-walk-keys.png),
[NW registration](qa-evidence/worker-land-art-2026-10-04/north-west-walk-registration.json)
and [NW keys](qa-evidence/worker-land-art-2026-10-04/north-west-walk-keys.png)
are source-pixel evidence. Normal default Three playback checks cover the five
newly admitted headings on both Human seats selected/unselected, full loops,
heading phase, Stop/resume and cargo Return→idle. Native recipe adds world -X/West
screen-up-left and yaw-PI/4/NW screen-left, turn through adjacent headings and
repeat the same ordinary/strategic/cargo checks. Actual appearance remains open
on an identified containing deployment/native build via the parent route.

South [PR238](https://github.com/lbeezr/thousand-unit-skirmish/pull/238) merged at
`6ca45a9fcf28381b5d4ee80779fdb92e04e04e7a` after [independent agent review](https://github.com/lbeezr/thousand-unit-skirmish/pull/238#pullrequestreview-5403823198)
verified exact head `23ad69aa8798e0559a881a761f66405cd1a145c2`; all85 focused
checks, package/HTTP, source identity/facing/articulation and preservation passed.
The [W/NW preservation receipt](qa-evidence/worker-land-art-2026-10-04/west-walks-preservation.json)
checks the108 preceding frames/decoded pixels, all other clips, mask and byte-idempotent
rebuild against that merged South baseline. No deployed/native claim is made.

All90 focused checks, atlas/docs/whitespace and packed HTTP/hash scenario pass.

[All-eight-walk clean release](qa-evidence/worker-land-art-2026-10-04/eight-walks-clean-release.json)
records exact source `d4ba9de1ebcabaadec1a40e65a5cec3cf0c696ff`, 1173 files,
`sha256:dc2aef04126c74cba565c950bb09923dbf60c3a69857713fba3baf19e2a85bd7` and three runtime file hashes.

## Fifth slice: dedicated Stone SE and exact adoption dependency

[Retained Stone iteration](art-direction/human-roster-v1/generated/worker-stone-eight-v1/README.md)
contains the public eight-idle seed/layout/prompt, raw attempt and all32 extracted
whole poses. The attempted eight-heading sheet failed functional facing: several
strike rows rotate to the same right-bearing pose. Only actual SE keys12–15 are
admitted. Other rows are retained rejected candidates; no eight-heading claim.

Default packv0.20.0 now contains `human / gather-stone|south-east`, four210ms
looping keys, with a visibly dedicated mining pick and unchanged Worker costume.
[Admission](../scripts/admit-worker-stone-se.py) uses shared232/183 scale, fixed
column roots[156,412,668,924], baseline779 and local ground root[160,244]. Four
320x256 cells fit spare row3840 without repacking prior124 frames, resizing the
atlas or changing world scale/mask/other clips. [Registration](qa-evidence/worker-land-art-2026-10-04/stone-se-registration.json),
[key sheet](qa-evidence/worker-land-art-2026-10-04/stone-se-keys.png) and
[840ms loop](qa-evidence/worker-land-art-2026-10-04/stone-se-loop.webp) retain source
hashes and aspect-correct ordinary/strategic pixel review. Loop/drift polish stays open.

**Concrete default binding dependency for animation01a103d4 / PR216:**
`activeState` still returns idle for confirmed `performingAction: gather-stone`.
The dedicated SE clip exists, but default work currently displays `idle-south-east-0`.
Enabling the state alone is insufficient: Human approximate `gather-stone` lookup
currently returns SE for all other headings. Extend the bounded selector/heading
policy so authored SE plays and seven missing headings retain their exact idle.
Keep receipt precedence/interruptions and shared clocks; no economy changes.
The art task leaves those owned helpers unchanged and retains source/pack ownership.
Default Stone playback, containing deployment and native root/contact acceptance
remain incomplete until this concrete adopter change and exact-build capture.

All eight walks merged in [PR244](https://github.com/lbeezr/thousand-unit-skirmish/pull/244)
at `384ac60cb56f372d6e6cfa75a187b0e1eeb5e548` after [independent agent review](https://github.com/lbeezr/thousand-unit-skirmish/pull/244#pullrequestreview-5403864264)
verified exacthead `dc63ad095b2087020b023d910bd9856c03ff8ee7`, all90 focused tests
and packedHTTP checks. Native/deployed acceptance remains open.

[Stone SE preservation](qa-evidence/worker-land-art-2026-10-04/stone-se-preservation.json)
protects all124 prior frame records/pixels, every prior clip/mask and same world
scale/dimensions against the merged eight-walk baseline. Rebuild is byte-idempotent.

All92 focused pixel/default-walk/runtime/receipt/clock/heading/fishing/sharding
checks, atlas/docs/whitespace and packedHTTP/hash pass. This verifies Stone art
admission, not default Stone action playback. [Actual selector-gap observation](qa-evidence/worker-land-art-2026-10-04/stone-selector-gap.json)
records the exact idle state/frame and approximate-heading mismatch that the
animation owner must resolve with the supplied clip.

[Stone pack clean release](qa-evidence/worker-land-art-2026-10-04/stone-clean-release.json)
records code `b2d8e6702236a1598bb7cbe302b17107de218b07`, 1175 files and
`sha256:37e05e727ece6d2a3ef78f9037a16cb51ba67120a9c546bd6c368a1a80acb08e`. The existing three runtime files include this clip;
no directory/defaultadoption flag or new HTTPpath is required. Stone state
and exactheading policy adoption remain owned by the animation consumer.


## Sixth usable slice: NW wood work, preserving the existing default consumer

Dedicated StoneSE pack merged in [PR248](https://github.com/lbeezr/thousand-unit-skirmish/pull/248)
at `69e05489058106d42b87cfb5c4896e14e940ea76` after [independent agent review](https://github.com/lbeezr/thousand-unit-skirmish/pull/248#pullrequestreview-5403914566).
The exact Stone binding request is in [PR216](https://github.com/lbeezr/thousand-unit-skirmish/pull/216#issuecomment-5975731648);
this art slice continues without changing those owned state/clock helpers.

[Retained NW wood v1](art-direction/human-roster-v1/generated/worker-wood-north-west-v1/README.md)
has three real left-profile chops, but the first overhead tool envelope does not
fit at the matched body scale. Preserve that rejected iteration.
[Compact v2](art-direction/human-roster-v1/generated/worker-wood-north-west-v2/README.md)
has three distinct complete shoulder windup/downstrike/recovery keys facing left,
matching the public default NW idle. No headings are copied or mirrored.

Packv0.21.0 adds `gather-wood|north-west`, three240ms keys,720ms looping.
[Admission](../scripts/admit-worker-wood-north-west.py) uses one271/801 scale,
source ground roots[256,816,1344] and baseline900, local root[160,308] in320x320
cells atx2048/y0,320,640. Body height remains about230 pixels and maximum alpha
height remains272, retaining exact0.0052421832906788795 world units per pixel.
The side strip changes page/mask width2048→2560, height stays4096; every old
frame rectangle/record, all prior clips and all decoded old pixels remain exact.
The longest texture dimension remains4096. Page allocation grows25%; native
GPU acceptance remains open. The previous encoded mask is retained in evidence,
and decoded old zero mask pixels plus new zero extension are checked explicitly.

[Preservation](qa-evidence/worker-land-art-2026-10-04/wood-north-west-preservation.json)
protects128 prior records/pixels,53 prior clips, the historical full mask file and
world scale. [Registration](qa-evidence/worker-land-art-2026-10-04/wood-north-west-registration.json),
[ordinary/strategic keys](qa-evidence/worker-land-art-2026-10-04/wood-north-west-keys.png)
and [loop](qa-evidence/worker-land-art-2026-10-04/wood-north-west-loop.webp) record
exact shared roots, actual distinct RGBA hashes and the complete silhouette.
The frozen fishing-era pixel test now measures its exact historical ROI row by
row across the wider atlas; all original/fishing pixels remain protected.

The existing default selector consumes confirmed `performingAction:gather-wood`
atNW without state-helper changes, including empty cargo; intent alone remains
idle. Tests exercise both Human seats selected/unselected, full loop, Stop/resume,
movement/attack interruptions and cargo return. Missing other wood headings
retain exact idle and NW food stays idle. Native recipe: on a containing normal
Human match stand screen-right of a tree/wood node, face NW/screen-left, observe
these three chops, Stop, resume, move away, return a load and attack/interrupted
work. Record build/map/seat and ordinary/strategic scale, axe contact/ground root.
Do not claim source/default CPU playback as actual GPU capture.

Walks remain8/8; wood nowSE+NW, other five land-work/combat actions stillSE;
Stone hasSE art awaiting the bounded consumer adoption. **48 cells remain**:
6 wood +35 food/build/repair/attack/defeat +7 Stone. Fishing remains excluded.
The next ranked art slice is a small complete actual food-work heading, then
build/repair/attack/defeat and remaining Stone; preserve all useful SE motion.


NW wood validation: all95 focused pixel/default Three action/receipt/clock/heading/
fishing/contact/client/sharding tests pass. Atlas/docs/whitespace, deterministic
byte-idempotent registration and real packed BasicAuthHTTP/WebSocket/hash checks
pass. Independent review, author merge and exact deployed/native acceptance remain
open at this checkpoint; no runtime/economy/clock helper changed.
