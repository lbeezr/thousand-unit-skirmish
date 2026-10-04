# Frontier economy building runtime

Mill, Farm and Dock consume the [selected references and Meshy source records](../../../docs/art-direction/frontier-economy-meshy-v1/README.md) and [Frontier settlement studies](../../../docs/art-direction/civilization-settlements-v1/README.md). Owner: art-direction/economy integration chat `01a107a5-8aa1-7fd0-81b1-997b4d563e89`, through default integration, packaging and identified staging appearance.

Three-cell occupancy, rules and costs remain unchanged. Original GLBs remain byte-identical under ignored `meshy_output/`. The lower 5% base is calibrated to 2.8 world units. Eight orthographic directions share the existing 1024-pixel, 128-pixel/world-unit camera and ground anchor.

Foundation (progress ≤ 27.5%) → oak Frame → Complete. HP ≤ 60% selects Damaged; HP ≤ 30% selects Critical; repair restores its corresponding state. Farm stock zero selects Exhausted/Exhausted Damaged/Exhausted Critical after construction. New planting uses the new authoritative building/stock; unknown stock never implies exhaustion. Mill sails are static. Damage geometry is an initial cut-based treatment.

The [Blender recipe](source/capture_economy.py) verifies original hashes, grounds/scales mesh vertices, saves one editable master per family and renders explicit state geometry. Receipts pin Blender, recipe/source/master hashes, measured scale, camera and frames. Working/pilot captures remain ignored under `captures/`; exactly 144 selected `runtime/` PNGs and three manifests are admitted by HTTP and Docker. The earlier pilot recipe preserves lineage. Farm capture recovered from actual disk pressure using [the recovery recipe](source/resume_farm_capture.py); existing pixels were decoded/retained and only missing views were rendered from the same calibrated master.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/buildings/frontier-economy-models-v1/source/capture_economy.py -- --asset mill --iteration runtime-v1 --views 0,1,2,3,4,5,6,7 --states foundation,frame,complete,damaged,critical --yaw 90
# Farm additionally uses exhausted,exhausted-damaged,exhausted-critical; Dock uses yaw 0.
node scripts/build-frontier-economy-manifests.mjs
node --test scripts/frontier-economy-art.test.mjs scripts/frontier-building-default.test.mjs
```

Choose a new iteration for recapture; prior work is never overwritten. Admission pins `runtime-v1` plus the [observed state corrections](source/refine_state_captures.py) in `state-fix-v1`: connected lower Mill masonry and a Farm soil cap; earlier images remain comparisons. Blender needed ordinary OS access after the restricted launch failed; Chrome's normal sandbox remains enabled.

Default bindings retain live team-colored/shaped standards, health, production, selection and procedural failure fallback. No art preview flag is needed. [Release checks](../../../scripts/railway-release-scenario.mjs) verify all 147 files, GET/HEAD MIME/bytes and denial of sources/comparisons/invalid states/views. The [ordinary game proof](../../../scripts/frontier-economy-game-capture.mjs) pays for all three buildings for both teams, captures construction/Complete, selects the Farm body and actually exhausts its finite stock. [QA](../../../docs/qa-frontier-economy-art-2026-10-04.md) separates source revision, clean release digest, deployed identity and appearance evidence.

Actual disk pressure required retiring this task’s reproducible calibrated master caches after capture/loading. Their hashes remain historical receipts. The original editable GLBs, measured transforms, complete authoring recipes and all comparisons are retained; future master scenes can be reconstructed from those inputs.
