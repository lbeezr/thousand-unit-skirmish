# Default Sheep static directions — 3 October 2026

Source base: fork main `ff1c168`, after the PR #52 offline readiness gate.
This slice is wired into the normal neutral-resource renderer. Valid Sheep need
no feature flag or standalone preview route. The current public atlas and its
serving/packaging paths are unchanged.

## Runtime behavior

Authored Sheep food nodes may supply `wildlifeNoseYawDegrees`, finite in
`[0,360)`; omission means 0. The shared map-definition validator rejects invalid
values and use on ordinary food/wood nodes. The pose remains authored map data
through publication and checkpoint recovery. Live stock/lifecycle snapshots
gain no heading field; gather activation, cargo, fog and depletion are unchanged.

The renderer resolves the nose yaw once through the existing eight-direction
helper. It applies no additional head/body offset. Only a matching one-frame idle
clip may render. The existing public pack supplies `north`; other views use the
geometric Sheep proxy rotated to the authored nose pose. Carcasses keep their
food-cache marker, and depleted/hidden/omitted nodes remain suppressed.

The static loader caches one immutable quad/UV geometry per admitted frame and
shares its verified texture/material. Each live instance keeps its selected
geometry while another Sheep uses a different frame. Map reset removes instances
while retaining that bounded cache; renderer disposal frees shared geometries,
texture and material once. The loader keeps full-canvas root/scale placement and
the existing half-texel UV inset.

## Verification

```sh
node --test scripts/sheep-static-preview.test.mjs scripts/neutral-wildlife-renderer.test.mjs scripts/wildlife-state.test.mjs scripts/sheep-directional-readiness.test.mjs
node scripts/wildlife-render-scenario.mjs
node scripts/railway-release-scenario.mjs
```

The 22 focused checks pass. The normal renderer test loads a digest-verified,
in-memory atlas of two asymmetric colored rectangles through its default loader.
Two supported directions keep distinct UV geometry across repeated updates and
reversed-order map resets, sharing a texture/material. An absent third direction
keeps its proxy through the next snapshot. Disposal events confirm each shared
resource is freed once. These rectangles are test geometry, never Sheep art or
an admitted directional pack.

The real worker HTTP/WebSocket scenario loads the existing verified public PNG
and attaches Three meshes to its scene. It publishes zero- and 90-degree Sheep
poses; the former share the north geometry and the latter uses its rotated
proxy. Publication rejects -1, 360 and null poses without replacing the running
map. Checkpoint/restart preserves the authored 90-degree pose and depleted stock;
rematch restores the original living stock. It also checks current fog omission,
ordinary berries, six required HTTP paths and five rejected source/nonruntime
paths. PNG decoding is CPU-only; this is game/state/mesh evidence, not a new
WebGL screenshot.

## Remaining art inputs

The supported lightweight Library materialization still returned `download
failed`, exit 1, with no readable original frame bytes. The eight private 512px
views have not been inspected or published. Their common root/scale and
approximately 42-degree head/body offset remain attributed producer metadata.
No walking, grazing or other animal animation exists in the pack.

Once readable views and public-publication permission are available, the same
workstream must inspect/pack/audit them, select the admitted pack in the normal
registry, add its exact production paths, run game lifecycle/direction checks and
finish default game integration. Ground-contact and occlusion review belongs in
that game path with the existing Mac QA owner. The current zero-pose illustration
keeps its estimated pivot/scale; no duplicate Mac capture or private-art transfer
bypass is part of this increment.
