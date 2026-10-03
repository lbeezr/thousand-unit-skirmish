# Playable modes workstream

[Roadmap](roadmap.md) · [Mode contract](match-mode-contract.md) · [Victory audit](victory-modes-audit-2026-10-03.md)

Owner: playable-modes workstream. Keep each delivery small and independently
reviewed; retain runtime/release/actual-play acceptance after merge. The parent
approved recovery-aware Skirmish, bonus-only posts, unchanged Objective Control
timers and legacy recovery. Ordinary Skirmish waits for compatible AI and entry.

| Rank | Outcome / next action | Write boundary and dependencies | Acceptance |
| --- | --- | --- | --- |
| 1 | Finish existing victory clarity deployment and ordinary acceptance. [PR #158](https://github.com/lbeezr/thousand-unit-skirmish/pull/158) merged at `65f2e67`; inspect the served revision and run ordinary Millrace/Elimination matches. | Clarity already integrated. Deployment/read-only verification and dated QA. Existing staging integration; no credentials or bypass. | Forty focused checks, twelve native cases and package passed; independent review approved. Staging deployment `df65855c-57e3-4979-a345-1c7e83e90173` reached SUCCESS at source `0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739`, which contains clarity. Rendered ordinary-match acceptance remains open. Workspace proxy/browser failures are recorded. |
| 2 | Registry [PR #176](https://github.com/lbeezr/thousand-unit-skirmish/pull/176) merged; finish explicit human Skirmish runtime and lobby delivery. | Runtime owner: server/checkpoints, room launch and pregame model. Lobby owner `01a101c4` consumes the documented pair/catalog; no overlapping UI edits. Staging execution owner `01a10227-2c6d` coordinates the next build; runtime owner retains match acceptance. Canonical maps and existing elimination predicate stay intact. | Real-map projection/capability checks; then identical two-seat settings/readiness, bonus capture without win, no deadline win, defeat/recovery, rematch/restart and preserved legacy matches. Human selectable first; ordinary default unchanged. |
| 3 | Implement accepted base-elimination AI and enable supported Skirmish PvE; only then consider ordinary default adoption. | AI policy [PR #195](https://github.com/lbeezr/thousand-unit-skirmish/pull/195) merged; parent-assigned AI owner retains full-map and ordinary-entry acceptance. Consume `matchModeId`/version and `aiStrategyId`; policy modules and normal entry/map capability integration. Coordinate server hooks locally. | Bot builds/recruits, pursues enemy units/producers under lawful fog, defends/reforms and finishes recovery-aware defeat. Native normal games and reset/reconnect; actual identified served PvE matches. Stop chasing capture posts as the win plan. |
| 4 | First original reinforcement/evolution mode, working name provisional: one-core human 1v1. | Separate registered mode/compact map after rank 2. Waves/death-credit/tier state, bounded native rules and lobby/HUD path. Reuse existing units; no hero systems, imported assets or paid services. | Control recurring capped waves, earn one visible evolution, destroy a designated stronghold, simultaneous-core draw, no center victory, scoring once and checkpoint/rematch proof. Ordinary two-human play and pacing/entity observations before balance claims. |
| 5 | Evaluate fixed-path TD, then regional real-time territory; champion survival follows abilities/revive. | Research remains evidence, not an all-modes implementation. Cooperative modes require two-team/NPC ownership audit. Risk requires a canonical regional slice of one continuous RTS battlefield. | Pick one bounded playable contract when justified; full-world territory is a larger eventual outcome, not a quick capture variant. |

Do not lengthen all timers, add auto-spawning to ordinary Skirmish, silently
change stronghold loss into Skirmish defeat, or advertise unsupported AI. A
contract/tooling milestone uses its own focused checks; it does not invent game
deployment acceptance. Runtime items remain owned until actual play, or until a
concrete blocker and receiving owner are recorded.
