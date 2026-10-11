import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matureSettlementPlan } from './mature-settlement-scenario.mjs';
import { buildingPad, validateStagingOrigin } from './renderer-roster-audio-plan.mjs';
import { rosterControlPoint } from './renderer-roster-audio-capture.mjs';
import { interactionTargetPoint } from './renderer-interaction-audio-scenario.mjs';
import { installCatalogImportObserver } from './renderer-building-catalog-scenario.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stateExpression = 'window.__rtsInteractionAudioSnapshot()';
export function hudFixture(subset) {
  assert.ok(['selections', 'buildings', 'panels'].includes(subset));
  const map = structuredClone(matureSettlementPlan.map);
  map.id = `hud-${subset}`; map.name = `HUD ${subset}`; map.terrainBase = 'meadow'; return map;
}
export function readHudCapture() {
  const visible = e => Boolean(e && !e.closest('[hidden]') && e.getClientRects().length);
  const bounds = e => { if (!visible(e)) return null; const r=e.getBoundingClientRect();
    return { x:r.x, y:r.y, width:r.width, height:r.height }; };
  const bar = document.querySelector('.contextual-command-bar'), state = window.__rtsInteractionAudioSnapshot?.();
  const recovery = window.__rtsBrowserRecoverySnapshot?.();
  const controls = [...(bar?.querySelectorAll('button,select') ?? [])].filter(visible).slice(0,80).map(e => ({
    action: e.dataset.workerAction ?? e.dataset.workerBuild ?? e.dataset.buildingAction ?? e.dataset.product
      ?? e.dataset.stationaryOrder ?? e.dataset.persistentOrder ?? e.dataset.combatStance ?? e.dataset.contextProxy ?? null,
    enabled: !e.disabled && e.getAttribute('aria-disabled') !== 'true', pressed: e.getAttribute('aria-pressed'), bounds:bounds(e) }));
  return { origin: location.origin, viewport: { width:innerWidth,height:innerHeight,dpr:devicePixelRatio },
    entry:document.documentElement?.dataset.entry, boot:document.documentElement?.dataset.boot,
    mapId:state?.mapId, team:state?.team,
    tick:recovery?.tick, socketState:recovery?.socketState, recovering:recovery?.recovering,
    connection:['ROOM LIVE','WAITING FOR PLAYER 2'].includes(document.querySelector('#network-status')?.textContent)
      ? document.querySelector('#network-status').textContent : null,
    context:bar?.dataset.context, theme:bar?.dataset.hudTheme, selected:Number(document.querySelector('#selected-total')?.textContent),
    bar:bounds(bar), portrait:bounds(document.querySelector('[data-selection-portrait]')),
    minimap:bounds(document.querySelector('.minimap-panel')), header:bounds(document.querySelector('.topbar')),
    panels:['#help-panel','#match-menu','#scenario-brief-panel','#command-deck'].filter(selector=>visible(document.querySelector(selector))),
    controls, queueLength:document.querySelector('[data-building-queue-list]')?.children.length ?? 0,
    fonts:document.fonts.check('14px "HUD DM Sans"')&&document.fonts.check('26px "HUD Barlow Condensed"'),
    workerVisible:visible(document.querySelector('[data-worker-hud]')),
    buildingVisible:visible(document.querySelector('[data-building-hud]')),
    unitVisible:visible(document.querySelector('[data-unit-hud]')) };
}
export function validateHudFrame(view, mapId, context, bytes, previousTick) {
  validateStagingOrigin(view.origin); assert.equal(view.entry,'game'); assert.equal(view.boot,'ready');
  assert.equal(view.mapId,mapId); assert.ok([0,1].includes(view.team)); assert.equal(view.context,context);
  assert.ok(['ROOM LIVE','WAITING FOR PLAYER 2'].includes(view.connection));
  assert.ok(Number.isSafeInteger(previousTick) && previousTick>=0 && Number.isSafeInteger(view.tick) && view.tick>previousTick,
    'authoritative state must advance before the capture');
  assert.equal(view.socketState,1); assert.equal(view.recovering,false); assert.equal(view.fonts,true);
  assert.equal(view.viewport.dpr,1); assert.ok([[1280,720],[1920,1080],[1024,768]].some(([w,h])=>w===view.viewport.width&&h===view.viewport.height));
  assert.ok(bytes.length>10000 && bytes.length<10000000 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
  assert.equal(bytes.readUInt32BE(16),view.viewport.width); assert.equal(bytes.readUInt32BE(20),view.viewport.height);
}
async function pointer(page, point, modifiers=0) {
  const viewport=await page.cdp.evaluate('({width:innerWidth,height:innerHeight})');
  assert.ok(point && Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.y>=0&&point.x<viewport.width&&point.y<viewport.height);
  await page.cdp.call('Page.bringToFront');
  for (const type of ['mousePressed','mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1,modifiers});
}
async function key(page,value) {
  for(const type of ['keyDown','keyUp']) await page.cdp.call('Input.dispatchKeyEvent',{type,key:value,code:value});
}
async function control(page,selector) {
  const point=await page.wait(`(${rosterControlPoint.toString()})(${JSON.stringify(selector)})`,'visible enabled HUD control');
  await pointer(page,point);
}
async function select(page,kind,id,modifiers=0) {
  const point=await page.wait(`(${interactionTargetPoint.toString()})(${JSON.stringify(kind)},${id})`,'visible ordinary pick target');
  await pointer(page,point,modifiers);
}
async function enter(page,origin,map,mapFile,bytes) {
  validateStagingOrigin(origin); assert.equal(await page.cdp.evaluate('location.href'),'about:blank');
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__rtsCaptureDiagnostics=true;(${installCatalogImportObserver.toString()})()`});
  await page.cdp.call('Page.navigate',{url:origin+'/'});
  await page.wait('document.documentElement?.dataset.entry==="menu"&&document.querySelector("#menu-studio")?.disabled===false','ordinary menu');
  await control(page,'#menu-studio');
  await page.wait('document.querySelector("#map-studio")?.open','owned Map Studio room',35000);
  const {root}=await page.cdp.call('DOM.getDocument');
  const {nodeId}=await page.cdp.call('DOM.querySelector',{nodeId:root.nodeId,selector:'#studio-import-file'});
  assert.ok(nodeId>0); await page.cdp.call('DOM.setFileInputFiles',{nodeId,files:[mapFile]});
  const imported=await page.wait(`window.__rtsCatalogMapImport?.ok&&document.querySelector('#studio-id')?.value===${JSON.stringify(map.id)}&&window.__rtsCatalogMapImport`,'authored fixture imported');
  assert.equal(imported.sha256,hash(bytes));
  await control(page,'#studio-publish');
  await page.wait(`!document.querySelector('#map-studio')?.open&&${stateExpression}?.mapId===${JSON.stringify(map.id)}&&${stateExpression}.team===0`,'Save & Play applies fixture',35000);
  await control(page,'#camera-fit-map');
}
export async function captureHudStaging({page,origin,subset,directory,signal}) {
  const map=hudFixture(subset),bytes=Buffer.from(JSON.stringify(map,null,2)+'\n'),mapFile=path.join(directory,'authored-map.json');
  await writeFile(mapFile,bytes,{flag:'wx'});
  const report={schemaVersion:1,subset,status:'failed',mapId:map.id,mapSha256:hash(bytes),
    entry:'ordinary-menu-studio-import-save-and-play',room:'fresh-owned-staging-room',frames:[],steps:[],issues:[],appearanceReview:'pending'};
  const persist=()=>writeFile(path.join(directory,'hud.json'),JSON.stringify(report,null,2)+'\n');
  let stage='entry';
  const state=()=>page.cdp.evaluate(stateExpression);
  async function capture(name,context) {
    signal?.throwIfAborted(); stage=name;
    await page.wait(`document.querySelector('.contextual-command-bar')?.dataset.context===${JSON.stringify(context)}`,'current selection context');
    await page.cdp.evaluate('document.fonts.ready.then(()=>true)');
    const previousTick=await page.cdp.evaluate('window.__rtsBrowserRecoverySnapshot().tick');
    assert.ok(Number.isSafeInteger(previousTick)&&previousTick>=0);
    await page.wait(`(()=>{const s=window.__rtsBrowserRecoverySnapshot();return s.socketState===1&&!s.recovering&&s.tick>${previousTick}})()`,'advancing authoritative game state');
    const view=await page.cdp.evaluate(`(${readHudCapture.toString()})()`);
    const image=Buffer.from((await page.cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
    // Preserve the image even when a layout/state assertion fails afterward.
    const file=name+'.png'; await writeFile(path.join(directory,file),image,{flag:'wx'});
    report.frames.push({file,sha256:hash(image),previousTick,view}); await persist();
    validateHudFrame(view,map.id,context,image,previousTick);
    return view;
  }
  async function worker() { const unit=(await state()).units.find(u=>u.kind==='worker'&&u.point); assert.ok(unit); await select(page,'unit',unit.id); return unit; }
  try {
    await enter(page,origin,map,mapFile,bytes); await persist();
    await worker(); await capture('worker','workers');
    if(subset==='selections') {
      await control(page,'[data-worker-action="build"]'); await capture('worker-build','workers'); await key(page,'Escape');
      const army=(await state()).units.find(u=>u.kind!=='worker'&&u.kind!=='skiff'&&u.point); assert.ok(army);
      await select(page,'unit',army.id); await capture('army','military');
      await control(page,'[data-unit-hud] [data-combat-stance="defensive"]');
      await page.wait('document.querySelector("[data-unit-hud] [data-combat-stance=defensive]")?.getAttribute("aria-pressed")==="true"','confirmed defensive stance');
      await capture('army-defensive','military');
      const w=(await state()).units.find(u=>u.kind==='worker'&&u.point); assert.ok(w);
      await select(page,'unit',w.id,8); await capture('mixed','mixed');
      await key(page,'Escape'); await capture('empty','none');
    } else if(subset==='buildings') {
      const town=(await state()).buildings.find(b=>b.type==='town-center'&&b.complete&&b.point); assert.ok(town);
      await select(page,'building',town.id); await capture('town-center','building');
      await control(page,'[data-context-products] [data-product="worker"]');
      await page.wait('document.querySelector("[data-building-queue-list]")?.children.length>0','paid Worker in production queue');
      await capture('town-center-training','building');
      stage='paid-barracks';
      await worker(); await control(page,'[data-worker-action="build"]'); await control(page,'[data-worker-build="barracks"]');
      const pad=buildingPad('barracks');
      const point=await page.wait(`window.__rtsInteractionAudioProject(${pad.x},${pad.z})`,'visible build site');
      await page.cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await page.wait('window.__rtsBuildingPlacementSnapshot?.active&&window.__rtsBuildingPlacementSnapshot.valid','valid Barracks placement');
      await pointer(page,point);
      const barracks=await page.wait(`${stateExpression}.buildings.find(b=>b.type==='barracks'&&b.complete&&b.point)`,'paid Barracks completes',60000);
      await select(page,'building',barracks.id); await capture('barracks','building');
      await control(page,'[data-context-products] [data-product="infantry"]');
      await page.wait('document.querySelector("[data-building-queue-list]")?.children.length>0','paid Infantry queue');
      await capture('barracks-training','building');
      await control(page,'[data-building-action="research"]'); await capture('barracks-research','building');
    } else {
      for(const [name,open,close] of [['help','#help-toggle','#help-close'],['settings','#match-menu-toggle','#match-menu-close'],['objectives','#scenario-brief-toggle','#scenario-brief-close']]) {
        await control(page,open); await capture(name,'workers'); await control(page,close);
      }
      for(const [width,height] of [[1920,1080],[1024,768]]) {
        await page.cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        await capture(`worker-${width}x${height}`,'workers');
      }
    }
    report.status='captured-needs-review';
  } catch(error) {
    report.issues.push({stage,code:error instanceof assert.AssertionError?'contract-failed':/timeout/i.test(error?.message)?'wait-timeout':'capture-failed'});
    try {
      const screenshot=await page.cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const image=Buffer.from(screenshot.data,'base64');
      await writeFile(path.join(directory,'failure.png'),image,{flag:'wx'});
      report.failure={file:'failure.png',sha256:hash(image),view:await page.cdp.evaluate(`(${readHudCapture.toString()})()`)};
    } catch { report.issues.push({code:'failure-image-unavailable'}); }
  }
  await persist(); return report;
}
