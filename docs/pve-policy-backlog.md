# Opponent AI: ranked work and mode boundary

[Current gameplay evidence](qa-pve-regroup-2026-10-03.md) · [Observation/command contract](gameplay-command-observation-contract.md) · [Roadmap](roadmap.md)

Owner: Opponent AI workstream. Keep each change small, independently reviewed,
and owned through allowed merge, integration and appropriate acceptance. No
omniscience, resource grants, external gameplay API costs or independent deploy.
This backlog is a working queue, not a combined PR or a claim of game quality.

## Ranked backlog

| Rank / state | Next outcome and concrete action | Write boundary | Dependency / acceptance |
| --- | --- | --- | --- |
| 1 — contract-dependent | Explicit Skirmish target policy: pursue observed enemy recovery sources rather than capture victory posts. Complete the bounded target/visibility tests below, then integrate the approved identity. | New `src/pve-skirmish-targets.mjs`, minimal mode branch in `src/pve-opponent.mjs`, dedicated tests and AI evidence. One agreed observation adapter hook if needed. | Mode owner `01a103cc` supplies exact public `matchModeId`/version/legacy contract. Both-seat paid native assault/recovery, deterministic full matches, reset/restart, and unchanged Objective Control traces precede advertising Skirmish AI support. |
| 2 — acceptance retained | Close ordinary-game acceptance for regroup #137 using the existing New Game recipe; verify source bytes, actual wipeout, paid regroup/advance, screenshots and room telemetry. | Existing PvE QA/PR137 and PR148 acceptance records; no policy expansion. | Coordinated QA supplies the identified browser session and room-scoped evidence. Implementation owner retains interpretation and fixes. Latest supplied staging is `32f11d5`; prior local checks/matrix do not establish ordinary browser acceptance. |
| 3 — investigate after #1 | Reproduce a genuinely unreachable tactical target with another reachable observed target, then decide whether capped retries need bounded target rotation. Current retries cap their interval, not their count. | AI target helper/test only; navigation belongs to its owner. | A deterministic physical failure with paid economy must justify a fix first. Acceptance measures resumed pressure, bounded orders and no hidden-route knowledge. No speculative rewrite. |
| 4 — test after #1 | Exercise long Skirmish producer loss, Worker/Farm recovery and paid recruitment through depletion/rebuild. Fix only the first reproduced policy failure. | AI production/recovery modules and tests; shared economy/price/server code excluded. | Effective Skirmish rules and first target policy must exist. Stock+cargo+bank+spending reconcile; both seats finish the authored recovery case and replay exactly. Existing recovery tests remain the floor. |

## Current capability and observed target gap

At inspected main `4467986fe15b6595d0929ba0d63306473687a356`, the policy
already gathers, spends for production/research, replaces Workers, replants finite
Farms, rebuilds producers, scouts, recruits counters, directs Siege at visible
defenses, answers visible home raids and regroups after a combat wipeout.
The policy/recovery files are unchanged from the verified regroup implementation.

PR158 head `a63046e3475b8b9cc8064429da7b5060840518e9` names current authored
victory rules and proposes mode separation; it does not introduce a working mode
identity or change the server, AI, maps or default. Its proposal makes Skirmish
recovery-aware elimination and retains Objective Control's authored capture rules.
The mode owner owns those rules, launch/lobby/checkpoint wiring and default choice.

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

## Smallest proposed target slice

Add one bounded helper selecting a Skirmish frontline target from the assigned
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

One agreed public hook is required: either the mode identity in the filtered
state → observation adapter, or an authoritative policy configuration boundary.
Do not choose both or guess a wire format before the mode owner supplies it.

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

## Concrete contract still needed

- Canonical identity values, version field/shape and authoritative policy input.
- Missing identity in old observations/checkpoints and unknown-version handling.
- Whether Skirmish retains reward posts/events and which maps/seat setups it supports.
- Identity behavior on new room, mode change, map change, rematch and checkpoint restore.
- Which owner edits the state/observation bridge; this AI workstream owns policy/tests.

The implementation is dependency-stopped at this boundary, not awaiting parent
approval. Independent probes/design continue; default selection and simulation
victory rules stay with the mode owner. Regroup's original match remained a loss;
one Woodland comparison changed a baseline 504.1-second win to a 900.1-second
authored draw. Those limitations remain part of acceptance.
