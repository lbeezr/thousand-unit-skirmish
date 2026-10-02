import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createFortifiedFixture} from '/workspace/thousand-unit-skirmish-ui-audit/scripts/fortified-crossing-fixture.mjs';
import {launchBrowser,pause} from './ui-audit-cdp.mjs';
const out='/workspace/thousand-unit-skirmish-ui-audit/docs/art-direction/vaelora-hud-study-v1/captures/backgrounds';
await mkdir(out,{recursive:true});
const browser=await launchBrowser(1024,640),records=[];
try{
 for(const [name,map] of [['meadow','bellweather-millrace'],['snow','pale-meridian-observation-road'],['woodland','underbough-rootways']]){
  const f=await createFortifiedFixture({mapPath:'maps/'+map+'.json'});
  try{
   await f.start();await browser.cdp.call('Page.navigate',{url:'http://127.0.0.1:'+f.port+'/'});
   let ready=false;for(let i=0;i<160;i++){ready=await browser.cdp.evaluate(`document.documentElement.dataset.boot==='ready' && document.querySelector('#food-stock')?.textContent!=='—'`);if(ready)break;await pause(100);}
   if(!ready)throw Error('Game did not initialize '+name);
   await pause(200);await browser.cdp.evaluate(`(()=>{const s=document.createElement('style');s.textContent='.topbar,.map-label,.camera-toolbar,.minimap-panel,.contextual-command-bar,.control-dock,.hud-quick-access,.field-hint,.field-order-feedback,.toast,.compass{visibility:hidden!important}';document.head.append(s);})()`);
   await pause(100);await writeFile(path.join(out,name+'-game-background.png'),await browser.cdp.screenshot());
   const info=await browser.cdp.evaluate(`(()=>{const c=document.querySelector('canvas[data-cursor-mode]');let gl=c.getContext('webgl2')||c.getContext('webgl');return {boot:document.documentElement.dataset.boot,cursor:c.dataset.cursorMode,renderer:gl?gl.getParameter(gl.RENDERER):null,viewport:[innerWidth,innerHeight]}})()`);
   records.push({name,map,...info,kind:'direct-local-gameplay-raster-with-dom-hud-hidden'});
   await writeFile(path.join(out,'capture.json'),JSON.stringify({complete:records.length===3,sourceRevision:'68f859f903ad09119594dcafca83f6de8362a9ed',method:'direct CDP; not sealed game-dev',devicePixelRatio:1,softwareAngleRequested:true,records},null,2)+'\n');
   console.log(JSON.stringify({background:name,...info}));
  }finally{await f.dispose();}
 }
}finally{await browser.close();}
