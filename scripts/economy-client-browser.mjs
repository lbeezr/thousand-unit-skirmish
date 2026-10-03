// Owner-run browser surfaces proof. Empty-node Stone map proves UI readiness, not natural harvest.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';
import { STONE_ECONOMY_PROFILE_ID as STONE } from '../src/economy-profile.mjs';
import { checkClientImports } from './check-client-imports.mjs';

const arg = process.argv[2]; assert.match(arg ?? '', /^--output=.+$/);
const output = path.resolve(arg.slice(9)); await mkdir(output);
const room = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
const records = []; let browser;
const instrument = `(${function () {
  const NativeSocket = WebSocket;
  const capture = window.__economySurfaceProof = { team: null, latest: null };
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args); capture.socket = this; this.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') capture.team = message.player.team;
        if (['welcome', 'mapChange', 'state'].includes(message.type)) capture.latest = message.state ?? message;
      });
    }
  };
}.toString()})()`;
const map = { id: 'stone-client-surfaces-proof', name: 'Stone client surfaces proof', width: 64, height: 64,
    terrainSeed: 19, fogOfWar: true, startingArmySize: 24, economyProfileId: STONE,
    startingResources: { food: 300, wood: 600 }, spawnPoints: [{ team: 0, x: -20, z: 0 }, { team: 1, x: 20, z: 0 }],
    obstacles: [], resourceNodes: [], triggers: [], scenarioEvents: [] };
try {
  await room.start(); const host = await room.connect(0), token = host.welcome.player.sessionToken;
  const imports = await checkClientImports(`http://127.0.0.1:${room.port}`);
  const after = host.messages.length;
  host.send({ type: 'publishMap', map: { ...map, id: 'baseline-client-surfaces-proof', economyProfileId: undefined } });
  await host.wait(message => message.type === 'mapChange' && message.state.mapId === 'baseline-client-surfaces-proof', 'baseline bounded map', after);
  const closed = new Promise(resolve => host.socket.addEventListener('close', resolve, { once: true }));
  host.socket.close(); await closed; browser = await createFortifiedBrowser();
  const pages = [];
  for (const team of [0, 1]) {
    const page = await browser.page(`http://127.0.0.1:${room.port}/?play=1`, { beforeScript: instrument
      + (team === 0 ? `;sessionStorage.setItem('thousand-unit-skirmish-session:default',${JSON.stringify(token)});` : '') });
    pages.push(page);
    await page.wait(`document.documentElement?.dataset.boot==='ready'&&__economySurfaceProof.team===${team}`, 'baseline game boot');
    assert.equal(await page.cdp.evaluate("getComputedStyle(document.querySelector('#stone-stock-group')).display"), 'none');
  }
  await pages[0].cdp.evaluate(`__economySurfaceProof.socket.send(JSON.stringify({type:'publishMap',map:${JSON.stringify(map)}}))`);
  for (const [team, page] of pages.entries()) {
    await page.wait(`__economySurfaceProof.latest?.mapId===${JSON.stringify(map.id)}&&document.querySelector('#stone-stock').textContent==='0'`, 'Stone profile view');
    await page.cdp.evaluate("document.querySelector('#select-workers').click()");
    await page.wait("document.querySelector('[data-building=watchtower]')?.textContent.includes('50 STONE')", 'typed Watchtower cost');
    for (const width of [1280, 390]) {
      await page.cdp.call('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor: 1, mobile: width === 390 });
      const view = await page.cdp.evaluate(`(()=>{const stock=document.querySelector('#stone-stock-group'),tower=document.querySelector('[data-building=watchtower]'),r=stock.getBoundingClientRect();return {team:__economySurfaceProof.team,stone:getComputedStyle(stock).display,stock:document.querySelector('#stone-stock').textContent,tower:tower.textContent,disabled:tower.disabled,left:r.left,right:r.right,width:innerWidth,runtimeError:document.querySelector('#runtime-error')?.textContent||''}})()`);
      assert.equal(view.team, team); assert.notEqual(view.stone, 'none'); assert.equal(view.stock, '0');
      assert.match(view.tower, /150 WOOD \+ 50 FOOD \+ 50 STONE/); assert.equal(view.disabled, true);
      assert.ok(view.left >= 0 && view.right <= view.width); assert.equal(view.runtimeError, '');
      const screenshot = await page.cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(path.join(output, `seat-${team}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      records.push({ ...view, viewportWidth: width });
    }
    assert.deepEqual(page.errors, []);
  }
  await writeFile(path.join(output, 'checks.json'), JSON.stringify({ sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '', browser: browser.version,
    imports: imports.length, records, status: 'passed', naturalHarvest: false }, null, 2));
  console.log(JSON.stringify({ status: 'passed', imports: imports.length, records: records.length, output }));
} finally { await browser?.dispose(); await room.dispose(); }
