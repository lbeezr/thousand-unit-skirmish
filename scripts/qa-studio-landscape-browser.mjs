import {startQaBrowser} from './temporary-resources.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
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


let browser;
const out='docs/qa-evidence/studio-landscape-strokes-2026-09-30';let cdp;
try{
 browser=await startQaBrowser('studio-landscape-chrome-','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--window-size=1440,1000']);
 const {profile}=browser;
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break}catch{}await sleep(100)}
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('DOM.enable');await mkdir(out,{recursive:true});
 await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`const makeUrl=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{blob.text().then(text=>{try{window.__qaDownloadedMap=JSON.parse(text)}catch{}});return makeUrl(blob)};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download.endsWith('.json'))return click.call(this)};`});
 const errors=[];cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value||a.description).join(' '))});
 const room=await(await fetch(new URL('/api/rooms',BASE),{method:'POST',headers:{origin:BASE.origin,'content-type':'application/json'},body:'{}'})).json();if(!room.roomId)throw new Error('Room creation failed');
 await cdp.call('Page.navigate',{url:BASE.origin+'/?room='+room.roomId});await sleep(5000);
 if(await cdp.evaluate('document.documentElement.dataset.boot')!=='ready')throw new Error('Boot failed');
 const map={id:'studio-landscape-proof',name:'Landscape stroke proof',width:40,height:40,terrainBase:'meadow',fogOfWar:false,startingArmySize:8,spawnPoints:[{team:0,x:-14,z:0},{team:1,x:14,z:0}],obstacles:[],resourceNodes:[{id:'painted',type:'food',x:-5.5,z:-5.5,stock:50},{id:'outside-stroke',type:'food',x:.5,z:-6.5,stock:50}],triggers:[]};
 const file=path.join(profile,'study.json');await writeFile(file,JSON.stringify(map));
 await cdp.evaluate('document.querySelector("#map-studio-open").click()');
 const doc=await cdp.call('DOM.getDocument');const input=await cdp.call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#studio-import-file'});await cdp.call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});await sleep(400);
 await cdp.evaluate(`document.querySelector('#studio-grid-zoom-fit').click();document.querySelector('[data-map-tool="forest"]').click();document.querySelector('#studio-obstacle-brush-size').value='3'`);
 const rect=await cdp.evaluate(`(()=>{const r=document.querySelector('#studio-grid').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
 async function drag(cells){for(let i=0;i<cells.length;i++){const [x,y]=cells[i];await cdp.call('Input.dispatchMouseEvent',{type:i===0?'mousePressed':'mouseMoved',x:rect.x+(x+.5)/40*rect.width,y:rect.y+(y+.5)/40*rect.height,button:'left',buttons:1,clickCount:i===0?1:0})}const [x,y]=cells.at(-1);await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+(x+.5)/40*rect.width,y:rect.y+(y+.5)/40*rect.height,button:'left',buttons:0,clickCount:1})}
 async function exported(){await cdp.evaluate(`window.__qaDownloadedMap=null;document.querySelector('#studio-download').click()`);for(let i=0;i<30;i++){const map=await cdp.evaluate('window.__qaDownloadedMap');if(map)return map;await sleep(100)}throw new Error('Download failed')}
 await drag([[8,8],[8,14],[14,14],[14,22],[22,22]]);
 const curved=await exported();const has=(m,x,y)=>m.obstacles.some(r=>x>=r.column&&x<r.column+r.width&&y>=r.row&&y<r.row+r.height);
 if(!has(curved,14,14)||has(curved,20,13)||has(curved,20,8))throw new Error('Stroke became a bounding rectangle');
 if(curved.resourceNodes.some(n=>n.id==='painted')||!curved.resourceNodes.some(n=>n.id==='outside-stroke'))throw new Error('Stroke removes resources outside painted cells');
 await writeFile(out+'/curved-forest.json',JSON.stringify(curved,null,2)+'\n');let shot=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(out+'/studio-curved-forest.png',Buffer.from(shot.data,'base64'));
 await cdp.evaluate(`document.querySelector('[data-map-tool="erase"]').click();document.querySelector('#studio-obstacle-brush-size').value='1'`);await drag([[14,14],[14,14]]);const erased=await exported();if(has(erased,14,14)||!has(erased,14,15))throw new Error('Fine erase affects wrong footprint');
 await cdp.evaluate(`document.querySelector('#studio-obstacle-shape').value='rectangle';document.querySelector('[data-map-tool="water"]').click()`);await drag([[28,5],[31,8]]);const rectangle=await exported();for(let y=5;y<=8;y++)for(let x=28;x<=31;x++)if(!has(rectangle,x,y))throw new Error('Rectangle alternative failed');
 await cdp.evaluate('document.querySelector("#studio-publish").click()');await sleep(1800);if(await cdp.evaluate('document.querySelector("#map-label-title")?.textContent')!==map.name)throw new Error('Save & Play failed: '+await cdp.evaluate('document.querySelector("#studio-message")?.textContent'));
 await cdp.evaluate('document.querySelector("#camera-fit-map").click()');await sleep(600);shot=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(out+'/save-play.png',Buffer.from(shot.data,'base64'));
 await writeFile(out+'/report.json',JSON.stringify({source:'001301b9 + landscape-stroke working changes',curvedForest:true,resourcesOutsideStrokePreserved:true,fineErase:true,rectangleAlternative:true,download:true,saveAndPlay:true,errors},null,2)+'\n');if(errors.length)throw new Error(errors.join('\n'));console.log('Landscape stroke UI: curved forest, exact resource footprint, fine erase, rectangle alternative, Download JSON and Save & Play passed.');
} finally {try {cdp?.close();} finally {await browser?.dispose();}}
