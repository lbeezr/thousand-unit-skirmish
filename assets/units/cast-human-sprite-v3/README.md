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

Version 0.16.0 adds eight approved-seed **North walk** keys (screen-down-left).
The source preserves the default North idle's character, axe and backpack.
Register with `python3 scripts/admit-worker-north-walk.py`; source, prompt,
seed, extraction and first-pass review are retained under
[`worker-walk-north-v1`](../../../docs/art-direction/human-roster-v1/generated/worker-walk-north-v1/README.md).
One shared scale/root and spare atlas row y=2816 preserve all 92 prior frames,
other clips, mask and world scale. Five walk headings now play; S/W/NW hold
idle. Rough gait/loop polish and identified deployment/native review remain
open. See the [land checkpoint](../../../docs/qa-worker-land-art-2026-10-04.md).

Version 0.17.0 adds eight approved-seed **South walk** keys (screen-up-right,
back view). The [retained source iteration](../../../docs/art-direction/human-roster-v1/generated/worker-walk-south-v1/README.md)
uses the public default South idle as reference. Register with
`python3 scripts/admit-worker-south-walk.py`; eight 100 ms keys use spare row
y=3072 and a shared fixed root/scale. All 100 previous frames, every other clip,
mask, dimensions and world scale are preserved. Six walk headings now play;
W/NW hold idle. Native/deployment acceptance and gait/registration polish stay
open, with 52 remaining land-action/heading cells in the linked checkpoint.

Versions 0.18/0.19 add eight approved-seed keys each for **West and North-West**,
completing all eight default walk headings (and moving Carry/Return). Actual West
back/up-left and NW profile/left views match their public idle seeds; no copied
facing or mirror. [West sources](../../../docs/art-direction/human-roster-v1/generated/worker-walk-west-v1/README.md)
and [NW sources](../../../docs/art-direction/human-roster-v1/generated/worker-walk-north-west-v1/README.md)
retain every raw/seed/prompt/extracted iteration. Rebuild with
`python3 scripts/admit-worker-west-walk.py` then
`python3 scripts/admit-worker-north-west-walk.py`.
Sixteen keys occupy spare rows3328/3584; all108 prior records/pixels, mask,
other clips, dimensions and world scale are unchanged. This completes walk
source/default-playback coverage; identified delivery/native appearance and
50 work/combat/Stone cells remain open.

Version0.20.0 additionally packs four dedicated `gather-stone|south-east` keys.
[Retained iteration/rejected directions](../../../docs/art-direction/human-roster-v1/generated/worker-stone-eight-v1/README.md)
records the seven absent headings and the default selector dependency. Rebuild
with `python3 scripts/admit-worker-stone-se.py`. Four210ms keys preserve all124
prior records/pixels and fit existing spare row3840. The default Stone selector
still returns idle: animation owner01a103d4 must adopt this state with exact
missing-heading idle fallback. This is packed art, not a claim of Stone gameplay
playback. All eight walks remain default functional; native/deployment acceptance
is open and49 other land-action/heading cells remain.


Version0.21.0 adds three actual **NW wood** compact axe windup/strike/recovery
keys,240ms each. [Both source iterations](../../../docs/art-direction/human-roster-v1/generated/worker-wood-north-west-v2/README.md)
are preserved; rejected overhead v1 is not runtime art. Rebuild with
`python3 scripts/admit-worker-wood-north-west.py`. Shared scale/pivot retains
world units per pixel; all128 old records/pixels and53 clips remain exact.
A right-side strip grows the single color/mask page2048→2560 wide, height4096
unchanged, with a zero mask extension. Existing default productive wood selector
uses this exact heading. Six other missing wood headings retain exact idle.
See the land checkpoint for preservation/default CPU playback; identified
native/deployed function remains open with48 remaining art cells.
