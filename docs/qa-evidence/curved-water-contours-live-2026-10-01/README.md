# Connected water contour review — 2026-10-01

The renderer traces the union of blocked water cells, preserves separate diagonal
contacts and island holes, and rounds both convex and concave bends inside that
union. Land-facing edges inset 0.14 cell; bend radius is at most 0.45 cell and
shrinks on short segments. Collision, map JSON and resource ownership are unchanged.

The paired full-game captures use disposable Underbough Rootways and Bellweather
Millrace shoreline studies: identical ground kits and geometry inputs, comparing
`waterOutline=chamfered` with `waterOutline=curved`. Both ordinary and strategic
views completed without reported browser errors. The Underbough ordinary pair was
visually inspected: bends are softer, while the tiny pond still exposes scalloped
composition from its grid footprint. These captures do not prove hosted deployment,
performance or match balance.

`geometry-proof.json` records sampled containment and unchanged definitions for
all eight shipped maps with water. `scripts/water-contour-scenario.mjs` exercises
all 511 nonempty 3×3 footprints, checks 189,440 triangle samples against the blocked
union, verifies water centers remain covered and land centers remain uncovered,
and checks a dry island. The existing water-surface scenario also passed.

The next visual work is broad shoreline composition, regional banks and shallows,
and habitat-specific vegetation. Smooth contours alone do not finish the map art.
