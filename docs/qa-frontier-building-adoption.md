# Ordinary-game acceptance for the eight Frontier buildings

[Runtime contract](frontier-building-runtime.md) · [Source pixels and hashes](qa-evidence/default-frontier-buildings-2026-10-03/source-images.json) · [Art history](lore/art-evolution.md)

The building implementation workstream retains acceptance until explicit closure.
Railway delivery and Mac QA support this owner; their involvement and the merges
do not close it. Mac is currently offline. **No completed ordinary-game capture
is recorded here.** Runtime integration is [PR #136](https://github.com/lbeezr/thousand-unit-skirmish/pull/136)
and [PR #141](https://github.com/lbeezr/thousand-unit-skirmish/pull/141), present at
`c2649368a74a2c2daab345342b39608ba396da2c` and descendants. No new visual feature
is needed for this acceptance pass.

The local [military production slice](frontier-barracks-range-authoring.md) extends
this recipe with paid Barracks and Archery Range. Both maps now include their
four additional soil pads; the actual publishMap scenario verifies sixteen
legal paid sites across the two seats. This extension does not close the six
earlier families' acceptance or claim a new deployed revision/native capture.

## Identify the actual served build first

Record the environment, successful deployment/source revision, browser/version,
GPU, viewport dimensions, device pixel ratio, browser zoom, room and map ID. A
merge or public `/ready` response does not identify the code a browser receives.
Railway must report an integrated revision; then check the browser's actual
`src/frontier-building-preview.mjs`, `src/captured-building-art.mjs` and the eight
requested manifests/images against that checkout. Record response status and
SHA-256, omitting credentials and session tokens. Preserve original screenshot
files and their hashes before wiki indexing.

Use ordinary foreground Chrome with browser zoom 100%, a fresh profile for each
seat, and the normal game entry. **No `frontierBuildingsPreview`, `rendererCapture`
or other renderer override belongs on the acceptance URL.** An old-art comparison
may use `frontierBuildingsPreview=0` in a separately labelled run; it cannot serve
as the normal-default proof.

## First confirm the shipped opening, then a compact paid settlement

1. Create a disposable **New room**, invite a second fresh profile, choose
   **Bellweather · Millrace** with its authored 24-unit opening, ready both seats
   and launch. Keep the deployed origin visible in the receipt. Capture Azure
   and Ember starting Town Centers with actual Workers, first unselected and
   then selected. Both must use the finished civic-hall family in normal play.
2. In this disposable room, Azure opens **Match Controls → Map Studio → Import
   JSON** and imports [the flat acceptance map](qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-flat.json).
   Import validates automatically; confirm **Loaded <filename>. Review the map
   ID…**, review the imported settings, then **Save & Play Map**. This resets the room; if it returns to the
   pregame lobby, ready both seats and launch again. Confirm map ID
   `frontier-buildings-acceptance-flat`, 64 × 64, 12 units per seat, no fog,
   2,000 food / 3,000 wood per seat. This is the ordinary simulation and renderer,
   with a small authored opening; it is not an asset gallery or sprite fixture.
3. Each seat selects Workers and pays for House, Storehouse, Stable, Watchtower,
   Barracks, Archery Range
   and an expansion Town Center on the labelled-by-position soil pads below.
   Select the starting Town Center, research **Military Tier II** (200 food /
   150 wood, 35 seconds), wait for completion, then pay for Workshop. Capture
   construction before completing the settlement; do not replace states by
   editing a checkpoint or creating Three objects.

| Family / order | Azure world `(x,z)` | Ember world `(x,z)` | Grid center Azure / Ember `(column,row)` | Cost food / wood; nominal build seconds |
| --- | --- | --- | --- | --- |
| Starting Town Center | `(-23.5,0)` | `(23.5,0)` | Existing home landmark | Already present |
| House | `(-26.5,12.5)` | `(26.5,12.5)` | `(5,44)` / `(58,44)` | 0 / 75; 15 |
| Storehouse | `(-25.5,4.5)` | `(25.5,4.5)` | `(6,36)` / `(57,36)` | 0 / 100; 20 |
| Stable | `(-14.5,-6.5)` | `(14.5,-6.5)` | `(17,25)` / `(46,25)` | 0 / 200; 25 |
| Watchtower | `(-9.5,-1.5)` | `(9.5,-1.5)` | `(22,30)` / `(41,30)` | 50 / 150; 35 |
| Paid Town Center | `(-10.5,8.5)` | `(10.5,8.5)` | `(21,40)` / `(42,40)` | 100 / 400; 60 |
| Workshop, after Tier II | `(-14.5,1.5)` | `(14.5,1.5)` | `(17,33)` / `(46,33)` | 0 / 250; 30 |
| Barracks | `(-20.5,-6.5)` | `(20.5,-6.5)` | `(11,25)` / `(52,25)` | 0 / 175; 20 |
| Archery Range | `(-25.5,-6.5)` | `(25.5,-6.5)` | `(6,25)` / `(57,25)` | 0 / 150; 20 |

Soil pads show the paid **5 × 5 Town Center / 3 × 3 other** footprints. These
are clear, nonoverlapping sites reused from the existing paid settlement plan.
The eight paid buildings plus Tier II cost **350 food / 1,650 wood per seat**; time
spent walking, Worker count and interruption affect completion time. The bank
also leaves room for training, damage repair and a replacement. Keep armies at
their own bases until both settlements are captured. Watchtower fires on enemies
within seven cells; keep the later damage squad outside its range except when
the tower itself is the deliberate target.

After healthy completion, research **Siege Engineering** at Workshop (an
additional 150 food / 150 wood, 30 seconds) before training a Siege Engine.
Queue a Worker from each Town Center, a Scout from Stable and then a Siege Engine
from Workshop; set ground rally points and observe the
actual unit exit/rally and production cue while the finished image stays visible.
Also train an Infantry/Spearman from Barracks and an Archer from Range; inspect
their actual production cues and exits/rally through each seat's ordinary UI.
House, Storehouse and Watchtower have no production queue or rally action. The
existing [paid mature-settlement checkpoint recipe](qa-mature-settlement-2026-10-02.md)
can speed a separate local completed-art inspection; its older source receipt,
flat map and prebuilt checkpoint do not replace deployed construction/fog proof.

## State coverage and what fallback actually means

All eight new families contain **Complete only**. Above 60% health, completed
buildings use their preserved finished art. Incomplete progress **≤27.5%** asks
for Foundation; **>27.5% and <100%** asks for Frame. Complete health **≤60% and
>30%** asks for Damaged; **≤30%** asks for Critical. A missing state hides the
new Complete image and uses the existing role below. At progress 100%/completion
or repair above 60%, the finished family returns after its frame is available.

| Family | Construction fallback | Damage/Critical fallback |
| --- | --- | --- |
| Town Center, home and paid | Older captured Town Center Foundation/Frame; procedural geometry while an older frame is unavailable | Older authored captured Damaged/Critical images, with existing team masks |
| House and Storehouse | Existing House geometry: wall height follows progress; roof appears only when `complete=true` | Completed procedural House geometry and actual health indicator; no authored damage shape |
| Watchtower | Existing taller House-derived tower; roof appears only when `complete=true` | Completed procedural tower and actual health indicator; no authored damage shape |
| Stable | Existing Barracks geometry: foundation <25%, frame 25–<50%, walls 50–<75%, roof ≥75%, finish pieces/team standard ≥90% | Completed procedural Barracks role and actual health indicator; no authored damage shape |
| Workshop | Existing Range geometry: posts grow with progress, roof/finish pieces/team standard ≥90% | Completed procedural Range role and actual health indicator; no authored damage shape |
| Barracks and Archery Range | Retained direct Foundation <20%, Frame 20–<90%, older Complete ≥90%; procedural role while that frame loads | Retained direct Complete ≥66%, Damaged 33–<66%, Critical <33%, with actual health indicator |

For every paid family capture early construction, either side of the 27.5%
boundary, late construction (75%/90%), healthy completion, damage near 60%,
Critical near 30%, and repair back above 60%. Stop builders if a state passes
too quickly. To resume, select Workers and use **Send selected workers to
<building>**; confirm that control names the intended unfinished structure.
Send a small opposing
military squad to attack one structure, stop it before crossing each threshold,
then select the damaged owner structure and use **Repair with Workers**. Workers
alone cannot attack buildings. Record the actual displayed HP/progress; rounded
HUD percentages can straddle a threshold, so preserve the associated state value
when available. Do not label procedural damage fallback as newly authored art.

Town Center max HP is 2,400 (60% 1,440; 30% 720); House 800 (480/240);
Storehouse and Watchtower 1,200 (720/360); Stable and Workshop 1,600 (960/480).
Health-bar color uses separate thresholds: green >55%, yellow >25%, red ≤25%.
Its color alone does not identify the captured-image state. Fully repaired
structures hide the bar. Destruction removes the building and its picks/depth;
no collapse animation or new ruins image is expected. Destroy a paid structure
while another Town Center survives, then rebuild it and confirm default Complete
again. Retain failed, rejected and intermediate screenshots as well as successes.

## Selection, hover, teams and camera checks

| Interaction | Current semantics / expected native observation |
| --- | --- |
| Left-click a friendly building body | Select that building, lime outline `#d5ef78` at opacity 1, correct name/actions in HUD. Deselect restores Azure `#5aa7d7` or Ember `#e67a5e`, opacity 0.9. A friendly unit under the pointer has selection priority. |
| Hover without selection | Ordinary select cursor; no new building hover tint or outline. |
| Military selected, hover enemy building | Attack cursor; right-click orders building attack. Hover must not advance the unit-overlap target stack. |
| Workers alone selected, hover enemy building | Unavailable cursor; building attacks require military. |
| Friendly building selected | Town Center, Stable and Workshop use rally cursor/right-click ground; House, Storehouse and Watchtower use unavailable cursor for rally. Their normal production/action panels differ by actual type. |
| Both teams' completed art | The PNG is shared across teams and has no aligned team mask. Painted pennants stay source-colored. Live standards differ in color **and shape**: Azure rectangular with one pale bar; Ember notched with two. Selection lime removes the outline's color distinction, so check the standard and HUD together. |
| Transparent margin | Existing rectangle-based Three Sprite picking remains; no alpha-aware picker was added. Clicking a clear part of the full sprite quad may select it. Occupancy remains the server footprint. Body-depth child never adds a target. |

Capture both teams at the **initial normal zoom 0.91**, then **Fit map** for the
strategic view and scroll back to a readable close view. Record the actual
viewport and camera mode; Fit map derives zoom from viewport/HUD dimensions and
must not be labelled an exact 0.48 unless measured. The normal game camera is
fixed at **45° azimuth / 45.4359° elevation**, base frustum 43 world units. It
selects capture **view 01** from the 46° source camera. Panning across the map,
centering home/selection, changing team side and zooming must not choose a new
heading or make the building shift relative to its ground pivot. There is no
ordinary-game rotate control; opposite/steeper captures in the separate depth
fixture do not establish ordinary-game all-heading support.

Move real Workers along the rear and front perimeter of each family. Rear
Workers overlapping opaque roof/body pixels should be occluded; foreground
Workers should remain visible; transparent margins and low-alpha shadow edges
should preserve the existing blended look. Inspect the low Storehouse's doorway
and Worker height, House door height, Stable court/trough, Workshop equipment,
Watchtower base and Town Center wings. Preserve calibrated canvas/pivot and
placement; report a scale/contact defect before any artwork fitting or crop.
Check that selected/hover cues and live standards remain readable and unoccluded
at strategic zoom. CPU geometry checks cannot establish that legibility.

## Raised ground, fog and evidence closure

Repeat the compact paid build using [the raised/fog map](qa-evidence/default-frontier-buildings-2026-10-03/acceptance-map-raised-fog.json),
ID `frontier-buildings-acceptance-raised-fog`, through the same ordinary Map
Studio publication/launch. It retains both banks, rosters and soil pads, enables
fog, and places both **paid Town Center pads at level 2 / 1.6 world units** with
level-1 access rings. Other pads stay flat. Inspect ground contact and production
exits on the raised Town Centers. This map uses supported levels 0–2, not the
previously rejected level 3. To inspect another family on that plateau, reset and
place it on the center of the empty 5 × 5 pad instead of the expansion Town Center.

From the opposing seat, an unscouted settlement must be absent. Scout to reveal
it, capture the actual art/feedback, withdraw or lose the scout, then observe
the building disappear when its footprint area leaves current visibility.
Owned structures remain visible. Hidden enemy bodies must leave no ghost depth,
hover attack target or selectable building; reveal again and confirm the family
returns. Repeat reveal/hide at normal and strategic zoom. Server visibility
projects enemy buildings only while currently seen, so memory of explored ground
does not imply a persistent building silhouette.

Retain an evidence directory per attempt containing original PNGs, a hash
manifest, source/release/deployment revisions, map JSON/hash, both seat/camera
settings, and a short observation matrix for all eight families and states. Link
the preserved files from the [art evolution wiki](lore/art-evolution.md) only
after existence, hashes and pixels are verified. Keep the earlier incomplete
Barracks depth-cost receipt; its partial timings do not substitute for this
ordinary-game coverage. The workstream closes acceptance only after actual
integrated deployed bytes and this observed coverage pass, or the user explicitly
accepts a recorded narrower result. Until then deployment/native boxes stay open.

## Verified preparation, not native acceptance

The factory regression executes actual ordinary picker, selection, cursor and
health-update functions for all six families/both teams, plus late construction
and exact 27.5%/60%/30% boundaries. It checks live flag color/shape, shared art,
hidden-group picking, team-filtered friendly selection/enemy hover, retained
feedback and repair. It mocks DOM image decoding and performs no WebGL capture.
The acceptance-map scenario publishes both exact JSON files through an isolated
real server and checks banks/rosters/map identity and supported elevations.

```sh
node --test scripts/frontier-building-default.test.mjs scripts/battlefield-cursor.test.mjs
node scripts/frontier-building-acceptance-map-scenario.mjs
```
