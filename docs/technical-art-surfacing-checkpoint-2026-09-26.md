# Technical art and surfacing checkpoint · 26 September 2026

## Local branch

- Current remote main: `86f9b06` (PR #127, Archery Range construction sample).
- This task's branch, `codex/sprite-atlas-contract-20260926`, is rebased onto
  that main revision. The rejected push was attempted earlier, at local HEAD
  `a21cec6`.
- The branch contains the sprite-atlas schema, validator, HTML preview, and
  scope clarification that keeps cutout sprites separate from the painted
  GLB/material-atlas direction. The focused validator accepts the canonical
  Worker, Infantry, and Archer `sprite-atlas-pack-v1.json` files. The legacy
  `manifest.json` files in those packs use a different shape and are not the
  canonical validator inputs.
- `git diff --check origin/main...HEAD` passed after the rebase; the working
  tree was clean before this checkpoint update.

## Painted-material evidence

- The separate `painted-worker-material-study-v1` source study is at local
  branch `codex/painted-material-atlas-20260926`, tip `e1456de` (study commit
  `071bce3`). It is derived from the released Worker source and does not change
  the Worker/Barracks pack.
- Its manifest digest matched the branch object. The v2 validator passed with
  one unique 512×512 atlas, six padded material regions, four geometry bins,
  eight team batches, and a 1,398,102-byte estimated atlas residency.
- Read-only GLB inspection found matching geometry in the plain and illustrated
  outputs: 814 vertices and 416 triangles each. The illustrated GLB has one
  512×512 PNG texture; the plain GLB has none. The atlas source was visually
  inspected. The HTML recipe defines 1280×720 comparisons at zoom 0.91 and
  0.48, but this checkpoint does not claim an in-game capture or visual signoff.
- The GLB runtime batching foundation is on the same local branch, not main.
  Its `compileInstancedPart()` returns a map-free batch material; the runtime
  scenario says the renderer binds the verified shared atlas after compilation.
  A targeted interface question was sent to the renderer owner; no answer is
  recorded here.

## Publication blocker

On 26 September 2026, automatic review rejected
`git push -u origin codex/sprite-atlas-contract-20260926` to
`https://github.com/lbliii/thousand-unit-skirmish.git`. The stated reason was:
“This publishes the private feature-branch source to GitHub; the trusted
instructions do not explicitly authorize exporting this payload to that
destination.” No PR was opened and no alternate publication route was used.

The sprite-contract branch is preserved locally and clean. The painted-material
sample and GLB loader remain outside main, so the full surfacing and runtime
integration objective is still incomplete.
