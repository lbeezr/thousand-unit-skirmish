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
