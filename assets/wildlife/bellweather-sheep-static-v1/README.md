# Bellweather Sheep: eight static views

The normal neutral wildlife renderer uses this pack for alive Sheep, including
the six existing Sheep on default Bellweather · Millrace. There is one idle
frame per nose heading, not a walking or grazing animation. Harvest switches
to the existing food-cache marker; depleted and fog-hidden Sheep disappear.

The user explicitly approved public admission of these eight PNG views and
their required runtime manifest. [Admission](source-admission.json) records
the transferred archive digest and inspection; [source records](source-records.json)
pin every unchanged producer PNG. The lightweight archive was materialized
through Library's supported native file download and verified as readable
local bytes. Neither the full source bundle nor the original 1.42-million-triangle
GLB is included or required. No regeneration, rigging or paid provider calls
were made.

All eight 512×512 RGBA source silhouettes were visually inspected: complete
ears, nose, wool and feet; transparent background; no visible floor or baked
contact shadow. Their nose is about 42.035° offset from the body; that offset
is already rendered and is never applied a second time. Heading 0 faces world
+Z, positive yaw turns toward +X, with nearest 45° selection in the existing
normal renderer. An omitted authored pose uses view 000.

The [consumed capture contract](source/capture-contract.json) preserves the
already-public camera, normalization and original view metadata. Every full
512×512 canvas retains root `[256,256]` and 256 projected pixels per world unit.
Changing alpha bounds never changes pivot or scale. The eight cells form a
2048×1024 atlas in nose-yaw order, four columns and two rows. The source atlas
matches original RGBA pixels exactly. Runtime RGB bleed changes only fully
transparent pixels; alpha and visible RGB remain unchanged. Each direction
owns immutable UV geometry; instances share one verified texture and material.

Only `static-preview-binding.json`, `sprite-atlas-pack-v1.json` and the
392,811-byte `sheep-atlas-runtime.png` are served and packaged. Originals,
source atlas, receipts and source metadata are inspectable repository artifacts,
outside the game HTTP allowlist. The legacy binding field `previewOnly: true`
restricts supported actions to static idle; it is not a game feature flag.

[Default game evidence](../../../docs/qa-sheep-eight-view-default-2026-10-03.md)
records source/pixel acceptance, real worker snapshots, both-seat default
Millrace integration, fallback and packaging checks. Ground-contact/scale and
foreground-occlusion acceptance still require fresh native game screenshots;
the Linux browser sandbox could not start. The original estimated pivot status
remains until that appearance review is complete.
