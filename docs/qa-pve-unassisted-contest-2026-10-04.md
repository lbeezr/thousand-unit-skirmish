# Predeclared unassisted Tiny contest

Opponent AI owner `01a10297`, 4 October 2026. This source qualification follows
the [controlled loss proof](qa-pve-contested-wood-2026-10-04.md). It is one
matchup and its exact replay, not a balance or difficulty experiment. Art backing
is N/A. **The corrected match fails full contest qualification:** both executions
remain ongoing at the original3600-second ceiling. Paid economy, combat and
natural-loss recovery were exercised; completion remains unqualified.

## Opponent and admitted map

Azure uses current main `70c0ef50f893ebca90b45e3089be744f3a974537` plus the
standalone evidence runner, policy seed `20260925`. Ember uses the unchanged
policy/projection dependency tree from qualified source
`41e30deb3aac6b4533231514943a6b65ad3068ab`, seed `0`.
[PR281](https://github.com/lbeezr/thousand-unit-skirmish/pull/281) records four
Tiny full-game checks, exact repeats and every Tiny decision equal to the prior
qualified policy, with 2739/602-second eliminations. That is source capability
evidence, not human strength or a guarantee on the new engine.

Both receive their own current player DTOs only. Public gameplay definitions
and canonical map bytes must match the qualified source. Terraced Vale Tiny is
the already admitted PvE map through PR250; native and both policy identities
are `skirmish@1`. The fixed canonical map was historically authored from terrain
seed93025; its JSON does not contain a runtime terrain seed. This fixture loads
the exact map bytes and normal24-unit opening with150Food/250Wood per seat.
It performs no generated-map selection. Map/source/opening hashes are retained.

## Conditions fixed before execution

The original full-game bound remains108000 ticks /3600 simulation seconds.
Full policies run uninterrupted every30 ticks, with Azure then Ember command
dispatch. No setup orders, human assistance, casualty/deposit injection,
resource grants, retreats, midgame restores, policy resets, map changes,
counterfactual command suppression or victory changes are allowed.

Stop at the first native elimination, the original bound, or a harness invariant
failure. A ceiling outcome remains `bounded-unresolved`; it cannot become a
draw or a successful completion. A harness failure retains its trace and final
checkpoint. The second execution restores only the same untouched native
opening, before any policy action, and compares the entire persisted result.

Contest acceptance requires native elimination by the bound, both sides' paid
producer purchase/completion with actual Food/Wood spending, both native living
cargo deposits, both observed enemy disclosure and incoming native unit damage,
zero rejected commands, and no harness failure. These criteria remain fixed
after observing the result. Same-source shadows compare every policy decision.

Recovery is a separate claim: a natural Worker loss with an actual enemy attack
witness, a later real50Food Worker purchase and matching completed queue/new
generation, that replacement's accepted Gather of a currently disclosed source,
and its later living10-cargo/native bank credit while the opponent has living
military and the match is ongoing. Unexercised or incomplete recovery remains
explicit; a winner alone cannot qualify it. Normal simultaneous bonus credit is
reported separately from observed carried cargo without inferring a bonus.
Command-debit totals are not a complete resource conservation ledger.

Native witnesses are captured only after the existing three-tick state phase.
Checkpoint capture refreshes visibility, so calling it between those phases
would change native combat sight. Unit loss, birth and delivery times name their
three-tick observation windows, rather than an invented exact tick. Policy
decisions still occur every30 ticks; native elimination is evaluated on the
same state phase. The initial per-tick-capture pair at `8e93dadd` is retained as
a diagnostic method failure and cannot support the unassisted claim. The
corrected capture method keeps all declared acceptance and stopping conditions.

## Observed result and exact replay

The corrected executed source is
`3c7fb668525a4a7311f497b5b99a58845686f3b2`; its policy and native runtime are
unchanged from the main baseline above. It runs Azure seed20260925 against frozen
qualified Ember source41e30deb, seed0. Both stop at native tick108000 with
`matchWinner=-1`, `bounded-unresolved` and `qualifiedUnassistedContest=false`.
The missing criterion is native elimination; all six other declared criteria
pass. Exit0 records a completed experiment, not a successful qualification.

| Native observation | Azure/current | Ember/qualified opponent |
| --- | --- | --- |
| Accepted commands / rejected commands | 250 /0 | 748 /0 |
| Actual command debits, Food / Wood | 1745 /1220 | 1505 /1560 |
| Paid Barracks purchase / observed completion | tick450 /1110 | tick420 /1080 |
| First living10-cargo deposit | ticks433–435 | ticks418–420 |
| First disclosed enemy / incoming damage | tick6480 /ticks6607–6609 | tick6480 /ticks6607–6609 |
| Natural Worker loss used by recovery witness | Worker1, ticks7285–7287 | Worker12, ticks19171–19173 |
| Later actual50Food replacement purchase | tick11430 | tick19200 |
| New Worker / generation / observed birth | 34 /1942171717 /ticks12178–12180 | 41 /1942171717 /ticks19948–19950 |
| Replacement's accepted disclosed Food Gather | tick12180 | tick19950 |
| Replacement's living10Food bank deposit | ticks12655–12657; bank90→100 | ticks23662–23664; bank≈80→90 |
| Enemy military alive at that deposit | 12 | 1 |
| Final living units / owned buildings | one12-HP Scout /0 | 16 units /5 |

Loss records retain enemy attack ticks and coordinates matching the native dead
Worker, real completed queues, generation-bound jobs and before/after cargo/bank
witnesses. There are17 observed Worker losses,13 paid Worker purchases/births,
and721 living-cargo deposit observations. Both recovery deposits credit exactly
10Food with zero unattributed interval credit. The first replacement income is
observed179.0s after Azure's loss window end and149.7s after Ember's; these are
observed elapsed bounds, not optimized recovery claims.

Azure's remaining Scout50/generation1942171717 reaches its last Move destination
`(27.5,-3.5)` issued at tick86640 and survives to the ceiling. Ember continues
military AttackMove search through tick107760. The experiment therefore leaves a
concrete residual-unit disclosure/completion question. It does not establish a
route failure or a specific current-policy defect. The qualified opponent uses
its historical search policy; no policy is changed to force this result closed.
Next AI analysis should reconstruct the retained seat-visible search history
around that survivor before choosing a bounded regression or policy change.

The exact-opening repeat runs from the frozen `source/run` tree. Its entire
persisted JSON, including all player views, commands, costs, native witnesses,
and final private checkpoint, equals the first execution byte for byte; no field
normalization is applied. Key identities:

- Map SHA256: `2e352328e0b6795c04a11505672d17971231cc2e7ad34a858ff6418423d5d1f6`.
- Contract SHA256: `caaca2fb3ba23657089169b1861e3eb08bc57a20fe5a3e647e675d97a42ef772`.
- Opening SHA256: `778e2313c6ccb1ca0315eb1b9dc0acf01fc16e4ec8172a3adfe11de6ec97ff36`.
- Each persisted result SHA256: `f2dd8deae27b54fb7fa6febfcb5851b80ac7020d59caa88bb0ff44f043d7d39b`.

The independent reviewer found the original per-tick visibility refresh error
and verified the corrected native cadence/source provenance without another
game. The shipped helper additionally asserts untouched tick0 input; the actual
recorded pair already starts at tick0. Final review, focused checks, merged source
and sealed artifact identities are retained in the owning PR receipt.

## Scope and owner coordination

The existing headless adapter replaces I/O scheduling only. This uninterrupted
CPU run does not qualify asynchronous intake, process entry, wall-clock pacing,
rendered behavior, deployment or balance. Medium stays human-only. The helper
and this owning evidence/queue are the only new write scope; there are no policy,
engine, admission, map, movement or shared-fixture edits.

Active movement [PR364](https://github.com/lbeezr/thousand-unit-skirmish/pull/364#issuecomment-5983720778)
retains fractional Move, publication and checkpoint work. Any concrete route
failure is retained and sent to that owner rather than patched here. Source
qualification, admission, deployed identity and rendered acceptance stay distinct.
PR364 subsequently merged as `04592d38`, changing shared native movement after
the exact source used here. This retained pair does not qualify that later engine
or any later main revision. No additional full game or admission change is folded
into this evidence milestone; the original ceiling and Medium boundary remain.
