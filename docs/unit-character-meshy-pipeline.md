# Infantry Meshy-to-sprite pilot

**Status:** the approved one-image Infantry pilot completed for 26 Meshy credits. The generated character and its walk, attack, and defeat animation preview drew a very positive user response. It remains an art-source experiment: the generated model omitted the reference spear and shield, no directional sprite frames have been baked, and nothing is integrated in the game. No building assets were changed.

## Input and method

The pilot used exactly one 1024 × 1536 image: [`assets/units/infantry-meshy-reference-v1/source/infantry-reference.png`](../assets/units/infantry-meshy-reference-v1/source/infantry-reference.png), SHA-256 `26a103375b0082974a1e363c81d5cb8c38bbe9e729755a08e10d1cb5818f7235`. Meshy's Image-to-3D API accepts one image; unseen sides are inferred, so the result still needs a full turntable review. [Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d)

One textured Smart Topology GLB was requested in an A-pose, followed by rigging and two preset actions. The rig supplied walk and run clips. This tests the Meshy building-style sequence as a source for future 2D sprites; it does not make skinned GLBs the game's unit renderer.

## Pilot results

| Stage | Meshy task | Cost | Result |
| --- | --- | ---: | --- |
| Textured model, Smart Topology, 15K target | `01a0e00a-3253-7633-b6d7-9731537bec0e` | 15 | `infantry-model.glb`, 3,294,440 bytes; 15,784 triangles, one material/texture |
| Humanoid rig | `01a0e00d-f7d7-77c4-8dcb-8176fa88a0f3` | 5 | `infantry-rigged.glb`, 6,133,660 bytes; 15,691 triangles, 24 joints |
| Built-in walk | included with rig | 0 extra | `infantry-walking.glb`; 1.0667-second clip |
| Preset Attack | `01a0e012-089c-72c3-afaa-1128e8881858` | 3 | `infantry-attack.glb`; 2.8333-second clip |
| Fall Dead from Abdominal Injury | `01a0e012-9d14-77e9-b7d9-d8ca9f42e9ba` | 3 | `infantry-defeat.glb`; 3.5333-second clip |

Total: **26 credits**. The task receipts are the cost evidence. Meshy task metadata did not include a face count, so the local GLB parse supplied the triangle counts; the rigged model is well below the documented 300,000-face rigging ceiling. The generated body retained the tunic, face, and blue sash, but omitted both the spear and shield shown in the input.

The local preview is `meshy_output/20260926_192615_infantry-meshy-pilot_01a0e00a/infantry-animation-preview.html` in the `infantry-meshy-pilot` worktree. It plays the walk, attack, and defeat clips and provides eight camera headings; it is a GLB review page, not a rendered sprite sheet. The user's local browser preview is available at `http://127.0.0.1:8765/meshy_output/20260926_192615_infantry-meshy-pilot_01a0e00a/infantry-animation-preview.html` while that local server is running. Generated GLBs, provider task JSON, and the preview are kept in that local pilot output folder rather than this source branch.

## Cost, account, and rights notes

The pilot receipts total the approved 26-credit ceiling: 15 for the textured model, 5 for rigging, and 3 for each animation. The official [Meshy API pricing](https://docs.meshy.ai/en/api/pricing) lists the current stage costs; recheck before any future paid job. After the rig task, the observed account balance was 620; after the two 3-credit animation tasks it read 529. Those receipts explain six credits, leaving an unexplained 85-credit difference. Do not attribute that difference to this pilot.

The [Meshy Terms of Use](https://www.meshy.ai/terms-of-use) distinguish output rights by plan and state that non-Enterprise API outputs are deleted after three days. The plan/license entitlement for this account was not captured, so check it before publishing outputs. This does not affect the local visual evaluation.

## Next useful step

Before treating the candidate as Infantry, decide how to address the missing spear and shield without rerunning paid Meshy stages. If the visual is still useful as a baseline, the next no-provider-cost experiment is to bake a small, deterministic eight-heading sample from the existing clips, with stable camera, ground pivot, transparent frames, and clip timing. A full atlas and integration are still separate work. Preserve the current game path until a sprite candidate is reviewed in-game at ordinary and strategic zoom.

The prior sprite-source readability and live transition gaps remain in [`unit-sprite-exploration.md`](unit-sprite-exploration.md). This pilot does not replace that evidence or claim an in-game result.
