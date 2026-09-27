# Infantry Meshy-to-sprite pilot

**Status:** the approved one-image Infantry pilot completed for 26 Meshy credits and received a very positive user response. Its existing model and clips are now baked into an eight-heading, 264-frame atlas. By user direction, this candidate is the default Worker/peasant appearance on the current branch; its attack swing supplies looping gather/build poses. The model omitted the reference spear and shield. No additional Meshy credits or building assets were used. The output is included with a documented rights inference: Meshy API access is unavailable on the free plan, and its Terms assign output ownership to paid-plan customers. The account-plan receipt was not captured.

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

The source GLBs and animation preview remain in `meshy_output/20260926_192615_infantry-meshy-pilot_01a0e00a/` in the `infantry-meshy-pilot` worktree. The pilot's local baker is [`scripts/meshy-infantry-sprite-capture.html`](../scripts/meshy-infantry-sprite-capture.html), served by [`scripts/serve-meshy-infantry-capture.mjs`](../scripts/serve-meshy-infantry-capture.mjs). The local output folders are [`worker-sprite-v3`](../assets/units/worker-sprite-v3/README.md) and [`infantry-sprite-v2`](../assets/units/infantry-sprite-v2/README.md). Each frame shares a 128×128 orthographic envelope fitted across all eight headings and all sampled poses. Attack uses 16 samples over 900 ms; there is no per-frame camera movement.

Repeat the local bake with the existing downloaded pilot files (no provider credits): run `node scripts/serve-meshy-infantry-capture.mjs --pilot-dir <pilot-output-directory> --port 8766`, open `http://127.0.0.1:8766/capture`, and choose **Bake atlas and install local packs**. The server is bound to loopback and writes only the two pilot packs. This first version is pilot-specific: it expects `infantry-model.glb`, `infantry-walking.glb`, `infantry-attack.glb`, and `infantry-defeat.glb`, then emits the Worker role-fit and Infantry candidate packs. Dedicated Archer generation and clip mapping remain a later slice.

## Cost, account, and rights notes

The pilot receipts total the approved 26-credit ceiling: 15 for the textured model, 5 for rigging, and 3 for each animation. The official [Meshy API pricing](https://docs.meshy.ai/en/api/pricing) lists the current stage costs; recheck before any future paid job. After the rig task, the observed account balance was 620; after the two 3-credit animation tasks it read 529. Those receipts explain six credits, leaving an unexplained 85-credit difference. Do not attribute that difference to this pilot.

Meshy states that [Free plan users cannot access the API](https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan), and its [Terms of Use](https://www.meshy.ai/terms-of-use) say paid-plan customers own their Customer Output. Since the pilot was generated through the Meshy API, we infer that the account had a paid plan at generation; an account-plan receipt was not retained. Meshy also says non-Enterprise API output is deleted after three days, so the local GLBs were downloaded and are held in the pilot worktree. The free-plan fallback is CC BY 4.0; the source attribution is recorded in each sprite-pack README.

## Next useful step

Review the default Worker in a live match at ordinary and strategic zoom. The source attack swing is only a proxy for gathering and building and the character has no tools; decide whether those are acceptable before creating distinct role art. The generated atlas packs are part of this PR with the API/paid-plan rights inference and Meshy attribution recorded. The local baker uses the existing output only and requires no extra Meshy credits.

The canonical sprite pack reserves an optional [`capture` record](../schemas/sprite-atlas-capture-v1.schema.json) for source GLB hashes, fixed-camera framing, and per-frame model yaw and clip sample time. This pilot baker writes `captureMode: model-pose` and records the source hashes and sample times; legacy building camera-orbit records may omit `captureMode`.

The prior sprite-source readability and live transition gaps remain in [`unit-sprite-exploration.md`](unit-sprite-exploration.md). The normal local game path now uses Worker v3, but this is not a standard-scale readability or 2,000-unit performance claim.
