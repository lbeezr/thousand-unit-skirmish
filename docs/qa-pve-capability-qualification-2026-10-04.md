# Opponent capability qualification before difficulty interpretation

[AI queue](pve-policy-backlog.md) · [Testing strategy](testing-strategy.md)

Owner: Opponent AI `01a10297`. Audit base
`1e7b9d0fde23bd3675f286d98a127fad374102be`, Node 24.19.0, 4 October 2026.
This slice adds a capability contract and controls; gameplay policy, difficulty,
victory, admission, authoritative simulation and shipped maps are unchanged.
The PR checkpoint retains the final tested head, independent review and merge
identity. No deployment or rendered acceptance is claimed.

## Why qualify the bot first

In the developer's [Singularity AI Tycoon account](https://www.reddit.com/r/aigamedev/comments/1vb10zg/i_used_claude_code_to_build_a_full_strategy/),
the hardest-tier bot's zero win rate accompanied its inability to use sabotage,
which that tier required. The developer explicitly distinguished that bot result
from difficulty measurement. The applicable lesson here is to establish specific
bot capabilities before interpreting outcomes. It does not establish our game's
balance, and this change neither trains nor tunes the policy to the fixture.

## Existing coverage audited

These are existing contracts, not claims that every capability was rerun here.
The final PR checkpoint lists the checks actually executed for this slice.

| Candidate capability | Existing evidence | Boundary / smallest remaining gap |
| --- | --- | --- |
| Explore reachable enemy territory | [Target tests](../scripts/pve-skirmish-targets.test.mjs), native Medium search cases and [Tiny full games](../scripts/pve-tiny-search.test.mjs) | Progressing and genuinely stalled native routes plus exact game/recovery cases exist; Medium general completion remains open. |
| Replace lost Workers | [Worker tests](../scripts/pve-worker-recovery.test.mjs) and [native zero-Worker case](../scripts/pve-zero-worker-case.mjs) | Both-seat paid last-price training, a fresh foundation/queue restore and a real resource deposit already exist. |
| Maintain/rebuild production after losses | [Canonical loss tests](../scripts/pve-skirmish-loss.test.mjs), [regroup tests](../scripts/pve-regroup.test.mjs) and runtime production scenarios | Actual casualty/rebuild/recruit/advance contracts exist. The original full-shard Millrace failure remains a separate investigation. |
| Recover from a blocked goal | [Objective rotation tests](../scripts/pve-objective-rotation.test.mjs), native paid wall ring and native stalled search | The obstruction and bounded escape are exercised; no pathing or policy rewrite is justified by this audit. |
| Acquire the next producer after destroying one | Synthetic visible-target transitions in target tests; [paid producer replay](../scripts/pve-skirmish-replay.test.mjs) | The replay breaks on its only producer's destruction. Full-game outcomes give indirect coverage, but no isolated paid second-producer continuation with incapable controls existed. This is the chosen addition. |

## Added native contract and measured result

Run:

```sh
node --test scripts/pve-target-continuation.test.mjs
```

Set `RTS_PVE_CONTINUATION_EVIDENCE_DIR` to an existing directory to retain JSON
with legal setup orders/notices, the unedited starting checkpoint, both-seat
one-second observations, delivered/suppressed orders and final checkpoints.

The authored 80×64 fogged fixture uses the ordinary 24-unit opening and
150 food / 250 wood. Four opponent Workers gather and deposit enough wood to
pay 350 wood for two Barracks through ordinary construction. One 50-food recruit
and the opening reserve remain away from the targets. The acting army legally
captures a reward-only post, restores its aggressive stance by command and then
uses the unchanged full deterministic policy. There are no resource grants,
unit/casualty edits, edited checkpoints or hidden enemy inputs to the policy.

As in the preceding producer replay, the fixture's authoritative identity is
`authored@1`, deliberately paired with `skirmish@1` policy configuration to
isolate target selection after post ownership. This is a test fixture, not an
advertisement of new runtime map/mode admission. The policy receives only the
ordinary team-filtered observation. Test assertions inspect authoritative HP
and checkpoints without feeding them into decisions.

| Seat | First assault | First destroyed / second acquired | Second damaged | Second destroyed, cold | Second destroyed, warm |
| --- | --- | --- | --- | --- | --- |
| Azure / 0 | 1 s | 119 s | 122 s | 208 s | 208 s |
| Ember / 1 | 1 s | 119 s | 122 s | 208 s | 207 s |

All times are simulation seconds from the common paid checkpoint, sampled at
one-second decision boundaries. The second producer is visible and undamaged
when the first disappears. Acquisition must target a currently disclosed enemy
producer; actual native damage and destruction are required for qualification.
The cold branch restores that transition into a freshly created server fixture
and fresh full policies. Both seats' complete authoritative observations survive
restore, allowing only the existing documented transient Worker-activity clear.
The warm branch independently demonstrates the capability without a policy reset.

The cold branch exactly repeats from its same original checkpoint: every
command, notice, both-seat sampled observation and final checkpoint matches.
Separate accounting checks conserve bank + node stock + Worker cargo against
native paid spending for both seats. This does not measure frames or transport.

## Controls and exclusions

Both controls use the same paid starting checkpoint, same full policy and fresh
transition restore. All delivered commands/notices before first destruction
match the positive trace exactly; both destroy the first producer at 119 seconds.
Only continuation attack outputs are disabled, leaving support economy active.

| Control | Continuation witness | Native result through 240 s | Qualification |
| --- | --- | --- | --- |
| Acquisition output suppressed | No new delivered target order | Second producer undamaged and alive | Rejected |
| Delivery suppressed | Policy emits a second-producer assault, retained in the trace | Second producer undamaged and alive | Rejected; planned orders alone cannot pass |

The result qualifies one visible paid-producer continuation capability, on one
authored topology/seed, both seats, warm and cold. It adds no win-rate estimate,
difficulty setting or balanced-difficulty claim. It does not qualify sabotage,
all unit compositions, naval play, simultaneous raids, every obstruction,
hidden-target discovery after a kill, Medium admission, live networking or
ordinary rendered Tiny play. Existing full-game proofs remain independently
scoped evidence. No gameplay changes were needed for this capability.

## Owner and next evidence

Opponent AI owns this native capability regression and further demonstrated
policy defects. Before a difficulty experiment, state the mechanics required
by its named scenario, link their direct capability evidence and record gaps;
do not replace absent capability evidence with a difficulty conclusion.
The next existing qualification gaps remain the unfinished paired Medium game
and ordinary rendered Tiny acceptance at an identified served source; their
owners and boundaries remain in the AI queue.

Millrace is separate. CI owner `01a10378` supplied the original `d8f10423` shard
trace on [PR296](https://github.com/lbeezr/thousand-unit-skirmish/pull/296#issuecomment-5981477035).
Azure demonstrably paid/rallied four recruits at ticks 1743/2253/2763/3303;
Ember advanced at 1623. Last commands at 4533 are not a final tick. Azure's
first rally bound would be 5343. Because the server increments ticks even after
terminal victory while stopping gameplay, the discriminator is final winner,
reason and hold/objective state as well as tick. The requested original-shard
diagnostic rerun is already owned/running; no duplicate shard was started here.
Neither terminal victory nor execution lag is yet demonstrated as the cause.
