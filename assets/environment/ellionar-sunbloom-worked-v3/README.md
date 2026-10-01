# Ellionar Sunbloom full/worked views v3

Built-in ImageGen, 1 October 2026. [Worked source](source.png) edits the
[planted crowns](../ellionar-sunbloom-crowns-v2/source.png) into trimmed outer
foliage and a few clipped copper twig tips. Lapis flowers remain attached,
basal leaves/crowns stay recognizable, and roots remain concealed. This is
woodland disturbance, not flower gathering. [Exact prompt](PROMPTS.json) and
[registration](registration.json) preserve source/reference hashes. The generated
canvas changed from 2170×725 to 2169×725; exact source-coordinate preservation
and anatomical crown alignment are not certified.

The [manifest](manifest.json) records eight frames. Each full/worked pair uses
the reference's horizontal silhouette center and a common lower source bound.
This avoids independently recentering the worked bush when leaves are removed.
Both states use one 700×671 canvas and resize to 512×491, with no per-view scale.
Full is rebuilt directly from its PNG rather than recompressing an old atlas.
The 2560×1238 atlas has 64-pixel gutters. Source-coordinate pairing is provisional
registration, not proof that every anatomical branch/crown is identical.

The default instance loader now uses this pack. Full woodland stock six uses
full; positive partial stock five through one uses worked; zero hides; reset
restores full. Stable heading and exact root matrices are retained. Independent
channel garden beds remain full because they have no forest stock binding.
Registered 0.88654×0.85 cards, fixed camera, no mirroring/card yaw and legacy
single-view selection remain. No resource, yield, collider or planting rule is
introduced. A distinct low/depleted flower drawing and flower gathering remain
absent.

```sh
python3 scripts/build-sunbloom-worked.py
python3 scripts/build-sunbloom-worked.py --write
```

The default checks hashes, paired extraction, exact decoded alpha and generated
config. `--write` exports the atlas and
[runtime config](../../../src/sunbloom-worked-pack.mjs). The
[runtime evidence](../../../docs/qa-evidence/vaelora-sunbloom-worked-2026-10-01/README.md)
compares full/worked at identical pivots and checks stock, independent beds and
release admission. Prior sources/exporters remain preserved.
