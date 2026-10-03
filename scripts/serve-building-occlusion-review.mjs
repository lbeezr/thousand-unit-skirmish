#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildingSpriteUrl } from '../src/building-sprites.mjs';
import { crowdedBuildingSpecs } from './building-occlusion-fixture.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modules = ['building-sprites', 'unit-sprite-runtime', 'terrain-height', 'map-utils', 'elevation', 'shore-fishing', 'camera-controls'];
const scripts = ['building-occlusion-review.html', 'building-occlusion-review.mjs', 'building-occlusion-fixture.mjs', 'building-occlusion-metrics.mjs'];
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };

export async function createBuildingOcclusionReviewServer() {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const files = new Map([
    ...modules.map(name => [`/src/${name}.mjs`, `src/${name}.mjs`]),
    ...scripts.map(name => [`/scripts/${name}`, `scripts/${name}`]),
    ['/vendor/three.module.js', 'node_modules/three/build/three.module.js'],
    ['/vendor/three.core.js', 'node_modules/three/build/three.core.js'],
  ]);
  for (const spec of crowdedBuildingSpecs(128)) {
    const file = buildingSpriteUrl(spec).replace(/^\.\//, ''); files.set(`/${file}`, file);
  }
  for (const role of ['cast-human-sprite-v3', 'boughward-worker-sprite-v1']) {
    const prefix = `assets/units/${role}`, manifest = `${prefix}/sprite-atlas-pack-v1.json`;
    files.set(`/${manifest}`, manifest);
    const pack = JSON.parse(await readFile(path.join(root, manifest), 'utf8'));
    const asset = pack.assets.find(entry => entry.kind === 'unit');
    const page = pack.pages.find(entry => entry.id === asset.frames[0].fallbackRectPx?.pageId) || pack.pages[0];
    for (const id of [page.runtimeFileId, page.maskFileId]) {
      const file = `${prefix}/${pack.files.find(entry => entry.id === id).path}`;
      files.set(`/${file}`, file);
    }
  }
  // Hash the exact immutable bytes served, including the installed renderer.
  // Editing a worktree later cannot mix two versions within a paired run.
  const snapshots = new Map(await Promise.all([...files].map(async ([url, file]) =>
    [url, { file, bytes: await readFile(path.join(root, file)) }])));
  const hashes = [...snapshots].map(([url, { file, bytes }]) => ({ url, file, sha256: createHash('sha256').update(bytes).digest('hex') }));
  const authoritativeBuildingLimit = Number((await readFile(path.join(root, 'server.mjs'), 'utf8')).match(/const MAX_BUILDINGS = (\d+);/)[1]);
  const dependency = JSON.parse(await readFile(path.join(root, 'node_modules/three/package.json'), 'utf8'));
  const config = { sourceRevision,
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== ''
      || sourceRevision !== execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    threeVersion: dependency.version, threeRevision: dependency.version.split('.')[1], sourceHashes: hashes, authoritativeBuildingLimit };
  return createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/qa-config.json') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(config)); return;
      }
      const snapshot = snapshots.get(url.pathname === '/' ? '/scripts/building-occlusion-review.html' : url.pathname);
      if (!snapshot) { res.writeHead(404); res.end(); return; }
      const { file, bytes } = snapshot;
      res.writeHead(200, { 'content-type': mime[path.extname(file)], 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(500); res.end('QA fixture file unavailable'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8768);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port from 1024 to 65535');
  const server = await createBuildingOcclusionReviewServer();
  server.listen(port, '127.0.0.1', () => console.log(`Building occlusion QA: http://127.0.0.1:${port}/`));
}
