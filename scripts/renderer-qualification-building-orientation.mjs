// Extends the existing clean-pack, sandboxed #323 proof with actual HUD/input
// and paid placement. No source injection, building-art override or game object
// fabrication; read-only diagnostic snapshots observe the ordinary renderer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const BUILDING_ORIENTATION_CAPTURE_MAP = Object.freeze({
  id: 'rendered-building-orientation', name: 'Rendered building orientation', width: 160, height: 160,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }], obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [],
});
export const BUILDING_ORIENTATION_CAPTURE_FAMILIES = Object.freeze(['house', 'mill', 'farm', 'dock']);

export function validatePlacementMatch(ghost, rotated, placed) {
  assert.equal(ghost.active, true); assert.equal(ghost.valid, true); assert.equal(ghost.visible, true);
  assert.equal(ghost.art?.visible, true); assert.equal(ghost.orientation, 0);
  assert.equal(rotated.active, true); assert.equal(rotated.orientation, 1); assert.equal(rotated.visible, true);
  assert.equal(rotated.type, ghost.type);
  assert.equal(rotated.valid, true); assert.equal(rotated.art?.visible, true);
  assert.deepEqual(rotated.position, ghost.position, 'rotation keeps the selected site');
  assert.notEqual(rotated.art.key, ghost.art.key, 'rotation changes the actual authored view');
  assert.equal(placed.type, ghost.type); assert.equal(placed.orientation, rotated.orientation);
  assert.deepEqual([placed.x, placed.z], [rotated.position[0], rotated.position[2]]);
  assert.equal(placed.complete, true); assert.equal(placed.art?.visible, true);
  for (const field of ['key', 'scale', 'center', 'position']) assert.deepEqual(placed.art[field], rotated.art[field], `final ${field} matches preview`);
}

async function captureBuildingFamily(page, evidenceDirectory, { type, onStage }) {
  const click = async selector => {
    const point = await page.cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el || el.disabled) return null; el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect();
      return r.width && r.height && !el.hidden ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()`);
    assert.ok(point, `normal HUD control is visible and enabled: ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
  };
  onStage('building-map');
  let map = { ...BUILDING_ORIENTATION_CAPTURE_MAP, id: `${BUILDING_ORIENTATION_CAPTURE_MAP.id}-${type}` };
  assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify({ type: 'publishMap', map })})`), true);
  await page.wait(`window.__rtsEnvironmentStateSnapshot?.mapId === '${map.id}'`, 'applied building audit map');
  onStage('building-hud');
  if (await page.cdp.evaluate('document.querySelector("#command-deck").hidden')) await click('#dock-toggle');
  const buildSelector = type === 'house' ? '#build-house' : `#roster-building-options [data-building="${type}"]`;
  await click('#dock-tab-economy'); await click('#select-workers'); await click(buildSelector);
  const rect = await page.cdp.evaluate('(() => { const r=document.querySelector("#viewport canvas").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
  onStage('building-ghost');
  let pointer, ghost;
  for (const [fx, fy] of [[.5,.5],[.55,.45],[.45,.55],[.6,.4],[.4,.6]]) {
    pointer = { x: rect.x + rect.width * fx, y: rect.y + rect.height * fy };
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
    ghost = await page.wait('window.__rtsBuildingPlacementSnapshot?.active && window.__rtsBuildingPlacementSnapshot', 'active final-art placement');
    if (ghost.visible && ghost.valid) break;
  }
  if (type === 'dock') {
    // Publish disclosed authored water through the normal map command. The
    // sampled real pointer site has two legal shores, so a quarter turn can
    // retain the site while testing the strict front-berth contract.
    assert.equal(ghost.visible, true);
    const column = Math.floor(map.width / 2 + ghost.position[0]), row = Math.floor(map.height / 2 + ghost.position[2]);
    map = { ...map, id: `${map.id}-shore`, obstacles: [
      { column: column - 1, row: row + 2, width: 8, height: 8, material: 'water' },
      { column: column + 2, row: row - 1, width: 8, height: 8, material: 'water' },
    ] };
    onStage('building-map');
    assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify({ type: 'publishMap', map })})`), true);
    await page.wait(`window.__rtsEnvironmentStateSnapshot?.mapId === '${map.id}'`, 'applied disclosed two-shore map');
    await click('#select-workers'); await click(buildSelector);
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
  }
  ghost = await page.wait('window.__rtsBuildingPlacementSnapshot?.valid && window.__rtsBuildingPlacementSnapshot.art?.visible && window.__rtsBuildingPlacementSnapshot', 'visible valid final asset ghost');
  const captures = [];
  const capture = async name => {
    const frame = await page.cdp.evaluate('window.__rtsQualification.request()');
    assert.match(frame.version, /^WebGL 2\.0/); assert.equal(frame.contextLost, false); assert.equal(frame.glError, 0);
    assert.ok(frame.number > 0 && new Set(frame.pixels).size > 2, 'actual varied WebGL frame');
    const png = Buffer.from((await page.cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    const canvas = Buffer.from(frame.canvasPng, 'base64');
    assert.ok(png.length > 10000 && canvas.length > 10000);
    const fileName = type === 'house' ? name : `${type}-${name}`;
    await writeFile(path.join(evidenceDirectory, `${fileName}.png`), png);
    await writeFile(path.join(evidenceDirectory, `${fileName}-canvas.png`), canvas);
    captures.push({ name: fileName, number: frame.number, time: frame.time, pngSha256: hash(png), canvasSha256: hash(canvas) });
  };
  onStage('building-default-frame');
  await capture('building-ghost-default');
  onStage('building-rotate');
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: '[', code: 'BracketLeft' });
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: '[', code: 'BracketLeft' });
  const rotated = await page.wait('window.__rtsBuildingPlacementSnapshot?.orientation === 1 && window.__rtsBuildingPlacementSnapshot.art?.visible && window.__rtsBuildingPlacementSnapshot', 'rotated final asset ghost');
  await capture('building-ghost-rotated');
  onStage('building-submit');
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', { type, ...pointer, button: 'left', clickCount: 1 });
  onStage('building-complete');
  const placed = await page.wait(`window.__rtsBuildingPlacementSnapshot?.buildings.find(b => b.type === '${type}' && b.complete && b.x === ${rotated.position[0]} && b.z === ${rotated.position[2]} && b.art?.visible)`, 'paid completed building at chosen site', 60000);
  onStage('building-parity');
  validatePlacementMatch(ghost, rotated, placed);
  await capture('building-paid-complete');
  assert.notEqual(captures[0].canvasSha256, captures[1].canvasSha256, 'rendered ghost must visibly rotate');
  assert.notEqual(captures[1].canvasSha256, captures[2].canvasSha256, 'translucent preview must become the actual paid building');
  return { scope: 'ordinary-renderer-final-art-ghost-rotate-paid-placement', type, mapId: map.id,
    buildingArtOverride: false, selectionAndBuild: 'normal HUD controls', rotationAndPlacement: 'native CDP input',
    ghost, rotated, placed, captures, humanAppearanceReview: 'pending' };
}

export async function captureBuildingOrientation(page, evidenceDirectory, { onStage = () => {} } = {}) {
  const families = [];
  for (const type of BUILDING_ORIENTATION_CAPTURE_FAMILIES) {
    families.push(await captureBuildingFamily(page, evidenceDirectory, { type, onStage }));
  }
  return { ...families[0], additionalFamilies: families.slice(1), humanAppearanceReview: 'pending' };
}
