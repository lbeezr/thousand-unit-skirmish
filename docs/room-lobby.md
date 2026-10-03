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
player seats or room chat. Presentation previews do not change this capacity.
PvE remains the existing separate **Play vs AI** flow; a lobby's mode cannot
change after creation.

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

## Verification

`node --test scripts/room-pregame.test.mjs scripts/room-lobby-ui.test.mjs scripts/room-launch-options.test.mjs`
checks authority, atomic validation, identity/readiness changes, duplicate launch,
checkpoint phase/readiness and DOM controls. `node scripts/room-pregame-scenario.mjs`
uses the real supervisor, independent native WebSocket clients and temporary
storage to verify freeze, both-seat configuration, stale messages, spectators,
launch races, rejoin, phase recovery, publication, rematch and host replacement.
Keep the existing supervisor, PvE, expiry and checkpoint regressions alongside it.
These checks do not establish native browser appearance or unassisted usability.
