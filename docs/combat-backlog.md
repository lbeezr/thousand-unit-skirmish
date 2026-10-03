# Combat and stances workstream

Owner: combat implementation task from source thread
`01a0f784-c5d7-72e0-82e8-1747b4c840c1`. Keep each correction small and independently
reviewed. The owner retains simulation, source integration and runtime acceptance;
parent coordinates staging/Mac support and the separate HUD/animation owners.

## Ranked next work

| Rank | Concrete outcome / evidence | Next action and acceptance | Write boundary / dependency |
| --- | --- | --- | --- |
| 1 | Four authoritative stances and idle self-defense, PR #159. [Exact simulation evidence](qa-military-stances-2026-10-03.md): 201 checks, paid native Archers, Defensive return restart and schema-23/24 recovery pass; normal HUD and identified deployed acceptance remain open. | Integrate the [stable stance contract](military-stances.md), identify the deployed source, and exercise both-seat normal controls, mixed selection, Stop/Hold, retreat, repeated kills and recovery. Retain exact source/deployment evidence and distinguish actual HP damage from animation. | Combat owner: server/stance tests and fixes; [HUD owner](hud-controls-backlog.md): client controls; parent: staging/Mac coordination. Normal-client work depends on HUD integration and an identified deployed build. |
| 2 | Stand Ground/Hold crowd displacement, route-outside-leash candidate starvation, and permanently suppressed defense after paid-wall return blockage were reproduced during PR #159 review and fixed with paid regressions. | Keep these regressions in the acceptance floor; replay any user report against the actual command/obstacle/stance ledger before proposing another change. No remaining server failure is claimed from these resolved cases. | Authoritative combat only. Coordinate with the pathing owner before changing shared planner/waypoint helpers. |
| 3 | Attack pose/arrows usability is still unverified here because Chromium sandbox startup fails. Actual firing/damage works in native checks. | Animation owner compares authoritative shot tick/target position and actual displacement against displayed pose/heading on the identified user build. Combat owner fixes only a confirmed protocol or server event defect. | Renderer/animation write scope belongs to that owner; combat does not duplicate it. Mac/rendered observation is a dependency. |

After the first outcome closes, select a reproduced combat correctness issue from
its accepted command ledger. If none exists, retain the acceptance floor and
report the unresolved downstream dependency instead of inventing a redesign.

## Fixed simulation outcomes

- PRs #154/#157: enemy-click focused military Attack reacquires visible local
  enemies after target loss; ground Attack Move resumes its destination.
- PR #159: persisted stance commands and private generation-aware snapshots;
  aggressive idle defense, bounded Defensive response/return and blocked-return
  fallback, stationary Stand Ground/Hold and explicit-focus-only No Attack.
- Worker pursuit PR #125's legal current-waypoint completion remains unchanged.
  Default ground click remains ordinary Move; balance and fog rules remain intact.

## Research invariants applied narrowly

Read the supplied Library report `vaelora_rts_combat_source_study.md`, version 1,
`libfile_2712969d7268819186d61ad22ad22998` (359 lines). Its source-linked design
guidance informed the explicit-order/stance/temporary-engagement boundary,
fixed anchors, revision-based replacement, nonrecursive bounded reacquisition
and failed-candidate cooldown. The report is not game verification and none of
its third-party implementation was imported. Firing/presentation work stays
with the animation owner rather than expanding this slice.

## Shared check failures

The pre-fix `d503d90` baseline failed
`shore-fishing-placement.test.mjs:30,126` because generated JSON omits the shipped
Vaelora siltmouths landscape-v2 audio reference, and
`shore-fishing-authoring-scenario.mjs:90` because the catalog name fails
`/Lab.*SHORE FISHING/`. These are concrete shore/audio owner work routed through
the parent, not waived combat checks. Current integrated main `9feda661` repairs
the authoring audio fixture. Final integrated main `75fe5df3` also repairs the
catalog-label expectation; all seven placement checks and the native authoring
scenario now pass. See exact
[stance integration evidence](qa-military-stances-2026-10-03.md).
