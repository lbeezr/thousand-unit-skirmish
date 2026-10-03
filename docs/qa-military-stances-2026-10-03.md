# Military stance simulation — October 3, 2026

Combat owner from source thread `01a0f784-c5d7-72e0-82e8-1747b4c840c1`
retains simulation, integration and gameplay acceptance. The
[HUD owner](hud-controls-backlog.md) implements ordinary controls from the
[stance contract](military-stances.md); parent coordinates staging/Mac support.

## Identified source and independent review

[PR159](https://github.com/lbeezr/thousand-unit-skirmish/pull/159) adds authoritative
Aggressive, Defensive, Stand Ground and No Attack without changing ordinary
ground-click Move or military balance. Tested revision:
`c852c7a74bec352ff31f9489fb4aab54dccb0334`, integrated with main
`9feda6617d227ad41e196a50e1ab3af9eb905528`.

Server SHA-256:
`fbe9b4315bc8e2eb3ab666f0e75a7e60c5c6aacb62678ba457bd4556515d9c64`.
Stance module SHA-256:
`cf62d9179301c0d1b45f9bb097008d1d6e80dbcf7ed01e740933dc964b9f9a74`.

Independent review reproduced and corrected crowd displacement of held units,
nearest-target starvation behind a wall, and a blocked Defensive return that
suppressed local defense indefinitely. Paid regression cases cover both seats.
Schema integration composes economy/map migrations, wildlife schema 24, then
stance schema 25; legacy schemas 23/24 retain routes, food and current wildlife
motion while preserving legacy passive idle military.

## Exact-source checks

| Evidence | Result |
| --- | --- |
| Focused combat, stance, flow fairness, geometry, Worker pursuit, movement/economy, paid wall/gate, parked Worker and migration tests | 201 passed, zero failed. All 50 stance cases included. |
| Native two-seat stance commands | All four accepted; Stand Ground does not chase; Defensive automatically pursues and returns; restart saved the actual return at tick 458, both seats finish at tick 510; Aggressive causes actual HP loss; Stop becomes passive. |
| Native three paid Archers per seat | Focused first targets die; second targets have 93/86 HP at restart tick 1473; all four targets reach zero by tick 1920 without new Attack orders; all six Archers retain 70 HP; Stop clears continuation. |
| Native typed economy checkpoint/recovery | Passed with schema 25. |
| Default Millrace Sheep migration/recovery | Passed: stock/cargo/identity conserved, current restart credits once and legacy state retained. |
| Packaged Railway release | Passed guarded startup, Basic Auth HTTP/WebSocket, module/asset inclusion and hashes, volume paths. |
| Origin proxy, import boundaries and strict checked JavaScript | Passed. |

Native runs use ordinary commands, paid production, real worker timing,
WebSocket admission and checkpoint recovery; no actor/HP/vision injection.
Artifacts retained in this executor: `/tmp/stance-schema25-native.json`,
`/tmp/stance-schema25-archer.json`, focused/release/economy/Sheep logs with the
same prefix. Reproduce the native ledgers with the environment variables
`MILITARY_STANCE_NATIVE_RECORD` and `ARMY_ATTACK_NATIVE_RECORD` and the
corresponding checked-in native scenario scripts.

The paid-wall topology fixture initially reported only 32/64 seat-1 arrivals:
the other 32 arrived, entered Aggressive idle combat near the opponent, then
died. Accepted generation-aware No Attack setup isolates the existing topology
assertions; all eight wall/gate cases retain 64 distinct goals and legal steps.
Worker pursuit's legal current-waypoint completion is unchanged.

The earlier broad CI shards were run across intermediate source updates and do
not establish a full exact-head CI pass. Their owned stance-return sampling and
incidental topology combat failures are fixed and pass above. The origin-proxy
check was rerun successfully after integration. Current main repairs the old
shore audio fixture: all seven placement checks now pass. The separate
`shore-fishing-authoring-scenario.mjs:90` catalog-label assertion still fails;
parent coordinates its shore owner. This is an explicit remaining shared check.

## Deployment and player acceptance still open

Read-only Railway state on 3 October at 23:04 UTC reports staging SUCCESS
deployment `df65855c-57e3-4979-a345-1c7e83e90173`, source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739`. Git ancestry includes the original
Attack continuation fixes PR154/157, but excludes this stance draft.
Production remains source `67b166748f6cc82c0a76319478f4475da1ab9083`.
These are platform-reported identities, not gameplay observations.

This executor's readiness probe was blocked by the proxy: HTTP CONNECT 403,
remote HTTP status 000. Chromium preflight reports `sandbox-unavailable`.
No deployment, authentication/security change or sandbox bypass was attempted.

Next acceptance requires the HUD controls integrated into an identified staging
build and an authorized working browser. Combat owner retains both-seat normal
Attack Move keyboard/toggle targeting, ground/enemy clicks, actual HP loss and
post-kill continuation, stance/mixed-selection behavior, retreat, Stop/Hold,
fog/leash/obstacles and recovery. Animation owner verifies pose/arrows against
authoritative firing; parent supports Mac/staging. The
[ranked combat backlog](combat-backlog.md) keeps these dependencies open.
