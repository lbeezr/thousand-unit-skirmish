# Frontier cursor source renders

**Status:** local source for the integrated 40 px cursor pack.
[UI pack](../../assets/ui/README.md) · [Contract](../../docs/ui-cursor-icon-contract.md)

## Source and provenance

The pointer and hammer are transparent 512 px renders of optimized Meshy models.
Iron, brass, and oak provide the common material language; small 2D badges supply
command states.

| Source | Image-to-3D task | Remesh task | Triangles |
| --- | --- | --- | ---: |
| `pointer.png` | `01a0e012-8769-71dc-857c-42623af66b50` | `01a0e017-b7af-7143-b163-4a7ce0a0f16f` | 1,971 |
| `hammer.png` | `01a0e013-0a1d-7036-8bcc-9c9889aaad9d` | `01a0e017-c775-7238-9347-913ec760c59a` | 2,013 |

Generation plus remeshing consumed 70 credits in the recorded pilot. Rebuilding
the existing pack does not contact Meshy.

## Build and mapping

```sh
python3 scripts/build-cursor-pack.py
```

Run from the repository root with Pillow. Sixteen PNGs total under 64 KB;
source models/renders are not served to players. Sizes and hotspots live in the
runtime manifest, and `src/battlefield-cursor.mjs` resolves context precedence.
Browser cursors do not pass through the game render loop.

Selection has plus/minus and window/crossing marks. Enemy targeting precedes
resource targeting; Shift queues only movement. Construction uses a reticle;
panning remains native. Additional glove/sword/axe/basket/banner models are
future work, not required to build these exports.
