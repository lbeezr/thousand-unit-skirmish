// Decoded source pixels, never browser/rendered acceptance. Reuse the existing
// repository PNG decoder so the CPU CI lane needs no Python or browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
export function decodeAnimationCells(root, packs, directories) {
  return Object.fromEntries(Object.entries(packs).map(([role, pack]) => {
    const page = pack.pages[0], asset = pack.assets[0];
    const file = pack.files.find(f => f.id === page.runtimeFileId);
    const raw = readFileSync(path.join(root, 'assets/units', directories[role], file.path));
    assert.equal(hash(raw), file.sha256, `${role} runtime PNG must match its manifest`);
    const atlas = decodeRgba8(raw);
    assert.deepEqual([atlas.width, atlas.height], [page.dimensionsPx.width, page.dimensionsPx.height]);
    const wanted = new Set(asset.clips.filter(c => ['walk', 'idle'].includes(c.stateId)).flatMap(c => c.sequence.map(s => s.frameId)));
    const cells = Object.fromEntries(asset.frames.filter(f => wanted.has(f.id)).map(frame => {
      const crop = frame.frameRectsPx.find(c => c.pageId === page.id && c.layerId === 'actor');
      const r = crop.rectPx, offset = crop.offsetPx ?? { x: 0, y: 0 }, pivot = frame.groundPivotPx;
      const x = 512 + offset.x - pivot.x, y = 768 + offset.y - pivot.y;
      assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + r.width <= 1024 && y + r.height <= 1024);
      const rgba = Buffer.alloc(1024 * 1024 * 4), alpha = Buffer.alloc(1024 * 1024);
      for (let row = 0; row < r.height; row++) for (let col = 0; col < r.width; col++) {
        const src = ((r.y + row) * atlas.width + r.x + col) * 4;
        const dst = (y + row) * 1024 + x + col;
        const a = atlas.pixels[src + 3];
        if (!a) continue; // Invisible RGB and atlas location cannot fake motion.
        for (let channel = 0; channel < 4; channel++) rgba[dst * 4 + channel] = atlas.pixels[src + channel];
        alpha[dst] = a;
      }
      return [frame.id, { rgbaSha256: hash(rgba), alphaSha256: hash(alpha) }];
    }));
    return [role, { packVersion: pack.packVersion, atlasSha256: file.sha256, cells }];
  }));
}
