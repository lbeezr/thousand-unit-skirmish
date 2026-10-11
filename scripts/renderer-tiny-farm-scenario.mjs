// Farm-owned ordinary Tiny capture. The shared runner owns pack/server/browser
// lifetime and screenshots; imports do not launch or dispatch any work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCaptureContext } from './renderer-capture-context.mjs';
import { checkServedBuildIdentity } from './check-served-build-identity.mjs';
import { clickControl } from './catalog-barracks-scenario.mjs';
import { clickNovicePoint } from './renderer-qualification-novice.mjs';
import { installMinimapCameraProbe } from './minimap-browser-probe.mjs';
import { validateWorkCycleFrame } from './worker-work-cycle-capture.mjs';
import { runFarmRenewalCaptureStep } from './farm-renewal-capture-step.mjs';

export const id = 'tiny-farm';
export const contextVersion = 1;
export const TINY_FARM_MAP = 'veyrholds-terraced-vale';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const wire = 'window.__rtsTinyFarm.latest';
const environment = 'window.__rtsEnvironmentStateSnapshot';

export function tinyFarmSites(definition, team) {
  assert.equal(definition.id, TINY_FARM_MAP); assert.ok([0, 1].includes(team));
  const spawn = definition.spawnPoints.find(s => s.team === team);
  assert.ok(spawn, 'canonical Tiny spawn required');
  // Keep the Farm clear of the home-food sheep at (spawn.x ±6, spawn.z+6).
  return { mill: { x: spawn.x, z: spawn.z + 5 },
    farm: { x: spawn.x + (team === 0 ? 6 : -6), z: spawn.z } };
}

// Only current own-seat economy and identities leave the socket observer. Never
// retain envelopes, session tokens, invite URLs, chat or opponent resources.
export function reduceFarmState(message, team) {
  if (!['welcome', 'mapChange', 'state'].includes(message?.type)) return null;
  const state = message.state ?? message;
  if (![0, 1].includes(team) || state?.mapId !== 'veyrholds-terraced-vale'
    || !Number.isSafeInteger(state.tick) || state.tick < 0 || !Array.isArray(state.units)
    || !Array.isArray(state.buildings)) return null;
  const finite = value => Number.isFinite(value) ? value : null;
  return { team, tick: state.tick, mapId: state.mapId,
    matchModeId: state.matchModeId === 'skirmish' ? 'skirmish' : null,
    matchModeVersion: state.matchModeVersion === 1 ? 1 : null,
    bank: { food: finite(state.food?.[team]), wood: finite(state.wood?.[team]) },
    workers: state.units.filter(row => row?.[1] === team && row[5] === 'worker' && row[4] > 0).slice(0, 32)
      .map(row => ({ id: row[0], team, generation: row[8], x: finite(row[2]), z: finite(row[3]),
        cargo: finite(row[6]), cargoType: ['food', 'wood', 'stone'].includes(row[7]) ? row[7] : null,
        task: ['idle', 'moving', 'gathering', 'returning', 'building'].includes(row[9]) ? row[9] : null })),
    buildings: state.buildings.filter(b => b.team === team && ['farm', 'mill'].includes(b.type)).slice(0, 16)
      .map(b => ({ id: b.id, team, type: b.type, x: finite(b.x), z: finite(b.z),
        complete: b.complete === true, harvestStock: b.type === 'farm' ? finite(b.harvestStock) : null })),
    dropoffs: [...(state.homeTownCenters ?? []), ...state.buildings]
      .filter(b => b.team === team && b.complete && b.hp > 0 && ['town-center', 'mill', 'storehouse'].includes(b.type))
      .slice(0, 16).map(b => ({ id: b.id, type: b.type, x: finite(b.x), z: finite(b.z) })),
  };
}

export function reduceFarmOrder(command) {
  if (!['build', 'gather', 'replantFarm'].includes(command?.type) || !Array.isArray(command.ids)
    || !command.ids.length || command.ids.length > 32 || new Set(command.ids).size !== command.ids.length
    || !command.ids.every(id => Number.isSafeInteger(id) && id >= 0)) return null;
  const order = { type: command.type, ids: [...command.ids] };
  if (command.type === 'build' && ['farm', 'mill'].includes(command.buildingType)
    && Number.isFinite(command.x) && Number.isFinite(command.z)) return { ...order,
    buildingType: command.buildingType, x: command.x, z: command.z };
  if (command.type === 'gather' && /^farm:[1-9][0-9]*$/.test(command.nodeId ?? '')) return { ...order, nodeId: command.nodeId };
  if (command.type === 'replantFarm' && Number.isSafeInteger(command.buildingId) && command.buildingId > 0)
    return { ...order, buildingId: command.buildingId };
  return null;
}

export function installFarmObserver(reduceState, reduceOrder) {
  const probe = window.__rtsTinyFarm = { team: null, latest: null, orders: [], droppedOrders: 0, camera: null };
  const NativeSocket = window.WebSocket, owned = new WeakSet();
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      try { const url = new URL(args[0], location.href);
        if (url.host !== location.host || url.pathname !== '/ws' || !['ws:', 'wss:'].includes(url.protocol)) return;
      } catch { return; }
      owned.add(this);
      this.addEventListener('message', event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'welcome' && [0, 1].includes(message.player?.team)) probe.team = message.player.team;
          const reduced = reduceState(message, probe.team);
          if (reduced) probe.latest = reduced;
        } catch { /* Malformed observations never replace native delivery. */ }
      });
    }
    send(data) {
      if (owned.has(this)) try {
        const order = reduceOrder(JSON.parse(data));
        if (order) { if (probe.orders.length < 16) probe.orders.push(order); else probe.droppedOrders++; }
      } catch { /* Observation never blocks the native send. */ }
      return super.send(data);
    }
  };
}

export function validateFarmEconomy(state, team) {
  assert.equal(state?.team, team, 'Farm evidence must retain its own seat');
  assert.equal(state.mapId, TINY_FARM_MAP, 'normal Tiny must remain applied');
  assert.equal(state.matchModeId, 'skirmish'); assert.equal(state.matchModeVersion, 1);
  assert.ok(Number.isSafeInteger(state.tick) && state.tick >= 0, 'live authoritative tick required');
  assert.ok(Number.isFinite(state.bank?.food) && state.bank.food >= 0
    && Number.isFinite(state.bank.wood) && state.bank.wood >= 0, 'finite owned bank required');
  assert.equal(state.workers.length, 4, 'ordinary Tiny retains its four opening Workers');
  assert.equal(new Set(state.workers.map(w => w.id)).size, 4, 'four distinct Workers required');
  for (const worker of state.workers) assert.ok(worker.team === team && Number.isSafeInteger(worker.id)
    && Number.isInteger(worker.generation) && worker.generation > 0 && Number.isFinite(worker.x) && Number.isFinite(worker.z)
    && Number.isFinite(worker.cargo) && worker.cargo >= 0 && worker.cargo <= 10
    && (worker.cargo === 0 || worker.cargoType === 'food'), 'owned live Workers with bounded Food cargo required');
  return state;
}

export function validateFarmBuild(before, after, { team, type, site, ids }) {
  validateFarmEconomy(before, team); validateFarmEconomy(after, team);
  assert.ok(['farm', 'mill'].includes(type));
  assert.deepEqual([...ids].sort((a, b) => a - b), before.workers.map(w => w.id).sort((a, b) => a - b));
  const fresh = after.buildings.filter(b => b.type === type && !before.buildings.some(old => old.id === b.id));
  assert.equal(fresh.length, 1, 'one real paid foundation required');
  const building = fresh[0];
  assert.equal(building.team, team); assert.equal(building.complete, false, 'capture the paid foundation before completion');
  assert.ok(Math.hypot(building.x - site.x, building.z - site.z) < 1, 'paid foundation must match the clicked site');
  assert.equal(after.bank.wood, before.bank.wood - (type === 'farm' ? 60 : 75), 'build must debit its exact ordinary cost');
  assert.equal(after.bank.food, before.bank.food, 'building cannot invent Food');
  if (type === 'farm') assert.equal(building.harvestStock, 0, 'unfinished Farm supplies no Food');
  return building;
}

export function validateFarmSupply(initial, state, plotId, { team, supply = 200, exhausted = false } = {}) {
  validateFarmEconomy(initial, team); validateFarmEconomy(state, team);
  assert.ok(state.tick >= initial.tick, 'authority cannot rewind');
  assert.deepEqual(state.workers.map(w => [w.id, w.generation]), initial.workers.map(w => [w.id, w.generation]),
    'Worker identities and generations must persist');
  const plot = state.buildings.find(b => b.id === plotId);
  assert.ok(plot?.type === 'farm' && plot.team === team && plot.complete, 'owned completed crop required');
  assert.ok(Number.isFinite(plot.harvestStock) && plot.harvestStock >= 0 && plot.harvestStock <= 200, 'finite crop required');
  const cargo = rows => rows.workers.reduce((sum, w) => sum + (w.cargoType === 'food' ? w.cargo : 0), 0);
  // Same 0.011 wire-rounding bound as the existing route capture; no native
  // fixture tolerance, deadline or gameplay assertion is changed.
  assert.ok(Math.abs(state.bank.food + plot.harvestStock + cargo(state)
    - (initial.bank.food + cargo(initial) + supply)) <= 0.011, 'bank + crop + cargo must conserve the two hundred Food planting');
  if (exhausted) {
    assert.equal(plot.harvestStock, 0); assert.equal(cargo(state), 0);
    assert.ok(state.workers.every(w => w.task === 'idle'), 'natural depletion includes finished real depot deliveries');
    assert.ok(state.bank.food > initial.bank.food + 199.99, 'whole crop must actually reach the depot');
  }
  return plot;
}

export function validateFarmArt(observation, plotId, state) {
  const plot = observation.buildings.find(b => b.id === plotId), art = plot?.capture;
  assert.ok(art?.visible && art.decoded && art.state === state, 'actual default Farm state must decode and render');
  assert.equal(art.fallbackVisible, false); assert.equal(art.depthMatches, true); assert.equal(art.standardVisible, true);
  assert.equal(art.manifestPath, '/assets/buildings/frontier-economy-models-v1/farm-complete-renderer.json');
  assert.match(art.sha256, /^[a-f0-9]{64}$/);
}

export async function projectFarmGround(site) {
  const THREE = await import('/vendor/three.module.js');
  const { groundHeight } = await import('/src/terrain-height.mjs');
  const sample = window.__rtsTinyFarm.camera;
  if (!sample) return null;
  const camera = new THREE.OrthographicCamera(...sample.frustum, .1, 1000);
  camera.position.fromArray(sample.position); camera.quaternion.fromArray(sample.quaternion);
  camera.zoom = sample.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const canvas = document.querySelector('#viewport canvas'), rect = canvas.getBoundingClientRect();
  const p = new THREE.Vector3(site.x, groundHeight(site.x, site.z), site.z).project(camera);
  const point = { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  return p.z >= -1 && p.z <= 1 && document.elementFromPoint(point.x, point.y) === canvas ? point : null;
}

export async function enterTinyFarmRoom({ page, openPage, origin }, { click = clickControl } = {}) {
  const install = p => p.cdp.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${installFarmObserver.toString()})(${reduceFarmState.toString()},${reduceFarmOrder.toString()})`,
  });
  await install(page);
  assert.equal(await page.cdp.evaluate('location.href'), 'about:blank');
  await page.cdp.call('Page.navigate', { url: origin + '/' });
  await page.wait("document.documentElement.dataset.entry==='menu' && !document.querySelector('#menu-create-room')?.disabled", 'ordinary Create Room menu');
  await click(page, '#menu-create-room');
  await page.wait("document.querySelector('#room-lobby')?.open && !document.querySelector('#lobby-map')?.disabled", 'ordinary host lobby');
  assert.equal(await page.cdp.evaluate(`(()=>{const select=document.querySelector('#lobby-map');
    if(select.disabled||![...select.options].some(o=>o.value===${JSON.stringify(TINY_FARM_MAP)}&&!o.disabled))return false;
    select.value=${JSON.stringify(TINY_FARM_MAP)};select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`), true);
  await page.wait(`document.querySelector('#lobby-map')?.value===${JSON.stringify(TINY_FARM_MAP)} && !document.querySelector('#lobby-ready')?.disabled`, 'host Tiny selection accepted');
  assert.equal(await page.cdp.evaluate("document.querySelector('#lobby-match-mode').value"), 'skirmish@1');
  // The ordinary invite is used privately to admit the other human seat. Never
  // write this URL or capture the lobby carrying its invitation.
  const roomUrl = await page.cdp.evaluate('location.href');
  const guest = await openPage(); await install(guest);
  await guest.cdp.call('Page.navigate', { url: roomUrl });
  await guest.wait("document.querySelector('#room-lobby')?.open && !document.querySelector('#lobby-ready')?.disabled", 'ordinary second human seat');
  assert.equal(await page.cdp.evaluate('window.__rtsTinyFarm.team'), 0);
  assert.equal(await guest.cdp.evaluate('window.__rtsTinyFarm.team'), 1);
  await click(page, '#lobby-ready');
  await page.wait("document.querySelector('#lobby-ready')?.textContent==='Not ready'", 'host readiness accepted');
  await click(guest, '#lobby-ready');
  await page.wait("!document.querySelector('#lobby-launch')?.disabled", 'both human seats ready');
  await click(page, '#lobby-launch');
  const running = `!document.querySelector('#room-lobby')?.open && document.documentElement.dataset.boot==='ready'
    && ${wire}?.mapId===${JSON.stringify(TINY_FARM_MAP)} && ${environment}?.fogOfWar===true`;
  await Promise.all([page.wait(running, 'host ordinary Tiny match'), guest.wait(running, 'guest ordinary Tiny match')]);
  return [page, guest];
}

async function ownedSnapshot(page) {
  return page.cdp.evaluate(`(()=>{const state=${wire}, live=${environment};return { state,
    selected: window.__rtsBrowserRecoverySnapshot().selected,
    fogOfWar:live?.fogOfWar, zoom:live?.cameraZoom,
    buildings:live?.buildings.filter(b=>b.team===state.team && ['farm','mill'].includes(b.type)),
    replant: (()=>{const b=document.querySelector('[data-action="replantFarm"]');return b ? {visible:!b.hidden&&!!b.getClientRects().length,disabled:b.disabled,text:b.textContent} : null;})(),
    errors:window.__rtsQualification.errors,
    alternateEntry:['rendererCapture','play','workerSpritePreview','frontierBuildingsPreview','assetScenario','assetReadability'].some(k=>new URL(location.href).searchParams.has(k)),
  };})()`);
}

export async function runTinyFarmLifecycle(context, pages, { renew = runFarmRenewalCaptureStep, click = clickControl } = {}) {
  const { source, capture, evidenceDirectory } = context;
  const mapBytes = await readFile(new URL('../maps/veyrholds-terraced-vale.json', import.meta.url));
  const definition = JSON.parse(mapBytes);
  const report = { schemaVersion: 1, source, mapId: TINY_FARM_MAP, canonicalMapSha256: hash(mapBytes),
    status: 'failed', frames: [], seats: [], appearance: 'unreviewed',
    coldProcessRecovery: 'not-exposed-by-v1-capture-context', touch: 'not-captured' };
  const record = async (page, team, name, validate = () => {}) => {
    await page.cdp.call('Page.bringToFront');
    const before = await ownedSnapshot(page);
    validateFarmEconomy(before.state, team); validate(before);
    assert.equal(before.fogOfWar, true); assert.equal(before.alternateEntry, false);
    assert.deepEqual(before.errors, []);
    const frame = await page.cdp.evaluate('window.__rtsQualification.request().then(frame=>frame)');
    const canvas = Buffer.from(frame.canvasPng, 'base64'); delete frame.canvasPng;
    const receipt = await capture({ page, mapId: TINY_FARM_MAP, checkpoint: `team-${team}-${name}` });
    assert.equal(receipt.manifest.source.revision, source.revision);
    assert.equal(receipt.manifest.scene.mapId, TINY_FARM_MAP);
    assert.equal(receipt.manifest.scene.checkpoint, `team-${team}-${name}`);
    assert.equal(receipt.directory, path.join(evidenceDirectory, `team-${team}-${name}`));
    const png = await readFile(path.join(receipt.directory, receipt.manifest.image.file));
    assert.equal(hash(png), receipt.manifest.image.sha256);
    validateWorkCycleFrame(frame, png, canvas);
    const after = await ownedSnapshot(page); validateFarmEconomy(after.state, team); validate(after);
    assert.ok(after.state.tick >= before.state.tick); assert.deepEqual(after.errors, []);
    assert.equal(after.fogOfWar, true); assert.equal(after.alternateEntry, false);
    const previous = report.frames.filter(f => f.team === team).at(-1);
    if (previous) assert.ok(frame.number > previous.number && frame.time > previous.time, 'own-seat render identity must advance');
    await writeFile(path.join(receipt.directory, 'farm-canvas.png'), canvas, { flag: 'wx' });
    const evidence = { source, team, checkpoint: name, before, after, frame,
      image: receipt.manifest.image, canvas: { file: 'farm-canvas.png', sha256: hash(canvas) },
      correlation: 'readback and owned-seat observations bracket screenshot; not a same-frame authority claim' };
    await writeFile(path.join(receipt.directory, 'farm-state.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    report.frames.push({ team, checkpoint: name, number: frame.number, time: frame.time,
      image: receipt.manifest.image, canvasSha256: hash(canvas) });
  };
  const setup = async (page, team) => {
    const initial = validateFarmEconomy(await page.cdp.evaluate(wire), team);
    assert.deepEqual(initial.bank, { food: 150, wood: 250 });
    assert.deepEqual(initial.buildings, []); assert.ok(initial.workers.every(w => w.task === 'idle' && w.cargo === 0));
    const ids = initial.workers.map(w => w.id);
    await page.cdp.evaluate(`(async()=>{const THREE=await import('/vendor/three.module.js');(${installMinimapCameraProbe.toString()})(THREE,window.__rtsTinyFarm);return true;})()`);
    await click(page, '#camera-home-base');
    await page.wait('window.__rtsTinyFarm.cameraSamples>0', 'read-only native camera observation');
    await click(page, '#quick-idle');
    assert.deepEqual((await ownedSnapshot(page)).selected.slice().sort((a, b) => a - b), ids.slice().sort((a, b) => a - b));
    return { team, page, ids, initial, sites: tinyFarmSites(definition, team) };
  };
  const build = async (seat, type) => {
    const { page, team, ids, sites } = seat, before = await page.cdp.evaluate(wire);
    await click(page, '[data-worker-action="build"]');
    await click(page, `[data-worker-build="${type}"]`);
    const point = await page.cdp.evaluate(`(${projectFarmGround.toString()})(${JSON.stringify(sites[type])})`);
    await clickNovicePoint(page, point);
    await page.wait(`${wire}.buildings.some(b=>b.type===${JSON.stringify(type)}&&!b.complete)`, `paid ${type} foundation`, 10000);
    const building = validateFarmBuild(before, await page.cdp.evaluate(wire), { team, type, site: sites[type], ids });
    const order = await page.cdp.evaluate('window.__rtsTinyFarm.orders.at(-1)');
    assert.equal(order?.type, 'build'); assert.equal(order.buildingType, type);
    assert.deepEqual(order.ids.slice().sort((a, b) => a - b), ids.slice().sort((a, b) => a - b));
    await record(page, team, `${type}-paid-foundation`, observation => {
      assert.equal(observation.state.bank.wood, before.bank.wood - (type === 'farm' ? 60 : 75));
      assert.ok(observation.state.buildings.some(b => b.id === building.id));
    });
    return building;
  };
  try {
    // Real CDP input is sequential across pages; production work and bounded
    // waits overlap after both seats have received their ordinary paid orders.
    for (const [team, page] of pages.entries()) report.seats.push(await setup(page, team));
    for (const seat of report.seats) seat.mill = await build(seat, 'mill');
    await Promise.all(report.seats.map(seat => seat.page.wait(`${wire}.buildings.some(b=>b.id===${seat.mill.id}&&b.complete) && ${wire}.workers.every(w=>w.task==='idle')`, 'real Mill completion', 45000)));
    for (const seat of report.seats) seat.farm = await build(seat, 'farm');
    await Promise.all(report.seats.map(seat => seat.page.wait(`${wire}.buildings.some(b=>b.id===${seat.farm.id}&&b.complete&&b.harvestStock===200) && ${wire}.workers.every(w=>w.task==='idle')`, 'real Farm completion', 45000)));
    for (const seat of report.seats) {
      const { page, team, farm, initial, ids } = seat;
      await page.wait(`${environment}.buildings.find(b=>b.id===${farm.id})?.capture?.decoded`, 'admitted completed Farm art');
      await record(page, team, 'farm-complete', o => {
        validateFarmSupply(initial, o.state, farm.id, { team }); validateFarmArt(o, farm.id, 'complete');
      });
      await click(page, '[data-worker-action="gather"]');
      const plot = (await ownedSnapshot(page)).buildings.find(b => b.id === farm.id);
      await clickNovicePoint(page, plot.screen);
      await page.wait(`window.__rtsTinyFarm.orders.at(-1)?.type==='gather' && window.__rtsTinyFarm.orders.at(-1).nodeId===${JSON.stringify('farm:' + farm.id)}`, 'actual pointer Farm Gather');
      const order = await page.cdp.evaluate('window.__rtsTinyFarm.orders.at(-1)');
      assert.deepEqual(order.ids.slice().sort((a, b) => a - b), ids.slice().sort((a, b) => a - b));
    }
    await Promise.all(report.seats.map(seat => seat.page.wait(`${wire}.buildings.find(b=>b.id===${seat.farm.id})?.harvestStock===0 && ${wire}.workers.every(w=>w.task==='idle'&&w.cargo===0)`, 'natural two hundred Food depletion and depot deliveries', 90000)));
    for (const seat of report.seats) {
      seat.depleted = await seat.page.cdp.evaluate(wire);
      validateFarmSupply(seat.initial, seat.depleted, seat.farm.id, { team: seat.team, exhausted: true });
      await seat.page.wait(`${environment}.buildings.find(b=>b.id===${seat.farm.id})?.capture?.state==='exhausted' && ${environment}.buildings.find(b=>b.id===${seat.farm.id})?.capture?.decoded`, 'admitted exhausted Farm art');
      await record(seat.page, seat.team, 'farm-exhausted', o => {
        validateFarmSupply(seat.initial, o.state, seat.farm.id, { team: seat.team, exhausted: true });
        validateFarmArt(o, seat.farm.id, 'exhausted');
      });
    }
    // Start both real Replant orders before waiting for either renewed delivery.
    await Promise.all(report.seats.map(async seat => {
      const { page, team, ids, farm } = seat;
      seat.renewal = await renew({ page, team, plotId: farm.id, workerIds: ids,
        capture: async name => record(page, team, name, o => {
          if (name === 'farm-renewal-selected') {
            assert.equal(o.replant?.visible, true); assert.equal(o.replant.disabled, false);
            assert.equal(o.replant.text, 'Replant · 60 wood');
          }
        }) }, { click: (p, selector) => click(p, selector === '[data-context-proxy="select-idle-workers"]' ? '#quick-idle' : selector) });
      seat.final = await page.cdp.evaluate(wire);
      validateFarmSupply(seat.depleted, seat.final, seat.renewal.newPlotId, { team });
      assert.equal(seat.final.bank.wood, 55, '75 Mill + 60 Farm + 60 renewal spend exactly 195 opening wood');
      assert.ok(seat.final.dropoffs.some(d => d.id === seat.mill.id && d.type === 'mill'), 'real owned Mill remains a Food depot');
      const orders = await page.cdp.evaluate('({orders:window.__rtsTinyFarm.orders,dropped:window.__rtsTinyFarm.droppedOrders})');
      assert.equal(orders.dropped, 0);
      assert.deepEqual(orders.orders.map(o => o.type), ['build', 'build', 'gather', 'replantFarm'], 'no hidden commands or duplicate spend');
      assert.equal(orders.orders[3].buildingId, farm.id);
      assert.deepEqual(orders.orders[3].ids.slice().sort((a, b) => a - b), ids.slice().sort((a, b) => a - b));
      seat.orders = orders.orders;
    }));
    for (const seat of report.seats) {
      const point = (await ownedSnapshot(seat.page)).buildings.find(b => b.id === seat.renewal.newPlotId).screen;
      await seat.page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY: 420 });
      await seat.page.wait(`${environment}.cameraZoom<0.8`, 'ordinary strategic wheel zoom');
      await record(seat.page, seat.team, 'renewed-strategic', o => validateFarmSupply(seat.depleted, o.state, seat.renewal.newPlotId, { team: seat.team }));
    }
    report.status = 'captured-needs-review';
  } finally {
    // Pages/room invitations are deliberately excluded from retained owner data.
    const safe = { ...report, seats: report.seats.map(({ page, ...seat }) => seat) };
    await writeFile(path.join(evidenceDirectory, 'tiny-farm.json'), JSON.stringify(safe, null, 2) + '\n', { flag: 'wx' });
  }
  return report;
}

export async function run(value, { identify = checkServedBuildIdentity, enter = enterTinyFarmRoom, execute = runTinyFarmLifecycle } = {}) {
  const context = validateCaptureContext(value), { origin, source } = context;
  const identity = await identify(origin, { sourceRevision: source.revision, digest: source.digest });
  assert.equal(identity.ok, true, 'served source and pack must match'); assert.equal(identity.served.sourceDirty, false);
  const pages = await enter(context);
  assert.equal(pages.length, 2); assert.equal(pages[0], context.page); assert.notEqual(pages[0], pages[1]);
  const result = await execute(context, pages);
  assert.equal(result.status, 'captured-needs-review');
  assert.equal(result.appearance, 'unreviewed');
  assert.deepEqual(result.seats.map(s => s.team), [0, 1]);
  for (const team of [0, 1]) assert.deepEqual(result.frames.filter(f => f.team === team).map(f => f.checkpoint), [
    'mill-paid-foundation', 'farm-paid-foundation', 'farm-complete', 'farm-exhausted',
    'farm-renewal-selected', 'farm-renewal-foundation', 'farm-renewal-first-delivery', 'renewed-strategic',
  ], 'both seats require all eight source-bound checkpoint receipts');
  return { status: 'passed', checks: ['normal-tiny-two-human-seats', 'paid-mill-and-farm-pointer-build',
    'farm-pointer-gather-natural-depletion', 'selected-worker-explicit-paid-replant', 'renewed-crop-bank-cargo-conservation',
    'two-seat-source-bound-ordinary-strategic-captures'].map(id => ({ id, passed: true })) };
}
