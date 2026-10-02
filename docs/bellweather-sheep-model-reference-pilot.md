# Bellweather Sheep model-reference pilot contract

**2 October 2026:** preparation only: one proposed textured, unrigged Sheep
model, then local measured rotation renders. No Meshy job, input upload, balance
check or credit spend was performed by this slice. The reported account upgrade
is not verified here; the local account worker owns cost/balance evidence and the
explicit spending cap. Walking remains a later decision.

## Single-subject input recommendation

Use the lower-left front-three-quarter Sheep in the preserved
[v3 sheet](art-direction/bellweather-sheep-reference-v3/README.md), panel
`oblique-front`, approximate intended yaw 0°. Face, ear attachments, fleece
volume and planted legs are visible. Proposed crop `[40,510,310,300]` is upper-left
`(x,y,width,height)` in the 1536 × 1024 source, SHA-256
`ea31df740058b263da30039535d9a7a3a2a5252f06a6d8e5ac2884f2631e557f`.
This crop is proposed, not extracted or uploaded.

Prepare one complete animal with breathing room, no neighboring sheep, sheet
labels, guides or other objects. If unwanted ground guides remain, record a
focused image edit that removes those marks while preserving the design; save
before/after and inspect pixels. Preserve ears, tail and every hoof. Hash the
final chosen input; record its dimensions, parent panel, crop/edit prompt,
source output ID and review.

Do not submit the entire sheet as a single image or claim its anatomy panels
are geometrically consistent multiview inputs: their apparent elevations differ.
Hidden anatomy remains uncertain with one image. Inspect the generated back,
belly and limb attachment rather than inferring acceptance from a front thumbnail.
Retain cream overlapping fleece, pale longish face, lateral brown-pink ears, four
bare lower legs, dark cloven hooves and small tail; no horns or harness.

## Bounded generation decision

After a supported estimate and explicit cap, choose one image-to-3D textured
GLB route, verifying CLI options and recording geometry/texture choices before
submission. Submit once; retain the accepted resource/task ID. Extra variants,
remesh, retexture, conversion or retries require their own cost decision. A
timeout or failed local save does not authorize another create.

Keep original GLB, textures, input, task receipt, thumbnail and actual reported
credit charge. Inspect four connected legs, face/ears/tail, back/belly, texture
seams and unwanted floor geometry. Count vertices/triangles/materials and record
unknowns. Admit a model to Git only after checking actual size, provenance and
quality. Preserve rejected outputs with reasons. This is a sprite-reference
source, not automatic runtime admission or a physical-print deliverable.

## Precise local rendering contract

Use the repository's Three.js world/camera convention, or record an equivalent
renderer conversion matrix. Apply import transforms explicitly; nose points +Z
at yaw 0, +Y is up, planted feet touch Y=0. Root is the hoof-plane center between
planted feet. Save normalization separately and preserve the original GLB.

Use uniform scale. Trial shoulder height is 0.60 world units, nose-to-rump 0.90.
Measure shoulder/nose/rump landmarks and report actual dimensions. If both cannot
be met with uniform scaling, review the proportions; do not stretch axes to force
compliance. Record footprint separately from full geometry and image bounds.

| Parameter | Proposed fixed capture value |
| --- | --- |
| Camera position | `10 * normalize([0.78,1.12,0.78])` |
| Look-at / up | root `[0,0,0]` / world `[0,1,0]` |
| Orthographic bounds | left/right `-1/+1`, bottom/top `-1/+1` |
| Near / far | `0.1 / 100` |
| Azimuth / elevation / roll | `45° / 45.4359024848° / 0°` |
| Output | 512 × 512 RGBA, transparent background, fixed color management |
| Scale | 256 pixels per projected world unit; physical vertical unit projects to about 179.637 pixels |
| Ground-root pixel | `[256,256]` from upper-left before crop |
| Rotation | whole animal about +Y, 0/45/90/135/180/225/270/315°, camera fixed |
| Light | fixed world light/ambient setup recorded in scene; does not rotate with animal |
| Layers | color/alpha; contact shadow separate; labels/guides only in diagnostic contact sheet |

Verify the camera and yaw sequence with an asymmetric calibration object and
root overlay in a separate pass. Keep scale, camera target, canvas and lighting
fixed. Check full silhouette at every yaw. If clipping requires a larger frame,
change the common orthographic span for every view and record the resulting
scale; do not fit individual views.

Export `sheep-yaw-000.png` through `sheep-yaw-315.png` in 45° steps plus a labeled
contact sheet. Carry the
[runtime clip mapping](asset-angle-reference-standard.md#verified-runtime-convention)
into a manifest: model/input hashes, normalization matrix, measured landmarks,
camera/render settings, yaw, clip key, footprint, root pixel, image hash/dimensions
and review. Retain full frames first. Cropping updates pivot to
`[256-x0,256-y0]` while preserving scale; carry it through packing. Target root
agreement is within 0.5 pixel, a proposed tolerance rather than a result.

The pilot delivers reviewed static rotations of one model. It can establish
that model's geometric consistency; it cannot prove hidden anatomy matches the
drawn concept. No runtime loader or animation acceptance follows automatically.

## Walking is a later decision

After static appearance, axes, measured proportions and contact pass, verify a
supported quadruped rig path. The Meshy skill's humanoid rig/bundled walk recipe
does not establish Sheep compatibility. Rigging/walking needs a separate supported
estimate/cap and gait/contact/root review. Reuse the accepted model instead of
regenerating it merely to add motion.

[Angle-reference standard](asset-angle-reference-standard.md) ·
[Sheep design](wildlife-bellweather-sheep.md) · [Wiki evolution](lore/art-evolution.md)
