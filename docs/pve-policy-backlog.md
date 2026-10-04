# Opponent AI: ranked work and mode boundary

[Regroup evidence](qa-pve-regroup-2026-10-03.md) · [Mode contract](match-mode-contract.md) · [Roadmap](roadmap.md)

Owner: Opponent AI workstream `01a10297`. Keep changes small, independently
reviewed and owned through allowed merge and appropriate acceptance. No hidden
information, resource grants, external gameplay API costs or independent deploy.
This queue records source evidence separately from ordinary-game acceptance.

## Current source, admission and served boundary

Ordinary development PvE is admitted for Terraced Vale Tiny Skirmish only,
through mode-owner [PR250](https://github.com/lbeezr/thousand-unit-skirmish/pull/250).
Medium remains human-only; its unfinished diagnostic games do not authorize
fresh AI entry. Registry/runtime owner `01a103cc` retains admission and normal
human defaults; the AI lane changes neither. The
[normal process/reconnect/rematch proof](qa-pve-tiny-process-recovery-2026-10-04.md)
passes paid foundation, queue and reset recovery. Actual rendered Tiny
entry/fog/recovery/rematch acceptance remains open.

Parent-reported served revision is
`53a47ee379660f30b65776ea813f3a986d29aa37`. Git ancestry confirms it contains
merged [PR255](https://github.com/lbeezr/thousand-unit-skirmish/pull/255)
(`a510ea78`) and [PR281](https://github.com/lbeezr/thousand-unit-skirmish/pull/281)
(`41e30deb`). This is a supplied served identity plus source ancestry, not a new
deployment call or verification of rendered play at that build. Deployment is
paused. Central staging `01a10227-2c6d` retains deployed acceptance; map/human
owner `01a103e8` retains independent rendered balance evidence.

The [Sheep-map search receipt](qa-pve-sheep-search-2026-10-04.md) retains PR255's
matched fixes and historical 2705/1564-second results. Subsequent
[unknown-ground coverage](qa-pve-medium-search-2026-10-04.md), merged in
[PR277](https://github.com/lbeezr/thousand-unit-skirmish/pull/277), produces
Tiny eliminations at 2739/602 seconds. PR281 preserves every Tiny decision in
both native seed assignments. Its
[bounded long-route receipt](qa-pve-progress-retention-2026-10-04.md) demonstrates
missed unknown-ground discovery 27 seconds past the old fixed expiry, retains
moving original cohorts only on eligible Small-or-larger routes, keeps stall
escape and caps a selected goal at 180 seconds. Source, recovery and exact replay
checks pass; these measurements do not establish balance or rendered acceptance.

PR281's paired Medium games exactly repeat one Azure elimination at 2925 seconds
and one ongoing game at 3600 seconds, with zero rejected commands. Earlier
Medium pairs with both games unfinished remain historical evidence. Full-game
qualification is open; do not infer general completion from the single win or
change a victory timer to close the queue.

## Ranked backlog

| Rank / state | Next outcome and concrete action | Write boundary | Dependency / acceptance |
| --- | --- | --- | --- |
| 1 — full-suite failure under investigation | Resolve the reported Millrace production timeout from clean full-shard source `d8f10423`; distinguish a production/regroup regression from execution timing using the original failure's final tick and commands. | AI policy/scenarios and [owned reproduction receipt](qa-pve-millrace-production-2026-10-04.md); preserve production/regroup assertions and their budgets. | Unchanged isolated live runs pass at `d8f10423` and `cade7c8b`: paid units by 58.1/54.1 simulation seconds, Azure advance at 169.1. Native traces also pass. Original CI payload is requested from code-quality/CI owner `01a10378` on [PR296](https://github.com/lbeezr/thousand-unit-skirmish/pull/296); no policy cause or full-suite fix is claimed. |
| 2 — merged Tiny source / rendered acceptance open | Observe ordinary Tiny entry, fog, paid economy, wipeout recovery, reconnect and rematch at the identified served revision. Preserve PR255/277/281 source proofs. | Existing Tiny AI/QA receipts; registry, server and fog remain with `01a103cc`, map with `01a103e8`. | PR281-qualified native Tiny cases exactly repeat elimination at 2739/602 seconds, and every PR281 decision equals the prior qualified policy. Real process recovery passes. These CPU/process results do not close actual rendered play, pacing or balance. |
| 3 — bounded Medium improvements / qualification open | Diagnose a concrete weakness in the remaining unfinished paired game before any further policy change; retain both assignments and cold restore. | AI policy/tests and Medium QA; authoritative server, maps, economy and admission excluded. | PR272 paid zero-Worker recovery, PR277 coverage and PR281 progress retention are merged. One final game remains ongoing at 3600 seconds. Medium stays human-only; admission is owned by `01a103cc`, human rendered balance by `01a103e8`. |
| 4 — authored rotation merged / served acceptance open | Observe obstruction escape and return through the ordinary served objective-control path. | `src/pve-objective-rotation.mjs` and existing paid evidence; navigation remains with its owner. | [PR203](https://github.com/lbeezr/thousand-unit-skirmish/pull/203) at `89772d6f` rotates after 60 seconds without approach, occupancy, capture or combat, with temporary 120-second cooldown. Its [matched wall-ring proof](qa-pve-objective-rotation-2026-10-03.md) wins at 107.6/109.7 seconds across cold restore versus a 360-second baseline timeout. Rendered acceptance remains open. |
| 5 — paid recovery source / ordinary observation open | Observe Worker/Farm depletion, paid recruitment, home defense and reform; fix only a reproduced policy failure. | AI production/recovery modules and tests; shared economy/price/server code excluded. | [Canonical paid loss proof](qa-pve-mode-adapter-2026-10-04.md#paid-loss-recovery) covers both seats/maps, rebuilt producer, recruits, cold restore and five-unit advance. Native Farm cost is 60 wood; normal policy minimum is 85 including reserve. No resource grants. |

## Current capabilities and regression floor

The policy gathers, spends for production/research, replaces Workers, replants
finite Farms, rebuilds producers, scouts, recruits counters, directs Siege at
visible defenses, answers observed home raids and regroups after a wipeout.
It uses owned and disclosed state, stable identities and bounded retries.

The identity/checkpoint bridge and explicit Skirmish target branch are merged in
[PR195](https://github.com/lbeezr/thousand-unit-skirmish/pull/195) and
[PR212](https://github.com/lbeezr/thousand-unit-skirmish/pull/212), with runtime
[PR200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200).
`createDeterministicPolicy(seed, matchMode)` takes the authoritative saved pair;
the socket adapter supplies it on welcome/reset/restore. Missing both identity
fields preserves legacy authored rules; partial or unknown pairs reject.
Skirmish pursues currently disclosed recovery sources rather than authored post
victory. The authoritative mode owns defeat, rewards, capture holds and timers.

The earlier `4467986f` probe found neutral-post preference, idle occupation after
ownership and a map-center fallback despite a visible producer. Those 18
observation-only cases motivated the now-merged target branch; they are not
current defects. [Canonical source and paid recovery evidence](qa-pve-mode-adapter-2026-10-04.md)
records four native map/seed eliminations with exact restore at 600 seconds,
fresh policies and paid loss recovery. Historical measurements retain their
source/map identities rather than qualifying later revisions.

Keep hidden-input equivalence, visible-target legality, original cohort
generations, combat/defense/regroup protection, bounded frontier coverage,
paid resource conservation, exact native cold restore and rematch as the floor.
No terrain oracle, generalized hidden enemy memory, engine rewrite or speculative
AI architecture is part of this workstream.

Regroup's original match remained a loss; one Woodland comparison changed a
baseline 504.1-second win to a 900.1-second authored draw. These limitations and
the unfinished Medium game remain open alongside the successful source checks.
