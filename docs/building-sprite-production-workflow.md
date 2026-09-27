# Direct 2D building sprites

[Documentation index](README.md) · [Preferred model/capture pipeline](building-asset-production-pipeline.md)

Use this fallback path for camera-authored building images and for maintaining
the existing direct-sprite packs.

## Author the state family

1. Read the actual gameplay footprint and lifecycle. Separate collision from
   visible support/base and author only meaningful states.
2. Start with the complete building. Establish identity, scale, material, team
   accent, view, light, and ground pivot before deriving other frames.
3. Derive foundation, frame, damage, or critical images from that complete
   reference. Keep canvas, camera, anchor, and architecture consistent.
4. Compare all states on a labeled grid at game size. Correct source drift before
   runtime normalization.
5. Preserve full-size PNG sources and regenerate aligned runtime frames with the
   checked-in preparation script.
6. Record coverage, provenance, hashes, and integration status in the pack.

The existing samples use a 5 × 5 world-unit art frame, 640 × 640 runtime pixels,
128 pixels/world unit, 45° azimuth, and 46° downward view. These are measured
sample conventions, not a requirement to stretch every building to fill its frame.
Store pixel and normalized ground pivots; a different base can require a different
pivot height.

## Team cues, layers, and bounds

A small cropped pennant/mask can avoid storing two whole images, but measure
decoded pixels and draw calls before claiming a saving. Full-canvas transparency
can still consume full GPU texture storage. Keep dynamic rings and queue/health
feedback in the renderer.

Retain layered sources and produce flattened compatibility frames until the
runtime supports the layer contract. State, team, direction, lighting, and wear
are independent metadata dimensions. A one-view image cannot become another
perspective by rotating its quad.

Use [sprite-atlas v1](sprite-atlas-contract-v1.md) for pages, clips, cropped layers,
mask alignment, bounds, and pivot review. Gameplay owns occupancy and collision.
Alpha alone supplies no per-pixel scene depth; occlusion needs renderer support.

## Package checklist

- Complete design and derived state sequence retain one identity and registration.
- Source, normalized runtime, contact sheet, and rebuild command are present.
- Grid/manifest records canvas, scale, camera, anchor, bounds, state thresholds,
  team variants, and unsupported directions.
- Exact prompts/output IDs and hashes remain in provenance.
- README distinguishes source/candidate readiness from actual loading and in-game review.

Examples: [Barracks](../assets/buildings/barracks-sprite-test-v1/README.md),
[Archery Range](../assets/buildings/archery-range-sprite-v1/README.md), and
[legacy Town Center](../assets/buildings/town-center-sprite-v1/README.md).
