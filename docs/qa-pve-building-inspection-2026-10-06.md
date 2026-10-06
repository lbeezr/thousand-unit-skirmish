# Tiny building point inspection

Opponent AI `01a10297`, 6 October 2026. Base source:
`e9c58995efedc0c5ee39ce2d17fe9042d97e2973`. This source-only slice extends the
existing Tiny public-coordinate inspection to a selected, currently disclosed
building. It changes two runtime lines in `src/pve-skirmish-targets.mjs`;
production, economy, movement, server authority, map admission and the two-seat
Frontier rules are outside the slice. Art/story backing N/A: no presentation
change. The PR supplies final source/review/release identity separately.

## Current capabilities and bounded weakness

The opponent already gathers, spends, replaces Workers, replants finite Farms,
rebuilds producers, recruits counters, answers visible raids and regroups after
losses. Its Skirmish target branch selects disclosed producers and military
threats, then searches unknown ground. Tiny already briefly inspects the last
selected unit coordinate. A selected building instead cleared that history;
after sight loss the next target decision immediately chose global search.

Native authority cancels a building attack after losing sight. The first hidden
publication can still contain the previous attack target; the following native
tick clears it before the next policy decision. The peer observation has no
durable military order-result field. Absence therefore establishes neither a
live target nor completed travel. This extension inspects a disclosed point;
it does not retain an entity order or infer hidden survival/HP.

## Contract

- Tiny only, using the existing size identity and one last selected public
  `x,z`, disclosure tick and original friendly generation cohort.
- The existing 300-tick deadline runs from disclosure. Friendly movement and
  reinforcements cannot extend it. Arrival within 2 units by an original member,
  loss of the original cohort, an empty assault pool, context change, tick rewind
  or a fresh policy clears the point.
- Current visible targets retain priority and current fighters retain their
  existing protection. A newly selected visible unit or building replaces the
  point using only current disclosure.
- Hidden inspection emits coordinate `AttackMove`. `AttackBuilding` requires a
  currently disclosed living building. No enemy ID, generation, hidden position,
  hidden HP or enemy bank is saved in the point history.
- Native checkpoint recovery preserves authority and both peer views under the
  existing transient Worker-receipt rule. A fresh policy forgets hidden history;
  actual redisclosure permits a new entity order and damage.

The [earlier unit-contact receipt](qa-pve-contact-memory-2026-10-04.md) remains a
dated record of the unit-only contract. Its unit behavior and assertions remain.

## Matched native acceptance

The new helper creates a trusted 160-by-160 authored lab map with 24 units and
150 food/250 wood per seat. It tests the Skirmish target subpolicy, not ordinary
Skirmish map admission. Ordinary Move/Hold/Stop/Stance commands position one
Infantry and a Worker; the Worker discloses the actual enemy Town Center then
withdraws. There are no grants, state edits, artificial visibility or new prices.
Every arm restores the same last-visible checkpoint and accepts the same initial
sighted `AttackBuilding`. A no-history control resets only policy history at
actual sight loss, reproducing the prior building fallback without claiming to
reconstruct an unrelated private policy cursor.

Both seats repeat complete command/notices/final-authority results exactly.
Each controlled comparison runs 450 ticks (15 seconds), with the distant enemy
army held after setup. All listed times are native ticks, not decision guesses.

| Seat | Initial entity order | Sight lost | Authority cleared | Point order | Redisclosed | First damage | Final TC HP | No-history control |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 555 | 558 | 561 | 585 | 651 | 729 | 2383.5 | No redisclosure/damage; 2400 HP |
| 1 | 537 | 540 | 543 | 567 | 600 | 690 | 2382 | Redisclosed 639; damage 759; 2386.5 HP |

Seat 0 deals 16.5 damage where its control deals none. Seat 1 starts damage
69 ticks (2.3 seconds) earlier and deals 18 rather than 13.5 damage. All orders
are accepted, banks remain unchanged, all 24 units survive and matches remain
ongoing. Fresh hidden restores forget the point; fresh restores at actual
redisclosure reacquire a legal building attack and resume damage. Both recovery
arms repeat exactly, including complete final checkpoints.

These observations establish a bounded local improvement. They do not establish
whole-match completion, pacing, balance, ordinary rendered play or the cause of
held PR583's endpoint. No private captures are published and no new long
qualifier is run. Opponent AI retains this policy receipt; shared staging/capture
owners retain identified deployment and ordinary rendered acceptance.

## Regression and checks

The existing registered targeting file adds 18 tests: both seats, three policy
seeds, expiry, original arrival/loss/reuse, fresh/context clearing, visible
priority, unchanged unit memory, hidden-input equivalence, dead/moved hidden
buildings, other tiers, actual native redisclosure/damage and fresh recovery.
Restoring the unchanged base runtime makes all six new point-selection cases
fail. The candidate focused selection passes 28/28, including existing unit
contact and visibility-loss checks.

```sh
node --test --test-name-pattern='Tiny building|Tiny.*contact|visibility loss' scripts/pve-skirmish-targets.test.mjs
node --test scripts/pve-skirmish-targets.test.mjs scripts/pve-skirmish-replay.test.mjs scripts/pve-target-continuation.test.mjs scripts/pve-regroup.test.mjs scripts/pve-home-defense.test.mjs scripts/pve-reconnaissance.test.mjs scripts/pve-mode-adapter.test.mjs
```

The broader group passes 162/168. Its six seat-1 authored home-defense fixtures
fail `visible raid must recall objective troops` for seeds 0, 20260925 and
4294967295 against Worker/building raids. All six reproduce on unchanged
`e9c58995` (the selected base run passes 3/9). They have no visible raid or
response in either run, and their authored policy does not use the changed
Skirmish branch. No assertion, registration, fixture or deadline is weakened;
these remain separate existing failures, not a full-suite pass.

Architecture/import checks pass with zero cyclic edges; both typecheck projects
pass; runtime-import tests pass 48/48; client asset allowlisting passes for all
145 imported modules. Canonical Skirmish checkpoint and wildlife disclosure
checks pass 8/8; documentation links, changed-file syntax and whitespace checks
pass. The CI inventory remains registered, including syntax for the new helper.
Full CPU qualification and ordinary served acceptance remain open; the PR
records the final integrated head, independent review and clean-package checks.
