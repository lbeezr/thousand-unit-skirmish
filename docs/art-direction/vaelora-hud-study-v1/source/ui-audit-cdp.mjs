import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export class Cdp {
 constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.errors=[];
  this.open=new Promise((res,rej)=>{this.ws.addEventListener('open',res);this.ws.addEventListener('error',()=>rej(Error('CDP connection error')));});
  this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
   else if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  });
 }
 async call(method,params={}){await this.open;return new Promise((resolve,reject)=>{const id=++this.id;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
 async evaluate(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
 async screenshot(){const r=await this.call('Page.captureScreenshot',{format:'png',fromSurface:false,optimizeForSpeed:true});return Buffer.from(r.data,'base64');}
 close(){this.ws.close();}
}
export async function launchBrowser(width=1280,height=800){
 const profile=await mkdtemp(path.join(tmpdir(),'vaelora-ui-chrome-'));
 const child=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let cdp;
 try{
  let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{if(child.exitCode!==null)throw Error('Chromium startup failed');await pause(50);}}
  if(!port)throw Error('No Chromium debugging port');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await cdp.call('Page.enable');await cdp.call('Runtime.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  return {cdp,async close(){cdp.close();child.kill();await pause(100);await rm(profile,{recursive:true,force:true});}};
 }catch(e){cdp?.close();child.kill();await rm(profile,{recursive:true,force:true});throw e;}
}
