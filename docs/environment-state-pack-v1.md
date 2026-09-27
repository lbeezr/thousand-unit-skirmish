# Interactive environment states

[Documentation index](README.md) · [Renderer contract](renderer-state-contract.md)

The integrated `assets/environment/frontier-interactive-v1/manifest.json` describes
oak/berry depletion and construction-ground images. It uses renderer asset-pack v1.
The manifest owns exact file hashes, dimensions, bounds, pivots, ranges, and batches.

## Resource mapping

Use `floor(clamp(stock / startingStock, 0, 1) * 100)`. Initial stock comes from
the map; current stock comes only from visible snapshot rows. Hidden nodes retain
their last-known image. Visible stock zero remains a meaningful depleted feature.

| Stage | Integer percent | Oak | Berries |
| --- | ---: | --- | --- |
| `full` | 67–100 | Full crown | Full fruit clusters |
| `worked` | 34–66 | Reduced crown | Fewer fruits |
| `low` | 1–33 | Sparse foliage | Very few fruits |
| `depleted` | 0 | Stump and roots | Fruitless woody shrub |

Worker task drives a generic gather pose until cargo type is known; wood/food
then select chopping/picking. Moving/returning suppresses work swings. The pack
supplies resource art, not new simulation rules or regrowth.

## Construction ground

| Stage | Condition |
| --- | --- |
| `clear` | No incomplete building; no image/batch. |
| `earthwork` | Progress below 0.4. |
| `foundation` | Progress from 0.4 until completion. |

Upper bounds are exclusive. Authoritative completion removes the decal even if
a procedural roof appeared earlier.

## Registration and budget

| Family | Pixels | World width × height | Pivot |
| --- | --- | --- | --- |
| Oak | 1226 × 1283 | 4.1 × 3.75 | `[0.5,1.0]` |
| Berries | 1536 × 1024 | 2.55 × 1.56 | `[0.5,1.0]` |
| Construction | 1254 × 1254 | 3 × 3 | `[0.5,1.0]` |

All variants in a family share registration. Ten image-bearing states project
ten batches, 3,798,100 WebP bytes, and 83,884,376 decoded RGBA8 bytes including a
4/3 mip allowance. The planning cap is 96 MiB (100,663,296 bytes), leaving
16,778,920 bytes. This is a pack estimate, not measured GPU residency or an app cap.

```sh
node scripts/validate-visual-pack.mjs assets/environment/frontier-interactive-v1/manifest.json
```

## Evidence and next review

The [four-frame runtime pilot](qa-evidence/environment-state-pack-v1/pilot/README.md)
verified exact texture loads and visible stock-driven transitions on a named
build. The complete forty-frame matrix remains a separate review:

- Ten image-bearing states × Meadow/Cinder × zoom 0.91/0.48.
- Stock 100/50/20/0 for representative full/worked/low/depleted frames.
- Actual visible state rows and exact manifest-listed runtime textures.
- 1280 × 720 CSS viewport at DPR 2; saved PNGs 2560 × 1440 with HUD/minimap.
- A no-overlay assertion for `construction-clear`, without an extra image.
- Visible wood/food interactions where practical and a ground/army contrast check.

Use the adapter's preflight, pilot, and full capture scenarios described in the
[renderer contract](renderer-state-contract.md#appearance-checks). Contact sheets,
mockups, or scaled legacy sprites do not establish this pack's runtime appearance.
Ordinary appearance review needs no numeric host-load clearance; measured
residency and performance remain separate work.

## Source edge findings

Original v1 files retain their source alpha. Source review identified some oak
edge-color contamination but also intentional warm canopy/bark highlights.
Rejected cleanup generations changed too much of the silhouette. An accepted
source-only oak candidate remains outside the manifest/runtime path; adoption
needs black/light edge review and matching file/hash changes. Berry source
comparisons supported leaving v1 alpha unchanged. Neither finding substitutes
for the required game-zoom views.
