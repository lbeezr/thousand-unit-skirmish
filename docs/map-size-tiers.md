# Ordinary map size tiers and migration

[Measured prior catalog](qa-map-scale-2026-10-03.md) · [Continuing map work](map-scale-playability-backlog.md) · [Mode contract](match-mode-contract.md)

The user requires **160 × 160 as the minimum ordinary playable map**, superseding
the prior compact normal roster. Tiny is the minimum, followed by Small, Medium,
Large and XL. Dimensions below are targets, not supported-capacity claims.

| Tier | World/cell dimensions | Built-TC widths per side (5-cell footprint) | Gross built-TC areas | Base-path target / Worker travel | Raw packed fog per seat |
| --- | --- | ---: | ---: | --- | ---: |
| Tiny | 160 × 160 | 32 | 1,024 | 130–156 units / 50–60 s | 6,400 bytes |
| Small | 192 × 192 | 38.4 | 1,474.56 | 156–195 / 60–75 s | 9,216 |
| Medium | 224 × 224 | 44.8 | 2,007.04 | 195–234 / 75–90 s | 12,544 |
| Large | 256 × 256 | 51.2 | 2,621.44 | 234–273 / 90–105 s | 16,384 |
| XL | 320 × 320 — future | 64 | 4,096 | 273–325 / 105–125 s | 25,600 |

One cell is one world unit. Worker/Infantry speed is 2.6 units/game-second and
Scout speed is 4.5. Gross area/HQ envelopes are only normalization; cliffs,
forests, resources, production exits and routes determine usable land. Existing
home TCs have a different 4 × 4 footprint. Map dimensions are not equivalent to
AoE/WC3 tiles. Actual arrival requires native route/collision/clock measurement.

The current validator accepts at most 256 on either axis: **XL 320 is blocked**
until a separately reviewed grid-limit, memory/path/visibility/transport/browser
capacity slice passes. [The source-bound XL audit](map-grid-limit-audit-2026-10-04.md)
also demonstrates wrapped 16-bit vision indices and projects cache/path/render
costs. Small now has an authored [Threefold Basin candidate](qa-threefold-basin-2026-10-04.md).
Medium now has authored [Riven Escarpment](qa-riven-escarpment-2026-10-04.md),
admitted for [ordinary human Skirmish](qa-medium-skirmish-admission-2026-10-04.md)
with a static 207-unit / 79.615-second Worker route. Large remains unauthored; no tier
has a supported-capacity claim. [Existing elevation](map-elevation-capabilities.md)
supports these layouts within its current three-level, single-surface contract.
The first Tiny candidate is Terraced Vale; its static base route is 133 units,
51.154 s Worker/Infantry, 29.556 s Scout. Native acceptance is recorded separately.

## Shared catalog fields

[Pure policy](../src/map-size-policy.mjs) exports `MAP_SIZE_TIERS`,
`mapSizeIdentity(map)` and `ordinaryMapCatalog(maps, currentMapId)`.
The runtime supplies canonical descriptors for ordinary selection. Eligible
160-side Labs retain their authored Objective Control identity; compact Labs
remain available as explicit internal fixtures and legacy saves. Ordinary Practice
must also meet the 160 floor. [Confluence Grounds](qa-confluence-grounds-2026-10-04.md)
is the new multi-purpose admitted testing arena. Size eligibility does not
admit a map to Skirmish without its registry binding.
Each descriptor adds exact `width`, `height`, `sizeTierId`, `sizeTierLabel`,
`ordinarySelectable`, `supportedUnitCapacity: null`; the catalog helper also
adds `selectable` and `legacyCurrent`. Rectangles use the shorter side's tier;
both axes must be ≥160 and ≤256 for current ordinary eligibility. Tier identity
does not certify a map's gameplay or performance.

The canonical map loader and checkpoint validator retain all old JSON files.
Normal choices omit smaller maps. A currently restored small map remains an
honest current item with `selectable:false, legacyCurrent:true`; no forced remap,
lost session, modified terrain/resource state or deleted authored save. New
selection and fresh defaults must consume the same server-owned policy. Legacy
internal test launches remain explicit fixtures, separate from ordinary entry.

The runtime consumes this policy for ordinary server projection and selection.
Fresh normal two-seat entry uses Terraced Vale/Skirmish; Authored Practice starts
on the same Tiny map. The floor record predates the user's explicit clarification
that ordinary Practice also needs 160 arenas; the mode owner must remove the
`soloPractice` exemption while preserving the explicit `internalFixture` route.
See the
[floor acceptance record](qa-ordinary-map-floor-2026-10-04.md). Mode runtime
owner task `01a103cc` owns server projection/selection and registry compatibility;
entry owner branch `codex/match-mode-entry-ui-v1` owns the normal selectors and
Practice entry. Agreement is recorded on [PR176](https://github.com/lbeezr/thousand-unit-skirmish/pull/176#issuecomment-5974560958)
and [Practice PR155](https://github.com/lbeezr/thousand-unit-skirmish/pull/155#issuecomment-5974561478).
Preserve one-human Practice, ready/start/rematch and current legacy room identity.
Historical seeded PvE maps are both smaller than 160 and remain resumable with
their exact pool, identity and seeds. Fresh ordinary AI now selects only accepted
Terraced Vale160/Skirmish@1. Status exposes `ordinarySetup.pve.available:true`,
the exact map/pair and its one-entry `supportedMapIds`. Human-compatible Small
and Medium do not acquire AI support. [Admission proof](qa-tiny-skirmish-pve-admission-2026-10-04.md)
retains rendered/deployed acceptance as an incomplete owned step.

## Progressive authoring and capacity gates

Each larger fixture must reauthor base campuses, expansion count/stock and
placement, passes, alternate routes, traversable ramps, forests and contested
space. Keep home access near 10–15 route cells; add useful expansion decisions
rather than empty borders. Start Small with a third reachable pocket per seat;
evaluate a fourth for Large and fifth for XL only through real match evidence.
Keep ordinary opening banks/units until a measured economic problem warrants
retuning. Generated stretching and multiplying every stock by area are not proofs.

For each tier, verify all four route alternatives and flat home/expansion campuses;
then use real paid building/harvesting/production, actual Worker/Infantry/Scout
arrival, both-seat fog and recovery/rematch. Compare 24/250/500/1,000-unit matches
with three route waves; keep 2,000 as a diagnostic ceiling. Record game/wall ratio,
first application/notice/arrival separately, A* expansions, tick/start-lag/skips,
vision, checkpoint, compressed snapshots and browser frame/memory/minimap behavior.
Existing native limits remain p95 33.333 ms and maximum 100 ms. Browser/hosting/
network capacity requires named devices and player-facing budgets. A short
fog-disabled native pass does not establish any supported unit count.
