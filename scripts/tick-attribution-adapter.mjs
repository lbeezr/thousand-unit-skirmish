// Disposable copy: original function bodies and gameplay wire values stay intact.
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const sha = text => createHash('sha256').update(text).digest('hex');
export function attributionSource(original) {
  const replace = (before, after) => {
    assert.equal(source.split(before).length - 1, 1, `Attribution seam changed: ${before}`);
    source = source.replace(before, after);
  };
  let source = original.replace(/from '(\.\/?[^']+)'/g,
    (_, name) => `from '${pathToFileURL(path.resolve(root, name)).href}'`);
  replace('const ROOT = path.dirname(fileURLToPath(import.meta.url));', `const ROOT = ${JSON.stringify(root)};`);
  replace('import { deflateRawSync, inflateRawSync,', 'import { deflateRawSync as attributionNativeDeflate, inflateRawSync,');
  replace('import { encodeWebSocketFrame, websocketFrameBytes }', 'import { encodeWebSocketFrame as attributionNativeEncode, websocketFrameBytes }');
  replace("  if (url.pathname === '/health') {", `  if (url.pathname === '/__attribution/start' || url.pathname === '/__attribution/stop') {
    const payload = await (url.pathname.endsWith('/start') ? attribution.start() : attribution.stop());
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload)); return;
  }
  if (url.pathname === '/health') {`);
  const observer = pathToFileURL(path.join(root, 'scripts/tick-attribution-observer.mjs')).href;
  const bindingNames = ['runSimulationTick','recordTickDuration','ensureVisionMasks','updateVisionMasks',
    'markVisionFrom','roomPayload','prepareJsonFrame','captureMatchCheckpoint'];
  replace('\nserver.listen(PORT, HOST, () => {', `
if (HOST !== '127.0.0.1') throw new Error('Disposable attribution adapter requires loopback');
const { createTickAttribution } = await import(${JSON.stringify(observer)});
const attribution = createTickAttribution({
  functions: { ${bindingNames.join(',')}, deflateRawSync: attributionNativeDeflate, encodeWebSocketFrame: attributionNativeEncode },
  context: () => ({ tickNumber, visionTick: visionMasksUpdatedTick,
    visionCoverage: visionMasksUpdatedCoverage, coverage: visionCoverageBySourceCell }),
  visionContext: () => ({ coverage: visionCoverageBySourceCell, processed: processedVisionSourcesByTeam,
    halfX: MAP_HALF_X, halfZ: MAP_HALF_Z, width: MAP_WIDTH, defaultSight: VISION_RADIUS_CELLS }),
});
${bindingNames.map(name => `${name} = attribution.wrapped.${name};`).join('\n')}
const deflateRawSync = attribution.wrapped.deflateRawSync;
const encodeWebSocketFrame = attribution.wrapped.encodeWebSocketFrame;
JSON.stringify = attribution.wrapped.stringify;
server.listen(PORT, HOST, () => {`);
  return source;
}
export async function createTickAttributionAdapter() {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-tick-attribution-'));
  try {
    const original = await readFile(new URL('../server.mjs', import.meta.url), 'utf8'), source = attributionSource(original);
    const filename = path.join(directory, 'server-attribution.mjs'); await writeFile(filename, source);
    return { filename, originalSha256: sha(original), adapterSha256: sha(source),
      async dispose() { await rm(directory, { recursive: true, force: true }); } };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
