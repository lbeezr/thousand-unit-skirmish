# Main menu entry — 3 October 2026

[Entry contract](game-entry.md) · [Testing](testing.md)

## Reproduced cause

At fork main `8c9a29fb732254b9940ff338f74cbc605cbd9fc5`, `index.html` directly
loads `main.js`, which calls `connect()` during initialization. A plain root URL
opens `/ws` without a room ID, joining the shared default worker. Browser
session storage may reclaim a seat; the server separately restores that worker's
saved match. Neither path represents an explicit New Game choice. This explains
the reported old battlefield/large army on ordinary staging entry.

Live `https://game-staging-21f9.up.railway.app/` could not be accessed from this
environment: the network proxy rejected the tunnel (403), and web browsing also
failed. This is source/local protocol reproduction, not a native staging claim.
The cloud browser sandbox restriction remains; no sandbox bypass was used.

## Local checks

Fourteen entry tests cover fresh/stale profiles, explicit validated default/room
Resume, invitation/refresh routing, fresh AI/PvP/Studio requests, duplicate clicks,
same-server join validation, expiry, cancellation, browser-back restoration,
settings persistence and retained audio mix values. Cancel/Escape tests use queued
native close timing and preserve a subsequent creation action. A lifecycle test covers
closing once, cancelling reconnect and reconnecting on back/forward restoration.
Two delayed-request cases prove an old room/Resume lookup cannot admit a second
socket after a page has left and returned from the back/forward cache.
The import audit has an explicit dynamic-dependency/cross-origin regression.

The real supervisor scenario uses authenticated HTTP and independent native TCP
WebSocket connections. Eight groups pass: a root menu adds no default peer;
session inspection is read-only for active/stale tokens; strict Resume rejects
unknown tokens before allocation; a fresh PvP lobby gives Azure/Ember and launches
only after both ready; explicit room Resume preserves its target; AI and Studio
create separate fresh matches; the old default match identity/checkpoint remains;
all 88 entry/lazy-client modules are served on integrated main. No deployed service or live-data
mutation is used. The owning PR records exact reviewed/integrated/postmerge builds.

## Integration record

[PR #88](https://github.com/lbeezr/thousand-unit-skirmish/pull/88) integrates fork
main `518b3bd701f70835bf24ce026d6e83bfedb1190e`. Final runtime
`65e661cb053986305230a6877a7421a8a9eccd7f` passes all **830 unit tests**, the
eight authenticated menu protocol groups (88 served modules), the 11 pregame
groups, eight chat groups and the packaged Railway release scenario. The earlier
integrated `77dfdb7` also passes legacy supervisor limits/auth/origin/recovery,
PvE room launch and room expiry. Documentation passes 438 Markdown files and
2,847 local links before this evidence-only update.

Independent review found and the author fixed three entry races: queued native
dialog closure after Cancel/Escape, stale room/Resume fetches after back-cache
restoration, and Resume flags leaking into invites/new rooms. Focused regressions
execute the actual menu/connection/helper code. Strict Resume also uses one
admission instant through token validation and peer creation, so a grace-period
expiry boundary cannot allocate an unrelated seat.

The clean runtime release contains 1,044 files with digest
`sha256:113206684cedeb96b17e95ed55d42374e41a4da0c1b759048bc27ff62518219e`.
The PR closure records the actual merge and postmerge checks. Native browser
appearance and staging deployment are separate follow-ups under the recipe below.

## Exact Mac QA recipe

### Post-menu interruption audit

At main `b29d9746013a8ef24bb66c6cb56cccbac055bbed`, five new regressions reproduce
401/503 being treated as expired Resume, a JSON parse error for the plain-text
401 creation challenge, and ambiguous direct invite/Resume authentication.
[PR #94](https://github.com/lbeezr/thousand-unit-skirmish/pull/94) keeps a previously
validated Resume choice through interruptions and gives sign-in/retry guidance.
Tokens and match identity remain intact; no new room or peer substitutes for Resume.

The authenticated supervisor scenario now has nine groups, including real 401
responses with invalid local test authorization headers, restored sign-in using
the unchanged test server, and the same saved Resume target. Direct invalid/missing
invites and stale Resume also stop before socket admission without a fresh-game
fallback. Exact build/check totals and postmerge results are in the PR closure.
Existing authentication configuration and saved match data are untouched.

### Browser steps

Use the PR's final merge locally, then the identified deployed build once the
Railway owner switches it. Keep normal browser sandboxing and existing auth.

1. Fresh browser profile, ordinary `/`: see the main menu immediately, with no
   battlefield, game canvas or `/ws` connection. Check 1280×800 and 390×844;
   Tab reaches New Game/Create/Join/Map Studio/Settings, and the narrow menu scrolls.
2. A profile with a stale default token: root remains a menu, Resume is absent,
   saved bytes remain, and no game socket opens. With a valid token, Resume
   appears; select it and confirm the same match/seat or the existing active-seat
   waiting behavior. Direct expired `?resume=1` must not allocate another seat.
3. New Game: click repeatedly during pending creation; one fresh AI room loads
   with new room/match identity and fresh seeds. Back to menu, then New Game
   again: a second fresh room, with neither old game reset.
4. Create Room: a new waiting PvP lobby. Open its invite in a second profile;
   Azure/Ember review, both ready, host launch. Refresh either room page and
   verify normal recovery. Main Menu/Leave return to root without resetting.
5. Join: reject cross-server/invalid/expired links. Cancel a delayed lookup;
   it must not navigate later. A valid code enters its actual existing room.
6. Map Studio: a separate fresh room opens the editor as Azure; publishing
   affects that room. Back/menu and active reconnect preserve draft behavior.
7. Settings at root: change speed, edge scroll, sound and volume. Start a game
   and verify those values. Other music/voice/effects mix choices stay intact.
8. Back/forward through menu and game: no frozen pending buttons, duplicate
   socket or unexpected default match. Record actual focus, Enter, layout,
   loading/error and unaided discoverability findings separately from DOM checks.
9. In a local browser run, intercept a session/room response with HTTP 401,
   then restore normal responses and reload/retry. See sign-in guidance rather
   than expiry/JSON errors; the same saved Resume target remains. Repeat a
   session check with HTTP 503: retry Resume, with no fresh room or game peer
   created during the interruption. Keep browser observations separate from
   the automated HTTP/VM evidence above.

No visual polish milestone, extra civilization/allied team capacity, deletion of
old saved data, authentication setting change or Railway deployment is claimed.

## Lab map selection and one-player Practice — 3 October 2026

The reported deployed source `00ff45d9702dfbcf9da6f6ac88e0ca4381e374dc` and
current base `d503d90b7e7ff1c0ae7c760fdb9ca7140753cc73` both reproduce:
New Game creates seeded PvE on Millrace/Rootways; `selectMap` rejects a lab with
`PLAY VS AI MAP IS LOCKED FOR THIS MATCH`. This is a launch-identity guard, not
proof that the selected map's terrain is incompatible. Create Room permits the
lab but refuses launch with only Azure ready. The two-browser workaround is
verified on both sources: Create Room, choose Lab · Frontier Materials, Copy
invite to a second profile/tab, ready both seats and launch. Reproduction logs
are `/tmp/rts-lab-lock-{baseline,current}.log` with harness
`/tmp/rts-lab-lock-repro.mjs`.

The AI chooser has a second UI defect: its `hidden` attribute is true, but the
author stylesheet's `.map-picker { display:flex }` overrides the browser's hidden
rule. Actual stylesheet computation on `00ff45d` reproduces `display:flex`;
the bounded `src/pve-entry.mjs` hidden rule produces `display:none`. A regression
also checks that Practice retains visible map/Studio controls. These are CSS/DOM
results, not native screenshot evidence.

The follow-up exposes **Practice** directly at root. It creates a separate
`{mode:"pvp",practice:true}` room. Existing map/army/Map Studio controls apply;
the scenario clock starts with one connected seat. It does not add an AI
commander, unlock a seeded AI room or claim AI eligibility for untested maps.
The existing validated catalogs, two-seat authority, checkpoint recovery and
custom-map publication contracts remain. `practice` persists in the room index;
its worker flag is cleared from all other room launches and cannot be combined
with pregame/PvE. The actual server state supplies the Practice notice on entry
and Resume. AI rejections now point to Main Menu → Practice.

The owning PR records final source/release checks, independent review and exact
deployment/native results. Runtime scope is `src/room-launch-options.mjs`,
`src/game-entry.mjs`, root buttons in `index.html`, the narrow `applyState()`
notice in `src/main.js` and the practice clock/state/AI-feedback hooks in
`server.mjs`, plus the fixed-AI hidden rule in `src/pve-entry.mjs`. No map,
resource, wildlife, stone or naval files are changed.
The room/entry owner retains acceptance; the parent owns staging deployment
coordination and native QA. A source merge does not close this reported bug.

Native recipe on the identified deployed revision, with normal browser sandboxing:

1. Ordinary root → Practice. Open Match Controls; the notice explains one-player
   testing without an AI commander. Battlefield/army controls are usable.
2. Select Lab · Stone Defense Field, then another lab. Confirm the loaded map,
   authored army, visible resources and normal Worker orders. Mine/return a
   legal resource using that map's existing depot rules. Verify timed/capture
   behavior on a scenario map with only this player connected.
3. Rematch, reload, then Main Menu → Resume: retain the same room/seat and
   Practice route. A separate New Game still starts a seeded AI match.
4. AI map/army attempts keep their guard and explain the Practice route. Create
   Room still requires both seats ready. Check keyboard and narrow-menu layout;
   capture the ordinary Practice button and started map for actual browser QA.
