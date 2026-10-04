# CPU displacement-to-animation integration — 2026-10-04

Production source `53a47ee3` contains selector PR #284, direct-ground trajectory
PR #285, and the Infantry default restoration #286. A bounded cloud CPU run
passes 64 cases: Worker/Spearman × eight bearings × both teams × full/low
detail. This adds the missing client update-loop and decoded source-cell links
to the existing selector/clock tests; it does not repeat the 47-check suite.

The runner executes the committed `src/main.js` displacement interpolation,
heading easing and transform-update scheduling, calls the real sprite runtime,
and maps its Three instance UV buffer back to committed frame keys. It checks
clock/timeline phase, actual interpolated velocity, exact facing after turn
settling, continuous clocks through turns, Stop-equivalent held snapshots,
idle and resumed first frames. Snapshot displacement is deterministic input;
server path generation, paid production and Stop-command handling are separate.

The two approved manifests are Worker v0.33 (`cast-human-sprite-v3`) and
Spearman v0.3 (`spearman-sprite-v1`). Runtime PNG hashes are verified against
their manifests; Pillow decodes their actual actor cells. Pixel hashes anchor
the ground pivot and clear RGB under transparent pixels, preventing atlas
offsets or invisible bytes from faking advancement. Named walk keys aliasing
identical visible cells fail. Exact pixel differences establish source change,
not anatomical gait quality or rendered appearance.

| Pack | Authored walk directions | Distinct frame keys / visible cells / silhouettes |
| --- | --- | --- |
| Worker v0.33 | All eight | 8 / 8 / 8 in every direction |
| Spearman v0.3 | SE | 8 / 8 / 8 |
| Spearman v0.3 | N, NE, E, S, SW, W, NW | 1 / 1 / 1; exact-facing idle fallbacks, missing gait art |

Negative controls prove the checks reject a frozen clock (64 failures), forced
SE UV selection (56 non-SE failures), and identical cell hashes beneath
different authored walk keys (36 authored-walk failures). The cell control
injects identical fingerprints into the comparison; it does not alter PNGs.
The positive run exits 0 with `passed-with-art-gaps`; each negative run exits 1.
Syntax, architecture and checked-JavaScript/Node boundaries also pass.

Run from the repository with Node dependencies and Python/Pillow installed:

```sh
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-proof
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-frozen --negative=frozen-clock
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-facing --negative=wrong-heading
node scripts/unit-displacement-animation-scenario.mjs --output=/tmp/unit-animation-static --negative=duplicate-cells
```

Each run writes `checks.json` with source revision/dirty flag, pack/PNG hashes,
per-case UV/frame/heading/displacement samples, missing art and failures. This
is an owner-run diagnostic; it does not add Python/Pillow to standard Node CI.
The extraction fails if the committed client loop/constants move, rather than
silently testing a copied implementation. Texture loading uses a CPU stub.

No GL context, browser frame, screenshot, live staging or ordinary server
command acceptance is claimed. These checks cannot prove that the atlas is
uploaded to a GPU, that a browser draws it, or that the live client reaches the
same state. The initial cloud Chromium sandbox/Firefox download blocker is
separate. The parent cloud browser owner retains native temporal acceptance;
the path owner retains PR #285 trajectory evidence. No new art or runtime
behavior changes are included here.
