# Captured Medium routes

These gzip files contain the original observation, selected command and unedited
native `skirmish@1` checkpoint captured before that command in the retained
Riven Escarpment game at `b99876b70068c903d2f72734322b9ce0c246dd3e`.
The observation-only capture reproduces the complete retained game exactly.
Its full-game seat seeds are `[0, 20260925]`; both cases belong to Ember / seat 1.

| File | Actual start tick | Requested goal | Isolated target-policy seed |
| --- | --- | --- | --- |
| `progressing.json.gz` | 103,890 | `(-35.5, -107.5)` | 9 |
| `stalled.json.gz` | 101,460 | `(-67.5, 84.5)` | 677 |

The isolated seeds reproduce the original command from the real peer observation.
They are distinct from the full-game policy seeds. Both use the same eleven
living Infantry/Spearman identities from the original command. No casualties,
resources, fog, map geometry or unit positions are injected or edited.

The progressing goal is reachable: continued native movement from its real
60-second expiry checkpoint discloses it after another 27 seconds and settles
the formation after 39 seconds. The actual expiry replacement never discloses
that original point in the same additional 60-second window. The stalled goal
stays unknown at projected native endpoints; holding it reveals no new cells,
while the actual replacement reveals 117.

[The regression helper](../../pve-progress-search-case.mjs) runs ordinary native
orders from each start checkpoint with a fresh isolated target policy. Its cold
case restores the full native checkpoint into a fresh fixture at 61 seconds,
checks both peer views at the same tick (only the established transient Worker
receipt may clear), and starts another fresh policy. Complete traces and final
checkpoints repeat exactly. See [the QA record](../../../docs/qa-pve-progress-retention-2026-10-04.md).

Map SHA-256: `42824ee5b4a4f9ef63df3961c2737ca37d3f71a61937d55860dec830ec38d2eb`.

Gzip SHA-256:

- Progressing: `45d796683fd064c038821eef4ffdce73bc8298693f52b2e2f8e1e68a749e8d89`
- Stalled: `06fee66143396c2a833280ce12814a99a6a46d6c14f0b3cc79a1c22f6b72f21f`

This evidence does not admit Medium PvE or establish human balance.
