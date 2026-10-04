// Owned ordinary work-loop adapter; the shared runner owns browser/server/files.
import assert from 'node:assert/strict';
import { forestGatherGroups } from '../src/forest-gather-group.mjs';

export const id = 'forest-jobs';
export const contextVersion = 1;
const MAP_ID = 'veyrholds-terraced-vale';

// Retain only this seat's disclosed observations. No socket/token/raw envelope.
export function projectForestJobState(message, team) {
  const state = message?.state ?? message;
  if (![0, 1].includes(team) || state?.mapId !== 'veyrholds-terraced-vale'
    || !Number.isInteger(state.tick) || !Array.isArray(state.units)) return null;
  const visibility = state.visibility;
  const packed = visibility?.data ? Uint8Array.from(atob(visibility.data), c => c.charCodeAt(0)) : null;
  const disclosed = cell => packed ? packed[cell >> 2] >> ((cell & 3) * 2) & 3 : 2;
  return { tick: state.tick, team, wood: state.wood?.[team], visibility,
    otherBankPrivate: state.wood?.[1 - team] === null,
    foreignWorkers: state.units.filter(row => row[1] !== team && row[5] === 'worker').length,
    stocksPrivate: (state.forestStocks || []).every(([cell]) => disclosed(cell) === 2),
    workers: state.units.filter(row => row[1] === team && row[5] === 'worker' && row[4] > 0)
      .map(row => ({ id: row[0], generation: row[8], x: row[2], z: row[3], cargo: row[6],
        cargoType: row[7], task: row[9], action: row[17] })) };
}

export function observeForestJobCycle(progress, state) {
  if (!progress || !state) return;
  progress.private &&= state.otherBankPrivate && state.foreignWorkers === 0 && state.stocksPrivate;
  for (const entry of progress.workers) {
    const worker = state.workers.find(row => row.id === entry.id);
    if (!worker || worker.generation !== entry.generation || !Number.isFinite(worker.cargo)
      || worker.cargo < 0 || worker.cargo > 10 || (worker.cargo > 0 && worker.cargoType !== 'wood')) {
      progress.valid = false; continue;
    }
    if (worker.action === 'gather-wood' && worker.cargo > 0) entry.harvest = true;
    if (worker.task === 'returning' && worker.cargo > 0) entry.returned = true;
    if (entry.lastCargo > 0 && worker.cargo === 0) {
      if (!(state.wood > progress.lastWood)) progress.valid = false;
      entry.deposits++;
    }
    if (entry.deposits > 0 && worker.action === 'gather-wood' && worker.cargo > 0) entry.resumed = true;
    entry.lastCargo = worker.cargo;
  }
  progress.lastWood = state.wood;
}

function installProbe(project, observe) {
  const probe = window.__forestJobCapture = { team: null, latest: null, progress: null, samples: 0, overflow: false };
  const NativeSocket = window.WebSocket;
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome') probe.team = message.player?.team;
        if (!['welcome', 'mapChange', 'state'].includes(message.type)) return;
        const state = project(message, probe.team); if (!state) return;
        probe.latest = state;
        if (!probe.progress) return;
        if (++probe.samples > 2400) { probe.overflow = true; return; }
        observe(probe.progress, state);
      });
    }
  };
}

const point = (cell, map) => ({ x: cell % map.width - map.width / 2 + .5,
  z: Math.floor(cell / map.width) - map.height / 2 + .5 });
export function planForestApproach(map, worker) {
  const forest = new Uint8Array(map.width * map.height), blocked = new Uint8Array(forest.length);
  for (const obstacle of map.obstacles) for (let row = obstacle.row; row < obstacle.row + obstacle.height; row++) {
    for (let col = obstacle.column; col < obstacle.column + obstacle.width; col++) {
      const cell = row * map.width + col; blocked[cell] = 1;
      if (obstacle.material === 'forest') forest[cell] = 1;
    }
  }
  const groups = forestGatherGroups(forest, map.width), choices = [];
  for (let cell = 0; cell < forest.length; cell++) {
    if (!forest[cell]) continue;
    const col = cell % map.width, row = Math.floor(cell / map.width);
    for (const access of [col > 0 ? cell - 1 : -1, col + 1 < map.width ? cell + 1 : -1,
      row > 0 ? cell - map.width : -1, row + 1 < map.height ? cell + map.width : -1]) {
      if (access < 0 || blocked[access]) continue;
      const target = point(access, map);
      choices.push({ cell, target, distance: Math.hypot(target.x - worker.x, target.z - worker.z) });
    }
  }
  choices.sort((a, b) => a.distance - b.distance || a.cell - b.cell);
  assert.ok(choices.length, 'authored forest approach required');
  return { ...choices[0], cells: groups.groups[groups.byCell[choices[0].cell]] };
}

async function click(page, selector) {
  await page.wait(`document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`, 'ordinary enabled control', 15000);
  await page.cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function choose(page, selector, value) {
  if (await page.cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`)) return;
  await page.wait(`document.querySelector(${JSON.stringify(selector)})?.querySelector('option[value="${value}"]') && !document.querySelector(${JSON.stringify(selector)}).disabled`, 'ordinary lobby choice', 15000);
  await page.cdp.evaluate(`(() => {const select=document.querySelector(${JSON.stringify(selector)});select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await page.wait(`document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)} && !document.querySelector(${JSON.stringify(selector)}).disabled`, 'acknowledged lobby choice', 15000);
}
async function command(page, value) {
  assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(value)})`), true,
    'native order must use the production client connection');
}

/** @param {import('./renderer-capture-context.mjs').CaptureContext} context */
export async function run(context) {
  const pages = [context.page, await context.openPage()];
  const bootstrap = `(${installProbe.toString()})(${projectForestJobState.toString()},${observeForestJobCycle.toString()})`;
  for (const page of pages) await page.cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap });
  await pages[0].cdp.call('Page.navigate', { url: `${context.origin}/` });
  await click(pages[0], '#menu-create-room');
  await pages[0].wait("document.querySelector('#room-lobby')?.open", 'normal PvP pregame', 20000);
  await choose(pages[0], '#lobby-map', MAP_ID);
  await choose(pages[0], '#lobby-match-mode', 'skirmish@1');
  const roomUrl = await pages[0].cdp.evaluate('location.href');
  assert.equal(new URL(roomUrl).origin, context.origin);
  await pages[1].cdp.call('Page.navigate', { url: roomUrl });
  await pages[1].wait("document.querySelector('#room-lobby')?.open", 'normal second seat', 20000);
  await click(pages[0], '#lobby-ready'); await click(pages[1], '#lobby-ready');
  await click(pages[0], '#lobby-launch');
  const initial = await Promise.all(pages.map(page => page.wait("window.__rtsEnvironmentAssetStatus?.ready && window.__forestJobCapture?.latest && !document.querySelector('#room-lobby')?.open && window.__forestJobCapture.latest", 'ordinary Tiny match boot', 30000)));
  assert.deepEqual(initial.map(state => state.team), [0, 1]);
  const map = await pages[0].cdp.evaluate(`fetch('/maps/${MAP_ID}.json').then(response => response.json())`);
  assert.equal(map.width, 160); assert.equal(map.height, 160); assert.equal(map.fogOfWar, true);
  const plans = initial.map(state => planForestApproach(map, state.workers[0]));
  const ids = initial.map(state => state.workers.slice(0, 2).map(worker => worker.id));
  for (let team = 0; team < 2; team++) {
    assert.equal(ids[team].length, 2);
    await click(pages[team], '#camera-home-base');
    await context.capture({ page: pages[team], mapId: MAP_ID, checkpoint: `seat-${team}-before-forest` });
    await command(pages[team], { type: 'move', ids: ids[team], ...plans[team].target });
  }
  for (let team = 0; team < 2; team++) {
    await pages[team].wait(`window.__forestJobCapture.latest.workers.filter(w=>${JSON.stringify(ids[team])}.includes(w.id)).every(w=>Math.hypot(w.x-${plans[team].target.x},w.z-${plans[team].target.z})<2)`, 'natural forest approach', 25000);
    const state = await pages[team].cdp.evaluate('window.__forestJobCapture.latest');
    const packed = Buffer.from(state.visibility.data, 'base64');
    const worker = state.workers.find(row => row.id === ids[team][0]);
    // Pick a deep authored anchor without inspecting that cell's live stock.
    const anchor = [...plans[team].cells].sort((a, b) => {
      const pa = point(a, map), pb = point(b, map);
      return Math.hypot(pb.x - worker.x, pb.z - worker.z) - Math.hypot(pa.x - worker.x, pa.z - worker.z) || a - b;
    }).find(cell => ((packed[cell >> 2] >> ((cell & 3) * 2)) & 3) === 1);
    assert.ok(Number.isInteger(anchor), 'deep group anchor must be remembered scenery outside current vision');
    const progress = { valid: true, private: true, lastWood: state.wood,
      workers: state.workers.filter(row => ids[team].includes(row.id)).map(row => ({ id: row.id,
        generation: row.generation, lastCargo: row.cargo, deposits: 0, harvest: false, returned: false, resumed: false })) };
    await pages[team].cdp.evaluate(`window.__forestJobCapture.progress=${JSON.stringify(progress)}`);
    await command(pages[team], { type: 'gather', ids: ids[team], forestCell: anchor });
  }
  const checks = [];
  await Promise.all(pages.map(async (page, team) => {
    await page.wait('window.__forestJobCapture.progress.workers.every(w=>w.harvest)', 'actual forest harvest', 25000);
    await context.capture({ page, mapId: MAP_ID, checkpoint: `seat-${team}-forest-harvest` });
    await page.wait('window.__forestJobCapture.progress.workers.every(w=>w.returned)', 'actual loaded return', 30000);
    await context.capture({ page, mapId: MAP_ID, checkpoint: `seat-${team}-loaded-return` });
    await page.wait('window.__forestJobCapture.progress.workers.every(w=>w.resumed)', 'harvest after first deposit', 35000);
    await context.capture({ page, mapId: MAP_ID, checkpoint: `seat-${team}-deposit-resume` });
    await page.wait('window.__forestJobCapture.progress.workers.every(w=>w.deposits>=3)', 'three deliveries per selected Worker', 65000);
    const result = await page.cdp.evaluate('({progress:window.__forestJobCapture.progress,overflow:window.__forestJobCapture.overflow})');
    checks.push({ id: `seat-${team}-three-deliveries-each`, passed: result.progress.valid && !result.overflow
      && result.progress.workers.every(worker => worker.deposits >= 3 && worker.resumed) },
    { id: `seat-${team}-fog-privacy`, passed: result.progress.private });
    await context.capture({ page, mapId: MAP_ID, checkpoint: `seat-${team}-repeated-forest-cycles` });
  }));
  checks.sort((a, b) => a.id.localeCompare(b.id));
  return { status: checks.every(check => check.passed) ? 'passed' : 'failed', checks };
}
