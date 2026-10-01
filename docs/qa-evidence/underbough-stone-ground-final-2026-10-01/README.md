# Underbough stone-ground Studio study

1 October 2026 · Isolated current-code server on port 4213

[Capture report](capture-report.json) and [renderer binding proof](renderer-proof.json)
record eight ordinary/strategic full-game views. Disposable copies of Underbough
and Bellweather receive the same irregular 64-cell `scree` paint gesture.
[Underbough study definition](underbough-rootways-stone-study.json) and
[Bellweather control](bellweather-millrace-stone-study.json) retain the exact
inputs. The global-versus-regional comparison changes the entire regional kit,
not only stone pixels. The stone binding itself is asserted in the renderer proof.
No shipped map file is edited by this study.

This first complete comparison is superseded for appearance review: 53 of the
64 Underbough study cells lie under forest cover, hiding most exposed-stone
pixels. Its binding and import checks remain valid, but the later
[open-ground study](../underbough-stone-ground-open-2026-10-01/capture-report.json)
moves the gesture to an unblocked clearing and explicitly checks that placement.

The new runtime WebP was served from the production asset route and matched
SHA-256 `d67d75e3bc89aa4724e6455788ffdadb52007b17279670828bb35c2c9494386e`.
Existing Docker frontier-v1 copying and WebP allow rules include the file.
The role renders successfully and keeps the four Underbough canopy forms.
No hosted-deployment, live harvesting or new rock collision claim is made.

## Failed study attempts retained

The first attempt failed its map-label assertion. A retry with bounded readiness
polling retained [the import failure](../underbough-stone-ground-retry-2026-10-01/import-failure.json):
the label still showed the prior Bellweather custom map. The constructed raw
paint append overlapped 11 previously painted Underbough cells and 61 Bellweather
cells, violating the existing non-overlapping paint contract. The UI message did
not directly identify that reason; the overlap is established by the constructed
inputs and validator. The corrected study expands paint to cells, replaces the
gesture's cells and recompresses non-overlapping row runs.

A further attempt could not create a room after the two-room study server was
exhausted. All those capture processes were terminal. Their isolated server was
then shut down, and a fresh four-room server produced the complete passing
comparison. The capture helper now uses a bounded map-label wait and retains
failure details rather than treating a fixed delay as proof of an import.
