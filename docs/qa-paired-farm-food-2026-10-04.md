# Paired paid Farm and neutral food openings — 4 October 2026

Economy/content owns this bounded measurement tool through review, ordinary
merge and postmerge checks. It changes no gameplay values, map, resource,
civilization, artwork or default runtime. Deployment and appearance are not
applicable to the tool outcome; human contested balance remains unmeasured.

## Observed openings

Clean source `4dd8c267c42fcc374251519d9aabd1c8789ec4ac`, with main
`717ebeb6` and Herd schema 28, Node **24.19.0**, measured equal Worker budgets
on unmodified **Bellweather Millrace, 80 × 72**. The same native room pairs a
paid Farm with nearby plain neutral food, then an independent room reverses the
seats. Each 60-second simulation window includes construction, initial travel
and first deliveries; no warm-up is subtracted.

| Workers per seat | Farm seat | Farm food deposited in 60 s | Neutral food deposited in 60 s | Farm completion | Reserved builder Worker-seconds |
| --- | --- | --- | --- | --- | --- |
| 1 | Azure | 40 | 30 | 17.0 s | 17.0 |
| 1 | Ember | 40 | 30 | 17.8 s | 17.8 |
| 3 | Azure | 150 | 90 | 7.2 s | 21.6 |
| 3 | Ember | 150 | 90 | 7.7 s | 23.1 |

Farm still costs **60 wood** and produces one finite **200-food** pool. The
neutral berry node starts with **130 food**. Farm centers are at
`(-29.5, 6.5)` / `(29.5, 6.5)`, next to the home Town Center's existing access
perimeter; neutral targets are `s0-0` / `s1-0` at
`(-21.5, 7.5)` / `(21.5, 7.5)`. These different working/drop-off distances and
finite pools are part of the recorded scenario. They do not establish a general
Farm gathering bonus or a universal food/wood exchange rate.

Timed deposits deliberately exclude retained cargo. After stopping and returning
that real cargo, totals were approximately **42.13 / 41.33** for one-Worker
Farms, **40.00 / 37.90** for the corresponding neutral openings, **155.57 /
152.83** for three-Worker Farms and **119.93 / 112.27** for the corresponding
neutral openings. Those later totals are separate from the 60-second comparison;
a delivery landing just after the boundary must not be counted inside it.

Reserved builder Worker-seconds mean allocated Workers multiplied by elapsed
approach/construction time. The registry's minimum productive construction
requirement remains 15 accumulated Worker-seconds. No lost-food valuation or
wood payback is inferred from this allocation measurement.

## Evidence and reproduction

- [One Worker per seat](qa-evidence/paired-farm-food-2026-10-04/one-worker.json).
- [Three Workers per seat](qa-evidence/paired-farm-food-2026-10-04/three-workers.json).
- [Compressed raw own-seat observations and hashes](qa-evidence/paired-farm-food-2026-10-04/frames.json).

```sh
node scripts/farm-food-measurement.mjs --workers=1 --output=NEW_DIRECTORY
node scripts/farm-food-measurement.mjs --workers=3 --output=ANOTHER_NEW_DIRECTORY
node scripts/farm-food-measurement.mjs --smoke
```

The CLI refuses to overwrite evidence. Each observer reads only its own
fog-filtered Worker rows/bank at actual simulation ticks. Position/cargo samples
use the existing wire precision; exact stopped checkpoints verify each source
draw equals deposited plus retained food, global stock/crop/cargo/bank
conservation, the sole 60-wood debit and one final real return of retained cargo.
No bank, crop, cargo, node or position is injected, and no map is published.
Source revision and runtime/harness/map hashes must remain fixed during a run.
Both rooms are disposed on completion or failure.

Review found that a formerly accepted 180-second window could cross Millrace's
120-second supply event and exceed a waiter timeout. The API now accepts only
the intended **20-second smoke** and **60-second measurement** windows, before
those rewards. Independent unsupported-window calls reject before room creation.
CI runs the same paired smoke path; a smoke result is not a full measurement.

The smaller shipped map remains a dated regression/measurement input, preserving
the developing **160 × 160 gameplay floor**. These uncontested openings do not
measure raids, exposure, losses, depleted-source replacement, human choices,
rendered usability or a deployed build. The provisional values remain unchanged.
Next useful balance acceptance is an identified contested human match; extending
automated observations requires separately declared allocations and map geometry.
