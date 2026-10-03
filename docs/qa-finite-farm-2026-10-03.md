# Paid finite Farm validation — 3 October 2026

[Farm contract](farm-finite-planting.md) · [Balance](first-skirmish-balance.md) · [Testing](testing.md)

The provisional 60-wood / 15-Worker-second / 200-food / 600-HP Farm is a paid,
owner-harvested finite source in Frontier. Native commands prove stock and
payment conservation, recovery, clearing/replanting and Mill delivery. No human
match, rendered appearance or final balance acceptance is claimed.

## Clean source evidence

Node 24.19.0, disposable local authoritative rooms, normal simulation speed.
Opening army is 24 total units (four Workers per seat, plus initial military),
not 24 Workers. Each native Farm seat starts at 300 food / 600 wood on a flat
64 × 64 map without authored resource nodes.

| Proof | Clean source | Result |
| --- | --- | --- |
| Farm lifecycle, both seats | `823a0afd4712ffe1ab8e18a696785d6b69796f0d` | All twelve conservation stages passed; [raw record](qa-evidence/finite-farm-2026-10-03/farm-823a0af.json). |
| Fogged Farm lifecycle and real owned-source AI observations, both seats | `1aa5e3420728cf33aee3b277850f5581028a7863` | All twelve stages passed, including actual wire → observation → deterministic Gather; [raw record](qa-evidence/finite-farm-2026-10-03/farm-fog-1aa5e34.json). |
| Complete paid land settlement, ordinary dispatch order | `319bbdef97caf214134223d7a185ad8c0489f1b6` | 56 paid commands, 271.668 seconds; [manifest](qa-evidence/finite-farm-2026-10-03/settlement-319bbde-normal.json). |
| Same settlement, reversed seat dispatch order | `319bbdef97caf214134223d7a185ad8c0489f1b6` | 56 paid commands, 271.928 seconds; [manifest](qa-evidence/finite-farm-2026-10-03/settlement-319bbde-reverse.json). |
| Existing Mill lifecycle and actual paid Skiff recovery | `823a0afd4712ffe1ab8e18a696785d6b69796f0d` | Both native scenarios passed. Skiff checkpoint was repinned to exact pre-Farm Skiff content, preserving match ID, boats, paid queues and banks. |

The complete land fixture includes Farm and Palisade Gate along with every other
ordinary land building, all seven land unit roles and all six technologies. Dock
and Skiff use the separate shoreline/water fixture. Each seat spends 1,385 food
and 2,795 wood; population remains 23 used / 44 capacity. All 3,812 free cells
remain connected around 284 occupied cells. Unharvested Farm stock remains 200;
authored-node stock, cargo and banks reconcile separately. Restart retains
research, paid queues, unit identity and both cargo types; reset returns the
opening authored stock, army and banks. Settlement checkpoints remain local
artifacts; their SHA-256 provenance is recorded in the manifests.

## Farm conservation and review

The native Farm scenario preserves a real paid Mill save across the exact
pre-Farm content pin, restarts unfinished paid Farm construction, and creates
stock only on completion. Foreign harvest/cancel and productive-complete cancel
are rejected. Stop retains real crop cargo; Return cargo delivers it to Mill
without duplicate credit. Each planting depletes to exactly zero and deposits
its 200-food supply. Exhausted clear gives no refund; partial cancellation uses
the proportional wood refund and creates no food. Paid replanting uses a fresh
building/source ID and another 200 stock.

Destruction uses a declared low-HP Farm and positions two existing initial
Infantry for actual attack orders. It injects no bank, cargo, crop stock or new
unit. Remaining crop is lost; already-carried food is conserved and delivered.
Recovery preserves final bank credit and absence of the Farm. Floating budget
checks tolerate accumulated arithmetic noise; depleted crop stock is exactly
zero. Full Farm runs at both recorded revisions passed.

Independent review reproduced two approach failures: an isolated center-adjacent
pocket and a new building obstructing a Worker path. Farm now admits and routes
against its reachable perimeter, including after obstruction. Independent real
commands verified both fixes and a complete exhaustion/clear/replant cycle.
Review also confirmed twenty-four migration assertions and exact equality of
Farm-free definitions with the pre-Farm Skiff content pin.

A further review reproduced fogged owned Farms missing from AI observations:
the occupied center cell can be hidden even though the server publishes the
owned structure. The adapter now admits validated owned Farm sources under
owned-building visibility, retaining neutral-node and enemy filtering. Both-seat
fogged adapter tests pass. The clean native fogged run at `1aa5e34` also passed
the complete lifecycle with actual owned-source policy observations on both
seats. The earlier runs disable fog and do not prove that fix.

At `823a0af`, 74 focused Farm, registry, menu, settlement, Mill, Return cargo,
worker audio/fishing and Gate/Skiff contract tests passed. The served-import
check initially caught the missing Farm module allowlist entry; after adding it,
all 89 imported client modules were served. No static-load failure remains.

At `1aa5e34`, the same 74 focused checks passed with fog filtering coverage;
all 90 imported client modules were served after the latest main integration.
Documentation checks passed (456 Markdown files, 2,993 local links). The native
PvE WebSocket smoke also passed both bot seats with an injected fake provider;
no paid provider request was made.

## Reproduce and next observations

```sh
node --test scripts/farm-harvest.test.mjs scripts/farm-client.test.mjs scripts/roster-building-ui.test.mjs scripts/mature-settlement-scenario.test.mjs
node scripts/farm-scenario.mjs --output=NEW_DIRECTORY
node scripts/farm-scenario.mjs --fog --output=ANOTHER_NEW_DIRECTORY
node scripts/mature-settlement-scenario.mjs
node scripts/mature-settlement-scenario.mjs --reverse-seats
node scripts/mill-scenario.mjs
node scripts/skiff-scenario.mjs
node scripts/client-asset-allowlist-scenario.mjs
npm run docs:check
```

Next content backlog: compare Farm/neutral-source trips and raid exposure in
seat-swapped human matches; add bounded AI paid planting/replanting only after
that observation; produce distinct productive/exhausted crop art within the
actual 3 × 3 footprint. The [single-Stone recommendation](stone-defense-contract-proposal.md)
is separate: typed node/cargo/bank/payment/refund/recovery must exist before
mineral admission, with preserved baseline prices and no extra metal ledgers.
