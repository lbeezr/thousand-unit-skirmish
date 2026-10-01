# Pod-vine full/worked registration review · 1 October 2026

[Full](full.png) and [worked](worked.png) renders compare front/right/rear/left
at identical four ground pivots. Both use the same orthographic camera direction
from `src/camera-controls.mjs`, 45° azimuth and 45.435902° elevation, zero screen
roll, unlit sRGB double-sided cards, alpha test 0.08 and depth write.

The [review atlas](../../../assets/environment/vesperra-podvine-worked-v1/review-manifest.json)
uses one 884×448 source canvas per frame, resized together to 512×259. No view
is individually enlarged. Eight-pixel taller source padding accommodates the
worked left silhouette, which exceeds the original full pack's 440-pixel crop.
Review card width is 1.10431 and height is 1.10431×259/512 (about 0.55863),
preserving the exported aspect. This deliberately differs from the existing
runtime 1.10431×0.55 card and is not an approved registry replacement yet.

Silhouette centers/lower bounds provide provisional contact proxies. Front and
rear woody root forms remain near the same cyan pivot in both captures; the side
views retain comparable leaf contact. No obvious root jump appears at this
capture scale. This is visual evidence, not anatomical root certification or
proof of exact branch continuity. Disturbance is visible as exposed stems and
reduced foliage; pods stay attached.

Run `python3 scripts/build-podvine-worked-review.py` for read-only source/hash,
frame, common-scale and exact decoded-alpha checks. `--write` exports the atlas.
Run `node scripts/preview-podvine-worked.mjs` and open localhost port 4187;
`?state=worked` selects worked and the default selects full. Isolated Chrome
captured both URL-selected appearances at 1400×850 with a 5-second virtual-time
budget. Button interactions were not independently exercised. Browser and
preview processes were stopped. This is standalone appearance evidence; live
stock transitions, clearing/reset and foundation restoration remain next.
