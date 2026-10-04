# Registered public Infantry coverage

48 complete painted poses reused from the retained public [v1 sheet](../infantry-sprite-v1/README.md): eight idle views, sixteen walk keys, sixteen spear wind-up/strike keys and eight terminal poses. **Zero newly authored, generated, mirrored or interpolated poses.** The body-only Meshy v2 bake was inspected and rejected for this military role because it has no weapon/shield.

The original v1 grid cut feet and neighbouring weapons. [Registration](registration.json) records connected-actor recovery, source hash, every source box, source column and translation. No fixed-grid cut is used. Each actor retains its source pixels at scale 1; isolated alpha below 8 outside its two-pixel fringe is omitted as source noise. The existing blue-sash mask follows the recovered actor. Original v1/v2/v3 packs and all source iterations remain intact.

World heading order is N/NE/E/SE/S/SW/W/NW, from physical source columns **5/4/3/2/1/0/7/6**. The fixed +X/+Z camera projects those bearings down-left/down/down-right/right/up-right/up/up-left/left. These are eight separate paintings; their angles remain approximate, with no camera-certified 3D reconstruction. This costume has a gold tunic and round shield, unlike v3's pale tunic and angular shield; the full role uses one coherent sheet rather than switching costume between actions.

All frames use one (160,308) pivot on a 320-pixel canvas, one shared scale and the current 1.2161865 world-unit body baseline. Source idle footprints fix horizontal registration per heading; complete pose bottoms fix the ground line. This two-pose source has no reliable authored vertical-root track to preserve. Cropped actor rectangles retain offsets and four pixels of padding. No simulation, occupancy, stance or attack-damage timing changes.

Walk loops two keys over 800 ms. Attack plays wind-up/strike once over the existing 850 ms event lifetime. Defeat holds the existing directional idle for 120 ms, then clamps to its terminal image for the remaining 730 ms. This is an abrupt **two-key terminal transition**, not an eight-frame collapse. Functional playback and decoded unclipped bounds pass CPU/Three scene tests; smoothness and anatomy are later work.

Rebuild with `python3 scripts/register-legacy-foot-sprites.py infantry`; validate with `node scripts/validate-sprite-atlas.mjs assets/units/infantry-sprite-v4/sprite-atlas-pack-v1.json`. [Review](review.png) shows all actual keys. Normal Human Infantry now selects v4; only the manifest, runtime atlas and mask are served/packaged. Source and review files remain outside HTTP admission.

Independent review, containing staging deployment and ordinary-game visual acceptance remain **incomplete**; the owner retains them in the [foot-unit workstream](../../../docs/human-foot-unit-coverage.md). CPU UV assertions do not establish actual GPU pixels. The local browser cannot start its Linux sandbox.
