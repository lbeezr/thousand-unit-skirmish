// Immutable domain adapter for the shared hosted packed-game transport.
// The caller owns server/browser/preflight/release/cleanup. This module owns only
// ordinary room commands, observational CDP breakpoints and animation evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizedDirection, spriteActionClip, spriteGroundDepthBias } from '../src/unit-sprite-runtime.mjs';
import { decodeRgba8 } from './sprite-pixel-bounds.mjs';
import { decodeRegisteredUnitFrames, unitArtDirections } from './unit-art-production-contract.mjs';
import { validateCaptureContext } from './renderer-capture-context.mjs';

export const id = 'worker-animations';
export const contextVersion = 1;
export const mapId = 'veyrholds-terraced-vale';
export const directories = Object.freeze({human:'cast-human-sprite-v3',spearman:'spearman-sprite-v1'});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));

// Runs before normal game entry. The shared runner owns its before-document
// diagnostic flag. No URL, art selector, game field, prototype or clock changes.
export function installUnitProbe() {
  window.__rtsUnitAnimation={number:0,last:null,targets:[],samples:[],pending:null,errors:[]};
  window.__rtsUnitAnimation.request=(options={})=>new Promise(resolve=>{
    const probe=window.__rtsUnitAnimation;
    if(probe.pending)throw Error('unit capture already pending');
    probe.pending={resolve,options};
  });
}

// Serialized as a non-pausing CDP breakpoint condition immediately after the
// actual renderer.render(scene,camera). These names belong to the real main.js
// module scope. Only our own probe storage is written; game objects stay read-only.
export function observeRenderedUnits() {
  try {
    const probe=window.__rtsUnitAnimation;
    if(!probe)return false;
    const selectedUnits=units.filter(u=>u&&u.hp>0&&u.team===localTeam&&['worker','spearman'].includes(u.kind));
    const observed=selectedUnits.map(u=>{
      const role=unitSpriteRuntime.roleForUnit(u);
      const meshes=scene.children.filter(m=>m.geometry?.attributes?.instanceAtlasRect
        &&m.material?.map?.image?.src&&new URL(m.material.map.image.src,location.href).pathname
          .includes(`/${role==='human'?'cast-human':role}-sprite-`));
      const mesh=meshes.length===2?meshes[u.team]:null;
      const rect=mesh?.geometry.attributes.instanceAtlasRect;
      const matrix=mesh?Array.from(mesh.instanceMatrix.array.slice(u.slot*16,u.slot*16+16)):null;
      const foot=new THREE.Vector3(u.renderX,groundHeight(u.renderX,u.renderZ),u.renderZ).project(camera);
      const bounds=renderer.domElement.getBoundingClientRect();
      const actorDraw=mesh?.visible===true&&u.slot<mesh.count&&matrix?.some((v,i)=>[0,1,2,4,5,6].includes(i)&&Math.abs(v)>1e-9);
      return {id:u.id,generation:u.generation,team:u.team,kind:u.kind,role,slot:u.slot,
        serverX:u.serverX,serverZ:u.serverZ,x:u.renderX,z:u.renderZ,angle:u.angle,
        walking:u.walking===true,task:u.task,performingAction:u.performingAction??null,
        groundY:groundHeight(u.renderX,u.renderZ)+.018,
        visibleScale:u.scale*(u.spawnStartedAt>0?.28+.72*Math.min(1,Math.max(0,(now-u.spawnStartedAt)/SPAWN_POSE_MS)):1),
        cargoType:u.cargoType??null,workResourceVariant:u.workResourceVariant??null,
        clockState:u.spriteClockState,clockAction:u.spriteClockAction,clockStartedAt:u.spriteClockStartedAt,
        uv:rect?Array.from(rect.array.slice(u.slot*4,u.slot*4+4)):null,matrix,
        atlasPath:mesh?new URL(mesh.material.map.image.src,location.href).pathname:null,
        actorDraw:Boolean(actorDraw),inView:Math.abs(foot.x)<.88&&Math.abs(foot.y)<.8&&Math.abs(foot.z)<1,
        screen:{x:bounds.left+(foot.x+1)*bounds.width/2,y:bounds.top+(1-foot.y)*bounds.height/2},selected:selected.has(u.id)};
    });
    const snapshot={number:++probe.number,time:now,rendererFrame:renderer.info.render.frame,
      team:localTeam,mapId:mapDefinition?.id,zoom,unitSpriteReady,units:observed,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      food:latestFood[localTeam],wood:latestWood[localTeam],population:latestPopulation[localTeam],
      buildings:latestBuildings.filter(b=>b.team===localTeam).map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,
        home:b.home===true,complete:b.complete===true,progress:b.progress,queue:b.queue})),
      workerQueue:latestWorkerProduction[localTeam]?.queue??null};
    probe.last=snapshot;
    if(probe.targets.length) {
      probe.samples.push({...snapshot,units:observed.filter(u=>probe.targets.includes(u.id)),buildings:undefined});
      if(probe.samples.length>180)probe.samples.shift();
    }
    if(probe.pending) {
      const {resolve,options}=probe.pending,target=observed.find(u=>u.id===options.unitId);
      if(options.minTime!==undefined&&now<options.minTime)return false;
      if(options.state&&target?.clockState!==options.state)return false;
      if(options.notUv&&!target?.uv?.some((v,i)=>Math.abs(v-options.notUv[i])>1e-7))return false;
      probe.pending=null;
      const gl=renderer.domElement.getContext('webgl2'),pixels=[],p=new Uint8Array(4);
      for(let y=0;y<6;y++)for(let x=0;x<8;x++) {
        gl.readPixels(Math.floor((x+.5)*gl.drawingBufferWidth/8),Math.floor((y+.5)*gl.drawingBufferHeight/6),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);
        pixels.push(...p);
      }
      resolve({...snapshot,version:gl.getParameter(gl.VERSION),contextLost:gl.isContextLost(),glError:gl.getError(),pixels,
        canvasPng:renderer.domElement.toDataURL('image/png').split(',')[1]});
    }
  } catch {
    const probe=window.__rtsUnitAnimation;
    if(probe){probe.errors.push('post-render-unit-observation-failed');if(probe.pending){probe.pending.resolve({error:true});probe.pending=null;}}
  }
  return false;
}

export function postRenderLine(source) {
  const lines=source.split('\n'),matches=lines.flatMap((line,index)=>line.trim()==='renderer.render(scene, camera);'?[index]:[]);
  assert.equal(matches.length,1,'actual main render site must be unique');
  // The optional catalog now updates between render and minimap. Pin the first
  // following unconditional minimap call, never a skipped conditional branch.
  const next=lines.findIndex((line,index)=>index>matches[0]&&index<matches[0]+20&&line.trim()==='drawMinimap(now);');
  assert.ok(next>matches[0],'post-render observation site moved; owner must review it');
  return next;
}

function uvFor(frame,page) {
  const r=frame.frameRectsPx.find(c=>c.pageId===page.id&&c.layerId==='actor').rectPx,i=page.sampling?.uvInsetPx??.5;
  return Array.from(new Float32Array([(r.x+i)/page.dimensionsPx.width,(r.y+r.height-i)/page.dimensionsPx.height,
    (r.x+r.width-i)/page.dimensionsPx.width,(r.y+i)/page.dimensionsPx.height]));
}
export function registeredSpriteRoot(unit,asset,frame,page) {
  const m=unit.matrix,crop=frame.frameRectsPx.find(c=>c.pageId===page.id&&c.layerId==='actor');
  assert.ok(Array.isArray(m)&&m.length===16&&m.every(Number.isFinite),'actual finite instance matrix required');
  const r=crop.rectPx,o=crop.offsetPx??{x:0,y:0},p=frame.groundPivotPx;
  const sx=Math.hypot(...m.slice(0,3))/r.width,sy=Math.hypot(...m.slice(4,7))/r.height;
  const calibrated=asset.heightWorld/Math.max(1,...asset.frames.map(f=>f.alphaBoundsPx?.height||f.canvasPx.height));
  assert.ok(Number.isFinite(unit.visibleScale)&&unit.visibleScale>0,'actual visible scale required');
  assert.ok(Math.abs(sx-calibrated*unit.visibleScale)<1e-6&&Math.abs(sy-sx)<1e-6,'actual sprite scale must retain its registered calibration');
  const bias=frame.alphaBoundsPx?spriteGroundDepthBias(frame.alphaBoundsPx,p,sx,m[5]/(r.height*sx),m[9]):0;
  const ox=(o.x+r.width/2-p.x)/r.width,oy=(p.y-o.y-r.height/2)/r.height;
  const root=[0,1,2].map(i=>m[12+i]-m[i]*ox-m[4+i]*oy-m[8+i]*bias);
  assert.ok(Math.hypot(root[0]-unit.x,root[2]-unit.z)<.005,'drawn sprite root must follow the actual client position');
  assert.ok(Number.isFinite(unit.groundY)&&Math.abs(root[1]-unit.groundY)<.005,'drawn ground pivot must remain planted');
  return {x:root[0],y:root[1],z:root[2],worldPerPixel:sx,visibleScale:unit.visibleScale};
}
export function identifyUnitFrame(unit,pack,cells,time) {
  assert.ok(unit.actorDraw,'target actor must be in an active sprite draw');
  assert.ok(unit.inView,'target actor must be inside the useful viewport');
  assert.ok(Array.isArray(unit.uv)&&unit.uv.length===4,'actual instanced UV is required');
  assert.ok(Number.isSafeInteger(unit.id)&&unit.id>=0&&Number.isSafeInteger(unit.generation)&&unit.generation>=0,'actual actor identity and generation required');
  const asset=pack.assets[0],page=pack.pages[0],matches=asset.frames.filter(f=>uvFor(f,page).every((v,i)=>Math.abs(v-unit.uv[i])<1e-7));
  const runtime=pack.files.find(f=>f.id===page.runtimeFileId);
  assert.equal(unit.atlasPath,`/assets/units/${directories[unit.role]}/${runtime.path}`,'actual default texture binding must match the retained atlas');
  assert.ok(matches.length,'UV must identify retained committed actor pixels');
  const direction=normalizedDirection(unit.angle),state=unit.clockState;
  assert.ok(['idle','walk','build'].includes(state),'this bounded acceptance observes idle, walk and construction only');
  assert.ok(Number.isFinite(unit.clockStartedAt)&&Number.isFinite(time)&&time>=unit.clockStartedAt,'actual animation clock is required');
  const clip=spriteActionClip(new Map(asset.clips.map(c=>[`${c.stateId}|${c.directionId}`,c])),state,direction,unit.cargoType,unit.role,true);
  assert.ok(clip,'actual state must resolve a retained clip');
  const elapsed=Math.max(0,time-unit.clockStartedAt),duration=clip.sequence.reduce((sum,key)=>sum+key.durationMs,0);
  let phase=clip.loop?elapsed%duration:Math.min(elapsed,duration-1e-6),index=0;
  while(index<clip.sequence.length-1&&phase>=clip.sequence[index].durationMs){phase-=clip.sequence[index].durationMs;index++;}
  const expected=clip.sequence[index].frameId;
  assert.ok(matches.some(f=>f.id===expected),'drawn UV must agree with the actual elapsed animation clock');
  const frame=matches.find(f=>f.id===expected),pixel=cells[frame.id];
  assert.ok(pixel,'registered visible source pixels are required');
  const drawnRoot=registeredSpriteRoot(unit,asset,frame,page);
  return {frameId:frame.id,rgbaSha256:pixel.rgba,alphaSha256:pixel.alpha,state,direction,
    clipState:clip.stateId,clipDirection:clip.directionId,clipLoop:clip.loop,clipDurationMs:duration,elapsedMs:elapsed,index,drawnRoot};
}

export function validateHeadingSamples(samples,{unitId,heading,kind,pack,cells}) {
  const moving=samples.flatMap(sample=>sample.units.filter(u=>u.id===unitId&&u.walking
    &&u.clockState==='walk'&&normalizedDirection(u.angle)===heading).map(unit=>({...sample,unit,
      identity:identifyUnitFrame(unit,pack,cells,sample.time)})));
  assert.ok(moving.length>=3,'at least three actually rendered settled movement frames are required');
  const first=moving[0],last=moving.at(-1);
  assert.ok(last.number>first.number&&last.time-first.time>=700,'rendered timeline must span a usable gait interval');
  const dx=last.identity.drawnRoot.x-first.identity.drawnRoot.x,dz=last.identity.drawnRoot.z-first.identity.drawnRoot.z;
  assert.ok(Math.hypot(dx,dz)>=.3,'actual drawn roots must move during the observed interval');
  assert.equal(normalizedDirection(Math.atan2(dx,dz)),heading,'actual displacement must agree with requested world heading');
  assert.ok(moving.every(s=>s.unit.generation===first.unit.generation),'unit generation must remain stable');
  assert.ok(moving.every(s=>s.unit.clockStartedAt===first.unit.clockStartedAt),'continuous movement cannot restart its clock');
  const rgba=new Set(moving.map(s=>s.identity.rgbaSha256)),alpha=new Set(moving.map(s=>s.identity.alphaSha256));
  const expectedGap=kind==='spearman'&&heading!=='south-east';
  if(expectedGap) {
    assert.ok(moving.every(s=>s.identity.frameId.startsWith(`idle-${heading}-`)),'missing Spearman gait must retain the correct-facing idle');
    assert.equal(rgba.size,1,'a retained idle fallback is not newly animated coverage');
  } else {
    assert.ok(rgba.size>=2&&alpha.size>=2,'translation alone cannot pass: distinct registered gait pixels and silhouettes are required');
    assert.ok(moving.every(s=>s.identity.frameId.startsWith(`walk-${heading}-`)),'gait must use this actual heading');
  }
  return {kind,heading,unitId,team:first.unit.team,generation:first.unit.generation,
    status:expectedGap?'incomplete-art-correct-facing':'animated',distinctCells:rgba.size,distinctSilhouettes:alpha.size,
    samples:moving.map(({number,time,unit,identity})=>({number,time,x:unit.x,z:unit.z,serverX:unit.serverX,serverZ:unit.serverZ,
      walking:unit.walking,angle:unit.angle,clockStartedAt:unit.clockStartedAt,uv:unit.uv,
      matrix:unit.matrix,groundY:unit.groundY,visibleScale:unit.visibleScale,...identity}))};
}

export function validateStoppedSamples(samples,{unitId,heading,stopTime,pack,cells}) {
  const idle=samples.flatMap(s=>s.units.filter(u=>u.id===unitId&&!u.walking&&u.clockState==='idle')
    .map(unit=>({...s,unit,identity:identifyUnitFrame(unit,pack,cells,s.time)})));
  assert.ok(idle.length>=3&&idle.at(-1).time-idle[0].time>=250,'Stop requires a stable rendered idle interval');
  assert.ok(idle.every(s=>s.identity.direction===heading&&s.identity.frameId.startsWith(`idle-${heading}-`)),'Stop must keep the actual facing');
  assert.ok(idle.every(s=>s.unit.clockStartedAt>=stopTime&&s.unit.clockStartedAt===idle[0].unit.clockStartedAt),'Stop must make one actual state transition');
  assert.ok(idle.every(s=>Math.hypot(s.unit.x-idle[0].unit.x,s.unit.z-idle[0].unit.z)<.01),'idle must stop translating');
  return idle.map(({number,time,unit,identity})=>({number,time,x:unit.x,z:unit.z,
    serverX:unit.serverX,serverZ:unit.serverZ,clockStartedAt:unit.clockStartedAt,uv:unit.uv,
    matrix:unit.matrix,groundY:unit.groundY,visibleScale:unit.visibleScale,...identity}));
}

async function preparePage(page,source,origin) {
  await page.cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`(${installUnitProbe.toString()})()`});
  await page.cdp.call('Debugger.enable');
  await page.cdp.call('Debugger.setBreakpointByUrl',{url:`${origin}/src/main.js`,lineNumber:postRenderLine(source),
    condition:`(${observeRenderedUnits.toString()})()`});
}
const snapshot=page=>page.cdp.evaluate('window.__rtsUnitAnimation.last');
async function order(page,command) {
  assert.equal(await page.cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(command)})`),true,'ordinary live socket must accept the command');
}
async function focus(page,unitId) {
  // Actual input, never writing selected IDs or the camera state. Recenter via
  // the ordinary home button if a just-spawned actor starts outside the viewport.
  let unit=(await snapshot(page)).units.find(u=>u.id===unitId);
  assert.ok(unit,'live actor required');
  if(!unit.inView) {
    await page.cdp.evaluate("document.querySelector('#camera-home-base').click()");
    await pause(250);unit=(await snapshot(page)).units.find(u=>u.id===unitId);
  }
  assert.ok(unit.inView,'input target must be on screen');
  for(const type of ['mousePressed','mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent',{
    type,x:unit.screen.x,y:unit.screen.y,button:'left',clickCount:1});
  await page.wait(`window.__rtsUnitAnimation.last.units.some(u=>u.id===${unitId}&&u.selected)`,'actual actor selection',5000);
  await page.cdp.evaluate("document.querySelector('#camera-center-selection').click()");
  await pause(250);
}

export async function loadUnitInputs(origin,{fetchImpl=fetch,read=readFile}={}) {
  const inputs={},assets=[];
  for(const [role,directory] of Object.entries(directories)) {
    const manifestPath=`assets/units/${directory}/sprite-atlas-pack-v1.json`;
    const local=await read(new URL(`../${manifestPath}`,import.meta.url));
    const response=await fetchImpl(`${origin}/${manifestPath}`);assert.equal(response.status,200,'ordinary manifest must be served');
    const served=Buffer.from(await response.arrayBuffer());assert.equal(hash(served),hash(local),'served manifest must match this clean source');
    const atlas=JSON.parse(served),page=atlas.pages[0],runtime=atlas.files.find(f=>f.id===page.runtimeFileId);
    for(const fileId of [page.runtimeFileId,page.maskFileId]) {
      const file=atlas.files.find(f=>f.id===fileId),filePath=`assets/units/${directory}/${file.path}`;
      const image=await fetchImpl(`${origin}/${filePath}`);assert.equal(image.status,200,'ordinary unit texture must be served');
      const bytes=Buffer.from(await image.arrayBuffer());assert.equal(hash(bytes),file.sha256,'served texture must match its retained manifest');
      assets.push({path:filePath,sha256:hash(bytes),bytes:bytes.length});
      if(fileId===page.runtimeFileId)inputs[role]={pack:atlas,
        cells:decodeRegisteredUnitFrames(atlas.assets[0],page,decodeRgba8(bytes))};
    }
    assets.push({path:manifestPath,sha256:hash(served),bytes:served.length,assetId:atlas.assets[0].id,
      atlasSha256:runtime.sha256,registeredFrames:Object.keys(inputs[role].cells).length});
  }
  return {inputs,assets};
}

// Only this adapter's normal input and observation contract. The shared owner
// supplies qualified browser/pages, clean release identity, captures and cleanup.
export async function run(context) {
  const {page:host,openPage,origin,source,capture}=validateCaptureContext(context);
  const report={schemaVersion:1,adapterId:id,scope:'hosted-runner-local-packed-normal-game',
    status:'failed',sourceRevision:source.revision,releaseDigest:source.digest,mapId,
    normalEntry:'Create Room / ordinary Tiny Skirmish / two connected seats',
    testedCivilization:'human',testedTeam:0,peerCivilization:'boughward',
    defaultHumanRoles:{worker:'human/v3',spearman:'spearman/v1'},production:[],rows:[],captures:[],issues:[],
    expectedMissingWalkDirections:unitArtDirections.filter(d=>d!=='south-east'),
    newlyAuthoredFrames:0,deployedRevision:null,stagingAcceptance:false};
  const checks=[],check=(id,passed)=>checks.push({id,passed:Boolean(passed)});
  let evidenceDirectory,phase='ordinary-entry',peer;
  async function checkpoint(label,unitId,options={}) {
    const frame=await host.cdp.evaluate(`window.__rtsUnitAnimation.request(${JSON.stringify({...options,unitId})})`);
    assert.match(frame.version??'',/^WebGL 2\.0/);assert.equal(frame.contextLost,false);assert.equal(frame.glError,0);
    assert.equal(frame.pixels.length,192);assert.ok(new Set(frame.pixels).size>2,'actual game readback must not be blank');
    assert.ok(frame.units.some(u=>u.id===unitId&&u.actorDraw&&u.inView),'captured target must be in the actual visible draw');
    const canvas=Buffer.from(frame.canvasPng,'base64');delete frame.canvasPng;
    assert.ok(canvas.length>10000&&canvas.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'actual rendered PNG required');
    // The canvas is from this exact post-render observation. The shared CDP
    // viewport capture happens afterward and is labelled separately, honestly.
    const retained=await capture({page:host,mapId,checkpoint:label});
    evidenceDirectory=path.dirname(retained.directory);
    const entry={...frame,units:frame.units.filter(u=>u.id===unitId),
      canvas:`${label}/canvas.png`,canvasSha256:hash(canvas),
      viewport:`${label}/${retained.manifest.image.file}`,viewportSha256:retained.manifest.image.sha256,
      viewportAfterFrame:frame.number};
    await writeFile(path.join(retained.directory,'canvas.png'),canvas,{flag:'wx'});
    await writeFile(path.join(retained.directory,'animation-frame.json'),JSON.stringify(entry,null,2)+'\n',{flag:'wx'});
    report.captures.push(entry);return entry;
  }
  try {
    const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
    const loaded=await loadUnitInputs(origin),inputs=loaded.inputs;report.assets=loaded.assets;
    await preparePage(host,main,origin);await host.cdp.call('Page.navigate',{url:`${origin}/`});
    await host.wait("document.querySelector('#menu-create-room')&&!document.querySelector('#menu-create-room').disabled",'ordinary Create Room');
    await host.cdp.evaluate("document.querySelector('#menu-create-room').click()");
    await host.wait("document.querySelector('#lobby-map')&&!document.querySelector('#lobby-map').disabled",'ordinary pregame');
    // Stay on the actual default Tiny map. Historical Millrace is currently an
    // internal lab map and cannot count as newly created ordinary gameplay.
    assert.equal(await host.cdp.evaluate("document.querySelector('#lobby-map').value"),mapId);
    assert.equal(await host.cdp.evaluate("document.querySelector('#lobby-match-mode').value"),'skirmish@1');
    const roomUrl=await host.cdp.evaluate('location.href');
    peer=await openPage();await preparePage(peer,main,origin);await peer.cdp.call('Page.navigate',{url:roomUrl});
    await peer.wait("document.querySelector('#lobby-ready')&&!document.querySelector('#lobby-ready').disabled",'second ordinary seat');
    await host.wait("[...document.querySelectorAll('#room-lobby ul[aria-label=\"Player seats\"] li')].every(row=>!row.textContent.includes('Waiting')&&!row.textContent.includes('Disconnected'))",'both connected seats');
    await host.cdp.evaluate("document.querySelector('#lobby-ready').click()");
    await host.wait("document.querySelector('#lobby-ready').textContent==='Not ready'",'host ready accepted');
    await peer.wait("document.querySelector('#room-lobby ul[aria-label=\"Player seats\"] li').textContent.includes(': Ready')",'peer sees host ready');
    await peer.cdp.evaluate("document.querySelector('#lobby-ready').click()");
    await host.wait("!document.querySelector('#lobby-launch').disabled",'both ready');
    await host.cdp.evaluate("document.querySelector('#lobby-launch').click()");
    await host.wait("window.__rtsUnitAnimation.last?.unitSpriteReady&&window.__rtsUnitAnimation.last.units.some(u=>u.kind==='worker')&&window.__rtsEnvironmentCaptureCommand",'ordinary approved unit draws',30000);
    const opening=await snapshot(host);assert.equal(opening.team,0);assert.equal(opening.mapId,mapId);
    assert.equal(opening.food,150);assert.equal(opening.wood,250);
    await focus(host,opening.units.find(u=>u.kind==='worker').id);
    const beforeZoom=(await snapshot(host)).zoom;
    const target=(await snapshot(host)).units.find(u=>u.selected);
    await host.cdp.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:target.screen.x,y:target.screen.y,
      deltaX:0,deltaY:-Math.log(1.5/beforeZoom)*1000});
    await host.wait('Math.abs(window.__rtsUnitAnimation.last.zoom-1.5)<.03','normal input useful zoom',5000);
    await checkpoint('ordinary-opening',target.id);check('ordinary-paid-entry',true);
    phase='paid-worker';const oldWorkers=new Set(opening.units.filter(u=>u.kind==='worker').map(u=>u.id));
    await order(host,{type:'trainWorker'});
    await host.wait(`window.__rtsUnitAnimation.last.food===${opening.food-50}`,'paid Worker reservation');
    report.production.push({kind:'worker',foodBefore:opening.food,foodAfter:(await snapshot(host)).food,command:'trainWorker'});
    await host.wait(`window.__rtsUnitAnimation.last.units.some(u=>u.kind==='worker'&&!${JSON.stringify([...oldWorkers])}.includes(u.id))`,'paid Worker spawn',45000);
    let current=await snapshot(host),worker=current.units.find(u=>u.kind==='worker'&&!oldWorkers.has(u.id));
    report.production[0].unitId=worker.id;check('paid-worker',true);
    await host.cdp.evaluate(`window.__rtsUnitAnimation.targets=[${worker.id}]`);
    phase='paid-construction';const center=current.buildings.find(b=>b.home&&b.type==='town-center');
    assert.ok(center,'ordinary home Town Center required');
    const previousBuildings=new Set(current.buildings.map(b=>b.id));
    await order(host,{type:'build',buildingType:'barracks',ids:[worker.id],x:center.x+7,z:center.z-6});
    await host.wait(`window.__rtsUnitAnimation.last.wood===${current.wood-175}`,'paid Barracks reservation');
    report.production.push({kind:'barracks',woodBefore:current.wood,woodAfter:(await snapshot(host)).wood,command:'build'});
    await host.wait(`window.__rtsUnitAnimation.last.units.some(u=>u.id===${worker.id}&&!u.walking&&u.clockState==='build')`,'actual construction action',30000);
    await focus(host,worker.id);
    const first=await checkpoint('worker-build-1',worker.id),identity=identifyUnitFrame(first.units[0],inputs.human.pack,inputs.human.cells,first.time);
    const second=await checkpoint('worker-build-2',worker.id,{notUv:first.units[0].uv,state:'build'}),next=identifyUnitFrame(second.units[0],inputs.human.pack,inputs.human.cells,second.time);
    assert.ok([identity,next].every(w=>w.frameId.startsWith('build-')),'actual productive construction pixels required');
    assert.notEqual(identity.rgbaSha256,next.rgbaSha256,'work must change visible source pixels');
    report.work=[identity,next];
    await host.wait(`window.__rtsUnitAnimation.last.buildings.some(b=>b.type==='barracks'&&b.complete&&!${JSON.stringify([...previousBuildings])}.includes(b.id))`,'paid Barracks completion',45000);
    check('productive-work-gait',true);
    phase='paid-spearman';current=await snapshot(host);
    const barracks=current.buildings.find(b=>b.type==='barracks'&&b.complete&&!previousBuildings.has(b.id));
    const oldSpears=new Set(current.units.filter(u=>u.kind==='spearman').map(u=>u.id));
    await order(host,{type:'trainUnit',kind:'spearman',buildingId:barracks.id});
    await host.wait(`window.__rtsUnitAnimation.last.food===${current.food-60}&&window.__rtsUnitAnimation.last.wood===${current.wood-20}`,'paid Spearman reservation');
    const paid=await snapshot(host);report.production.push({kind:'spearman',foodBefore:current.food,foodAfter:paid.food,
      woodBefore:current.wood,woodAfter:paid.wood,command:'trainUnit',buildingId:barracks.id});
    await host.wait(`window.__rtsUnitAnimation.last.units.some(u=>u.kind==='spearman'&&!${JSON.stringify([...oldSpears])}.includes(u.id))`,'paid Spearman spawn',30000);
    const spear=(await snapshot(host)).units.find(u=>u.kind==='spearman'&&!oldSpears.has(u.id));
    report.production.at(-1).unitId=spear.id;check('paid-spearman',true);
    for(const actor of [worker,spear]) {
      const role=actor.kind==='worker'?'human':'spearman';
      await host.cdp.evaluate(`window.__rtsUnitAnimation.targets=[${actor.id}]`);
      for(const [index,heading] of unitArtDirections.entries()) {
        phase=`${actor.kind}-${heading}`;
        try {
          await focus(host,actor.id);const start=(await snapshot(host)).units.find(u=>u.id===actor.id);
          await host.cdp.evaluate('window.__rtsUnitAnimation.samples=[]');
          const bearing=index*Math.PI/4,goal={x:start.serverX+Math.sin(bearing)*9,z:start.serverZ+Math.cos(bearing)*9};
          await order(host,{type:'move',ids:[actor.id],...goal});
          await host.wait(`(()=>{const s=window.__rtsUnitAnimation.samples.filter(s=>s.units.some(u=>u.id===${actor.id}&&u.walking&&u.clockState==='walk'&&Math.abs(Math.atan2(Math.sin(u.angle-${bearing}),Math.cos(u.angle-${bearing})))<.2));return s.length>=3&&s.at(-1).time-s[0].time>=800;})()`,'settled actual gait interval',12000);
          const firstWalk=await checkpoint(`${phase}-walk-1`,actor.id,{state:'walk'});
          const expectedGap=actor.kind==='spearman'&&heading!=='south-east';
          const walking=await checkpoint(`${phase}-walk-2`,actor.id,{state:'walk',minTime:firstWalk.time+200,
            ...(expectedGap?{}:{notUv:firstWalk.units[0].uv})});
          assert.ok(walking.units[0].walking,'Stop must interrupt actual travel');
          assert.ok(Math.hypot(walking.units[0].serverX-goal.x,walking.units[0].serverZ-goal.z)>1,'Stop must precede goal arrival');
          const firstKey=identifyUnitFrame(firstWalk.units[0],inputs[role].pack,inputs[role].cells,firstWalk.time);
          const secondKey=identifyUnitFrame(walking.units[0],inputs[role].pack,inputs[role].cells,walking.time);
          if(expectedGap)assert.equal(firstKey.rgbaSha256,secondKey.rgbaSha256,'the expected idle fallback stays explicitly static');
          else assert.notEqual(firstKey.rgbaSha256,secondKey.rgbaSha256,'retained walking PNGs need distinct actual gait phases');
          const samples=await host.cdp.evaluate('window.__rtsUnitAnimation.samples');
          const row=validateHeadingSamples(samples,{unitId:actor.id,heading,kind:actor.kind,...inputs[role]});
          const stopTime=await host.cdp.evaluate('performance.now()');
          await host.cdp.evaluate('window.__rtsUnitAnimation.samples=[]');await order(host,{type:'stop',ids:[actor.id]});
          await host.wait(`(()=>{const s=window.__rtsUnitAnimation.samples.filter(s=>s.units.some(u=>u.id===${actor.id}&&!u.walking&&u.clockState==='idle'));return s.length>=3&&s.at(-1).time-s[0].time>=300;})()`,'Stop to stable actual idle',12000);
          const stopped=await checkpoint(`${phase}-stop`,actor.id);
          row.stop=validateStoppedSamples(await host.cdp.evaluate('window.__rtsUnitAnimation.samples'),
            {unitId:actor.id,heading,stopTime,...inputs[role]});
          assert.equal(identifyUnitFrame(stopped.units[0],inputs[role].pack,inputs[role].cells,stopped.time).state,'idle');
          report.rows.push(row);check(`${phase}-gait`,row.status==='animated');check(`${phase}-stop`,true);
        } catch(error) {
          report.rows.push({kind:actor.kind,heading,status:'failed'});check(`${phase}-scenario`,false);
          report.issues.push({phase,message:error instanceof assert.AssertionError?error.message.split('\n')[0]:'bounded scenario step failed'});
          await order(host,{type:'stop',ids:[actor.id]}).catch(()=>{});
        }
      }
    }
    assert.equal(report.rows.length,16);assert.equal(report.rows.filter(r=>r.status==='animated').length,9);
    assert.equal(report.rows.filter(r=>r.status==='incomplete-art-correct-facing').length,7);
    assert.deepEqual(await host.cdp.evaluate('window.__rtsUnitAnimation.errors'),[]);
    report.status=report.issues.length?'failed':'blocked';
  } catch(error) {
    check(`${phase}-scenario`,false);report.issues.push({phase,
      message:error instanceof assert.AssertionError?error.message.split('\n')[0]:'bounded scenario step failed'});
  } finally {
    // Shared transport owns page cleanup and retains late browser/capture faults.
    if(evidenceDirectory)await writeFile(path.join(evidenceDirectory,'unit-animation-acceptance.json'),JSON.stringify(report,null,2)+'\n');
  }
  return {status:report.status,checks};
}
