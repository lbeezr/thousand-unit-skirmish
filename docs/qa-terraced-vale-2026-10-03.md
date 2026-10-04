# Terraced Vale Tiny baseline — 3 October 2026

[Size policy and receiving owners](map-size-tiers.md) · [Continuing work](map-scale-playability-backlog.md) · [PR202](https://github.com/lbeezr/thousand-unit-skirmish/pull/202)

This slice adds one authored ordinary regional map, its deterministic generator,
focused layout checks, repeatable native checks and a pure size-policy module.
The map is selectable through the existing normal server catalog and one-human
Practice. The policy is **not yet bound to fresh defaults, server selection or
UI filtering**; the mode/entry owners retain that receiving integration. Old map
files and checkpoints remain. No simulation cell, unit speed, runtime hotspot,
paid service or asset generation changes are included.

## Authored land, routes and economy

Terraced Vale is 160 × 160 cells/world units: **Tiny**, the new ordinary minimum.
Its map SHA256 is `1d91efb4f377f5c382f5a18e31e30d70efae17fb7434f133b878a2802c309dbd`.
It has level-0 valley ground, level-1 terraces and level-2 rims/ridge, explicit
traversable terrace lips, two broad 15-cell pass alternatives and two 8-cell
high flank alternatives. Each forced crossing independently connects both bases;
these are four verified alternatives, not a global choke/min-cut claim. The audit's
single-column statistic checks immediate edge elevation but omits approach
cliffs/full route connectivity; it is not a pass width.

All 22,406 initially walkable cells are reachable from either seat: **87.5%** of
area. Static building-eligible ground is **86.7%**, excluding forests, homes,
resources and post zones. There are 18,720 flat 3 × 3 footprint centers and 15,554
flat 5 × 5 centers. Existing home TCs occupy 4 × 4; paid new TCs occupy 5 × 5.
Both flat 41 × 41 home campuses fit the static 30-building city template with
one-cell circulation rings, costing 200 food/3,205 wood per seat and adding
96 House population. This is constructive geometry and price accounting;
a paid 30-building city and maximum supported capacity are not claimed.
The engine's 128 added-building limit is shared by both seats.

The 133-unit static base route corresponds to 51.154 game-seconds for Worker
or Infantry (2.6 units/s) and 29.556 for Scout (4.5). Forest clearing does not
shorten it. Each high-flank route is 191 units. Cells are not AoE2/WC3 tiles;
[the reference audit](qa-map-scale-2026-10-03.md#next-larger-map-and-external-comparison)
uses declared clock rates and building envelopes instead.

| Pocket per seat | Finite food / wood | Own-base route to food / wood |
| --- | ---: | ---: |
| Home | 650 / 975 | 12 / 12 |
| Terrace expansion | 1,000 / 1,250 | 36 / 44 |
| Deeper valley expansion | 1,400 / 1,750 | 69 / 77 |

Total finite node stock is 6,100 food/7,950 wood. The 3,162 forest cells have
18,972 potential wood after cutting, separate from ordinary nodes. Two flat
expansion-TC pads per seat include clear circulation rings. Mirrored terrain,
forest, stock and marker access pass. The legacy even-sided home-TC placement
has its existing one-cell mirror asymmetry; equal marker routes still verify.

The opening is 24 total units (4 Workers/8 Infantry per seat), 150 food/250 wood
per seat and fog. Two pass posts award 75 food/50 wood after nine seconds with
five units; they are bonus-only. There is no hold victory, deadline or timed
supply. Canonical recovery-aware elimination applies. Existing regional audio
is reused with its manifest hash; no new audio was generated.

## Native acceptance and diagnostic boundary

The [paid scenario](../scripts/terraced-vale-native-scenario.mjs) starts a disposable
server, selects the map through the normal catalog and uses paid build/train/gather/
move commands on both seats. It measures actual arrival within 0.8 world units,
using tick differences at 30 Hz and monotonic wall time. Worker/Infantry starting
offsets and the Scout's producer exit differ from static spawn-cell anchors.
Early PLANNING notices are excluded from final order-notice receipt latency.
First unit application is not separately timestamped.

Each seat builds a 200-wood Stable, pays 40 food/30 wood for a Scout, deposits
home resources, funds and completes a 100-food/400-wood expansion TC and 75-wood
House. Authoritative checkpoints verify 9/25/9-cell paid footprints. The travel/economy
phase uses ordinary No Attack stance commands to prevent measurement actors
from raiding returning miners. An explicit Infantry attack against each opposing
home TC then verifies building damage before Stop, without claiming elimination. Cold restart
with seat resumption retains the paid expansion; reset restores the same map,
opening banks and 24 units. A separate fresh one-human Practice case starts its
clock and moves a Worker. Both opening views contain 6,400 packed fog bytes and
zero disclosed enemy units. This is protocol/native gameplay, not browser appearance.

Final receipts in the [evidence directory](qa-evidence/terraced-vale-2026-10-03/README.md)
identify their own exact source. Earlier probe failures are retained there: wrong
notice-prefix assumptions and reading footprint data from the public rather than
authoritative checkpoint shape. A subsequent historical-state waiter bug was
fixed before the corrected replay; state waits now use the current snapshot or future
messages and cancel timers when a client closes.

A separate latest-core, fog-enabled 2,000-unit **diagnostic** used the existing
performance collector, one 10-second/300-tick movement window, two compressed
peers and 1 Hz health/checkpoint capture. Both 1,000-unit orders had 1,000 nonempty
paths, zero route failures and all 1,000 own units moving in the first movement
sample. Final order notice was 194.876 ms; path-planning elapsed time was
180.643/183.806 ms, expanding 207,098/206,610 cells. Tick p95/max was
**7.899/16.488 ms**, start-lag p95/max 0.769/1.619 ms; **one skipped slot** was
recorded near startup. Existing p95 33.333/max 100 ms checks passed unchanged.
Opening checkpoint game/wall ratio was 0.99990; the loaded sampled ratio was
1.00011. Those cadence-resolution values do not erase the skipped slot.

The last checkpoint was 2,869,332 bytes, serialization 8.985 ms, write 3.390 ms.
Cumulative compressed wire bytes were 2,626,020 across both peers, including
setup traffic; this is not a browser/network service budget. The slowest captured
tick's vision work was 1.061 ms, not a vision-cost percentile. No full army arrival,
formation spread, mass-army combat, three-wave load sequence, controlled old/new comparison,
human match, browser frame/memory or supported capacity was measured. The shared
host was not isolated, so this sample is not admitted hardware-comparison evidence.

## Release, deployment and appearance

The clean package at source `9a64af8bb8baf45c6b64a115b0093ba8effa7d5c` contains the
identical candidate JSON and pure policy module. Its 1,155-file release digest is
`sha256:d2da3173fcd680f8263e7080a38ca6b1758d96c5c33b64c228d62450976d777c`.
This is a local Docker-input package check, not a published Railway artifact.
The packed-server entry receipt separately verifies actual selection, fog and a
one-human Worker move using that directory.

At the read-only Railway observation, staging deployment
`df65855c-57e3-4979-a345-1c7e83e90173` was SUCCESS with source
`0fb9a3dcc1f93f44b87fe5ea8ab8caabf9da0739`, predating this candidate. Source
configuration follows `lbeezr/thousand-unit-skirmish` main. Recheck the terminal
staging deployment and exact commit after merge; deployment is not inferred.
The selected Linux environment has no Railway CLI; its MCP redeploy operation
reuses an existing build and does not upload this local package.

Chromium preflight exited 134 before loading the game because its installed
SUID sandbox helper is misconfigured. Staging `/ready` curl exited 56 because
the CONNECT proxy returned 403. These are recorded environment blockers;
no sandbox or authentication settings were changed. Deployed selection and
rendered terrain/minimap remain incomplete. Native-Mac/browser follow-up must
verify the identified staging revision, both-seat routes/terrain readability,
normal entry/Practice, paid expansion, combat, fog and recovery/rematch.

## Repeat

```sh
node scripts/generate-terraced-vale.mjs
node --test scripts/terraced-vale.test.mjs scripts/map-size-policy.test.mjs scripts/map-scale-audit.test.mjs
node scripts/vaelora-map-layout-scenario.mjs --check-only
node scripts/map-scale-audit.mjs
node scripts/terraced-vale-native-scenario.mjs
node docs/qa-evidence/terraced-vale-2026-10-03/reproduction.mjs /absolute/checkout /absolute/output-directory
node scripts/pack-railway-release.mjs
node docs/qa-evidence/terraced-vale-2026-10-03/packed-entry-reproduction.mjs /absolute/packed-directory
```
