# Natural paid Farm and Stone handoffs — 4 October 2026

Economy/content owns this regression tool through independent review, normal
merge and postmerge checks. It covers existing gameplay through actual native
WebSocket commands; it changes no runtime, map, resource contract or artwork.
Deployment and appearance are not applicable to this tool outcome.

## Exact-source observation

Clean source `006a70d8c42abb782673e3231ea855e30e2d5916`, based on main
`154e5198`, Node **24.19.0**, passes
[21 recorded conservation stages](qa-evidence/farm-stone-paid-2026-10-04/report.json)
on both seats of two unmodified shipped maps:

- **Stone Defense Field, 64 × 64:** zero initial Stone rejects an unpaid
  Watchtower without a food/wood debit. Each seat pays 60 wood for a Farm,
  75 wood for a food-only Mill, then harvests and delivers real Stone to pay
  50 food / 150 wood / 50 Stone for a completed Watchtower.
- A second partly built Farm is stopped before cancellation. The exact frozen
  unbuilt fraction returns wood, creates no crop, rejects another seat's cancel
  and cannot refund twice. All net costs remain in the conservation ledger.
- A Worker with naturally acquired Stone is stopped and recovered from an
  untouched checkpoint, then ordered onto its owned Farm. Its retained typed
  cargo returns to the home Town Center, bypassing the nearer food-only Mill,
  before food harvesting begins. Partial Farm food subsequently returns to the
  nearer Mill exactly once. Another cold recovery retains banks, cargo identity,
  paid building state and crop/node stock.
- **Bellweather Millrace, 80 × 72:** each seat completes the same paid Farm and
  Watchtower under baseline food/wood prices. Final banks are 100 food and
  40 wood from the authored 150 / 250 start; no Stone bank is disclosed. The
  existing finite 200-food planting survives cold recovery.

Actual Stone return targets were home IDs `1000000000` / `1000000001`, while
the pending source remained `farm:1` / `farm:2`. Retained Stone loads were
approximately 1.0333 / 1.0 and later Farm food deposits 0.8 each. These are
dated observations, not fixed expected timings or tuned values.

The tool checks authored stock + crop + carried resources + banks + net paid
costs, including per-seat Stone. No bank, cargo, crop, node, position, schema or
checkpoint is injected or rewritten. Checkpoint polling advances simulation
after recovery, so economic identity/stock remain exact while Sheep motion and
Tower attack cooldowns may legitimately elapse. This is economy recovery proof,
not an assertion that all in-flight combat/motion state remains frozen.

## Reproduction and limits

```sh
node scripts/farm-stone-paid-scenario.mjs --output=NEW_DIRECTORY
```

The script refuses to overwrite a prior output, records source revision/dirty
status, hashes its runtime/harness/map inputs and rejects input or revision
changes during the run. Both independent rooms are disposed before completion
or error. CI runs the same scenario.

These smaller catalog maps remain dated regression inputs. They do not satisfy
or alter the developing **160 × 160 gameplay floor**. No new civilization,
resource, Stone artwork, prices, balance multiplier or deployment is admitted.
Native commands prove economy behavior; rendered usability and human contested
balance remain separate acceptance. Next content measurement compares a paid
Farm and nearby neutral food on Millrace with equal Workers and reversed seats,
including construction, travel and actual deliveries without changing tuning.

Independent review at `006a70d8` found no actionable findings and passed 10
existing Farm/profile/ledger/source-provenance checks, syntax and whitespace.
Final integrated checks, merge and postmerge revisions are recorded in this
slice's PR; this dated source evidence is retained without relabeling its head.
