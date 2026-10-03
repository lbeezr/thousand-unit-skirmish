# Worker shore-fishing animation pilot

[Shore contract](shore-fishing-foundation.md) · [Renderer](renderer-state-contract.md) ·
[Human production](art-direction/human-roster-v1/README.md) · [Art evolution wiki](lore/art-evolution.md)

The requested first direction is a Worker crouching on the bank, reaching with
a small net, retrieving it and collecting the catch while facing the actual
water spot. The approved four-key south-east study now supplies those moments.
It reads as a low hand-net/scoop action; a thrown cast net remains unproduced.
This is one pose/blocking loop, not accepted smooth animation or eight-heading
coverage. The default approved Human Worker is the reference, rather than the
older Meshy or blue-apron sprite. No paid Meshy work or credits were used.

## Default integration and authority

The server derives the cosmetic heading from `shoreFishSitePositions(map)`'s
water center while Worker paths and gather reach retain the land marker.
`workerFishingPresentation` caches water points by map-definition identity;
publish/reset/recovery reconstruct them from the authored map. There is no
persisted water position or additional simulation state.

Optional unit-row index 16 carries `shore-fish` only for active Worker gathering
at that variant. It follows the same task ownership/fog filtering as index 15's
heading. Existing attack indices 11–13 and work-audio index 14 retain their
meaning. The client clears absent/unknown identity on every snapshot, including
legacy rows, travel, return and Stop. A reused generation clears it before the
first transform. Cargo remains `food`; fishing art does not change the current
checkpoint schema or match rules. Frame timing cannot award a catch or alter gathering rates.

The ordinary sprite renderer selects `gather-fish` with its own elapsed clock.
Movement, attack, repair and defeat retain their precedence. Only an authored
fishing clip at the actual current heading can play. Missing fishing clips use
that heading's food/gather/idle fallback even in approximate preview lanes.
There is no mirroring, nearest-heading fishing reuse or permanent pilot flag.
Human v3 pack 0.14.0 includes the four approved `gather-fish/south-east` keys
through that default selection, without a fishing preview flag. All prior
Worker action pixels, frames and clips remain intact. The other seven headings
and Boughward retain their exact food/gather/idle fallback. Both Lab banks face
east/west at their central land markers, so this first SE clip appears when a
Worker approaches the real bank from the corresponding diagonal; those two
ordinary central approaches do not falsely reuse SE art.

The approved SE reach key also draws a small neutral rope and net rim from its
measured outer net point to the canonical water-cell center. It uses two shared
instanced batches per team and clears outside that actual reach key, on Stop,
combat, movement, defeat, fog/LOD hiding and slot reuse. Other phases retain their
bank-side work. Target derivation matches the current server position/bearing
against the authored water points and fails closed on ambiguity or stale identity.
This cosmetic extension does not move the actor, change gather reach or award food.
The smaller bank ring remains at the land node; its small fish glyph identifies
the water cell. Either glyph or bank ring picks the same existing land resource.
Stock colours/scales, callouts and the fog overlay remain authoritative.

The user explicitly approved publishing the fishing game images and continuing
their default integration. That publication authority is distinct from complete
motion, root and eight-heading acceptance. Full 3D source models remain private.

The [public SE source record](art-direction/human-roster-v1/fishing-SE-v1/README.md)
preserves the raw image, exact executed request, earlier draft, seed/reference,
extracted and registered keys, calibration and hashes. The normalized key and
runtime PNG bytes are unchanged from the approved private pilot. This is still
a four-pose, 1,300 ms hand-net blocking loop rather than a smooth final animation.

## Private deliverables and provenance

| Deliverable | Purpose; stored privately in Library |
| --- | --- |
| `worker-fishing-SE-study.png` | Four keys beside shipped idle |
| `worker-fishing-SE-loop.webp` | 1,300 ms blocking loop |
| `worker-fishing-SE-private-pilot.zip` | Raw source, exact request, draft prompt, reference canvas, extracted keys, registrations and copied runtime pack |
| `worker-fishing-SE-private-QA-kit.zip` | Mac recipe, selected-draw observer, fixed-affine calibration adapter and independent checks |

Library identifiers, exact capture metadata and private receipts remain in the
private handoff. This public guide describes the production contract and source
checks; it does not publish those private references.

The archive preserves the original ImageGen output, every source bound and hash,
four explicit boot-root landmarks, fixed canvas/pivot, shared scale and frame
durations. The later authorized SE source release is linked above; private
capture reports, observer overlays and Library identifiers remain in the handoff.
The pose-sheet comparison is decoded CPU imagery, not a game screenshot.

One whole-strip edit produced all four keys from shipped
`idle-south-east-0`. All keys use a shared actor-calibrated scale of 0.38;
crouching lowers the head without resizing the figure to upright height.
Manual planted-boot registration supplies a projected pivot, independently of
the net's changing alpha bounds. Root and anatomical calibration remain
provisional until engine review. Frame one remains crouched: locking it to the
upright reference would create a snap. The copied Human v3 pack appends four
keys on a new row and preserves all existing frames, clips, source pixels and
team-mask pixels. World units per pixel remains `0.0052421832906788795`.

Rebuild into a new destination with:

```sh
python3 scripts/build-worker-fishing-pilot.py BASE_PACK FRAME_CONFIG NEW_DESTINATION
```

## Skill review and next production

The Game Studio sprite-pipeline skill's approved seed, one whole-strip edit,
shared-scale normalization and preview workflow reduce identity drift and
make incorrect posing visible before packing. The main skill was read; its
linked detailed reference and helper scripts could not be read through this
cloud skill provider. The existing repo extraction/packing tools were used.

The parent-provided review of the native 0.1.2 normalizer identifies an unsafe
default: alpha-bbox width/height determines scale and bottom-center alignment.
A wide net would shrink the Worker or slide the root. This pilot instead uses
actor anatomy and explicit ground landmarks; props may extend outside actor
bounds. A first-frame lock also requires semantically compatible pose, scale
and canvas. The standing reference is unsuitable for this crouched loop.

Next, review this low-net pose direction, correct root/anatomy or net treatment
as needed, and add intermediate poses in one strip for this heading. Produce
each remaining heading from its own approved idle view. Eight labels, copied
keys or mirrors cannot establish eight-direction art. World N/NE/E/SE/S/SW/W/NW
project respectively down-left/down/down-right/right/up-right/up/up-left/left
under the current camera (NE is screen down; SW is screen up). Actual acceptance
requires the fixed game camera and normal/strategic zoom, water targeting,
travel/work/return/Stop and combat transitions for both seats.

The reference canvas spans exactly four slots; extraction uses explicit retained
source bounds rather than a full-width slicing assumption. The preview uses an
explicit ordered list of four keys and their durations, excluding seed/source
PNGs. Registration follows `destination = destinationAnchor + scale *
(source - sourceAnchor)`. This action uses an empty team mask, preserving the
existing pack's unfinished sash coverage; skin, net and fish stay untinted.
Any future ownership mask must receive the identical transform as color, and
an exact seed lock must preserve both color and mask. Smooth loop seam, ownership
mask and all-direction anatomical acceptance remain unverified.

## Evidence — 3 October 2026

Initial checked fork main was `ff1c168`; integration rebased cleanly onto
`f8f4980`, with code head `e551c76` checked after rebase. Forty-six focused tests pass for sprite clocks,
all eight heading fallbacks, water targeting, current snapshot privacy and
legacy clearing, fish schema/placement, placeholders and audio. Seven tests
also pass against the private pilot manifest using
`FISHING_PILOT_MANIFEST=... node --test scripts/worker-fishing-presentation.test.mjs`.
The actual Three.js runtime test checks UV/frame progression and unchanged
world scale with texture-loading stubs; it does not render on a GPU.

[Check receipt](qa-evidence/worker-fishing-2026-10-03/checks.json) records those
results and an independent review with no actionable findings. The reviewer
also passed 44 focused tests against the private manifest and the live Lab
authoring scenario.

The private copied atlas passes `validate-sprite-atlas.mjs`. Ordinary client
import traversal passes with 74 modules after rebase (73 on the initial base).
The shipped Lab server scenario banks
60 food for each seat, conserves all 120 food and 200 wood, retains land-only
Workers, recovers cargo/depletion and resets authored stocks. Additional wire
assertions check actual gathering Workers' water headings and variant for both
seats. The standalone shore-fishing recovery scenario supplies the remaining
economy/recovery regression.

A subsequent rebase onto `8c9a29f` retained both entries in one additive server
allowlist conflict. At `fde738f`, all 46 focused tests, 78-module import traversal
and docs checks pass. No fishing logic or source art changed during either rebase.

Independent integration review finds no actionable upstream interaction and
passes 28 additional Mill, shared Sheep-heading and water-route tests. Syntax,
whitespace, docs links and normal CI registration pass. Hosted CI is not used
as a waiting queue for this slice.

Chrome preflight reports `sandbox-unavailable` and `storage-unavailable`.
No game screenshot, GPU appearance, deployed observation or human loop
acceptance was obtained; no sandbox/security bypass was attempted. The prepared
Library helper failed before reservation at network tool discovery. Authenticated
host uploads saved all three private files and retained their Library identities.

### Subsequent Mac capture and marker occlusion

Subsequent private Mac capture exposed marker occlusion. Its frame, report,
selected-draw observations and full provenance remain in the private handoff.

Pixel inspection of the ordinary frame and close reach/retrieve/collect poses
shows the amber resource-ring stroke covering the Worker's hands/net. The ring
drew at order 2, after unit sprites at 1.1. The scoped renderer correction draws
only shore-fish rings at order 1, beneath the sprite. Its land position, pick
target, size, colour, stock stages, callout and parent fog visibility stay intact.
Other resource-ring orders and all Worker art remain unchanged. The actual
Three transparent-list test checks the ordering at both relative camera depths,
with depletion/rematch and parent-visibility assertions.

The subsequent full chronological private Mac sequence closes the ring-order
defect in the inspected phases. The boot root looks steady through the keys and
wraps; four-pose hand/net changes remain visibly stepped. Max reach still stopped
short of the visible water edge, while retrieve/collect legitimately stayed on
the bank. That observation motivates the measured reach contact and smaller
bank/water cues above, preserving the approved actor bytes.

The contact/cue correction's GPU appearance check remains open. Rerun through
the current ordinary `?play=1&rendererCapture=environment-state` entry route,
using the shipped 0.14.0 pack and a recorded read-only observer. Capture ordinary
view and a continuous close loop without pausing for delivery. Inspect the reach
endpoint inside actual water, clear bank-side collection, steady root/wrap and
selection/stock/fog feedback. Source tests check the actual Three geometry endpoint
and cleanup but cannot establish its appearance. Publication authority is granted;
seven additional fishing headings remain unproduced.
