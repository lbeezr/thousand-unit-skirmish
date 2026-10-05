# Human Spearman NE walk source slice — 5 October 2026

Owner: Human foot art. Animation owner `01a103d4` retains clocks, movement/state
selection and protocol. This slice changes the existing default Spearman v1
art pack and its source rebuild/capture checks; it changes no runtime selector,
combat/stance, simulation, provider access or shared capture transport.

## Available source and selected treatment

At main `b5b4dd49139b86dbe6ad0d299469f6b193df81b1`, normal Human/Azure uses
`spearman-sprite-v1` 0.3.0: eight idle headings and eight SE keys each for walk,
attack and defeat. All seven other headings hold their own idle for each action:
21 missing source cells. The retained sources are painted 2D images, not a
matching editable 3D character. The bounded current tracked/workspace inventory
found no approved matching Spearman master/rig. The coarse held v2 is excluded.
No Meshy/provider lookup, credit, login, permission change, Mac operation or denied
dispatch was retried.

The already-public [NE seed](art-direction/human-roster-v1/extracted/spearman/idle/02.png)
and [eight-facing board](art-direction/human-roster-v1/source/spearman-idle-facings.png)
do permit a free local 2D test. Four source UV pieces retain that painted texture:
rigid head/torso/grip and main spear pieces, plus separately articulated lower
legs. This is newly authored camera-frozen 2D motion; no matching 3D master is
invented or required for this NE test. The selected keys reuse only public inputs.
All process scripts, Blender files, logs and meaningful rejected/corrected
iterations remain private with the owner.

The player should recognize the same cream/sage/olive/brown Human carrying one
long two-handed spear while alternating the supporting leg. The body/camera
treatment follows the seed; it does not rotate a SE frame into NE or replace
the identity. [Source registration and hashes](art-direction/human-roster-v1/extracted/spearman/walk/north-east-local-v1/registration.json)
pin the source, selected frames, camera/canvas/pivot, timing, accounting and
separate pending rendered acceptance.

| Time | Selected rough pose | Intent |
| --- | --- | --- |
| 0–200 ms | [Left contact](art-direction/human-roster-v1/extracted/spearman/walk/north-east-local-v1/00.png) | Left boot leads; right leg trails. |
| 200–400 ms | [Right passing](art-direction/human-roster-v1/extracted/spearman/walk/north-east-local-v1/01.png) | Right boot lifts through the passing step. |
| 400–600 ms | [Right contact](art-direction/human-roster-v1/extracted/spearman/walk/north-east-local-v1/02.png) | Opposite contact; leg silhouette opens. |
| 600–800 ms | [Left passing](art-direction/human-roster-v1/extracted/spearman/walk/north-east-local-v1/03.png) | Left boot lifts; loop returns to contact. |

Private independent source review found the initial single-plane mesh fold and
later opaque-cloth split; both functional faults were corrected. Selected
iteration 09 has four distinct pixel/silhouette poses, no clipping or visible
cloth slit, and 54,576 positive-area pose-triangle instances. Face, clothes,
hands and main shaft remain recognizable and coherent. A few shaft-edge pixels
move 0.05–1.18 source pixels (under 0.1 calculated ordinary CSS pixel); this is
non-blocking for the rough source slice, and it is not an exact frozen-every-pixel
claim. The private report binds all inspected source hashes.

## Registration, playback and exact coverage

Pack 0.4.0 reuses **32 prior registered poses unchanged** and adds **four newly
authored NE poses**. One existing public NE identity seed supplies their pixels;
zero provider-generated, mirrored, borrowed-facing or private-input poses are
used. Only `walk|north-east` changes. All eight idle keys and SE walk/attack/defeat
keys keep their registered pixels, geometry, roots and timing. The zero team mask
keeps its pixels; team art improvement remains separate.

The 320×352 source canvas pads the original NE crop by (52,24), moving its
registered pivot from (88,273) to (140,297) without moving the character root.
Global world-per-pixel stays `0.0052421832906788795`, with the same heightWorld
and maximum alpha height 319. Four explicit 200 ms keys loop for 800 ms. The
Blender authoring timeline's 20 FPS does not become 20 FPS playback.

Normal no-option Human binding remains Spearman v1; existing server admission,
Docker and production pack paths retain the same manifest/runtime/mask. No new
preview flag or second state implementation is added. The builder invokes the
guarded append step after compacting the retained baseline. It refuses changed
source keys or prior registered geometry/pixels/clips; PNG re-encoding alone is
not a character change. Rebuilding and a repeated append must preserve the
selected keys and calibration.

| Source checkpoint | Spearman missing | Human military total missing |
| --- | ---: | ---: |
| Main baseline 0.3.0 | 21 | 63 |
| This default-pack 0.4.0 NE source slice | **20** | **62** |

The exact remaining Spearman cells are walk × N/E/S/SW/W/NW, attack ×
N/NE/E/S/SW/W/NW, and defeat × N/NE/E/S/SW/W/NW. Infantry and Archer each retain
21 missing cells. Boughward's separate pack is outside this slice.

## Evidence limits and next actions

Canonical source validation and CPU instanced playback establish source binding,
four distinct registered keys, 800 ms looping, Stop to original NE idle and fresh
resume for both team values/selection states. They do not establish GPU pixels
or both-civilization art. The capture adapter derives missing directions from
the actual pinned manifest and decoded poses; it now expects six Spearman walk
gaps and keeps each false, rather than retaining a stale seven-gap assumption.

Source-size and accurately computed-size private sheets/HTML/GIF were inspected
at ordinary .91, useful 1.5 and strategic .48 zoom calculations for a 720-high
viewport, scale1. These are source previews, not game screenshots. Contact-foot
root offsets and the 2.6-world-unit/second movement speed still need actual
ordinary-game review; torso rigidity and rough pacing are declared limitations.

1. Retain one permitted identified ordinary `worker-animations` capture of paid
   Human Spearman NE Move/Stop/resume, plus the existing SE/gap controls. Inspect
   actual two-phase PNGs, source keys/time, planted support foot, identity and
   readability at useful and ordinary zoom. Shared transport owner `01a10378`
   retains dispatch; no dispatch is callable in this workspace and a denied route
   is not retried. Keep failure ownership exact.
2. Fix a concrete NE functional failure if the permitted capture reveals one;
   extend the six remaining walk headings from their own retained identity
   seeds. Rough adequate motion is preferred over polish; a matching 3D master
   is not claimed or assumed.
3. Produce attack and defeat as separate small slices after walking. Retain
   exact poses, action timing, root/scale and both-team source checks.
4. Record an exact clean source/release digest and separately identify the served
   user deployment. Merge, packing, CPU evidence and a runner-local capture do
   not close deployed or ordinary rendered acceptance.
