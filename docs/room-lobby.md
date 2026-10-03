# Pregame invite rooms

[Player guide](playing.md) · [Architecture](architecture.md) · [Testing](testing.md)

**New room** opens a PvP pregame lobby. Copy the invite for a friend. Azure is
the host; Ember is the other player. The host chooses a map from the room's
actual catalog and can select 250, 500, 1,000 or 2,000 total starting units.
Selecting a different map uses its authored starting army unless a preset is
explicitly supplied. A small authored opening appears with its actual count.
The 2,000 preset is an existing diagnostic setting, not a supported-scale claim.

Both players review the settings and select **Ready**. Only the connected host
can **Launch match**, after both connected seats are ready. Changing map, army
size or participants clears everyone's readiness. Disconnect/reconnect also
requires readying again. **Not ready** withdraws a player's acknowledgement.
The match does not advance movement, combat, production, capture or scenario
events until launch. **Leave room** exits to the shared battlefield.

The current game supports two opposing seats using the Frontier gameplay
faction. There are no selectable civilization rulesets, allies, additional
player seats. Presentation previews do not change this capacity.
PvE remains the existing separate **Play vs AI** flow; a lobby's mode cannot
change after creation.

## Room chat

The two connected seats can exchange plain text in **Room chat** before launch.
Messages use the room's Azure/Ember seat identities; spectators can read them but
cannot send. Chat does not alter settings, readiness or the simulation. A send
racing launch either arrives before the transition or rejects once play starts.
Rematch reveals the same room conversation again.

Each message allows up to 240 characters. A seat can send five messages in ten
seconds; reconnecting to that seat does not reset the limit. The server retains
the latest 32 messages in memory and acknowledges recent same-seat retries
without appending another message. Clients retain draft text while reconnecting
or after rejection. Review the received history before resending a draft whose
delivery was interrupted.

Rejoining receives the current room history. A worker restart clears messages;
chat is not saved to match checkpoints, browser storage or an external service.
No account, custom display name, cross-room channel, game-time chat or moderation
service is added by this pregame slice. Existing immediate-play and solo rooms
retain their original entry paths.

## Recovery and rematch

The existing room-scoped resume token and seat grace period govern reconnects.
A disconnected host keeps Azure reserved during grace. Ember remains Ember;
there is no host election. After grace, a newcomer can fill the vacant Azure
seat using the existing admission rules. An occupied/reserved seat, including
a second connection using an active resume token, is a spectator and cannot
configure, ready or launch. Existing active-token recovery notification remains.

Disconnects during a running match retain the current running/recovery behavior.
Running matches allow the existing vacant-seat joins and spectators. A recovered
running checkpoint stays running; a recovered pregame stays waiting with all
readiness cleared. Checkpoints retain phase and settings without persisting
ready acknowledgements or adding bearer tokens.

The host's reset/rematch action returns opted-in matches to the lobby with
fresh units and no readiness. Repeated reset while already waiting is harmless.
Map and size changes use lobby controls; reset first to choose another match.
Map Studio is available after launch. A successful publication returns both
players to the lobby for the new map. Publication blocks concurrent lobby
transactions until it finishes, including across a host reconnection.

Existing invite rooms, the shared battlefield, solo rooms, and API room creation
without the pregame flag retain their prior flow. No process/proxy/session
architecture is replaced.

## Protocol and persistence

POST `/api/rooms` accepts `{ "mode": "pvp", "pregame": true }`. The supervisor
persists this optional flag in its existing version-2 room index and passes
`RTS_PREGAME=1` to the isolated worker. Inherited flags are cleared for legacy
and PvE workers. PvE rejects the pregame field. The normal New room UI sends
the opt-in flag; existing API callers default to immediate play.

| Command | Fields and authority |
| --- | --- |
| `configureLobby` | `revision`, optional catalog `mapId`, optional supported `armySize`; connected Azure only, while waiting. Unknown, invalid or stale settings reject atomically. |
| `setReady` | `revision`, boolean `ready`; the connected sending seat only. |
| `launchMatch` | `revision`; connected Azure only with both seats ready. A repeated accepted launch at that revision is an acknowledgement, not a second reset. |
| `sendLobbyChat` | Bounded `clientMessageId` and plain `text`; connected Azure/Ember only while waiting. No sender fields or unknown fields are accepted. |

The sending peer supplies identity; command payloads cannot choose a player ID
or team. Settings and connection changes increment the revision and invalidate
ready. Ready toggles do not increment it, allowing independent clients to
acknowledge the same settings. Launch commits synchronously in the worker before
any asynchronous persistence. A racing unready either blocks launch or arrives
after the committed running phase and rejects. There is no intermediate phase.

Welcome/state packets include a `lobby` projection for opted-in rooms, and
`lobby` packets broadcast changes. The projection contains phase, revision,
map/count, supported mode/faction, actual map catalog, seat ID/team/connection/
ready and `canLaunch`. It contains no session tokens. `lobbyRejected` includes
the current projection and an actionable reason so clients recover from stale
input. Existing `rts-v1` and `rts-resume` subprotocols remain.

Checkpoint schema 22 adds `state.pregame` as `null` or `{phase, revision}`.
Schema 21 migrates to `null`; older migrations retain their existing order,
including schema-19 ordinary resources and schema-20 fishing compatibility. An older saved running
match with an opt-in launch flag recovers as running, never as a new lobby.
An opted-in checkpoint also preserves its phase if an index rebuild loses the
creation flag. Invalid pregame shapes reject through existing checkpoint
quarantine/fresh-match handling.

Opted-in welcome packets also contain separate `lobbyChat` history. Accepted
`lobbyChat` packets contain the bounded `messages` and authoritative
`ack: {playerId, clientMessageId}`; a duplicate is acknowledged only to its
sender. `lobbyChatRejected` carries that request's identifier and reason.
History is absent from the high-frequency state projection and checkpoints.
Retry/rate records stay with the existing seat ID during its grace period and
are discarded after replacement. The latest 64 accepted IDs per seat are
remembered for retries; this is a bounded window, not permanent exactly-once
delivery across old-ID reuse or worker restart. No checkpoint schema changes.

## Verification

`node --test scripts/room-pregame.test.mjs scripts/room-lobby-ui.test.mjs scripts/room-launch-options.test.mjs`
checks authority, atomic validation, identity/readiness changes, duplicate launch,
checkpoint phase/readiness and DOM controls. `node scripts/room-pregame-scenario.mjs`
uses the real supervisor, independent native WebSocket clients and temporary
storage to verify freeze, both-seat configuration, stale messages, spectators,
launch races, rejoin, phase recovery, publication, rematch and host replacement.
Keep the existing supervisor, PvE, expiry and checkpoint regressions alongside it.
These checks do not establish native browser appearance or unassisted usability.
Chat authority/DOM regressions are in `scripts/room-lobby-chat.test.mjs` and
`scripts/room-lobby-chat-ui.test.mjs`; `scripts/room-lobby-chat-scenario.mjs`
checks real two-room isolation, authoritative senders, read-only spectators,
retry/rate behavior through rejoin, launch ordering, rematch and ephemeral
restart. [Chat evidence](qa-room-lobby-chat-2026-10-03.md) records its build and
native-browser limits.
The [3 October evidence](qa-room-lobby-2026-10-03.md) records exact integration
builds, results and remaining review/browser limits.
