// Owner-run live HUD proof. Output contains sanitized UI evidence, never checkpoint/session bytes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { ownedPopulationReadout } from '../src/population-readout.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !arg.startsWith('--output=') || arg === '--output=')) {
  throw Error('Usage: node scripts/population-hud-browser.mjs [--output=NEW_DIRECTORY]');
}
const output = args.length ? path.resolve(args[0].slice('--output='.length)) : null;
if (output) await mkdir(output); // Refuse to overwrite a previous evidence run.
const fixture = await createFortifiedFixture({ mapPath: 'maps/bellweather-millrace.json', timeoutMs: 70_000 });
const map = { id: 'population-hud-audit', name: 'Population HUD Audit', width: 64, height: 64,
  terrainSeed: 19, fogOfWar: false, startingArmySize: 24, startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
  obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
const records = [], layouts = [], checks = [], pages = [];
let browser, proofFailure = null;
const instrument = `(${function () {
  const NativeSocket = window.WebSocket;
  window.__populationHud = { team: null, latest: null, welcomes: 0, recovered: false };
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args); window.__populationHudSocket = this;
      this.addEventListener('message', event => {
        const message = JSON.parse(event.data), capture = window.__populationHud;
        if (message.type === 'welcome') {
          capture.team = message.player.team; capture.welcomes++;
          capture.recovered = message.recoveredFromCheckpoint === true;
        }
        if (['welcome', 'mapChange', 'state'].includes(message.type)) {
          const state = message.type === 'state' ? message : message.state;
          capture.latest = { mapId: state.mapId, connected: state.connected, population: state.population, buildings: state.buildings,
            units: state.units.map(row => ({ id: row[0], team: row[1], hp: row[4], kind: row[5] })) };
        }
      });
    }
  };
}.toString()})()`;

async function read(page) {
  return page.cdp.evaluate(`({team:window.__populationHud.team,population:window.__populationHud.latest.population,
    welcomes:window.__populationHud.welcomes,recovered:window.__populationHud.recovered,
    head:document.querySelector('#population-stock').textContent,
    detail:document.querySelector('#population-status').textContent,
    description:document.querySelector('#population-readout').getAttribute('aria-label'),
    selected:Number(document.querySelector('#selected-total').textContent),
    drawerHidden:document.querySelector('#command-deck').hidden})`);
}
async function verify(page, label) {
  assert.deepEqual(page.errors, [], `${label}: no client exceptions`);
  const view = await read(page), expected = ownedPopulationReadout(view.population, view.team);
  assert.equal(view.head, expected.compact, label);
  assert.equal(view.detail, expected.detail, label);
  assert.equal(view.description, expected.description, label);
  if (view.team === 0 || view.team === 1) assert.equal(view.population[1 - view.team], null, 'enemy population masked');
  records.push({ label, ...view }); checks.push(label);
}
async function send(page, command) {
  await page.cdp.evaluate(`window.__populationHudSocket.send(JSON.stringify(${JSON.stringify(command)}))`);
}
async function click(page, selector) {
  await page.cdp.call('Page.bringToFront');
  const point = await page.cdp.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(e.disabled||hit?.closest('button')!==e)throw Error('Control '+${JSON.stringify(selector)}+' disabled='+e.disabled+', hit='+hit?.tagName+'#'+hit?.id+'.'+hit?.className+', point='+x+','+y);return [x,y]})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', { type, x: point[0], y: point[1], button: 'left', clickCount: 1 });
}
async function escape(page) {
  for (const type of ['keyDown', 'keyUp']) await page.cdp.call('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
}
const rect = element => {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};
async function layout(page, width, height) {
  await page.cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await page.wait(`Math.abs(parseFloat(document.querySelector('.app-shell').style.getPropertyValue('--hud-header-height'))-document.querySelector('.topbar').getBoundingClientRect().height)<0.5`, 'header resize observed');
  const view = await page.cdp.evaluate(`(()=>{const rect=${rect.toString()},header=document.querySelector('.topbar'),population=document.querySelector('#population-readout'),stock=document.querySelector('#population-stock');
    const measure=()=>({header:rect(header),population:rect(population),objective:rect(document.querySelector('.map-label')),stock:rect(stock),stockFits:stock.scrollWidth<=stock.clientWidth});
    const ordinary=measure();
    // Compare the former FIELD slot in the same current DOM; this is not a separate old-build capture.
    const former=document.createElement('div');former.className='field-strength';former.innerHTML='<span>FIELD</span><div><i class="team-dot blue-dot"></i><b>12</b><span>:</span><b>12</b><i class="team-dot red-dot"></i></div>';
    population.replaceWith(former);const formerHeader=rect(header);former.replaceWith(population);
    const original=stock.textContent;stock.textContent='1000+999/1000';const long=measure();
    population.style.fontSize='24px';const enlarged=measure();population.style.removeProperty('font-size');stock.textContent=original;
    return {viewport:[innerWidth,innerHeight],ordinary,formerHeader,long,enlarged};})()`);
  assert.ok(view.ordinary.header.height <= view.formerHeader.height + 0.5, 'no permanent header height increase');
  for (const state of [view.ordinary, view.long, view.enlarged]) {
    assert.ok(state.population.width > 0 && state.population.height > 0, 'population remains visible');
    assert.ok(state.stockFits, 'population label fits');
    assert.ok(state.population.left >= -0.5 && state.population.right <= width + 0.5, 'population inside viewport');
    assert.ok(state.population.bottom <= state.header.bottom + 0.5, 'population inside header');
  }
  assert.ok(view.ordinary.objective.top >= view.ordinary.header.bottom, 'objective follows measured header');
  layouts.push(view); checks.push(`layout ${width}x${height}, long values and 200% population text`);
  if (output) {
    const capture = await page.cdp.call('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `seat-0-${width}x${height}.png`), Buffer.from(capture.data, 'base64'));
  }
}

try {
  await fixture.start();
  // Publish the small fixture before rendering any client; retain the host token privately.
  const host = await fixture.connect(0), hostToken = host.welcome.player.sessionToken;
  const after = host.messages.length;
  host.send({ type: 'publishMap', map });
  await host.wait(message => message.type === 'mapChange' && message.state.mapId === map.id, 'small HUD map published', after);
  const hostClosed = new Promise(resolve => host.socket.addEventListener('close', resolve, { once: true }));
  host.socket.close(); await hostClosed;
  browser = await createFortifiedBrowser();
  for (const team of [0, 1]) {
    const beforeScript = instrument + (team === 0 ? `;sessionStorage.setItem('thousand-unit-skirmish-session:default',${JSON.stringify(hostToken)});` : '');
    const page = await browser.page(`http://127.0.0.1:${fixture.port}/`, { beforeScript }); pages.push(page);
    await page.wait(`document.documentElement?.dataset.boot==='ready'&&window.__populationHud?.latest?.population`, 'live population snapshot', 40_000);
    assert.equal((await read(page)).team, team); await verify(page, `welcome ${team ?? 'spectator'}`);
    console.log(JSON.stringify({ stage: 'browser joined', team }));
  }
  const [azure, ember] = pages;
  for (const page of pages) {
    await page.wait(`window.__populationHud.latest.mapId==='population-hud-audit'`, 'published no-fog fixture');
    await verify(page, `no-fog fixture ${(await read(page)).team ?? 'spectator'}`);
  }
  for (const page of [azure, ember]) {
    await click(page, '.contextual-command-bar [data-context-proxy="select-idle-workers"]');
    await page.wait(`document.querySelector('#selected-total').textContent==='4'`, 'Idle Worker selection');
    const selectedBefore = (await read(page)).selected;
    assert.equal(selectedBefore, 4, 'native Idle selects the four Workers');
    await click(page, '.contextual-command-bar [data-context-panel="economy"]:not([data-context-build])');
    await page.wait(`!document.querySelector('#command-deck').hidden`, 'production opens');
    await click(page, '#train-worker');
    await page.wait(`window.__populationHud.latest.population[window.__populationHud.team]?.reserved===1`, 'Worker reservation');
    await verify(page, `live Worker queue seat ${(await read(page)).team}`);
    await click(page, '#cancel-worker-training');
    await page.wait(`window.__populationHud.latest.population[window.__populationHud.team]?.reserved===0`, 'Worker cancellation');
    await escape(page);
    await page.wait(`document.querySelector('#command-deck').hidden&&document.activeElement.matches('.contextual-command-bar [data-context-panel="economy"]:not([data-context-build])')`, 'Escape returns to Production');
    assert.equal((await read(page)).selected, selectedBefore, 'Escape retains selected Workers');
    await verify(page, `canceled queue, closed drawer seat ${(await read(page)).team}`);
  }
  checks.push('native Production/train/Escape retains selection and opener focus for both seats');
  await click(azure, '#minimap-hide');
  await azure.wait(`document.querySelector('.minimap-panel').hidden&&document.activeElement.id==='minimap-reopen'`, 'Map hidden');
  await click(azure, '#minimap-reopen');
  await azure.wait(`!document.querySelector('.minimap-panel').hidden&&document.activeElement.id==='minimap-size-toggle'`, 'Map reopened');
  checks.push('native Map hide/reopen focus unchanged');
  for (const [width, height] of [[1280,800],[1024,640],[620,640]]) await layout(azure, width, height);
  const ax = await azure.cdp.call('Accessibility.getFullAXTree');
  const currentDescription = (await read(azure)).description;
  assert.ok(ax.nodes.some(node => node.role?.value === 'status' && node.name?.value === currentDescription), 'named population status in accessibility tree');
  checks.push('population accessible status name');
  console.log(JSON.stringify({ stage: 'native controls, layout and accessibility passed' }));
  for (const page of [azure, ember]) {
    await page.cdp.evaluate(`(()=>{const c=window.__populationHud;window.__populationHudSocket.send(JSON.stringify({type:'build',ids:c.latest.units.filter(u=>u.team===c.team&&u.kind==='worker'&&u.hp>0).map(u=>u.id),buildingType:'stable',x:c.team===0?-14.5:14.5,z:8.5}));})()`);
  }
  for (const page of [azure, ember]) {
    await page.wait(`window.__populationHud.latest.buildings.some(b=>b.team===window.__populationHud.team&&b.type==='stable'&&b.complete)`, 'paid Stable completes', 70_000);
    await page.cdp.evaluate(`(()=>{const c=window.__populationHud,b=c.latest.buildings.find(b=>b.team===c.team&&b.type==='stable');window.__populationHudSocket.send(JSON.stringify({type:'trainUnit',kind:'rider',buildingId:b.id}));})()`);
    await page.wait(`window.__populationHud.latest.population[window.__populationHud.team]?.reserved===2`, 'weighted Rider reservation');
    await verify(page, `paid Rider reservation seat ${(await read(page)).team}`);
  }
  const priorWelcomes = await Promise.all([azure, ember].map(async page => (await read(page)).welcomes));
  console.log(JSON.stringify({ stage: 'paid weighted Rider queues, restarting checkpoint' }));
  await fixture.stop(); await fixture.start();
  for (const [index, page] of [azure, ember].entries()) {
    await page.wait(`window.__populationHud.welcomes>${priorWelcomes[index]}&&window.__populationHud.recovered`, 'browser resumes checkpoint', 40_000);
    await verify(page, `checkpoint resumed seat ${index}`);
    await page.wait(`window.__populationHud.latest.population[window.__populationHud.team]?.used===14&&window.__populationHud.latest.population[window.__populationHud.team]?.reserved===0`, 'Rider spawned', 40_000);
    await verify(page, `Rider uses two slots after spawn seat ${index}`);
  }
  await send(azure, { type: 'reset' });
  for (const [index, page] of [azure, ember].entries()) {
    await page.wait(`window.__populationHud.latest.population[window.__populationHud.team]?.used===12&&window.__populationHud.latest.population[window.__populationHud.team]?.reserved===0&&window.__populationHud.latest.buildings.length===0`, 'host reset');
    await verify(page, `host reset clears prior population seat ${index}`);
  }
  // Keep at most two rendered clients alive; use a socket-only owner while inspecting spectators.
  await azure.dispose();
  await ember.wait(`window.__populationHud.latest.connected===1`, 'Azure browser closed');
  await fixture.connect(0, hostToken);
  const spectator = await browser.page(`http://127.0.0.1:${fixture.port}/`, { beforeScript: instrument });
  pages.push(spectator);
  await spectator.wait(`document.documentElement?.dataset.boot==='ready'&&window.__populationHud?.latest?.population`, 'spectator snapshot', 40_000);
  assert.equal((await read(spectator)).team, null);
  assert.ok((await read(spectator)).population.every(Boolean), 'spectator receives both records');
  await verify(spectator, 'spectator hides full owned records');
  assert.deepEqual(pages.flatMap(page => page.errors), []);
  const result = { complete: true, browser: browser.version,
    method: 'live authoritative no-fog Population HUD Audit map published from Bellweather Millrace; real paid Worker/Rider commands, cancellation, checkpoint restart and host reset; owned Chromium DPR 1', checks, records, layouts, errors: [] };
  if (output) await writeFile(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ complete: true, checks: checks.length, records: records.length, layouts: layouts.length, output }));
} catch (error) {
  proofFailure = error;
  if (output && pages.length) {
    try {
      const capture = await pages[0].cdp.call('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, 'failure-screen.png'), Buffer.from(capture.data, 'base64'));
    } catch {}
  }
  if (output) await writeFile(path.join(output, 'failure.json'), JSON.stringify({ complete: false, error: error.message, errors: pages.flatMap(page => page.errors), checks, records, layouts }, null, 2) + '\n');
  throw error;
} finally {
  const cleanups = await Promise.allSettled([
    browser ? browser.dispose().catch(error => {
      if (error.code === 'ENOTEMPTY') return browser.dispose();
      throw error;
    }) : Promise.resolve(),
    fixture.dispose(),
  ]);
  const failures = cleanups.filter(result => result.status === 'rejected');
  if (failures.length && !proofFailure) throw new AggregateError(failures.map(result => result.reason), 'Owned HUD proof cleanup failed');
}
