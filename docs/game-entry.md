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
  The optional **Practice rules** disclosure chooses a supported mode before
  creation. Authored Rules is the default with lab access; explicit Objective
  Control or Skirmish starts on the server's configured compatible map. The
  button describes the chosen mode's compatible-map limit before starting.
  A temporary status failure keeps that choice. If the server withdraws it,
  Practice waits for an explicit supported replacement rather than silently
  changing the rules. Creation sends the complete displayed mode/version pair,
  including Authored Rules, so a later fresh-room default cannot replace it.
  The disclosure displays the starting map's projected tier and exact dimensions
  when available; it does not invent playable choices for future tiers.
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

The pregame host chooses **Victory mode** from the server's compatible catalog.
Objective Control keeps that map's authored capture, hold and deadline rules;
Skirmish uses recovery-aware land-force elimination and keeps capture posts as
bonuses. Both players see the summary and expandable **Win condition** before
readying. Configuration waits for the server, whose acceptance clears readiness.
A map needing authored rules labels that change in its option and submits the
map/mode together. Guests cannot change settings; unsupported mode versions block
Ready and Launch with a reload instruction. There are still two Frontier seats.

Match Controls displays the active mode and win condition during play. This is
read-only: the runtime has no running-match mode-change command. Ordinary
Practice starts with authored rules and retains its lab map access; Practice
rules can instead choose an explicit mode before creation. New Game
retains its supported AI setup; this UI does not offer Skirmish against AI.
When the server projects map tiers, choices display its label and exact dimensions;
a restored current legacy map remains visible but cannot be selected afresh. The
160-minimum catalog/default migration belongs to the runtime/map slices and is
not inferred from a UI label or an unverified unit-capacity field.

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

## Continuing entry and room backlog — 4 October 2026

The room/entry owner retains these outcomes. This ranked queue is scoped to
normal entry, reconnect, pregame rooms and match lifecycle. New code follows a
reproduced failure; blocked native acceptance does not require speculative features.

| Rank | Outcome and current evidence | Next action and acceptance | Write boundary and dependencies |
| --- | --- | --- | --- |
| 1 | Practice is selectable for solo lab testing. [PR #155](https://github.com/lbeezr/thousand-unit-skirmish/pull/155) merged at `32f11d5`; clean release includes it. Read-only staging deployment `e541d903-178b-47cb-8d1b-4358c93c5a8a` is SUCCESS at descendant `64cc391`, containing Practice and the page-exit fix. All 13 lab maps, one-seat clock, restart/rejoin and Worker deposit have protocol evidence. Parent reports local Mac use at `0fb9a3d`: ordinary Practice launched with one connected player and all 13 lab choices enabled; map switching and gameplay lost connection before verification. Parent evidence: `libfile_72f4553247b8819189e2fa2cb7207394` (menu), `libfile_360335437dd08191b09e94856b3bca0b` (report). These are supplied observations; deployed native use remains open after a staging 401. | Parent/native-QA owner completes ordinary root → Practice → Stone Defense Field → resource order → reload/Resume on the identified deployed source, retaining the partial local evidence. Room/entry fixes any entry failure and closes acceptance only after that observation. | Entry/launch modules and narrow server/main hooks if a failure demands them; no map/resource edits. Native browser availability and the parent-owned staging/user environment are the remaining dependency. |
| 2 | The departed-menu navigation race is fixed by [PR #169](https://github.com/lbeezr/thousand-unit-skirmish/pull/169), merged at `9b173dc`. Exact source passes 56 focused checks, 13 real-menu groups/101 delivered modules, restart/recovery/gathering, docs502/3,358 and the runtime import audit. A clean 1,127-file release is retained in its PR closure. Staging source `64cc391` includes the fix by verified ancestry. | Observe delayed creation/Join/Resume → Back/page exit → return/new choice natively on the identified deployment. Retain the existing accepted-server-creation/idle-expiry behavior. | Runtime change is three lines in `src/game-entry.mjs`; tests/this guide complete source delivery. No server/checkpoint/mode change. Native observation remains with the parent receiving owner; this lane retains fix-forward work. |
| 3 | [PR #198](https://github.com/lbeezr/thousand-unit-skirmish/pull/198) binds host pregame mode choices, normal Practice pre-creation choice and read-only Match Controls summaries to the [contract](match-mode-contract.md). Runtime [PR #200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200) is merged. Two real DOM/socket lobbies prove shared Skirmish acceptance, readiness, invalid-version rejection and atomic authored-map fallback. Real menu creation/restart proves the selected Practice pair and saved-seat recovery. Merged at `ce5e4dfe` after independent review. Exact-merge checks pass 159 focused tests, 16 two-client groups, 14 menu groups and a clean 1,169-file package. Capability-refresh choice preservation has dedicated regressions. Staging `64cc391` contains the runtime but precedes this UI. | Verify identified deployment and actual Practice mode choice/one-seat play/reload plus host/guest mode choice → Ready → launch → reset/rejoin. No running mode switch or PvE Skirmish claim. Default authored Practice and all current labs stay available until replacement catalog migration. | Own mode/Practice controls, lobby/main/index/entry presentation, focused/protocol tests and exact static paths. Narrow `room-supervisor.mjs` status projection reads configured canonical-map capabilities without admission or process changes; runtime owner `01a103cc` retains simulation/checkpoint/protocol. Map owner `01a103e8` publishes tier fields in [PR #202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202); UI consumes projected labels/selectability/current-legacy fields, while ordinary catalog/default migration and <160 PvE behavior remain runtime/map-owned. |
| 4 | The authoritative two-seat lobby, chat, host departure/grace, ready invalidation, launch races, rejoin and rematch have focused/protocol evidence; an unassisted complete invite match remains unproven. | Run Create Room → second-seat invite → settings/Ready → launch → disconnect/rejoin → result → rematch. Record the first concrete confusion/failure with source, map and both-seat state, then choose its smallest fix. | Own lobby/entry modules; coordinate any server/main hook before overlap. Depends on actual two-client native use, not a new account/chat service or extra engine seats. See [room contract](room-lobby.md) and [gameplay QA](qa-vertical-slice.md). |
| 5 | A one-seat Practice match incorrectly shows `WAITING FOR PLAYER 2`, reproduced through the actual presentation function at `a01abce`. The clock already runs. Merged PR #198 corrects it to `PRACTICE LIVE` / `SOLO PRACTICE` using authoritative state, with the actual presence function covered by regression. | Retain this correction in the cohesive entry/mode UI slice and verify it on the identified deployed Practice path. Active-seat recovery and ordinary two-seat waiting keep priority and their current labels. | Existing `src/main.js` Practice-state/presence hooks and `room-presence.mjs`/test; no wire or simulation change. Roster, wildlife and order hooks remain disjoint. Native status observation joins rank 1 acceptance. |
| 6 | Terraced Vale is authored at 160 × 160 in merged [PR #202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202). The required ordinary minimum is 160 on both axes. Terraced Vale is the ordinary Tiny Skirmish preset. The shipped Small Threefold Basin is size-eligible with Authored Rules and registered for human Skirmish in merged [PR #242](https://github.com/lbeezr/thousand-unit-skirmish/pull/242). Medium/Large remain future authored tiers and XL is validator-blocked. Runtime [PR #229](https://github.com/lbeezr/thousand-unit-skirmish/pull/229), merged at `966dc0a5`, now binds fresh ordinary Skirmish to Terraced Vale and enforces the 160-side catalog/admission floor. Internal Practice keeps compact Labs and Authored Rules. The follow-up entry slice sends every displayed Practice mode pair explicitly and consumes projected starting-map tier/dimensions. A lobby regression preserves a disabled legacy current map and atomically chooses an offered Tiny map/rule tuple. A real supervisor configured with the existing RTS_MAP points fresh root-menu Practice at Tiny, runs its clock with one seat and preserves the seat/match/mode through restart and strict Resume. This configured-path proof does not establish ordinary default/catalog migration or rendered acceptance. | Retain current-source Tiny creation/readiness/launch/reset and internal Practice checks, then verify identified deployed/native use. The Stone regression separately checks compact-Lab rejection preserves an ordinary Tiny lobby and that explicit Practice retains the full natural two-seat paid/recovery loop. Keep legacy recovery and internal labs separate from fresh ordinary choices. Do not infer adoption from labels or add empty larger-tier choices. | Runtime/map owner `01a103cc` owns server/registry/default/projection in the [receiving contract discussion](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975028585). Entry owns Practice controls, lobby/main presentation and consumer tests. The receiving contract now publishes `internalFixture`, exact tier/dimensions/selectability and paired defaults; consume those fields and preserve historical restore semantics. Native/deployment acceptance remains parent-owned, with entry fix-forward responsibility. |
