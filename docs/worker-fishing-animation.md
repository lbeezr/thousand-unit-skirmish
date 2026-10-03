# Worker shore-fishing animation pilot

[Shore contract](shore-fishing-foundation.md) · [Renderer](renderer-state-contract.md) ·
[Human production](art-direction/human-roster-v1/README.md) · [Art evolution wiki](lore/art-evolution.md)

The requested first direction is a Worker crouching on the bank, reaching with
a small net, retrieving it and collecting the catch while facing the actual
water spot. A private four-key south-east study now supplies those moments.
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
first transform. Cargo remains `food`, checkpoint schema remains 22 and match
rules remain 6. Frame timing cannot award a catch or alter gathering rates.

The ordinary sprite renderer selects `gather-fish` with its own elapsed clock.
Movement, attack, repair and defeat retain their precedence. Only an authored
fishing clip at the actual current heading can play. Missing fishing clips use
that heading's food/gather/idle fallback even in approximate preview lanes.
There is no mirroring, nearest-heading fishing reuse or permanent pilot flag.
The public atlas currently has no fishing keys; its art remains unchanged.
The private copied pack loads through this same default state selection when
installed. Publishing candidate pixels still needs the user's approval.

## Private deliverables and provenance

| Deliverable | Authorized Library identity |
| --- | --- |
| `worker-fishing-SE-study.png` — four keys beside shipped idle | `libfile_db5a33d96f9481919d423e1da9bb1f38` |
| `worker-fishing-SE-loop.webp` — 1,300 ms blocking loop | `libfile_2152c1c5a8508191938e6d3bb41a7a89` |
| `worker-fishing-SE-private-pilot.zip` — raw source, exact request, draft prompt, reference canvas, extracted keys, registrations and copied runtime pack | `libfile_a18aa8f2e11c81919ce3d7d33000326e` |
| `worker-fishing-SE-private-QA-kit.zip` — Mac recipe, selected-draw observer, fixed-affine calibration adapter and independent checks | `libfile_dd66a9ce7d108191b6348f182dcda5b9` |

The archive preserves the original ImageGen output
`exec-55affbcf-8f5b-4476-9104-256676ee881c.png`, every source bound and hash,
four explicit boot-root landmarks, fixed canvas/pivot, shared scale and frame
durations. None of its new generated pixels are published in this repository.
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

Private Mac QA on `75f4b7b38aacc291bb7e4952259d9cd9619cc11b` produced one ordinary
view and 22 chronological close views across 7,633.4 ms. All four SE frame IDs
were observed naturally, with a current visible decoded Human fishing draw,
the real land approach/water heading, food cargo and successful Stop clearing.
The observer is a recorded read-only diagnostic source overlay, not a stock-art
build. Runtime exceptions were empty. Library retains the
first ordinary frame (`libfile_8968faee89b481919f08651f960cc8bc`),
report (`libfile_541e2f93ca348191be67c90f6d494778`) and full private provenance
(`libfile_836ceb80b89c819185e9a48c3e85aba6`). These pixels remain private.

Pixel inspection of the ordinary frame and close reach/retrieve/collect poses
shows the amber resource-ring stroke covering the Worker's hands/net. The ring
drew at order 2, after unit sprites at 1.1. The scoped renderer correction draws
only shore-fish rings at order 1, beneath the sprite. Its land position, pick
target, size, colour, stock stages, callout and parent fog visibility stay intact.
Other resource-ring orders and all Worker art remain unchanged. The actual
Three transparent-list test checks the ordering at both relative camera depths,
with depletion/rematch and parent-visibility assertions.

The after-fix visual check remains open. Rerun the private Mac adapter on the
checked revision through the current ordinary `?play=1&rendererCapture=environment-state`
entry route, preserving the atlas and observer overlay hashes. Capture the
ordinary view and a continuous close loop without pausing for delivery; then
inspect net/hand readability, root and seam, retaining selection, stock and fog
feedback. The source-only ring fix neither publishes candidate pixels nor
establishes full art acceptance. Public pixel integration still requires the
user's publication authority; seven additional headings remain unproduced.
