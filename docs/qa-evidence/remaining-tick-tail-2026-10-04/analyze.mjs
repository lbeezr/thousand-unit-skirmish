import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const directory=resolve(process.argv[2]??import.meta.dirname);
const previous=resolve(directory,'../snapshot-row-allocation-2026-10-04');
const sha=x=>createHash('sha256').update(x).digest('hex');
const load=async path=>{const stored=await readFile(path),decoded=path.endsWith('.gz')?gunzipSync(stored):stored;
 return {data:JSON.parse(decoded),sha256:sha(decoded),storedSha256:sha(stored)};};
const original=(await load(resolve(previous,'summary.json'))).data;
const candidates=original.reports.filter(r=>r.variant==='candidate');
const inputs=new Map();
for(const r of candidates) {
 const loaded=await load(resolve(previous,r.filename)),raw=loaded.data;
 assert.equal(loaded.sha256,r.sha256);assert.equal(loaded.storedSha256,r.storedSha256);
 assert.equal(raw.head,r.head);assert.equal(raw.sourceSha256,r.serverSha256);
 assert.equal(raw.ticks.length,930);
 raw.ticks.forEach((t,i)=>assert.equal(t.tickNumber,raw.startTick+i+1));
 assert.deepEqual(raw.ticks.filter(t=>t.durationMs>1000/30),r.overruns);
 inputs.set(r.filename,loaded);
}
const groups=['simulationMs','visionMs','scenarioMs','broadcastMs','checkpointMs'];
const overruns=candidates.flatMap(r=>r.overruns.map(t=>({policy:r.policy,repeat:r.repeat,profiled:r.instrumented,
 sourceHead:r.head,filename:r.filename,...t,dominant:groups.toSorted((a,b)=>t[b]-t[a])[0]})));
const plain=overruns.filter(r=>!r.profiled),diagnostic=overruns.filter(r=>r.profiled);
const maxima={plain:plain.toSorted((a,b)=>b.durationMs-a.durationMs)[0],
 diagnostic:diagnostic.toSorted((a,b)=>b.durationMs-a.durationMs)[0]};
assert.equal(maxima.plain.tickNumber,2661);assert.equal(maxima.plain.broadcastMs,52.928);
assert.equal(maxima.diagnostic.tickNumber,2067);assert.equal(maxima.diagnostic.simulationMs,143.217);
const profileHotspots=[];
for(const r of candidates.filter(r=>r.instrumented)) {
 const loaded=inputs.get(r.filename),a=loaded.data.attribution;
 const nodes=new Map(a.cpuProfile.nodes.map(n=>[n.id,n]));
 const weights=new Map();
 a.cpuProfile.samples.forEach((id,index)=>{const name=nodes.get(id).callFrame.functionName;
  weights.set(name,(weights.get(name)??0)+(a.cpuProfile.timeDeltas[index]??0)/1000);});
 const functions=['getMoveVector','findAttackMoveTarget','technologyCombatEffects','canCombatTarget'];
 const allocation=new Map(functions.map(name=>[name,{selfEstimatedBytes:0,inclusiveEstimatedBytes:0}]));
 const walk=(node,ancestors=new Set())=>{const next=new Set(ancestors),name=node.callFrame.functionName;
  if(allocation.has(name)){allocation.get(name).selfEstimatedBytes+=node.selfSize;next.add(name);}
  for(const name of next)allocation.get(name).inclusiveEstimatedBytes+=node.selfSize;
  node.children.forEach(child=>walk(child,next));};walk(a.allocationProfile.head);
 profileHotspots.push({policy:r.policy,filename:r.filename,sha256:loaded.sha256,
  functions:Object.fromEntries(functions.map(name=>[name,{sampledIntervalWeightMs:weights.get(name)??0,...allocation.get(name)}])),
  rowWindow:a.rowWindow,profileWindows:a.profileWindows,
  limitations:['Full profile windows, not per-overrun child attribution.',
   'CPU deltas are sampled interval weights, not exact function CPU or causal attribution.',
   'V8 allocation tree estimates include collected objects and omit some native/external allocation.']});
}
const probes=[],pairs=[];
for(let repeat=1;repeat<=3;repeat++) {
 const pair={};
 for(const variant of ['baseline','candidate']) {
  const filename=`zero-separation-${variant}-${repeat}.json.gz`,loaded=await load(resolve(directory,filename)),p=loaded.data;
  assert.equal(p.variant,variant);assert.equal(p.repeat,repeat);assert.equal(p.calls,200000);
  assert.equal(p.warmups,10000);assert.equal(p.actors,2000);assert.equal(p.movers,1000);
  assert.equal(p.zeroSeparationMoverFraction,.7);assert.equal(p.samplingIntervalBytes,65536);
  assert.equal(p.sourceSha256,'269ba44cda8dc64434af811d06dbcd5ae81f9a1bb2bbf56ac8907c0687af409c');
  assert.equal(p.baselineBodySha256,'0a6fdee765b12ffe8289db9782b392d66e05bb84dc896c383684a461b6ad3499');
  assert.equal(p.candidateBodySha256,'d3aa41e7ac67f4581b63be814e6958dea7a0a07fa2a10523bda96d097fe91ae6');
  assert.equal(p.resultHashes[0],p.resultHashes[1]);
  assert.deepEqual(p.counts,[{zeroCalls:700,totalHypotCalls:3000},{zeroCalls:0,totalHypotCalls:2300}]);
  let self=0,inclusive=0;const walk=(node,parent=false)=>{const match=node.callFrame.functionName==='getMoveVector';
   if(match)self+=node.selfSize;if(match||parent)inclusive+=node.selfSize;node.children.forEach(c=>walk(c,match||parent));};
  walk(p.profile.head);assert.equal(self,p.selfEstimatedBytes);assert.equal(inclusive,p.inclusiveEstimatedBytes);
  assert.equal(p.inclusiveEstimatedBytesPerCall,inclusive/p.calls);
  pair[variant]=p;const {profile,...details}=p;probes.push({filename,sha256:loaded.sha256,storedSha256:loaded.storedSha256,...details});
 }
 assert.equal(pair.baseline.actorHash,pair.candidate.actorHash);assert.equal(pair.baseline.checksum,pair.candidate.checksum);
 assert.deepEqual(pair.baseline.resultHashes,pair.candidate.resultHashes);
 pairs.push({repeat,baselineEstimatedBytesPerCall:pair.baseline.inclusiveEstimatedBytesPerCall,
  candidateEstimatedBytesPerCall:pair.candidate.inclusiveEstimatedBytesPerCall,
  inclusiveReductionFraction:1-pair.candidate.inclusiveEstimatedBytes/pair.baseline.inclusiveEstimatedBytes});
}
assert.ok(pairs.some(p=>p.inclusiveReductionFraction<0),'Retained negative repeat contradicts consistent allocation reduction.');
console.log(JSON.stringify({schemaVersion:1,measuredCandidate:original.identities.candidate,
 maxima,plainOverruns:plain,diagnosticOverruns:diagnostic,profileHotspots,probePairs:pairs,probes,
 decision:'Do not select a production optimization from these observations. Zero-separation hypot guard has no consistent allocation reduction across three favourable fixed-fixture pairs.',
 limitations:['Production server and default scheduler unchanged; private wire semantics untouched.',
  'Unprofiled broadcast maximum has no matching child-function timing capture; diagnostic simulation maximum has no exact child timing attribution.',
  'Fixed artificial70% zero-force workload is not an ordinary battle fraction; matched vectors here are not full movement/recovery acceptance.',
  'No maximum-tick, capacity, deployed or rendered acceptance claim.']},null,2));
