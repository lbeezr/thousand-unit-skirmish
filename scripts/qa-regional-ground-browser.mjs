import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);
const BASE=new URL(process.env.RTS_QA_URL || 'http://127.0.0.1:4173');
if(!['127.0.0.1','localhost'].includes(BASE.hostname))throw new Error('Terrain study captures must use an isolated local server.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.open = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('CDP connection failed')), { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`CDP ${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else for (const listener of this.events.get(message.method) || []) listener(message.params || {});
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed'));
      this.pending.clear();
    });
  }

  on(method, callback) {
    const listeners = this.events.get(method) || new Set();
    listeners.add(callback);
    this.events.set(method, listeners);
  }

  async call(method, params = {}, timeoutMs = 10_000) {
    await this.open;
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result?.value;
  }

  close() { this.socket.close(); }
}


const profile=await mkdtemp('/tmp/regional-ground-chrome-');
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--window-size=1280,900','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const densePlacementCapture=process.env.RTS_QA_DENSE_PLACEMENT==='1';
const layoutCapture=process.env.RTS_QA_GROUND_LAYOUT==='1';
const variantStudy=process.env.RTS_QA_GROUND_VARIANTS==='1';
const forestStudy=process.env.RTS_QA_FOREST_SPECIES==='1';
const edgeStudy=process.env.RTS_QA_PAINT_EDGES==='1';
const soilStudy=process.env.RTS_QA_SOIL_STUDY==='1';
const stoneStudy=process.env.RTS_QA_STONE_STUDY==='1';
const wetStudy=process.env.RTS_QA_WET_STUDY==='1';
const waterStudy=process.env.RTS_QA_WATER_CONTOUR==='1';
const out=process.env.RTS_QA_EVIDENCE || 'docs/qa-evidence/underbough-ground-kit-2026-10-01';
let cdp;
try {
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break}catch{}await sleep(100)}
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('DOM.enable');await cdp.call('Network.enable');await mkdir(out,{recursive:true});
 const errors=[];cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value||a.description).join(' '))});
 cdp.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails?.exception?.description||e.exceptionDetails?.text));
 cdp.on('Network.responseReceived',e=>{if(e.response.status>=400&&e.response.url.includes('/assets/'))errors.push('Asset '+e.response.status+' '+e.response.url)});
 const room=await(await fetch(new URL('/api/rooms',BASE),{method:'POST',headers:{origin:BASE.origin,'content-type':'application/json'},body:'{}'})).json();
 if(!room.roomId)throw new Error('Room creation failed');
 for(const id of ['underbough-rootways','bellweather-millrace']) for(const mode of (edgeStudy?['legacy','organic']:waterStudy?['chamfered','curved']:forestStudy?['scattered','groves']:variantStudy?['single','mixed']:['legacy','kit'])) {
  await cdp.call('Page.navigate',{url:BASE.origin+'/?room='+room.roomId+'&regionalGrounds='+(edgeStudy||waterStudy||forestStudy||variantStudy||layoutCapture||densePlacementCapture?'kit':mode)+(edgeStudy?'&paintEdges='+mode:'')+(variantStudy?'&groundVariants='+mode:'')+(forestStudy?'&forestSpecies='+mode:'')+(waterStudy?'&waterOutline='+mode:'')});await sleep(4000);
  for(let i=0;i<100;i++){if(await cdp.evaluate('document.documentElement.dataset.boot')==='ready')break;await sleep(200)}
  if(await cdp.evaluate('document.documentElement.dataset.boot')!=='ready')throw new Error('Browser boot failed');
  const map=JSON.parse(await readFile('maps/'+id+'.json','utf8'));
  if(densePlacementCapture&&id==='underbough-rootways'&&mode==='legacy')map.terrainPatches=map.terrainPatches.filter(p=>p.material!=='long-grass');
  if(layoutCapture&&id==='underbough-rootways'&&mode==='legacy')map.terrainBase='forest-floor';
  if(stoneStudy||wetStudy||soilStudy) {
   const paints=Array(map.width*map.height).fill(null);
   for(const p of map.terrainPatches)for(let r=p.row;r<p.row+p.height;r++)for(let c=p.column;c<p.column+p.width;c++)paints[r*map.width+c]=p.material;
   for(let r=26;r<34;r++)for(let c=14+Math.abs(30-r);c<26-Math.abs(30-r);c++){
    if(map.obstacles.some(o=>c>=o.column&&c<o.column+o.width&&r>=o.row&&r<o.row+o.height))throw Error('Material study must remain on exposed open ground');
    paints[r*map.width+c]=soilStudy?'forest-floor':wetStudy?'tidal-mud':'scree';
   }
   map.terrainPatches=[];
   for(let r=0;r<map.height;r++)for(let c=0;c<map.width;){
    const material=paints[r*map.width+c];let end=c+1;
    while(end<map.width&&paints[r*map.width+end]===material)end++;
    if(material)map.terrainPatches.push({column:c,row:r,width:end-c,height:1,material});
    c=end;
   }
   if(wetStudy)for(let r=26;r<34;r++) {
    const column=26-Math.abs(30-r),width=6-Math.abs(30-r);
    if(map.obstacles.some(o=>r>=o.row&&r<o.row+o.height&&column<o.column+o.width&&column+width>o.column))throw Error('Water-margin study overlaps existing obstacles');
    map.obstacles.push({column,row:r,width,height:1,material:'water'});
   }
   if(mode==='kit'||mode==='curved'||mode==='mixed'||mode==='organic')await writeFile(out+'/'+id+(soilStudy?'-soil-study.json':wetStudy?'-wet-study.json':'-stone-study.json'),JSON.stringify(map,null,2)+'\n');
  }
  map.id='landscape-review';map.name=id;map.fogOfWar=false;
  const file=path.join(profile,'study.json');await writeFile(file,JSON.stringify(map));
  await cdp.evaluate('document.querySelector("#map-studio-open").click()');
  const doc=await cdp.call('DOM.getDocument');const input=await cdp.call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#studio-import-file'});
  await cdp.call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});await sleep(400);
  await cdp.evaluate('document.querySelector("#studio-publish").click()');
  for(let attempt=0;attempt<100;attempt++){
   if(await cdp.evaluate('document.querySelector("#map-label-title")?.textContent')===id)break;
   await sleep(100);
  }
  if(await cdp.evaluate('document.querySelector("#map-label-title")?.textContent')!==id){
   const failure=await cdp.evaluate('({title:document.querySelector("#map-label-title")?.textContent,studioMessage:document.querySelector("#studio-message")?.textContent})');
   await writeFile(out+'/import-failure.json',JSON.stringify({id,mode,...failure},null,2)+'\n');
   throw new Error('Map import failed: '+JSON.stringify(failure));
  }
  await cdp.evaluate('document.querySelector("#camera-fit-map").click()');await sleep(600);
  const shot=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+id+'-'+mode+'-strategic.png',Buffer.from(shot.data,'base64'));
  await cdp.evaluate(`(()=>{const c=document.querySelector('#viewport canvas');const r=c.getBoundingClientRect();c.dispatchEvent(new WheelEvent('wheel',{deltaY:-700,clientX:r.x+r.width/2,clientY:r.y+r.height/2,cancelable:true}));document.querySelector('#camera-home-base').click()})()`);
  await sleep(400);const ordinary=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+id+'-'+mode+'-ordinary.png',Buffer.from(ordinary.data,'base64'));
  if(id==='underbough-rootways'&&(mode==='kit'||mode==='mixed'||mode==='groves'||mode==='curved'||mode==='organic')) {
   const proof=await cdp.evaluate(`(async()=>{
    const {createGroundSurfaces,environmentTheme,addObstacleEnvironmentSprites}=await import('/src/environment-art.mjs');
    const map=${JSON.stringify(map)},original=JSON.stringify(map),current=location.href;
    const collect=async definition=>{
     const meshes=createGroundSurfaces(definition),textures=meshes.flatMap(m=>[m.material?.map,m.material?.userData.groundVariantTexture]).filter(Boolean);
     await Promise.all(textures.map(async texture=>{const deadline=Date.now()+10000;while(!texture.image?.complete||!texture.image.naturalWidth){if(Date.now()>deadline)throw new Error('Ground texture did not load');await new Promise(resolve=>setTimeout(resolve,50));}}));
     const images=textures.map(texture=>texture.image);
     const files=[...new Set(images.map(im=>(im.currentSrc||im.src).split('/').at(-1).split('?')[0]))].sort();
     for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();for(const texture of mesh.userData.ownedGroundTextures||[])texture.dispose();}
     return files;
    };
    const surfaces=createGroundSurfaces(map);const baseTexture=surfaces[0].material.map;
    while(!baseTexture.image?.complete)await new Promise(r=>setTimeout(r,50));
    const baseFile=baseTexture.image.src.split('/').at(-1).split('?')[0];
    if(${layoutCapture}&&baseFile!=='underbough-clearing-grass-v2.webp')throw new Error('Clearing base did not use grass');
    const forestObjects=[];const slots=addObstacleEnvironmentSprites(map,map.width/2,map.height/2,m=>forestObjects.push(m));
    const families=[...new Set([...slots.values()].map(s=>s.family))];
    if(environmentTheme(map)!=='forest-floor'||families.some(f=>!f.startsWith('underbough-')))throw new Error('Clearing paint changed regional vegetation');
    for(const m of [...surfaces,...forestObjects])m.geometry.dispose();
    const regional=await collect(map);
    const control=await collect({...map,region:'bellweather',terrainBase:'meadow'});
    const siltmouthsControl=${wetStudy}?await collect({...map,region:'siltmouths',terrainBase:'tidal-mud',terrainPatches:[]}):null;
    if(siltmouthsControl&&(!siltmouthsControl.includes('siltmouths-quiet-mud.webp')||siltmouthsControl.some(f=>f.startsWith('underbough-'))))throw Error('Wet-soil region cache leaked');
    const legacyUrl=new URL(current);legacyUrl.searchParams.set('regionalGrounds','legacy');history.replaceState(null,'',legacyUrl);
    const legacy=await collect(map);history.replaceState(null,'',current);
    const required=['underbough-clearing-grass-v2.webp','underbough-root-soil-v2.webp','underbough-worn-dirt-v2.webp'];
    if(map.terrainPatches.some(p=>p.material==='long-grass'))required.push('underbough-dense-growth-v2.webp');
    if(${stoneStudy})required.push('underbough-shaded-stone-v2.webp');
    if(${wetStudy})required.push('underbough-wet-bank-v2.webp');
    if(${variantStudy})required.push('underbough-clearing-grass-02-v2.webp','underbough-root-soil-02-v2.webp','underbough-worn-dirt-02-v2.webp');
    if(!required.every(file=>regional.includes(file)))throw new Error('Regional ground roles did not load their kit');
    if(control.some(file=>file.startsWith('underbough-'))||!control.includes('meadow.webp')||!control.includes('dirt.webp'))throw new Error('Ground cache check failed: '+JSON.stringify({regional,control}));
    if(legacy.some(file=>file.startsWith('underbough-'))||!legacy.includes('forest-floor.webp'))throw new Error('Legacy comparison failed');
    if(JSON.stringify(map)!==original)throw new Error('Ground rendering mutated map rules');
    return {baseFile,vegetationTheme:environmentTheme(map),families,regional,control,siltmouthsControl,legacy,regionCacheIsolation:true,unchangedMapDefinition:true};
   })()`);
   await writeFile(out+'/renderer-proof.json',JSON.stringify(proof,null,2)+'\n');
  }
  console.log('Captured '+id+' '+mode);
 }
 await writeFile(out+'/capture-report.json',JSON.stringify({source:edgeStudy?'same disposable exposed soil studies and ground sources; prior versus broader Underbough paint transitions; Bellweather control':soilStudy?'disposable exposed forest-floor paint on copied maps; paired clearing/soil sources versus single; Bellweather control':waterStudy?'same disposable shoreline maps and regional kits; per-cell chamfers versus connected conservative curves':wetStudy?'disposable irregular wet-soil paint on copied maps; global versus regional ground kit; Bellweather and Siltmouths controls':stoneStudy?'disposable irregular exposed-stone paint on copied maps; global versus regional ground kit; Bellweather control':forestStudy?'same authored map, ground kit and four tree forms; scattered selection versus dominant groves; Bellweather control':variantStudy?'same authored maps and regional kit; single versus paired clearing, woodland and worn-soil sources; Bellweather control':densePlacementCapture?'same map and regional kit; original clearings versus authored dense woodland margins; Bellweather control':layoutCapture?'same authored map and kit; previous forest-floor base versus clearing grass; Bellweather control':'regional ecology kit working branch; same map, renderer and cameras, regionalGrounds=legacy comparison',fog:'disabled only in disposable capture copies',errors},null,2)+'\n');
 if(errors.length)throw new Error(errors.join('\n'));
}finally{cdp?.close();chrome.kill('SIGTERM');}
