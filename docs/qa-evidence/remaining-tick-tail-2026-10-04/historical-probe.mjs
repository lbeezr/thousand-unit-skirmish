// One read-only candidate-body experiment; fixed VM actors, no ordinary match acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector/promises';
import vm from 'node:vm';
import {UNIT_DEFINITIONS} from '/workspace/thousand-unit-skirmish-tick-proposal/src/gameplay-definitions.mjs';
const root='/workspace/thousand-unit-skirmish-tick-proposal';
const source=await readFile(`${root}/server.mjs`,'utf8');
const start=source.indexOf('function getMoveVector('),end=source.indexOf('\nfunction ',start+1);
assert.ok(start>=0&&end>start);
const baseline=source.slice(start,end);
const from='Math.hypot(separationX, separationZ)';
assert.equal(baseline.split(from).length,2);
const candidate=baseline.replace(from,'(separationX === 0 && separationZ === 0 ? 0 : Math.hypot(separationX, separationZ))');
const sha=x=>createHash('sha256').update(x).digest('hex');
const variant=process.argv[2],repeat=Number(process.argv[3]);
assert.ok(['baseline','candidate'].includes(variant));assert.ok(repeat>=1&&repeat<=3);
const width=160,half=80,bucketSize=1.2,columns=Math.floor((width-.5)/bucketSize)+1;
const point=c=>({x:c%width-half+.5,z:Math.floor(c/width)-half+.5});
const cell=(x,z)=>Math.floor(z+half)*width+Math.floor(x+half);
const headings=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
function fixture(body) {
 const units=[],movers=[];
 for(let group=0;group<1000;group++) {
  const x=-60+group%40*3+.5,z=-36+Math.floor(group/40)*3+.5;
  const [dx,dz]=headings[group%8],target=cell(x+dx*2,z+dz*2),crowded=group%10<3;
  const kind=['infantry','archer','spearman','worker'][group%4];
  const mover={id:units.length,team:group%2,hp:100,kind,x,z,path:[target],pathIndex:0,
   movementDomain:'land',attackTargetId:-1,attackBuildingTargetId:-1};
  movers.push(mover);units.push(mover,{...mover,id:mover.id+1,kind:'infantry',
   x:x+(crowded?.15:1.1),z:z+.05,path:[target]});
 }
 const heads=new Int32Array(columns*columns).fill(-1),next=new Int32Array(units.length).fill(-1);
 for(const u of units){const b=Math.floor((u.z+half)/bucketSize)*columns+Math.floor((u.x+half)/bucketSize);next[u.id]=heads[b];heads[b]=u.id;}
 const context=vm.createContext({units,UNIT_DEFINITIONS,STEP_SECONDS:1/30,MAP_WIDTH:width,
  MAP_HALF_X:half,MAP_HALF_Z:half,MIN_SEPARATION:.56,SPATIAL_BUCKET_SIZE:bucketSize,
  spatialBucketColumns:columns,spatialBucketRows:columns,spatialBucketHeads:heads,spatialBucketNext:next,
  SEPARATION_DIAGNOSTICS_ENABLED:false,cellToWorld:point,worldToCell:cell});
 vm.runInContext(body,context,{filename:`zero-separation-${body===baseline?'baseline':'candidate'}.js`});
 return {units,movers,context,vector:u=>context.getMoveVector(u)};
}
const old=fixture(baseline),current=fixture(candidate);
const actorHash=sha(JSON.stringify(old.units));assert.equal(sha(JSON.stringify(current.units)),actorHash);
const resultHashes=[];
for(const f of [old,current]) {
 const results=f.movers.map(u=>structuredClone(f.vector(u)));
 resultHashes.push(sha(JSON.stringify(results)));
 if(f===old)old.results=results;else assert.deepEqual(results,old.results,'exact vectors, values and object shape across both seats/kinds/eight headings');
}
assert.equal(resultHashes[0],resultHashes[1]);
// Count the branch outside sampling using the realm intrinsic; do not alter the profiled function.
const counts=[];
for(const f of [old,current]) {
 vm.runInContext('const intrinsicHypot=Math.hypot; let zeroCalls=0,totalHypotCalls=0; Math.hypot=(...args)=>{totalHypotCalls++;if(args.length===2&&args[0]===0&&args[1]===0)zeroCalls++;return intrinsicHypot(...args);};',f.context);
 f.movers.forEach(f.vector);
 counts.push(vm.runInContext('({zeroCalls,totalHypotCalls})',f.context));
 vm.runInContext('Math.hypot=intrinsicHypot;',f.context);
}
assert.equal(counts[0].zeroCalls,700);assert.equal(counts[1].zeroCalls,0);
assert.equal(counts[0].totalHypotCalls-counts[1].totalHypotCalls,700);
const f=variant==='baseline'?old:current;
for(let i=0;i<10000;i++)f.vector(f.movers[i%1000]);
const session=new Session();session.connect();let profile,checksum=0;
const calls=200000;
try {
 await session.post('HeapProfiler.startSampling',{samplingInterval:65536,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 for(let i=0;i<calls;i++){const v=f.vector(f.movers[i%1000]);checksum+=v.x+v.z+v.stepDistance+v.target.x+v.target.z;}
 profile=(await session.post('HeapProfiler.stopSampling')).profile;
} finally {session.disconnect();}
assert.equal(sha(JSON.stringify(f.units)),actorHash);
let selfEstimatedBytes=0,inclusiveEstimatedBytes=0;
const visit=(node,inside=false)=>{const self=node.callFrame.functionName==='getMoveVector';
 if(self)selfEstimatedBytes+=node.selfSize;if(self||inside)inclusiveEstimatedBytes+=node.selfSize;
 node.children.forEach(child=>visit(child,self||inside));};visit(profile.head);
const record={schemaVersion:1,variant,repeat,node:process.version,calls,warmups:10000,actors:2000,movers:1000,
 zeroSeparationMoverFraction:.7,sourceSha256:sha(source),baselineBodySha256:sha(baseline),candidateBodySha256:sha(candidate),
 actorHash,resultHashes,counts,checksum,selfEstimatedBytes,inclusiveEstimatedBytes,
 inclusiveEstimatedBytesPerCall:inclusiveEstimatedBytes/calls,samplingIntervalBytes:65536,profile,
 limits:['Fixed VM actor fixture and actual production function with one local candidate expression replacement; runtime source unchanged.',
 'Artificial70% zero-force/30% crowded mix is not a measured ordinary battle fraction.',
 'Sampled collected-object estimates, not precise/native allocation or live heap occupancy.',
 'No elapsed-time, maximum-tick, ordinary match, deployed or rendered acceptance claim.']};
await writeFile(`/tmp/zero-separation-${variant}-${repeat}.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({...record,profile:undefined}));
