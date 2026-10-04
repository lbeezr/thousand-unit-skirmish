# Threefold Basin evidence — 4 October 2026

[QA findings](../../qa-threefold-basin-2026-10-04.md) · [Hashes](manifest.json)

This directory preserves source-qualified evidence for the authored Small 192
candidate. Sources are intentionally distinct; later evaluator and smoke results
do not relabel the earlier full native/ladder runs as final-source performance.

| Artifact | Source / interpretation |
| --- | --- |
| `native-paid.jsonl` | Paid movement, economy, building assault, recovery/reset/Practice at `6c7d86047d937aba2c6723c2eea25fd79dc0c013`; final record passed. |
| `capacity-report.json.gz`, `ladder-*-server.log` | Full clean five-load ladder at `7afd398242a5a2d84719110c422faf850e1885d3`; raw health/checkpoint/path/network samples retained. |
| `capacity-summary.json`, `capacity-envelope.json` | Derived summary and all-retained-window evaluation; no admitted hardware comparison or capacity claim. |
| `final-24-report.json.gz`, `final-24-envelope.json`, `final-24-server.log` | Corrected both-peer synchronization and continuous planning monitoring, clean source `f03da8b6e3529da4fbfd53c14b62ffd8974dc739`; three waves/recovery passed. |
| `snapshot-race-report.json.gz` | Rejected smoke at `883b43008962336dcf9728f236dcd05a695bef14`: second peer's previous 256-side fog snapshot was inspected before its Small map-change receipt. |
| `paused-clock-wait-report.json.gz` | Rejected smoke at `fafbd7d7206885ed8f7a86cf1d5de27c552d0bee`: future-only periodic snapshot wait timed out during pregame. |
| `grid-cost.json` | Clean source-bound XL/limit arithmetic at `7afd3982`; partial resident costs and conservative bounds, not measured renderer/RSS capacity. |
| `static-map.json` | Small map plus audit methods/input hashes, source `536f3e2e`; source-reading geometry, not native performance. |
| `release-identity.json`, `packed-entry.json`, `packed-entry-reproduction.mjs` | Packed source `fafbd7d7`, digest recorded; local normal catalog/private fog/one-human Practice passed. No hosted/browser verification. |
| `source-input-parity.json` | Exact hashes for four named inputs at the listed native/ladder/packed/later sources. Scope does not include every repository file. |

The full ladder includes one skipped preparation slot in the 2,000-unit run,
but no wave skipped-slot deltas. Its final cold-recovery sample records the first
tick before lag can be observed. The checker explicitly counts that exact
sample-count-one/window-zero/null-lag shape and still gates its finite duration;
ordinary missing timing or planning fields fail. Every retained rolling window
and planning maximum passes evaluator source `536f3e2e`, whose exact script hash
is in the manifest. The earlier ladder predates continuous planning RSS sampling;
the corrected 24-unit smoke exercises that addition separately.

First-load RSS includes prior 256×256 boundary activation. All loads use a shared
Linux host, existing army-size diagnostics and three short replacement waves,
not paid-grown armies or full army arrival. Final notice receipt and observed
movement are client observations, not exact server application timestamps. Map
dimensions, static city fits and probe stop limits are not supported capacity.

Repeat from repository root:

```sh
node scripts/terraced-vale-native-scenario.mjs veyrholds-threefold-basin
node scripts/map-capacity-scenario.mjs --map veyrholds-threefold-basin --loads 24,250,500,1000,2000 --output /tmp/small-capacity
node scripts/map-capacity-report-check.mjs /tmp/small-capacity/report.json
gzip -dc docs/qa-evidence/threefold-basin-2026-10-04/capacity-report.json.gz > /tmp/threefold-basin-retained.json
node scripts/map-capacity-report-check.mjs /tmp/threefold-basin-retained.json
node scripts/map-grid-cost-audit.mjs
node scripts/pack-railway-release.mjs > /tmp/small-release.json
# Pass the pack command's directory field below.
node docs/qa-evidence/threefold-basin-2026-10-04/packed-entry-reproduction.mjs /absolute/packed-release-directory
```

Gzip artifacts decompress to unmodified raw JSON. The manifest hashes stored
bytes, including compressed files. Server logs omit session tokens. Exact commit
checkout is required to reproduce a historical script; current reruns create a
new evidence identity. Hosted deployment and rendered acceptance remain open.
