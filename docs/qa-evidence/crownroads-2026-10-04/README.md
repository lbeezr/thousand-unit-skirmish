# Large Crownroads evidence

[Owning QA](../../qa-crownroads-2026-10-04.md) records measurements, scope and repeat commands.

All measured runtime receipts use clean source `36f6f9a9`; its commit remains
reachable in the PR history. The map SHA-256 is
`0b62a9f967ef42c967eb9121e07395b75549d52d4a73dd16eaf29aebf19e3727`.

- `static-audit.json.gz`: full shared methods/constants/input hashes, Large
  geometry/resources/city placements, authored sites and forced-route method.
- `grid-cost.json.gz`: source-bound resident/grid/fog/render accounting and XL
  projections. Bounds exclude JS overhead; these are not measured RSS/GPU costs.
- `paid-native.json.gz`: complete normal-root DOM/Authored Practice run, both-seat
  actual Worker/Infantry/paid Scout arrivals, twelve conserved phases, paid
  expansion/city buildings, bounded combat, cold/reset and one-human movement.
- `paid-source-inputs.json.gz`: all 754 consumed JS/JSON file hashes, checked
  unchanged through the native paid run. No file contents or session state.
- `native-24.json.gz`: complete three-wave 24-unit collector, all 66 retained
  windows and cold recovery. Full arrival, paid economy and capacity claims are
  false here; the separate paid run proves those particular actors/actions.
- `native-24-check.json`: pure offline derivation of the all-window envelope,
  agreeing with the raw report's stored cold-inclusive envelope.
- `summary.json`: selected values, exact source/staging metadata and limits.
- `layout.png`: static authored schematic, not rendered gameplay or fog proof.

`manifest.json` hashes exact artifact bytes; gzip entries also hash the
uncompressed contents. Gzip mtime is zero. This README and the manifest exclude
themselves from hashing. No raw checkpoint, room/session token or recovery secret
is published. No failing native run was discarded: both first clean runs passed.

The native source's paid driver and collector inputs differ from later main
integration only as explicitly shown by commit history; do not relabel these
receipts as a final merged/deployed-source run. Normal-mode registry admission,
rendered browser appearance, human balance and larger army capacity remain
incomplete and separately owned. The runtime limit remains 256; no XL activation.
