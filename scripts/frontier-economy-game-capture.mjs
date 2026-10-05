// Opt-in normal live-room proof. Commands use the game's socket; no state/asset injection.
import assert from 'node:assert/strict';
import {runFarmRenewalCaptureStep} from './farm-renewal-capture-step.mjs';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createFortifiedBrowser} from './fortified-browser-fixture.mjs';
import {qualifyPackedGame} from './renderer-qualification.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const types=['mill','farm','dock'];
const map={id:'frontier-economy-art-proof',name:'Frontier economy art proof',width:160,height:160,
 terrainSeed:19,fogOfWar:false,startingArmySize:24,startingResources:{food:1000,wood:1000},
 spawnPoints:[{team:0,x:-20,z:0},{team:1,x:20,z:0}],
 obstacles:[66,91].map(column=>({column,row:90,width:6,height:8,material:'water'})),
 resourceNodes:[],triggers:[],scenarioEvents:[]};
function probe(){
 window.__rtsCaptureDiagnostics=true;
 const state=window.__frontierProof={errors:[],number:0,pending:null,request:()=>new Promise(resolve=>{state.pending=resolve;})};
 const nativeError=console.error.bind(console);console.error=(...args)=>{state.errors.push('console-error');nativeError(...args);};
 window.addEventListener('error',()=>state.errors.push('exception'),true);
 window.addEventListener('unhandledrejection',()=>state.errors.push('promise-rejection'));
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=callback=>raf(time=>{
  callback(time);state.number++;
  if(!state.pending)return;
  const resolve=state.pending;state.pending=null;
  const canvas=document.querySelector('#viewport canvas'),gl=canvas?.getContext('webgl2');
  if(!gl){resolve({version:null});return;}
  const pixel=new Uint8Array(4),pixels=[];
  for(let y=0;y<6;y++)for(let x=0;x<8;x++){
   gl.readPixels(Math.floor((x+.5)*gl.drawingBufferWidth/8),Math.floor((y+.5)*gl.drawingBufferHeight/6),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);pixels.push(...pixel);
  }
  resolve({number:state.number,time,version:gl.getParameter(gl.VERSION),contextLost:gl.isContextLost(),glError:gl.getError(),pixels,
   canvasPng:canvas.toDataURL('image/png').split(',')[1]});
 });
}
const snapshot='window.__rtsEnvironmentStateSnapshot';
async function liveProof({browser,origin,headers={},evidenceDirectory,sourceRevision}){
 await mkdir(evidenceDirectory,{recursive:true});const pages=[],report={schemaVersion:1,status:'failed',scope:'ordinary-paid-economy-building-art',
  sourceRevision,mapId:map.id,defaultPresentation:true,previewFlags:[],sandbox:'enabled',states:[],frames:[],servedAssets:[],checks:[]};
 try{
  // Same ordinary room creation endpoint as the Map Studio entry. Keep the invite private.
  const response=await fetch(`${origin}/api/rooms`,{method:'POST',headers:{...headers,'content-type':'application/json',Origin:origin},body:JSON.stringify({mode:'pvp'})});
  assert.equal(response.status,201,'create an isolated authorized room');const {roomId}=await response.json();assert.match(roomId,/^[A-Za-z0-9_-]{32}$/);
  for(let team=0;team<2;team++){
   const page=await browser.page('about:blank',{headers,beforeScript:`(${probe.toString()})()`});pages.push(page);
   await page.cdp.call('Page.navigate',{url:`${origin}/?room=${roomId}`});
   await page.wait(`${snapshot}?.workers.length && ${snapshot}.team===${team} && typeof window.__rtsEnvironmentCaptureCommand==='function'`,'live ordinary team and asset initialization',60000);
  }
  const command=async(team,payload)=>assert.equal(await pages[team].cdp.evaluate(`window.__rtsEnvironmentCaptureCommand(${JSON.stringify(payload)})`),true,'ordinary live command');
  await command(0,{type:'publishMap',map});
  for(const page of pages)await page.wait(`${snapshot}?.mapId===${JSON.stringify(map.id)} && ${snapshot}.workers.length`,'published playable map');
  const workers=[];
  for(let team=0;team<2;team++){
   workers[team]=(await pages[team].cdp.evaluate(snapshot)).workers.filter(w=>w.team===team).map(w=>w.id);assert.ok(workers[team].length>=3);
   for(let i=0;i<3;i++)await command(team,{type:'move',ids:[workers[team][i]],x:(team?1:-1)*[18.5,13.5,12.5][i],z:[5.5,-.5,5.5][i]});
  }
  for(let team=0;team<2;team++){
   for(let i=0;i<3;i++)await pages[team].wait(`${snapshot}.workers.some(w=>w.id===${workers[team][i]}&&Math.hypot(w.x-(${(team?1:-1)*[18.5,13.5,12.5][i]}),w.z-(${[5.5,-.5,5.5][i]}))<.8)`,'ordinary builder arrival',40000);
   for(let i=0;i<3;i++)await command(team,{type:'build',buildingType:types[i],ids:[workers[team][i]],x:(team?1:-1)*[18.5,13.5,12.5][i],z:[8.5,2.5,8.5][i]});
  }
  const capture=async(team,name)=>{
   report.checkpoint=name;
   const page=pages[team];
   await page.cdp.call('Page.bringToFront');
   const frame=await page.cdp.evaluate('window.__frontierProof.request()');
   assert.match(frame.version,/^WebGL 2\.0/);assert.equal(frame.contextLost,false);assert.equal(frame.glError,0);
   assert.equal(frame.pixels.length,192);assert.ok(new Set(Array.from({length:48},(_,i)=>frame.pixels.slice(i*4,i*4+4).join(','))).size>1);
   const canvas=Buffer.from(frame.canvasPng,'base64');delete frame.canvasPng;
   const png=Buffer.from((await page.cdp.call('Page.captureScreenshot',{format:'png',fromSurface:true})).data,'base64');
   assert.ok(canvas.length>10000&&png.length>10000);await writeFile(path.join(evidenceDirectory,name+'.png'),png);await writeFile(path.join(evidenceDirectory,name+'-canvas.png'),canvas);
   report.frames.push({...frame,team,image:name+'.png',canvas:name+'-canvas.png',sha256:createHash('sha256').update(png).digest('hex'),canvasSHA256:createHash('sha256').update(canvas).digest('hex')});
   const state=await page.cdp.evaluate(snapshot);
   report.states.push({checkpoint:name,team,bank:state.bank,cameraZoom:state.cameraZoom,buildings:state.buildings.filter(b=>types.includes(b.type))});
  };
  // Capture real paid construction before waiting for Complete.
  for(let team=0;team<2;team++){
   const page=pages[team];
   await page.cdp.evaluate("document.querySelector('#camera-home-base').click()");
   await page.wait(`${snapshot}?.buildings.filter(b=>b.team===${team}&&['mill','farm','dock'].includes(b.type)).length===3`,'paid foundations');
   await page.wait(`${snapshot}.buildings.filter(b=>b.team===${team}&&['mill','farm','dock'].includes(b.type)).every(b=>b.capture?.decoded && !b.capture.fallbackVisible)`,'authored construction frames');
   await capture(team,`team-${team}-construction`);
  }
  for(let team=0;team<2;team++){
   await pages[team].wait(`${snapshot}.buildings.filter(b=>b.team===${team}&&['mill','farm','dock'].includes(b.type)).every(b=>b.complete && b.capture?.visible && b.capture.state==='complete')`,'real paid completion',60000);
   await capture(team,`team-${team}-complete`);
   const state=await pages[team].cdp.evaluate(snapshot);
   assert.equal(state.bank.wood,765,'all three builds debit their exact ordinary cost');
   for(const building of state.buildings.filter(b=>b.team===team&&types.includes(b.type))){
    assert.equal(building.capture.depthMatches,true);assert.equal(building.capture.standardVisible,true);
    assert.match(building.capture.manifestPath,/frontier-economy-models-v1/);
    assert.equal(building.capture.fallbackVisible,false);
   }
  }
  // One actual click on the Farm body exercises the existing player picker/HUD.
  const farm=(await pages[0].cdp.evaluate(snapshot)).buildings.find(b=>b.team===0&&b.type==='farm');
  await pages[0].cdp.call('Page.bringToFront');
  await pages[0].cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:farm.screen.x,y:farm.screen.y,button:'left',clickCount:1});
  await pages[0].cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:farm.screen.x,y:farm.screen.y,button:'left',clickCount:1});
  await pages[0].wait("/Farm/i.test(document.querySelector('#selected-building-name')?.textContent || '')",'ordinary Farm body selection');
  await capture(0,'farm-selected');
  await command(0,{type:'gather',ids:workers[0],nodeId:'farm:'+farm.id});
  await pages[0].wait(`${snapshot}.buildings.find(b=>b.id===${JSON.stringify(farm.id)})?.harvestStock===0`,'real finite Farm depletion',150000);
  await pages[0].wait(`${snapshot}.buildings.find(b=>b.id===${JSON.stringify(farm.id)})?.capture?.state==='exhausted' && ${snapshot}.buildings.find(b=>b.id===${JSON.stringify(farm.id)})?.capture?.decoded`,'decoded exhausted field');
  await capture(0,'farm-exhausted');
  report.renewal=await runFarmRenewalCaptureStep({page:pages[0],team:0,plotId:farm.id,
   workerIds:workers[0],capture:name=>capture(0,name)});
  for(let team=0;team<2;team++){
   await pages[team].cdp.call('Page.bringToFront');
   await pages[team].cdp.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:330,deltaX:0,deltaY:420});
   await new Promise(resolve=>setTimeout(resolve,500));
   await capture(team,`team-${team}-strategic`);
  }

  const seen=new Map();
  for(const state of report.states)for(const building of state.buildings){
   const c=building.capture;if(c?.decoded&&c.framePath&&c.sha256)seen.set(c.framePath,c.sha256);
  }
  for(const [asset,expected]of seen){
   const response=await fetch(origin+asset,{headers});assert.equal(response.status,200);
   assert.match(response.headers.get('content-type'),/image\/png/);
   const bytes=Buffer.from(await response.arrayBuffer());const hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,expected);
   report.servedAssets.push({path:asset,sha256:hash,bytes:bytes.length});
  }
  for(const page of pages){assert.deepEqual(page.errors,[]);assert.deepEqual(await page.cdp.evaluate('window.__frontierProof.errors'),[]);}
  assert.ok(report.frames.at(-1).number>report.frames[0].number);
  assert.notEqual(report.frames.at(-1).canvasSHA256,report.frames[0].canvasSHA256);
  report.checks=['two-live-teams','paid-construction','paid-completion','registered-default-views','live-ownership-standards','shared-depth','farm-body-selection','finite-harvest-exhaustion','explicit-selected-worker-replant','renewed-first-food-delivery','served-frame-hashes','advancing-webgl2-frames','no-browser-errors'];
  report.status='passed';return report;
 }catch(error){report.failure=error.message;report.diagnostics=[];for(const page of pages)report.diagnostics.push(await page.cdp.evaluate('({probeErrors:window.__frontierProof?.errors,frame:window.__frontierProof?.number,team:window.__rtsEnvironmentStateSnapshot?.team,workers:window.__rtsEnvironmentStateSnapshot?.workers,buildings:window.__rtsEnvironmentStateSnapshot?.buildings,notice:document.querySelector("#toast")?.textContent})').catch(()=>null));throw error;}
 finally{await writeFile(path.join(evidenceDirectory,'game-proof.json'),JSON.stringify(report,null,2)+'\n');for(const page of pages)await page.dispose();}
}
if(process.argv[2]==='--packed'){
 const [,,flag,packFile,output]=process.argv;assert.ok(packFile&&output&&process.argv.length===5);
 const pack=JSON.parse(await readFile(packFile,'utf8'));
 const qualification=await qualifyPackedGame(packFile,output,{captureCase:{id:'frontier-economy',run:async context=>{
  // Use pages owned by qualification, including its diagnostics and cleanup.
  const browser={page:async(url,options)=>{
   const page=await context.openPage();await page.cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:options.beforeScript});return {...page,dispose:async()=>{}};
  }};
  const proof=await liveProof({browser,origin:context.origin,evidenceDirectory:output,sourceRevision:pack.sourceRevision});return proof.status;
 }}});
 console.log(JSON.stringify({status:qualification.status,source:qualification.source,release:qualification.release,issues:qualification.issues}));process.exitCode=qualification.status==='passed'?0:1;
}else if(process.argv[2]==='--staging'){
 const [,,flag,origin,sourceRevision,output]=process.argv;assert.ok(origin&&sourceRevision&&output&&process.argv.length===6);
 assert.equal(new URL(origin).protocol,'https:');assert.ok(process.env.RTS_ACCESS_PASSWORD);
 const authorization='Basic '+Buffer.from((process.env.RTS_ACCESS_USER||'players')+':'+process.env.RTS_ACCESS_PASSWORD).toString('base64');
 const headers={Authorization:authorization};
 const health=await(await fetch(origin+'/health',{headers})).json();assert.equal(health.buildIdentity.sourceRevision,sourceRevision);
 const browser=await createFortifiedBrowser();try{const report=await liveProof({browser,origin,headers,evidenceDirectory:output,sourceRevision});console.log(JSON.stringify({status:report.status,sourceRevision,frames:report.frames.length,checks:report.checks}));}finally{await browser.dispose();}
}else throw Error('Usage: --packed PACK_JSON EVIDENCE_DIR | --staging HTTPS_ORIGIN SOURCE_SHA EVIDENCE_DIR');
