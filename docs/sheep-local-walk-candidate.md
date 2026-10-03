# Bellweather Sheep: one-heading local walk candidate

The next useful art test is one genuine articulated walking heading using the
existing private model. The [default eight idle views](qa-sheep-eight-view-default-2026-10-03.md)
remain the game binding. This document does not establish that the model can
deform or that a walking clip exists.

## Current inspection boundary — 3 October 2026

Main `7c6ec842349cab30afde9244c8953fee8ab91599` supplies the preserved producer
[capture contract](../assets/wildlife/bellweather-sheep-static-v1/source/capture-contract.json).
It reports an unrigged source and four approximate hoof contacts. Those
geometry/rig statements are already-public producer metadata, not a new
consumer GLB inspection. The [status receipt](qa-evidence/sheep-local-walk-feasibility-2026-10-03/status.json)
keeps actual model inspection and walking feasibility explicitly unset.
The private original has not become readable through supported Library
materialization in this environment. Neither model nor source archive was
materialized, imported, altered or published in this step. Exact private
source and transfer details remain outside the public repository.

[Local capability receipt](qa-evidence/sheep-local-walk-feasibility-2026-10-03/local-capabilities.json)
verifies Blender 4.3.2 starts in background mode, Rigify is installed with horse,
cat and wolf templates, and core IK exposes target, pole target, finite chain
length and stretch controls. The `game-dev` CLI is absent; the available route
is the user's explicitly authorized existing Blender/local-rig workflow.
The [Blender IK manual](https://docs.blender.org/manual/en/4.0/animation/constraints/tracking/ik_solver.html)
documents these controls; the installed API diagnostic is the version-specific
evidence. This capability check creates one disposable diagnostic bone in
memory, saves no scene/model and makes zero provider calls.

The blocker is readable private model bytes. Supply the exact existing GLB in
the consumer environment through a supported private transfer; a lossless
compressed copy may fit the consumer transfer capacity. Verify the decompressed
original against the preserved capture contract before inspection. Paths from
another agent's environment are insufficient. Do not upload the full GLB to
the public fork to solve this transfer problem.

## Neutral pose and reported contacts

The current captures label **nose heading**. The source head is turned about
42.035° from the body's long axis. That standing pose is unsuitable as the
default locomotion-facing reference. Keep its existing idle frames unchanged.
For a private walk working copy, align the body's forward axis to +Z. In the
existing normalized capture coordinates this is an additional +42.035° Y
rotation. A neutral forward-looking head still requires a reviewed neck/head
deformation; rotating the whole animal does not straighten its neck.

The following values are derived from the producer's reported contacts, rotated
into that body-facing frame. They identify two front/back pairs and provide
initial hoof targets, not verified joints. Flanks A/B deliberately avoid an
unreviewed anatomical left/right assignment.

| Producer hoof | Candidate station | Body-aligned X | Body-aligned Z | Reported minimum height |
| --- | --- | ---: | ---: | ---: |
| 0 | Front, flank A | -0.085458 | 0.239743 | 0.000140 |
| 3 | Front, flank B | 0.083574 | 0.249190 | 0.000000 |
| 1 | Rear, flank A | -0.115870 | -0.244994 | 0.000151 |
| 2 | Rear, flank B | 0.117755 | -0.243940 | 0.000270 |

This layout is a plausible starting point for a four-leg rig. It cannot establish
whether fleece/skin vertices connect cleanly, the legs are fused, UV seams are
usable, knee/hock bends have sufficient geometry, or weights can preserve the
silhouette. Do not derive joint centers from alpha boxes or treat a hoof-region
centroid as a limb joint.

## Geometry-first inspection

The [read-only Blender inspector](../scripts/inspect-sheep-rig-candidate.py)
requires source hash and byte count to match the preserved contract before
importing the GLB. It records imported mesh/triangle counts, UVs, existing
armatures/groups/modifiers/actions, normalized bounds and samples around the
reported hoof contacts. It verifies the original hash again afterwards, writes
only a JSON receipt to a new destination, and explicitly leaves walking
feasibility and joint/deformation/render review unset. It never saves a model,
creates a rig on the Sheep, normalizes the source or renders new art.

Use private paths outside the repository, with a destination that does not yet
exist. Once the original bytes are readable, this is the intended invocation:

```sh
BLENDER_USER_CONFIG=/workspace/bellweather-sheep-private-inspection/blender-config \
blender --background --factory-startup --threads 2 --python-exit-code 1 \
  --python scripts/inspect-sheep-rig-candidate.py -- \
  --model /workspace/bellweather-sheep-private-inspection/bellweather-sheep-original.glb \
  --contract assets/wildlife/bellweather-sheep-static-v1/source/capture-contract.json \
  --output /workspace/bellweather-sheep-private-inspection/geometry-v1.json
```

Then inspect front, rear and both body-aligned profiles with a simple neutral
material and visible wireframe. Identify each hoof's attachment, the actual
forelimb and hindlimb bend centers, neck attachment and torso separation. Check
for disconnected fleece, overlapping/fused limbs, inverted surfaces and
unusable joint rings. Record landmarks against original vertex positions.
The current four contacts alone do not authorize inventing those joints.

## Small local rig and render trial

After joint inspection establishes usable geometry, work only on a new private
copy. Fit the installed Rigify horse template or a small manual armature to
the reviewed limb/neck landmarks; template bones are initial scaffolding, not
automatic Sheep anatomy. Use independent hoof IK targets and pole controls,
bounded limb chains and disabled stretch. Keep torso/head regions controlled
separately and inspect small poses before attempting automatic weights on the
detailed source. If a simpler deformation cage is needed, preserve the full
render source and transfer weights only after checking each leg's influence.

First review one lifted fore hoof, one lifted hind hoof, and a small neck turn
while the other hooves remain planted. Accept attachment and fleece volume
before assembling a slow four-beat walk. Author contact and passing poses with
actual leg articulation. During each stance interval, keep that hoof fixed in
world coordinates while the body advances; during swing, lift and replace it.
Measure ground penetration, stance-foot drift, mesh collapse and cycle closure.
Body bobbing or whole-model sliding cannot substitute for the leg motion.

Render only **body-forward heading 0** at the existing fixed oblique camera,
512×512, root `[256,256]`, 256 px/world unit and the preserved world lighting.
Start with four contact keys plus four passing keys and an explicitly authored
timing record. Keep a separate debug ground/contact view; final color cutouts
have transparent backgrounds and no baked floor/shadow. Compare the first/last
pose, projected ground root, alpha margins and fleece volume, and review a loop
beside a Worker at normal and strategic game scale.

Only after this articulated one-heading render passes should other headings
or a runtime walk contract be considered. Current neutral Sheep are stationary
food nodes and have no movement heading; `wildlifeNoseYawDegrees` is an idle
presentation field. A future locomotion clip must define body heading and
simulation use explicitly rather than relabeling the static nose views.
No animation or moving-animal behavior is added by this proposal.

## Evidence and spending

This step supplies a verified local tool receipt, a source-pinned inspection
script and a bounded candidate. The script's geometry path is checked on a
separate already-public non-Sheep fixture (eight meshes, 1,324 vertices, 680
triangles, original hash unchanged). Wrong source hashes and existing receipt
destinations are rejected without a new receipt. That is tooling evidence only.
Actual Sheep model bytes, joint fit, skin weights, neutral head pose, articulated
motion and render review are still unverified. Preserve all source/provenance
in the private working area. No base regeneration, paid Meshy rigging, provider
submission, new credits, full-source publication or runtime GLB is requested.
