# Worker performing-action consumer — 4 October 2026

Animation integration task `01a103d4` retains default binding, release, identified
delivery and ordinary-game acceptance. Economy/content supplied the agreed
[v1 contract](worker-performing-action-contract.md) in PR187/204, merged at
`ebbca2f664a69fba073f9b739ad213fe78e05709`. This consumer starts from main
`154e5198d061c6696fdf3a13e3ffa6abffcf8c46`. No gameplay rules or artwork change.

## Reproduction and binding

Nine new client checks failed before the binding: assigned gather/build/repair
waits used work frames; a retained no-wood repair task kept its hammer frame;
food work with previous wood cargo selected wood pixels; absent/unknown protocol
and generation reuse did not clear confirmed work. The actual client receipt and
frame-loop source slices, shipped Human/Boughward Worker manifests and Three
instanced UV/matrix buffers pass these checks after the change.

`worker-work-presentation.mjs` accepts row 17 only for version 1, a living Worker
and compatible task. Missing/unknown version/action, incompatible intent, death
and generation reuse mean null. The HUD retains task intent. Positive/null changes
write the transform and dirty buffers immediately even if all other fields stay
stable. Sprite, procedural work, fishing contact and per-frame work scheduling
use the confirmed action; none reconstructs work from cargo or stationary intent.
Repeated positive snapshots and heading changes preserve elapsed time. Changing
food/wood resets the resource clip; clearing and resuming starts a fresh clip.
Attack, movement and terminal defeat retain their existing priority and clocks.

Food/wood selects the corresponding existing frames. Human shore fishing retains
four SE keys and the reach contact; other headings and Boughward retain the
declared fallback. A null receipt suppresses the contact even with retained shore
identity. Stone has no dedicated sprite artwork in either default roster: idle
headings and the already existing neutral procedural cue are the honest fallback.
Static fantasy poses and missing Human motion/headings remain production gaps,
listed in the [full inventory/audit](qa-unit-animation-audit-2026-10-03.md).

## Checks and evidence boundaries

- 85 focused client/runtime/clock/fishing/recovery/producer tests pass, including
  both civilizations, selected/unselected, interruption/resume, unknown protocol,
  stable-field repair clear, generation/death, fog and strategic LOD buffers.
- The procedural visual-state scenario, JavaScript/Node type checks, browser
  static allowlist (109 modules) and runtime import graph pass.
- `node scripts/worker-performing-action-scenario.mjs --client-presentation`
  uses actual WebSocket commands and packets on shipped Stone Defense Field for
  both seats: approach, positive food, Stop/resume, paid Farm build/completion/
  harvest, cold recovery, repair exhaustion and rematch. The optional consumer
  fixture applies untouched own-Worker rows and actual version/economy envelope
  to the client source/runtime. It holds each sampled packet for 640 ms of
  controlled CPU time to settle interpolation; this is a frame-binding check,
  **not** continuous browser/network playback. Repair setup explicitly seeds
  damaged paid Farms and nine repair steps of wood in a disposable checkpoint;
  actual commands/progress/no-input null delivery then use the unmodified server.
- The disposable packed Railway HTTP scenario passes all admitted client paths,
  JavaScript MIME, default unit manifests and atlas hashes. The new consumer and
  imported protocol constants have exact allowlist entries and normal `src` copy.
  Clean release receipts and exact reviewed/merged revisions are recorded in the
  consumer PR; a local release check does not identify a Railway deployment.

Native packet/frame evidence is [consumer-native.json](qa-evidence/worker-performing-action-2026-10-04/consumer-native.json).
The supported [browser preflight](qa-evidence/worker-performing-action-2026-10-04/browser-preflight.json)
fails with `sandbox-unavailable`, screenshots 0. Writable temporary/XDG storage
was provided. No sandbox bypass, screenshot, short clip or GPU acceptance is
claimed. Railway delivery owner supports an identified containing staging build;
parent-owned Mac QA supports the recipe below. This animation owner retains the
outcome; source/release/review milestones do not close appearance acceptance.

## Ordinary-game capture recipe

Use a build containing the producer and this consumer through the normal lobby,
with default sprites and no preview flags. Record deployed SHA, map, seat,
Worker ID, task/action, heading, selection and zoom beside each short clip.

1. Start Stone Defense Field in human 1v1, Azure Human and Ember Boughward. Order
   a Worker to distant food, wood and Stone. During approach observe walk/idle;
   stationary assigned waits must not harvest. Observe actual arrival, full cargo,
   Return cargo and deposit. Stone must not borrow wood artwork. For Human food/
   wood, approach from screen-left so the Worker faces SE; capture all eight real
   keys. At other bearings record the documented idle-heading fallback. Repeat
   selected and unselected at ordinary and strategic zoom on both seats.
2. Build a paid Farm or House with multiple Workers. Capture approach, contributing
   builders, Stop, Resume construction and completion. Waiting Workers use idle;
   positive progress uses the existing construction pose/clip. Let the opposing
   seat damage the completed building, then issue Repair. Capture actual positive
   repair, Stop/resume, complete repair and a genuine no-wood wait if reachable.
   Retained repair intent must clear the hammer without another input. Do not
   use the checkpoint-seeded regression as a normal-match balance claim.
3. Select Lab · SHORE FISHING normally. Approach from a real SE diagonal to show
   crouch/reach/retrieve/collect and the existing water contact. Stop and resume,
   then Return cargo. Contact must clear during wait/Stop/return/death. Central
   E/W approaches and Boughward keep their existing food/idle fallback.
4. While working, interrupt with movement or an ordinary enemy attack; observe
   walk/fresh attack priority and then resumed work. Capture defeat through its
   final key/fade. Reconnect/cold-recover and rematch: old work/selection/contact
   must clear, and only a new positive receipt starts work. Include PR161's
   Infantry 850 ms, Spearman 880 ms and Worker 840 ms attack endings without an
   extra opening replay. See the [full audit recipe](qa-unit-animation-audit-2026-10-03.md#visual-gap-and-exact-ordinary-game-recipe).

Railway read-back on 4 October reports staging deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a` as `SUCCESS`, source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`. Git ancestry confirms it contains
PR161 and the agreed producer, but it precedes this consumer. This establishes
their source delivery, not the new consumer or any ordinary-game appearance.

The precise remaining visual gap is these ordinary-game clips/screenshots at an
identified producer+consumer revision in a browser with a working sandbox/GPU.
