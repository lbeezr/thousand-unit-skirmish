# Retained Tiny empty-army recovery checkpoints

These are the exact decoded terminal checkpoint objects from the unchanged
`172c53f3669b3564503cdbdfae2c83637517d235` Tiny diagnostic failures, native
authored@1 and Skirmish@1, seeds `[20260925,0]`, tick108000. Their source archive,
archive/record digests and both compressed/decoded digests are in
[provenance.json](provenance.json). JSON whitespace was compacted and gzip mtime
set to zero; no checkpoint field was changed.

The regression verifies both digests and strictly restores the whole checkpoint.
It observes an available paid Infantry option, runs only seat0's normal policy
for30seconds, cold-restores the actual paid queue in a fresh fixture, and compares
the complete repeated command ledger and final checkpoint. Seat1's existing
native orders continue. It establishes this real seat0 production recovery in
both native modes, not native seat1 equivalence, full Tiny completion or balance.
Both seats have separate budget/priority/queue guards.

Keep these originals intact if a future supported checkpoint migration is
needed; compose the production migration and retain its exact field deltas.
Do not relabel the source, strip fields or relax strict native validation.

See the [bounded recovery receipt](../../../docs/qa-pve-last-infantry-recovery-2026-10-05.md).
