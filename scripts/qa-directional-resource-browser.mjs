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
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result?.value;
  }

  close() { this.socket.close(); }
}


const profile=await mkdtemp('/tmp/vaelora-vegetation-chrome-');
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--window-size=1280,720','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});

const out=process.env.RTS_DIRECTIONAL_OUTPUT || 'docs/qa-evidence/directional-live-harvest-2026-10-01';
if(!/^docs\/qa-evidence\/[a-z0-9-]+$/.test(out))throw new Error('Invalid evidence directory');
let cdp;
try {
 let port;for(let i=0;i<100;i++){try{port=Number((await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break}catch{}await sleep(100)}
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 const errors=[];cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value||a.description).join(' '))});
 await cdp.call('Page.enable');await cdp.call('Runtime.enable');await mkdir(out,{recursive:true});
 await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`const NativeWebSocket=window.WebSocket;window.WebSocket=class extends NativeWebSocket{constructor(...args){super(...args);window.__qaSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='state')window.__qaState=m;else if(m.state)window.__qaState=m.state;});}};`});
 const room=await(await fetch(new URL('/api/rooms',BASE),{method:'POST',headers:{origin:BASE.origin,'content-type':'application/json'},body:'{}'})).json();if(!room.roomId)throw Error(room.error||'Room failed');
 await cdp.call('Page.navigate',{url:BASE.origin+'/?room='+room.roomId});await sleep(5500);
 if(await cdp.evaluate('document.documentElement.dataset.boot')!=='ready')throw Error('Game did not boot');
 const map={id:'directional-harvest-check',name:'DIRECTIONAL HARVEST CHECK',width:40,height:40,terrainBase:'meadow',fogOfWar:false,startingArmySize:8,startingResources:{food:0,wood:0},spawnPoints:[{team:0,x:-14,z:0},{team:1,x:14,z:0}],obstacles:[],resourceNodes:[{id:'berry-check',type:'food',x:-10,z:2,stock:6},{id:'oak-check',type:'wood',x:-10,z:-2,stock:6}],triggers:[],scenarioEvents:[]};
 await cdp.evaluate(`window.__qaSocket.send(JSON.stringify({type:'publishMap',persist:false,map:${JSON.stringify(map)}}))`);
 for(let i=0;i<100;i++){if(await cdp.evaluate('document.querySelector("#map-label-title")?.textContent')===map.name)break;await sleep(100)}
 if(await cdp.evaluate('document.querySelector("#map-label-title")?.textContent')!==map.name)throw Error('Map publication failed');
 await cdp.evaluate('document.querySelector("#camera-home-base").click()');
 await cdp.evaluate(`(()=>{const r=document.querySelector('#viewport canvas').getBoundingClientRect();document.querySelector('#viewport canvas').dispatchEvent(new WheelEvent('wheel',{deltaY:-1200,clientX:r.x+r.width/2,clientY:r.y+r.height/2,cancelable:true}));document.querySelector('#camera-home-base').click()})()`);await sleep(600);
 const shot=async name=>{const image=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+name+'.png',Buffer.from(image.data,'base64'));};
 await shot('full');
 const requests=await cdp.evaluate(`performance.getEntriesByType('resource').filter(e=>e.name.includes('fixed-camera-v3')).map(e=>new URL(e.name).pathname)`);
 if(!['berries','oak'].every(f=>requests.some(p=>p.endsWith('/'+f+'-atlas.webp'))))throw Error('Directional atlases not used by full game');
 const observed=[];
 for(const [nodeId,worker] of [['berry-check',0],['oak-check',1]]){
  await cdp.evaluate(`window.__qaSocket.send(JSON.stringify({type:'gather',ids:[${worker}],nodeId:${JSON.stringify(nodeId)}}))`);
  for(const [stage,limit] of [['worked',4],['low',2],['depleted',0]]){
   let stock;for(let i=0;i<400;i++){stock=await cdp.evaluate(`window.__qaState.resourceNodes?.find(n=>n.id===${JSON.stringify(nodeId)})?.stock`);if(stock!==undefined&&stock<=limit)break;await sleep(100)}
   if(stock===undefined||stock>limit)throw Error('Harvest did not reach '+nodeId+':'+stage);
   await shot(nodeId+'-'+stage);observed.push({nodeId,stage,stock});
  }
 }
 await cdp.evaluate('window.__qaSocket.send(JSON.stringify({type:"reset"}))');
 let restored=false;for(let i=0;i<100;i++){restored=await cdp.evaluate(`window.__qaState.resourceNodes?.every(n=>n.stock===6)`);if(restored)break;await sleep(100)}if(!restored)throw Error('Reset failed');await sleep(300);await shot('reset');
 const beforeReload=await cdp.evaluate('JSON.stringify(window.__qaState.resourceNodes)');
 await cdp.call('Page.reload',{ignoreCache:true});await sleep(5500);if(await cdp.evaluate('document.documentElement.dataset.boot')!=='ready')throw Error('Reload failed');await shot('reload');
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(out+'/proof.json',JSON.stringify({map,observed,reset:true,reload:true,requests,errors,beforeReload},null,2)+'\n');console.log('Directional live harvest and reload passed.');
} finally {cdp?.close();chrome.kill('SIGTERM')}
