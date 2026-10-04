# Small Threefold Basin — 4 October 2026

[Map](../maps/veyrholds-threefold-basin.json) · [Generator](../scripts/generate-threefold-basin.mjs) · [Grid/XL audit](map-grid-limit-audit-2026-10-04.md) · [Continuing stream](map-scale-playability-backlog.md)

One authored 192×192 Small map adds useful playable area to Tiny rather than
stretching its terrain or adding an empty border. It retains ordinary 24 total
units,150 food/250 wood per seat, existing Veyrholds audio, fog and canonical
elimination. Three capture posts are bonuses; no ownership/deadline can win.
No defaults, selectors, registry, prices, cell sizes, speeds or validator limits
are edited by this slice. Those bindings remain with mode/entry owners.

The 32,798 initially walkable cells are all connected for both seats (89.0% of
the grid). Static eligible building ground covers 88.1%; flat legal centers are
reported separately for each footprint. Base travel is 157 world units: 60.385 Worker/Infantry seconds,
34.889 Scout seconds. Clearing every forest leaves that route unchanged.
Two 16-row valley crossings provide 157-unit alternatives, the 15-row raised
southern causeway 239, and the 10-row high northern flank 245. These are verified
complete forced alternatives, not a global minimum-cut or proof that armies
use every lane. Levels 0/1/2 remain one walkable layer. Home campuses are 45×45;
each seat fits the static 30-building template with circulation space.

Each seat has three 9×9 flat expansion rings, at shelf, basin and southern
causeway sites. Resource markers sit outside those rings. Home food/wood
access remains 12 cells. Expansion food/wood routes progress 55/67,80/92,
114/126 cells. Finite map stock is 9,700 food/11,950 wood, plus 24,204 forest
wood potential; Tiny has 6,100/7,950 finite stock. This is explicit economic-site
authoring, not an area multiplier or maximum city/capacity claim.

## Evidence scope and repeat

Static tests check deterministic generation, ordinary rules/audio, whole-map
connectivity, forest-clear pacing, four forced routes, mirrored resource access,
developed-city geometry and six expansion rings. The existing paid driver now
accepts a Tiny/Small map ID; its default preserves Tiny's established reproduction.
Small uses its actual base/campus/resource locations without economy injection.
The 29 focused audit/map/policy/grid/checker tests and 14 regional reachability
cases passed before the later ordinary-floor integration; final integration
checks are recorded with the reviewed PR head.

The separate capacity harness starts a fresh disposable two-seat server per
load, uses existing army-size diagnostics above 24, and sends three target-region
order waves. Each lasts at least 300 game ticks after a conservative post-acceptance
checkpoint. It records final-notice receipt,
first observed movement receipt, own-seat movement, computed paths/route failures,
tick/start lag/skips, checkpoint clocks/costs, server versus collector RSS,
compressed payload/wire deltas and same-seat cold recovery. It preserves full
raw health samples and failures, stops at a configured RSS ceiling and cleans
only its own temporary workers/files. Loads do not silently become paid armies.

These windows replace unfinished routes. They do not establish full army
arrival, particular crossing use, mass combat, paid city growth, browser costs,
human decisions or supported capacity. The host is shared and not isolated;
performance samples are diagnostic, not admitted hardware comparisons. Full
paid 24-unit movement/economy/combat/recovery is a separate source-qualified
receipt. Deployment and rendered acceptance remain open in this executor.

```sh
node scripts/generate-threefold-basin.mjs
node --test scripts/threefold-basin.test.mjs scripts/terraced-vale.test.mjs scripts/map-size-policy.test.mjs scripts/map-scale-audit.test.mjs scripts/map-grid-cost-audit.test.mjs scripts/map-capacity-report-check.test.mjs
node scripts/vaelora-map-layout-scenario.mjs --check-only
node scripts/terraced-vale-native-scenario.mjs veyrholds-threefold-basin
node scripts/map-capacity-scenario.mjs --loads 24,250,500,1000,2000 --output /tmp/small-capacity
```

## Accepted receipts

[Raw evidence, source identities, hashes and repeat commands](qa-evidence/threefold-basin-2026-10-04/README.md)
preserve these distinct sources. The candidate SHA-256 is
`6d9769ce30a1da374ffa41660dd99a804fd078a6f706113ddce40e1785e3ba0b`.

- Paid native source `6c7d86047d937aba2c6723c2eea25fd79dc0c013`: both seats
  entered normally with private fog, built paid Stables, trained paid Scouts,
  deposited food and gathered expansion funding. Workers crossed in 59.433/60.233
  game seconds (59.383/60.184 wall); Infantry in 58.633/59.433 game seconds.
  Scouts crossed in 31.9/32.8 seconds from their actual producer exits, which
  differ from the static base-anchor endpoints. Both seats funded and completed
  expansion Town Centers at 262.5/267.3 seconds, then Houses at 272.6/278.0.
  Explicit building attacks caused damage; cold recovery, rematch and one-human
  Practice passed. This is bounded building-assault acceptance, not a full battle.
- Clean ladder source `7afd398242a5a2d84719110c422faf850e1885d3`: 24, 250, 500,
  1,000 and 2,000 total units, three waves per load. Every wave moved all actors,
  produced two computed plans with zero route failures and observed at least
  300 game ticks after the conservative acceptance checkpoint. All five cold
  recoveries passed. Every measured wave had zero skipped-slot delta; the 2,000
  load had one skipped preparation slot at tick 4.
- Guarded harness smoke source `f03da8b6e3529da4fbfd53c14b62ffd8974dc739`:
  all three 24-unit waves and recovery passed after adding continuous planning
  sampling and synchronizing both map-change receipts. Earlier failed smoke
  reports retain the peer-state race and an inappropriate future-only snapshot
  wait; neither is accepted evidence. The full ladder is not attributed to this
  later harness source.
- Offline envelope evaluator source `536f3e2e70d98efff40bd997db0c4594d37a3124`:
  every retained rolling duration/lag window and every planning maximum passes.
  One 2,000-unit cold-recovery first-tick sample has no preceding tick for lag;
  that exact initialization shape is counted explicitly, with duration still
  checked. Missing ordinary timing or planning telemetry fails.
- Packed entry source `fafbd7d7206885ed8f7a86cf1d5de27c552d0bee`, release digest
  `sha256:3f2cbc1780b370229deac597e429cefe12706b7ecff9acce3bab6d98370082e0`:
  the packed server selected Small from its normal catalog, returned a 192×192
  map and 9,216-byte private fog, and completed a one-human Practice Worker
  move in 4.033 game seconds. This is local native protocol acceptance.
- Post-floor integration source `4c0a6d0f0cba1c1d6545359a73c14af18c2499b4`:
  55 focused tests, 14 regional reachability cases, types/import graph/docs
  passed. The corrected 24-unit fixture completed all three waves and cold
  recovery. Packed Authored Practice completed the Small Worker move in 4.067
  game seconds, with digest
  `sha256:a30d0c18ec06e9ed3cb6ead51260b62f52cc3975852d88ea9df23ea6d8a3e660`.
  The separate ordinary Small paid-entry attempt reports the missing Skirmish
  binding and is retained as blocked evidence, not an accepted paid rerun.

| Total units | Peak server RSS, MiB | Peak save, bytes | Longest final notice, ms | Steady final-window tick p95 peak, ms |
| ---: | ---: | ---: | ---: | ---: |
| 24 | 101.6 | 200,013 | 29.0 | 1.410 |
| 250 | 137.9 | 616,163 | 231.1 | 2.300 |
| 500 | 131.2 | 1,083,438 | 428.0 | 2.946 |
| 1,000 | 155.6 | 2,052,280 | 826.6 | 4.648 |
| 2,000 | 232.1 | 4,008,144 | 1,849.5 | 7.912 |

The 2,000-unit all-captured duration maximum is 15.404 ms and start-lag maximum
32.432 ms; these include partial preparation/recovery windows, unlike the table's
final 300-tick percentiles. For the 2,000 load, maximum captured checkpoint
capture/serialization/write costs are 4.052/13.262/4.257 ms. Clock factors were approximately
0.99945–0.99991. Two-peer compressed wire deltas were 2.82–3.58 MB per measured
2,000-unit wave over approximately 11–12 seconds, including WebSocket framing
and excluding TCP/TLS overhead. Healthy
ticks do not remove the 1.85-second order-notice latency.

The first load also activates the 256×256 validator fixture before restoring
Small; that setup can affect RSS. This shared-host run does not support an
admitted comparison against Tiny or any other hardware/map, and is not a unit
capacity recommendation. Full army arrival, mass combat, paid city growth and
rendered two-seat play remain benchmark work.

## Elevation and receiving-owner work

Elevation capabilities were reported before authoring this larger candidate.
Levels 0/1/2 describe a single ground layer. Adjacent one-level changes can be
walked; a direct 0↔2 cliff blocks travel. There are no stacked bridge routes,
underpasses or caves. Raised ground adds one sight cell; range and damage remain
planar, with no height damage bonus or physical terrain-intersection projectiles.
Runtime building placement does not require one level across its footprint, so
the candidate deliberately authors flat home and expansion campuses.

Mode owner `01a103cc` merged the ordinary 160 floor and Tiny default in
[PR 229](https://github.com/lbeezr/thousand-unit-skirmish/pull/229). This candidate
is integrated with that source while preserving historical receipt identities.
Small's ordinary Skirmish allowlist entry remains a receiving-owner change;
the current paid CLI reports that missing binding immediately rather than
timing out or substituting fixture acceptance. This PR does not edit the
registry or defaults. The exact
Small ID and descriptor contract are recorded on
[PR 200](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975173880).
The post-floor exact registry dependency is recorded in the
[receiving-owner follow-up](https://github.com/lbeezr/thousand-unit-skirmish/pull/200#issuecomment-5975383352).
Entry PR 198 retains all 13 authored Practice Labs, so the condition requiring
160-side replacements to avoid an empty public Lab catalog has not occurred.
The conditional scenario priorities recorded with that owner are Shore Fishing
first, then Forest Clearing; original microfixture IDs and recovery records stay
available for their existing tests.

Staging observation on 4 October remained successful deployment
`e541d903-178b-47cb-8d1b-4358c93c5a8a`, source
`64cc391e6d9c4164dca7bd45696cf3862fe19729`, which predates Tiny, Small and the new
entry UI. Delivery coordinator `01a10227-2c6d` owns the consolidated staging
revision and Native Mac rendered acceptance. This executor's Chromium exits
before navigation and external hosted requests fail at its proxy/DNS boundary.
Local acceptance and merge do not establish deployment, appearance or the
ordinary baseline binding. The continuing stream remains open for those results.
