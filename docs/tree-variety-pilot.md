# Approved-source tree variety pilot · 4 October 2026

Owner: tree-variety stream from task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`.
This is a **prepared source pilot**, not default gameplay delivery or a complete
tree roster. It reuses public pine derivatives and prepares deterministic view
and scale selection. The shared runtime binding awaits the terrain owner;
same-design lifecycle captures require private source bytes that are absent.
No generation, purchases, provider access, private upload or Mac work occurred.

## Source audit

Audit base: clean `e445d344bafe68823b51babe60ccdad6508ce8ad`. Read current
AGENTS, art production lanes, source contract PR318, and renderer PR323.
The game-asset-production skill was inspected. Its `game-dev` CLI is absent
in this cloud environment, so no CLI mesh inspection, normalization or canonical
package receipt is claimed. Existing repository pixel checks work independently.

| Retained source family | Actual views and states | Runtime use and source gap |
| --- | --- | --- |
| Frontier Meshy oak v1 | Eight intact camera-orbit captures at azimuth 0–315°, elevation 46°; model/light fixed. | Historical single view01 fallback. Original and optimized private models/task receipts absent. |
| Frontier Meshy pine v1 | Same eight camera-orbit views. | Historical single view01 fallback; model/receipt gap as above. |
| Fixed-camera oak v3 | Eight distinct intact model-yaw captures, one measured union fit. | Existing default generic forest views and full wood-node atlas. Private optimized GLB absent. |
| Fixed-camera pine v3 | Eight distinct intact model-yaw captures, one measured union fit. | Existing default generic pine forest views. Private optimized GLB absent; no same-design worked/low/stump captures. |
| 21 regional lifecycle atlases | Four stock states per family, one painted view per state, no direction IDs. | Existing mip/gutter atlases and individual fallback; no proven editable tree-model lineage or additional yaw views. |
| Cedar | No independently identified cedar source/model/task in the inspected tree manifests. | Do not relabel Frontier oak or regional highpine as cedar. Exact cedar source identity remains unresolved. |

The 21 regional families are field maple, hedgerow, cultivated palm, garden
hedge, conifer, fringe canopy, acacia, palm, scrub, tidal tree, merebloom, bramble,
leafy hornbeam v2, copperleaf, moss hornbeam, muted copperleaf v2, old plum, root
oak, young hornbeam, mistbark and highpine. Their existing atlases remain the
state/UV authority. A painted view or mirror does not supply a new physical yaw.
The berry bush has eight v3 views too, but is outside this tree pilot.

`python3 scripts/validate-fixed-camera-resources.py` passed all 24 existing
oak/pine/berry frames: exact source-to-atlas-to-lossless-WebP RGBA, distinct
nonempty unclipped frames, hashes, camera metadata and shared root. It reports
`sourceHashVerified: false` for all three because GLBs are absent. This proves
retained derivative bytes, not a new cloud model import or rendering run.

Both existing [pine contact sheet](../assets/environment/frontier-meshy-fixed-camera-v3/pine/contact-sheet.png)
and [oak contact sheet](../assets/environment/frontier-meshy-fixed-camera-v3/oak/contact-sheet.png)
were visually inspected. Pine retains a narrow irregular crown and exposed
roots across physical turns; oak has a broad asymmetrical crown and trunk.
These are historical rendered source evidence, not pilot normal-game frames.

The parent supplied the completed actual-pixel aesthetic audit at `6183693c`:
oak is the highest priority, berries second; pine's tall dark tiered silhouette
is retained with lower-priority texture treatment. Oak's silhouette is good,
but its uniform yellow-olive crumpled small canopy detail differs from the
Bellweather reference's warm/cool large planes, selective leaf marks and branch
openings. More frequency/resolution does not fix that style mismatch. Existing
tree materials are MeshBasicMaterial, sRGB and toneMapped=false: the inspected
shading is baked upstream. GLB metallic/roughness remains uninspected here.
The earlier sculptural3D/modest-detail source brief predates the stronger
painterly target. Runtime scale/mips can reduce readable detail, but do not
establish acceptable source stylization or repair it.

The selected next diagnostic is oak headings01/03, unchanged versus base-color
only and restrained nonmetal lighting/material captures, using the exact same
texture, orthographic camera, root and scale. It requires the actual approved
private oak GLB, currently absent. Inspect normal0.91/strategic0.48 zoom on
meadow/drygrass and full→worked before expanding eight views or default binding.
If base color already has the clay-like treatment, propose one painted master
texture target for review; do not independently paint over directional frames.
No repaint, retexture/generation, model purchase or new publication is implied.
The prepared pine selector below remains lower-priority, unbound source work.

## Missing private sources and retained provenance

| Required private input | Exact source identity in existing canonical records |
| --- | --- |
| Pine optimized GLB, absent | [Pine v3 manifest](../assets/environment/frontier-meshy-fixed-camera-v3/pine/manifest.json), `sourceModel` and `sourceModelSha256` fields |
| Oak optimized GLB, absent | [Oak v3 manifest](../assets/environment/frontier-meshy-fixed-camera-v3/oak/manifest.json), `sourceModel` and `sourceModelSha256` fields |

The original private archive recorded in the existing
[v1 source README](../assets/environment/frontier-meshy-sprites-v1/README.md)
is also absent. This guide/sidecar references existing canonical identity fields
without repeating private source locations or model digests. Pine generation
task `01a0e074-dcd7-74dd-a8b1-3a7b20ed3268` and
remesh task `01a0e079-d166-76cc-b3a7-42ab091febf7` remain in the manifests.
Historical batch metadata records 35 credits per family /105 total. That is
historical provenance, not spend in this task. Provider receipt bytes, account
plan/terms evidence, visibility and training permissions are unavailable here.
The original concept PNG paths in the batch manifest are absent too; existing
public derivatives do not recover editable source geometry.

Reuse of these existing public runtime derivatives is authorized by the task.
No new license acceptance or broader source-publication authority is inferred.
Private GLBs/archives must remain private if made available to a later cloud
capture. Do not recover them by purchasing/regenerating, or distort 2D imagery
to manufacture yaw views. Other species need their exact approved model and
provenance before additional physical viewpoints can be captured.

## Pine calibration and deterministic policy

The existing v3 manifest owns camera/root/fit: orthographic azimuth45°,
elevation45.43590248481586°, 640×640 canvas, root `[320,480]`,128px/world unit,
5×5 world frame, positive world-Y model turns at0,45,…315°. Lighting remains
hemisphere1.6, warm key2.5, cool fill1, rim0.7, ACES exposure1. The centered
grounded model is fitted once over every transformed mesh vertex at all eight
turns. Pine baseScale3.2675419644341033 × fitScale0.8193414402973493 gives
effectiveScale2.6772325393714684, normalized dimensions
`[1.8435182406690358,5.085489093343843,1.8250721113834236]`.
Keep this fit, lighting and registration across states. Camera orbit indices
from v1 cannot be substituted for v3 yaw labels. No symmetry reuse is asserted.

[`pineViewVariation`](../src/forest-age-composition.mjs) is a prepared pure
selector, version1. It takes only unsigned32-bit `terrainSeed` and the original
authoritative row-major forest cell. Independent integer-hash salts select one
existing physical view and uniform scale in `[0.7,1.0]`; flip=false and card
yaw=0. Time, stock, session, unit position and iteration order never enter the
key. Retain this version/hash for the same map identity. Editing map width/seed
changes map identity; this is not a promise to preserve a cell through resize.
The selector is currently unbound. Existing default views/scales remain active.

When bound, retain the exact chosen view/scale on the existing forest slot at
load, stock update, clearing/reset, reload and checkpoint/reconnect. Rebuild
from the saved map seed/cell, never reroll. Do not multiply pilot scale by age
or habitat modifiers; the final scale must stay in the declared interval.
Roots/positions, family selection and forest density remain authored.

**Collision and resource policy:** scaling changes only the sprite card around
its registered root. Each authored forest cell remains the same blocked cell
until authority clears it. Smaller visible crowns confer no new clearance or
walkable gap. A cell still holds six wood; scale never changes yield, stock,
harvest range, resource identity or fog disclosure. The terrain owner retains
visual→existing `forestCell`/`nodeId` registration and click bounds.

Existing pine stock presentation holds the same intact view/scale through
positive stock and hides that standing card at zero. `main.js` then shows the
existing generic `oak-depleted` stump at the exact slot root, scale×0.48.
This fallback is deterministic but not a matching pine stump. Eight views each
of worked/low/depleted are **24 missing source cells**. No label/count inflation
or complete lifecycle claim is allowed. Existing regional four-state atlases
retain their mip cap6,64px gutters and half-texel inset. Pine keeps the existing
eight individual textures and their mip sampling; the historical unguttered
pine atlas is not newly bound or duplicated.

## Contract, checks and delivery boundary

The optional [pine sidecar](art-direction/tree-variety-v1/pine-production-contract.json)
follows PR318's identity/provenance/publication/calibration/integration/render
separation and joins the retained manifest by `assetId`/`manifest`. Its hashes
are immutable approved bytes, independent of editable descriptions. This is
an offline audit, not a second runtime/catalog registry. The older resource
manifest has `name`, not canonical unit `assets[]`; the unit-only validator
must not be called on it. Catalog owner `01a0fcf5` may consume this declared
pilot report and existing manifest, retaining the explicit unbound/blocked state.

```sh
node scripts/tree-art-production-contract.mjs
node scripts/tree-art-production-contract.mjs --require-complete
node scripts/forest-age-scenario.mjs
python3 scripts/validate-fixed-camera-resources.py
```

The ordinary audit passes honest partial coverage; `--require-complete`
intentionally exits1. Four focused tests cover pinned save-identity vectors,
full32-bit values, fresh-module/order/seed stability, all eight physical view
choices, uniform scale bounds, and rejected source replacement/coverage
inflation/calibration changes/publication expansion/unsupported completion.
Fresh-module tests establish stateless selection; actual game recovery remains
unverified. The tests share the existing registered forest-age scenario.

The local sandboxed browser preflight at clean32b71795 failed with
`sandbox-unavailable` and `storage-unavailable`; zero game frames/screenshots.
Independent `codex review --uncommitted` failed initialization with
`Read-only file system` before inspecting changes. These are execution blockers,
not successful independent review or a new user approval requirement.

The qualified hosted route is [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323),
with ordinary adapters prepared by CI in [PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331).
That historical OpenField qualification is not this pine's acceptance.
Proposed owned adapter: `scripts/renderer-tree-variation-scenario.mjs`,
`id: tree-variation`, ordinary Woodland Expanse/default assets, normal and
strategic view, actual Gather through depletion, reset/reload/reconnect and
stable same-cell appearance. Source SHA, clean release digest, served identity,
seed/cells, stock transitions, viewport/camera, PNG/hash receipts and actual
visual inspection must be retained. No adapter or workflow dispatch occurred.

Runtime release already includes the eight existing pine WebPs. No sprite,
private model/archive, atlas, registry, server, main.js or shared environment-art
hunk changes in this prepared milestone. New selector has no ordinary caller;
release/deployed/pixel acceptance for it remains **incomplete**.

## Ranked next actions and owner seams

1. Existing source/tree-art owners: recover the exact approved oak GLB privately
   and perform the two-heading matched-material/style diagnostic above. Preserve
   current textures/identity/defaults. Missing GLB blocks the selected diagnostic;
   no substitute generation is authorized. Resolve the candidate before rollout.
2. Terrain/render owner `01a103a2`: agree the pine-only existing directional
   batch split and retained slot metadata before binding. Exact proposal:
   [PR327 comment](https://github.com/lbeezr/thousand-unit-skirmish/pull/327#issuecomment-5982212219).
   Preserve that owner's visual/harvestable registration and fixed-radius
   picking fix. The image-loader extraction owns different hunks.
3. Tree-variety owner: bind the reviewed selector only if retained after style
   candidate selection and that seam resolves,
   validate actual production matrices/UVs and stock/reset/rebuild identity,
   then retain source/current-main exact-head independent review and clean pack.
4. CI/capture owner: agree owned adapter id/file and registry/command, then run
   one qualified hosted capture at the reviewed containing head. Exact request:
   [PR331 comment](https://github.com/lbeezr/thousand-unit-skirmish/pull/331#issuecomment-5982228742).
   Tree owner retains inspecting the actual ordinary frames and separate
   identified staging acceptance.
5. Existing private-source owner, currently unassigned: provide the exact
   approved pine GLB privately plus its retained provenance. Author matching
   lifecycle geometry/captures with one unchanged calibration; preserve private
   previews until derivative publication authority is established.
6. Audit another exact approved species/model when available. One pine source
   pilot does not close the roster or identify cedar.

Forest owner `01a1072a` retains jobs/frontier/reacquisition and stock authority;
map/XL owner `01a103e8` retains cell/index/authoring policy; universal movement
owner `01a107ba` retains navigation/execution. This pilot requires no edits in
those systems. Their current shared state is read through PR330/332/328;
routine status requests and conflicting server edits are avoided.
