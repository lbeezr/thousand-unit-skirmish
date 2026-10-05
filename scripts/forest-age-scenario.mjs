import assert from 'node:assert/strict';
import {forestAgeFactors} from '../src/forest-age-composition.mjs';
const points=Array.from({length:900},(_,cell)=>({cell,x:cell%30+Math.sin(cell*3.1)*.39,z:Math.floor(cell/30)+Math.cos(cell*1.7)*.39}));
const original=JSON.stringify(points),factors=forestAgeFactors(points,93002),mature=points.filter(p=>factors.get(p.cell)===1.05);
assert.equal(factors.size,points.length);assert.equal(JSON.stringify(points),original);
assert.deepEqual([...factors].sort(),[...forestAgeFactors([...points].reverse(),93002)].sort());
assert.notDeepEqual(factors,forestAgeFactors(points,93003));
assert(mature.length>30&&mature.length<300);
for(const p of points)assert(factors.get(p.cell)>=.65&&factors.get(p.cell)<=1.05);
for(let i=0;i<mature.length;i++)for(let j=i+1;j<mature.length;j++)assert(Math.hypot(mature[i].x-mature[j].x,mature[i].z-mature[j].z)>=1.6);
assert.equal(forestAgeFactors([]).size,0);
assert.throws(()=>forestAgeFactors(points,0,0),RangeError);
console.log(`Irregular ages: ${mature.length} separated mature points, all ${points.length} roots represented, stable ordering/seed and no mutation.`);
// Source-side pine pilot regressions share this existing vegetation CI entry.
await import('./tree-variety-pilot.test.mjs');
await import('./forest-lifecycle-atlas.test.mjs');
