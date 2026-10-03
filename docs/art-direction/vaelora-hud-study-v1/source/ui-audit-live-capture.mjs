import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createFortifiedFixture} from '/workspace/thousand-unit-skirmish-ui-audit/scripts/fortified-crossing-fixture.mjs';
import {launchBrowser,pause} from './ui-audit-cdp.mjs';
const out='/workspace/thousand-unit-skirmish-ui-audit/docs/art-direction/vaelora-hud-study-v1/captures/attempt-2';
await mkdir(out,{recursive:true});
const browser=await launchBrowser(), records=[];
const cdp=browser.cdp;
const selectors=['#food-stock','#wood-stock','.resource-stock span','.hud-team span','#map-summary','#command-hint','#placement-status','.field-hint','#economy-status','.contextual-command-bar button','.action-disabled-reason'];
async function snapshot(label){
 const state=await cdp.evaluate(`(()=>{const c=document.querySelector('canvas[data-cursor-mode]'),p=document.querySelector('#placement-status');return {boot:document.documentElement.dataset.boot,cursor:c?.dataset.cursorMode,cursorCss:c?getComputedStyle(c).cursor:null,selected:document.querySelector('#selected-total')?.textContent,placement:{state:p?.dataset.state,text:p?.textContent,visible:p?!p.hidden:false},fontsReady:document.fonts.status,viewport:[innerWidth,innerHeight]};})()`);
 await writeFile(path.join(out,label+'.png'),await cdp.screenshot());
 const samples=await cdp.evaluate(`(()=>{const selectors=${JSON.stringify(selectors)};const seen=new Set(),out=[];for(const selector of selectors)for(const e of document.querySelectorAll(selector)){if(seen.has(e)||!e.getClientRects().length||e.hidden)continue;const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.visibility==='hidden'||Number(s.opacity)===0||r.width<2||r.height<2)continue;seen.add(e);let opacity=1;for(let p=e;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);out.push({selector,text:e.textContent.trim().slice(0,140),rect:[r.x,r.y,r.width,r.height],color:s.color,fontSize:s.fontSize,opacity,disabled:e.disabled===true});e.dataset.uiContrastSample=String(out.length-1);}return out;})()`);
 // Keep layout, paint and opacity; remove only sampled text for background measurement.
 await cdp.evaluate(`(()=>{const s=document.createElement('style');s.id='ui-audit-hide-text';s.textContent='[data-ui-contrast-sample], [data-ui-contrast-sample] * {color:transparent!important;text-shadow:none!important;}';document.head.append(s);})()`);
 await pause(80);await writeFile(path.join(out,label+'-text-background.png'),await cdp.screenshot());
 await cdp.evaluate(`document.querySelector('#ui-audit-hide-text').remove();document.querySelectorAll('[data-ui-contrast-sample]').forEach(e=>delete e.dataset.uiContrastSample)`);
 records.push({label,...state,samples});
 await writeFile(path.join(out,'live-capture-partial.json'),JSON.stringify({sourceRevision:'68f859f903ad09119594dcafca83f6de8362a9ed',complete:false,records},null,2)+'\n');
 console.log(JSON.stringify({capture:label,cursor:state.cursor,selected:state.selected,placement:state.placement,samples:samples.length}));
}
try{
 for(const [name,map] of [['meadow','bellweather-millrace'],['snow','pale-meridian-observation-road'],['woodland','underbough-rootways']].filter(([n])=>!process.argv[2]||process.argv[2]===n)){
  const fixture=await createFortifiedFixture({mapPath:'maps/'+map+'.json'});
  try{
   await fixture.start();await cdp.call('Page.navigate',{url:'http://127.0.0.1:'+fixture.port+'/?rendererCapture=environment-state'});
   let ready=false;for(let i=0;i<160;i++){ready=await cdp.evaluate(`document.documentElement.dataset.boot==='ready' && document.querySelector('#food-stock')?.textContent!=='—'`);if(ready)break;await pause(100);}
   if(!ready)throw Error('Game did not initialize '+name);
   await pause(600);await snapshot(name+'-idle');
   // The game's visible contextual action selects the actual current Workers.
   await cdp.evaluate(`document.querySelector('[data-context-proxy="select-idle-workers"]').click()`);
   await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:300});
   await pause(200);
   await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
   await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:300,modifiers:8});
   await pause(150);await snapshot(name+'-move-queued');
   await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:0});
   await cdp.evaluate(`document.querySelector('[data-context-proxy="attack-move-toggle"]').click()`);
   await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:300});
   await pause(150);await snapshot(name+'-attack-move');
   await cdp.evaluate(`document.querySelector('[data-context-build]').click();document.querySelector('#build-house').click()`);
   const found=new Set();
   for(const [x,y] of [[640,400],[680,400],[600,400],[750,350],[500,400],[800,450],[400,350],[1000,500],[350,500],[900,200],[300,200],[640,250],[450,260],[720,550],[950,600]]){
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await pause(70);
    const status=await cdp.evaluate(`document.querySelector('#placement-status').dataset.state`);
    if(['clear','blocked'].includes(status)&&!found.has(status)){found.add(status);await snapshot(name+'-build-'+status);}
    if(found.size===2)break;
   }
   await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   // Direct gameplay raster, with DOM HUD hidden only for the background capture.
   await cdp.evaluate(`(()=>{const s=document.createElement('style');s.id='ui-audit-hide-hud';s.textContent='.topbar,.map-label,.camera-toolbar,.minimap-panel,.contextual-command-bar,.control-dock,.hud-quick-access,.field-hint,.field-order-feedback,.toast,.compass{visibility:hidden!important}';document.head.append(s);})()`);
   await pause(150);await writeFile(path.join(out,name+'-game-background.png'),await cdp.screenshot());
   await cdp.evaluate(`document.querySelector('#ui-audit-hide-hud').remove()`);
   records.push({label:name+'-game-background',kind:'direct-local-gameplay-raster-with-dom-hud-hidden',map});
  }finally{await fixture.dispose();}
 }
 await writeFile(path.join(out,'live-capture.json'),JSON.stringify({date:'2026-10-02',sourceRevision:'68f859f903ad09119594dcafca83f6de8362a9ed',method:'isolated game-owned server + direct Chromium CDP screenshots; not sealed game-dev captures',browser:'/usr/bin/chromium',softwareAngleRequested:true,viewport:[1280,800],devicePixelRatio:1,nativeCursorPixelsCaptured:false,errors:cdp.errors,records},null,2)+'\n');
 console.log(JSON.stringify({captures:records.length,jsErrors:cdp.errors}));
}finally{await browser.close();}
