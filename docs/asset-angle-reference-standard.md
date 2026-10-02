# Asset angle-reference acceptance standard

**2 October 2026:** requested standard for future design references and sprite
admission. The convention below is verified at fork main `9990ed3`; historical
art remains preserved with its existing review status. This document adds no
runtime feature or automatic acceptance of existing packs.

Every design reference must identify its view and, when orientation affects its
game use, carry degree labels that map to the runtime convention. Concepts may
label intended angles **approximate**. Production acceptance requires measured
camera, rotation and registration evidence; numbers printed on drawings are
insufficient. Preserve the chosen visual design throughout that calibration.

## Verified runtime convention

[Camera controls](../src/camera-controls.mjs) define view direction
`[0.78, 1.12, 0.78]`; [camera construction](../src/main.js) uses an orthographic
camera with world +Y up. Azimuth is 45°, elevation is 45.4359024848°, screen roll
is effectively zero. Movement sets heading with `atan2(dx, dz)` and rotates
geometry about +Y: yaw 0 faces +Z; positive yaw turns +Z toward +X; 90° faces +X.
Degrees increase in the sequence below, modulo 360.

[The sprite runtime](../src/unit-sprite-runtime.mjs) quantizes the same heading
to eight named clip directions. These names identify **world** directions, not
the apparent compass direction on the screen. Keep both fields in manifests.

| World yaw | World facing (X,Z) | Runtime clip key | Screen heading at current camera |
| --- | --- | --- | --- |
| 0° | (0,+1), +Z | `north` | down-left |
| 45° | (+1,+1), normalized | `north-east` | down |
| 90° | (+1,0), +X | `east` | down-right |
| 135° | (+1,-1), normalized | `south-east` | right |
| 180° | (0,-1), -Z | `south` | up-right |
| 225° | (-1,-1), normalized | `south-west` | up |
| 270° | (-1,0), -X | `west` | up-left |
| 315° | (-1,+1), normalized | `north-west` | left |

The screen-right ground basis is `(X-Z)/sqrt(2)`; screen-up is a negative
multiple of `(X+Z)`. This independently confirms the table. Do not apply an
extra 45° offset because a clip is named `north`. Preserve source headings and
adapt any different pipeline convention explicitly at its import boundary.

## Coverage appropriate to the asset

| Asset type | Required reference evidence for its intended use |
| --- | --- |
| Animals, units, vehicles | Front/side/back anatomy views with stated view rotation and camera; a separate fixed-runtime-camera set at all eight yaw angles used by clips. List required states and animation phases; do not treat anatomical profiles as calibrated game views. |
| Buildings and directional props | Rotated views at each yaw admitted by placement, with doors, roof/occlusion and footprint readable. Declare proven symmetry if fewer unique images suffice; retain a mapping for all supported rotations. |
| Trees, rocks, crops and harvest resources | All placement rotations that visibly change silhouette or interaction cues, explicit symmetry/rotation reuse, constant footprint/pivot and separate resource states. A single symmetric source needs a verified reuse rule, not invented headings. |
| Biome/world/landscape keys | Label camera/projection and orientation of the scene or map; degrees refer to scene view/orientation. Identify these as style/placement references rather than object sprite sets. |
| Flat UI icons and diagrams | Mark object yaw not applicable when the asset has no directional game use; identify plane/view and size. No fabricated 3D rotation requirement. |

An art inventory can record unsupported views as missing. Preserve historical
outputs and their defects; this standard does not authorize blind regeneration,
spending, deleting iterations or admitting unreviewed binaries.

## Scale, ground and registration

Lock camera position relative to target, projection, elevation/azimuth, render
resolution and orthographic span. Rotate the object around one declared root;
do not move the camera or rescale each panel to make it fill a cell. Record
physical shoulder/body/building dimensions and collision footprint separately
from image bounds. A Sheep proposal is 0.60 shoulder height and 0.90 nose-to-rump;
its concept sheet does not prove those measurements.

For each view, keep the same ground plane and root at contact height. Export a
common pixels-per-world-unit scale and an image-space pivot measured from that
root, using upper-left pixel coordinates. Record root/pivot after crop and atlas
packing; crop padding must not shift the game contact point. Fit the whole
silhouette including ears, tails and permitted action excursions. Separate
contact shadows, labels and construction guides from sprite layers. Verify alpha
edges, groundline and collision footprint at game zoom and density.

A deterministic rendered model or measured construction proxy produces stronger
cross-view geometric evidence. A painted multi-view concept remains a design
reference until its projection and landmarks have been checked; plausible
appearance is not geometric consistency.

## Angle-specific extraction and manifest proposal

Before extraction, index every source panel by `panelId`, source hash, view type,
intended/actual `worldYawDegrees`, runtime clip key, camera parameters, precision
status, source rectangle and review. Keep approximate concept angles distinct
from measured actual rotations. The
[Sheep v3 manifest](art-direction/bellweather-sheep-reference-v3/manifest.json)
provides a candidate mapping and proposed crop rectangles; none are extracted
or registered. Its four anatomical angles are not missing oblique sprite views.

A future sprite pipeline should:

1. Select the corresponding angle-specific source panel for each output; cite
   its hash and rectangle in the prompt/job receipt. Retain every original/edit.
2. Supply a calibrated camera/root guide for that yaw while preserving approved
   anatomy and palette. Record the requested action phase and angle. Generate
   missing views explicitly rather than mirror asymmetric features or relabel a
   nearer heading as exact. No provider job is authorized by this document.
3. Review each result against camera/landmarks and neighboring yaw silhouettes.
   Extract transparent per-angle sources only after checking full bounds and
   layer separation; save rejected outputs and reasons.
4. Record extracted source hash, crop/padding, pixels-per-world-unit, groundline,
   pivot, physical footprint, world yaw, clip direction, action/state/frame,
   duration, alpha/shadow layers and parent reference. Convert this reviewed
   source record to the repository's existing atlas schema; this proposal does
   not introduce a new loader schema.
5. Validate all supported headings in the actual renderer at representative
   zooms, with contact and selection/occlusion checks. Record runtime capture
   and acceptance separately from concept review. Declare any approximation or
   fallback deliberately; never let it silently count as exact coverage.

[Measured camera guide](art-direction/environment-camera-v1/README.md) ·
[Sheep reference v3](art-direction/bellweather-sheep-reference-v3/README.md) ·
[Art evolution](lore/art-evolution.md) · [Documentation index](README.md)
