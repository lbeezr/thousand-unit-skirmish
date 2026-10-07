# Tiny home resource groves — 7 October 2026

Owner: resource placement lane. Scope: fresh default Terraced Vale home Wood registration,
with exact historical checkpoint compatibility. Proposed roadmap update belongs to the
integration parent; this note does not edit shared coordination or claim reference-game parity.

## Demonstrated gap and bounded treatment

At baseline `86d66396251ff800fe80a4a976b977fab18ab92c`, the four ordinary playable
map generators replay exactly and have symmetric home access. Tiny/Small/Medium/Large
have 12/16/18/22 ordinary nodes, 6,100/9,700/12,100/19,700 Food and
7,950/11,950/14,950/24,150 ordinary Wood. Initial forest cells are
3,162/4,034/6,410/8,226, separately worth six Wood each. Cardinal elevation floods
with initial Town Centers reach every ordinary node from both seats. Every forest
component exposes an accessible frontier; iterative cutting exposes every forest cell.
This static result does not measure harvest throughput, camera visibility or appearance.

Every ordinary Wood anchor has zero other Wood nodes within its existing eight-unit
work area. Baseline native default HTTP/WS Gather admission, followed by unchanged
production fixed ticks through the full 975 stock per seat, targets only that singleton.
Both opening banks end at 1,225 Wood and the exhausted assignment has no local replacement.
The resource budget is adequate; this slice addresses the sparse local registration.

Fresh Tiny changes only the two home Wood patches to three 325-stock nodes each:
12 → 16 total ordinary nodes and 6 → 10 Wood nodes. All 7,950 ordinary Wood,
6,100 Food, 3,162 forest cells, anchor IDs/positions, expansion pockets, starting banks,
terrain, objectives and map identity remain unchanged. Each home anchor gains two
registered replacements in radius four, using terrain seed 93025 and the existing
seeded mirrored placement helper. Other tiers and expansion singleton patches remain
unchanged. This is deliberately an opening slice, not a general density/balance retune.

Existing [regional environment and lifecycle art](environment-pack-v1.md#veyrholds-highpine-lifecycle--30-september-2026)
and [fixed-camera construction](art-direction/environment-camera-v1/README.md)
back the retained regional assets and small grove composition. No artwork, private
source, tree renderer, HUD, audio, movement or collision behavior changes. The bounded
comparison is one existing patch versus three registered markers sharing its exact
stock; actual grove appearance still requires ordinary rendered frames.

## Recovery contract

Do not insert fresh-map satellites into ongoing saves: a legal paid House can occupy
either proposed satellite site on the old map. Exact historical-definition compatibility,
following the existing Confluence contract, retains the old 12-node geometry, stocks,
orders, cargo, banks, buildings and moved/herded Sheep. Fresh games and explicit resets
adopt the grove. Pre-Sheep checkpoints migrate only their four food identities to the
exact historical Sheep layout, then use the same historical admission. Pinned old-map
hashes and exact reconstruction reject unrelated/modified definitions. The server change
is limited to that compatibility import and guard, disjoint from held movement PR hunks.

## Acceptance and delivery boundaries

Registered Tiny tests exercise generator replay, mirrored node reachability, same
surface elevation, six-cell satellite spawn clearance, unchanged expansion Town Center
pads/circulation rings and existing city capacity, total stock and local continuation.
Production replay creates a real paid House at each of the four future satellite sites
and recovers the exact old checkpoint, including its resource geometry and paid bank.
The registered both-seat grove scenario admits normal HTTP/WS Gather commands, then
uses unchanged production fixed ticks to deplete all three full-stock nodes without
another order. It verifies partial/depleted recovery and stock+bank+cargo conservation.
Fixed ticks are a source-copy simulation adapter, not native real-time full depletion.

Run `node --test scripts/terraced-vale.test.mjs scripts/terraced-vale-sheep.test.mjs scripts/terraced-vale-sheep-entry.test.mjs`,
`node scripts/terraced-vale-groves-scenario.mjs` and the existing
`node scripts/terraced-vale-sheep-scenario.mjs`; the grove scenario is registered through
the Tiny test file, without editing the shared CI registry. Required repository checks,
independent review, clean release identity and final head evidence accompany the PR.
Baseline CI exceptions for PRs 602–604 do not extend to this slice.

Source completion, clean packaging, provider deployment and ordinary rendered/game
acceptance are separate. Draft publication requests coordinated integration; it does not
claim merge, provider rollout, visual acceptance, unassisted usability or throughput parity.
The resource placement owner retains those checks after integration; the parent owns
coordinated merge timing. Private raw evidence remains in the cloud task workspace.
