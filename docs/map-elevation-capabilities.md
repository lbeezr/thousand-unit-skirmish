# Elevation for dramatic maps

[Map authoring](map-authoring.md) · [Size tiers](map-size-tiers.md) · [Medium escarpment](qa-riven-escarpment-2026-10-04.md)

The current engine can author useful valleys, terraces, plateau rims, ridge-top
lookouts and explicit ramp approaches now. Compose broad silhouettes and distinct
routes from three logical levels, then protect flat settlement pads. Medium's
twin escarpments surround a usable low rift; two low passes and two raised routes
connect the sides. More cells provide space for those decisions, while the height
range remains small. No engine expansion is needed for this layout.

## Current contracts

| System | What exists | Authoring limit |
| --- | --- | --- |
| Ground data | Integer levels 0/1/2, one per X/Z cell, up to 4,096 nonoverlapping rectangle patches. | No arbitrary ground heights, stacked ground, caves, overhangs or bridge route underneath. Taller obstacle props remain obstacles rather than walkable elevated surfaces. |
| Rendered surface | 0.8 world unit per level; maximum logical ground height 1.6. One-level neighbors interpolate into sloped cell corners. Two-level discontinuities retain visible vertical side faces. | Smooth art does not change the cell traversal contract. Width/material/silhouette can make a dramatic composition; this is not a tall mountain heightfield. |
| Pathfinding | Cardinal graph; adjacent level difference ≤1 traverses, direct 0↔2 blocks. Uphill edge cost 115 versus 100 otherwise. | Cost chooses a route; it does not slow the unit. A 0→1→2 approach must be explicitly authored. Diagonal movement checks both orthogonal boundary chains, preventing cliff/corner cuts. |
| Settlements | Buildings sample the rendered height at their centers; current placement accepts mixed logical heights within a footprint. | Use flat 3×3/5×5 pads plus circulation/producer exits. Do not rely on a flat-footprint rejection rule. |
| Visibility | Sources on either raised level gain one sight cell. Trees/obstacles and buildings can block rays. | Logical terrain height does not produce physical terrain ray occlusion. Level 2 has no extra bonus beyond level 1. |
| Combat | Range/damage are planar; attack presentation follows endpoint ground heights. | No high-ground damage bonus or projectile/terrain intersection simulation. A shared visible target may be attacked across height differences. |
| Picking/presentation | Ground picking raycasts the surface; units, resources, fog and markers follow sampled heights. Minimap has an elevation legend. | Readability, apparent slopes, selection and strategic zoom still need rendered checks on an identified build. |
| Scale | Current maximum 256 per axis; Medium 224 fits current indices. | XL 320 remains blocked until the widened visibility-index/bounded-cache work is implemented and verified. |

Source: [height sampling](../src/terrain-height.mjs),
[surface/side-face geometry](../src/environment-art.mjs),
[elevation validation](../src/map-utils.mjs),
[path costs](../src/elevation.mjs),
[movement boundaries](../src/unit-movement.mjs),
[vision/combat authority](../server.mjs), and
[picking/building presentation](../src/main.js).

## What the evidence establishes

Static source checks establish level values, reachability, route alternatives,
flat pads and nominal travel. A native protocol scenario establishes only its
recorded commands/state/clock/recovery at its exact revision. Neither is a
rendered browser observation. A source layout drawing is a schematic.

For rendered acceptance, use normal Practice and select the canonical map on an
identified served revision. Capture both homes, the low rift, ridge access ramps
and low/raised crossings at ordinary and Fit/strategic zoom. Verify selection and
orders at both sides of cliffs, flat buildings/producer exits, fog edges and the
minimap; compare actual arrivals with the native/static endpoints. Record device,
viewport and browser. Human balance and useful crossing choice require actual
matches, rather than a screenshot or an empty-land route.
