# Main menu and deliberate match entry

[Player guide](playing.md) · [Pregame rooms](room-lobby.md) · [Testing](testing.md)

The ordinary root URL opens the main menu. It does not load the renderer or
connect a WebSocket, even when this browser has an old player token. The menu's
room-service lookup and optional session check do not allocate a player seat.

The menu's [existing-art composition](game-menu-art-study.md) adds a decorative
Worker/Barracks vignette beside the choices. It uses the working title and
existing shipped images, with no additional controls or game-state meaning.
Narrow and short layouts reduce the art to keep entry choices nearby.

- **New Game** creates a fresh seeded Play vs AI room on Millrace or Rootways.
  Its map and authored army remain fixed for that match.
- **Practice** creates a fresh room for one-player testing. Open Match Controls
  and choose any **Battlefield**, including lab maps. Movement, economy, capture,
  timed events and rematch run with one connected player. There is no AI commander;
  enemy units retain their normal combat behavior. Map and army controls stay
  available to Azure. A friend may join Ember, but a second seat is not required.
- **Create Room** creates a fresh Frontier 1v1 pregame lobby; share its invite.
- **Join Room** accepts a same-server invite or valid room code.
- **Resume** appears when the most recently played room's locally saved token
  is still recognized by the server. Older default-battlefield tokens remain
  eligible. Resume is checked again when selected.
- **Map Studio** creates a separate fresh PvP workspace and opens the editor
  after the server admits its Azure host. It does not publish into an old game.
- **Settings** changes camera speed, edge scroll, audio enablement and volume
  using the existing browser preference keys. Other audio mix values remain.

New Game and Create Room use the existing room API, never reset a loaded match.
Map Studio uses an immediate-play isolated room so its existing host editor is
available. There are still only two opposing Frontier seats. Existing in-match
Play vs AI, New Room, invitation, rematch and authoring controls retain their roles.

Invite URLs with `?room=` enter that room directly; refresh retains the same
entry and existing seat-token recovery. Returning through **Main Menu** or
the lobby's **Leave room** opens `/`; it keeps saved tokens and server data.
Back/forward restoration closes the old connection and resumes through the
existing connection path when returning to a game. Creating/back/cancelling
an unfinished menu request cannot silently navigate later.
Page exit invalidates pending creation, Join and Resume choices immediately,
including responses that settle before back/forward restoration. Returning to
the menu rechecks availability and permits a new explicit choice. A room creation
already received by the server may still finish; existing room expiry handles it.
Invites and room-changing actions remove entry-only Resume/Studio flags so a
friend or fresh match is admitted through the ordinary room path.

Explicit `?resume=1` requests the existing session (with `room` when applicable).
The game checks it before admission; an expired session shows **SESSION EXPIRED**
and offers the in-match Main Menu link. Existing active-match reconnects remain
unchanged after successful admission. Explicit `?play=1` retains the legacy
shared-battlefield entry for diagnostics; authored renderer links retain their
existing deliberate preview/capture entry. None is required for ordinary play.

An interrupted server sign-in shows **SIGN-IN REQUIRED** with a reload instruction,
and opens no game socket. The menu preserves saved tokens and any already validated
Resume choice. A temporary server failure also keeps Resume available to retry;
only a successful invalid-session result or missing room is treated as expiry.
New Game always creates a separate fresh room; it never replaces a failed Resume.
Practice also creates a separate room; returning through Resume keeps its map,
progress and ordinary saved-seat recovery. Create Room retains its two-ready
pregame launch gate. An AI map-change rejection directs players to Main Menu →
Practice rather than pretending an unsupported AI map can be selected in place.

## Authority and delivery

GET `/api/session`, optionally with `room`, inspects the existing token sent
in `x-rts-resume-token` and returns only `{valid: boolean}` with `no-store`.
Tokens stay out of URLs and responses. Existing HTTP authentication and room
proxy boundaries apply. The check does not create sessions or change readiness.
Unknown/expired rooms reject; worker startup follows the existing recovery path.
It does not replace the supervisor, checkpoints, admission or grace period.

The initial Resume WebSocket uses `resumeOnly=1`; an unrecognized token rejects
with HTTP 409 before peer allocation. An active token still uses the existing
temporary spectator/retry mechanism. A vacancy race therefore cannot turn an
expired Resume into an unrelated newly allocated seat. Ordinary room joins keep
the existing admission behavior. No checkpoint migration or data wipe is added.
Existing idle-room expiry still applies to invite data.

`game-entry.mjs` is the HTML module entrypoint and loads `main.js` lazily for
deliberate game routes. The packaged import audit starts there and follows
literal dynamic imports as well as static dependencies.

## Continuing entry and room backlog — 3 October 2026

The room/entry owner retains these outcomes. This ranked queue is scoped to
normal entry, reconnect, pregame rooms and match lifecycle. New code follows a
reproduced failure; blocked native acceptance does not require speculative features.

| Rank | Outcome and current evidence | Next action and acceptance | Write boundary and dependencies |
| --- | --- | --- | --- |
| 1 | Practice is selectable for solo lab testing. [PR #155](https://github.com/lbeezr/thousand-unit-skirmish/pull/155) merged at `32f11d5`; clean release includes it. Staging deployment `29d74cac-b078-4a88-8f2a-e3141a2f9465` is SUCCESS on that exact source, Online with one running/zero crashed replicas. All 13 lab maps, one-seat clock, restart/rejoin and Worker deposit have protocol evidence. Native use is still open. | Parent/native-QA owner runs ordinary root → Practice → Stone Defense Field → resource order → reload/Resume on the identified deployed source and records actual screen/input evidence in the linked PR. Room/entry fixes any entry failure and closes acceptance only after that observation. | `game-entry.mjs`, launch/entry modules and narrow server/main hooks if a failure demands them; no map/resource edits. Native browser availability and the parent-owned staging/user environment are the remaining dependency. |
| 2 | A delayed New Game/Practice/Join/Resume result can navigate after the player leaves the menu, reproduced at `4467986`. | Invalidate the old choice on page exit. Regression must reject late navigation for ordinary unload and back-cache exit, then permit a new explicit Practice choice after return. A real delayed HTTP creation must also preserve existing peer counts and the server's ordinary expiry contract. Independently review, merge, package and observe the delayed-response path on an identified user build. | `src/game-entry.mjs`, `scripts/game-entry.test.mjs`, `scripts/game-menu-scenario.mjs` and this guide. No server, room index, checkpoint, token or mode-schema change. Entry owner owns delivery; native observation uses the same receiving QA owner as rank 1. |
| 3 | The authoritative two-seat lobby, chat, host departure/grace, ready invalidation, launch races, rejoin and rematch have focused/protocol evidence; an unassisted complete invite match remains unproven. | Run Create Room → second-seat invite → settings/Ready → launch → disconnect/rejoin → result → rematch. Record the first concrete confusion/failure with source, map and both-seat state, then choose its smallest fix. | Own lobby/entry modules; coordinate any `server.mjs`/`main.js` hook before overlap. Depends on actual two-client native use, not a new account/chat service or extra engine seats. See [room contract](room-lobby.md) and [gameplay QA](qa-vertical-slice.md). |
| 4 | Existing `pvp`/`pve` launch kinds and authored victory rules are distinct. [Mode-owner PR #158](https://github.com/lbeezr/thousand-unit-skirmish/pull/158) documents a separate match-mode proposal; no new mode or civilization choice is implemented by this queue. | Read the owner's final `matchModeId`/legacy-save contract before wiring any new room setting. Proceed only when a concrete supported mode and compatible default are agreed; until then preserve Frontier 1v1 and current seeded AI choices. | Mode owner retains schema/simulation rules. Room/entry would own only corresponding launch/lobby controls and protocol tests after interface agreement. No dependent code action is justified yet. |
