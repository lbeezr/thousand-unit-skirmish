# In-game forest preview

From the repository root, after `npm ci`:

```sh
PORT=4182 RTS_MAP=maps/meshy-resource-review.json node server.mjs
```

Open http://127.0.0.1:4182/?meshyResources=1 and start a match. Meshy oak, pine, and full berries are enabled by default. Use `?meshyResources=0` to compare the older art.

The 48×48 map has 394 blocked forest cells, varied oak/pine sizes, forest-floor texture, open paths, and a base clearing. Full resource states use Meshy sprites; worked/low/depleted states retain the existing art. This change in style and silhouette during harvesting is an unfinished review limitation.

Each new frame retains its 5-world-unit canvas and (320,480) ground pivot. The below-pivot portion projects onto the ground plane to prevent terrain clipping. The fixed game camera uses view 01; the other seven views are saved for reuse.

`forest-map.json` is a retained copy of `maps/meshy-resource-review.json`. The earlier local preview at port 4181 additionally composed the character task's Worker v3 and two decorative pines. Those character assets remain owned by that separate task; this PR uses the units already present on main.

Next art exploration: test unit silhouette, light/dark separation, quieter terrain, and contact shadows at gameplay zoom. No readability redesign is included in this checkpoint.
