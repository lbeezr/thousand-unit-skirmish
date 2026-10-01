// Local art review only: no gameplay resource or harvesting rules.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = 'assets/environment/vesperra-podvine-worked-v1/';
const manifest = JSON.parse(await readFile(path.join(root, pack, 'review-manifest.json'), 'utf8'));
const routes = new Map([
  ['/three.js', ['node_modules/three/build/three.module.js', 'text/javascript']],
  ['/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript']],
  ['/camera.js', ['src/camera-controls.mjs', 'text/javascript']],
  ['/atlas.webp', [pack + manifest.atlasFile, 'image/webp']],
]);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Vesperra pod-vine state review</title>
<style>body{margin:0;background:#242a2e;color:#f2e4d1;font:16px system-ui}header{padding:16px}button{margin:8px;padding:8px}canvas{display:block}p{margin:6px 0}</style>
<header><strong>Vesperra pod-vine — fixed-camera review</strong><p>45° azimuth · 45.436° elevation · shared crop and scale · cyan rings mark unchanged ground pivots</p><p>Front / right / rear / left. Controls switch full/worked appearances at the same four ground pivots; registration uses provisional silhouette proxies.</p><div id="controls"></div><p id="status">Loading atlas…</p></header>
<script type="module">
import * as THREE from '/three.js';
import { CAMERA_VIEW_DIRECTION } from '/camera.js';
const pack = ${JSON.stringify(manifest)};
const scene = new THREE.Scene(); scene.background = new THREE.Color('#79705b');
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(devicePixelRatio); document.body.append(renderer.domElement);
const camera = new THREE.OrthographicCamera(); camera.position.copy(new THREE.Vector3(...CAMERA_VIEW_DIRECTION).multiplyScalar(8)); camera.lookAt(0,0,0);
const facing = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(...CAMERA_VIEW_DIRECTION),new THREE.Vector3(),new THREE.Vector3(0,1,0)));
const grid = new THREE.GridHelper(12,24,0xb6a184,0x8d8068); scene.add(grid);
const texture = await new THREE.TextureLoader().loadAsync('/atlas.webp'); texture.colorSpace=THREE.SRGBColorSpace;
const cards=[];
for(let i=0;i<4;i++){
 const x=(i-1.5)*1.4, z=-x;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.11,.125,48),new THREE.MeshBasicMaterial({color:0x63e6da,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.set(x,.002,z); scene.add(ring);
 const geometry=new THREE.PlaneGeometry(...pack.worldSize); geometry.translate(0,pack.worldSize[1]/2,0);
 const map=texture.clone(); const [rx,ry,rw,rh]=pack.frames[i].rectPx; map.repeat.set((rw-1)/pack.atlasSizePx[0],(rh-1)/pack.atlasSizePx[1]); map.offset.set((rx+.5)/pack.atlasSizePx[0],1-(ry+rh-.5)/pack.atlasSizePx[1]); map.needsUpdate=true;
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,transparent:true,alphaTest:.08,depthWrite:true,toneMapped:false})); mesh.quaternion.copy(facing); mesh.position.set(x,0,z);scene.add(mesh);cards.push(mesh);
}
function draw(){const w=innerWidth,h=Math.max(300,innerHeight-document.querySelector('header').offsetHeight);renderer.setSize(w,h);const span=7.6;camera.left=-span/2;camera.right=span/2;camera.top=span*h/w/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.render(scene,camera);}
function state(index){cards.forEach((mesh,i)=>{const [x,y,w,h]=pack.frames[index*4+i].rectPx;mesh.material.map.offset.set((x+.5)/pack.atlasSizePx[0],1-(y+h-.5)/pack.atlasSizePx[1]);});draw();document.querySelector('#status').textContent=(index===0?'Full':'Worked')+' at identical pivots';}
for(const [label,index] of [['Full',0],['Worked',1]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>state(index);document.querySelector('#controls').append(b);}
window.addEventListener('resize',draw);state(new URLSearchParams(location.search).get('state')==='worked'?1:0);
window.__podvineReview={ready:true,cameraDirection:CAMERA_VIEW_DIRECTION,worldSize:pack.worldSize,pivot:pack.pivot,frameCount:cards.length,setState:state};
</script></html>`;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.writeHead(200, {'Content-Type':'text/html'}); res.end(html); return; }
    const route = routes.get(url.pathname);
    if (!route) { res.writeHead(404); res.end(); return; }
    const data = await readFile(path.join(root, route[0]));
    res.writeHead(200, {'Content-Type':route[1]}); res.end(data);
  } catch { res.writeHead(500); res.end('Preview file unavailable'); }
});
server.listen(Number(process.env.RTS_ART_PREVIEW_PORT || 4187), '127.0.0.1', () => console.log('Pod-vine review: http://127.0.0.1:' + server.address().port));
