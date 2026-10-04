# Human motion preview

Opt in with `?humanVaeloraPreview=1&humanAnimationPreview=1`. Eight idle facings plus eight south-east, eight south-west and eight north-east walk keys and eight construction, wood-gathering and food-gathering repair, attack and defeat keys. Other directions/actions hold idle, team sash mask pending. Not complete animation coverage. Source worker-walk-SE-v3.png; transparent RGB sanitized for runtime packaging.

The default Human roster also consumes this pack. Walk/gather selection now keeps
the requested world heading, including idle holds where action art is missing.
Screen-left is `north-west` with the fixed game camera: it has a left-facing idle
pose, but no authored walk or berry-picking animation. No mirror or invented
animation fills that gap. See the [pixel and facing evidence](../../../docs/qa-evidence/villager-facing-2026-10-03/README.md).

Version 0.15.0 additionally registers the retained eight-key **East walk** into
the default pack, using spare atlas space. East is screen-down-right under the
fixed camera, distinct from the existing SE screen-right walk. Shared source
scale and a fixed ground pivot preserve the current Worker identity; all 84
earlier frame pixels/metadata and every other clip remain unchanged. Rebuild
with `python3 scripts/admit-worker-east-walk.py`; validate with
`node scripts/validate-sprite-atlas.mjs assets/units/cast-human-sprite-v3/sprite-atlas-pack-v1.json`.
The [land-action checkpoint](../../../docs/qa-worker-land-art-2026-10-04.md)
records source hashes, playback checks and the remaining 54 land-action/heading
gaps. Delivered/native acceptance remains open; this is incomplete coverage.
