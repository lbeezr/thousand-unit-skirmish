import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {launchBrowser,pause} from './ui-audit-cdp.mjs';
const root='/workspace/thousand-unit-skirmish-ui-audit',pack='/docs/art-direction/vaelora-hud-study-v1/';
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');const name=decodeURIComponent(url.pathname);
 if(!(name.startsWith(pack)||name.startsWith('/assets/ui/'))||name.includes('..')){res.writeHead(404);res.end();return;}
 try{const bytes=await readFile(path.join(root,name));const ext=path.extname(name);res.setHeader('Content-Type',({'.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[ext]||'application/octet-stream');res.end(bytes);}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+pack+'preview.html';
const browser=await launchBrowser(1280,1100),cdp=browser.cdp,results=[];
const colors=['journal','wood','map']; const out=path.join(root,pack,'previews');await mkdir(out,{recursive:true});
async function load(query,width=1280,height=1100){
 await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await cdp.call('Page.navigate',{url:base+query});await pause(150);
 await cdp.evaluate(`Promise.all([...document.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=r;im.onerror=r}))).then(()=>document.fonts.ready)`);
 await pause(100);
 return cdp.evaluate(`({images:[...document.images].map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),boards:document.querySelectorAll('.board').length,contentHeight:document.querySelector('.board')?.scrollHeight})`);
}
try{
 for(const theme of colors){
  const info=await load('?theme='+theme+'&terrain=snow&state=blocked');if(info.images.some(im=>!im.ok))throw Error('Missing image '+theme);
  await writeFile(path.join(out,theme+'-snow-blocked.png'),await cdp.screenshot());
  const checks=[];
  for(const terrain of ['snow','woodland','meadow'])for(const state of ['blocked','queued']){
   await load('?theme='+theme+'&terrain='+terrain+'&state='+state);
   checks.push(await cdp.evaluate(`(()=>{const selectors=['.brand small','.stock small','.order-tag strong','.order-tag small','.summary','.action','.action small','.keys'];const samples=[];for(const selector of selectors)for(const e of document.querySelectorAll(selector)){const s=getComputedStyle(e),r=e.getBoundingClientRect();samples.push({selector,text:e.textContent.trim(),rect:[r.x,r.y,r.width,r.height],color:s.color,background:s.backgroundColor,fontSize:s.fontSize});e.dataset.contrastSketch='1';}return {theme:'${theme}',terrain:'${terrain}',state:'${state}',samples};})()`));
   await cdp.evaluate(`(()=>{const s=document.createElement('style');s.id='sketch-mask';s.textContent='[data-contrast-sketch],[data-contrast-sketch] * {color:transparent!important;text-shadow:none!important}';document.head.append(s)})()`);
   await writeFile(path.join(out,theme+'-'+terrain+'-'+state+'-text-background.png'),await cdp.screenshot());
  }
  await load('?theme='+theme+'&terrain=woodland&state=queued');
  await cdp.evaluate(`document.querySelector('.board').style.filter='grayscale(1)'`);
  await writeFile(path.join(out,theme+'-woodland-queued-grayscale.png'),await cdp.screenshot());
  const scale=await load('?theme='+theme+'&terrain=snow&state=queued',960,800);
  results.push({theme,...info,backgroundStateChecks:checks,grayscaleProxy:true,scaledViewport:{width:960,height:800,contentHeight:scale.contentHeight,fixedBoardWidth:1280,responsive:false}});
  console.log(JSON.stringify({theme,backgroundStateChecks:checks.length,grayscaleProxy:true,fixedWidthSketch:true}));
 }
 await load('?compare=1&terrain=snow&state=blocked',3864,1100);
 await writeFile(path.join(out,'three-directions-comparison.png'),await cdp.screenshot());
 await writeFile(path.join(out,'render-review.json'),JSON.stringify({date:'2026-10-02',method:'HTML/CSS direction mockups over directly captured gameplay backgrounds; not integrated screenshots',viewport:[1280,1100],devicePixelRatio:1,results,errors:cdp.errors},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}
