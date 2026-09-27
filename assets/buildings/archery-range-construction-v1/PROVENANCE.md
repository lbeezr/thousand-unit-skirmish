# Archery Range construction sprite provenance

- Artwork generated 2026-09-26 with the built-in OpenAI ImageGen tool.
- The complete frame is original project-owned Archery Range artwork. The first construction pass used that frame as its visual and camera reference.
- The revised frame, rails, and canopy preserve their first-pass construction geometry while adding the target, bow rack, arrows, and a consistent Azure pennant earlier in the sequence. Both generations are retained.
- No Age of Empires II sprites or other third-party images were used as source pixels.
- Images are isolated RGBA PNGs, 1254 × 1254 before normalization.
- Normalized frames use a fixed scale derived from the complete frame's alpha width, a shared projected ground anchor, and the 3 × 3 footprint guide.
- The team mask is authored by color selection in each pennant's bounded region. It excludes the target, arrows, and other blue details.
- The two Meadow preview inputs are Azure-session captures from the project's worker-sprite appearance review. They are included under `source/map-captures/` so the composites can be regenerated. The Ember preview changes only the sprite pennant tint; its HUD and map capture remain Azure.
- `sprite-atlas-pack-v1.json` records the image hashes and runtime page settings. `SHA256SUMS.txt` covers the package files.

## ImageGen output IDs

| File | Output ID | Edit |
| --- | --- | --- |
| `source/generated/archery-range-foundation.png` | `exec-43a40895-6ce5-406b-8251-da6544ba1b9f` | Reduce the completed range to its stone foundation and floor. |
| `source/generated/archery-range-frame.png` | `exec-c1a0a65e-b6b5-413f-ad10-3fdba0357a18` | Add the timber frame while keeping the same camera and footprint. |
| `source/generated/archery-range-rails.png` | `exec-e9423224-e195-4df5-87c0-4e8cd8a29f6a` | Add the open training rails and equipment structure. |
| `source/generated/archery-range-canopy.png` | `exec-f231102b-8bc1-4ba4-aa26-d7b99725e47e` | Add a partial slate canopy and exposed rafters. |
| `source/generated/archery-range-complete.png` | `exec-7fb022ea-345d-4d7b-b655-26ab03e69f86` | Original completed Archery Range reference. |

The PNG exports do not contain prompt metadata. Initial frame, rails, and canopy prompts plus all three revision prompts are recorded in `source/prompts.md`; the initial foundation request is summarized there because its original prompt text was not retained.

## Revision 2 ImageGen output IDs

| File | Output ID | Edit |
| --- | --- | --- |
| `source/generated-v2/archery-range-frame.png` | `exec-571e7372-767b-42a1-9ceb-20a1be204a4e` | Add a readable target, bow rack, arrows, and pennant to the first above-foundation stage. |
| `source/generated-v2/archery-range-rails.png` | `exec-98837a70-b22f-40ac-8b17-325a3045c21d` | Carry the same archery equipment and pennant into the practice-rails stage. |
| `source/generated-v2/archery-range-canopy.png` | `exec-8894b2e4-fd8a-46d6-8115-675ffa6dcb59` | Carry the target, bow rack, arrows, and pennant into the partial-canopy stage. |
