# Room capacity, preservation and operator recovery

[Entry guide](game-entry.md) · [Deployment](deployment.md#recovery-and-backups) · [Configuration](configuration.md)

The room-lifecycle owner retains this change through review, integration,
identified staging delivery and normal Practice admission. The motivating
observation is staging source `3fe971fe9acf1c3c31a14fca514013749dd5f5e9` on
11 October 2026: Practice refused entry with ten retained rooms against a cap of
eight. The cap had been temporarily raised for separate QA runs, then restored
without removing their rooms. At 19:35 UTC all ten were within the configured
six-hour idle window (zero to 216 minutes idle). This was mostly intended
retention occupying admission capacity, rather than ten actively played matches.
One active audio room was deliberately reused. No unknown rooms were deleted.

## Behavior

`RTS_MAX_ROOMS` continues to cap **retained invite rooms**, including rooms whose
worker has not started. Lowering it preserves existing rooms and blocks fresh
creation until enough slots become available. Existing invites and valid seat
resumes remain usable while full. Practice, AI, pregame and Map Studio all
allocate one retained room. Main Menu/Leave disconnects the client but preserves
the room; reset/rematch and changing a Practice battlefield reuse that room.

Connected clients and admitted pending joins protect a room. The idle window
begins at creation or latest gameplay connection/activity/disconnection; HTTP
lookups and session checks do not renew it. Worker exit, deployment shutdown
and checkpoint writes are not player activity. Previously worker exit renewed
the timestamp, extending idle retention after session probes or deployments.
Socket teardown during shutdown also no longer renews it. Actual connections
continue to keep the room alive, including a spectator or open background tab.

Due idle rooms are **archived**, including on startup and before fresh admission,
as well as during the minute sweep. They release a slot and their old invite
stops admitting players. Archiving stops an idle worker so it flushes its
checkpoint, then atomically moves its directory on the same volume from
`room-data/rooms/ID` to `room-data/archived-rooms/ID`. Checkpoints, custom maps,
quarantine files and launch metadata are retained. No automatic deletion or
archive retention deadline is introduced. Archives consume disk space: include
them in volume backups and monitor volume usage. Any later deletion requires a
separate deliberate operator retention decision.

Restoring moves the directory back with the **same invite ID**, map, match and
launch identity, reserving a free room slot first and starting a fresh idle
window. It does not reset a checkpoint or extend expired player seat tokens.
Existing seat grace/recovery rules still apply: an old seat may be unavailable
even though the match remains intact. An archive never reappears merely because
the active index is rebuilt. Restore metadata preserves launch identity if the
process stops between the directory move and active-index persistence. Conflicting
directories or unreadable metadata are preserved for operator inspection.

## Player guidance

At capacity, use **Resume** if offered or **Join Room** with an existing invite.
Use that match's rematch or Practice battlefield controls for another test.
Creating a new room repeatedly consumes more slots. Leaving a room does not
release its slot immediately. Close every tab connected to an unused room and
wait for idle expiry, or give its invite to the server operator to archive it.
An archived invite needs operator restoration and a free slot. No player-facing
close-room control or permanent creator/account ownership is claimed here.

## Operator controls

These routes use the existing operator Basic authentication even when public
gameplay is enabled. POST also enforces the existing origin policy. An invite
code alone is not authority to archive or restore a room. No new credentials,
provider settings, public management routes or room-limit increases are needed.

| Request | Result |
| --- | --- |
| `GET /api/admin/rooms` | Retained rooms with connection/pending counts, worker state, activity/deadline and launch metadata; archives with their time/reason and metadata validity. Contains private invite codes, never seat tokens. |
| `POST /api/admin/rooms/ID/archive` | Preserves an exact idle room and releases its slot. Refuses connected/pending/already-archiving rooms with 409; never disconnects a player. |
| `POST /api/admin/rooms/ID/restore` | Restores an exact archive if capacity permits. Full returns 429; retained/restoring returns 409; missing returns 404. |

Use the [operator client](../scripts/manage-rooms.mjs) with credentials injected
through the existing secure runtime (`RTS_ACCESS_PASSWORD`, optional
`RTS_ACCESS_USER`). Do not paste credentials into commands or logs. For example,
in that authenticated environment:

```sh
node scripts/manage-rooms.mjs list https://game-staging-21f9.up.railway.app
node scripts/manage-rooms.mjs archive https://game-staging-21f9.up.railway.app ROOM_ID
node scripts/manage-rooms.mjs restore https://game-staging-21f9.up.railway.app ROOM_ID
```

Keep the inventory private; public QA notes should contain counts and observations,
not invite codes. QA owners should record the exact room they created privately,
reuse it for sequential checks, then close its clients and archive that room
through an authorized operator. Do not infer ownership from a map name. This
preserves source maps and failed-run evidence for later restoration. For legacy
rooms whose owner is unknown, retain them or make a concrete operator decision
to archive; never guess which directory is disposable.

Read back inventory after each operation. If a storage/index write fails after
the atomic move, a 503 does not prove nothing happened: inspect retained and
archived state before retrying. Never manually move a directory while its worker
is running. Recovery moves and metadata validation do not certify that a historic
checkpoint is compatible with every future server version.

## Scope and acceptance

Write scope is the supervisor, private archive adapter, focused native/storage
regressions, operator client, import/CI registration and the owning guides.
Visual-development backing is N/A: this is lifecycle behavior and correction
of an existing text error, using the existing menu treatment. No accounts,
ownership-token scheme, arbitrary room browser or automatic pressure eviction
is added. Existing six-hour protection is unchanged; active or recently idle
matches are not evicted just to make a new room fit.

`scripts/room-lifecycle-scenario.mjs` uses the real menu DOM, supervisor and native
WebSockets with disposable data. It covers authenticated controls, foreign-origin
refusal, connected/archive races, unchanged idle timestamps through shutdown and
session probes, Practice creation after archiving, concurrent restore/create
capacity reservation, exact checkpoint bytes, map/match/seat recovery, index-loss
recovery, and non-destructive startup/admission-time expiry. The existing expiry
scenario retains the paused pending-join boundary and now checks preserved data.
`scripts/room-archive-store.test.mjs` covers seeds/identity, conflicting destinations,
storage failures, malformed metadata and traversal rejection.

These local results do not establish browser pixels or staging delivery. The
audio owner's [bounded roster run](https://github.com/lbeezr/thousand-unit-skirmish/actions/runs/38167751445)
and necessary completion pass currently prohibit staging replacement. Source
work and review proceed; inspect the run and current owner evidence before a
main merge or any deployment. The room-lifecycle owner retains exact release,
deployment and actual hosted admission/recovery verification once that window ends.
