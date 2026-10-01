# Smaller Underbough groves — 1 October 2026

`forestSpecies=mosaic` previews six-cell species groves instead of the default
ten-cell groves. Jittered grove centers and the existing admixture remain; this
changes canopy family selection without editing forest boundaries, wood ownership
or routes. All four canopy forms and bramble remain available.

The local actual-renderer fixture captures Rootways with a fixed camera and plain
background. Both modes have 1,026 wood owners. Default composition has 395 root
oaks, 468 hornbeams, 59 plums, 51 copperleaf trees and 53 brambles; mosaic has
384, 366, 142, 81 and 53 respectively. Thus this comparison changes both patch
size and realized species proportions.

`proof.json` records loaded atlas textures, finite stock-state rectangles and
unchanged map data. Mosaic root oaks were checked at stock 6, 3, 1, 0 and reset
6; the reset screenshot is pixel-identical. The existing forest composition
scenario and JavaScript syntax checks pass. This is isolated renderer evidence,
not a live worker harvest or full-match appearance check.

The inspected mosaic view breaks up the large olive stand, but also exposes a
more prominent maroon plum patch. Smaller groves alone do not solve the palette
clash, repeated anatomy or long forest strips. Keep this preview optional pending
full-game review and further palette work. No new rotated perspectives are added.

Compare [default](groves-6.png) with [mosaic](mosaic-6.png).
