import { stopChild } from './temporary-resources.mjs';
import { checkClientImports } from './browser/check-client-imports.mjs';
import { compareServedBuildIdentity } from './release/check-served-build-identity.mjs';
import { BROWSER_ENTRYPOINTS, RUNTIME_DOMAINS, RUNTIME_DOMAIN_HOSTS } from './check-runtime-imports.mjs';
import { CLIENT_ASSET_PATHS, ENVIRONMENT_MODULE_PATH } from '../src/server/client-asset-paths.mjs';
import assert from 'node:assert/strict';
import {validateBuildingLifecycle} from './validate-building-lifecycle.mjs';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let root, volume, child, entry, environment;
const secret = 'test-release-password-please-change';

async function setupRelease() {
  // Exercise Docker COPY output so a source-only asset cannot hide a broken release.
  const packed = spawnSync(process.execPath, ['scripts/release/pack-railway-release.mjs', '--allow-dirty'], {
    cwd: sourceRoot, encoding: 'utf8',
  });
  assert.equal(packed.status, 0, packed.stderr);
  root = JSON.parse(packed.stdout).directory;
  await symlink(path.join(sourceRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  entry = path.join(root, 'room-supervisor.mjs');
  const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /^\s*COPY\b[^\n]*\borigin-policy\.mjs\b/m,
    'the shared origin policy must be included in the Railway image');
  volume = await mkdtemp(path.join(os.tmpdir(), 'rts-railway-release-'));
  environment = {
    ...process.env,
    RAILWAY_ENVIRONMENT: 'production',
    RAILWAY_PUBLIC_DOMAIN: 'game-production.up.railway.app',
    RAILWAY_VOLUME_MOUNT_PATH: volume,
    RTS_ACCESS_USER: 'players',
    RTS_ACCESS_PASSWORD: secret,
    RTS_PUBLIC_ORIGINS: '',
    RTS_HOST: '127.0.0.1',
  };
  delete environment.RTS_ROOM_DATA_DIRECTORY;
  delete environment.RTS_CUSTOM_MAP_DIRECTORY;
  // A developer's provider metadata must not contaminate this packed fixture.
  delete environment.RAILWAY_GIT_COMMIT_SHA;
}

function rejectsMissingConfiguration(override, expected) {
  const result = spawnSync(process.execPath, [entry], {
    cwd: root,
    env: { ...environment, ...override },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, expected);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function upgrade(port, authorization) {
  return new Promise((resolve, reject) => {
    const headers = {
      connection: 'Upgrade', upgrade: 'websocket',
      'sec-websocket-version': '13',
      'sec-websocket-key': randomBytes(16).toString('base64'),
      origin: `https://${environment.RAILWAY_PUBLIC_DOMAIN}`,
    };
    if (authorization) headers.authorization = authorization;
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/ws', headers });
    request.setTimeout(5000, () => request.destroy(new Error('WebSocket upgrade timed out')));
    request.on('upgrade', (_response, socket) => { socket.destroy(); resolve(101); });
    request.on('response', (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject);
    request.end();
  });
}

try {
  await setupRelease();
  rejectsMissingConfiguration({ RAILWAY_VOLUME_MOUNT_PATH: '' }, /Attach a Railway volume/);
  rejectsMissingConfiguration({ RTS_ACCESS_PASSWORD: '' }, /RTS_ACCESS_PASSWORD/);
  rejectsMissingConfiguration({ RAILWAY_PUBLIC_DOMAIN: '' }, /RAILWAY_PUBLIC_DOMAIN or RTS_PUBLIC_ORIGINS/);

  const port = await availablePort();
  child = spawn(process.execPath, [entry], {
    cwd: root, env: { ...environment, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childOutput = '';
  child.stdout.on('data', (chunk) => { childOutput += chunk; });
  child.stderr.on('data', (chunk) => { childOutput += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const authorization = `Basic ${Buffer.from(`players:${secret}`).toString('base64')}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Supervisor exited: ${childOutput}`);
    try {
      const response = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) });
      if (response.status === 200 && (await response.json()).ok === true) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Supervisor did not become ready: ${childOutput}`);

  assert.equal((await fetch(`${base}/`)).status, 401);
  assert.equal((await fetch(`${base}/health`)).status, 401);
  assert.equal((await fetch(`${base}/api/rooms`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/`, { headers: { authorization: 'Basic bad' } })).status, 401);
  assert.equal((await fetch(`${base}/`, { headers: { authorization } })).status, 200);
  const packedManifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'src/server/release-identity.json'), 'utf8')),
    { sourceRevision: packedManifest.sourceRevision, sourceDirty: packedManifest.sourceDirty,
      digest: packedManifest.digest }, 'Docker-copied private sidecar must match the packed manifest');
  const healthResponse = await fetch(`${base}/health`, { headers: { authorization } });
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.deepEqual(health.buildIdentity, { status: 'identified', origin: 'packed-manifest',
    sourceRevision: packedManifest.sourceRevision, sourceDirty: packedManifest.sourceDirty,
    digest: packedManifest.digest });
  assert.deepEqual(await (await fetch(`${base}/ready`)).json(), { ok: true },
    'public readiness must not expose build or match metadata');
  const expectedIdentity = { sourceRevision: packedManifest.sourceRevision, digest: packedManifest.digest };
  const comparison = compareServedBuildIdentity(health, expectedIdentity);
  assert.equal(comparison.ok, !packedManifest.sourceDirty,
    'allow-dirty disposable fixture must never pass clean release acceptance');
  assert.ok(compareServedBuildIdentity(health,
    { ...expectedIdentity, sourceRevision: '0'.repeat(40) }).issues.includes('source-mismatch'),
  'a reachable/authenticated packed game must still reject the wrong expected source');
  // Exercise the actual packed HTTP host, independently of source declaration
  // shape. A manifest entry omitted from server membership must fail here.
  for (const filename of new Set([...CLIENT_ASSET_PATHS, ENVIRONMENT_MODULE_PATH])) {
    const response = await fetch(`${base}/${filename}`, { method: 'HEAD', headers: { authorization } });
    assert.equal(response.status, 200, `client admission path must be served: ${filename}`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
    assert.equal(response.headers.get('cache-control'), 'no-store', filename);
    assert.match(response.headers.get('content-type') || '', filename.endsWith('.html') ? /text\/html/
      : filename.endsWith('.css') ? /text\/css/ : filename.endsWith('.json') ? /application\/json/
        : filename.endsWith('.png') ? /image\/png/ : /(?:java|ecma)script/, filename);
    assert.equal((await response.arrayBuffer()).byteLength, 0, `HEAD must omit the body: ${filename}`);
  }
  for (const filename of ['server.mjs', 'scripts/check-runtime-imports.mjs', 'src/server/client-asset-paths.mjs',
    'src/server/build-identity.mjs', 'src/server/release-identity.json', 'release-manifest.json',
    'src/room-launch-options.mjs', 'src/main.js.map', 'src/main.js/extra', 'SRC/main.js', 'src//main.js']) {
    assert.equal((await fetch(`${base}/${filename}`, { headers: { authorization } })).status, 404,
      `exact client admission must deny: ${filename}`);
  }
  for (const filename of ['src/gameplay-action-rules.mjs', 'src/rules/gameplay-action-rules.mjs']) {
    const response = await fetch(`${base}/${filename}`, { headers: { authorization } });
    assert.equal(response.status, 200, filename);
    assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
    assert.equal(response.headers.get('cache-control'), 'no-store', filename);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, filename))).digest('hex'), filename);
  }
  for (const filename of ['src/environment-art.mjs', 'src/presentation/assets/interactive-runtime-image.mjs',
    'src/presentation/rendering/ground-surfaces.mjs']) {
    const response = await fetch(`${base}/${filename}`, { headers: { authorization } });
    assert.equal(response.status, 200, filename);
    assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
    assert.equal(response.headers.get('cache-control'), 'no-store', filename);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, await readFile(path.join(root, filename)), filename);
    assert.deepEqual(bytes, await readFile(path.join(sourceRoot, filename)), filename);
  }
  for (const filename of ['src/presentation/assets/', 'src/presentation/assets/unknown.mjs',
    'src/presentation/assets/interactive-runtime-image.mjs/extra', 'src/presentation//assets/interactive-runtime-image.mjs',
    'src/presentation/rendering/', 'src/presentation/rendering/unknown.mjs',
    'src/presentation/rendering/ground-surfaces.mjs/extra', 'src/presentation//rendering/ground-surfaces.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `image-loading admission remains exact (${method}): ${filename}`);
    }
  }
  // The extracted world contract and old map API retain exact packed HTTP bytes.
  for (const filename of ['src/map-utils.mjs', 'src/world/scenario-event-chain.mjs',
    'src/world/capture-prerequisites.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/${filename}`, { method, headers: { authorization } });
      assert.equal(response.status, 200, `${method}: ${filename}`);
      assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
      assert.equal(response.headers.get('cache-control'), 'no-store', filename);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (method === 'HEAD') assert.equal(bytes.length, 0, filename);
      else {
        assert.deepEqual(bytes, await readFile(path.join(root, filename)), filename);
        assert.deepEqual(bytes, await readFile(path.join(sourceRoot, filename)), filename);
      }
    }
  }
  for (const filename of ['src/world/', 'src/world/unknown.mjs',
    'src/world/scenario-event-chain.mjs/extra', 'src//world/scenario-event-chain.mjs',
    'src/world/capture-prerequisites.mjs/extra', 'src//world/capture-prerequisites.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `world admission remains exact (${method}): ${filename}`);
    }
  }
  // Preserve exact shipped audio bytes at both the canonical and legacy paths.
  for (const helper of ['audio-decoded-cache', 'audio-shipped-response']) {
    for (const filename of [`src/${helper}.mjs`, `src/client/audio/${helper}.mjs`]) {
      const response = await fetch(`${base}/${filename}`, { headers: { authorization } });
      assert.equal(response.status, 200, filename);
      assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
      assert.equal(response.headers.get('cache-control'), 'no-store', filename);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(bytes, await readFile(path.join(root, filename)), filename);
      assert.deepEqual(bytes, await readFile(path.join(sourceRoot, filename)), filename);
    }
  }
  for (const filename of ['src/client/audio/', 'src/client/audio/unknown.mjs',
    'src/client/audio/audio-decoded-cache.mjs/extra', 'src/client//audio/audio-shipped-response.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `audio admission remains exact (${method}): ${filename}`);
    }
  }
  // Composition has one canonical implementation and a supported old API path.
  for (const filename of ['src/audio-composition.mjs', 'src/presentation/audio/composition.mjs',
    'src/audio-composition-player.mjs', 'src/presentation/audio/composition-player.mjs',
    'src/audio-composer.mjs', 'src/presentation/audio/composition-wav.mjs',
    'src/client/audio/composer.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/${filename}`, { method, headers: { authorization } });
      assert.equal(response.status, 200, `${method}: ${filename}`);
      assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
      assert.equal(response.headers.get('cache-control'), 'no-store', filename);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
      if (method === 'GET') {
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.deepEqual(bytes, await readFile(path.join(root, filename)), filename);
        assert.deepEqual(bytes, await readFile(path.join(sourceRoot, filename)), filename);
      }
    }
  }
  for (const filename of ['src/presentation/audio/', 'src/presentation/audio/unknown.mjs',
    'src/presentation/audio/composition.mjs/extra', 'src/presentation//audio/composition.mjs',
    'src/presentation/audio/composition-player.mjs/extra', 'src/presentation//audio/composition-player.mjs',
    'src/presentation/audio/composition-wav.mjs/extra', 'src/presentation//audio/composition-wav.mjs',
    'src/client/audio/', 'src/client/audio/unknown.mjs', 'src/client/audio/composer.mjs/extra',
    'src/client//audio/composer.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `composition admission remains exact (${method}): ${filename}`);
    }
  }
  // Both old browser imports and canonical authoring paths must survive packing
  // with the source bytes and the same exact-path GET/HEAD policy.
  for (const filename of ['src/scenario-authoring.mjs', 'src/map-resize.mjs',
    'src/authoring/scenario-authoring.mjs', 'src/authoring/map-resize.mjs',
    'src/authoring/map-studio-form-state.mjs', 'src/authoring/map-studio-draft-store.mjs',
    'src/authoring/map-studio-terrain-packing.mjs',
    'src/authoring/map-studio/draft/v1/contract.mjs']) {
    const response = await fetch(`${base}/${filename}`, { headers: { authorization } });
    assert.equal(response.status, 200, filename);
    assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
    assert.equal(response.headers.get('cache-control'), 'no-store', filename);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, filename))).digest('hex'), filename);
  }
  for (const filename of ['src/authoring/map-studio-form-state.mjs/extra',
    'src/authoring/map-studio-terrain-packing.mjs/extra',
    'src/authoring/map-studio-draft-store.mjs/extra',
    'src/authoring/map-studio/draft/v1/contract.mjs/extra',
    'src/authoring/map-studio/draft/v1/unknown.mjs',
    'src/authoring/map-studio/draft/v2/contract.mjs',
    'src/authoring/map-studio/draft/v1/',
    'src/authoring/unknown.mjs', 'src/authoring/', 'src/authoring//map-studio-form-state.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `form controller admission remains exact (${method}): ${filename}`);
    }
  }
  const welcomeSessionPath = 'src/client/networking/welcome-session.mjs';
  const welcomeSession = await fetch(`${base}/${welcomeSessionPath}`, { headers: { authorization } });
  assert.equal(welcomeSession.status, 200);
  assert.deepEqual(Buffer.from(await welcomeSession.arrayBuffer()), await readFile(path.join(root, welcomeSessionPath)));
  for (const filename of ['src/client/networking/', 'src/client/networking/unknown.mjs',
    `${welcomeSessionPath}/extra`, 'src/client//networking/welcome-session.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `welcome session admission remains exact (${method}): ${filename}`);
    }
  }
  // Both compatibility and canonical HUD entries must retain exact packed bytes.
  for (const helper of ['resource-format', 'population-readout', 'objective-summary']) {
    for (const filename of [`src/${helper}.mjs`, `src/client/hud/${helper}.mjs`]) {
      const response = await fetch(`${base}/${filename}`, { headers: { authorization } });
      assert.equal(response.status, 200, filename);
      assert.match(response.headers.get('content-type') || '', /(?:java|ecma)script/, filename);
      assert.equal(response.headers.get('cache-control'), 'no-store', filename);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', filename);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(root, filename)), filename);
    }
  }
  for (const filename of ['src/client/hud/', 'src/client/hud/unknown.mjs',
    'src/client/hud/resource-format.mjs/extra', 'src/client//hud/resource-format.mjs']) {
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await fetch(`${base}/${filename}`, { method, headers: { authorization } })).status,
        404, `HUD admission remains exact (${method}): ${filename}`);
    }
  }
  for (const filename of ['%73rc/main.js', 'src%2Fmain.js']) {
    assert.equal((await fetch(`${base}/${filename}`, { headers: { authorization } })).status, 200,
      `existing decoded-path admission: ${filename}`);
  }
  assert.equal((await fetch(`${base}/%E0%A4%A`, { headers: { authorization } })).status, 400);
  assert.equal((await fetch(`${base}/%2e%2e%2fserver.mjs`, { headers: { authorization } })).status, 403);
  assert.equal((await fetch(`${base}/src/main.js`, { method: 'POST', headers: { authorization } })).status, 405);
  assert.equal((await fetch(`${base}/src/server/client-asset-paths.mjs`)).status, 401);
  const three = await fetch(`${base}/vendor/three.module.js`, { headers: { authorization } });
  assert.equal(three.status, 200);
  assert.match(three.headers.get('content-type'), /javascript/);
  assert.match(await three.text(), /class WebGLRenderer/);
  const threeCore = await fetch(`${base}/vendor/three.core.js`, { headers: { authorization } });
  assert.equal(threeCore.status, 200);
  assert.match(threeCore.headers.get('content-type'), /javascript/);
  const sheepDirectory = `${base}/assets/wildlife/bellweather-sheep-static-v1/`;
  const sheepBindingResponse = await fetch(`${sheepDirectory}static-preview-binding.json`, { headers: { authorization } });
  assert.equal(sheepBindingResponse.status, 200, 'packed runtime preserves the admitted eight-view Sheep binding');
  const sheepBinding = await sheepBindingResponse.json();
  const sheepManifestResponse = await fetch(new URL(sheepBinding.manifest, sheepDirectory), { headers: { authorization } });
  assert.equal(sheepManifestResponse.status, 200);
  const sheepManifestBytes = Buffer.from(await sheepManifestResponse.arrayBuffer());
  assert.equal(createHash('sha256').update(sheepManifestBytes).digest('hex'), sheepBinding.manifestSha256);
  const sheepManifest = JSON.parse(sheepManifestBytes);
  assert.equal(sheepBinding.packId, 'bellweather-sheep-static-v1');
  assert.equal(sheepBinding.directions.length, 8);
  assert.deepEqual(sheepBinding.animations, []);
  const sheepPage = sheepManifest.pages[0];
  assert.deepEqual(sheepPage.dimensionsPx, { width: 2048, height: 1024 });
  const sheepFile = sheepManifest.files.find(file => file.id === sheepPage.runtimeFileId);
  const sheepImageResponse = await fetch(new URL(sheepFile.path, sheepDirectory), { headers: { authorization } });
  assert.equal(sheepImageResponse.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await sheepImageResponse.arrayBuffer())).digest('hex'), sheepFile.sha256);
  assert.deepEqual(packedManifest.files.filter(file => file.startsWith('assets/wildlife/')).sort(),
    ['sheep-atlas-runtime.png', 'sprite-atlas-pack-v1.json', 'static-preview-binding.json']
      .map(file => `assets/wildlife/bellweather-sheep-static-v1/${file}`).sort(),
    'only three runtime Sheep files enter the package, with no originals or GLB');
  for (const clientFile of ['audio-zones.html', 'src/audio-zones.mjs', 'src/audio-zones.css']) {
    assert.equal((await fetch(`${base}/${clientFile}`, { headers: { authorization } })).status, 200,
      `zone audition release must serve ${clientFile}`);
  }
  const zoneCatalogResponse = await fetch(`${base}/assets/audio/vaelora-zones-v1/catalog.json`, { headers: { authorization } });
  assert.equal(zoneCatalogResponse.status, 200);
  const zoneCatalog = await zoneCatalogResponse.json();
  assert.equal(zoneCatalog.sources.length, 44);
  for (const source of zoneCatalog.sources) {
    const response = await fetch(`${base}/assets/audio/vaelora-zones-v1/${source.file}`, { headers: { authorization } });
    assert.equal(response.status, 200, `release must serve original ${source.id}`);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256,
      `release must preserve original ${source.id}`);
  }
  assert.equal((await fetch(`${base}/assets/audio/vaelora-zones-v1/README.md`, { headers: { authorization } })).status, 404);
  const environmentModule = await fetch(`${base}/src/environment-art.mjs`, { headers: { authorization } });
  assert.equal(environmentModule.status, 200);
  assert.match(environmentModule.headers.get('content-type'), /javascript/);
  // Every forest atlas requested by the renderer must survive Docker context
  // filtering, be served by the packed runtime, and match its metadata hash.
  const rendererSource = await environmentModule.text();
  const forestRegistry = rendererSource.match(/forestAtlasPacks[^\n]+Promise\.all\(\[([^\]]+)\]/);
  assert.ok(forestRegistry, 'release renderer must declare its forest atlas registry');
  const forestRegions = [...forestRegistry[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const contextRules = (await readFile(path.join(root, '.dockerignore'), 'utf8')).split(/\r?\n/).map(line => line.trim());
  for (const region of forestRegions) {
    const metadataPath = `assets/environment/frontier-v1/${region}-lifecycle-atlas.json`;
    assert.ok(contextRules.includes('!' + metadataPath), `${metadataPath} must be allowed in the Docker context`);
    const metadataResponse = await fetch(`${base}/${metadataPath}`, { headers: { authorization } });
    assert.equal(metadataResponse.status, 200, metadataPath);
    const atlas = await metadataResponse.json();
    const page = atlas.pages[0], file = atlas.files.find(entry => entry.id === page.runtimeFileId);
    const response = await fetch(`${base}/assets/environment/frontier-v1/${file.path}`, { headers: { authorization } });
    assert.equal(response.status, 200, file.path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${region} forest atlas must match its metadata`);
  }
  const environmentTexture = await fetch(`${base}/assets/environment/frontier-v1/meadow.webp`, {
    headers: { authorization },
  });
  assert.equal(environmentTexture.status, 200);
  assert.match(environmentTexture.headers.get('content-type'), /image\/webp/);
  assert.ok((await environmentTexture.arrayBuffer()).byteLength > 0);
  const paintedRoot = 'assets/environment/frontier-painted-material-atlas-v1';
  const paintedResponse = await fetch(`${base}/${paintedRoot}/manifest.json`, { headers: { authorization } });
  assert.equal(paintedResponse.status, 200);
  const paintedManifest = await paintedResponse.json();
  const paintedFiles = paintedManifest.files.filter(file => file.usage === 'runtime');
  assert.equal(paintedFiles.length, 6);
  assert.deepEqual(packedManifest.files.filter(file => file.startsWith(paintedRoot + '/')).sort(),
    [`${paintedRoot}/manifest.json`, ...paintedFiles.map(file => file.path)].sort(),
    'only the painted ground manifest and six authored mips enter the release');
  for (const file of paintedFiles) {
    const response = await fetch(`${base}/${file.path}`, { headers: { authorization } });
    assert.equal(response.status, 200, file.path);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.sha256);
  }
  for (const source of ['frontier-painted-material-atlas.png', 'preview.png', 'PROVENANCE.md']) {
    assert.equal((await fetch(`${base}/${paintedRoot}/${source}`, { headers: { authorization } })).status, 404);
  }
  const oakRoot = 'assets/environment/frontier-oak-depletion-atlas-v1';
  const oakResponse = await fetch(`${base}/${oakRoot}/manifest.json`, { headers: { authorization } });
  assert.equal(oakResponse.status, 200);
  const oakManifest = await oakResponse.json();
  assert.deepEqual(packedManifest.files.filter(file => file.startsWith(oakRoot + '/')).sort(),
    [`${oakRoot}/manifest.json`, ...oakManifest.files.map(file => `${oakRoot}/${file.path}`)].sort());
  for (const file of oakManifest.files) {
    const url = `${base}/${oakRoot}/${file.path}`;
    const response = await fetch(url, { headers: { authorization } });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.sha256);
    const head = await fetch(url, { method: 'HEAD', headers: { authorization } });
    assert.equal(head.status, 200); assert.equal(Number(head.headers.get('content-length')), file.bytes);
  }
  for (const path of [`${oakRoot}/README.md`, `${oakRoot}/oak-depletion-mip-6.webp`,
    'assets/environment/frontier-resource-atlas-v1-candidate/oak-fallback-runtime.json']) {
    assert.equal((await fetch(`${base}/${path}`, { headers: { authorization } })).status, 404);
  }
  const interactiveManifestResponse = await fetch(
    `${base}/assets/environment/frontier-interactive-v1/manifest.json`, {
      headers: { authorization },
    });
  let interactiveManifestOnDisk = false;
  try {
    interactiveManifestOnDisk = (await stat(
      path.join(root, 'assets/environment/frontier-interactive-v1/manifest.json'))).isFile();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const interactiveAssetPaths = [
    ...['oak', 'berries'].flatMap((family) => ['full', 'worked', 'low', 'depleted']
      .map((stage) => `${family}-${stage}.webp`)),
    'construction-earthwork.webp', 'construction-foundation.webp',
  ];
  if (interactiveManifestResponse.status === 404) {
    assert.equal(interactiveManifestOnDisk, false,
      'an interactive manifest present on disk must be served rather than treated as an absent pack');
    for (const assetPath of interactiveAssetPaths) {
      const response = await fetch(`${base}/assets/environment/frontier-interactive-v1/${assetPath}`, {
        headers: { authorization },
      });
      assert.equal(response.status, 404, `${assetPath} should be absent with the optional manifest`);
    }
  } else {
    assert.equal(interactiveManifestResponse.status, 200);
    assert.match(interactiveManifestResponse.headers.get('content-type'), /application\/json/);
    const manifest = await interactiveManifestResponse.json();
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.packId, 'environment.frontier-interactive');
    assert.ok(Array.isArray(manifest.files));
    const runtimeEntries = manifest.files.filter((entry) => entry?.role === 'runtime-image');
    assert.deepEqual(runtimeEntries.map((entry) => entry.path).sort(), [...interactiveAssetPaths].sort());
    for (const entry of runtimeEntries) {
      assert.match(entry.sha256 || '', /^[a-f0-9]{64}$/i, `${entry.path} must declare a SHA-256`);
      const response = await fetch(
        `${base}/assets/environment/frontier-interactive-v1/${entry.path}`, {
          headers: { authorization },
        });
      assert.equal(response.status, 200, `${entry.path} must be served when the manifest is present`);
      assert.match(response.headers.get('content-type'), /image\/webp/);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length > 0, `${entry.path} must not be empty`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256.toLowerCase(),
        `${entry.path} must match its manifest hash`);
    }
  }
  // Private host/transport and server-consumed helpers must be packaged while exact
  // HTTP admission denies both methods, including pure negotiation and shims.
  const privateModules = [...RUNTIME_DOMAINS.server,
    'src/formation-assignment.mjs', 'src/simulation/movement/formation-assignment.mjs',
    'src/pve-opponent.mjs', 'src/simulation/ai/opponent-observation.mjs',
    'src/base-lifecycle.mjs', 'src/rules/base-lifecycle.mjs', 'src/forest-fringe.mjs',
    ...Object.entries(RUNTIME_DOMAIN_HOSTS).filter(([, domain]) => domain === 'server').map(([filename]) => filename)];
  for (const filename of privateModules) {
    assert.ok((await stat(path.join(root, filename))).isFile(), `packed private runtime module: ${filename}`);
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/${filename}`, { method, headers: { authorization } });
      assert.equal(response.status, 404, `server-private module must not be served (${method}): ${filename}`);
      if (method === 'HEAD') assert.equal((await response.arrayBuffer()).byteLength, 0, filename);
    }
  }
  await checkClientImports(base, { authorization, entrypoints: BROWSER_ENTRYPOINTS.map(filename => `/${filename}`) });
  for (const file of ['water-study.html', 'src/water-study-preview.mjs', 'src/water-surface-study.mjs', 'src/water-study-state.mjs', 'src/water-study-fish-binding.mjs', 'src/shore-bank-shade.mjs']) {
    assert.ok(packedManifest.files.includes(file), `water study release must contain ${file}`);
    const response = await fetch(`${base}/${file}`, { headers: { authorization } });
    assert.equal(response.status, 200, `packed water study must serve ${file}`);
    assert.match(response.headers.get('content-type'), file.endsWith('.html') ? /text\/html/ : /javascript/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, file))).digest('hex'),
      `packed water study bytes must match ${file}`);
  }
  // Default finished families retain exact source PNGs; no GLB/gallery/source upload.
  const frontierRoots = ['frontier-civilization-scale-pilot-v1', 'frontier-civilization-models-v1', 'frontier-civilization-military-models-v1']
    .map(pack => `assets/buildings/${pack}/`);
  const frontierPaths = [];
  for (const family of ['town-center', 'house', 'storehouse', 'stable', 'workshop', 'watchtower', 'barracks', 'archery-range']) {
    const frontierRoot = frontierRoots[['town-center', 'house'].includes(family) ? 0 : ['barracks', 'archery-range'].includes(family) ? 2 : 1];
    const manifestPath = frontierRoot + family + '-complete-renderer.json';
    const response = await fetch(`${base}/${manifestPath}`, { headers: { authorization } });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/json/);
    const frontier = await response.json();
    assert.equal(frontier.asset, family); validateBuildingLifecycle(frontier);
    assert.equal(frontier.completeState.views.length, 8); frontierPaths.push(manifestPath);
    for (const view of [frontier.completeState, ...frontier.states].flatMap(state => state.views)) {
      const assetPath = frontierRoot + view.path; frontierPaths.push(assetPath);
      assert.ok(contextRules.includes('!' + assetPath), `${assetPath} must be explicitly admitted`);
      const frame = await fetch(`${base}/${assetPath}`, { headers: { authorization } });
      assert.equal(frame.status, 200, assetPath); assert.match(frame.headers.get('content-type'), /image\/png/);
      const bytes = Buffer.from(await frame.arrayBuffer()); assert.equal(bytes.length, view.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), view.sha256, assetPath);
    }
  }
  const releaseManifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
  assert.deepEqual(releaseManifest.files.filter(file => frontierRoots.some(root => file.startsWith(root))).sort(), frontierPaths.sort(),
    'package exactly the selected registered sprites, without source models or galleries');
  assert.ok(frontierPaths.length >= 72, 'eight manifests and at least 64 original frames');
  for (const frontierRoot of frontierRoots) for (const absent of ['model-provenance.json', 'meshy_output/house.glb', 'preview.html', 'source/build_military.py', 'models/barracks-complete.glb']) {
    assert.equal((await fetch(`${base}/${frontierRoot}${absent}`, { headers: { authorization } })).status, 404);
  }
  const economyRoot = 'assets/buildings/frontier-economy-models-v1/';
  const economyPaths = [];
  for (const family of ['mill', 'farm', 'dock']) {
    const manifestPath = economyRoot + family + '-complete-renderer.json';
    const response = await fetch(`${base}/${manifestPath}`, {headers: {authorization}});
    assert.equal(response.status, 200); const manifest = await response.json();
    assert.equal(manifest.asset, family); assert.equal(manifest.stateOrder.length, family === 'farm' ? 8 : 5);
    economyPaths.push(manifestPath);
    for (const entry of [manifest.completeState, ...manifest.states]) for (const view of entry.views) {
      const assetPath = economyRoot + view.path; economyPaths.push(assetPath);
      assert.ok(contextRules.includes('!' + assetPath));
      for (const method of ['GET', 'HEAD']) {
        const frame = await fetch(`${base}/${assetPath}`, {method, headers: {authorization}});
        assert.equal(frame.status, 200); assert.match(frame.headers.get('content-type'), /image\/png/);
        assert.equal(Number(frame.headers.get('content-length')), view.bytes);
        const bytes = Buffer.from(await frame.arrayBuffer());
        if (method === 'GET') assert.equal(createHash('sha256').update(bytes).digest('hex'), view.sha256);
        else assert.equal(bytes.length, 0);
      }
    }
  }
  assert.equal(economyPaths.length, 147);
  assert.deepEqual(releaseManifest.files.filter(file => file.startsWith(economyRoot)).sort(), economyPaths.sort());
  for (const absent of ['source/capture_economy.py', 'source/farm-capture-receipt.json', 'captures/runtime-v1/farm-complete-view-01.png', 'models/farm.glb', 'runtime/mill-exhausted-view-00.png', 'runtime/farm-complete-view-08.png']) {
    for (const method of ['GET', 'HEAD']) assert.equal((await fetch(`${base}/${economyRoot}${absent}`, {method, headers: {authorization}})).status, 404);
  }
  const resourceStateModule = await fetch(`${base}/src/resource-visual-state.mjs`, { headers: { authorization } });
  assert.equal(resourceStateModule.status, 200);
  assert.match(await resourceStateModule.text(), /resourceVisualStage/);
  for (const asset of [
    'src/building-sprites.mjs',
    'assets/buildings/town-center-meshy-review-v1/runtime/town-center-view-01.webp',
    'assets/buildings/barracks-sprite-test-v1/runtime/barracks-complete-azure.webp',
    'assets/buildings/archery-range-sprite-v1/runtime/archery-range-critical-ember.webp',
  ]) {
    const response = await fetch(`${base}/${asset}`, { headers: { authorization } });
    assert.equal(response.status, 200, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 100, asset);
  }
  for (const family of ['oak', 'pine', 'berries']) {
    for (let view = 0; view < 8; view++) {
      const asset = `assets/environment/frontier-meshy-sprites-v1/${family}/runtime/${family}-0${view}.webp`;
      const response = await fetch(`${base}/${asset}`, { headers: { authorization } });
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('content-type'), /image\/webp/);
      assert.ok((await response.arrayBuffer()).byteLength > 100, asset);
    }
  }
  for (const family of ['oak', 'pine']) {
    for (let view = 0; view < 8; view++) {
      const asset = `assets/environment/frontier-meshy-fixed-camera-v3/${family}/runtime/${family}-0${view}.webp`;
      const response = await fetch(`${base}/${asset}`, { headers: { authorization } });
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('content-type'), /image\/webp/);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'),
        createHash('sha256').update(await readFile(path.join(sourceRoot, asset))).digest('hex'), asset);
    }
  }
  for (const family of ['oak', 'berries']) {
    const asset = `assets/environment/frontier-meshy-fixed-camera-v3/${family}/${family}-atlas.webp`;
    const response = await fetch(`${base}/${asset}`, { headers: { authorization } });
    assert.equal(response.status, 200, asset);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, asset))).digest('hex'), asset);
  }
  {
    const asset = 'assets/environment/frontier-v1/underbough-dense-growth-v2.webp';
    const response = await fetch(`${base}/${asset}`, {headers: {authorization}});
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, asset))).digest('hex'), asset);
  }
  for (const stage of ['', '-worked', '-low', '-depleted']) {
    const asset = `assets/environment/frontier-v1/underbough-thornberry${stage}.webp`;
    const response = await fetch(`${base}/${asset}`, {headers: {authorization}});
    assert.equal(response.status, 200, asset);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),
      createHash('sha256').update(await readFile(path.join(sourceRoot, asset))).digest('hex'), asset);
  }
  for (const [role, version, atlasName = role] of [
    ['worker', 'v1'], ['worker', 'v2'], ['worker', 'v3'],
    ['infantry', 'v1'], ['infantry', 'v2'], ['infantry', 'v4'], ['archer', 'v1'],
    ['human', 'v1', 'cast'], ['elf', 'v1', 'cast'], ['troll', 'v1', 'cast'], ['orc', 'v1', 'cast'],
  ]) {
    const directory = `assets/units/${atlasName === "cast" ? "cast-" : ""}${role}-sprite-${version}`;
    const manifestResponse = await fetch(`${base}/${directory}/sprite-atlas-pack-v1.json`, {
      headers: { authorization },
    });
    assert.equal(manifestResponse.status, 200, directory);
    const manifest = await manifestResponse.json();
    for (const name of [`${atlasName}-atlas-runtime.png`, 'team-accent-mask.png']) {
      const entry = manifest.files.find(file => file.path === name);
      assert.ok(entry, `${directory}/${name} must be declared`);
      const response = await fetch(`${base}/${directory}/${name}`, { headers: { authorization } });
      assert.equal(response.status, 200, `${directory}/${name}`);
      assert.match(response.headers.get('content-type'), /image\/png/);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256,
        `${directory}/${name} must match its manifest`);
    }
    assert.equal((await fetch(`${base}/${directory}/${atlasName}-atlas-source.png`, {
      headers: { authorization },
    })).status, 404, 'source atlases must remain private');
  }
  assert.equal(await upgrade(port), 401);
  assert.equal(await upgrade(port, authorization), 101);

  assert.ok((await stat(path.join(volume, 'room-data', 'rooms.json'))).isFile());
  assert.ok((await stat(path.join(volume, 'custom-maps'))).isDirectory());
  console.log('Railway release scenario passed: guarded startup, Basic Auth HTTP/WebSocket, local Three.js, packaged environment and unit sprites, verified atlas hashes, environment states, and volume paths.');
} finally {
  await stopChild(child);
  const cleanup = await Promise.allSettled([volume, root].filter(Boolean)
    .map(directory => rm(directory, { recursive: true, force: true })));
  const errors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Release scenario temporary cleanup failed');
}
