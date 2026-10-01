# Underbough low hazel renderer — 1 October 2026

The new low, multi-stem hazel adds a muted olive/umber understory silhouette beside
two rootward fungus forms. It has no fruit/resource role. The existing seeded
understory selection distributes these three forms inside existing forest cells;
margin-biased placement density and total selected plant count are unchanged.
Rootways supplies 115 hazels across its 1,026 forest cells. All remain within their
parent cell, disappear at zero stock and restore the exact instance transform at
full stock. The fixture checks every hazel and preserves map JSON. This is a
renderer lifecycle test, not an actual worker harvesting proof.

The close sprite render was inspected for silhouette/palette/alpha. Packaging
preserves the generated RGBA master, uses alpha8 silhouette bounds plus a small
gutter to exclude faint isolated specks, scales to 1024×629 and encodes WebP with
exact decoded alpha. The plant manifest and alpha validators passed.

Sibling full-game captures completed eight ordinary/strategic views on Underbough
and Bellweather without reported errors. Those compare regional ground kits,
not shrub-on versus shrub-off; the close fixture and placement proof establish
this shrub's binding. No performance or hosted deployment claim. This is one
painted oblique view; mirroring/yaw do not supply directional coverage.
