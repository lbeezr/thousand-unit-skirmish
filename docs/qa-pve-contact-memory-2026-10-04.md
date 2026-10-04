# Tiny public-contact inspection experiment

Opponent AI `01a10297`, 4 October 2026. This is a bounded policy extension,
not a bug fix or completion guarantee. Tiny assault troops now briefly inspect
one previously disclosed enemy coordinate before returning to global search.
Two controlled native cases demonstrate actual arrival; neither rediscloses or
damages the escaping unit. The original 3600-second completion failure remains.
Art N/A. Medium admission remains human-only.

## Contract declared before implementation

The [preimplementation declaration](https://github.com/lbeezr/thousand-unit-skirmish/pull/379#issuecomment-5984592998)
uses base `2cbf2ae874fde4c67e792697f14d30268182e6e4`. It follows the
[legal-hiding diagnosis](qa-pve-scout-completion-2026-10-04.md) and
[pacing scope agreement](https://github.com/lbeezr/thousand-unit-skirmish/pull/372#issuecomment-5984125400).
Only `src/pve-skirmish-targets.mjs`, its scenario/tests and AI documentation
change. Shared movement, economy, server authority, maps and admission stay with
their owners. The separate PR372 Worker route is not qualified by these cases.

- Tiny only: retain one selected, currently disclosed living land unit's `x,z`
  and observation tick. Retain no enemy ID, generation or hidden movement.
- Expire after 300 ticks (10 seconds) from actual disclosure. Friendly progress
  and reinforcements cannot renew that deadline.
- Clear when a surviving original friendly generation reaches within 2 units,
  when no original assault member remains, or when the assault pool is empty.
- Clear on team/map context change, tick rewind or a fresh policy. Native
  recovery preserves authoritative state while the new policy forgets contact.
- Current visible targets always take priority. A selected visible producer
  clears old contact. Hidden contact emits coordinate AttackMove only.

Existing combat protection, generation-bound owned orders, recovery priorities
and global search remain. Internal, Small, Medium and Large decisions are
unchanged; the contact setting uses the existing Tiny size identity.

## Matched native comparisons

The historical comparison reconstructs PR371's actual tick84120 fork by replaying
its sealed command ledger using the original three-tick publication/checkpoint
phase. All 824 per-command wire DTOs and 94 sampled seat pairs match exactly.
Both scoped assault policies start fresh and are primed from the same actual
disclosed seat observation; this does not reconstruct the old private cursor.
Other orders are locked to the retained ledger for a 60-second controlled slice.
Four arms each repeat exactly, including their complete final native checkpoint.

The current engine correctly rejects that historical checkpoint's older ruleset
revision. It is not relabelled or migrated. A separate current ordinary setup
uses the canonical Terraced Vale160 opening: 24 units, 150 food/250 wood per
seat. Five owned Move/Hold commands disclose then move an undamaged Worker out
of sight. No grants, state edits or synthetic visibility enter either case.
The current fork is tick1410; the last real observation is tick1380. Four
30-second arms each repeat exactly, using one Infantry as the assault cohort.

| Case / arm | Closest distance to public coordinate | First arrival within 2 | First global-search order |
| --- | ---: | ---: | ---: |
| Historical unchanged baseline | 5.585 | none | 84150 |
| Historical candidate | 1.740 | 84180 | 84180 |
| Historical no disclosure | 5.585 | none | 84150 |
| Historical fresh policy at84150 | 5.585 | none | 84150 |
| Current unchanged baseline | 8.600 | none | 1410 |
| Current candidate | 0.791 | 1488 | 1500 |
| Current no disclosure | 8.600 | none | 1410 |
| Current fresh policy at1440 | 5.696 | none | 1440 |

The current candidate reaches the last public point 2.6 seconds after losing
sight and resumes global search at the next decision, 3 seconds after loss.
Both no-disclosure arms have the same command trace and final native state as
their unchanged baseline. Cold recovery occurs before arrival and forgets the
contact. Every arm has zero rejected commands, no later redisclosure and an
ongoing match; the historical Scout remains at12HP and the current Worker100HP.
These observations justify default Tiny coordinate inspection, not a kill,
win, balance, whole-map coverage or full-game improvement claim.

## Regression and remaining qualification

The existing skirmish test file registers 18 new contact contracts: both seats,
expiry despite motion/reinforcement, original arrival/loss/generation reuse,
current producer/identity reacquisition, context/rewind/fresh-policy clearing,
other tiers, hidden-input equivalence and the current native case with exact
repeat and cold restore. An additional retained comparison verifies 168
byte-equal decisions against unchanged source across other tiers and seeds.

The initial broader targeting/reconnaissance/home-defense/regroup run passes
113 of119 tests. Six older Medium native fixtures reject their obsolete
ruleset checkpoint before policy decisions. A representative unchanged-baseline
factory reproduces the same rejection. These failures remain visible; no
fixture revision, validation or assertion is weakened. The subsequent shared fixture repair in
[PR386](https://github.com/lbeezr/thousand-unit-skirmish/pull/386) restores the
Medium reconnaissance case without changing AI runtime. The final exact-head
scoped receipt includes that case, excludes only the five remaining targeting
fixtures and retains the failed broader-run logs. Twelve existing empty-economy/last-population paid-recovery
contracts also pass. These are focused checks, not a full CPU-suite pass.

The owning PR retains executing source hashes, preimplementation contract,
original and current native forks, negative controls, independent review,
exact-head author/postmerge checks and the sealed evidence receipt. The original
PR371 and Scout analysis/coverage seals remain unchanged. No full-match rerun,
deadline extension, admission change or deployment is part of this experiment.
Full Tiny completion, rendered acceptance and the separate pacing Worker cause
remain open with their existing owners.
