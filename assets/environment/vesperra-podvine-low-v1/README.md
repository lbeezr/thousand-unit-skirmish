# Vesperra pod-vine full/worked/low directional pack

Built-in ImageGen, 1 October 2026. [Low source](source.png) edits the
[worked plant](../vesperra-podvine-worked-v1/source.png) into sparse foliage,
exposing the pale woody tangle while retaining violet pods. This is woodland
disturbance; pod gathering is not introduced. [Exact prompt](PROMPTS.json) and
[registration](registration.json) preserve unchanged source bytes and hashes.
The requested 2170×725 canvas became 2169×725. Corresponding views therefore
use explicit extraction regions rather than copied cell rectangles.

The [manifest](manifest.json) records twelve frames: full/worked/low rows, each
with front/right/rear/left. Full and worked are rebuilt directly from their
selected source PNGs through the shared exporter, avoiding a second compression
of an existing WebP. Every view uses an 884×448 canvas resized to 512×259,
with 64-pixel atlas gutters and no independent enlargement of smaller forms.
Contact proxies use silhouette centers/lower bounds; anatomical roots and exact
physical rotation continuity remain uncertified.

The instance loader now uses the three-row atlas. Forest companion stock five
through three selects worked, two or one selects low, six restores full, and
zero hides the plant. Stable direction and root matrices are retained.
Independent margin plants stay full, and `?plantViews=legacy` selects the
original single view. Runtime keeps the registered 1.10431×0.55 card and its
roughly 1.5% compression relative to the aspect-matched review. No new resource,
yield, collider or map rule is added. Cleared companions have no visible depleted
drawing; independent pod harvesting remains absent.

```sh
python3 scripts/build-podvine-low-pack.py
python3 scripts/build-podvine-low-pack.py --write
```

The default verifies source hashes, frame extraction, runtime configuration and
exact decoded atlas alpha. `--write` exports the atlas and generated
[configuration](../../../src/podvine-low-pack.mjs). The earlier
[full/worked review exporter](../../../scripts/build-podvine-worked-review.py)
remains reproducible and its outputs remain unchanged. See
[runtime evidence](../../../docs/qa-evidence/vaelora-podvine-low-runtime-2026-10-01/README.md)
for all three rendered rows, stock transitions and release admission.
