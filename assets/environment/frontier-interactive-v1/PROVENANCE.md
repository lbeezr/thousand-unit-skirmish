# Frontier interactive environment pack v1

This pack contains four-stage resource sprites for the existing oak and berry nodes, plus two construction-ground samples. The full resource images are byte-for-byte copies of the original project sources. The six non-full resource states and two construction states are original Codex ImageGen outputs created for this project. No third-party source art or reference images were used.

`manifest.json` is the machine-readable record of every delivered PNG and WebP: role, dimensions, license, provenance, and SHA-256. Runtime images are lossy WebP encodes at quality 86 from the matching RGBA PNG source, made with Pillow 12.3.0. Alpha is retained. Pixel canvas size is unchanged between each PNG and its WebP.

## Source lineage

| Asset | Source lineage | Generated output ID |
| --- | --- | --- |
| `oak-full.png` | Exact copy of `assets/environment/frontier-v1/oak.png`; original source is documented in `assets/environment/frontier-v1/PROVENANCE.md`. | `exec-9188de90-03cc-40cf-a684-91d8b70287e1` |
| `oak-worked.png` | ImageGen edit of the project oak source. | `exec-db9ae09b-c37b-4199-9044-46d245f71726` |
| `oak-low.png` | ImageGen edit of the project oak source. | `exec-1991f2aa-f9c8-4ee5-b629-f709b798fdcd` |
| `oak-depleted.png` | ImageGen edit of the project oak source. | `exec-757acd0e-eb0c-473f-bcc6-d2d91698ac8d` |
| `berries-full.png` | Exact copy of `assets/environment/frontier-v1/berries.png`; original source is documented in `assets/environment/frontier-v1/PROVENANCE.md`. | `exec-dd127de7-f4a1-4d8c-b565-9c2c6c56357c` |
| `berries-worked.png` | ImageGen edit of the project berry source. | `exec-f05abe8c-80b6-4ad7-a539-2fc5c53af2cd` |
| `berries-low.png` | ImageGen edit of the project berry source. | `exec-318eb9ca-c0e8-4a90-b0bb-8ce8cdb50633` |
| `berries-depleted.png` | ImageGen edit of the project berry source. | `exec-37ba5e8d-71de-40c9-ae32-5af6204512b2` |
| `construction-earthwork.png` | Original ImageGen construction-ground sample. | `exec-ad38ae1a-85d9-494f-add4-e55c5110e052` |
| `construction-foundation.png` | Original ImageGen construction-ground sample. | `exec-11a439d5-a429-4f43-a3a7-de0b2a589e05` |

The generated-image output files are preserved under the task's Codex generated-images directory. Prompt intent notes are in `PROMPTS.md`; the notes are not verbatim prompt transcripts.

## Direct source review

Resource depletion reads through visibly thinner oak canopy, fewer berry fruits, and a fruitless sparse berry shrub. The construction samples distinguish bare earthwork from a stone foundation. Direct source review also shows a thin yellow-green contour on the oak cutout. A minimal ImageGen cleanup attempt was not adopted because it did not remove the contour consistently. Terrain-edge approval remains for the renderer's in-game review; this pack contains no composite preview.
