# Worker fishing SE v1

The user approved the four-pose fishing design and subsequently authorized public
publication of the fishing game images and their default integration. This folder
contains 2D game art; full 3D source models and private QA captures are excluded.

![Crouch, reach, retrieve and collect beside the approved shipped idle](worker-fishing-SE-study.png)

[Timed four-key loop](worker-fishing-SE-loop.webp) ·
[Runtime and acceptance record](../../../worker-fishing-animation.md)

Only world **south-east** is authored here. It projects screen right through the
fixed game camera. Four keys run for 350, 300, 350 and 300 ms (1,300 ms total),
with a low hand-net/scoop rather than a thrown cast net. Other headings use the
ordinary exact-facing fallback. There are no mirrors or copied directional labels.
This is a blocking loop; smooth motion, final root/anatomy and loop-seam acceptance
remain tracked separately from design and publication approval.

`executed-imagegen-request-v1.json` is the actual whole-strip ImageGen request;
`prompt-v1.txt` is the earlier unexecuted draft. The raw original output is
`fishing-SE-source-v1.png`. The shipped `idle-south-east-0` reference and edit
canvas remain alongside it. `extracted/` retains the isolated source silhouettes
and explicit source bounds; its extraction receipt changes only the local source
path to a portable relative path. No paid Meshy or rigging job was used.

`fishing-SE-00.png` through `fishing-SE-03.png` are the original approved
512 × 512 registered keys. All use scale 0.38 and ground pivot (256, 480).
The historical normalizer rounded crop resizes before placement; its numeric
residuals are preserved in `registration-audit.json`. Those accepted pilot bytes
were not silently resampled during publication. Future headings should use the
fixed affine calibration helper retained in the private production kit, with
anatomical scale and planted-root landmarks independent of prop alpha bounds.
The standing seed is deliberately not locked into the first crouched work pose.

Human v3 pack 0.14.0 appends these four keys to the prior 0.13.0 atlas. The
decoded original 2048 × 2048 region, 80 prior frame records, all prior clips and
their masks are preserved. The page becomes 2048 × 4096, within the 4096 budget,
and world units per pixel stays `0.0052421832906788795`. No other Worker action
is replaced. New keys retain the existing zero ownership-mask policy.

`runtime-preservation.json` pins the baseline decoded-pixel and metadata hashes.
`source-hashes.json` records the published source bytes. The shipped renderer
test decodes the page, checks the baseline region, and compares every new tile
against its registered key. It also exercises ordinary default binding,
natural clip timing, both seat indices and exact-heading fallbacks. CPU tests
and atlas validation do not substitute for a GPU appearance review.

To reproduce the historical atlas pixels, provide the unchanged Human v3 0.13.0
pack from commit `20c4fce`, this folder's config, and a new output directory:

```sh
python3 scripts/build-worker-fishing-pilot.py \
  BASE_HUMAN_V3_0_13 \
  docs/art-direction/human-roster-v1/fishing-SE-v1/pilot-frame-config.json \
  NEW_OUTPUT_DIRECTORY
```

That historical builder uses the original private-pilot provenance wording.
The published manifest updates only that description to record later authority
and remaining coverage; color and mask PNG bytes are identical.
