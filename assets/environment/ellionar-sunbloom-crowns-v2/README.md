# Ellionar Sunbloom planted crowns v2

Built-in ImageGen, 1 October 2026. [Source](source.png) edits the
[preceding directional sheet](../ellionar-sunbloom-views-v1/source.png) to remove
its exposed root fans. Compact copper stem crowns and basal green leaves make
the flowers read as growing garden plants. Lapis flowers, pointed foliage and
front/right/rear/left identities remain recognizable. [Exact prompt](PROMPTS.json)
records the edit and [manifest](manifest.json) preserves unchanged source bytes,
reference hashes and export registration. The requested unchanged canvas became
2170×725 rather than 2172×724; this is an authored revision, not a pixel-identical
edit of upper foliage or a measured 3D reconstruction.

All four drawings use the same 700×671 source canvas and 512×491 export scale
as v1. The smaller base is not enlarged to fill the old root footprint. The
painted silhouette is consequently shorter, while the registered 0.88654×0.85
card and bottom-center pivot remain unchanged. Contact proxies still use alpha≥8
lower bounds and horizontal silhouette centers, now dominated by basal leaves;
they do not certify the anatomical stem crown at ground level.

The default instance loader uses this four-frame atlas for Ellionar woodland
companions and channel garden beds. Stable heading, no mirroring/card yaw,
positive-stock full appearance, zero-stock hiding and reset behavior remain.
`?plantViews=legacy` selects the original single-view source. The preceding
four-view pack stays preserved as provenance. No placement, yield, collision,
cultivation or independent gathering rule is added. Worked/low flower drawings
and anatomical root registration remain unfinished.

```sh
python3 scripts/build-sunbloom-crowns.py
python3 scripts/build-sunbloom-crowns.py --write
```

The default verifies hashes, extraction, decoded alpha and generated config.
`--write` exports the 2560×619 padded atlas and preview. See
[paired runtime evidence](../../../docs/qa-evidence/vaelora-sunbloom-planted-crowns-2026-10-01/README.md)
for the preceding root-fan capture, new crown view, stock/reset and release
admission checks.
## Subsequent woodland-state pack · 1 October 2026

The [v3 full/worked pack](../ellionar-sunbloom-worked-v3/README.md) now supplies
the default instance atlas, rebuilding this full source alongside trimmed
foliage. This planted-crown checkpoint remains unchanged and reproducible.
