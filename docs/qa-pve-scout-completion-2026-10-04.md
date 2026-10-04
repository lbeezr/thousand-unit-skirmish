# Retained Tiny Scout completion diagnosis

Opponent AI `01a10297`, 4 October2026. **No concrete policy or movement bug is
established.** PR371's living Scout correctly keeps recovery-aware elimination
open. Local reconnaissance stops on known ground, while the opponent's bounded
search has not redisclosed the survivor in the retained views by the original
3600s ceiling. This diagnosis preserves hiding, fog, prices, victory and timers;
it changes no policy, native runtime, admission or scenario fixture. Art N/A.

## Exact record and scope

The [unassisted case](qa-pve-unassisted-contest-2026-10-04.md) executes
`3c7fb668525a4a7311f497b5b99a58845686f3b2` (native engine baseline
`70c0ef50f893ebca90b45e3089be744f3a974537`) against separately qualified opponent
`41e30deb3aac6b4533231514943a6b65ad3068ab`. Azure/team0 seed20260925 faces
Ember/team1 seed0 on the same canonical Terraced Vale160/skirmish@1 map.
The complete first/repeat JSON is byte-identical, SHA256
`f2dd8deae27b54fb7fa6febfcb5851b80ac7020d59caa88bb0ff44f043d7d39b`.
The original sealed ZIP remains unchanged, SHA256
`0702cd88220388362051df9c307c73e9c5fa75f4e2f3b49f47c31e318c6001e8`.

No game is rerun. This analysis projects retained per-command player DTOs and
30s samples through their exact frozen source modules; the native final record
supplies actor/path/movement identities only. Private authority never enters a
policy decision. [Structured diagnosis](qa-evidence/pve-scout-completion-2026-10-04/diagnosis.json)
and [control receipts](qa-evidence/pve-scout-completion-2026-10-04/controls.json)
retain hashes and the separate pacing case. The owning PR retains analysis
scripts, module receipts, review, exact-head checks and sealed-artifact receipt.

## What happened

Scout50/generation1942171717 receives53 Move commands. Its last command at
native tick86640 orders `(27.5,-3.5)`. The native final record retains last
movement tick86739 and a completed one-cell path; the first retained arrival
sample is tick87300. Every later sample keeps the same location and12HP, with
no friendly producer remaining. A living land Scout counts for elimination;
no-building state alone is not defeat.

| Question | Retained evidence | Diagnosis and limit |
| --- | --- | --- |
| Did an old private goal freeze the Scout? | A fresh reconnaissance policy on the exact final Azure DTO returns `ids:[50], commands:[]`; a fresh full policy returns no commands. | The idle branch does not require a stale watch. This is a cold policy probe, not warm private-state reconstruction or native restore. |
| Did it finish exploring the map? | Azure has12321 unknown,12838 remembered and441 current-visible cells out of25600. All16 local probes at radii12/15 are known: eight current, eight remembered. | Local-ring exhaustion stops reconnaissance. Tiny explicitly excludes the distant fallback and keeps this Scout reserved from army orders; existing local-only Tiny tests encode that boundary. Unknown cells are not a claim of reachable terrain. |
| Did the opponent fail to acquire a visible Scout? | At tick83970 Ember accepts a generation-bound Attack on Scout50; at84120 the recorded view still discloses the12HP Scout with seven focused attackers. | Acquisition and target identity work. A faster Scout can escape current sight; no forced engagement or hidden pursuit is justified. |
| Did it stay visible afterward? | No retained Ember command view after84120 discloses the living Scout. Every post-arrival30s sample gives its cell fog code1, remembered rather than current-visible. | Last **recorded** disclosure is84120. No-command decisions and intermediate native ticks are not retained, so continuous invisibility is not asserted. |
| Did opponent search stop or repeat one goal forever? | Ember issues548 AttackMoves to186 distinct destinations;147 distinct goals align with the eight-cell global grid,43 after last recorded Scout disclosure. Ten assault actors still have lastMoveTick108000; a Rider last moved107997 after completing its path. | Search destinations rotate and native movement continues at the ceiling. Selected goals are not physically visited cells or complete coverage; no unreachable or stalled route cause is established. |
| Is the ceiling or army size a pacing verdict? | The native match remains ongoing at108000ticks. The policy's12-military/four-Worker limits cap this experiment. | These are scripted policy budgets, not human pacing, map capacity or balanced army-growth evidence. Preserve the original completion failure; do not turn it into a draw or extend the timer. |

The three mechanisms are distinct: the losing Scout stays alive legally;
its own bounded local policy stops exploring; the winning army's search does not
supply a recorded redisclosure before the bound. Emitted accepted orders alone
cannot qualify full search coverage, route completion or an elimination.

## Causal observation controls

These controls operate only on copied filtered DTO fixtures, without commands
to authority or changes to the retained match:

- Marking one remembered local probe `(42.5,-3.5)` unknown makes a fresh Scout
  policy issue that generation-bound Move. The baseline DTO remains idle.
- A fixture's currently disclosed nearby Infantry still causes a retreat Move;
  reserving the fragile Scout is not removed to manufacture an elimination.
- Adding the hidden Scout row and changing hidden enemy banks in Ember's copied
  DTO leaves the projected observation exactly equal. The selector has no target.
- Consistently marking that fixture Scout currently visible makes the selector
  acquire Scout50 with its correct generation. Losing disclosure on the next
  fixture observation produces ordinary coordinate AttackMove search, without
  an enemy ID. This is not necessarily a last-seen-coordinate search.
- The selector also acquires Scout50 on the actual retained83970 view, without
  synthetic disclosure. This anchors the control to an observed acquisition.

These comparisons isolate the local-known-ring and current-disclosure branches.
They do not prove alternate full-match outcomes, warm policy-watch state,
physical route feasibility or a counterfactual win. No new permanent test or
policy tuning is warranted without a specific failing capability contract.

## Pacing coordination and next owner scope

[PR372](https://github.com/lbeezr/thousand-unit-skirmish/pull/372) is a different
current-policy mirror at source24144f6b/engine96b with PR364 movement. Its reversed
seeds `[0,20260925]` end with Azure Worker101/generation528718585,100HP at
approximately`(13.52,10.5)`, pathIndex79/108, lastMoveTick108000 and `to-node`
intent. Its accepted raw decompressed SHA256 is
`d99b1d07fb12a29edc0cbd7a1eae347d8f0e6125376039a2cf1b19432cc51ee6`.
That terminal metadata is not a cause diagnosis and does not qualify this older
Scout matchup. [Scope coordination](https://github.com/lbeezr/thousand-unit-skirmish/pull/372#issuecomment-5984125400)
keeps pacing's expansion/growth observations with `01a10887` and shared routes
with movement `01a107ba`; AI retains residual-unit disclosure/completion evidence.

This Scout diagnosis is complete as a source evidence milestone. Full Tiny
completion qualification remains failed. Any next policy change needs a bounded
capability contract and a reproducible failure/control, with valid hiding and
current sight preserved. The separate retained Worker/unfinished-route case may
supply the next concrete diagnosis with pacing/movement; no shared route edit or
new broad matchup is selected here. Medium stays human-only. Served/rendered
Tiny acceptance, later-engine qualification and human balance remain separate.
