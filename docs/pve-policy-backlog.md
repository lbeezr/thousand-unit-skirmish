# Opponent AI: ranked work and mode boundary

[Regroup evidence](qa-pve-regroup-2026-10-03.md) · [Skirmish source evidence](qa-pve-skirmish-targets-2026-10-03.md) · [Mode contract](match-mode-contract.md) · [Roadmap](roadmap.md)

Owner: Opponent AI workstream. Keep each change small, independently reviewed,
and owned through allowed merge, integration and appropriate acceptance. No
omniscience, resource grants, external gameplay API costs or independent deploy.
This backlog is a working queue, not a combined PR or a claim of game quality.

## Ranked backlog

| Rank / state | Next outcome and concrete action | Write boundary | Dependency / acceptance |
| --- | --- | --- | --- |
| 1 — source merged / ordinary acceptance retained | Explicit Skirmish policy pursues observed enemy recovery sources using the saved authoritative identity. Finish identified ordinary entry/fog/recovery/rematch/reconnect play before capability enablement. | AI policy/adapter/tests; runtime [PR200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200) supplies schema-27 identity. Server/default/capabilities remain with mode owner `01a103cc`; existing staging/QA owners coordinate delivery. | [PR195](https://github.com/lbeezr/thousand-unit-skirmish/pull/195) and [PR212](https://github.com/lbeezr/thousand-unit-skirmish/pull/212) merged. [Canonical receipt](qa-pve-mode-adapter-2026-10-04.md): four map/seed cases reach elimination and exactly replay through a 600-second cold restart. Both-seat/map legal army and producer losses recover through a paid replacement, cold foundation restore and five-unit advance. Ordinary served observations remain open; keep `pveSupported: false`. |
| 2 — acceptance retained | Close ordinary-game acceptance for regroup #137 using the existing New Game recipe; verify source bytes, actual wipeout, paid regroup/advance, screenshots and room telemetry. | Existing PvE QA/PR137 and PR148 acceptance records; no policy expansion. | Coordinated QA supplies the identified browser session and room-scoped evidence. Implementation owner retains interpretation and fixes. Latest supplied staging is `32f11d5`; prior local checks/matrix do not establish ordinary browser acceptance. |
| 3 — source merged / acceptance retained | Rotate an obstructed public capture goal after 60 seconds without approach, occupancy, capture or combat; retry it after a temporary 120-second cooldown. Verify ordinary served-build obstruction/rematch behavior after coordinated delivery. | `src/pve-objective-rotation.mjs`, minimal ranked-target hook and paid tests/evidence; navigation remains with its owner. | [PR203](https://github.com/lbeezr/thousand-unit-skirmish/pull/203) merged in `89772d6f`; [matched evidence](qa-pve-objective-rotation-2026-10-03.md) proves a paid intact wall ring, same-checkpoint baseline timeout at 360 seconds and candidate wins at 107.6/109.7 seconds across cold restart. 112 focused checks, independent eight-check review and 38 postmerge checks pass. Ordinary browser acceptance remains open. |
| 4 — physical proof / ordinary recovery retained | Verify Worker/Farm depletion, paid recruitment and defense/reform during the identified ordinary Skirmish session; fix only a reproduced policy failure. | AI production/recovery modules/tests; shared economy/price/server code excluded. | [Canonical paid loss proof](qa-pve-mode-adapter-2026-10-04.md#paid-loss-recovery) completes both seats/maps with intact Workers, paid rebuilt producer/recruits, cold restore and exact replay. Stock+cargo+bank+spending reconcile. Ordinary recovery observation remains open; existing Worker/Farm/defense checks remain the floor. |

## Current capability and observed target gap

At inspected main `4467986fe15b6595d0929ba0d63306473687a356`, the policy
already gathers, spends for production/research, replaces Workers, replants finite
Farms, rebuilds producers, scouts, recruits counters, directs Siege at visible
defenses, answers visible home raids and regroups after a combat wipeout.
The policy/recovery files are unchanged from the verified regroup implementation.

The merged [mode contract](match-mode-contract.md) defines `authored@1`,
`objective-control@1` and `skirmish@1`; missing both identity fields preserves
authored behavior and partial/unknown pairs reject. Skirmish retains reward
posts/events but removes their victory flags, win holds and deadlines. The mode
owner owns simulation, launch/lobby/checkpoint wiring and default choice.

A current-policy observation probe runs both seats × seeds 0/20260925/4294967295
× three post states, repeating every history and duplicate observation (18 cases):

- A neutral reward-only post draws an attack-move to its center while a completed
  enemy Barracks is already visible nearby.
- Once the reward post is owned, the ordinary army emits no base-assault order.
- With no post and only a visible producer, fallback still targets map center,
  because it selects enemy units and ignores buildings.

These are policy decisions from valid observed records, not physical-match,
Skirmish implementation or fun/balance evidence. Full probe/trace artifacts are
retained by this workstream. The existing objective-presence early return is why
merely stripping victory flags while retaining reward posts is insufficient.

## Bounded target slice and integration input

One bounded helper selects a Skirmish frontline target from the assigned
seat's current observation, after reconnaissance, home-defense and regroup have
reserved their units. Existing paid economy/production remains independent.
The approved explicit Skirmish identity selects this branch; absent/legacy or
Objective Control identity retains the current target behavior exactly. Do not
infer mode from trigger count/flags, `pvp`/`pve`, map name or a client label.

Prioritize currently visible completed land-unit producers (Town Center,
Barracks/Range/Stable/Workshop), then observed surviving recovery-capable land
units; use stable distance/identity tie breaks. Producer eligibility comes from
shared public definitions, never enemy bank/queue/technology. Destruction of a
Town Center is pressure, not an AI-declared defeat. Foundations/other structures
can be secondary targets; the mode's authoritative recovery predicate owns
victory. Exact priority within producers/Workers remains measured tuning.

Use ordinary generation-bound `attackBuilding` for a visible structure and
`attack`/`attackMove` for eligible visible land units. Preserve engaged/recently
attacking units when retargeting, and reuse bounded retry/progress tracking.
Drop an unseen/dead target rather than issuing invisible entity commands.
Scout reconnaissance continues. If no enemy target is visible, a small bounded
frontier search must derive only from own positions, map dimensions and the
filtered visibility mask; no enemy spawns, raw terrain or hidden checkpoint data.
No full terrain planner, generalized enemy memory or siege/economy rewrite.

The source input is `createDeterministicPolicy(seed, matchMode)`, where
`matchMode` is the exact pair accepted by `matchModeDefinition`. Missing both
means legacy authored. The ordinary socket adapter still calls it without the
pair, so this source slice does not advertise or silently launch Skirmish PvE.
The next bridge must take the effective authoritative identity on welcome,
reset/map change and restore, then recreate the configured policy. Coordinate
that small adapter edit with the mode owner; no new observation schema is needed.

## Bounded test design before implementation

1. Extend the 18-case probe into both-seat, three-seed target tests: neutral and
   owned reward posts plus a visible producer must prefer the visible recovery
   target only in explicit Skirmish. Legacy/Objective Control command traces
   must remain identical. Test dead/friendly/unfinished/water-only producers,
   deterministic ties, target visibility loss, combat preservation, duplicate
   snapshots, capped retries, arriving reinforcements and reused generations.
2. Visibility metamorphism: construct the same filtered seat observation while
   changing hidden enemy units/buildings/banks in the authoritative fixture.
   Commands must be byte-identical. No remembered unseen ID can receive attack.
   Unknown-base search is bounded and must discover through actual movement.
3. Use `pve-headless-fixture.mjs` with the mode owner's effective rules on a
   small fogged map, both ordinary starting rosters and finite home resources.
   Both sides gather/build/train through normal commands. A controlled enemy
   Barracks is paid and completes; its footprint becomes visible through legal
   movement. Capture a reward post, then prove renewed producer pressure rather
   than idle occupation. No unit, HP, position or bank injection.
4. Checkpoint during an assault and after a real army loss; restore and recreate
   policy from the approved mode identity. Compare every command/notice/event
   and authoritative terminal state from two runs of each initial checkpoint.
   Check food/wood conservation and that defending/rallying troops remain
   protected. Require a bounded full elimination/recovery result, not just a
   producer damage sample; cap the test run and report a timeout honestly.
5. Follow with a small matched full-map comparison on the same engine/checkpoint
   and ordinary deployed New Game acceptance after coordinated delivery. Record
   mode, source, map/seeds, first contact/production/producer-loss/result times,
   rejected orders, recovery and strategic costs. Do not equate wins with fun.

## Remaining runtime acceptance

The source configuration and paid producer regression are independent of the
pending runtime bridge. The shipped-map restart proof is dependency-stopped at
the mode owner's canonical identity/checkpoint integration: the current server
correctly rejects a changed shipped map hash. Do not work around that guard.
Full-map Skirmish readiness still needs exact restarted replays, army/producer
loss recovery, ordinary two-seat launch/reset, coordinated deployment and actual
in-game verification. Default choice stays with the mode owner.

Regroup's original match remained a loss;
one Woodland comparison changed a baseline 504.1-second win to a 900.1-second
authored draw. Those limitations remain part of acceptance.
