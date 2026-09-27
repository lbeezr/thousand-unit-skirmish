# Town Center Meshy Lifecycle Runtime Pack

This runtime pack adds a separate optimized Meshy model for Foundation, Frame, Damaged, and Critical. Each source state image was submitted as its own image-to-3D job, previewed, optimized, and captured from eight matched camera directions. The complete model remains in the earlier [Meshy pilot pack](../town-center-meshy-review-v1/README.md).

The [Building Variant Atlas](../../../building-map.html) shows all five state contact sheets and exposes the individual views. All 40 640 × 640 color captures and their 40 alpha team-color masks are checked in under `runtime/`. The masks tint team banners from the manifest colors, and each source image is SHA-256 checked before use. The optimized GLBs and full-resolution color, normal, depth, silhouette, team-mask, and contact-shadow outputs remain in local ignored `meshy_output/` for production use.

| State | Threshold | Views | Meshy credits |
|---|---:|---:|---:|
| Foundation | 5% construction | 8 | 35 |
| Frame | 50% construction | 8 | 35 |
| Complete | intact | 8 | 35 (earlier pilot) |
| Damaged | 60% health | 8 | 35 |
| Critical | 30% health | 8 | 35 |

The four new jobs used **140 credits total** (30 for image-to-3D and 5 for optimization per state), within the approved cap. `lifecycle-grid.json` records thresholds, capture settings, task IDs, local optimized-model hashes, and view hashes. See [PROVENANCE.md](PROVENANCE.md) for task-level records.

The captured-view runtime now supplies the Town Center's default gameplay artwork. The game selects the nearest of eight camera directions, applies team colors through the verified masks, and keeps the old procedural model available while the images load or if an asset is unavailable. The generic lifecycle resolver also maps construction progress to Foundation/Frame and health to Damaged/Critical.

Town Centers are still static map landmarks and currently expose neither construction progress nor health, so gameplay shows the Complete state. Foundation, Frame, Damaged, and Critical are ready in the same runtime pack and become active when the game supplies those lifecycle values. Other building types keep their current renderers until a matching captured-view pack is available.
