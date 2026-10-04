# Medium qualification: idle reconnaissance after local exhaustion

[AI queue](pve-policy-backlog.md) · [Prior progress proof](qa-pve-progress-retention-2026-10-04.md)

Opponent AI owner `01a10297`, 4 October 2026, Node 24.19.0. Diagnosis starts at
main `32b7179590f9cd8a0c59172bd9ebd9a8049c4fdf` (full identity in the PR receipt) and retained PR281 source
`201bad31e604c1ef41f6f4f933d93f7bfdc63f84`, merged at
`41e30deb3aac6b4533231514943a6b65ad3068ab`.
No new 3,600-second match, Millrace shard or deployment was launched for this
diagnosis. The map, resources, movement/combat authority, fog, victory,
qualification ceiling and Tiny-only fresh PvE admission are unchanged.

## Retained evidence distinguishes activity from the missing capability

The unfinished Riven Escarpment assignment is Azure seed 20260925 / Ember 0.
It ends at 3,600 seconds with zero rejected commands. The opposite assignment
ended in Azure elimination at 2,925 seconds. These are self-play diagnostic cases
under native `skirmish@1` rules and policies, not balanced
difficulty or fresh Medium admission evidence.

The unfinished endpoint contains real ongoing economy and movement. Four Azure
Workers gather remote food, its paid Infantry attacks a Stable, and Ember
continues paid production. Ember's remote army holds hundreds of remaining path
steps rather than a completed stationary route. A 60-second cold-policy
continuation from the **unedited** endpoint moves Ember's surviving field
soldiers 57.8–96.6 cells at the historical source; its nearby recruit kills the
exposed Azure Infantry within 8 seconds. Current source repeats this diagnosis
with small forest-disclosure differences. This rules out a permanent army
stall at this endpoint; it does not establish overall completion.

There is a separate concrete failure: Scouts 76/79 remain at
`(-79.5,-10.5)` /`(17.5,-5.5)` for the final ten retained minutes. Fresh
reconnaissance policies emit no order through the further 60-second historical
and current continuations. Current observations contain 26,058 / 21,442 unknown
cells; nearest unknown cells are 19 / 17.72 cells away. The local probes reach
only sight+1 /sight+4 (12 / 15 for Scouts). Every local candidate is remembered,
so the policy permanently reserves the Scout while returning no exploration
order. Azure simultaneously has 30 wood and no disclosed positive wood source.
The absence of wood disclosure is not permission to inspect hidden deposits.

## Small bounded correction

[Reconnaissance](../src/pve-reconnaissance.mjs) retains its existing local
selection. Only if that selection finds no point, on public Small-or-larger
dimensions, it scans at most 64 coarse fog cells. A deterministic coprime cursor
eventually covers the coarse grid; the nearest eligible unknown point in that
bounded sample is selected. Current disclosed threats and the existing four
failed points remain exclusions. No hidden enemy, resource, bank or terrain
oracle is an input. Retreat, generation ownership and the ten-second stalled
route retry remain intact.

Tiny and internal fixture dimensions take exactly the prior local-only branch.
This larger-map diagnostic correction does not widen runtime admission or tune
a policy toward the 3,600-second ceiling. The nearest sampled frontier reduces
needless travel across remembered ground; no seed-specific destination is coded.

## Native regression and observed improvement

The [fixture provenance](../scripts/fixtures/pve-recon-ring/README.md) identifies
the original full-game input and sealed archive hashes. Its 26,566-byte compressed
checkpoint has unedited values from tick 108000. The
[native helper](../scripts/pve-recon-ring-case.mjs) runs the unchanged full policy
for only 60 more simulation seconds, using both ordinary filtered observations.
Both branches start fresh policies from the retained native endpoint. Here
"warm" means no further restart during that minute, not restored private policy
history from the original game; "cold" adds a fresh fixture/policy at 30 seconds.

```sh
node --test scripts/pve-reconnaissance.test.mjs
```

| Seat | Baseline/control Scout movement | Candidate displacement, warm/cold | Newly disclosed cells, control | Newly disclosed cells, warm/cold |
| --- | --- | --- | --- | --- |
| Azure | 0; no Scout order | 46.84 cells / 46.84 cells | 68 | 203 /203 |
| Ember | 0; no Scout order | 100.70 cells / 100.70 cells | 154 | 286 /286 |

The control disables only Scout Move delivery; ordinary military, economy and
combat continue. Historical and current unchanged-policy continuations also
independently reproduce the zero-Scout-order condition. Native movement and fog
disclosure, not emitted goals alone, substantiate improvement. Warm and cold
results each exactly repeat every command/notice, full sampled both-seat view
and final checkpoint. Cold recovery creates a fresh fixture and full policies
at 30 seconds, preserving both complete peer observations with only the existing
documented transient Worker-activity clear. No bank, casualty, unit, order or
checkpoint value is fabricated.

Additional contracts preserve Tiny/internal behavior, deterministic bounded
distant-cell coverage, fully explored idleness, disclosed threat exclusion and
retreat priority. Existing Scout retreat/retry/generation and broader fog,
ownership, paid recovery and target tests remain the regression floor. Exact
final-head checks and independent review are recorded in the PR checkpoint.

## Qualification gaps and next defensible evidence

This fixes missing exploration after local-ring exhaustion. It does **not**
prove that failure caused the whole 3,600-second game, that the new policy wins,
or that Medium is ready. The one-minute result remains ongoing. Azure still has
30 wood, no positive wood node at the endpoint, and no renewed wood income.
Economic recovery is therefore a distinct unresolved capability gap, not an
observed improvement from this fix. Sparse minute samples and two same-policy
seed assignments cannot establish balanced difficulty or opponent competence.

Opponent AI's next bounded acceptance step is a paid depletion/discovery case:
ordinary local wood exhaustion, a living Scout inside remembered ground, an
undisclosed reachable source, then actual team disclosure, legal Worker gather
and a native wood deposit. Compare an exploration-disabled control, both seats
and cold restore; preserve banks, prices, victory and deadlines. Establish that
capability before another long match. Then use the unchanged completion ceiling
and both retained seed assignments, state the required mechanics and separately
qualify the test opponent. Further native completion and ordinary process/entry
qualification are still needed; this bounded native Skirmish diagnostic does
not substitute for them.

Registry/runtime owner `01a103cc` retains Medium admission; Medium stays
human-only. Map/human owner `01a103e8` retains independent human pacing/balance,
and the shared cloud capture/deployment owners retain renderer/served identity.
The user reports actual cloud packed-renderer qualification in
[PR323](https://github.com/lbeezr/thousand-unit-skirmish/pull/323). That removes
the earlier renderer-capability blocker, but ordinary Tiny entry/fog/economy/
loss/reconnect/rematch acceptance still requires its own identified-source
shared-interface capture. No game pixels or balance are claimed here.

Millrace original-shard collection remains with CI `01a10378`; AI owns analysis
of its final-state payload when supplied. No duplicate collection runs here.
