# Authored GLB finish proposal

[Documentation index](README.md) · [Unit/building kit](unit-building-art.md)

**Status: source proposal.** It applies to the rigid GLB samples. The preferred
new-building model-to-capture workflow is documented [separately](building-asset-production-pipeline.md).
Neither proposal silently changes a runtime manifest contract.

## Proposed treatment

Use rigid Blender-authored parts with broad vertex-color light/shadow shapes and
one shared low-frequency material atlas. Cloth, leather, timber, stone, slate,
and metal need readable material differences at game scale. Keep unlit/matte
shading, neutral role equipment, unit sashes, and owner-selected standards.

The v0.2 sample has two GLBs embedding separate copies of a 768 × 512 atlas.
Its authoring manifest differs from renderer v1, whose GLBs are textureless.
A shared-texture loader and an explicit compatible extension are needed before
runtime adoption. Do not infer authored-GLB performance from procedural benchmarks.

## Compare media with the same workload

| Live rigid geometry | Captured/animated sprites |
| --- | --- |
| Continuous facing and renderer-driven part poses. | Requires explicit directional views and action frames. |
| Shared instanced part batches. | Needs bounded atlas/frame selection rather than a batch for every state/direction. |
| Atlas sampling adds memory without necessarily adding batches. | More views, states, teams, and resolution multiply decoded texture cost. |
| Real geometry supplies scene depth. | Alpha/depth/layer handling must establish occlusion. |

A simple three-role × eight-direction × four-frame × two-team set at 64 × 64 RGBA8
uses 3 MiB of base pixels, about 4 MiB with mips, before padding or extra states.
Doubling both frame dimensions quadruples it. Download compression does not
establish GPU residency.

## Next useful proof

Compare one Worker material pass on the same model/camera at zoom 0.91 and 0.48.
Record role recognition, texture sharing, actual batches, and loaded files. Keep
unit and building outcomes independent. Source samples can ship with their
known limits; runtime capture and performance are later scoped claims.

The [original format review](archive/2026-09/unit-building-art-output-proposal.md)
preserves source findings, reference links, earlier budget examples, and the
recorded release of the v0.2 source sample.
