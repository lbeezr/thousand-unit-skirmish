// Owner-run browser integration check. Uses an isolated Chrome profile and local origin.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
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


const root = process.cwd();
const server = createServer(async (req,res) => {
  try {
    const relative = new URL(req.url,'http://local').pathname.slice(1) || 'audio-studio.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    const bytes = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(os.tmpdir(),'tus-audio-browser-'));
const browser = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',
   '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {stdio:'ignore'});
let cdp;
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
try {
  let port;
  for (let i=0;i<100;i++) { try { port = Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]); break; } catch { await sleep(100); } }
  assert.ok(port,'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  cdp = new Cdp(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await cdp.call('Page.navigate',{url:origin+'/audio-studio.html'});
  for (let i=0;i<100;i++) { if(await cdp.evaluate(`Boolean(document.querySelector('.studio-sidebar button'))`)) break; await sleep(100); }
  const result = await cdp.evaluate(`(async () => {
    const {createAudioLibraryStore} = await import('./src/audio-library-store.mjs');
    const {mountAudioLibrary} = await import('./src/audio-library-ui.mjs');
    const {renderCompositionWav} = await import('./src/audio-composer.mjs');
    const {createGameAudio} = await import('./src/audio.mjs');
    const store = createAudioLibraryStore();
    const wait = async test => {for(let i=0;i<100;i++){if(await test())return;await new Promise(r=>setTimeout(r,20));}throw Error('UI did not settle');};
    const click = text => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing '+text);b.click();};
    click('New pack'); await wait(()=>document.querySelector('#source-upload'));
    const wav = new ArrayBuffer(44+22050*2), v=new DataView(wav);
    const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,wav.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,44100,true);
    for(let i=0;i<22050;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*440/22050)*6000,true);
    const transfer=new DataTransfer();transfer.items.add(new File([wav],'tone.wav',{type:'audio/wav'}));
    const upload=document.querySelector('#source-upload');upload.files=transfer.files;upload.dispatchEvent(new Event('change'));
    await wait(()=>document.querySelector('.source-card'));
    let [summary]=await store.listPacks(); let loaded=await store.loadPack(summary.id);const sourceId=loaded.pack.sources[0].id;
    click('Event assignments'); click('New profile'); await wait(()=>document.querySelector('.inline-controls'));
    const event=document.querySelector('.inline-controls select');event.value='unit.worker.gather.wood';click('Add event');await wait(()=>document.querySelector('.binding-card'));
    click('Composer');await wait(()=>document.querySelector('[data-action="new"]'));
    document.querySelector('[data-action="new"]').click();
    document.querySelector('[data-action="add-track"]').click();
    document.querySelector('[data-action="add-clip"]').click();
    document.querySelector('[data-action="add-track"]').click();
    document.querySelector('[data-action="add-clip"]').click();
    document.querySelector('[data-action="play"]').click();
    await wait(()=>document.querySelector('.audio-composer__status').textContent.includes('Preview playing'));
    document.querySelector('[data-action="stop"]').click();
    document.querySelector('[data-action="save"]').click();
    await wait(async()=> (await store.loadPack(summary.id)).pack.compositions.length===1);
    loaded=await store.loadPack(summary.id);
    const composition=loaded.pack.compositions[0];
    loaded.pack.profiles[0].music.defaultCompositionId=composition.id;
    await store.savePack(loaded.pack);
    const rendered=await renderCompositionWav(composition,loaded.sourceBlobs);
    const header=new DataView(await rendered.arrayBuffer());const duration=header.getUint32(40,true)/(header.getUint32(24,true)*4);
    const archive=await store.exportPack(summary.id);await store.deletePack(summary.id);await store.importPack(archive);
    const restored=await store.loadPack(summary.id);
    const bytes=await restored.sourceBlobs[sourceId].arrayBuffer();
    if(new Uint8Array(bytes).some((x,i)=>x!==new Uint8Array(wav)[i]))throw Error('Original bytes changed');
    let cues=[]; let status='';
    const audio=createGameAudio({onCue:cue=>cues.push(cue),onPackStatus:s=>status=s});
    await audio.unlock(); await audio.setMapAudio({packId:summary.id,profileId:restored.pack.profiles[0].id},store);
    audio.playEvent({cue:'gather',kind:'worker',resource:'wood'});
    await wait(()=>cues.includes('gather'));
    await audio.setMapAudio({packId:'missing-pack',profileId:'missing-profile'},store);
    if(!status.includes('missing'))throw Error('Missing pack was not reported');
    audio.dispose();
    // A quota failure must leave the composer dirty and report the error.
    const container=document.querySelector('#audio-studio');
    mountAudioLibrary(container,{store:{...store,savePack:async()=>{throw Error('Browser storage is full');}}});
    await wait(()=>document.querySelector('.pack-choice'));
    document.querySelector('.pack-choice').click();await wait(()=>document.querySelector('.studio-tabs'));
    click('Composer');await wait(()=>document.querySelector('[data-action="save"]'));
    document.querySelector('[data-action="add-track"]').click();
    document.querySelector('[data-action="save"]').click();
    await wait(()=>document.querySelector('.audio-composer__status').textContent.includes('Browser storage is full'));
    if(!document.querySelector('[data-action="save"]').textContent.includes('*'))throw Error('Failed save cleared dirty state');
    return {packId:summary.id,sourceCount:restored.pack.sources.length,compositionCount:restored.pack.compositions.length,renderedSeconds:duration,originalBytes:bytes.byteLength,cues,status};
  })()`);
  assert.equal(result.sourceCount,1);assert.equal(result.compositionCount,1);assert.ok(result.renderedSeconds>0);
  await cdp.call('Page.reload');await sleep(300);
  assert.ok(await cdp.evaluate(`document.body.textContent.includes('Untitled pack')`),'pack survives reload');
  console.log(JSON.stringify(result,null,2));
} finally {
  cdp?.close();browser.kill();await new Promise(resolve=>server.close(resolve));await sleep(300);await rm(profile,{recursive:true,force:true});
}
