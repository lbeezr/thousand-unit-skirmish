# Pregame lobby validation — 3 October 2026

[Lobby contract](room-lobby.md) · [Testing](testing.md)

Local integration build `2daee48e23c5f8a0067fd79bd99a7643d4c3f685` includes fork
main `90ad32009861a32fbada5e579606db3fe293731c`. A follow-up changes only the
fishing scenario's expected checkpoint schema to follow its initial current save.
Runtime code and unit-test inputs are identical.
Draft [PR #41](https://github.com/lbeezr/thousand-unit-skirmish/pull/41) owns the
current head, independent review, integration and subsequent evidence.

Final runtime integration `5e174291a24381a4c068ec60a109c1bb6c585880` also includes
fork main `d34c1a18c7e0ba865e19907a2fbaf868b17fa0e4` (the neutral Sheep renderer).
All 418 unit tests pass with zero failures/skips. The two-client lobby scenario,
legacy supervisor recovery/protocol scenario, real-worker wildlife render
scenario and packaged release scenario pass again.
The complete served client import graph and 31 UI assets pass their packaged
delivery checks. Documentation passes 413 Markdown files / 2,704 local links.
The clean release contains 1,016 files, digest
`sha256:e70fa7063375458ad7d484f4f2f7473c7da6bbb6389f1f2bdcd9c6bae86b55c2`.
The results below retain the prior integrated runtime's recovery evidence.

## Results

| Check | Observed result |
| --- | --- |
| `node --test scripts/*.test.mjs` | 414 tests pass, zero failures/skips. Includes lobby authority/DOM/launch contracts, camera/rematch/build recovery, private snapshots, fishing, wildlife, facing, wall planner, import audit and CI sharding. |
| `node scripts/room-pregame-scenario.mjs` | Real supervisor and independent native WebSockets pass all 11 grouped checks below. Temporary storage; no deployed service. |
| `node scripts/room-supervisor-scenario.mjs` | Room isolation, clean restart/SIGKILL recovery, both-seat production/session recovery, malformed-save fallback, custom maps/index preservation and protocol limits pass on integrated schema 22. |
| `node scripts/pve-room-launch-scenario.mjs` | Seeded solo map/opponent reservation, rematch seeds/map and new-generation gathering pass. |
| `node scripts/room-expiry-scenario.mjs` | Pending joins retain room/maps, expired upgrades reject before worker launch, expired capacity is reclaimed. |
| `node scripts/shore-fishing-scenario.mjs` | Both seats deposit finite fish food, land Workers stay off water, the sole food pool is conserved, cargo/depletion/restart/rematch and schema-20 recovery pass. |
| `node scripts/ruleset-checkpoint-scenario.mjs` | Schema-11 migration, ruleset pinning/rejection and both-seat stable wire metadata pass. |
| `node scripts/production-lifecycle-scenario.mjs` | Producer destruction cancels pending production/research, resumable construction charges once, population reservations release and existing 2,000 diagnostic cap checks pass. |
| `node scripts/timed-event-scenario.mjs` | Existing timed/capture/event delivery and reset replay pass with schema 22. |
| Documentation | 411 Markdown files / 2,693 links pass before this evidence-only addition. |
| Runtime admission | Served import audit passes 65 client modules; Docker context admits 31 existing UI assets. New lobby JS/CSS return 200 with correct MIME; server-only pregame module returns 404. |
| Clean local release package | 1,012 files; digest `sha256:645cb75bfe5d62fd46ebbb8be1a06db318145f4c68b4b1fa5c2541c652087f38` at `2daee48`. Includes pregame authority, UI and CSS through the existing `src/` COPY; no packaging rewrite. |

The focused lobby, UI and launch tests contribute 12 passing cases. The protocol
scenario covers:

1. Host-only supported map/settings; invalid settings reject atomically.
2. Movement, spawn capture and opening supply remain frozen before launch.
3. Configuration changes clear both readies; stale ready revisions reject.
4. Ordinary and active-token spectators cannot configure, ready or launch.
5. Pregame and running phase/seat identity survive supervisor restarts;
   readiness clears, and a legacy-index rebuild does not discard the saved phase.
6. A real two-socket unready/launch race respects worker serialization;
   duplicate accepted launch delivers only one opening supply and never resets.
7. Running guest resumes its stable seat; a newcomer during grace spectates.
8. Host Map Studio publication returns the new map to waiting configuration.
9. Rematch clears readiness; duplicate waiting reset does not change revision.
10. Host disconnect clears readiness, rejoin keeps identity, expired host
    replacement gets a new identity, and Ember is never silently promoted.
11. Expired-token late join and actual public asset delivery retain their contracts.

## Limits and handoff

Native Chromium could not start: the installed SUID sandbox helper is not
configured correctly (exit 134). No `--no-sandbox` or other sandbox bypass was
used. DOM and authoritative HTTP/WebSocket checks establish behavior, not native
browser appearance, full focus/input integration, or unassisted usability.

No deployment, credential/security-setting changes, paid calls, external chat
service, new simulation civilization or additional player/team capacity is
established by this work. Existing 2,000-unit diagnostics are not a supported
scale claim. Shared renderer/fishing/art imports, their static admission, and
the ordered schema 19→20→21→22 migrations are preserved.

Independent peer review remains pending at this checkpoint. The supplied
reviewer thread `01a101a8-d970-7540-aae2-633aa37b000b` was not addressable by
the delegated environment's collaboration tool (agent not found); the user's
subsequent Petunia suggestion also resolves to no live agent in this environment.
The author retains responsibility for review findings, guarded
merge and postmerge checks. No additional workers were spawned and no review
or repository protection was bypassed.

## Closed PR and postmerge checks

[Independent review](https://github.com/lbeezr/thousand-unit-skirmish/pull/41#pullrequestreview-5401055373)
at exact head `218e53cfba6041ba8fe247bcde302fbda495541c` found no blockers. It
independently reran all 418 unit tests, the two-client lobby, ruleset and fishing
scenarios, and probed suspended map publication with the real command handler.
The shared-account COMMENT records independent agent review, not a separate
account's formal GitHub approval.

PR #41 merged normally with an expected-head guard as
`ffdc9a78f36f48d2b64a72de57d320388674a672`. On an isolated checkout of that exact
merge: all 432 unit tests, all 11 pregame scenario groups, the complete legacy
supervisor recovery/isolation/protocol scenario, packaged release/import/art
and 31 UI asset checks pass. Documentation passes 414 files / 2,707 local links.
The merge tree equals the separately checked current-main candidate tree.
The clean local release contains 1,017 files, digest
`sha256:7ba363acba3c029126eea91fc0284964b0a8e00ed3fc40442d409396449b8001`.
[Closure comment](https://github.com/lbeezr/thousand-unit-skirmish/pull/41#issuecomment-5969790482)
retains the results and the separate Mac appearance/focus/input follow-up.
No deployment or cloud sandbox bypass was performed.
