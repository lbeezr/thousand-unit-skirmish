# Visible defender during a producer assault — 5 October 2026

[AI queue](pve-policy-backlog.md) · [Paid Infantry recovery](qa-pve-last-infantry-recovery-2026-10-05.md)

Owner: Opponent AI `01a10297`. This establishes a bounded target-priority defect
and native assault improvement. Full Tiny completion, balance and ordinary
rendered acceptance remain open. Art backing: N/A; no presentation changes.

## Exact failure and capabilities

CI's [PR428 handoff](https://github.com/lbeezr/thousand-unit-skirmish/pull/428#issuecomment-5988197752)
provides an [immutable qualification archive](https://raw.githubusercontent.com/lbeezr/thousand-unit-skirmish/0e88c68b0f8b66eba35804c40e97ff04341d8ed0/evidence/cpu-qualification-67295aef.zip).
Independent verification passed all40members, manifest, report, normal full-run
log and both byte-exact decoded failure records. Archive769023bytes, SHA256
`6c9c9030e1b19d4dd7ded618e18a7e81251fc0335af6a63d0b3b8ce8d1ee1b4b`.
Source: clean `67295aef1a744bde9000ce2c3d12e00b78a922e0`.

That normal unsharded CPU run finished1105passed/1failed/217unrun. Original seeds
`[20260925,0]` remain ongoing at the unchanged3600second deadline in authored@1
and Skirmish@1. Reversed seeds complete by elimination at2711seconds and exactly
repeat. This supersedes the earlier running qualification note; it is not a
full-suite pass or evidence that the last-price Infantry fix resolves completion.

The policy already gathers, produces, scouts, directs disclosed attacks,
defends home assets and regroups. Both new terminal states have living Workers,
armies and producers. Team1 currently sees the enemy Town Center and Infantry95;
its four frontline units80/82/86/92 attack that Town Center. Native attack ticks
confirm all four are fighting the building. Infantry95 attacks them while staying
at100HP. The existing selector always ranks a complete producer before any
visible unit, including a military unit already within attack range of an
assault unit. This is a target-priority weakness, not a demonstrated route stall.
No terminal Scout or older Worker phenotype is borrowed as its cause.

## Matched bounded mechanism and correction

Restore each complete original terminal checkpoint without editing authority.
Run both ordinary policies every30ticks for1800ticks (60seconds), starting fresh
in both forks. The unchanged exact-source fork issues legal Town Center assaults;
all four original frontline attackers die, while Infantry95 stays at100HP.
Town Center damage is183.6HP. The matched candidate changes only unit target
priority in team1's Skirmish selector: a disclosed living military land unit
already within its public attack range of an available assault unit precedes
producers. Workers and distant military units retain the existing priority.

Infantry95 is observed alive at108075 and dead at108078 (within2.6seconds). The
candidate resumes Town Center
orders at108090 and preserves all four frontline attackers through108000+1800.
Their total remaining HP is304; Town Center damage is500.4HP. Both modes repeat
complete command ledgers and terminal checkpoint hashes exactly. Every command
is accepted, and both forks finish with identical resource balances. This is a
normal-policy comparison with no forced attack, resource grant or deadline edit.
The comparison starts after the failed full-match deadline; both forks remain
ongoing and do not establish the entire match's cause or completion.

The [runtime selector](../src/simulation/ai/policies/skirmish-targets.mjs) reads only current public
positions, kind definitions and the existing available assault cohort. It keeps
stable target ties, generation binding, combat protection, retry/search bounds,
contact expiry and the caller's defense/reconnaissance/rally reservations. It
changes no authoritative combat, navigation, economy, map, mode or victory rules.

## Regression and integration boundary

[Fixture provenance](../scripts/fixtures/pve-defender-assault/provenance.json)
retains both complete actual checkpoints as compact JSON/gzip with compressed,
decoded and original-record digests. The [native helper](../scripts/pve-defender-assault-case.mjs)
strictly restores those checkpoints, drives both full policies from filtered
observations and checks every attack against its currently disclosed identity.
Hidden bank changes and an undisclosed armed unit leave the observation equal.

The14 [focused regressions](../scripts/pve-defender-assault.test.mjs) cover both
seats/three seeds for direct priority and generation contracts, public range
boundaries for all six military kinds, excluded dead/friendly/Worker/water/unknown
and distant targets, and preserved focused/recent combat protection. Four native
cases cover the actual seat1 failure in both modes, warm and with fresh fixture
and policy restore during combat at108030. Health is sampled only on native
three-tick publication boundaries: checkpoint capture refreshes vision, so the
earlier per-tick sampling experiment is preserved as superseded methodology.
Corrected controls witness the death window rather than an exact off-phase tick. Each whole replay repeats exactly;
both-seat snapshots remain equal under the existing Worker transient row17
clearing contract. No authority field is normalized away.

On current main `b02ea4fa` plus this correction, all14 pass. Warm structure damage
is500.4HP; cold damage is498.6HP. Both observe defender death by108078 and retain all
four attackers. They are imported by the existing registered Skirmish target
check. The original whole-match3600second test and its seeds remain unchanged.
Exact-head checks, independent review and postmerge receipts belong in the PR.

AI owns this integration and any subsequent exact packet diagnosis. CI
`01a10378` owns the next normal full qualification after the substantive change;
no competing full Tiny attempt was launched here. Movement `01a107ba` retains
its separate route work. AI/shared staging and capture owners retain ordinary
served/rendered verification; no deployment or rendered observation is claimed.
Medium remains human-only and the current two-seat Frontier rules remain intact.
