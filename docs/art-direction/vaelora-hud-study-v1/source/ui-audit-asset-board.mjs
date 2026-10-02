import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launchBrowser,pause} from './ui-audit-cdp.mjs';
const root='/workspace/thousand-unit-skirmish-ui-audit',pack='/docs/art-direction/vaelora-hud-study-v1/';
const server=createServer(async(req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 if(!(name.startsWith(pack)||name.startsWith('/assets/ui/'))||name.includes('..')){res.writeHead(404);res.end();return;}
 try{const bytes=await readFile(path.join(root,name));res.setHeader('Content-Type',({'.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(name)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await launchBrowser(960,1360);
try{
 await browser.cdp.call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+pack+'asset-check.html'});await pause(100);
 await browser.cdp.evaluate(`Promise.all([...document.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=r;im.onerror=r}))).then(()=>document.fonts.ready)`);
 const info=await browser.cdp.evaluate(`({images:[...document.images].map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),bodyHeight:document.body.scrollHeight,samples:document.querySelectorAll('.sample').length})`);
 if(info.images.some(im=>!im.ok))throw Error('Missing asset');
 await writeFile(path.join(root,pack,'previews/asset-normal-size-check.png'),await browser.cdp.screenshot());
 await writeFile(path.join(root,pack,'previews/asset-render-review.json'),JSON.stringify({date:'2026-10-02',method:'code-authored DOM asset board over actual captured terrain crops; not native OS cursor capture',viewport:[960,1360],...info,errors:browser.cdp.errors},null,2)+'\n');
 console.log(JSON.stringify({samples:info.samples,images:info.images.length,bodyHeight:info.bodyHeight,errors:browser.cdp.errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
