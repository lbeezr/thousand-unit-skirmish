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
position, resource or checkpoint fixture. Native paid economy, firing, fishing,
water traversal and recovery/reset results are pending until retained receipts
are recorded here. The repeatable audit identifies this row as
`admitted-test-arena`, separately from regional Skirmish candidates and micro Labs.
The [static receipt](qa-evidence/confluence-grounds-2026-10-04/static-audit.json)
retains methods, timing assumptions, source hashes and the measured arena row.

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
