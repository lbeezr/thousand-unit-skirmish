# Captured Medium search checkpoints

These gzip JSON files contain unedited native `skirmish@1` checkpoints from the
retained Riven Escarpment full game at source
`afef1c2c03375af6f709326b3518a60534174732`. The full-game seat seeds were
`[20260925, 0]`, with ordinary 150-food/250-wood opening banks and no grants.
The observation-only capture reproduced the entire retained result exactly.
See [the diagnostic record](../../../docs/qa-pve-medium-search-2026-10-04.md).

| File | Native tick | Seat | Original army cohort | Isolated target-policy seed |
| --- | --- | --- | --- | --- |
| `seat-0.json.gz` | 41,700 | Azure / 0 | 64, 65, 67, 69, 72 | 590 |
| `seat-1.json.gz` | 42,570 | Ember / 1 | 59, 60, 66, 68, 70, 71, 73, 74, 75, 76, 77 | 120 |

The isolated seeds select a remembered first candidate followed by reachable
unknown ground. They are regression inputs, not the original full-game policy
seeds. Cohorts contain only living friendly soldiers from the actual search
order at capture. Neither seat currently sees a living enemy in these snapshots.

[The regression helper](../../pve-remembered-search-case.mjs) restores the full
checkpoint, sends ordinary native orders, waits for actual fog disclosure, then
restores that new checkpoint into a fresh native fixture and starts a fresh
policy at the same tick. Both peer observations must match, allowing only the
existing transient Worker activity receipt to clear. The whole case repeats
exactly. The second goal is checked for legality and initial visibility; its
arrival is not asserted.

Canonical map SHA-256:
`42824ee5b4a4f9ef63df3961c2737ca37d3f71a61937d55860dec830ec38d2eb`.
Native server SHA-256:
`269ba44cda8dc64434af811d06dbcd5ae81f9a1bb2bbf56ac8907c0687af409c`.

Gzip SHA-256:

- `seat-0.json.gz`: `3a3b1f5556c9209d4eeffa6c10e0f7b1457eaf2096cd8825f0f7cc840e5c7b48`
- `seat-1.json.gz`: `6a60f6ccae8b80a2d1c7f4518d3fcd1281fb44a4e973fdba7c6a352fd2b4fcdd`

These fixtures do not admit Medium PvE or establish human balance.
