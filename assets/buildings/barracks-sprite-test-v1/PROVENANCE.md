# Barracks sprite test provenance

- Generated: 2026-09-26 with the built-in Codex ImageGen tool.
- Asset: original Barracks art for Thousand Unit Skirmish.
- Third-party reference images: none.
- Camera: fixed elevated orthographic three-quarter view.
- Source size: 1254 × 1254 RGBA PNG per state.
- Grid contract and current limits: see [`sprite-grid.json`](sprite-grid.json) and [`README.md`](README.md).
- Frame preparation: [`scripts/prepare-barracks-sprite-test.py`](../../../scripts/prepare-barracks-sprite-test.py) crops alpha bounds, fits without stretching, aligns each state to one projected ground-center anchor, and creates Ember cloth variants by a deterministic hue transform.

## Generated source images

| Source | ImageGen output id | SHA-256 | State |
| --- | --- | --- | --- |
| `source/barracks-complete.png` | `exec-0659207b-3bd6-4490-bb8b-e24ca17e4a2d` | `1b01289b5c8c05af96c34f40792c2e11f33c6373dde51e1e688ec599b82e1052` | Complete, undamaged |
| `source/barracks-foundation.png` | `exec-2379cc7b-f6b9-4d62-b7e0-81f4dac5a8b3` | `617a1afb5bf6a1bff4866986c6341ade87232f1ac1f072756a3212c808039e2f` | Earliest construction |
| `source/barracks-frame.png` | `exec-647ed98e-e125-4465-9885-3abeff95ba22` | `db3e96fb86c0d2591c79bd292437729fa5e68d80a015c79c38e8829c51da80ec` | Mid-construction |
| `source/barracks-damaged.png` | `exec-14567df1-d623-4b67-ad14-4fbe1fdcaab1` | `fcef07621ffbec2ee2865a2afa73708db7bf92cadf31f626dd6f680d7152290c` | Repairable damage, about 60% health |
| `source/barracks-critical.png` | `exec-d2e80848-eeb7-4724-85f0-bd7b391efeb5` | `0a59c7a187cbb617a1caf1be49145bc2f33cbe0b38a466acb099aad76e8c44d7` | Major damage, about 20% health |

Original generated PNGs are retained here. Their SHA-256 hashes and normalized frame hashes are listed at the end of this document.

## Exact generation prompts

### Complete

> Use case: stylized-concept. Asset type: original transparent-background 2D building sprite for a browser RTS prototype, intended to sit over an existing 3D battlefield. Primary request: one completed, fully operational frontier Barracks building, designed for a 3 by 3 world-unit footprint. It should read clearly as a military production building at strategic zoom. Subject: a compact original timber-and-stone barracks, broad low rectangular plan, thick stone footings, weathered timber walls, a clearly visible central entry on the near-facing short side, a steep dark moss-slate pitched roof with one distinctive raised ridge, a small restrained Azure-blue cloth tab on a roof beam as a removable-looking team accent. Use grounded medieval frontier architecture, not a replica of any commercial game. Camera: fixed elevated three-quarter orthographic view looking from the front-right corner, approximately 45 degrees around the building and 46 degrees downward, matching an oblique RTS camera; show the front entrance and right side. Composition: one isolated building, centered, fully visible, footprint reads as exactly 3 by 3 grid units; square canvas with generous transparent padding, building occupies most of frame while leaving safe margin; align the center of its ground footprint to a consistent anchor point near the bottom-center. Style: painterly sculptural 3D appearance translated into a polished 2D cutout sprite, matching a subdued moss, weathered timber, slate, stone, and ochre frontier palette; clear large shapes and modest detail, strong roofline silhouette. Lighting: neutral soft daylight, even enough that later day/night tinting remains possible. Constraints: actual transparent alpha background, subtle self-occlusion only, no environment, no ground plane, no hard cast shadow, no text, no labels, no border, no grid lines, no extra props, no people, no smoke, no damage, no construction scaffolding, no UI, no watermark, no resemblance to Age of Empires or another franchise.

### Foundation

> Edit the referenced original RTS Barracks sprite into its earliest construction state. Keep the same exact building identity, footprint, centered ground anchor, front-right corner orientation, elevated orthographic camera, canvas framing, light direction, stone/timber palette, neutral transparent cutout style, and overall silhouette placement. Show only 0–10% construction: the full 3 by 3 unit stone footing is laid, with a few short timber sill beams and two or three waist-high corner posts; most of the walls and all roof pieces are absent. Make the low foundation clearly recognizable as the start of the same building, not a different structure. No complete walls, no roof, no banners yet, no workers, no scaffolding taller than the foundation, no background, no floor plane, no text, no labels, no grid, no cast shadow outside the asset, no damage.

### Mid-construction frame

> Edit the referenced original RTS Barracks sprite into a mid-construction state at about 55% complete. Keep the exact same building design, 3 by 3 world-unit footprint, centered ground anchor, front-right corner orientation, elevated orthographic camera, square canvas framing, lighting, materials, and painterly cutout style. The stone footing is complete. The weathered timber walls have risen to about half-to-two-thirds height with some upper panels and braces still missing; show a small amount of simple timber scaffold at the corners. The roof structure and all roof shingles are absent, leaving an open timber roof frame only. No finished banners. It must clearly be the same Barracks as the reference at an earlier construction stage. Transparent background, isolated sprite, no workers, no environment, no ground plane, no text, no labels, no grid, no external cast shadow, no damage, no smoke.

### Repairable damage

> Edit the referenced completed original RTS Barracks into a battle-damaged but still functional state, equivalent to about 60% health. Preserve the exact same building identity, complete timber walls, 3 by 3 world-unit footprint, centered ground anchor, front-right corner view, elevated orthographic camera, canvas framing, scale, lighting, painterly materials, banners, and transparent cutout background. Add restrained visible damage only: a palm-sized irregular patch of missing roof slates on one roof slope, several cracked and darkened shingles, one splintered timber brace, a few chipped foundation stones, and a small amount of debris resting against the base. Keep the doorway and overall roof silhouette intact so it is clearly repairable and still operational. Do not add fire, smoke, people, a new environment, a ground plane, text, labels, a grid, or a cast shadow outside the sprite. Do not change camera angle or building proportions.

### Critical damage

> Edit the referenced completed original RTS Barracks into a critically damaged but still identifiable state, equivalent to about 20% health. Keep the same building identity, footprint, centered ground anchor, front-right elevated orthographic camera, square composition, painterly transparent cutout style, timber, stone and slate materials, and remaining cloth markers. Show severe but localized structural failure: collapse one portion of the upper roof slope with a large irregular opening, break several main rafters, heavily splinter one upper timber wall section, crack and displace a few stones, and place a modest pile of roof and timber debris at the base. Keep the entrance and one side wall readable so the structure is still recognizable. The overall silhouette is lower only where it has actually collapsed. No fire, no smoke, no people, no background, no floor plane, no text, no labels, no grid, no external cast shadow. Do not change the camera, orientation, style, or scale.

## Normalized runtime frames

All runtime files are 640 × 640 transparent WebP frames, 5 × 5 world units at the declared scale. Azure frames preserve the generated cloth hues; Ember frames recolor saturated blue pixels while preserving their shading and the gold emblems.

| Runtime frame | SHA-256 |
| --- | --- |
| `runtime/barracks-foundation-azure.webp` | `8fd7df07c639bc5b948da76352edd42cb5db8a566515a7c4bc7e54c87ac4be0a` |
| `runtime/barracks-foundation-ember.webp` | `911529ec14555df3b9c2c9b478b1bdf31947e9038bfd801675b837718028bd6a` |
| `runtime/barracks-frame-azure.webp` | `4331a45af89719f3fe23a67069e6a032e438a010ad50aa15526f3076c0d6b616` |
| `runtime/barracks-frame-ember.webp` | `a3499d05993186b822681cb901429825c57ba81ab6b2f5999620df22f73ef459` |
| `runtime/barracks-complete-azure.webp` | `5511ff2f9f638530f459a69933d0881e4425775bb7c2e906d4b11333e9b00f97` |
| `runtime/barracks-complete-ember.webp` | `d4a8da173a1c3c41c5785c067c6e478b582fa3f441573a22085e6a3752e429c8` |
| `runtime/barracks-damaged-azure.webp` | `8b23ac8a05358e69513ac441d60f8395ce98591ddb5fcc7a5d364b185cefebd0` |
| `runtime/barracks-damaged-ember.webp` | `10c19230d3a44523d7f1b78adfdbc64d9bc3d8459f883b618f3e29cec2c6240b` |
| `runtime/barracks-critical-azure.webp` | `ccca7e866a2a08aeda0b81e1f9208f13bb0e7ef33278709e82d5663deb9961b0` |
| `runtime/barracks-critical-ember.webp` | `f7fde9e4123fe2a4e827d7232b223f884b9f519dbb473e6a54127db7fa2be79b` |
