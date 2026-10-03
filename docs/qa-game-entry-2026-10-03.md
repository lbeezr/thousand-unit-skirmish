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

No visual polish milestone, extra civilization/allied team capacity, deletion of
old saved data, authentication setting change or Railway deployment is claimed.
