# Ellionar Sunbloom low foliage · v4 source

This selected four-heading edit opens the worked Sunbloom foliage further,
exposing copper branches while retaining lapis blooms and compact basal crowns.
It follows Ellionar's honey/lapis/copper cultivated-garden palette.

[Source](source.png) and [exact edit prompt](PROMPTS.json) are preserved unchanged.
The reference is the [worked v3 source](../ellionar-sunbloom-worked-v3/source.png).
Front/right/rear/left remain approximate painted views, not measured rotations.
Camera request: elevated orthographic 45.436 degrees, zero screen roll.

The runtime consumes twelve full/worked/low frames from
[the atlas](sunbloom-low-atlas.webp) via `src/sunbloom-low-pack.mjs`.
`python3 scripts/build-sunbloom-low.py --write` exports;
the same command without `--write` validates source hashes, extraction,
decoded alpha, configuration and shared registration.

Frames use a common 700 × 671 canvas resized to 512 × 491, 64-pixel gutters,
world dimensions 0.88654 × 0.85 and bottom pivot (0.5, 1). Horizontal registration
comes from the intact reference; each heading shares the maximum lower bound
of all three source states. There is no separate silhouette fitting or scale.
This is source-coordinate pairing, not certified anatomical alignment.

Stock 6 uses full, 5–3 worked, 2–1 low, 0 hides, and reset restores full.
Independent garden beds remain full. No flower yield, collision or resource
rules are introduced. Depleted remains hidden.
