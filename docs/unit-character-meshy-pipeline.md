# Infantry Meshy-to-sprite pilot

**Status:** the approved one-image Infantry pilot completed for 26 Meshy credits and received a very positive user response. Its existing model and clips are now baked into an eight-heading, 264-frame atlas. By user direction, this candidate is the default Worker/peasant appearance on current `main`; its attack swing supplies looping gather/build poses. The model omitted the reference spear and shield. No additional Meshy credits or building assets were used. Rights for these outputs are verified from the successful API task receipts dated 26 September 2026 and Meshy's terms in effect on that date: the Help Center says the Free plan has no API access, and the Terms of Use (last updated 19 September 2026) assign Customer Output ownership to paid-plan customers. The account-plan receipt was not retained. The follow-up capture tool now stages every new bake locally with rights pending; it does not write to tracked game assets.

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

Repeat the local bake with the existing downloaded pilot files (no provider credits): run `node scripts/serve-meshy-infantry-capture.mjs --pilot-dir <pilot-output-directory> --port 8766`, open `http://127.0.0.1:8766/capture`, and choose **Bake candidates to local staging**. The server is bound to loopback and writes only under the ignored `meshy_output/unit-sprite-captures/<run-id>/` directory. It does not overwrite or install either tracked pack. Review the output and verify the source generation's rights and attribution before manually promoting any pack to `assets/units/`; each staged manifest starts with rights pending. This first version is pilot-specific: it expects `infantry-model.glb`, `infantry-walking.glb`, `infantry-attack.glb`, and `infantry-defeat.glb`, then emits the Worker role-fit and Infantry candidate packs. Dedicated Archer generation and clip mapping remain a later slice.

## Cost, account, and rights notes

The pilot receipts total the approved 26-credit ceiling: 15 for the textured model, 5 for rigging, and 3 for each animation. The official [Meshy API pricing](https://docs.meshy.ai/en/api/pricing) lists the current stage costs; recheck before any future paid job. After the rig task, the observed account balance was 620; after the two 3-credit animation tasks it read 529. Those receipts explain six credits, leaving an unexplained 85-credit difference. Do not attribute that difference to this pilot.

The four successful API task receipts establish that this source run used Meshy's API. Meshy's [Free-plan guide](https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan) says API access is limited to paid plans, and its [Terms of Use](https://www.meshy.ai/terms-of-use), last updated 19 September 2026, say that paid-plan customers own Customer Output. Together, those contemporaneous receipts and terms verify paid-plan output ownership for this pilot; the separate account-plan receipt was not retained. The applicable current terms and provider task IDs are documented above. Meshy says non-Enterprise API output is deleted after three days, so the local GLBs were downloaded and are held in the pilot worktree. Free-plan webapp outputs use CC BY 4.0, but that fallback does not apply to this API pilot.

## Next useful step

Review the default Worker in a live match at ordinary and strategic zoom. The source attack swing is only a proxy for gathering and building and the character has no tools; decide whether those are acceptable before creating distinct role art. The pilot atlas packs record their verified API/terms evidence. New baker output is ignored local staging with rights pending until a human verifies the source run and promotes a reviewed pack. The local baker uses the existing output only and requires no extra Meshy credits.

The canonical sprite pack reserves an optional [`capture` record](../schemas/sprite-atlas-capture-v1.schema.json) for source GLB hashes, fixed-camera framing, and per-frame model yaw and clip sample time. This pilot baker writes `captureMode: model-pose` and records the source hashes and sample times; legacy building camera-orbit records may omit `captureMode`.

The prior sprite-source readability and live transition gaps remain in [`unit-sprite-exploration.md`](unit-sprite-exploration.md). The normal local game path now uses Worker v3, but this is not a standard-scale readability or 2,000-unit performance claim.

## Proposed reusable character template — 29 September 2026

This is a production plan, not a claim that these clips or rendering features
already exist. It applies to the final Worker/Infantry/Archer character sources
and appearance variants. The current human/orc/elf/troll cast remains a review
sample; species appearance must not silently change gameplay role or stats.

### Source and view contract

Prefer one editable, rigged character source with painted materials, equipment
attachments, a grounded root, and named animation clips. Meshy can supply an
approved initial source; the export contract should also accept locally authored
Blender models. Review the full turntable before animation so inferred backs and
missing equipment are caught early. Keep model, rig, materials, tool meshes,
animation sources, licenses and capture settings together.

Match the actual orthographic game camera: `src/main.js` currently uses the
normalized offset `(0.78, 1.12, 0.78)`, approximately 45.4 degrees elevation and
45 degrees horizontal azimuth. This is an oblique game view, not a requirement
to use the textbook 35.264-degree isometric elevation. Record camera quaternion,
projection, source model yaw, root position, lighting and scale in the capture
manifest. Use the runtime's current direction mapping rather than interpreting
sheet compass labels as screen directions.

The first complete template has eight facings, 45 degrees apart: north,
north-east, east, south-east, south, south-west, west, north-west. Author all
views; mirroring can swap weapon hands and lighting. A 16-facing candidate at
22.5-degree steps is the next comparison, requiring an explicit runtime/contract
extension. Adopt it only if actual turning looks materially better at ordinary
zoom for its doubled frame cost. Thirty-two facings are a reference option,
not the default production requirement.

### Complete pose roster

Frame counts below are starting budgets for a new source, not fixed playback
speeds or requirements to duplicate poses. Preserve source duration and sample
roughly 16–20 poses/second; retain readable anticipation, contact/release and
recovery poses even when that needs an extra sample. A short hold is authored
animation timing, never a substitute for a cut or missing pose.

| Clip | Starting unique poses per facing | Who needs it | Motion and playback |
| --- | ---: | --- | --- |
| Idle | 8 | All roles | Quiet breathing; loop without root drift |
| Walk | 12 | All roles | Clear planted feet; seamless loop; travel supplied by simulation |
| Ready idle | 6 | Infantry/Archer | Equipment readable before an attack; reuse idle if visually equivalent |
| Melee attack | 12–16 | Infantry; Worker only if its gameplay requires combat | Anticipation, thrust/swing, contact, recovery; action-event mapping |
| Ranged attack | 16–20 | Archer | Nock, draw, aim, release, recovery; projectile remains renderer/simulation-owned |
| Chop | 12–16 | Worker wood gathering | Tool strikes resource; distinct from combat |
| Food gather | 12 | Worker food gathering | Reach/harvest/recover, appropriate to current resource interaction |
| Build/repair | 12–16 | Worker | Tool/work stroke directed toward building; shared clip allowed when meaning agrees |
| Carry idle / walk | 6 / 12 | Worker, once load state exists | Visible load; stable held object and grounded gait |
| Defeat | 16–20 | All roles | Fall to ground; non-looping; retain endpoint through current fade policy |
| Corpse pose | 1 terminal pose | All roles | Reuse defeat endpoint; longer persistence requires a gameplay/runtime decision |

Hit flinch, run, celebrate, casting, mounted actions and special abilities are
optional future modules. Do not make ordinary damage cancel orders or reset an
attack because an animation exists. Carry, ready-idle and differentiated work
clips require state mapping beyond today's idle/walk/gather/attack/defeat paths;
implement only the applicable signals. Existing clip duration must not change
combat cadence, gathering income or projectile impact rules.

A broad worker source with idle 8, walk 12, melee 16, chop 16, food 12, build 16,
carry-idle 6, carry-walk 12 and defeat 20 has 118 samples/facing: 944 at eight
facings, 1,888 at sixteen. This is a planning upper bound for that roster, not a
universal per-character atlas. Share a clip where the action is truly identical
and emit only clips used by each role. Reuse rigs across compatible variants;
a troll may need different proportions, contacts and animation rather than a
stretched human rig.

### Frame, scale and layer contract

Capture standalone transparent frames before packing. Preflight every sampled
pose, heading, weapon tip and carried object against the camera frame; enlarge
the common capture envelope if any touches an edge. Keep horizontal root travel
out of the sprites while preserving vertical hips and foot motion. Use one
source root and one fixed framing/scale across the animation set. Do not center
or align feet separately for each frame. The connected-silhouette importer is a
recovery path for legacy sheets, not the ideal normal source format.

Use 512-pixel transparent source frames as an initial test resolution and compare
128/160/192/256 runtime cells at actual game display size. Choose the smallest
that preserves the approved silhouette and equipment; the current 160-pixel
cast repair is not a universal final size. Preserve the art-direction guide's
roughly 0.8-world-unit role target; any normalization from today's exploratory
pack sizes is an explicit reviewed change. A taller species gets a declared
scale, not a packing side effect.

Pack measured complete bounds with at least eight transparent pixels of nominal
margin, and validate the final decoded pixels after resampling. Preserve root
and offsets even if storage rectangles are trimmed. Extrusion, filtering and
mipmap policy need an atlas-neighbor bleed test. Split pages before exceeding
the target GPU texture-size limit; never lower scale silently to fit a page.
At 160 pixels, 944 fixed cells occupy about 92 MiB of raw RGBA color data before
mask textures/mipmaps, regardless of a small compressed download. Budget loaded
pages and masks before multiplying species, directions or equipment variants.

Required runtime outputs: color RGBA, a selective grayscale team-accent mask,
frame bounds/pivot/rect metadata, directions, per-pose durations, clip loop rules,
world scale and hashes. Team color belongs on the sash/pennant and approved
accents; neutral skin, tool and armor retain their colors. A whole-body alpha
mask is an exploratory fallback. Ground shadows stay separately grounded rather
than painted into a standing billboard. Keep selection rings, health bars,
projectiles and order effects renderer-owned. Normal/depth/shadow passes are
useful optional source exports, but require an actual consumer before shipping.

### Quality bar and first proof

At native display size, identify role, heading, action and team without a label.
Worker tools/load, Infantry spear/shield and Archer bow/quiver must separate the
roles. Broad painted value shapes and restrained texture should agree with the
frontier environment. Check both teams on Meadow and Cinder at zoom 0.91 and
0.48, plus close inspection for errors; a beautiful enlarged sheet is insufficient.

Automated checks cover the entire roster: source and final alpha edges, empty
poses, measured bounds, common root/scale, frame roster, timing, loop endpoints,
mask coverage, page limits, hashes and reproducible output. Run every pose through
the actual renderer on terrain for both teams/zooms, with per-species coverage
and viewport-edge assertions. Review motion loops for foot sliding, pose pops,
prop intersections, weapon handedness and defeat ground contact. Check forest,
building and slope depth separately; a flat-ground test alone cannot prove all
occlusion behavior. Record build, assets and concrete player observations.

Next production slice: one complete Worker with real tools, eight facings and
idle/walk/chop/food/build/defeat. Prove the template in a match before expanding
all species. Render one 8-versus-16-facing turn comparison from the same source.
Then create Infantry/Archer equipment and attacks, and add carry states when
runtime signals are available. Each useful slice may integrate independently;
the final quality bar is not a hold on source samples or ordinary staging merges.

### Researched references and tools

Sources inspected on 29 September 2026. Their documented features inform the
proposal; external pipelines have not been installed or validated in our project.

- [World's Edge: Age of Empires DE's sprite workflow](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/)
  describes 3D sources rendered into 2D, eight original versus 32 newer facings,
  and three asset zoom levels. This supports the technique and illustrates its
  content cost; its artwork is a visual reference, not a reusable asset pack.
- [Blender camera documentation](https://docs.blender.org/manual/en/latest/render/cameras.html)
  explains orthographic capture. Use Blender for editable source/rig/capture;
  match our camera rather than adopting an add-on's default angle.
- [HardRockTech's 3D-to-2D pipeline](https://github.com/HardRockTech/3d-to-2d-sprite-pipeline)
  is MIT licensed and documents eight-direction captures, metadata, normal,
  height and shadow outputs. It is a small reference repository, not a proven
  maintained dependency for our game. Inspect and adapt narrowly useful pieces.
- [iso-render-pipeline](https://github.com/craigrmccown/iso-render-pipeline)
  documents a Blender add-on with sample-rate and manifest output plus
  downsampling. Its default angle differs from ours; license and compatibility
  need verification before code adoption.
- [Flare editable art sources](https://github.com/flareteam/flare-game/tree/master/art_src)
  and [animation metadata](https://github.com/flareteam/flare-engine/wiki/Attribute-Reference)
  provide an inspectable isometric fantasy example with directional frames,
  offsets and timing. [Credits](https://github.com/flareteam/flare-game/wiki/Credits)
  list asset-specific licenses, including CC-BY and CC-BY-SA; inspect each source
  before reuse. Its art is a useful modest baseline, not our final polish target.
- [OpenRA sprite sequences](https://docs.openra.net/en/release/sprite-sequences/)
  document explicit facings, sequence lengths, milliseconds, shadows and depth
  offsets. Borrow the separation of metadata concerns, not assumptions about
  its engine formats or the rights to original commercial game assets.
- [Krita animation export](https://docs.krita.org/en/reference_manual/render_animation.html)
  and [onion skins](https://docs.krita.org/en/reference_manual/dockers/onion_skin.html)
  suit painted cleanup and temporal review. [LibreSprite](https://github.com/LibreSprite/LibreSprite)
  is a GPLv2 sprite editor with animation preview, layers and onion skins; use it
  for a pixel-oriented experiment rather than imposing pixel art on this game.
- [Kenney Animated Characters](https://kenney.nl/assets/animated-characters-protagonists)
  is a CC0 model resource for a no-cost technical capture test. Its modern stylized
  characters are not the intended fantasy look. [Kenney's source license FAQ](https://kenney.nl/support)
  confirms asset-page CC0 status; retain each downloaded package's license.
