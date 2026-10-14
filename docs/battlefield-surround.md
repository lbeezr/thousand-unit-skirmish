# Terraced Vale surrounding landscape

[Setting exploration](art-direction/battlefield-setting-2026-10-14/README.md) · [Maps](maps.md) · [Appearance and delivery evidence](qa-battlefield-surround-2026-10-14.md)

14 October 2026. The user selected the larger-landscape experiment on Terraced
Vale, with rocky edges and subtle valley clouds. Implementation owner: chat
`01a13aba-1a70-7322-9b8e-f71bb213dccd` (**Explore map edge atmosphere**), retaining
normal integration, release inclusion, staging and in-game verification.

## Intent and selected backing

A match should feel like a bounded part of Vaelora's larger landscape. The
[comparison board](art-direction/battlefield-setting-2026-10-14/setting-comparison-v1.png)
backs A's connected land with B's restrained valley atmosphere. The selected
[Veyrholds map](art-direction/vaelora-v1/veyrholds-map.png) supplies slate,
exposure, low alpine vegetation and connected mountain geography. The original
[source receipt](art-direction/battlefield-setting-2026-10-14/sources.json)
retains provenance. Broken land, ocean-fall cosmology and the world-bearer remain
unselected alternatives.

## Runtime treatment

The normal Terraced Vale renderer adds a connected ring of rocky slopes and
distant low ridges beyond the existing 160×160 map, sharing its painted scree
texture and terrain seed. The inner lip samples each boundary cell's existing
height; the surrounding geometry declines into a valley with uneven contours
and broad value shapes. Distant terrain fades into a muted slate-blue backdrop.
Two batches supply land and static cloud pockets. The latter sit seven world
units below the ground plane, fade away from the inner edge and never animate.
There is no new motion loop or transition needing a timing storyboard.

The selected map replaces the former two-cell rectangular underlay with that
scenery. Its subtle boundary line remains for command legibility. Camera position,
zoom, panning bounds and HUD stay the same; only the far clip range expands to
contain scenic land. Other maps restore the existing sage background/fog,
underlay, border and clip range during map changes.

The [implementation](../src/presentation/rendering/battlefield-surround.mjs)
belongs to presentation. It consumes public map definition and shared ground
texture, with no unit, resource-stock, command, occupancy or hidden enemy data.
It has an actual geometric hole covering the playable area and disables generic
ray picking. Main retains its existing `terrainSurface` for ground commands.
The minimap, simulation bounds, movement, placement and fog of war are unchanged.
The existing map teardown disposes both scenic geometries/materials; their
shared cached scree texture is not separately disposed.

## Bounded experiment and acceptance

This is default presentation for `veyrholds-terraced-vale` in the `veyrholds`
region, with no preview-only switch or new map-format field. It deliberately
does not generalize to the whole catalog before this scene is reviewed.

The owner will compare ordinary zoom 0.91, strategic zoom 0.48, Fit map and
extreme edge pans, at wide and narrow viewports for both viewing teams. Inspect
unexplored fog and real troops beside the boundary. Check connected geography,
quiet clouds, terrain contact, no foreground occlusion, clear playable limits
and no abrupt scenic clipping or raw backdrop hole in allowed views. Exercise
inside/outside Move and placement plus map switch/rematch. Record any remaining
square silhouette, shader error or readability defect as unfinished polish.

Five CPU scenery checks establish selection scope, mutation-free deterministic
geometry, edge registration, an empty playable region, bounded batches, disabled
picking, static clouds and the shared painted-texture contract. Existing terrain,
camera, exact client admission, fog, import, types and Docker/release checks
remain the surrounding regression floor. These checks do not establish pixels.

The [QA record](qa-battlefield-surround-2026-10-14.md) owns exact source SHA,
clean release digest, deployed revision and actual in-game appearance separately.
No runtime acceptance is inferred from the original generated comparison board.
