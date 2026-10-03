# Victory rules and mode separation

[Game bible](game-bible.md) · [Map catalog](maps.md) · [Testing](testing.md)

## Observation and scope

User playtest feedback, 3 October 2026: a race to the middle can finish in under
three minutes; fast capture is useful for a different, automatically reinforced
custom-game style, while the main fantasy RTS needs economy, bases and armies
to develop. Map/build were not supplied. This audit uses main `d063ad5`, after
the army target-reacquisition fix. It does not turn the reported time into a
measured balance result. Refreshed against main `32f11d5` before publishing;
the separate Lab/Practice entry fix is included in that base.

This slice names the **existing** authored rules in the normal objective strip
and brief, corrects the elimination explanation, and adds native recovery-edge
proof. Timers, authored map metadata, AI behavior, launch defaults and checkpoint
schemas are unchanged. The default proposal below is pending a shared decision.
The victory owner retains release/deployment and ordinary-match acceptance;
merge alone is not completion.
The [QA record](qa-victory-rules-2026-10-03.md) distinguishes local regression
evidence from the outstanding review/deployment/browser acceptance.

## Exact current rules

`mode: pvp | pve` describes player/opponent setup, not a victory mode.
`victoryMode: any | all` combines marked capture zones, not base defeat.
There is no independently selectable standard-base victory mode today.

| Trigger | Runtime behavior |
| --- | --- |
| Capture | A living-unit count meets `requiredUnits` and strictly exceeds the other team's count inside the zone for `captureSeconds`. Workers count. The capture loop does not filter water units. Every prerequisite must have the team's ownership at the start of the evaluation interval. |
| Ownership | Ownership persists after troops leave. A tie, an empty zone or enemy presence below the capture threshold does not neutralize it. Interrupted capture progress resets. Recapture requires the same capture rules and prerequisites. |
| Immediate `any` | With no hold, a newly completed marked capture wins. Opposing marked captures completed in the same evaluation do not choose a winner; the match continues. |
| Immediate `all` | With no hold, a completed capture wins only when one team owns every marked victory zone. |
| Hold | Positive `victoryHoldSeconds` replaces instant capture victory. Owning any/all marked zones arms the hold; subsequent evaluations accrue time after the scenario clock starts. Leaving zones does not reset ownership or the hold. Losing the required ownership resets it. Both teams completing an `any` hold in the same evaluation draws. |
| Deadline | `timedVictory.afterSeconds` awards the named zone's current owner the win; an unclaimed zone draws. An earlier result, including a capture/hold or elimination resolved on that evaluation, takes precedence. Presence or incomplete capture progress does not change the owner. |
| Elimination | Evaluated only when **no** trigger has `victory: true`, including maps with reward posts or a deadline. A team loses when it cannot still field land units; two unable teams draw. Marked objective maps disable this fallback completely. |
| Final result | Simulation actions and match clock stop. Result/reason persist; host reset starts a new match. |

Simulation is 30 ticks/second; capture/victory evaluation occurs every three ticks
(0.1 seconds). The display rounds countdowns up. None of these rules enforces
an economy-development phase before capture or a minimum match duration.

### Ordinary entry and map metadata

The main menu's New Game creates seeded PvE; Create Room creates a PvP pregame
lobby. Fresh PvP defaults to Bellweather Millrace; PvE selects Millrace or
Underbough Rootways by seed. Ordinary openings contain **24 total units**, split
into four Workers and eight Infantry per seat; each seat gets 150 food and
250 wood. Lobby manual army presets are larger stress openings, separately
from authored small openings.
The newly integrated Practice entry creates a solo room without an AI, unlocks
the existing map/army controls, and starts its clock with one player. It is an
opponent/entry choice; it still uses the selected map's authored win rules.

| Map family | Capture victory | Deadline |
| --- | --- | --- |
| Millrace and other regional maps except Rootways | Two outer posts, five units/nine seconds each; center eight units/twelve seconds, requiring both outer posts; own all three for twenty seconds. | Center owner at 900 seconds. |
| Rootways | Two outer clearings, five units/nine seconds each; own both for thirty seconds. Central Supply Grove: four units/twelve seconds, reward only and no prerequisite. | Supply Grove owner at 900 seconds, even though it is not a marked victory zone. |
| Forked Vale / Woodland Expanse | Same outer/center counts and timings as Millrace; all three for twenty seconds. | Center owner at 900 seconds. |
| Fortified Crossing | Same outer/center counts and capture timings; all three for thirty seconds. | Center owner at 900 seconds. |
| Three Crowns | Outer posts six units/eight seconds; center eight units/ten seconds, requiring both; all three for twenty seconds. | Heartland Keep owner at 900 seconds. |
| Frontier Reach | Any of three sixteen-unit/eight-second posts, held twenty seconds; 1,000 total opening. | None. |
| Highland Grove | Both sixteen-unit/eight-second posts, held twenty seconds; 1,000 total opening. | None. |
| Stone Pass / Cinder Ridge / Frontier Materials | One eight-unit post, immediate win after 3.5 / 4 / 4 seconds of capture. | None. |
| Open Field / Dense Clash / Shore Fishing / Stone Defense Field / Meshy Resource Review | No marked zones; existing elimination. | None. |

Regional maps include equal two-minute relief supplies, but they do not require
an army purchase or base expansion before victory. Their existing initial armies
can satisfy all capture thresholds. Lab identity describes map purpose, not a
different global win rule.

### Precise defeat and edge cases

`eliminationAliveCounts()` excludes water units. `canTeamStillFieldUnits()` keeps
a team in play if any of the following holds:

1. At least one land unit lives, including a Worker or Scout.
2. Its home Worker queue or any building queue contains a paid land unit.
3. It has capacity under population/roster limits, the resources and completed
   prerequisites for a land unit, and a completed friendly producer with a legal
   spawn cell. The home Town Center can qualify with an affordable Worker;
   expansion Town Centers and military producers can also qualify.

An empty intact base with insufficient resources can lose without every building
being destroyed. Storehouses, Houses, defenses and unfinished producers alone do
not keep a team alive. A surviving Worker keeps it alive even if it cannot afford
to rebuild. Destroying the home center with surviving Workers, military units,
an expansion or usable military production is not defeat. Destroyed production
loses queues without refunds. A surviving paid land queue qualifies even if its
exit is currently blocked; an **unpaid** producer with no legal exit does not.
Skiffs and Skiff-only queues do not qualify, although their roster/population
reservations can restrict remaining land production.

| Edge | Current behavior and consequence |
| --- | --- |
| Workers remain / Town Center can be rebuilt | Match continues under elimination; there is no requirement that a Worker can actually afford the rebuild. |
| No Workers, affordable complete producer | Match continues; the player must order production. Units are not automatically created. |
| Resignation / leaving | There is no resign command or result reason. Closing a tab disconnects; it does not surrender. |
| Zero or one human / no AI | Both armies exist from reset. Outside pregame, simulation and capture/elimination evaluate without two connected players. Ordinary PvP waits for two connected seats to start the scenario clock; explicit solo Practice starts with one. Instant capture/elimination can finish before that clock starts. |
| AI | Server-owned PvE activates its AI seat after the human joins, allowing the clock to start. The separate external OpponentAI adapter uses the same deterministic policy; it is not a new victory mode. |
| Disconnect after start | The scenario clock keeps advancing, including with no players connected; disconnect does not pause a hold or deadline. Supervisor expiry is retention/lifecycle behavior, not a draw rule. |
| Restored match | Saved map definition/hash, elapsed clock, clock-start flag, zone owners/progress, hold state and result are restored. A finished result remains finished; readiness is re-established for a restored waiting lobby. Changing a fresh-room default must not reinterpret these saved matches. |
| Stalemate | No inactivity, maximum-duration, shared-resignation or mutual-draw system. Surviving stranded Workers, blocked paid queues or unopposed objective ownership can keep a match open. Objective maps still have their authored deadline; elimination maps without a deadline can remain open indefinitely. |

## Smallest default proposal — pending

Keep **Skirmish** (economy/base/army development) and **Objective Control** (today's
fast capture race) explicit and distinct. Reuse the existing recovery-aware
elimination predicate for Skirmish rather than inventing a Town-Center-only loss
contract or extending every timer. In Skirmish, capture posts may retain their
existing rewards and event hooks, but their victory flags, hold and deadline
must not end the match. That reward choice requires an explicit product decision;
removing posts entirely is a larger map change.

Proposed new-room default: Skirmish, on the existing regional terrain and authored
small opening. Objective Control retains the current map rule values. Ordinary
match duration still needs human evidence; elimination alone does not guarantee
a long game or balance an early rush. No resignation or stalemate heuristic is
silently added. Those are later small contracts with dedicated recovery proof.

### Minimal extensible interface

Use a `matchModeId` separate from the existing opponent `mode`. A small registered
mode definition can contain identity/version, player-facing rule summary,
compatible map IDs or capabilities, supported seat counts, AI strategy support,
starting-setup policy and victory policy. Add economy/spawn/progression settings
only to the first mode that actually needs them. Resolve an effective rule set
at match launch; do not mutate canonical authored JSON or derive win policy from
an arbitrary display label.

Host mode changes use the existing lobby revision/readiness boundary. Supervisor
room metadata, worker launch options, lobby/map-change/state payloads, rematches
and checkpoints must carry the same effective mode identity/version. Persist
the resolved rules needed to restore exactly. Missing identity in old saves means
**legacy authored behavior**, including unusual elimination-plus-deadline maps;
it must never mean the new default. Unknown versions reject safely through the
existing checkpoint-retention path. No migration of in-progress matches.

Start with two explicit implementations: current authored Objective Control and
existing elimination Skirmish. Avoid a generic mode scripting language. A later
original auto-reinforcement mode gets its own bounded registered rules, map and
acceptance rather than inheriting either existing victory policy accidentally.
The existing bounded timed-supply event mechanism is worth inspecting first;
it is not already a permanent stream or a kill-based evolution system.

### Shared owners and release acceptance

The lobby owner `01a101c4` owns Lab AI-lock/entry changes; combat owner `01a103b7`
owns target reacquisition. This slice does not edit their lobby, entry, AI or
combat contracts. Only the brief's display integration touches `main.js`.
The parent coordinates the mode-field decision before overlapping changes.

`createDeterministicPolicy()` currently ranks enemy/unclaimed victory posts and
recently lost posts for its tactical objective. Its production, home-defense,
reconnaissance and fallback behaviors do not establish base-elimination support.
Skirmish PvE must choose enemy producers/bases, pursue under fog, finish an army/
base defeat, and recover its policy on reset/restart before becoming the ordinary
solo default. **AI support owner is unassigned** pending parent coordination;
this audit does not claim a ready standard-base AI mode.

Acceptance for the next gameplay slice: fresh menu/lobby identifies the mode;
both seats see identical settings; economy/base/army development and defeat work
in ordinary play; rushing/capturing the center cannot end Skirmish; Objective
Control still completes its original hold/deadline; reset/restart preserves the
selected policy; no-player/AI and stranded-unit cases are explicit. Verify the
served committed release and actual identified staging match, then record the
source revision, deployment revision, observations and remaining limits.

## Custom-inspired direction

Quick original modes are useful testing grounds while the longer sprawling RTS
develops in parallel. Do not equate CBA, Castle Blood or HeroFest from memory;
the user's one-castle, automatic-unit evolution recollection may be a different
variant. Dedicated research is forthcoming for AoE variants, Warcraft variants
and real-time Risk. This slice introduces no spawning cadence, kill threshold,
copied assets or third-party rules.

The parent's early research synthesis favors a first original one-stronghold,
free-wave army battle with kill-based evolution, rather than a full hero-ability
stack. A designated stronghold defeat and modest optional supply-point income
would be its own contract, distinct from Skirmish elimination and instant capture.
Fixed-path cooperative tower defense is a subsequent candidate; champion survival
depends on abilities/revive. Inspect all two-team and `enemy = 1 - team`
assumptions before adding allied players or NPC opponents. These are research
directions, not registered modes or selected balance values.

A future original reinforcement/evolution mode and a future territorial mode
remain distinct from center capture. For the fantasy-world territorial direction,
prove a representative regional territory slice with direct on-map battles before
attempting a massive world map. Separate tactical-match transitions are later
work. Research should identify one small fully playable first mode and its own
map/AI/player-count/victory/checkpoint contract before implementation.
