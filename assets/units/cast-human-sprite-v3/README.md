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


Version0.22.0 adds **NW food** bare-hand reach/collect/stow, three240ms keys.
[Source/provenance](../../../docs/art-direction/human-roster-v1/generated/worker-food-north-west-v1/README.md)
and rejected/useful prior iterations are retained. Rebuild with
`python3 scripts/admit-worker-food-north-west.py` after the NW wood strip.
It fills existing x2048/y960,1216,1472;131 old frames/54clips/mask/dimensions/world
scale remain exact. Existing default productive food selector consumes NW;
six other missing food headings retain exact idle. NW fishing uses its established
same-heading food fallback; no dedicated fishing artwork is supplied. Source/
default CPU playback checked; actual deployment/native and47 art cells remain.


Version0.23.0 reuses the public actual NW wood axe windup/strike/recovery for
**NW attack**, with a separate3x280ms/840ms one-shot clip. The old frame IDs
stay unchanged, with no new pixels/allocation/world-scale change. Rebuild with
`python3 scripts/admit-worker-attack-north-west.py`; all prior clip metadata
is preserved except this explicit idle-placeholder replacement. Existing
Human attack lifetime, terminal clamp and event restart are checked on both
seats. Six other attack headings remain approximate/missing. Exact native/
deployed game acceptance and46 remaining art cells stay in the land checkpoint.


Version0.24.0 adds **NW hammer build/repair, dedicated pick and terminal defeat**:
nine actual left-profile keys,143 total frames. Build/repair share a720ms hammer
loop; dedicated Stone art loops720ms; defeat ends prone after840ms and holds.
[Source/provenance](../../../docs/art-direction/human-roster-v1/generated/worker-north-west-actions-v1/README.md)
and all nine original extractions remain. Rebuild with
`python3 scripts/admit-worker-north-west-actions.py`. It fills existing strip
space: no dimension/mask/allocation/world-scale change.134 prior frames and
all clips except explicit NW build/defeat idle replacements remain exact.
Default build/repair/defeat CPU playback is checked; Stone default state still
needs animation-owner adoption. All seven land actions now have SE+NW art;
42 direction/action cells and identified native/deployed acceptance remain.


Version0.25.0 adds **East wood/attack** with three actual down-right front
three-quarter axe keys. Wood loops720ms; attack uses the same pixels as its own
840ms one-shot. [Source/provenance](../../../docs/art-direction/human-roster-v1/generated/worker-east-actions-v1/README.md)
retains all nine source candidates; only the first three are admitted/countable.
Rebuild with `python3 scripts/admit-worker-wood-east.py`. Three empty reserved
strip cells fit with no dimension/mask/world-scale change.143 preceding frames
remain exact, with only the declared East attack idle replacement. Default CPU
wood/attack playback is checked.40 action-heading cells and exact containing
native/deployed acceptance remain open; Stone state remains animation-owned.


Version0.26.0 admits **East food** from the retained public-seed iteration:
three bare-hand reach/collect/stow keys,720ms loop. Rebuild with
`python3 scripts/admit-worker-food-east.py`. Same232/307 scale as East axe, fixed
root[128,244], spare256x256 cells at y3840/x1280,1536,1792.146 previous frames,
58clips, exact mask/dimensions/world scale remain. Default CPU food playback,
resource switch and interruptions checked; five missing food headings keep idle.
Existing East fishing food fallback remains; no dedicated fishing art supplied.
39 action-heading gaps and exact native/deployed acceptance stay open. The three
remaining East hammer candidates are retained for the next reviewed slice.


Version0.27.0 admits **East hammer build/repair** from retained keys6..8. Each
uses the same real hammer sequence,3x240ms720ms loop, same232/307 source scale
and fixed128/244 root. Rebuild with `python3 scripts/admit-worker-hammer-east.py`.
Spare strip cells2304/3456,2304/3712,2048/3776 need no page/mask/dimension change;
149 prior frames/RGBA/59clips remain except declared East build idle replacement.
Default CPU productive gating, Stop/resume, movement/attack and build↔repair
reset checked on both seats.37 action-heading gaps and exact deployed/native
acceptance remain; target-bearing integration stays with the animation owner.
All nine keys in the East source sheet are admitted, with prior reviews retained.


v0.28.0 adds three actual East pick keys (720ms loop) and three East defeat keys
(840ms one-shot, prone terminal) from the preserved public-seed iteration.
The aligned one-page/mask strip grows2560→3072x4096; every old RGBA pixel/frame,
world scale and unrelated clip stays exact. Existing exact Stone consumer binds
East by default. Full land actions are now3/8(E/SE/NW), Walk8/8;35 cells remain.
See [land QA](../../../docs/qa-worker-land-art-2026-10-04.md) for sources/registration,
release and open identified deployed/native acceptance.


v0.29.0 admits fourteen actual North/down-left land poses: wood/food/pick3,
hammer2 (480ms build/repair loop), defeat3. Wood720ms shares axe art with attack
840ms one-shot. Defeat holds prone terminal840ms. Raw malformed hammer strike
and every iteration remain retained; simple motion is accepted for breadth.
One aligned3584x4096 page/mask preserves every prior3072x4096 RGBA and158 frame
records, world scale and unrelated clips. All seven land-work/combat actions now
4/8(N/E/SE/NW), Walk8/8;28 cells remain. Decoded color56MiB + mask14MiB,
+10MiB over v0.28; existing max silhouette272/world scale unchanged.
See [land QA](../../../docs/qa-worker-land-art-2026-10-04.md) for evidence and
open identified delivered/native acceptance.


v0.30.0 admits fifteen actual NE/front-down poses for every land work/combat
state. All work loops720ms, faithful axe attack840ms and prone-terminal defeat
840ms. One232/278 scale, fixed reviewed contacts, unchanged max272/world scale.
Entire prior3584x4096 RGBA,172records and unrelated clips remain protected in
aligned4096x4096 page/mask (+10MiB decoded; color64MiB + mask16MiB).
All seven work/combat actions now5/8(N/NE/E/SE/NW), Walk8/8;21 cells remain.
See [land QA](../../../docs/qa-worker-land-art-2026-10-04.md) for preserved sources,
source/default/release checks and open identified delivered/native acceptance.


v0.31.0 adds fifteen complete actual South/up-right-back land poses from the
[retained public seed iteration](../../../docs/art-direction/human-roster-v1/generated/worker-south-actions-v1/README.md).
Wood/food/build/repair/Stone720ms loops, faithful axe attack and prone defeat840ms
one-shots bind by default. One271/318 scale, stable pivots, unchanged world
units/pixel; entire old4096x4096 RGBA/187records preserved, only three declared
South idle clips replaced. Aligned page/mask4608x4096,202frames/73clips; decoded
color72MiB plus mask18MiB. Walk8/8, seven land work/combat actions6/8;14 cells
remain in SW/W. Native/deployed acceptance remains owned by the parent receiving
Railway/Mac route; simple contact/loop polish is retained explicitly in land QA.


v0.32.0 adds fifteen complete true SW/direct-back land poses from the
[retained public seed iteration](../../../docs/art-direction/human-roster-v1/generated/worker-south-west-actions-v1/README.md).
Wood/food/build/repair/Stone720ms loops, faithful axe attack and prone defeat840ms
one-shots bind by default. One271/301 scale, fixed roots/pivots, unchanged world
units/pixel; entire earlier4608x4096 RGBA/202records protected, only declared SW
idle clips replaced. Page/mask5120x4096,217frames/77clips; decoded80+20MiB.
Walk8/8, seven other land actions7/8; W has seven art cells left. Identified
parent Railway/Mac native/deployed acceptance and motion/contact polish remain open.
