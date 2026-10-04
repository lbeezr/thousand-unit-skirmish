// Owned adapter for the qualified shared cloud runner. No launch on import.
// It collects real normal-build pixels; an uninspected PNG never passes appearance.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCaptureContext } from './renderer-capture-context.mjs';

export const id = 'site-composition';
export const contextVersion = 1;
export const regressionMap = Object.freeze({
  id: 'site-composition-regression', name: 'Site Composition Regression',
  width: 64, height: 64, terrainSeed: 881, fogOfWar: false,
  startingArmySize: 20, startingResources: { food: 1000, wood: 2000 },
  spawnPoints: [{ team: 0, x: -12, z: 0 }, { team: 1, x: 12, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [],
  elevationPatches: [
    { column: 48, row: 48, width: 14, height: 1, level: 1 },
    { column: 48, row: 61, width: 14, height: 1, level: 1 },
    { column: 48, row: 49, width: 1, height: 12, level: 1 },
    { column: 61, row: 49, width: 1, height: 12, level: 1 },
    { column: 49, row: 49, width: 12, height: 12, level: 2 },
  ],
});

/** @param {import('./renderer-capture-context.mjs').CaptureContext} context */
export async function run(context) {
  const { page, openPage, origin, source, capture } = validateCaptureContext(context);
  assert.match(source.revision, /^[a-f0-9]{40}$/);
  assert.match(source.digest, /^sha256:[a-f0-9]{64}$/);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'owned loopback game required');
  let mapId = regressionMap.id;
  const receipts = [], controls = [];
  const ready = p => p.wait('window.__rtsEnvironmentCaptureCommand && window.__rtsEnvironmentStateSnapshot?.workers.length && window.__rtsSiteCompositionSnapshot?.unitSpritesReady', 'normal default art and live workers', 30000);
  const command = async (p, value) => assert.equal(await p.cdp.evaluate(
    `window.__rtsEnvironmentCaptureCommand(${JSON.stringify(value)})`), true, 'command must use the real client/socket');
  const shot = async (p, checkpoint) => {
    const scene = await p.cdp.evaluate('({state:window.__rtsEnvironmentStateSnapshot,render:window.__rtsSiteCompositionSnapshot})');
    assert.equal(scene.state.mapId, mapId); assert.equal(scene.render.mapId, mapId);
    assert.equal(scene.render.unitSpritesReady, true);
    const result = await capture({ page: p, mapId, checkpoint });
    // Only the explicit disclosed numeric projections are retained, never socket
    // envelopes, invite/session information, console payloads or credentials.
    await writeFile(path.join(result.directory, 'scene.json'), JSON.stringify({ source, scope: 'authored-regression-capture',
      appearanceReview: 'not-performed', state: scene.state, render: scene.render }, null, 2));
    receipts.push(checkpoint); return scene;
  };
  await page.cdp.call('Page.navigate', { url: `${origin}/` });
  await page.wait("document.documentElement.dataset.entry==='menu' && !document.querySelector('#menu-practice').disabled", 'existing Practice entry');
  await page.cdp.evaluate("document.querySelector('#practice-match-mode').value='authored@1';document.querySelector('#practice-match-mode').dispatchEvent(new Event('change'));document.querySelector('#menu-practice').click()");
  await ready(page);
  const roomUrl = await page.cdp.evaluate('location.href');
  assert.equal(new URL(roomUrl).origin, origin);
  assert.match(new URL(roomUrl).searchParams.get('room') ?? '', /^[A-Za-z0-9_-]{32}$/);
  const second = await openPage();
  await second.cdp.call('Page.navigate', { url: roomUrl });
  await ready(second);
  await command(page, { type: 'publishMap', map: regressionMap });
  for (const p of [page, second]) {
    await p.wait(`window.__rtsEnvironmentStateSnapshot?.mapId === ${JSON.stringify(mapId)}`, 'applied authored regression map');
    await p.cdp.evaluate("document.querySelector('#camera-home-base').click()");
  }
  const teams = await Promise.all([page, second].map(p => p.cdp.evaluate('window.__rtsEnvironmentStateSnapshot.team')));
  assert.deepEqual([...teams].sort(), [0, 1], 'two real owner seats required');
  for (let i = 0; i < 2; i++) {
    const p = [page, second][i], team = teams[i], sign = team === 0 ? -1 : 1;
    const workers = await p.cdp.evaluate(`window.__rtsEnvironmentStateSnapshot.workers.filter(w=>w.team===${team}).sort((a,b)=>a.id-b.id)`);
    assert.ok(workers.length >= 4);
    await command(p, { type: 'build', buildingType: 'watchtower', ids: [workers[0].id], x: sign * 16.5, z: -6.5 });
    await command(p, { type: 'build', buildingType: 'house', ids: [workers[1].id], x: sign * 10.5, z: -6.5 });
    const columns = team === 0 ? [15, 20] : [48, 43];
    await command(p, { type: 'buildWall', ids: [workers[2].id],
      points: [{ column: columns[0], row: 38 }, { column: columns[1], row: 38 }, { column: columns[1], row: 40 }] });
    await command(p, { type: 'build', buildingType: 'palisade-gate', ids: [workers[3].id],
      x: team === 0 ? -10.5 : 10.5, z: 8.5 });
    await p.wait(`window.__rtsEnvironmentStateSnapshot.buildings.filter(b=>b.team===${team}).length === 11`, 'all paid sites admitted');
    const initial = await shot(p, `team-${team}-earthwork`);
    controls.push({ id: `team-${team}-real-paid-sites`, passed: initial.state.buildings.filter(b => b.team === team).length === 11 });
  }
  for (let i = 0; i < 2; i++) {
    const p = [page, second][i], team = teams[i];
    await p.wait(`window.__rtsEnvironmentStateSnapshot.buildings.some(b=>b.team===${team}&&b.type==='palisade-wall'&&b.progress>=0.4&&!b.complete)`, 'productive palisade foundation');
    await shot(p, `team-${team}-worker-foundation`);
    const gap = await p.cdp.evaluate(`window.__rtsEnvironmentStateSnapshot.buildings.find(b=>b.team===${team}&&b.type==='palisade-wall'&&b.z===6.5&&b.x===${team === 0 ? -13.5 : 13.5})`);
    assert.ok(gap && !gap.complete, 'a pending middle cell is the removal control');
    await command(p, { type: 'cancelConstruction', buildingId: gap.id });
    await p.wait(`!window.__rtsEnvironmentStateSnapshot.buildings.some(b=>b.id===${gap.id})`, 'real cancelled cell removed');
    await shot(p, `team-${team}-cancelled-gap`);
    controls.push({ id: `team-${team}-cancelled-cell-absent`, passed: true });
  }
  for (let i = 0; i < 2; i++) {
    const p = [page, second][i], team = teams[i];
    await p.wait(`window.__rtsEnvironmentStateSnapshot.buildings.filter(b=>b.team===${team}).length===10 && window.__rtsEnvironmentStateSnapshot.buildings.filter(b=>b.team===${team}).every(b=>b.complete)`, 'natural paid construction completion', 90000);
    await p.wait(`window.__rtsSiteCompositionSnapshot.buildings.filter(b=>b.team===${team}&&['watchtower','house'].includes(b.type)).length===2 && window.__rtsSiteCompositionSnapshot.buildings.filter(b=>b.team===${team}&&['watchtower','house'].includes(b.type)).every(b=>b.capturedVisible&&!b.fallbackVisible)`, 'normal completed capture art loaded');
    const complete = await shot(p, `team-${team}-completed-watchtower-house-gate`);
    controls.push({ id: `team-${team}-complete-ground-cleared`, passed: complete.state.constructionDraws.every(d => !d.buildingIds.some(id =>
      complete.state.buildings.find(b => b.id === id)?.team === team)) && complete.state.palisadeGroundDraws.every(d => !d.buildingIds.some(id =>
      complete.state.buildings.find(b => b.id === id)?.team === team)) });
    const worker = complete.state.workers.find(w => w.team === team);
    await command(p, { type: 'move', ids: [worker.id], x: team === 0 ? -16.5 : 16.5, z: -3.5 });
    await p.wait(`window.__rtsEnvironmentStateSnapshot.workers.some(w=>w.id===${worker.id}&&w.task==='idle'&&Math.hypot(w.x-(${team === 0 ? -16.5 : 16.5}),w.z+3.5)<0.7)`, 'real foreground approach');
    await shot(p, `team-${team}-foreground-worker`);
    await command(p, { type: 'move', ids: [worker.id], x: team === 0 ? -16.5 : 16.5, z: -9.5 });
    await p.wait(`window.__rtsEnvironmentStateSnapshot.workers.some(w=>w.id===${worker.id}&&w.task==='idle'&&Math.hypot(w.x-(${team === 0 ? -16.5 : 16.5}),w.z+9.5)<0.7)`, 'real rear approach');
    await shot(p, `team-${team}-rear-worker`);
  }
  // A second declared authored map supplies a raised, currently visible owned
  // TownCenter/House with real fog and a legal ramp. No actor is teleported.
  mapId = `${regressionMap.id}-raised`;
  const raised = { ...regressionMap, id: mapId, name: 'Raised Site Composition Regression', fogOfWar: true,
    spawnPoints: [{ team: 0, x: 22.5, z: 22.5 }, { team: 1, x: -12, z: 0 }] };
  await command(page, { type: 'publishMap', map: raised });
  const p = [page, second][teams.indexOf(0)];
  await p.wait(`window.__rtsSiteCompositionSnapshot?.mapId === ${JSON.stringify(mapId)} && window.__rtsSiteCompositionSnapshot.buildings.some(b=>b.team===0&&b.type==='town-center'&&b.groundY>1)`, 'real raised TownCenter control');
  await p.cdp.evaluate("document.querySelector('#camera-home-base').click()");
  await shot(p, 'raised-towncenter-fog-control');
  const worker = await p.cdp.evaluate('window.__rtsEnvironmentStateSnapshot.workers.find(w=>w.team===0)');
  await command(p, { type: 'build', buildingType: 'house', ids: [worker.id], x: 22.5, z: 18.5 });
  await p.wait("window.__rtsSiteCompositionSnapshot.buildings.some(b=>b.team===0&&b.type==='house'&&b.complete&&b.capturedVisible&&b.groundY>1)", 'real raised House completion', 40000);
  const elevated = await shot(p, 'raised-house-fog-contact');
  controls.push({ id: 'raised-real-building-contact', passed: elevated.state.fogOfWar === true
    && elevated.render.buildings.some(b => b.type === 'house' && b.complete && b.groundY > 1) });
  // Art/square/occlusion verdict requires the retained true images to be opened.
  // The CI batch must not promote acquisition and state metadata to appearance.
  return { status: 'blocked', checks: [...controls,
    { id: 'real-images-collected', passed: receipts.length === 14 },
    { id: 'dark-square-and-occlusion-visual-review', passed: false },
    { id: 'raised-terrain-and-fog-visual-controls', passed: false }] };
}
