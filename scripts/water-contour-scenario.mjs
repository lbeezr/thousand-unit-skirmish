import assert from 'node:assert/strict';
import {buildWaterSurfaceGeometry,WATER_LEVEL} from '../src/water-surface-geometry.mjs';
import {waterRaster,waterContains} from '../src/water-contours.mjs';
const triangleContains=(a,b,c,x,z)=>{
  const cross=(p,q)=>(q[0]-p[0])*(z-p[1])-(q[1]-p[1])*(x-p[0]);
  const signs=[cross(a,b),cross(b,c),cross(c,a)];
  return signs.every(n=>n>=-1e-7)||signs.every(n=>n<=1e-7);
};
let triangleSamples=0;
for(let bits=1;bits<512;bits++) {
  const map={width:3,height:3,obstacles:Array.from({length:9},(_,i)=>({column:i%3,row:Math.floor(i/3),width:1,height:1,material:'water'})).filter((_,i)=>bits&(1<<i))};
  const original=JSON.stringify(map),cells=waterRaster(map),g=buildWaterSurfaceGeometry(map),p=g.attributes.position,indices=g.index.array,centers=new Set();
  for(let i=0;i<indices.length;i+=3) {
    const v=Array.from(indices.slice(i,i+3)),points=v.map(j=>[p.getX(j)+1.5,p.getZ(j)+1.5]);
    for(const [u,w] of [[1/3,1/3],[.1,.1],[.8,.1],[.1,.8]]) {
      const x=points[0][0]*u+points[1][0]*w+points[2][0]*(1-u-w),z=points[0][1]*u+points[1][1]*w+points[2][1]*(1-u-w);
      assert(waterContains(cells,3,3,x,z),`Footprint ${bits} leaked onto dry cell at ${x},${z}`);triangleSamples++;
    }
    if(Math.abs(p.getY(v[0])-WATER_LEVEL)<1e-6)for(let j=0;j<9;j++)
      if(triangleContains(...points,j%3+.5,Math.floor(j/3)+.5))centers.add(j);
  }
  assert.deepEqual([...centers].sort((a,b)=>a-b),Array.from(cells.keys()).filter(i=>cells[i]),`Footprint ${bits} lost a water center or flooded a land center`);
  assert.equal(JSON.stringify(map),original);g.dispose();
}
const donut={width:7,height:7,obstacles:[]};
for(let r=1;r<6;r++)for(let c=1;c<6;c++)if(c!==3||r!==3)donut.obstacles.push({column:c,row:r,width:1,height:1,material:'water'});
const g=buildWaterSurfaceGeometry(donut);assert.equal(g.userData.waterContourCount,1);assert.equal(g.userData.waterIslandCount,1);g.dispose();
console.log(`Water contours: all 511 local footprints, ${triangleSamples} interior samples, cell-center coverage, disconnected diagonals and dry-island topology passed.`);
