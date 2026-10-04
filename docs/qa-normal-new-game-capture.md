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

The cloud testing owner's [registered runner PR331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331)
and the adapter's normal-entry hosted invocation/PNG inspection are **pending**.
Inspect every retained PNG at the exact reviewed source/release before claiming
this interaction passed. Record admitted seeds/map/mode, served identity and
Worker/command/feedback/displacement evidence. A supplied player-pathing
reproduction needs its own map/units/destination record; this nearby Tiny Move
does not establish broad pathing reliability. Gather/build/train, combat,
both-seat Objectives, victory/rematch and unassisted first play remain open.
