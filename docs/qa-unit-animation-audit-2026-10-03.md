# Unit action and heading audit — 3 October 2026

User observation: “it still seems like the units arent really using their
animations for all their scenarios properly”. Animation integration owner retains
the timing correction and this audit through identified delivery and ordinary-game
acceptance. Combat targeting/reacquisition, building rendering and Coastal Skiff
adoption belong to their existing owners and are outside this change.

## First reproduced defect and scoped correction

The real default Human and foot-unit atlases contain 1,000 ms idle placeholders
for missing attack/death headings. `loadRolePack` counted those placeholders
when computing the longest state duration. The default approximate action path
instead selects the actually authored SE clip. Thus Infantry's 850 ms looping
attack remained active until 1,000 ms and replayed its opening keys without a
new server attack. Human Worker attack held its final key for 160 extra ms;
Spearman attack repeated its start for 120 ms. Shorter defeat clips similarly
inherited extra time before the existing fade. Archer's 1,000 ms attack and
Spearman's longer 1,080 ms defeat were already correct.

The narrow runtime fix gives authored non-idle action clips priority when
computing state duration. A state with only idle placeholders keeps its fallback
duration; single-frame authored action poses keep their 1,000 ms duration.
No frame, atlas, direction binding, order, simulation, targeting or server field
changes. This remains a role/state duration API; future multiple authored action
headings of different lengths will need selected-clip lifetime support.

The baseline reproduction used actual manifests and Three instanced UV buffers:
Infantry still selected attack after its authored end and sampled the opening
keys again. Two new tests failed before the correction, and the complete focused
suite passes afterward. This is CPU/scene evidence, not a WebGL screenshot.

## Deployed source versus main and actual coverage

Staging deployment `cf9bea37-1681-4b1c-8764-23eb260bedde` was read back as
`SUCCESS`, source `00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc`. Initial audited
main was `94fb8033af24ac4ea27e6915ae8427be963100fd`. Animation helpers, all unit
manifests and heading bindings are identical between these two revisions.
Main's later combat continuation fixes are separate simulation changes.

The [complete inventory](qa-evidence/unit-animation-audit-2026-10-03/manifest-inventory.json)
records all 25 shipped unit packs: 14 ordinary defaults and 11 explicit legacy
comparisons. It preserves manifest hashes, every action/heading's frame IDs,
unique atlas rectangles, loop flags, durations and idle holds. No unbound unit
frames were found. A listed clip/heading does not imply distinct motion artwork.

| Ordinary runtime pack | Real motion / authored poses | Missing coverage and current binding |
| --- | --- | --- |
| Human Worker `cast-human-sprite-v3` 0.14.0, 84 frames | Walk NE/SE/SW: eight keys, 800 ms. Wood/food gather, build, repair, attack, defeat SE: eight keys, 840 ms. Fishing SE: four keys, 1,300 ms. Eight distinct idle headings. | Walk and land/fish gather keep exact heading, holding idle where motion is missing. Build/repair/attack/defeat default approximation reuses authored SE. Generic gather clips are idle holds. No Stone-gather, carry or return clips. |
| Infantry `infantry-sprite-v3` 0.5.0, 32 frames | SE walk eight/800 ms; attack and defeat eight/850 ms. Eight idle headings. | Ordinary approximation reuses SE action for the other seven headings. |
| Spearman `spearman-sprite-v1` 0.3.0, 32 frames | SE walk eight/800 ms; attack eight/880 ms; defeat eight/1,080 ms. Eight idle headings. | Ordinary approximation reuses SE action for the other seven headings. |
| Archer `archer-sprite-v2` 0.5.0, 32 frames | SE walk eight/800 ms; attack eight/1,000 ms; defeat eight/850 ms. Eight idle headings. | Ordinary approximation reuses SE action for the other seven headings. |
| Human Scout, Rider, Siege Engine v1 | Four static SE action images each: idle/walk/attack/defeat. | Every heading points to that same action image. There is no multi-key movement or directional motion. |
| Boughward Worker v1 | Eight static SE images: idle/walk/wood/food/build/repair/attack/defeat. Generic gather reuses wood. | All eight heading labels reuse each action's same SE image. Fish uses food fallback. No multi-key motion, carry/return or Stone action. |
| Other six Boughward land roles v1 | Four static SE images per role: idle/walk/attack/defeat. | Eight heading labels reuse each action's same image. No multi-key motion. |
| Bellweather Sheep static v1 | Eight distinct idle views, default wildlife registry. | No walk/graze/carcass animation. Resource carcass marker and depleted hiding remain correct existing fallbacks. |
| Skiff | Existing procedural placeholder path. | Authored export/hooks are Coastal-owned and excluded from this audit fix. |

## Authority → presentation → frame trace

`snapshotUnits` sends ID/team/position/HP/kind/cargo/type/generation at indices
0–8, Worker task at 9, focused count at 10, fresh attack tick/target at 11–13,
work execution at 14, gather heading at 15, and shore-fish variant at 16.
`applyState` clears absent heading/variant fields, deduplicates attack ticks and
resets transient clocks on generation reuse. Positive HP loss supplies hit
feedback; HP reaching zero supplies the terminal defeat timestamp.

The main frame loop interpolates the authoritative position, derives walking
from remaining displacement, and turns with `atan2(dx,dz)`. Stationary gathering
uses row 15 unless an attack is active. Zero yaw is +Z, increasing toward +X;
`normalizedDirection` rounds to N/NE/E/SE/S/SW/W/NW. No second camera offset or
mirroring is applied. Existing eight-angle projection and wrap-boundary checks pass.

`activeState` precedence is defeat → walk → fresh attack → Worker repair/build/
gather-fish/gather → idle. Carry/return use walk while moving and idle when
stopped; the existing neutral cargo cue is separate. `spriteActionClip` chooses
resource-specific gather, exact-heading fishing fallback, repair/build fallback
and the documented approximate action directions. `spriteAnimationTime` advances
elapsed milliseconds; state changes restart work/walk, event timestamps own
attack/defeat, and continuous heading changes do not restart the action clock.
`clipFrame` loops work/walk and clamps terminal defeat. The chosen manifest
rectangle writes the instanced UV buffer, with shared ground pivot/scale.
Selection is not an input to this sprite path.

Focused checks use actual default packs/Three scene batches for both civilizations
and selected/unselected inputs: idle, walk, attack start/end/new event, wood/food
gather, build, repair, supported fishing/fallback, carry/return/deposit, death,
Stop/resume, work interrupted by movement, continuous eight-heading turning,
fog/LOD hiding and elapsed-clock recovery. Existing generation-reuse and fishing
contact checks supplement them. No frozen or repeatedly reset walk/work clock
was reproduced in those cases. Native UI selection/cargo visibility remains
part of the visual recipe below.

## Separate protocol gaps for the gameplay owner

Task row 9 is intent, not proof of active execution: `workerTaskStatus` returns
gathering whenever a gather target exists, including `to-node`, and build/repair
whenever a building target exists. The client infers active work from that task
plus interpolated walking. A Worker waiting on a route/site can therefore show
a work pose prematurely. Row 14 already carries active gather/repair execution
but is consumed for audio rather than sprite state; active construction execution
and construction/repair facing are not supplied by the current wire contract.
Only active gathering has row 15's target heading. No such protocol was changed
here. Receiving owner: gameplay/stance owner identified by the parent; next action
is to agree on an execution/facing presentation contract before any binding change.
Attack tick/target fields remain compatible with the combat owner's continuation
fix; that fix is not duplicated.

The follow-up [performing-action proposal](worker-performing-action-contract-proposal.md)
reproduces 13 actual-progress/wait cases and proves construction's per-Worker
wire ambiguity. It proposes positive-mutation receipts at new row 17, with
generation/order/tick guards, for parent routing to the unit gameplay producer
owner. It is not a default binding or an implemented protocol extension.

## Ranked continuation backlog

The 4 October [agreed v1 consumer follow-up](qa-worker-performing-action-consumer-2026-10-04.md)
supersedes the dated protocol gap above: PR187/204 supplies row 17/version 1;
default work now requires positive mutation receipts. The original inventory and
timing reproduction remain dated evidence. Missing frames are unchanged.

The animation integration owner retains this workstream. Read current main and
the relevant manifest before each slice. Select a concrete existing-asset defect
when supported by reproduction; missing motion alone is not a binding defect.
Small reviewed PRs and tooling milestones do not close ordinary-game acceptance.

| Rank / status | Next action and bounded writes | Dependency / acceptance |
| --- | --- | --- |
| 1 — agreed producer and default consumer; delivery/appearance open | Retain the [Worker performing-action consumer](qa-worker-performing-action-consumer-2026-10-04.md) through an identified staging build and ordinary-game clips. Animation owner owns ingestion, sprite/procedural/scheduling/fishing clear gates and focused tests. No economy rates, orders, targeting or stance edits. | [Agreed row 17/version 1](worker-performing-action-contract.md), real both-seat commands/WebSocket receipts, held-packet client buffers and default release HTTP checks establish local integration. Railway delivery and parent-owned Mac QA support the exact normal-game recipe; missing GPU clips and a containing deployed revision cannot be closed by these tests. |
| 2 — source/release milestone complete; delivery/appearance open | Retain PR161's attack/death lifetime correction through the identified staging build and Mac QA recipe below. Animation helper/tests remain owned here; Railway and Mac QA owners support delivery/capture. | Merged source `5f35c68f7c667bfd6eb977e0abcb551010fbcfd1`; clean release includes it. Latest read-back staging deployment `29d74cac-b078-4a88-8f2a-e3141a2f9465` is `SUCCESS` at source `32f11d58018404835fd47489441f9cdfef7c403b`, still before PR161. Read current deployment instead of assuming auto-deploy success; capture Infantry/Spearman/Worker event end and defeat on the containing build. |
| 3 — exact work facing dependency | After productive action is authoritative, inspect whether the actual build/repair target heading can be disclosed using the existing heading contract without overlap. Agree the producer boundary before changing row 15 semantics. Consumer/tests remain narrow to unit facing helpers. | Build/repair headings are absent; no target-distance guess. Existing Human SE actions may still require documented approximation. Human gather/walk exact-heading fallback remains intentional. Verify selected/unselected approach, work and Stop/resume with an identified game build. |
| 4 — art dependency; no generation authorized | Admit any subsequently supplied, rights-verified motion/headings through the current manifest contracts, one supported action/heading at a time. Re-run actual-frame and release admission checks. | Human Worker lacks five walking headings, seven land-work/fishing headings, carry/return/Stone actions; fishing has four stepped SE poses. Other Human military and fantasy coverage is recorded above. Art producer must supply real keys. Never synthesize missing motion or call a static heading an animation. |
| 5 — separate wildlife/Coastal owners | Preserve accurate fallback and audit newly admitted contracts only when supplied by their owners; avoid their renderer/hooks. | Sheep has eight static idle views and no walking rig; Skiff adoption belongs to Coastal. Neither is an animation-helper fix currently justified by existing frames. |

This checkpoint makes no further production binding change: the next productive
slice needs the producer alignment in rank 1. Independent client harness preparation
provides source/check acceptance while that contract is settled. Native capture remains unavailable
in this executor. Dependent implementation and appearance acceptance stay open;
tooling acceptance is the reproducible probe, documentation checks and independent
review rather than a fictitious deployment.

## Visual gap and exact ordinary-game recipe

The [browser preflight](qa-evidence/unit-animation-audit-2026-10-03/browser-preflight.json)
fails with `sandbox-unavailable` after writable XDG directories resolved profile
storage. Zero screenshots/clips were obtained. No sandbox flag bypass was used.
Receiving visual owner: parent-owned Mac QA route. It needs an identified served
revision containing this correction, normal browser capture and the steps below.
Animation integration owner retains acceptance until that evidence exists.

1. Open the ordinary staging URL, **Create Room**, choose **Bellweather · Millrace**,
   join the invite in a second browser profile, ready both players and launch.
   Use the default Human Azure/Boughward Ember art, without preview query flags.
2. At ordinary zoom select one Azure Worker. Walk it screen-down (NE), right
   (SE), and up (SW), then through the five remaining bearings. Capture one
   second of each; only those three headings currently have walking keys.
   Repeat after Escape clears selection. Stop mid-walk, then order the same
   direction again: walking resumes, stationary idle retains its last heading.
3. Gather berries and wood. Approach so the Worker stands screen-left of the
   resource and faces screen-right/SE to observe the eight real work keys.
   Repeat at a non-SE bearing to observe the exact idle-facing fallback. Use
   **Stop**, then right-click the resource again. Carry at least one load,
   choose **Return cargo**, and observe walk → stopped idle → banked resource.
4. Place a House using that Worker, stop during construction, and use **Resume
   construction**. After completion let the second seat damage it with military,
   then use the normal repair control. Capture work arrival, interruption and
   completion; build and repair currently reuse the SE action in ordinary mode.
5. Train Infantry/Spearman/Archer from the appropriate paid buildings. Order a
   focused attack through the ordinary enemy right-click path, with Attack move
   armed for the combat-owner continuation case. Capture the first attack,
   target death and next engagement. Per fresh Infantry attack event the 850 ms
   clip must finish without a repeated opening at 850–999 ms. Repeat for
   Spearman (880 ms) and Worker defense (840 ms). Capture a unit's death through
   the final key and fade. Do not infer damage from animation timing.
6. On Ember repeat gather/build/repair and combat. Each action changes to its
   actual static pose; it cannot animate between keys or face eight directions.
   Train mounted/siege roles and verify their same documented static limitation.
7. Start **Lab · SHORE FISHING** through ordinary map selection. Central bank
   approaches face E/W and retain fallback. Approach from the real SE diagonal
   to observe crouch/reach/retrieve/collect, including the existing reach contact.
   Stop, return cargo and resume; the contact must clear outside reach/work.
   Repeat on Ember for food fallback. Four stepped poses and seven missing
   fishing headings remain production work. Observe Millrace Sheep separately:
   eight static views are not a walking rig.

Save short chronological clips with build SHA, map, seat, unit role/action,
heading and selected/unselected status. Include ordinary and strategic zoom,
especially ground/root contact, cargo and attack/defeat transitions. CPU UV tests,
merge and release inclusion do not close delivered/in-game acceptance.
