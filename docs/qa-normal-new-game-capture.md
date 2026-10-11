# Normal New Game: Worker selection and Move capture

[First-play protocol](novice-first-play.md) · [Testing strategy](testing-strategy.md)

This bounded automated check covers ordinary root → New Game → Tiny Terraced
Vale → one Worker selected through the battlefield → right-click Move → visible
applied feedback and authoritative displacement. It measures an actual normal
entry interaction; human novice comprehension remains separate.

## Adapter and shared runner contract

HUD owns registered `scripts/renderer-novice-flow-scenario.mjs`, the native
`scripts/renderer-qualification-novice.mjs` implementation and focused tests. The
cloud testing owner retains the existing renderer qualification core, packed
server/browser lifetime and hosted workflow/dispatch. The adapter creates no
browser, changes no game command/state and performs no deployment.

The existing runner supplies a fresh `about:blank` page after validating clean
source, release manifest and digest, locked runtime dependencies and served
bytes. Call once inside that browser/server lifetime through `novice-flow`:

```js
import { id, contextVersion, run } from './renderer-novice-flow-scenario.mjs';
const result = await run({ version: 1, page, origin, source, capture, evidenceDirectory });
// id = 'novice-flow'
// contextVersion = 1
// source = immutable { revision: fullCleanSourceSHA, digest: cleanPackDigest }
// capture = the shared source-bound applied-map checkpoint hook
// evidenceDirectory = the existing runner's owned per-case artifact directory
// page = the existing CDP page with .cdp.call/.evaluate/.on, .wait and .errors
// Treat result.status === 'failed' as a failed run; retain its evidence/checks.
// The shared runner still owns cleanup and records any cleanup failure.
```

The adapter verifies `/health` source/digest identity before normal entry, installs
passive socket/render observations before navigation and lets the real menu
handler create the AI room. It observes Worker ID/generation/team/tick/position,
uses the real camera and terrain to click the game's pick anchor, and checks
one native Move plus visible `MOVE ORDER · 1 UNITS` feedback. It preserves two
advancing rendered page/canvas captures with recent authoritative positions.
The registered wrapper also records the shared `selected-worker` checkpoint
before Move, so extra screenshot work cannot delay the short live route.

Retained evidence: `novice.json`, `menu.png`, `normal-game.png`,
`selected-worker.png`, `move-feedback.png`, `movement-1.png`, `movement-2.png`,
`canvas-1.png` and `canvas-2.png`. A failure preserves `failure.png` when possible
and its first failed stage before the shared runner cleans up. Reports contain
whitelisted state and categories; raw protocol messages, seat tokens, room codes,
URL queries, headers and arbitrary error text are excluded.
Rejected origin/build/fresh-page preconditions produce no page evidence reads or captures.

## Checks and current acceptance

```sh
node --test scripts/renderer-qualification-novice.test.mjs scripts/renderer-qualification.test.mjs
```

These CPU tests check rejection, pass-through observation, native pointer input,
hidden/stale/mismatched evidence and failure capture. They establish zero GPU
frames. No unchanged local sandbox retry or duplicate capability probe is needed:
the supported hosted runner was qualified in
[run 37215311854](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/37215311854).
That Open Field pilot's diagnostic Move remains a distinct evidence scope.

The [registered runner PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331)
and [artifact-directory context PR346](https://github.com/lbeezr/thousand-unit-skirmish/pull/346)
are integrated. The actual shared batch forwards and validates the owned case
directory; the version1 HUD wrapper consumes it and retains the shared checkpoint.
The focused CPU integration check drives the real loaded wrapper/native helper
through that batch with injected process/browser/health/image boundaries. It
checks exact directory/source mapping, success and capture failure. Direct input
records verify no right-click before the checkpoint or after capture failure,
and exactly one press/release pair after success. These injected controls
establish zero actual browser/GPU frames.

The existing qualification CPU group includes
`scripts/renderer-qualification-novice.test.mjs` through merged
[registration PR357](https://github.com/lbeezr/thousand-unit-skirmish/pull/357).
The artifact-directory and invocation-interface prerequisites are integrated.
On 11 October 2026 the user explicitly authorized **“Resume hosted HUD checks”**,
lifting the HUD-specific hosted dispatch/sign-in pause. Other access and sandbox
constraints remain. The HUD owner resumed the existing Ordinary game capture
workflow with `novice-flow` in
[run 38160813082](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38160813082)
at `30b253d10cec91987924872872e1b2e956d420e2`. Its clean release digest was
`sha256:53c23386177ed236c7c8a70ab9431bd674ba1181da988ab29e9818a557267d8b`.
Sandboxed Linux Chrome 154 passed WebGL2 preflight, but the adapter failed before
New Game because its wait dereferenced a menu button before that button mounted.
The inspected failure PNG shows the real menu's initial unavailable/loading
state; it establishes no game or HUD acceptance. The predicate now waits for an
existing enabled control, with absent/disabled/enabled CPU regression coverage.
Normal-entry game PNG acceptance and the broader HUD matrix remain **pending**.
The corrected readiness check reached enabled New Game in
[run 38161108989](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38161108989)
at `96fd31f4946fc072b3c1da720e700fc40a85165c` (same release digest), then the
legacy assertion rejected a precreated hidden game canvas. The inspected PNG
shows the enabled menu without the battlefield. The observer now checks canvas
visibility; CPU coverage distinguishes precreated hidden and visible canvases.
Inspect every retained PNG at the exact reviewed source/release before claiming
this interaction passed. Record admitted seeds/map/mode, served identity and
Worker/command/feedback/displacement evidence. A supplied player-pathing
reproduction needs its own map/units/destination record; this nearby Tiny Move
does not establish broad pathing reliability. Gather/build/train, combat,
both-seat Objectives, victory/rematch and unassisted first play remain open.

## Staging rollout capture — 11 October 2026

The HUD redesign owner retains a separate
[manual staging workflow](../.github/workflows/hud-staging-capture.yml) and
[runner](../scripts/renderer-hud-staging.mjs). It uses the same qualified,
sandboxed Linux Chromium fixture, a fixed staging origin, fresh owned rooms,
and no credentials or provider changes. It leaves the shared packed-loopback
capture context unchanged. Each case is bounded to five minutes, serial within
the run, with completed and failed screenshots retained before cleanup.

The [scenario](../scripts/renderer-hud-staging-scenario.mjs) enters through the
normal Map Studio menu, imports a disclosed 160 × 160 derivative of the existing
mature-settlement fixture, then uses Save & Play, actual picks and enabled HUD
controls. Buildings and production are paid ordinary actions; no runtime world,
bank or command handler is changed. This authored-room entry is separate from
the uninterrupted normal New Game proof above.

| Case | Native interaction and images |
| --- | --- |
| `selections` | Worker, Build disclosure, military, confirmed Defensive stance, Shift-selected Worker/military mix, empty selection |
| `buildings` | Town Center, paid Worker queue, paid completed Barracks, Infantry queue, research disclosure |
| `panels` | Worker with Help, Settings and Objectives, then 1920 × 1080 and 1024 × 768 viewport captures |

The runner verifies exact public HUD source/font file hashes before and after
the case. Those hashes bind the visible code to the selected checkout; deployed
revision and clean release digest deliberately remain separate provider evidence.
Reports contain bounded numeric UI geometry, known state/action categories and
image hashes. Room codes, query strings, tokens, headers and arbitrary errors are
excluded. Passing execution means **captured-needs-review**, never an automatic
appearance pass. Inspect every PNG against the approved
[72px Obsidian specimen](art-direction/hud-design-system-2026-10-11/component-specimen.html)
and retain defects, visible clipping/overlap and unresolved coverage.

This first bounded matrix covers seat 0 at DPR 1. Both-seat behavior, Skiffs,
wildlife/carcasses, land/water mixes, large UI scale, recovery, long queues,
shortages, lifecycle and victory remain explicit follow-up coverage. It creates
no new player-facing presentation and changes no server or access configuration.

The first staging dispatch,
[run 38161563912](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38161563912),
passed sandboxed WebGL2 but all three cases stopped at room creation with HTTP
429. The public status read confirmed 8 saved rooms against a limit of 8; no
existing rooms were changed. The user authorized a temporary staging limit of 9.
`all` now runs the three groups sequentially in one fresh owned `rollout` room,
within the existing five-minute deadline, so this check consumes only one slot.
The original plan assigned restoration to HUD; the later explicit audio handoff below supersedes that ownership. The extra saved test room uses
ordinary idle expiry; reducing the limit does not delete saved rooms.

The separate normal-entry
[run 38161591020](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38161591020)
at `448f163092be4e4247fd57ec5b8857be9b590f4e` (same clean release digest above)
reached Tiny Terraced Vale and native Worker selection. Its reviewed images show
the 72px Worker portrait and six primary actions without visible clipping at
1280 × 720, but also `SYNCING CURRENT STATE`; the selection image disables orders
while reconnecting. The shared synchronized checkpoint failed before Move, and
two canceled room-API fetches remain unresolved. This is partial appearance
evidence, **not an interaction pass**. HUD retains the ordinary-entry follow-up;
no recovery or browser-error gate is weakened to accept these frames.

The one-room retry,
[run 38162536764](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38162536764),
used and served `77b2ad698232ae6d6ed4b00965817d033527203f`, verified public HUD
hashes before and after, and created the ninth room successfully. The reviewed
failure image shows the imported 64 × 64 draft in Map Studio, but Save & Play
never applied it: the active map remained Terraced Vale with an open socket and
recovery active. Two canceled room-API fetches remain real failed evidence.
The [retained review and receipts](qa-evidence/hud-hosted-2026-10-11/review.json)
separate served identity, clean package digest and partial appearance evidence.

The HUD capture now waits for the ordinary live/nonrecovering command gate before
native controls or picks; an enabled Studio button alone does not establish
command availability. The native Worker wrapper likewise waits for its synced
applied/requested map before invoking the shared checkpoint. Existing frame,
browser-error and timeout gates remain intact. These readiness corrections
require another actual capture; CPU predicates cannot prove the connection
problem resolved. The audio owner is separately correcting the room-lookup
response lifecycle in `src/main.js`; HUD does not duplicate that shared edit.

After the HUD retry finished, the audio chat
`01a12b6b-d181-79b1-97b4-05de79523245` accepted the shared capacity transition
from 9 to its separately user-authorized 10. It owns restoring the configured
and served limit to 8 after its capture. Existing saved rooms remain preserved;
HUD leaves the current setting alone to avoid a competing redeployment.


### Authorized in-app browser iteration

The user explicitly allowed a bounded Mac in-app browser HUD check on 11 October,
lifting the start skill's Mac fallback restriction for this check. With staging
at 9/9 saved rooms and the separately approved tenth slot assigned to audio, HUD
used the clean local package at `77b2ad698232ae6d6ed4b00965817d033527203f`
(digest above), through normal New Game into Tiny Terraced Vale. This is actual
ordinary-game local evidence, separate from staging acceptance.

The [review and screenshots](qa-evidence/hud-iab-2026-10-11/review.json) verify
72px Worker selection, native movement and arrival, army stance, mixed selection,
paid Town Center and Barracks queues through completion, research disclosure,
Help/Settings/Objectives and the compact 1024×768 Worker reflow. The 1920×1080
image was cropped by the browser surface to 1873 pixels; its right edge remains
unverified. Two startup texture warnings are retained. Skiffs, owned wildlife,
both-seat and remaining lifecycle coverage stay open.

A selected unfinished Barracks displayed the generic instruction to select a
completed building. Its production reason now says `FINISH CONSTRUCTION TO TRAIN`
without changing availability. This bounded copy correction uses the existing
[Obsidian specimen](art-direction/hud-design-system-2026-10-11/component-specimen.html)
and the retained construction frame as visual backing. Separately, the hosted
fixture now expands the mature settlement to the existing ordinary 160-cell
minimum. The earlier 64-cell draft was not admissible to normal Studio publication;
readiness alone could not make it apply. Historical failed runs remain unchanged.

The construction copy was then verified in a second normal New Game using clean
local source `eb437cc22d823bf4dbf3f9e2cd7e4e74130e38ae`, release digest
`sha256:fb6389185bbb828956ca1e4e7fc3c6b54230c3cff7be6263cef9c1d871950c6f`.
At 66–68% Barracks construction, both training actions stayed disabled and showed
the corrected reason. The temporary browser tab and owned local supervisor were
closed after capture; the viewport override was reset. No staging room was
created or altered by this in-app check.
