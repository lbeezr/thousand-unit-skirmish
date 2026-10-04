# Sheep directional readiness — 3 October 2026

Art/Mac QA baseline: main `d34c1a18c7e0ba865e19907a2fbaf868b17fa0e4`, after PR #39.
Implementation integrates main `ae88e0f`; the Sheep pack is unchanged.
This increment changes offline acceptance tooling and tests only. The live neutral
renderer, gameplay state, default maps and active Mac capture remain unchanged.

The subsequent [default runtime slice](qa-sheep-static-directions-runtime-2026-10-03.md)
implements authored static pose validation and immutable direction geometry from
the proposal below. The eight-view art still requires readable original bytes
and separate permission for public publication.

## Available art and acceptance

The [read-only audit](../scripts/sheep-directional-readiness.mjs) verifies the
existing atlas contract, exact binding manifest/digest, preserved originals,
direction coverage, static clip declarations and full-canvas registration. Its
[current result](qa-evidence/sheep-directional-readiness-2026-10-03/readiness.json)
confirms one public illustrated frame (`north`), one non-looping idle clip and no
animations. The seven other directions cannot resolve from that pack. Its pivot
`[273.5566,428.2998]` and 512 projected pixels/world unit remain estimates.
The immutable public v1 source/runtime atlas hashes are pinned to their approved
outputs, and their decoded alpha bounds must match the manifest. Replacing those
pixels and updating package hashes cannot pass this fallback audit.

The [public producer capture contract](../assets/wildlife/bellweather-sheep-public-reference-v1/cloud-capture-contract.json)
describes eight 512px RGBA views, nose yaw 0–315° in 45° increments, common root
`[256,256]`, and 256 projected pixels/world unit. It records approximately 42.035°
between head and body. These are attributed producer measurements; this consumer
still has none of the eight readable original files. It does not substitute the
illustration for those captures or infer animation from the view count.

| Nose yaw | Direction key | Projected screen heading |
| --- | --- | --- |
| 0° | north | down-left |
| 45° | north-east | down |
| 90° | east | down-right |
| 135° | south-east | right |
| 180° | south | up-right |
| 225° | south-west | up |
| 270° | west | up-left |
| 315° | north-west | left |

The tests project these world axes through the actual fixed camera and resolve
the existing yaw helper. Adding the recorded head/body offset again selects a
different nose view. Direction labels therefore describe face orientation, not
a locomotion axis.

The eight-view gate requires independent frame IDs, one idle frame per direction,
full 512px cells in a 2048 × 1024 atlas, equal pivots and one world scale. It
verifies each original digest/dimensions/alpha bounds and compares source-atlas
pixels and runtime alpha/opaque RGB against those originals. Changed crops,
anchors, source identity, mirrored pixels, animation claims, baked-shadow metadata
and altered consumed contracts fail. The audit follows the asset's actual page
file references, so an alternate runtime filename cannot hide changed pixels.
Physical root placement never follows alpha bounds. A valid byte report still
grants neither publication permission nor
ground-contact/appearance approval.

Run:

```sh
node scripts/sheep-directional-readiness.mjs
node --test scripts/sheep-directional-readiness.test.mjs
# After approved original bytes have been successfully transferred and packed:
node scripts/sheep-directional-readiness.mjs /absolute/path/to/private-pack /absolute/path/to/consumed-contract.json
```

All Node acceptance tests use temporary asymmetric colored rectangles, not
animal drawings or substitute Sheep frames. They run without image-tool/provider
dependencies. An additional existing-packer round trip runs when Python/Pillow is
available and explicitly skips otherwise. It passed on this host with Pillow
12.3.0, including missing-view rejection before output writes. Fixtures are removed
after testing; no synthetic PNG is committed as game art.

## Transfer and visual evidence boundary

A single fresh supported Library retry for the lightweight frame archive returned
`download failed` (helper exit 1), with no readable archive or partial file. The
current failure exposes no more specific cause; the earlier proxy `403 Forbidden`
remains historical evidence. No raw URL transfer, alternative public host, private
frame publication, rigging or paid generation was attempted.

The Mac QA owner reports ROOM LIVE captures at this baseline and 1280 × 800:
Sheep appear small at normal zoom, with wool and legs visible beside a villager
at close zoom. Overlapping occlusion is still untested. This consumer's Library
image reads returned extracted text only, explicitly reporting unavailable image
pixels; the separate QA provenance download also returned `download failed` and
created no readable file. Those observations remain attributed to Mac QA, not
direct consumer pixel inspection or measured size/contact acceptance. No capture
was duplicated and no size/pivot was changed from those reported observations.

## Next minimal directional integration proposal

1. Obtain the exact eight approved original PNGs through a successful authorized
   transfer and explicit permission before any public repository publication.
   Preserve originals and the consumed contract; run the packer and this byte gate
   in a private output directory. Inspect each view before proposing runtime art.
2. Add an optional authored, presentation-only `wildlifeNoseYawDegrees` for Sheep,
   finite in `[0,360)`, default 0. Validate it with the map definition and retain it
   through map import/export and checkpointed map data. Use existing yaw-to-key
   math once. The stationary animal gains no movement, simulation heading, unit ID
   or new resource pool. This field is a proposal, not an accepted schema change.
3. After admission, bind only matching idle views. A missing direction uses the
   explicit geometric proxy, rather than a north image relabelled as another view.
   Preserve the PR #39 alive/carcass/depleted/fog/reset behavior and food-cache
   fallback. Add only exact admitted runtime paths to serving and packaging.
4. Cache an immutable quad/UV geometry per supported direction while sharing the
   verified texture/material. The current single template shares mutable geometry
   among cloned Sheep: updating its UVs for several headings would make every
   Sheep use the last updated rectangle. Simply replacing the registry URL with
   an eight-frame atlas is therefore insufficient. Test two simultaneous Sheep
   with different direction keys, reset/disposal, and late loading before rollout.
5. Coordinate an eight-view ground-contact and Sheep/Worker comparison with the
   existing Mac QA owner at recorded ordinary/strategic/detail zoom. Include an
   overlapping foreground object and the carcass/depleted transitions. Keep the
   producer's common scale/root during that trial; change them only from inspected
   measurements and record the decision. No walking or grazing claim follows.

Ready now: reusable source/anchor/direction gate, public fallback audit and
synthetic regression controls. Needed for the next art binding: readable approved
frame bytes, public-publication permission, per-direction geometry, authored pose
validation, and owner-run view/contact/occlusion evidence. General unit orders and
navigation remain with their existing owner.
