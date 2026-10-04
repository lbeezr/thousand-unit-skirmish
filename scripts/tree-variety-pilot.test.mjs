import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {pineViewVariation} from '../src/forest-age-composition.mjs';
import {auditTreePilot} from './tree-art-production-contract.mjs';

const contract=JSON.parse(readFileSync(new URL('../docs/art-direction/tree-variety-v1/pine-production-contract.json',import.meta.url)));

test('pine version 1 vectors retain save identity and full 32-bit cell/seed values',()=>{
  assert.deepEqual(pineViewVariation(0,0),{viewIndex:7,modelYawDegrees:315,scale:0.8407979531308631,flip:false,yaw:0});
  assert.deepEqual(pineViewVariation(810,93002),{viewIndex:7,modelYawDegrees:315,scale:0.8711208342041635,flip:false,yaw:0});
  assert.deepEqual(pineViewVariation(102399,4294967295),{viewIndex:5,modelYawDegrees:225,scale:0.9341775398781005,flip:false,yaw:0});
  for (const value of [-1,2**32,NaN,1.5,'1',undefined]) {
    assert.throws(()=>pineViewVariation(value,0),RangeError);
    if(value!==undefined)assert.throws(()=>pineViewVariation(0,value),RangeError);
  }
});

test('pine samples are order-independent, seed-sensitive, uniform, bounded and never mirrored',async()=>{
  const cells=Array.from({length:2048},(_,cell)=>cell);
  const values=cells.map(cell=>pineViewVariation(cell,93002));
  assert.deepEqual([...cells].reverse().map(cell=>pineViewVariation(cell,93002)).reverse(),values);
  const fresh=await import('../src/forest-age-composition.mjs?pine-fresh-selector');
  assert.deepEqual(cells.map(cell=>fresh.pineViewVariation(cell,93002)),values,'fresh module has no session state');
  assert.notDeepEqual(cells.map(cell=>pineViewVariation(cell,93003)),values);
  const counts=Array(8).fill(0);
  for(const value of values){
    counts[value.viewIndex]++;
    assert(value.scale>=.7&&value.scale<=1);
    assert.equal(value.modelYawDegrees,value.viewIndex*45);
    assert.equal(value.flip,false);assert.equal(value.yaw,0);assert(Object.isFrozen(value));
  }
  assert(counts.every(count=>count>180&&count<340),'all original views receive a reasonable bounded sample');
  assert(Math.min(...values.map(v=>v.scale))<.71&&Math.max(...values.map(v=>v.scale))>.99);
});

test('retained pine source audit declares all 24 lifecycle gaps and no render completion',()=>{
  const report=auditTreePilot();
  assert.deepEqual(report.errors,[]);assert.equal(report.authoredCells,8);
  assert.equal(report.requiredCells,32);assert.equal(report.missingSourceCells.length,24);
  assert.equal(report.integration,'prepared-unbound');assert.equal(report.renderAcceptance,'blocked');
  assert(auditTreePilot({requireComplete:true}).errors.length>0);
});

test('tree sidecar rejects source replacement, coverage inflation, source escape and unsupported render claims',()=>{
  const changes=[
    c=>c.identity.approvedRuntimeFiles[0].sha256='0'.repeat(64),
    c=>c.identity.sources[0].sha256='0'.repeat(64),
    c=>c.sourceComplete=true,
    c=>c.missingSourceCells=[],
    c=>c.calibration.groundPivotPx=[320,479],
    c=>c.provenance.privateSource.manifestFields=['replacement-model'],
    c=>c.publication.newUploadsAllowed=true,
    c=>c.variation.scaleRange=[.7,1.1],
    c=>c.renderAcceptance.status='accepted',
    c=>c.integration.status='default',
    c=>c.manifest='/etc/passwd',
  ];
  for(const change of changes){const copy=structuredClone(contract);change(copy);assert(auditTreePilot({contract:copy}).errors.length>0);}
});
