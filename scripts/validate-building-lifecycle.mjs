import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const STATES = ['foundation', 'frame', 'complete', 'damaged', 'critical'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const pair = value => Array.isArray(value) && value.length === 2;
const requireContract = (condition, message) => { if (!condition) throw new Error(message); };

// Metadata admission only: images, mask pixels and visual registration need separate review.
export function validateBuildingLifecycle(manifest, {requireLifecycle = false, requireTeamMasks = false} = {}) {
  requireContract(manifest?.schema === 'thousand-unit-skirmish.building-lifecycle-reference.v1', 'Unsupported building lifecycle schema');
  const camera = manifest.camera;
  requireContract(camera?.projection === 'orthographic', 'Expected orthographic camera');
  requireContract(pair(camera.framePixels) && camera.framePixels.every(n => Number.isSafeInteger(n) && n > 0), 'Invalid frame dimensions');
  requireContract(Number.isFinite(camera.pixelsPerWorldUnit) && camera.pixelsPerWorldUnit > 0, 'Invalid capture density');
  requireContract(pair(camera.anchorPixelFromTopLeft) && camera.anchorPixelFromTopLeft.every((n, i) => Number.isFinite(n) && n >= 0 && n <= camera.framePixels[i]), 'Invalid ground anchor');
  const azimuths = camera.azimuthDegrees;
  requireContract(Array.isArray(azimuths) && azimuths.length > 0 && azimuths.every(n => Number.isFinite(n) && n >= 0 && n < 360)
    && new Set(azimuths).size === azimuths.length, 'Invalid or duplicate camera directions');
  const order = manifest.stateOrder;
  requireContract(Array.isArray(order) && order.includes('complete') && order.every(state => STATES.includes(state))
    && new Set(order).size === order.length, 'Invalid or duplicate lifecycle declarations');
  if (requireLifecycle) requireContract(STATES.every(state => order.includes(state)),
    `Missing lifecycle states: ${STATES.filter(state => !order.includes(state)).join(', ')}`);
  requireContract(manifest.completeState?.state === 'complete' && Array.isArray(manifest.states), 'Invalid lifecycle entries');
  const entries = [manifest.completeState, ...manifest.states];
  requireContract(entries.length === order.length && entries.every(entry => order.includes(entry?.state))
    && new Set(entries.map(entry => entry.state)).size === entries.length, 'Lifecycle entries differ from declared states');
  let teamMaskedViews = 0;
  for (const entry of entries) {
    requireContract(Array.isArray(entry.views) && entry.views.length === azimuths.length, `Missing directions for ${entry.state}`);
    const seen = new Set();
    for (const view of entry.views) {
      requireContract(Number.isSafeInteger(view?.index) && view.index >= 0 && view.index < azimuths.length && !seen.has(view.index), `Invalid or duplicate direction for ${entry.state}`);
      seen.add(view.index);
      requireContract(view.azimuthDegrees === azimuths[view.index], `Direction/azimuth mismatch for ${entry.state}`);
      requireContract(typeof view.path === 'string' && view.path.length > 0 && digest(view.sha256), `Invalid frame reference for ${entry.state}`);
      const hasMaskPath = view.teamMaskPath !== undefined;
      const hasMaskDigest = view.teamMaskSha256 !== undefined;
      requireContract(hasMaskPath === hasMaskDigest && (!hasMaskPath || (typeof view.teamMaskPath === 'string'
        && view.teamMaskPath.length > 0 && digest(view.teamMaskSha256))), `Invalid team-mask reference for ${entry.state}`);
      requireContract(!requireTeamMasks || hasMaskPath, `Missing team mask for ${entry.state} direction ${view.index}`);
      if (hasMaskPath) teamMaskedViews++;
    }
  }
  return {asset: manifest.asset, states: order, viewsPerState: azimuths.length, teamMaskedViews};
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(['--require-lifecycle', '--require-team-masks']);
  const files = args.filter(arg => !flags.has(arg));
  requireContract(files.length === 1 && !files[0].startsWith('--'),
    'Usage: node scripts/validate-building-lifecycle.mjs MANIFEST [--require-lifecycle] [--require-team-masks]');
  const manifest = JSON.parse(await readFile(files[0], 'utf8'));
  const result = validateBuildingLifecycle(manifest, {requireLifecycle: args.includes('--require-lifecycle'),
    requireTeamMasks: args.includes('--require-team-masks')});
  console.log(JSON.stringify({metadata: result, evidence: 'Metadata only; file bytes, mask alignment, physical scale and appearance are not verified.'}));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
