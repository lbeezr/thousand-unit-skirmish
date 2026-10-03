# Mill depot economy simulation — 3 October 2026

[PR #83](https://github.com/lbeezr/thousand-unit-skirmish/pull/83) adds a repeatable
paid depot comparison. The [complete measured report](qa-evidence/mill-depot-economy-2026-10-03/report.json)
records 14 cases, both seats, actual maps and hashes, costs, construction elapsed
time, delivered banks, repeat-trip intervals, sampled travel and conserved supply.
**These are authoritative server simulations, with zero human matches.** They
do not establish player choices, raid balance, rendered readability or win rates.

## Source and method

The full study ran on clean source
`707f4e03e2852f501be2f0d3853ce28154b7c8bc`, Node 24.19.0 and ruleset
`v1:c8a30de45cf9bfa527046662d022a0dc2cb28efc3ddd8b24521c5992eae328c2`.
The source revision and clean status remained unchanged throughout the study.
This is a dated baseline; later additions to the building registry do not change
its recorded maps or rules. Mill, Storehouse and Town Center tuning is unchanged.

Each 64 × 64 flat map has no obstacles, fog, triggers or income events. Each seat
starts with four real Workers, 500 food and 1,000 wood. Food and wood nodes each
contain 10,000 finite stock. The strategies retain the free starting Town Center
and either add nothing, or pay for one Mill, Storehouse or expansion Town Center.
Four Workers construct it using ordinary commands. Three then gather food and
one gathers wood; the last two cases use one food gatherer and park two Workers.
Initial positioning and every Worker's first full delivery precede the measured
60-second simulation window. Resource stock + cargo + bank equals starting
supply minus paid cost per resource and seat, after payment, gathering and Stop.
No bank credit or carried cargo is injected.

Mirror seat 0's X coordinates for seat 1; Z is unchanged. Workers spawn at
(-24.5, 0.5); the free home center is offset to (-27.5, 0.5) by the existing
center-placement rule. Near-home food/wood are at (-24.5, 5.5)/(-24.5, 9.5), with the added
depot at (-20.5, 7.5). Remote food is at (-8.5, 16.5), with the depot at
(-12.5, 18.5). Remote-food leaves wood at (-24.5, 5.5); remote-mixed moves wood
to (-8.5, 20.5). Footprints and node clearance are checked against the registry.
These intentionally favorable remote depot plots exercise overlapping harvest
and drop-off interaction ranges; they are not a sample of natural-map openings.

Ordinary wire snapshots sample position and cargo every 0.1 simulation seconds.
Repeat-trip rates below sum `60 × 10 cargo / mean repeat-trip seconds` per Worker.
They describe observed complete delivery cycles, rather than a gather multiplier
or measured infinite-run average. A case has only one to six repeated trips per
Worker. The actual 60-second bank window is also shown: phase and carried stock
at its endpoints can make a long-trip case appear substantially worse. Food and
wood remain separate currencies. Gather rate is 1 per Worker-second, carry
capacity 10, interaction range 1.5 and tick rate 30.

## Measured results

Ranges cover the two seats, not confidence intervals. Every case has one wood
gatherer. Units are deposited resources per simulation minute.

| Layout | Strategy | Food Workers | Food from repeat trips | Wood from repeat trips | Actual window food / wood |
| --- | --- | --- | --- | --- | --- |
| near-home | home | 3 | 159.3–162.7 | 42.0–44.1 | 150 / 40 |
| near-home | Mill | 3 | 174.8–175.0 | 42.0–44.1 | 170 / 40 |
| near-home | Storehouse | 3 | 174.7–176.0 | 59.6–59.8 | 150–170 / 60 |
| near-home | Town Center | 3 | 179.3–179.4 | 59.8 | 160–180 / 60 |
| remote-food | home | 3 | 54.8–57.2 | 52.9–57.0 | 30 / 50–60 |
| remote-food | Mill | 3 | 178.4–178.6 | 53.4–56.9 | 170–180 / 50 |
| remote-food | Storehouse | 3 | 178.4–178.5 | 53.4–56.9 | 170–180 / 50 |
| remote-food | Town Center | 3 | 179.3–179.4 | 53.5–56.9 | 180 / 50 |
| remote-mixed | home | 3 | 54.9–57.3 | 17.0–17.4 | 30 / 10 |
| remote-mixed | Mill | 3 | 178.5 | 17.0–17.4 | 180 / 10 |
| remote-mixed | Storehouse | 3 | 178.6 | 59.6–59.8 | 170 / 60 |
| remote-mixed | Town Center | 3 | 179.4 | 59.8 | 160–180 / 60 |
| remote-food | home | 1 | 18.6–19.0 | 53.2–57.0 | 10 / 50–60 |
| remote-food | Mill | 1 | 59.6 | 53.5–56.9 | 60 / 50 |

Remote food repeat trips take 31.4–33.3 seconds with only the home center, versus
10.0–10.1 with Mill. With three gatherers, sampled food movement totals
123.1–124.7 Worker-seconds per window for home versus 4.5–4.6 for Mill.
Near home, some food gatherers still select the home center when that route is
shorter. Mill does not force every food Worker to use it. Mill's wood gatherer
always selects the home center: in remote-mixed its repeat trips remain
34.5–35.3 seconds, while Storehouse reduces them to 10.0–10.1.

## Price, construction and role overlap

| Added building | Paid food / wood | Accumulated build Worker-seconds | HP | Footprint | Drop-off |
| --- | --- | --- | --- | --- | --- |
| Mill | 0 / 75 | 15 | 1,000 | 3 × 3 | Food |
| Storehouse | 0 / 100 | 20 | 1,200 | 3 × 3 | Food and wood |
| Town Center | 100 / 400 | 60 | 2,400 | 5 × 5 | Food and wood |

With four builders, remote placement takes about 13.8 seconds for Mill, 15.0
for Storehouse and 24.2–24.3 for Town Center. Their reserved builder time is
about 55.1, 59.9–60.3 and 96.9–97.3 Worker-seconds respectively, including travel
and waiting. Those are measured command-to-observed-completion intervals;
they differ from the registry's accumulated construction work. Near-home
construction takes 6.5–6.6, 7.7–7.8 and 17.0 seconds respectively.

Mill and Storehouse overlap on food delivery by design: same footprint and
drop-off rules. Remote-food shows almost identical food trips and no practical
wood improvement from Storehouse, because wood remains near home. Mill saves
25 wood and five accumulated build Worker-seconds, at the cost of 200 HP and no
wood service. Remote-mixed gives Storehouse a distinct benefit: about
42.4–42.6 extra wood per minute versus Mill. Its extra 25 wood corresponds to
0.587–0.589 minutes (about 35 seconds) of that extra delivery; the finite bank
window yields 0.5 minutes. Near-home repeat trips give about 1.42–1.59 minutes.
These are **wood-price-premium repayment estimates**, excluding construction
opportunity, initial positioning, depletion, defence and enemy disruption.

Mill's own 75 wood cannot be repaid by dividing it by extra food; this game has
no food-to-wood exchange contract. Town Center's additional 325 wood over Mill
would take about 7.59–7.66 minutes from the mixed site's extra wood alone;
its separate 100 food price remains unpaid in that calculation. Population,
Worker production and Tier II research are not measured here. Likewise, no
durability value is inferred without attacks. Minute differences in the remote
home-wood control are phase/path samples, not evidence for a new economy bonus.

The role split remains useful on these controlled maps. There is no observed
currency loss, duplicated stock or unsupported deposit, and no tuning change
is justified by these cases. Natural-map spacing, depletion and contested
player choices remain useful next observations.

## Reproduction and next content

```sh
node --test scripts/depot-economy-analysis.test.mjs scripts/depot-source-snapshot.test.mjs
node scripts/depot-economy-scenario.mjs --smoke
node scripts/depot-economy-scenario.mjs --output=NEW_DIRECTORY
node scripts/depot-economy-scenario.mjs --case=remote-mixed/storehouse/3 --output=ANOTHER_NEW_DIRECTORY
```

The full matrix runs at most four disposable rooms concurrently. Output must be
a new directory. Consumed local JavaScript/JSON inputs and the package lock are
hashed before rooms run and checked before/after cases; output is excluded.
This catches further edits to already dirty inputs without mistaking generated
JSON for source changes. The earlier full study predates that review fix and
uses its recorded clean revision. A paid output-enabled smoke and focused source
drift/output tests verify the fix. CI includes the bounded smoke and helper tests,
not the full matrix. Independent review checked the method, currency accounting,
art contract and CI entry; both source-provenance findings were addressed.

After integrating main `e381d50`, the [paid smoke record](qa-evidence/mill-depot-economy-2026-10-03/integrated-smoke.json)
passed on clean `b550c690650f1959165d95175baf51eb4dc89045`. The new Dock changes
the registry revision to `v1:561c62ccc67ac78cc067e8e639942a83fc6d6b1f89633e5b1c73aedc20f4a3a6`;
the three compared depots retain the measured definitions. All 25 focused
analysis/provenance, Mill, menu, retained-cargo and settlement checks passed.
The open-field settlement still covers every ordinary land building; Dock's
special placement is explicitly covered by the separate both-seat shoreline
fixture. This change adds no roster member or gameplay tuning.

The [Mill identity brief](frontier-mill-art-brief.md) supplies its actual land
placement, 3 × 3 footprint and food-only role for an owned-source art slice.
The [Farm capability proposal](farm-capability-proposal.md) identifies the next
existing content candidate and its missing finite-stock/persistence contract.
Neither a brief nor a proposal adds a civilization or claims new playable art
or Farm functionality.
