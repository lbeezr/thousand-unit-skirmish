import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';

const destination = new URL('../docs/art-direction/environment-camera-v1/', import.meta.url);
const anatomy = JSON.parse(await readFile(new URL('root-oak-construction.json', destination), 'utf8'));
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 100);
camera.position.set(...CAMERA_VIEW_DIRECTION).normalize().multiplyScalar(10);
camera.lookAt(0,0,0); camera.updateMatrixWorld();
const scale = 110;
const rotate = (point, angle) => new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0,1,0), angle*Math.PI/180);
const project = (point, angle) => { const p=rotate(point,angle).project(camera); return [p.x*4*scale,-p.y*4*scale]; };
const bands = crown => Array.from({length:7},(_,lat)=> Array.from({length:65},(_,lon)=> {
  const v=(lat/6-.5)*Math.PI, u=lon/64*Math.PI*2;
  return crown.center.map((x,i)=>x+crown.radii[i]*[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)][i]);
}));
const cloud = anatomy.crowns.flatMap(c=>bands(c).flat());
for (const crown of anatomy.crowns) assert(anatomy.branches.some(b=>b.id===crown.branch),`Unknown crown scaffold ${crown.id}`);
for (const b of anatomy.branches.slice(1)) assert(anatomy.branches[0].points.some(p=>p.every((v,i)=>v===b.points[0][i])),`Detached branch ${b.id}`);
const headings=[0,90,180,270];
const measurements=headings.map(angle=> {
  const points=cloud.map(p=>project(p,angle));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {headingDegrees:angle,rootPx:[0,0],boundsPx:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],
    branchAttachments:Object.fromEntries(anatomy.branches.map(b=>[b.id,project(b.points[0],angle)]))};
});
for (let i=0;i<2;i++) {
  const width=b=>b.boundsPx[2]-b.boundsPx[0];
  assert(Math.abs(width(measurements[i])-width(measurements[i+2]))<1e-8,'Opposite horizontal extent drift');
}
const path=(points,angle,color,width=2)=>`<polyline points="${points.map(p=>project(p,angle).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const label=(point,angle,text,color)=> { const [x,y]=project(point,angle);return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/><text x="${x+6}" y="${y+(text.startsWith('C')?15:-6)}" fill="${color}" font-size="13">${text}</text>`; };
let body='<rect width="100%" height="100%" fill="#252a25"/><g font-family="Arial,sans-serif"><text x="30" y="35" fill="#eee" font-size="24">Root Oak · shared anatomical construction proposal</text><text x="30" y="65" fill="#bbb" font-size="15">One 3D scaffold, four Y rotations, fixed game camera and scale. Proxy only; not production art or recovered painted geometry.</text>';
for(const [i,angle] of headings.entries()) {
  body+=`<g transform="translate(${210+i*420},530)">`;
  for(const crown of anatomy.crowns) for(const band of bands(crown))body+=path(band,angle,'#62734e',.7);
  for(const root of anatomy.roots)body+=path(root.points,angle,'#b4986b',5)+label(root.points.at(-1),angle,root.id,'#d8bb86');
  for(const branch of anatomy.branches)body+=path(branch.points,angle,'#d3ad78',branch.radius*45)+label(branch.points.at(-1),angle,branch.id,'#f0d0a0');
  for(const crown of anatomy.crowns)body+=label(crown.center,angle,crown.id,'#acd48c');
  body+='<circle cx="0" cy="0" r="5" fill="#ed7566"/></g>';
  body+=`<text x="${170+i*420}" y="650" fill="#eee" font-size="20">${angle}°</text>`;
}
body+='<text x="30" y="685" fill="#bbb" font-size="15">T main trunk · L low spread · R middle fork · F lower scaffold · B rear scaffold · C1–C5 crown volumes · A/D/E/G root buttresses</text></g>';
await writeFile(new URL('root-oak-construction.svg',destination),`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="710" viewBox="0 0 1680 710">${body}</svg>\n`);
await writeFile(new URL('root-oak-construction-projections.json',destination),JSON.stringify({status:anatomy.status,cameraViewDirection:CAMERA_VIEW_DIRECTION,pixelsPerProjectedWorldUnit:scale,headings:measurements,validation:'Connected scaffold references and opposite horizontal extents checked; does not certify painted source identity'},null,2)+'\n');
console.log('Root Oak proxy: connected branches, five crown volumes, four root buttresses and opposite-view extents checked.');
