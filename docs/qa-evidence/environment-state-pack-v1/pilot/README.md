# Environment-state runtime pilot

[Environment guide](../../../environment-state-pack-v1.md) · [QA plan](../../../qa-vertical-slice.md)

## Capture identity

- Date: 26 September 2026.
- Game source: `c9e4791`; integration main: `4c83e6a`.
- Scenario: `renderer-environment-state-pilot`.
- Run: `run_1790444012393_a432a5abc6764808a77bf549d7947a6e`.
- Run-manifest SHA-256: `378b6fc7f42af96e994e0b24284f38e3336ee83f39f48b37b986bf9b63fa6850`.

Capture verification recorded completed status, verified hashes and closed artifact
roster, valid capture contract, and decoded rasters. Detailed state records were
stored in a sidecar to preserve the capture manifest schema.

Both clients loaded and checked all ten runtime WebPs. Normal gather orders
changed stock from 100; visibility and stages were verified for both seats.
Screenshots show Azure.

## Frames

| Preview | Azure stock / stage | Ember stock / stage | Image |
| --- | ---: | ---: | --- |
| Meadow oak, zoom 0.91 | 54.17 / worked | 54.97 / worked | [oak-worked.png](meadow/zoom-0.91/oak-worked.png) |
| Meadow berries, zoom 0.48 | 54.60 / worked | 53.80 / worked | [berries-worked.png](meadow/zoom-0.48/berries-worked.png) |
| Cinder oak, zoom 0.91 | 0 / depleted | 0 / depleted | [oak-depleted.png](cinder/zoom-0.91/oak-depleted.png) |
| Cinder berries, zoom 0.48 | 24.63 / low | 23.83 / low | [berries-low.png](cinder/zoom-0.48/berries-low.png) |


## Scope and limitations

Each image is 2560 × 1440 from a 1280 × 720 CSS viewport at DPR 2, with HUD/minimap.
Resource props read at 0.91 in the owner review; their small 0.48 presentation
still needs player review. This four-frame subset is not the forty-frame matrix
and records no performance or GPU-residency measurement.

Changes between capture and integration involved rock rendering, audio feedback,
and static preflight reporting, rather than the resource pack, stock mapping,
gather poses, or live capture path. Keep the source identities when citing this evidence.
