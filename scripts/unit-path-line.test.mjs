import assert from 'node:assert/strict';
import test from 'node:test';
import { canTraverseFlatUnitSegment, visitGridSegmentCells } from '../src/unit-path-line.mjs';

const width = 8, levels = new Uint8Array(64);
const cells = (x,z,tx,tz) => {
  const seen = new Set();
  assert.ok(visitGridSegmentCells(x,z,tx,tz,width,64,c=>{seen.add(c);}));
  return [...seen].sort((a,b)=>a-b);
};
test('supercover visits both sides of diagonal corners and repeats in reverse',()=>{
  const covered = cells(1.5,1.5,6.5,6.5);
  assert.deepEqual(covered,cells(6.5,6.5,1.5,1.5));
  for(const cell of [9,10,17,18,19,26,27,54])assert.ok(covered.includes(cell));
  for(const blocked of covered)assert.equal(canTraverseFlatUnitSegment(1.5,1.5,6.5,6.5,width,levels,c=>c!==blocked),false);
});
test('fractional bearings, axis lines and exact boundary lines have reciprocal coverage',()=>{
  for(const [x,z,tx,tz] of [[1.95,1.05,5.5,6.5],[2,1.5,2,6.5],[1.5,2,6.5,2],[6,6,1.2,2.7]]){
    assert.deepEqual(cells(x,z,tx,tz),cells(tx,tz,x,z));
  }
  const covered = cells(2,1.5,2,6.5);
  assert.ok(covered.includes(9)); assert.ok(covered.includes(10),'both sides of x=2');
});
test('shortcut rejects cliffs and slopes while allowing a uniform elevated plane',()=>{
  const elevations = new Uint8Array(64).fill(2);
  assert.ok(canTraverseFlatUnitSegment(1.5,1.5,6.5,6.5,width,elevations,()=>true));
  for(const value of [0,1,3,4]){
    elevations[26]=value;
    assert.equal(canTraverseFlatUnitSegment(1.5,1.5,6.5,6.5,width,elevations,()=>true),false);
  }
});
test('fractional start may be blocked although its cell-center shortcut is clear',()=>{
  const walkable = c => c!==10;
  assert.ok(canTraverseFlatUnitSegment(1.5,1.5,4.5,7.5,width,levels,walkable));
  assert.equal(canTraverseFlatUnitSegment(1.95,1.05,4.5,7.5,width,levels,walkable),false);
});
test('map bounds, invalid coordinates and malformed dimensions are rejected',()=>{
  for(const args of [[-1,1,4,4,8,64],[1,1,8,4,8,64],[1,1,4,8,8,64],
    [1,NaN,4,4,8,64],[1,1,4,4,0,64],[1,1,4,4,8,63]]){
    assert.equal(visitGridSegmentCells(...args,()=>true),false);
  }
  assert.deepEqual(cells(0,0,0,0),[0]);
});
test('near-corner boundaries within one physical step require both diagonal sides',()=>{
  const walkable = c => c!==3*8+2;
  assert.ok(canTraverseFlatUnitSegment(2.98,2.99,6.5,4.5,width,levels,walkable),'geometric line misses the blocked side');
  assert.equal(canTraverseFlatUnitSegment(2.98,2.99,6.5,4.5,width,levels,walkable,.15),false,
    'physical diagonal step would require the blocked side');
});
