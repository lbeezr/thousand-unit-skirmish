# Provenance

- **Created:** 2026-09-26
- **Role:** Infantry
- **Source:** original concept art generated with OpenAI ImageGen for this unit-art exploration.
- **Selected input:** `source/infantry-reference.png`
- **Image dimensions:** 1024 × 1536
- **SHA-256:** `26a103375b0082974a1e363c81d5cb8c38bbe9e729755a08e10d1cb5818f7235`
- **Input count:** one image; this is the only image in the Meshy reference pack.
- **Meshy model task:** `01a0e00a-3253-7633-b6d7-9731537bec0e` — textured Smart Topology, 15K target, 15 credits; output `infantry-model.glb`, 15,784 triangles.
- **Rig task:** `01a0e00d-f7d7-77c4-8dcb-8176fa88a0f3` — 5 credits; 15,691 triangles, 24 joints, with built-in walk/run clips.
- **Attack task:** `01a0e012-089c-72c3-afaa-1128e8881858` — preset Attack, 3 credits; 2.8333-second clip.
- **Defeat task:** `01a0e012-9d14-77e9-b7d9-d8ca9f42e9ba` — Fall Dead from Abdominal Injury, 3 credits; 3.5333-second clip.
- **Total pilot cost:** 26 credits (task receipt totals).
- **Output location:** local `infantry-meshy-pilot` worktree, `meshy_output/20260926_192615_infantry-meshy-pilot_01a0e00a/`; contains the downloaded GLBs, task records, and `infantry-animation-preview.html`.
- **Visual result:** tunic, face, and blue sash were retained; the generated model omitted the source spear and shield.
- **Runtime status:** no sprite frames or game integration; the local HTML preview plays walk, attack, and defeat clips from eight camera headings.
- **Publication rights:** account plan/license entitlement was not recorded; verify Meshy's current plan terms before publishing generated outputs.

## Local output hashes

The generated outputs remain local in the pilot worktree. These SHA-256 values identify the exact files reviewed:

| File | SHA-256 |
| --- | --- |
| `infantry-model.glb` | `683bdf56dec89804ab151d0aff9d629963654e81739eb297f939eba38c4569b8` |
| `infantry-rigged.glb` | `b3fac7053b9e116434cf0d75b6fe3d4484ae40bf7b772ac8696310c082a07259` |
| `infantry-walking.glb` | `03c68f083ea1cdc1ef77b4fe9d953c41040b6d3ef447952de1b7fc8c87aeca1e` |
| `infantry-attack.glb` | `d1198928f644ced25a2e8b9465f83d8e35abdc01489fb70bf69d17d1137eb1a3` |
| `infantry-defeat.glb` | `a8fbd41fa10e7ccf6586ebbd6c91e220d3cb17f741a939bbb11c809fb02730a5` |
| `infantry-model-preview.png` | `859c3c163cc81ebb5a959972bf29330b41da8c7a313b4d43612b388d90bd5338` |
| `infantry-animation-preview.html` | `b43731ddb6c1bfb257a74dc52189363c302dcdbcf23b0fadbaa3c6ab6dbfd07d` |

The concept uses the Infantry cues in `docs/art-production-lanes.md` and `docs/unit-building-art.md`. The original image was selected from the exploration's generated drafts; only the selected final image is included here. `REFERENCE-BRIEF.md` records the visible design for reproducibility but is not claimed to be the verbatim original generation prompt.
