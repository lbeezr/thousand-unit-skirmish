import {createHash} from 'node:crypto';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

export class CaptureCheckpointError extends Error {
  constructor(code, message) { super(message); this.name = 'CaptureCheckpointError'; this.code = code; }
}
const fail = (code, message) => { throw new CaptureCheckpointError(code, message); };
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const maxImageBytes = 32 * 1024 * 1024;

const captureView = `({width:innerWidth,height:innerHeight,
  deviceScaleFactor:devicePixelRatio,hostname:location.hostname,
  boot:document.documentElement.dataset.boot,
  appliedMapId:window.__rtsEnvironmentStateSnapshot?.mapId,
  requestedMapId:document.querySelector('#map-select')?.value,
  connection:document.querySelector('#network-status')?.textContent})`;

function readyView(view, mapId) {
  if (view?.boot !== 'ready' || view?.appliedMapId !== mapId
      || view?.requestedMapId !== view?.appliedMapId
      || !['ROOM LIVE', 'WAITING FOR PLAYER 2'].includes(view?.connection)
      || !['127.0.0.1', 'localhost', '[::1]'].includes(view?.hostname)) {
    fail('capture-not-ready', 'Capture requires a synced local applied-map snapshot with no pending map selection.');
  }
  const viewport = {width: view.width, height: view.height, deviceScaleFactor: view.deviceScaleFactor};
  if (![viewport.width, viewport.height].every(n => Number.isInteger(n) && n > 0 && n <= 8192)
      || !Number.isFinite(viewport.deviceScaleFactor) || viewport.deviceScaleFactor <= 0
      || viewport.deviceScaleFactor > 4) {
    fail('capture-not-ready', 'The observed viewport is outside the capture bounds.');
  }
  return viewport;
}

function imageBytes(data, viewport) {
  if (typeof data !== 'string' || data.length > Math.ceil(maxImageBytes / 3) * 4) {
    fail('capture-invalid-image', 'CDP must return a bounded base64 PNG.');
  }
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length < 45 || bytes.length > maxImageBytes || bytes.toString('base64') !== data
      || !bytes.subarray(0, 8).equals(pngSignature)) {
    fail('capture-invalid-image', 'CDP returned an invalid PNG envelope.');
  }
  let offset = 8, width, height, sawData = false, sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) break;
    if (offset === 8) {
      if (type !== 'IHDR' || length !== 13) break;
      width = bytes.readUInt32BE(offset + 8); height = bytes.readUInt32BE(offset + 12);
    } else if (type === 'IHDR') break;
    if (type === 'IDAT' && length > 0) sawData = true;
    offset += length + 12;
    if (type === 'IEND') { sawEnd = length === 0 && offset === bytes.length; break; }
  }
  if (!sawData || !sawEnd || width !== Math.round(viewport.width * viewport.deviceScaleFactor)
      || height !== Math.round(viewport.height * viewport.deviceScaleFactor)) {
    fail('capture-invalid-image', 'PNG framing or dimensions do not match the observed viewport.');
  }
  return {bytes, width, height};
}

// Consumes the page returned by createFortifiedBrowser(); never launches a browser.
export async function captureCheckpoint({page, revision, browserVersion, mapId, checkpoint, outputDirectory} = {}) {
  if (typeof page?.cdp?.call !== 'function' || typeof page?.cdp?.evaluate !== 'function') {
    fail('capture-runtime-unavailable', 'A live isolated CDP page is required; run browser preflight first.');
  }
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision) || typeof browserVersion?.product !== 'string'
      || !browserVersion.product.trim() || typeof checkpoint !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(checkpoint)
      || typeof mapId !== 'string' || !mapId || mapId.length > 128
      || typeof outputDirectory !== 'string' || !path.isAbsolute(outputDirectory)) {
    fail('capture-invalid-context', 'Provide a revision, browser version, map, safe checkpoint ID and absolute output directory.');
  }
  const directory = path.join(outputDirectory, checkpoint);
  let created = false;
  try {
    try { await mkdir(directory); created = true; }
    catch (error) {
      fail(error.code === 'EEXIST' ? 'capture-output-exists' : 'capture-storage-unavailable',
        'Capture needs a new checkpoint directory beneath a writable existing output directory.');
    }
    let view, screenshot, after;
    try {
      view = await page.cdp.evaluate(captureView);
    } catch { fail('capture-runtime-unavailable', 'The isolated CDP page could not report capture readiness.'); }
    const viewport = readyView(view, mapId);
    try { screenshot = await page.cdp.call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false}); }
    catch { fail('capture-runtime-unavailable', 'CDP screenshot capture failed; no capture bundle was published.'); }
    try { after = await page.cdp.evaluate(captureView); }
    catch { fail('capture-runtime-unavailable', 'The applied map could not be rechecked after capture.'); }
    const afterViewport = readyView(after, mapId);
    if (Object.keys(viewport).some(key => viewport[key] !== afterViewport[key])) {
      fail('capture-not-ready', 'The viewport changed during capture; no capture bundle was published.');
    }
    const image = imageBytes(screenshot?.data, viewport);
    const manifest = {schemaVersion: 1, source: {revision, suppliedBy: 'caller'},
      browser: {product: browserVersion.product, protocolVersion: browserVersion.protocolVersion ?? null},
      scene: {mapId: view.appliedMapId, mapStateSource: 'client-applied-snapshot',
        checkpoint, checkpointSuppliedBy: 'caller'}, viewport,
      image: {file: 'color.png', width: image.width, height: image.height, bytes: image.bytes.length,
        sha256: createHash('sha256').update(image.bytes).digest('hex')},
      evidence: {kind: 'cdp-screenshot', visualReview: 'not-performed', humanPlaytest: 'not-performed'}};
    try {
      await writeFile(path.join(directory, 'color.png'), image.bytes, {flag: 'wx'});
      await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {flag: 'wx'});
    } catch { fail('capture-storage-unavailable', 'Capture bundle files could not be written.'); }
    return {directory, manifest};
  } catch (error) {
    if (created) {
      try { await rm(directory, {recursive: true, force: true}); }
      catch { fail('capture-cleanup-failed', 'Failed capture cleanup needs attention before another capture.'); }
    }
    throw error;
  }
}
