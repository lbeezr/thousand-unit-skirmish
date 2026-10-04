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

The parent verified staging deployment `c487990a` as `SUCCESS` at 14:50:50 UTC
on 4 October 2026, serving source
`1acaf9a46fd4d6ed71e1aa32a3f3543ea4a56ad3`, with 1/1 service online and
production unchanged. This supersedes the earlier supplied `53a47ee` receipt.
Git ancestry confirms the current served source contains
merged [PR255](https://github.com/lbeezr/thousand-unit-skirmish/pull/255)
(`a510ea78`) and [PR281](https://github.com/lbeezr/thousand-unit-skirmish/pull/281)
(`41e30deb`). This is the parent's infrastructure receipt plus source ancestry,
not an AI-owned deployment call or verification of rendered play at that build.
Independent AI deployment remains paused. Central staging `01a10227-2c6d`
retains deployed acceptance; map/human
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
| 1 — original-order shard pass; historical cause unproven | Preserve the reported timeout and completed CI rerun; investigate further only if it reproduces with a final-state payload. | AI analysis/[owned receipt](qa-pve-millrace-production-2026-10-04.md); preserve production/regroup assertions and budgets. | CI owner `01a10378` completed the original-order 368-check shard at `b96847b9`: 368 passed, 0 failed/unrun, including both-seat production. [CI receipt](https://github.com/lbeezr/thousand-unit-skirmish/pull/296#issuecomment-5982273952). This is one shard of 1104, not a full-suite or runtime-fix claim. Historical cause remains unproven; no duplicate collector. |
| 2 — merged Tiny source / rendered acceptance open | Use the now-qualified shared cloud capture interface for ordinary Tiny entry, fog, paid economy, wipeout recovery, reconnect and rematch at an identified source/served revision. Preserve PR255/277/281 source proofs. | Existing Tiny AI/QA receipts; registry, server and fog remain with `01a103cc`, map with `01a103e8`. | User reports actual packed-renderer qualification via [PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323). Tiny native and process recovery evidence still does not close its own ordinary rendered play, pacing or balance. Capture/served identity remains with shared capture/staging owners. |
| 3 — paid forest-income and bounded single-loss capability / sustained contest and general qualification open | Opponent AI `01a10297`: next use a separately qualified opponent for an unassisted both-seat contested replay; fix only a reproduced narrow policy failure. Preserve both full-game seed assignments and unchanged completion ceiling, then distinct ordinary process/entry evidence. | AI scenarios/policy and [single-loss recovery receipt](qa-pve-contested-wood-2026-10-04.md); minimal CPU replay transport hook only. Authority, forest jobs, movement, maps and admission remain with their owners. | [PR360](https://github.com/lbeezr/thousand-unit-skirmish/pull/360) proves paid depleted-Wood discovery/Gather/10-Wood deposit both seats/warm/cold. The next bounded case natively kills one active forester through ordinary visible Attack, pays 50 Food for a replacement and witnesses both that replacement's actual income and a new Wood-job deposit, with cold restore and 180s causal controls. Existing policy passes; no AI tuning. Forest `01a1072a`/PR341, Resource `01a101f7-5683`/PR330 and universal movement `01a107ba`/PR332 retain shared jobs/routes. PR361's new transport nonce requires only a CPU-fixture identity adaptation. Human loss setup, earned bank and retreating raid do not prove sustained contest, balance or general completion. Medium stays human-only; admission `01a103cc`, human balance `01a103e8`. |
| 4 — authored rotation merged / served acceptance open | Observe obstruction escape and return through the ordinary served objective-control path. | `src/pve-objective-rotation.mjs` and existing paid evidence; navigation remains with its owner. | [PR203](https://github.com/lbeezr/thousand-unit-skirmish/pull/203) at `89772d6f` rotates after 60 seconds without approach, occupancy, capture or combat, with temporary 120-second cooldown. Its [matched wall-ring proof](qa-pve-objective-rotation-2026-10-03.md) wins at 107.6/109.7 seconds across cold restore versus a 360-second baseline timeout. Rendered acceptance remains open. |
| 5 — paid recovery source / ordinary observation open | Observe Worker/Farm depletion, paid recruitment, home defense and reform; fix only a reproduced policy failure. | AI production/recovery modules and tests; shared economy/price/server code excluded. | [Canonical paid loss proof](qa-pve-mode-adapter-2026-10-04.md#paid-loss-recovery) covers both seats/maps, rebuilt producer, recruits, cold restore and five-unit advance. Native Farm cost is 60 wood; normal policy minimum is 85 including reserve. No resource grants. |

## Current capabilities and regression floor

The [capability qualification audit](qa-pve-capability-qualification-2026-10-04.md)
adds the smallest uncovered direct contract: both seats acquire and destroy a
second visible paid producer after the first, warm and across fresh-fixture
recovery. Controls complete the first assault but leave the second undamaged;
emitted orders alone cannot qualify. Opponent AI `01a10297` owns this regression.
It changes no policy/difficulty/victory and establishes no balance or larger-map
admission. Before interpreting win rates, name required mechanics, their direct
evidence and the excluded capabilities. Rendered Tiny and general Medium
completion remain the next evidence with the existing owners above.

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
