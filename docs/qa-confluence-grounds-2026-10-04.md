# Confluence Grounds admitted Practice arena — 4 October 2026

[Map catalog](maps.md) · [Tier policy](map-size-tiers.md) · [Continuing work](map-scale-playability-backlog.md)

The user's 160 minimum applies to ordinary Practice as well as ordinary human
matches. Retaining existing compact Lab identities does not fulfill this outcome.
This slice authors `siltmouths-confluence-grounds`, a new useful 160 × 160 testing
arena, and retains the old canonical maps/checkpoints. It does not edit Terraced
Vale's resources; the wildlife owner retains the ordinary Tiny Sheep change.

## Authored layout and measured geometry

[Layout schematic](confluence-grounds-layout.svg) shows the actual authored cells,
home/expansion campuses, Dock pads and finite resources. This is a source layout,
not a rendered in-game screenshot.

The map has connected southern fishing bays, legal Dock banks, two broad fords
and high northern/southern land alternatives. Flat 41 × 41 home campuses and
19 × 19 expansion clearings supply building room. Ground levels remain the
engine's single 0/1/2 layer; there are no stacked bridges, underpasses or caves.
Adjacent one-level steps are traversable; direct 0↔2 transitions are cliffs.
Raised ground adds one sight cell, with no authored height damage bonus. Mixed
height building footprints are currently permitted by runtime, so the arena
deliberately provides flat building pads.

| Measurement | Result |
| --- | --- |
| Gross dimensions / area | 160 × 160 world units / 25,600 cells; one world unit per cell |
| Initial usable land / build-eligible ground | 16,754 (65.4%) / 16,728 (65.3%) |
| Reachable land from either seat | All 16,754 initially usable cells |
| Water / harvestable forest | 4,218 / 4,596 cells; forest potential 27,576 wood at six wood/cell |
| Static shortest elevation-cost base route | 135 units, cost 13,515; Worker/Infantry 51.923 s, Scout 30 s |
| Forest-cleared base route | 131 units; Worker/Infantry 50.385 s, Scout 29.111 s |
| Center crossings | North rim 10 rows, north ford 15, south ford 13, south rim 16 |
| Forced alternate base routes | North ford 135 units, south ford 153, north rim 259, south rim 293; static cardinal routes with all other center crossings masked |
| Flat city packing | Both seats fit the audit's 30-building template with circulation rings and 96 added house population |
| Water graph | 3,632 cells with one-cell clearance; both Dock exits and both shore-fish approaches connected |
| Ordinary opening | 24 total units; each seat 150 food, 250 wood, zero Stone; fog enabled |
| Finite ordinary nodes | 3,420 food, 3,300 wood, 600 Stone; plus paid Farm stock and harvestable forest |

Three neutral 130-food Sheep are authored within 13 world units of each start.
Each home has 200 Stone split 67/67/66; its expansion has another 100. Both
land-side shore-fish markers contain 180 food and are accessible to ordinary
Workers and Skiffs. Fish is one finite shared stock per site. One expansion
campus per seat and two contested ford resources exercise longer economic routes.
This is a testing arena with Authored elimination fallback, not Skirmish or PvE
registry admission and not a supported-capacity claim.

## Repeatable acceptance

Run from the repository root:

```sh
node scripts/generate-confluence-grounds.mjs
node --test scripts/confluence-grounds.test.mjs scripts/map-scale-audit.test.mjs
node scripts/map-scale-audit.mjs --summary-jsonl
node scripts/confluence-grounds-scenario.mjs --output=/tmp/confluence-NEW-evidence
```

The focused tests cover deterministic authoring, resource symmetry/stock,
all-land reachability, four distinct forced crossing alternatives, flat campuses,
city packing, both actual Dock placements and shared navigable fishing bays.
The native scenario uses the actual root Practice DOM handler, creates a public
Practice room and selects the canonical map. It never writes a bank, cargo,
position, resource or checkpoint fixture. The accepted native run at clean source
`38174fc50bcda8d2cba119ff14e2d80034ce3b8a` passes the paid economy, both tower
firing arcs, shared finite fishing, sequential water traversal, cold recovery,
authored reset and one-human clock/movement. Retained
[summary](qa-evidence/confluence-grounds-2026-10-04/summary.json),
[full receipt](qa-evidence/confluence-grounds-2026-10-04/report.json.gz) and
[source hashes](qa-evidence/confluence-grounds-2026-10-04/source-inputs.json)
separate that result from the failed counterflow case. The repeatable audit identifies this row as
`admitted-test-arena`, separately from regional Skirmish candidates and micro Labs.
The refreshed 30-map checkout also identifies Bannerfall as `quick-custom-mode`;
`seededPve` retains the historical two-map pool, while `ordinaryPve` identifies
the separately accepted Tiny/Skirmish AI map. Those identities are distinct from
the new testing arena.
The [static receipt](qa-evidence/confluence-grounds-2026-10-04/static-audit.json)
retains methods, timing assumptions, source hashes and the measured arena row.

Each seat naturally funds 460 wood, 50 food and 50 Stone of paid Farm/Mill/
Watchtower/Dock/Skiff costs. The run verifies rejection of an unfunded tower,
owned-only Farm gathering, nearby Mill food delivery, Sheep carcass harvesting,
and both Skiffs' exact stopped-cargo deposit at an admitted owned Dock berth.
All recorded phases conserve ordinary stock + cargo + bank + paid costs, with
completed Farms adding only their explicit 200-food stock. Cold restart retains
map/match identity, paid buildings, crops, stocks and banks; reset restores the
24-unit authored opening. The guest leaves and the remaining human still moves
a Worker and advances the Practice clock. Full recovery/session checkpoints stay
private; [retained economic state](qa-evidence/confluence-grounds-2026-10-04/retained-economy.json.gz)
contains only the measured economic fields. No AI or human-match acceptance is inferred.
The exact accepted and historical counterflow source commits remain reachable on
the [native evidence branch](https://github.com/lbeezr/thousand-unit-skirmish/tree/codex/evidence-confluence-native-38174fc5).
The economic clock receipt is 436.033 game-seconds across 436.086 wall receipt
seconds (ratio 0.999879), excluding startup/restart/reset. It is a functional
economy run with 24 opening units and two paid Skiffs, not a tick, browser or
capacity benchmark.

## Counterflow collision diagnostic

The native paid run at `61ebee31` reached both own-Dock cargo/bank receipts, then
issued opposing cross-bay Moves simultaneously. Both Skiffs stopped nose-to-nose
near world x −0.42/+0.42, z 40.5. An authoritative checkpoint at tick 14,130
reported both `waterMoveBlocked:true`, with path index 63 of 114; the route-arrival
check ultimately timed out. The static graph is connected and the channel has
room for alternate routes. `water-unit-runtime.advance` waits when the next swept
hull cells are occupied; ordinary Move has no general reciprocal traffic solver.

Retained [failure receipt](qa-evidence/confluence-grounds-2026-10-04/diagnostic-counterflow-timeout.json.gz)
and [extracted checkpoint observation](qa-evidence/confluence-grounds-2026-10-04/counterflow-observation.json)
contain no recovery session state. Reproduce the historical simultaneous case at
the exact committed `61ebee31` scenario, then send the two documented cross-bay
Moves; the current scenario checks those crossings sequentially. Passing
sequential arrivals establishes useful topology, not counterflow capacity.
This slice does not change the collision runtime or hide the failed experiment.
The Skiff runtime owner retains resolution; the existing
[water movement contract](skiff-water-movement.md) and
[selected-group limits](skiff-selected-groups.md) already exclude a general water
traffic solver. A future ordinary naval usability slice should cover reciprocal
passing and unblocking, with the authored arena as a representative fixture.

An earlier [failed harness assertion](qa-evidence/confluence-grounds-2026-10-04/diagnostic-dock-target-cleanup.json.gz)
expected Skiff `dropoffBuildingId` to survive a completed return. Runtime correctly
clears that completed target. The corrected proof verifies the prior owned Dock,
actual admitted berth arrival, exact bank delta and repeat-return rejection.

## Integration and remaining acceptance

Map author owns this source, checks, independent review, merge and release inclusion.
Mode owner task `01a103cc` owns removal of the ordinary Practice size exemption in
catalog projection, selection and publication; entry owner branch
`codex/match-mode-entry-ui-v1` owns normal presentation. Proposed exact interfaces
are recorded on [PR242](https://github.com/lbeezr/thousand-unit-skirmish/pull/242#issuecomment-5975590890)
and [PR198](https://github.com/lbeezr/thousand-unit-skirmish/pull/198#issuecomment-5975591347).
Keep explicit internal fixture access and compact restored current identities;
do not delete, rename or silently resize old maps/saves.

A bounded local Chromium launch on this environment failed before navigation:
the SUID sandbox helper was misconfigured and Chromium aborted. There is no
rendered screenshot or browser frame/pointer/minimap acceptance. Delivery owner
task `01a10227-2c6d` retains identified staging deployment and native-browser
follow-up. A source layout schematic, local native receipt or release pack cannot
substitute for those checks. Human balance, representative large-city/unit loads
and supported capacity remain open. Medium/Large continue as separate authored
slices; XL still requires a widened visibility index and bounded cache design.

The docs-only [XL visibility design PR252](https://github.com/lbeezr/thousand-unit-skirmish/pull/252)
merged at `42016cf8e9869c0724c355fdefc65b7136678072` after independent exact-head
review. It proposes 32-bit indices, an 8 MiB live payload / 8,192-entry cache,
deterministic eviction and explicit same-tick geometry invalidation. It changes
no runtime index, cache or validator; implementation/budgets remain future work.

Broader focused checks passed 20 of 21 cases. The remaining pre-existing Stone
lobby regression still expects compact `stone-defense-field` in a normal managed
room. That expectation conflicts with the already-applied ordinary human floor;
the mode/floor owner needs an explicit internal-fixture regression path. The
exact source/test boundary and receiving action are recorded on
[PR251](https://github.com/lbeezr/thousand-unit-skirmish/pull/251#issuecomment-5975904210)
and [PR250](https://github.com/lbeezr/thousand-unit-skirmish/pull/250#issuecomment-5975956800).
Do not reopen compact ordinary eligibility to satisfy the old assertion.

The latest read-only staging deployment listing still reports SUCCESS
deployment `e541d903-178b-47cb-8d1b-4358c93c5a8a` with source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, which predates this arena and the
Tiny/Small migrations. This is metadata only; no source merge or local release
pack is treated as deployed acceptance, and no staging configuration is changed
by this slice.
