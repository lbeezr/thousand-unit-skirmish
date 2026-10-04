# Browser suspension and current-state recovery — 4 October 2026

Owner: browser lifecycle/resume task `01a0f784-c5d7-72e0-82e8-1747b4c840c1`.
The reported Mac inactive-window freeze and slow return are not yet reproduced
in an identified real browser. Work and tests here are cloud-only.

## Trace and bounded reproduction

Baseline inspected: `aacfee043ef0931e4e0a6973e3ea907295da969b`.
The production frame loop already caps its delta at 0.1 seconds and interpolates
unit coordinates; it does not replay missed simulation ticks. However, every
WebSocket state message immediately runs the whole presentation update, including
unit/forest/fog/HUD work, while hidden or draining a backlog. A CPU reproduction
using the actual client handler applies 1,200 queued full snapshots 1,200 times.
The repair applies the newest full snapshot once on a visible frame and applies
none while hidden. This establishes that presentation failure path, rather than
proving the exact cause of the user's browser observation.

The wire protocol uses complete seat-filtered snapshots. Normal no-fog broadcasts
carry owner waypoint counts on a separate reliable message; fog snapshots and
explicit refreshes include them. Coalescing preserves this ordering. Dependent
deltas must not be admitted to this path without a different protocol contract.

| Observed condition | Recovery behavior and evidence boundary |
| --- | --- |
| Window blur, document still visible | Clear held keys, drag/tap/pan and captured pointers; keep rendering, selection and camera. Blur alone does not request a refresh. |
| Actual hidden document | Suspend rendering and full-state application; retain no snapshot backlog. On visibility return, request one correlated complete private projection. |
| Browser freeze, or a visible frame gap over two seconds | Use the same freshness barrier; snap to current coordinates on the first accepted visible frame. Do not replay obsolete combat/spawn/audio feedback. |
| Discard/reload | Existing session admission restores the seat from storage. A new instance admits its welcome epoch; no held orders survive a reload. Selection/camera survive ordinary resume, but retain their existing reload behavior. |
| Missing application response | Report synchronization or awaiting response, then close the old connection after ten seconds and use existing seat-safe reconnect. Transport silence does not prove a simulation stall. |
| Responsive refresh with unchanged authoritative tick for ten seconds | Report `SERVER NOT ADVANCING`; a later advancing state clears it. The authority increments ticks even in lobby and after victory. |

Browser behavior references: [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API),
[MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
and [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).
Blur and hidden are different states; browsers may pause frames, throttle hidden
timers, freeze or discard a document. The repair respects those policies.

## Default implementation and checks

`src/browser-state-recovery.mjs` is integrated into the normal client. Epoch/tick
checks reject old state, refresh IDs reject queued pre-resume broadcasts, and
commands remain gated until the fresh projection is actually presented. The
server's `stateRefresh` reply uses its existing seat privacy and queue limits and
clears older replaceable projections before writing the reply. Match simulation,
pause, victory, multiplayer and audio preference policy are unchanged.
Visual development backing: N/A for the internal scheduling/protocol change;
recovery text uses the existing connection status and order status surfaces
described in [the playing guide](playing.md), without new visual treatment.

Focused CPU checks cover short/long synthetic absence, repeated switches, stale
epochs/ticks/replies, waypoint ordering, slow first frames, missing responses,
responsive non-progress, actual input cleanup, transient cue suppression, camera
and selection preservation, and the production handler's bounded application.
Fixture frame advances are deterministic CPU contracts, not hidden-page proof.
The native two-seat `scripts/browser-state-refresh-scenario.mjs` checks private
current state, waypoint metadata, invalid IDs and same-seat reconnect. The existing
impaired-connection scenario checks duplicate build/spend prevention separately.
Exact commit, test counts and clean release digest belong to the linked PR's
execution receipt; they cannot be supplied by dirty-checkout results.

## Real-browser acceptance still open

The first local cloud capability attempt was blocked by Linux sandbox/storage
constraints, before a game frame. No security or throttling bypass was used.
[Hosted qualification #323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323)
proves a packed moving-game capture at its own revision. Its inherited launcher
disables background throttling; that capture cannot establish lifecycle recovery.

The owned adapter `scripts/renderer-browser-resume-scenario.mjs` enters a normal
two-human Terraced Vale match and requests real browser window minimization,
trusted visibility/freeze events and network impairment. It refuses admission
without `backgroundPolicy: 'default'` and an owned absolute `evidenceDirectory`.
It records source/release identity, bounded read-only observations and PNG
checkpoints without invite/session credentials. Its CPU contract tests do not
claim a browser pass.

Receiving owner: shared capture task `CI01a10378`,
[shared interface #331](https://github.com/lbeezr/thousand-unit-skirmish/pull/331#issuecomment-5982492112).
Next action: admit `browser-resume` to the shared batch with default background
policy, actual visible blur/hidden/freeze controls, controlled network-error
accounting and an owned evidence directory; execute at an identified clean pack
and inspect its lifecycle JSON and PNGs. If the provider cannot expose these real
states, record that limitation rather than substituting synthetic event dispatch.
No deployed identity or real lifecycle visual acceptance is inferred from merge,
CPU checks, native protocol checks or clean packaging.
