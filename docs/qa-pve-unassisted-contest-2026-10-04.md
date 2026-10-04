# Predeclared unassisted Tiny contest

Opponent AI owner `01a10297`, 4 October 2026. This source qualification follows
the [controlled loss proof](qa-pve-contested-wood-2026-10-04.md). It is one
matchup and its exact replay, not a balance or difficulty experiment. Art backing
is N/A. Results are pending at this pre-execution checkpoint.

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
are `skirmish@1`. The fixed canonical map retains terrain seed93025 and normal
24-unit opening with150Food/250Wood per seat. No generated-map selection is
performed by this headless fixture. Map/source/opening hashes are retained.

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
reported separately from actual delivered cargo. Command-debit totals are not
a complete resource conservation ledger.

## Scope and owner coordination

The existing headless adapter replaces I/O scheduling only. This uninterrupted
CPU run does not qualify asynchronous intake, process entry, wall-clock pacing,
rendered behavior, deployment or balance. Medium stays human-only. The helper
and this owning evidence are the only new write scope; there are no policy,
engine, admission, map, movement or shared-fixture edits.

Active movement [PR364](https://github.com/lbeezr/thousand-unit-skirmish/pull/364#issuecomment-5983720778)
retains fractional Move, publication and checkpoint work. Any concrete route
failure is retained and sent to that owner rather than patched here. Source
qualification, admission, deployed identity and rendered acceptance stay distinct.
