import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launchBrowser,pause} from './ui-audit-cdp.mjs';
const root='/workspace/thousand-unit-skirmish-ui-audit',pack='/docs/art-direction/vaelora-hud-study-v1/';
const server=createServer(async(req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 if(!name.startsWith(pack)||name.includes('..')){res.writeHead(404);res.end();return;}
 try{const bytes=await readFile(path.join(root,name));res.setHeader('Content-Type',path.extname(name)==='.html'?'text/html':'image/png');res.end(bytes);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await launchBrowser(1740,800);
try{
 await browser.cdp.call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+pack+'compact-preview.html'});await pause(100);
 await browser.cdp.evaluate(`Promise.all([...document.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=r;im.onerror=r}))).then(()=>document.fonts.ready)`);
 const info=await browser.cdp.evaluate(`({images:[...document.images].map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),height:document.body.scrollHeight,width:document.body.scrollWidth})`);
 if(info.images.some(im=>!im.ok)||info.height>800)throw Error('Missing image or clipped compact sheet: '+JSON.stringify(info));
 await writeFile(path.join(root,pack,'previews/compact-three-directions.png'),await browser.cdp.screenshot());
 await writeFile(path.join(root,pack,'previews/compact-render-review.json'),JSON.stringify({date:'2026-10-02',method:'code-authored thumbnail comparison of preserved original concept screenshots; not native-size evaluation',viewport:[1740,800],...info,errors:browser.cdp.errors},null,2)+'\n');
 console.log(JSON.stringify({...info,errors:browser.cdp.errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
