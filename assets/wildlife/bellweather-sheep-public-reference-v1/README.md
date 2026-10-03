# Bellweather Sheep static reference preview

This is a **one-view illustrated appearance trial**, derived from the already-public
single-Sheep model input. It is actually drawn by the isolated Three.js preview,
beside the existing Human Worker. It is not the eight model-rendered rotations,
a walking Sheep, a food node, or a released animal gameplay entity.

Run from the repository root:

```sh
npm ci --ignore-scripts --cache /tmp/sheep-npm-cache
python3 -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/scripts/bellweather-sheep-preview.html`.
The detail view is 6.0 zoom; the ordinary 0.91 and strategic 0.48 settings use
the game's 43-unit orthographic frustum, camera direction `[0.78,1.12,0.78]`,
1280 × 720 and DPR 1. Ground crosses indicate roots. This local-only review
page and module do not edit the shared match client, HUD, environment bindings
or server gather/depletion rules.

## Preserved source and transformation

The [public input](https://github.com/lbeezr/thousand-unit-skirmish/blob/02e3ac9434ac0970dbe307f44791a40ffd61ba82/docs/art-direction/bellweather-sheep-model-input-v1/README.md)
was fetched from that exact public Git commit. The original RGB PNG is preserved
unchanged at [source/sheep-model-input.png](source/sheep-model-input.png):
1254 × 1254, 1,457,172 bytes, SHA-256
`0ff688101304a7c10e181b3363ce767e8fb0082d0f754817edee81e04a9bf904`.
The original public source page retains its exact ImageGen prompt and review.

[The packer](../../../scripts/prepare-sheep-static-pack.py) removes only
border-connected neutral matte/shadow pixels (channel minimum at least 120 and
spread at most 30, or minimum at least 234), downsamples once to 512 × 512
with LANCZOS, and bleeds RGB under transparent pixels per frame. The source atlas
keeps the pre-bleed cutout; the runtime atlas retains exactly the same alpha.
There is no mirroring, model generation, rigging, animation, paid call, GLB or
contact-shadow layer. Inspection showed the complete fleece, face, ears, four
legs and hooves, with the neutral floor shadow removed. Fine silhouette fringes
remain a provisional matte rather than accepted production edges.

The hoof-center estimate `[670,1049]` in the original illustration scales to
`[273.5566,428.2998]` in the 512 px frame. Its status remains
`unreviewed-estimate`; image bounds never determine placement. The display scale
is 512 projected pixels per world unit, a nominal width trial. No physical
shoulder height, source camera, yaw calibration or measured anatomical equality
is claimed. The one clip uses the approximate `north` key and one non-looping
static frame. Unsupported headings/states are hidden, never silently reused.

The renderer verifies the manifest and runtime PNG SHA-256 before decoding,
uses sRGB, straight alpha, half-texel UV inset, linear filtering without mipmaps,
and the existing sprite terrain-depth bias. Visibility must be explicitly
supplied; this is not fog authority. Neutral fleece has no team mask. Original
source hashes and paths are in [source-records.json](source-records.json);
[manifest](sprite-atlas-pack-v1.json) and [binding](static-preview-binding.json)
declare the supported state and empty animation list.

## Eight captured views remain blocked

On 3 October 2026 the current Library resolved-reference flow prepared the
15,762,931-byte lightweight bundle, but its supported transfer helper failed
before any readable local archive was created. Diagnosis reported
`Tunnel connection failed: 403 Forbidden`. The consumer did not inspect,
materialize, publish, or claim the eight private frame bytes.

The [public producer capture contract](cloud-capture-contract.json) is copied
unchanged from commit `02e3ac9434ac0970dbe307f44791a40ffd61ba82`. It describes,
rather than supplies, eight transparent 512 px color captures, fixed camera,
root `[256,256]`, 256 projected pixels/world unit and a 42.035° nose/body offset.
Its model redistribution and runtime admission remain unverified. The original
44 MiB / 1.42-million-triangle GLB never enters this runtime package.

Once **authorized, readable** local frames exist, the same packer can prepare a
new preview-only package:

```sh
python3 scripts/prepare-sheep-static-pack.py \
  --cloud-views /absolute/path/to/approved-color-frames \
  --contract assets/wildlife/bellweather-sheep-public-reference-v1/cloud-capture-contract.json \
  --output /absolute/path/to/new-preview-package
node scripts/validate-sprite-atlas.mjs /absolute/path/to/new-preview-package/sprite-atlas-pack-v1.json
```

It checks all eight hashes, RGBA dimensions, transparency, unclipped silhouettes,
nose-yaw order and ground registration **before any output writes**. It keeps
each original PNG, packs full frames 4 × 2 without rescaling, and emits only
one-frame idle clips; no movement or harvest art is fabricated. This code path
has synthetic integrity tests, not validation of the inaccessible real frames.
Model/source admission must be resolved before publishing those frames.

[Wildlife design](../../../docs/wildlife-bellweather-sheep.md) ·
[Sprite contract](../../../docs/sprite-atlas-contract-v1.md)
