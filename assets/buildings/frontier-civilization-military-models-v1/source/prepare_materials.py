"""Deterministic original material textures; no reference-image pixels are copied."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PALETTE = {
    'oak': (127, 88, 49), 'oak_dark': (105, 68, 37),
    'stone': (190, 183, 155), 'plaster': (225, 216, 187),
    'sage': (102, 122, 109), 'ochre': (187, 137, 60),
    'iron': (48, 53, 50), 'copper': (151, 95, 57),
    'glass': (51, 74, 77), 'linen': (213, 189, 136),
    'target': (202, 181, 132), 'target_blue': (79, 111, 132),
    'target_red': (158, 78, 61), 'lantern': (248, 188, 93),
}
for index, factor in enumerate([.90, .94, .98, 1.02, 1.06]):
    PALETTE['sage_'+str(index)] = tuple(round(v*factor) for v in PALETTE['sage'])

def main():
    (ROOT / 'textures').mkdir(parents=True, exist_ok=True)
    size = 256
    y, x = np.mgrid[0:size, 0:size] / size
    for i, (name, color) in enumerate(PALETTE.items()):
        rng = np.random.default_rng(64031 + i)
        fine = rng.normal(0, 1.4, (size, size))
        coarse_image = Image.fromarray(rng.integers(0, 255, (16, 16), dtype=np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
        coarse = (np.asarray(coarse_image, dtype=float) - 127) / 12
        if name.startswith('oak'):
            grain = np.sin(x * 174 + 2.1 * np.sin(y * 12) + 0.8 * np.sin(y * 37))
            grain += 0.6 * np.sin(x * 510 + np.sin(y * 26))
            field = grain * 7 + coarse * .6 + fine
        elif name in ['stone', 'plaster']:
            field = coarse * .6 + fine * 1.5
        elif name.startswith('sage'):
            field = coarse * .8 + fine + np.sin(x * 100 + y * 15) * 1.6
        elif name in ['linen', 'ochre', 'target']:
            field = coarse * .35 + np.sin(x * size * 2) * 2 + np.sin(y * size * 2) * 2 + fine
        else:
            field = coarse * .25 + fine * .5
        pixels = np.clip(np.array(color)[None, None, :] + field[:, :, None], 0, 255).astype(np.uint8)
        Image.fromarray(pixels, 'RGB').save(ROOT / 'textures' / (name + '.png'))

if __name__ == '__main__':
    main()
