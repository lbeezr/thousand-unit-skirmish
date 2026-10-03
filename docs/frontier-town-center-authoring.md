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


## Fixture-tested lifecycle automation

The [authoring runner](../scripts/author-frontier-town-center-lifecycle.py)
imports this preparation script directly; it does not duplicate the camera or
collection scaffold. It pins the scaffold's content hash so a changed calibration
requires an explicit update. Outputs must be new private directories outside
the checkout.

```bash
blender --background --python-exit-code 1 \
  --python scripts/author-frontier-town-center-lifecycle.py -- \
  --fixture --output-dir /workspace/town-center-private-lifecycle-pilot/fixture-01
python scripts/verify-building-lifecycle-pixels.py \
  /workspace/town-center-private-lifecycle-pilot/fixture-01 --write-sheets
node scripts/validate-building-lifecycle.mjs \
  /workspace/town-center-private-lifecycle-pilot/fixture-01/renderer-manifest.json \
  --require-lifecycle --require-team-masks
```

This produces a **synthetic test building**, five states × eight color views
and forty aligned owner-alpha masks. It is not derived Frontier artwork and is
never enabled in the game. The fixture's simple owner marker and test lighting
are not approved faction standards or a Complete render match.

Recipes explicitly select named semantic parts. Unchanged parts share mesh
data; edited parts receive independent copies. The runner checks the master
data remains unchanged, keeps the calibrated root and cameras fixed, and
refuses automated edits in Complete. Optional construction props can remain
in the authoring master but be excluded from Complete's reviewed selection.

Masks use semantic owner tags rather than color-key extraction. The opaque
grayscale render retains neutral-geometry occlusion, then the exporter converts
its selected coverage into white RGB plus owner-only alpha. The runtime uses
Canvas `destination-in`, which reads alpha; neutral architecture must be
transparent in the final mask. The earlier PR #54 fixture had full-building
alpha and could recolor neutral geometry despite its grayscale RGB selection.
Its dated receipt is historical; use the corrected
[owner-alpha validation record](qa-frontier-lifecycle-alpha-masks-2026-10-03.json).
An occluded
standard can produce a black mask in that view; every state must have a visible
cue in at least one direction for this fixture check. Real art still requires
ownership readability at game size.

The [pixel checker](../scripts/verify-building-lifecycle-pixels.py) decodes
and hashes the actual PNGs, verifies dimensions and white owner-mask RGB,
checks that mask alpha does not exceed color coverage or escape it, and creates
explicitly labeled review sheets. Whole-image alpha equality is not expected:
neutral geometry is opaque in color and transparent in the mask.
Metadata admission remains a separate existing validator.

Run the targeted behavioral and failure-injection checks:

```bash
blender --background --python-exit-code 1 \
  --python scripts/frontier-lifecycle-authoring.test.py
python scripts/building-lifecycle-pixels.test.py
```

These need installed Blender 4.3.2 and Python with Pillow/NumPy. They do not
install software or call a provider. The synthetic-only measured result is in
[the validation record](qa-frontier-lifecycle-automation-2026-10-03.json).
Private .blend files, renders, GLBs and Library identifiers are absent from Git.

### Real-source insertion

When the supported source transfer succeeds, `--import-source /absolute/model.glb`
with a new `--output-dir` verifies the original hash, imports it without editing
its bytes, applies the existing root calibration once, and saves an editable
scene and mesh/material inventory privately. Semantic parts are left unassigned;
the importer does not pretend arbitrary source meshes are architectural parts.

Partition or reconstruct meaningful architecture, assign each master mesh a
unique `semantic_part` and `team_mask` boolean, and preserve the verified source
provenance, calibrated root/cameras and empty state collections. Match Complete
appearance first. Then `--authored-blend /absolute/master.blend --source-glb
/absolute/model.glb --recipe /absolute/recipe.json --output-dir /absolute/new-output`
captures an unaccepted authored candidate. Review the Complete selection against
the original: metadata and source hashes cannot certify its silhouette or style.

The real model remains unreadable in this cloud workspace. No actual Frontier
geometry, owner-standard correctness, lifecycle art, render parity or game
acceptance is established by the fixture.

### Source-transfer diagnosis, 3 October 2026

This diagnosis is specific to the original selected executor. The user later
reported a successful supported resolved-reference Library transfer in the
native cloud worker, with the recorded original byte count and hash. Actual
source inspection and lifecycle production belong to that worker. No transfer
retry or duplicate production is required from the automation lane.

The current Library filename search resolves the recorded original. The
supported search/list route is the current bundled `library_download.py`
helper supplied with the complete search result, selection `000` and a
private destination. Its network-enabled execution exits 1 with:

```text
library download request failed: hosted apps tools/list request failed: network
```

The failure occurs at helper tool discovery, before requesting model bytes.
No HTTP status, authorization-denial response or automatic approval-review
rejection was returned. This establishes a repeatable helper/transport failure;
it does **not** establish that the failure is transient or that policy denied
the model. GitHub access succeeds in the same environment.

An earlier lower-level `library_prepare_materialize` call returned transfer
metadata, but the bundled `library_file_transfer.py materialize` helper failed:

```text
library file transfer failed: download failed
```

That earlier direct preparation was not the current search/list fast path
and was not repeated in this continuation. No alternate transfer route was
used. Transfer URLs and credentials are not recorded here.
