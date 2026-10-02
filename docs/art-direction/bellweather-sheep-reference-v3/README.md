# Bellweather Sheep angle reference v3

**2 October 2026:** approximate-angle concept reference retaining the approved
Sheep appearance. Local source branch; not yet integrated into fork main.

![Sheep approximate-angle reference v3](bellweather-sheep-reference-v3.png)

One built-in ImageGen edit of [v2](../bellweather-sheep-reference-v2/README.md)
adds approximate degree labels, the checked yaw convention and an explicitly
uncalibrated camera target. Pixel review finds the same cream fleece, pale faces,
lateral ears, bare lower legs, dark hooves and planted poses. Neither exact pixel
identity nor consistent three-dimensional geometry across views is claimed.

Yaw 0 faces +Z; positive rotation about +Y turns toward +X. At the verified
orthographic camera (45° azimuth, 45.4359024848° elevation), yaw 0 projects
down-left and yaw 90 projects down-right. See the
[asset acceptance standard](../../asset-angle-reference-standard.md) for all eight
angles and their runtime clip keys. Runtime `north` means world yaw 0; it does
not mean screen-up.

| Panel | Approximate intended yaw | Reference use |
| --- | --- | --- |
| Top front | 45° | Anatomy, lower apparent viewing elevation |
| Top side, head left | 315° | Anatomy, lower apparent viewing elevation |
| Top side, head right | 135° | Anatomy, lower apparent viewing elevation |
| Top back | 225° | Anatomy, lower apparent viewing elevation |
| Bottom front three-quarter | 0° | Oblique concept study |
| Bottom side/rear, head left | 270° | Oblique concept study |
| Bottom back three-quarter | 180° | Oblique concept study |
| Bottom front/side, head right | 90° | Oblique concept study |

These are **approximate azimuth intentions**, not measured camera or sprite
registration. The top and bottom rows have different apparent viewing elevations;
together they are not a calibrated eight-direction runtime set. The footer's
0.60 shoulder height and 0.90 body length remain proposed world dimensions.

The [manifest](manifest.json) maps every panel to an intended yaw and runtime
clip key, with proposed source crop rectangles for a future extraction review.
No crops or transparent sprites have been produced. A later pipeline must use
the oblique source for the matching angle, regenerate/render missing oblique
45/135/225/315 views, verify camera/scale/root, then separate labels and shadows
without changing the design. Anatomy views can guide shape but cannot silently
substitute for missing runtime-camera views. A measured model or proxy rendered
at one fixed camera gives stronger geometric consistency than drawn concepts.

The unchanged generated PNG is 1536 × 1024, 2,029,561 bytes, SHA-256
`ea31df740058b263da30039535d9a7a3a2a5252f06a6d8e5ac2884f2631e557f`.
Original `exec-afca621c-48f3-4c15-9135-cd373c63d80d.png` remains in the generator
output directory. The v1/v2 PNGs, prompts and rejection history are preserved.
No Meshy, paid external provider, animation or runtime change was used.

The [model-reference pilot contract](../../bellweather-sheep-model-reference-pilot.md)
recommends a cleaned single front-three-quarter input and specifies local measured
rotation captures after a separately authorized textured-model pilot. It starts
no provider job and leaves walking/rigging for a later decision.

[Exact edit prompt](PROMPT.json) · [Manifest](manifest.json) · [Pixel review](review.json)
· [Species proposal](../../wildlife-bellweather-sheep.md) · [Wiki evolution](../../lore/art-evolution.md)
