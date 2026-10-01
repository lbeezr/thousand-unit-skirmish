# Ellionar Sunbloom authored views

Built-in ImageGen, 1 October 2026. [Source sheet](source.png) interprets the
[existing Sunbloom](../frontier-v1/ellionar-sunbloom.png) as front/right/rear/left
views of one cultivated flowering bush. Lapis-blue five-petalled flowers,
cream/gold centers, honey-copper stems and pointed green leaves retain Ellionar's
garden palette. The rear shows flower backs; narrower side profiles change
branch/flower occlusion. These are approximate authored rotations, not measured
90° captures or certified branch continuity. [Exact prompt](PROMPTS.json) records
the unchanged generated PNG and its reference.

The new source removes the reference's diffuse colored halo rather than baking
it into every orientation. Short exposed roots remain part of the source plant.
The 2172×724 sheet uses explicit unequal extraction regions. All drawings are
translated into common 700×671 canvases and resized together to 512×491.
Side profiles are not individually enlarged. [Manifest](manifest.json) records
source/reference hashes, crops, contact proxies, atlas rectangles and registered
0.88654×0.85 world cards. The painted footprint differs slightly from the old
single view; this is not an exact size reconstruction. Silhouette centers and
alpha≥8 lower bounds provisionally align visible root extremities, not certified
anatomical crown/root landmarks.

The instance loader selects a stable cell-based heading for woodland companions
and independent channel garden beds. Mirroring and card yaw are disabled, with
the game's fixed camera unchanged. Positive wood stock retains full, zero hides
the companion, and reset restores its selected view. Decorative garden flowers
have no stock binding or new gathering rule. `?plantViews=legacy` restores the
original single views of all three directional species. Collision, placement,
yield and cultivation rules remain unchanged. Worked/low Sunbloom drawings and
dynamic free-camera remapping remain absent.

```sh
python3 scripts/build-sunbloom-views.py
python3 scripts/build-sunbloom-views.py --write
```

The default checks hashes, source extraction, exact decoded alpha and generated
config. `--write` exports a 2560×619 atlas with 64-pixel gutters, neutral preview
and [configuration](../../../src/sunbloom-view-pack.mjs). The
[runtime evidence](../../../docs/qa-evidence/vaelora-sunbloom-authored-views-2026-10-01/README.md)
covers four headings, stock/reset, garden composition and release admission.
## Subsequent planted-crown refinement · 1 October 2026

The default loader now uses [v2 planted crowns](../ellionar-sunbloom-crowns-v2/README.md)
to remove this sheet's exposed root fans. This directional checkpoint remains
unchanged as source provenance and comparison evidence.
