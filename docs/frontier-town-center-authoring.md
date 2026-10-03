# Frontier Town Center authoring preparation

[Building pipeline](building-asset-production-pipeline.md) · [Frontier architecture](lore/frontier-architecture.md) · [Runtime audit](art-runtime-audit-2026-10-03.md)

Preparation, 3 October 2026. The Complete model is preserved privately in
Library. Its expected original is 129,781,816 bytes, SHA-256
`c86e1e55223df8b26c8060622ea3bbd2fb49e78ae576417734bd8eb6a30c6faa`,
matching the published [measurement](../assets/buildings/frontier-civilization-scale-pilot-v1/town-center-measurement.json).
The cloud's supported Library download returned `download failed` before any
local model was installed. No actual geometry inspection, Blender import or
new lifecycle artwork is claimed here. Private source/model bytes stay outside Git.

## Reusable scene preparation

The [Blender script](../scripts/prepare-frontier-town-center-blender.py) prepares
an empty editable scene from the eight published Complete capture records.
It verifies their PNG hashes and shared calibration, creates eight orthographic
cameras, and checks that Blender projects the ground origin to the recorded
pixel anchor within 0.001 pixels. This validates camera mathematics; lighting,
materials, model import and rendered Complete parity remain separate checks.

Run the tested Blender 4.3.2 in a new background process, choosing new private
destinations for every iteration:

```bash
blender --background --python-exit-code 1 \
  --python scripts/prepare-frontier-town-center-blender.py -- \
  --output /workspace/town-center-private-lifecycle-pilot/authoring-01.blend \
  --report /workspace/town-center-private-lifecycle-pilot/authoring-01.json
```

Existing output paths are refused. The scene has no source geometry or lights
and cannot supply usable building renders. Its report explicitly marks source
import, lifecycle art, lighting parity and masks as unproduced/unverified.
The local preparation run verified all eight source-image hashes and camera
anchors; maximum observed anchor error was 0.000466 pixels. The resulting empty
scene was saved privately. This is a preparation receipt, not a model render.

The cameras use 46° elevation, 45° azimuth steps, an eight-unit orthographic span,
1024×1024 pixels and the existing 128 pixels/world unit. Three's Y-up coordinates
map to Blender Z-up as `(x,y,z) → (x,-z,y)`. The calibrated root records uniform
scale `2.3568558172774785` and the converted, scaled grounding translation.
Blender's glTF importer already converts axes; apply this root calibration once.
Camera View 01 is the first comparison target, not a new accepted capture.

## Editable master and lifecycle states

After verified source bytes become locally readable, preserve the original,
inspect its node/material/connectivity structure and save an editable master.
The seven empty semantic collections are authoring targets: foundation/steps,
structural timber, wall envelope, roof planes, bell tower, owner standards and
civic props. They do not assert that the generated GLB already separates these
parts. Split or reconstruct meaningful architecture after inspecting actual
geometry and all sides; preserve the Complete silhouette and appearance first.

| State | Intended authored change | Runtime selection |
| --- | --- | --- |
| Foundation | Established support footprint, steps and readable early building work | Incomplete progress ≤27.5% |
| Frame | Load-bearing timber, partial envelope and deliberate unfinished roof | Incomplete progress >27.5% |
| Complete | Original civic hall, wings and bell tower, with corrected owner standards | Complete HP >60% |
| Damaged | Local roof/wall damage that retains the original load-bearing identity | Complete HP >30% through 60% |
| Critical | More severe, deliberately composed damage with readable remaining supports | Complete HP ≤30% |

Use linked shared geometry for unchanged parts and independent meshes for
modified parts. A height clip of the monolithic model does not establish a
structural Frame; deleting arbitrary polygons does not establish coherent damage.
Keep all states registered to the same root and cameras. The current runtime
has no persistent ruins state; cached collapse is a separate later feature.

Owner standards need explicit geometry/material selection. Cultural ochre stays
neutral; masks cover the authored owner cue rather than arbitrary blue pixels.
Use straight-cut Azure/bar/square and forked Ember/split/diamond treatment from
the [style guide](frontier-civilization-art-style.md). The empty mask collection
does not produce or validate masks.

Match one Complete image with the published camera before any state batch.
Blender lighting/color management differs from the existing Three capture;
the recorded hemisphere/key settings are reference inputs, not interchangeable
Blender light intensities. Inspect both image pixels and silhouette registration.
Then author the states, inspect a small aligned comparison, and only afterward
capture five states × eight views plus forty aligned masks. Preserve intermediate
masters, reports and selected art iterations in the existing architecture/art
evolution record when publication of those actual outputs is authorized.
