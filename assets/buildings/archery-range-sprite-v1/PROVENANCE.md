# Archery Range sprite provenance

- Generated: 2026-09-26 with the built-in Codex ImageGen tool.
- Asset: original Archery Range art for Thousand Unit Skirmish.
- Third-party reference art: none. The original project Barracks sprite was supplied only as a style and camera reference.
- Camera: fixed elevated orthographic three-quarter view, 45-degree azimuth and 46-degree downward pitch.
- Source format: 1254 × 1254 RGBA PNG per state.
- Runtime processing: [`scripts/prepare-building-sprite-pack.py`](../../../scripts/prepare-building-sprite-pack.py) applies one scale calibrated from the complete frame, crops transparent bounds without axis stretching, aligns each state to a common bottom contact edge, writes 640 × 640 team/state WebP frames, and builds the labeled previews.
- Grid and gameplay state mapping: see [`sprite-grid.json`](sprite-grid.json).

## Source generation prompts

### Complete (`exec-7fb022ea-345d-4d7b-b655-26ab03e69f86`)

> Create an ORIGINAL isolated transparent-background RTS building sprite that matches the reference image's painterly, sculptural, grounded frontier-fantasy art style, materials, lighting, and camera. The subject must be a distinct ARCHERY RANGE, not a Barracks: a compact 3 by 3 world-unit timber-and-stone training pavilion, open-sided firing bay, low slate-shingled pitched roof with an extended front awning, visible upright straw target with a few arrows, a small rack of bows and bundled practice arrows, stone footing, and one small Azure-blue cloth team tab on the roof beam. Show the FRONT and RIGHT side from an elevated orthographic three-quarter camera, about 45 degrees around and 46 degrees downward, exactly matching the reference camera. Square canvas, single structure centered, entire silhouette visible, same approximate scale and low oblique projection as the reference. Keep the center of the ground footprint toward the lower-center of the canvas. Transparent alpha background. Use subdued moss, weathered timber, slate, limestone, ochre, with the tiny team cloth accent. Neutral soft daylight. Broad readable silhouette, restrained fine detail. No people, no environment, no ground plane, no hard cast shadow, no text, no labels, no grid, no UI, no watermark, no logos, no recognizable commercial-game reference. Preserve clean cutout edges and actual transparency.

### Foundation (`exec-b26a0d6f-7f0d-41a2-ab46-836ec5c728cd`)

> Edit the referenced original Archery Range into its earliest construction state, about 5% complete. Preserve the exact building identity, 3×3 footprint, front-right elevated orthographic three-quarter view (45° azimuth, 46° downward), source framing, scale, lighting, painterly material treatment, and transparent-background cutout. Show only the finished stone footing and a few low timber sill beams with two or three short corner posts; no full-height walls, target, bow rack, roof, cloth team marker, or scaffolding. The ground-contact footprint remains the same size and position. One structure only, centered; retain the original square canvas. Actual transparent alpha background; no ground plane, cast shadow, workers, environment, text, labels, grid, UI, border, or watermark.

### Frame (`exec-61cf688f-2732-4fef-9678-0dc40084db50`)

> Edit the referenced original Archery Range into a mid-construction state at about 50% complete. Preserve exact building identity, 3×3 footprint, front-right elevated orthographic three-quarter view (45° azimuth, 46° downward), source framing, scale, lighting, painterly materials, and transparent cutout. The complete stone footing remains. Four timber posts and a few waist-to-shoulder-height wall panels are erected with visible diagonal braces and modest corner scaffolds. Leave the entire roof and awning absent, showing only a simple exposed roof-frame beam; the straw target and bow rack are not installed yet. Keep the same open-sided pavilion silhouette as the finished reference, clearly recognizable as that same Archery Range under construction. One centered structure, square canvas, whole silhouette visible. Actual transparent alpha; no ground plane, cast shadow, workers, environment, text, labels, grid, UI, border, or watermark.

### Damaged (`exec-bd26472b-847c-4029-9591-4d45ed5449f0`)

> Edit the referenced completed original Archery Range into a repairable damaged state, equivalent to about 60% health. Preserve exact architecture, target, bow rack, cloth marker, 3×3 footprint, front-right elevated orthographic three-quarter camera (45° azimuth, 46° down), framing, scale, lighting, palette, and transparent cutout. Add restrained localized damage: a small irregular patch of missing slate on one roof slope, a cracked or splintered brace, several chipped stone footing blocks, a broken arrow rack with a few arrows resting on the ground inside the footprint, and a slightly damaged target edge. Keep the roof mostly intact and the target/range identity clear. No fire or smoke. Whole building remains centered in the same square frame; actual transparent alpha background, no ground plane, external cast shadow, people, environment, text, labels, grid, UI, border, or watermark.

### Critical (`exec-a95f345a-ddef-4585-9194-aa900fd197c6`)

> Edit the referenced completed original Archery Range into a critical, nearly ruined but still recognizable battle-damaged state, equivalent to about 20% health. Preserve its core 3×3 footprint, exact front-right elevated orthographic three-quarter camera (45° azimuth, 46° down), material style, general palette, transparent cutout framing, and center ground contact. Show severe localized structural collapse: one entire roof slope partly fallen inward with jagged missing shingles, several broken rafters, one corner timber post snapped, an upper wall bay splintered open, the archery target cracked and tilted, the bow rack broken with a few arrows and roof debris resting inside the footprint. Keep enough intact posts, gable/awning structure and stone footing that it is clearly the same Archery Range. No fire or smoke. Keep the whole silhouette within the same square composition, without changing view or scale. Actual transparent alpha; no ground plane, external shadow, people, environment, text, labels, grid, UI, border, or watermark.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `source/archery-range-complete.png` | `9bcf0c09129140bbb6cb701028ece6e884630a105dc0aa39827536bcf282367c` |
| `source/archery-range-foundation.png` | `507dc653b0fd843360d2d272a2a4e0fe3ef00521d6fd3ef87f3781902358dc8d` |
| `source/archery-range-frame.png` | `92f9c2f7ddbad8a763a1430329a30f0b004d15f5a3965f995433db281cbdab22` |
| `source/archery-range-damaged.png` | `394fefd49bc727718685f016c168d1e18544ab879be0baaa311d3c126bd74f75` |
| `source/archery-range-critical.png` | `342d58e0459bce425dab516a6d365d5d7d3658cb670a6109cb34c16f82b5343f` |
| `runtime/archery-range-foundation-azure.webp` | `fec3e5f83328904b68f41e352da400bf673a78ba6de72821c80352f768743e37` |
| `runtime/archery-range-foundation-ember.webp` | `708baf656fadb51ab6c53e8cb9f5fad068001e407fcac47f5881d82ef43a0c7e` |
| `runtime/archery-range-frame-azure.webp` | `04e781d4de4d1f76489bd8a975b75bfaf7c4c474576c25270d0bb42e8ac17f74` |
| `runtime/archery-range-frame-ember.webp` | `e51c320823f93410bf587cc5929fa805d4094146e3e2f1c18be4dddf36722730` |
| `runtime/archery-range-complete-azure.webp` | `025037e0a482b071a5deb4438ae4ed5c59add165c4ddbb29363eea9b7fc41997` |
| `runtime/archery-range-complete-ember.webp` | `28131b76c7228a9d29f1424bf3bc80f266b4b17cfed92342827c3b6f44ee3d47` |
| `runtime/archery-range-damaged-azure.webp` | `586c3c500b9e6a428f568fc47931277253838c88c79b8eb047877484ca848310` |
| `runtime/archery-range-damaged-ember.webp` | `c746701ed570f3f4bed875f1cbb5a9ccfd815db0cb264036000bed30a2625df6` |
| `runtime/archery-range-critical-azure.webp` | `535bce37d9db4e45d6abac249600a4cc1f9f84760613d2e36abb35913fc820c9` |
| `runtime/archery-range-critical-ember.webp` | `cf6ebeda5e2c35737bc07a3cb619db55e1ef26f0fdc0beda4a275b8ec9445c48` |
