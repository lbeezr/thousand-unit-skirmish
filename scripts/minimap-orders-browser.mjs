// Native two-seat pointer proof. Uses disposable profiles/worker; never records session tokens.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createFortifiedBrowser } from './fortified-browser-fixture.mjs';

const args = process.argv.slice(2);
if (args.length !== 1 || !/^--output=.+$/.test(args[0])) throw Error('Usage: node scripts/minimap-orders-browser.mjs --output=NEW_DIRECTORY');
const output = path.resolve(args[0].slice('--output='.length));
await mkdir(output); // Preserve earlier evidence; refuse an existing output folder.
const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30_000 });
const map = { id: 'minimap-browser-proof', name: 'Minimap Browser Proof', width: 160, height: 96,
  fogOfWar: true, terrainSeed: 19, startingArmySize: 24,
  startingResources: { food: 1000, wood: 1000 },
  spawnPoints: [{ team: 0, x: -50, z: -10 }, { team: 1, x: 50, z: -10 }],
  obstacles: [{ type: 'stone', column: 29, row: 77, width: 3, height: 3 },
    { type: 'stone', column: 129, row: 77, width: 3, height: 3 }],
  resourceNodes: [], triggers: [], scenarioEvents: [] };
const instrument = `(${function () {
  const NativeSocket = window.WebSocket;
  const capture = window.__minimapProof = { team: null, latest: null, sent: [], cameraOutline: null };
  window.WebSocket = class extends NativeSocket {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        const m = JSON.parse(event.data);
        if (m.type === 'welcome') capture.team = m.player.team;
        if (['welcome', 'state', 'mapChange'].includes(m.type)) capture.latest = m.type === 'state' ? m : m.state;
      });
    }
    send(data) {
      const command = JSON.parse(data);
      if (['move', 'attackMove', 'patrol', 'follow', 'stop', 'holdPosition'].includes(command.type)) capture.sent.push(command);
      super.send(data);
    }
  };
  // Observe the viewport polygon drawn on the minimap without exposing game internals.
  const p = CanvasRenderingContext2D.prototype;
  for (const method of ['beginPath', 'moveTo', 'lineTo', 'stroke']) {
    const native = p[method];
    p[method] = function (...args) {
      if (this.canvas.id === 'minimap-canvas') {
        if (method === 'beginPath') this.__proofPath = [];
        if (method === 'moveTo' || method === 'lineTo') (this.__proofPath ||= []).push(args);
        if (method === 'stroke' && this.getLineDash()[0] === 8) capture.cameraOutline = this.__proofPath;
      }
      return native.apply(this, args);
    };
  }
}.toString()})()`;
const records = []; let browser, failure = null;
async function clickAt(page, x, y, button = 'left', shift = false) {
  await page.cdp.call('Page.bringToFront');
  for (const type of ['mousePressed', 'mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1, modifiers: shift ? 8 : 0 });
}
async function click(page, selector) {
  const point = await page.cdp.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(e.disabled||!r.width||!r.height)throw Error('Unavailable control');return [r.left+r.width/2,r.top+r.height/2]})()`);
  await clickAt(page, ...point);
}
async function read(page) {
  return page.cdp.evaluate(`({team:__minimapProof.team,sent:__minimapProof.sent,outline:__minimapProof.cameraOutline,selected:Number(document.querySelector('#selected-total').textContent),error:document.querySelector('#runtime-error')?.textContent||'',status:document.querySelector('#order-status').textContent})`);
}
async function mapPoint(page, x, z) {
  return page.cdp.evaluate(`(()=>{const c=document.querySelector('#minimap-canvas'),r=c.getBoundingClientRect(),s=getComputedStyle(c),inset=side=>(parseFloat(s['border'+side+'Width'])||0)+(parseFloat(s['padding'+side])||0),left=inset('Left'),top=inset('Top'),w=r.width-left-inset('Right'),h=r.height-top-inset('Bottom'),scale=Math.min(c.width/160,c.height/96),px=(c.width-160*scale)/2+(${x}+80)*scale,py=(c.height-96*scale)/2+(${z}+48)*scale;return [r.left+left+px*w/c.width,r.top+top+py*h/c.height]})()`);
}
try {
  await fixture.start();
  const host = await fixture.connect(0), token = host.welcome.player.sessionToken, after = host.messages.length;
  host.send({ type: 'publishMap', map });
  await host.wait(m => m.type === 'mapChange' && m.state.mapId === map.id, 'map published', after);
  const closed = new Promise(resolve => host.socket.addEventListener('close', resolve, { once: true })); host.socket.close(); await closed;
  browser = await createFortifiedBrowser();
  const pages = [];
  for (const team of [0, 1]) {
    const page = await browser.page(`http://127.0.0.1:${fixture.port}/`, { beforeScript: instrument + (team === 0 ? `;sessionStorage.setItem('thousand-unit-skirmish-session:default',${JSON.stringify(token)});` : '') });
    pages.push(page);
    await page.wait(`document.documentElement.dataset.boot==='ready'&&__minimapProof.latest?.mapId===${JSON.stringify(map.id)}&&__minimapProof.cameraOutline`, 'synced rendered map');
    assert.equal((await read(page)).team, team);
  }
  const baseline = await fixture.checkpoint(s => s.mapDefinition.id === map.id);
  const selectedIDs = [];
  for (const [team, page] of pages.entries()) {
    await click(page, '.contextual-command-bar [data-context-proxy="select-idle-workers"]');
    await page.wait(`document.querySelector('#selected-total').textContent==='4'`, 'four Workers selected');
    const ids = await page.cdp.evaluate(`__minimapProof.latest.units.filter(u=>u[1]===${team}&&u[5]==='worker'&&u[4]>0).map(u=>u[0])`);
    selectedIDs.push(...ids);
    const x = team === 0 ? -50 : 50;
    for (const [size, width, height, dpr] of [['small', 1280, 720, 1], ['large', 900, 700, 2]]) {
      await page.cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
      if (size === 'large') await click(page, '#minimap-size-toggle');
      await page.cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await page.wait(`__minimapProof.cameraOutline?.length===4`, 'camera outline drawn');
      const before = await read(page), point = await mapPoint(page, x, 30);
      const fog = await page.cdp.evaluate(`(()=>{const v=__minimapProof.latest.visibility,bytes=atob(v.data),cell=78*160+${x}+80;return(bytes.charCodeAt(cell>>2)>>((cell&3)*2))&3})()`);
      assert.equal(fog, 0, 'clicked terrain is unexplored');
      await clickAt(page, ...point, 'right');
      await page.wait(`document.querySelector('#order-status').textContent.startsWith('MOVE ORDER')`, 'native right-click applied');
      const moved = await read(page), command = moved.sent.at(-1);
      assert.equal(moved.sent.length, before.sent.length + 1, 'one native click sends one command');
      assert.equal(command.type, 'move'); assert.deepEqual(command.ids, ids);
      const pixelTolerance = await page.cdp.evaluate("160/Math.min(document.querySelector('#minimap-canvas').clientWidth,document.querySelector('#minimap-canvas').clientHeight)");
      assert.ok(Math.abs(command.x - x) <= pixelTolerance && Math.abs(command.z - 30) <= pixelTolerance, 'destination matches within one native pointer pixel');
      assert.equal(moved.selected, 4); assert.deepEqual(moved.outline, before.outline, 'right-click preserves camera');
      await clickAt(page, ...await mapPoint(page, x, 40), 'right', true);
      await page.wait(`document.querySelector('#order-status').textContent.startsWith('WAYPOINT QUEUED')`, 'native Shift-right-click queued');
      const queued = await read(page);
      assert.equal(queued.sent.length, moved.sent.length + 1); assert.equal(queued.sent.at(-1).queue, true);
      assert.deepEqual(queued.sent.at(-1).ids, ids); assert.deepEqual(queued.outline, before.outline);
      const saved = await fixture.checkpoint(s => ids.every(id => s.state.units[id].queuedWaypoints.length === 1));
      assert.ok(ids.every(id => saved.state.units[id].orderRevision > baseline.state.units[id].orderRevision));
      const movedIds = await page.wait(`__minimapProof.latest.units.filter(u=>${JSON.stringify(ids)}.includes(u[0])&&Math.abs(u[3]+10)>0.2).map(u=>u[0]).length===4`, 'Workers visibly move');
      assert.equal(movedIds, true);
      assert.equal(queued.error, ''); assert.deepEqual(page.errors, []);
      const capture = await page.cdp.call('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `seat-${team}-${size}-dpr-${dpr}.png`), Buffer.from(capture.data, 'base64'));
      records.push({ team, size, viewport: [width, height], dpr, command, queued: queued.sent.at(-1), selected: queued.selected, cameraPreserved: true, destinationFog: fog });
    }
    const cameraBefore = await read(page);
    await clickAt(page, ...await mapPoint(page, -x, -20));
    await page.wait(`JSON.stringify(__minimapProof.cameraOutline)!==${JSON.stringify(JSON.stringify(cameraBefore.outline))}`, 'left click changes camera');
    assert.equal((await read(page)).sent.length, cameraBefore.sent.length, 'left click sends no units');
    // Give the battlefield keyboard focus without selecting/deselecting anything.
    await page.cdp.evaluate("document.querySelector('#viewport canvas').focus({preventScroll:true})");
    const beforeSpace = await read(page);
    for (const type of ['keyDown', 'keyUp']) await page.cdp.call('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page.wait(`JSON.stringify(__minimapProof.cameraOutline)!==${JSON.stringify(JSON.stringify(beforeSpace.outline))}`, 'Space tap centers selection');
    const centered = await read(page);
    assert.equal(centered.selected, 4); assert.equal(centered.sent.length, beforeSpace.sent.length);
    // Compare the shortcut to the existing native Center selection control.
    await click(page, '#camera-center-selection');
    await page.cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const buttonCentered = await read(page);
    assert.ok(buttonCentered.outline.every((point, i) => point.every((value, axis) =>
      Math.abs(value - centered.outline[i][axis]) <= 1.5)), 'Space reaches the Center selection view, allowing brief unit movement');
    const capture = await page.cdp.call('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `seat-${team}-space-centered.png`), Buffer.from(capture.data, 'base64'));
    await page.cdp.evaluate("document.querySelector('#viewport canvas').focus({preventScroll:true})");
    const dragPoint = await page.cdp.evaluate("(()=>{const r=document.querySelector('#viewport canvas').getBoundingClientRect();return [r.left+r.width*0.6,r.top+r.height*0.4]})()");
    await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragPoint[0], y: dragPoint[1], button: 'left', clickCount: 1 });
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragPoint[0] + 45, y: dragPoint[1] + 20, button: 'left', buttons: 1 });
    await page.cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragPoint[0] + 45, y: dragPoint[1] + 20, button: 'left', clickCount: 1 });
    await page.wait(`JSON.stringify(__minimapProof.cameraOutline)!==${JSON.stringify(JSON.stringify(buttonCentered.outline))}`, 'Space drag pans');
    const dragged = await read(page);
    await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page.cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.deepEqual((await read(page)).outline, dragged.outline, 'release after Space drag cannot center');
    await page.cdp.evaluate("document.querySelector('#minimap-size-toggle').focus()");
    const beforeButton = await page.cdp.evaluate("document.querySelector('.app-shell').dataset.minimapSize");
    for (const type of ['keyDown', 'keyUp']) await page.cdp.call('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await page.wait(`document.querySelector('.app-shell').dataset.minimapSize!==${JSON.stringify(beforeButton)}`, 'focused button retains Space activation');
    const afterButton = await read(page);
    assert.equal(afterButton.selected, 4); assert.equal(afterButton.sent.length, centered.sent.length);
    records.push({ team, control: 'left-click camera, Space centering, Space drag and focused-button activation', selected: centered.selected, orderCountPreserved: true, matchesCenterButton: true });
  }
  const saved = await fixture.checkpoint();
  for (const u of saved.state.units.filter(u => !selectedIDs.includes(u.id))) assert.equal(u.orderRevision, baseline.state.units[u.id].orderRevision, 'unselected unit never ordered');
  console.log(JSON.stringify({ passed: true, output, seats: [0, 1], captures: records.length, scope: 'native automated browser and live authoritative server; not unassisted human evidence' }));
} catch (error) { failure = error; throw error; }
finally {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: !failure, browser: browser?.version || null, records, failure: failure?.message || null }, null, 2));
  await browser?.dispose(); await fixture.dispose();
}
