// Controlled production-function allocation probe; fixed VM actors, no match/render proof.
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { baselineSnapshot, productionBody, createSnapshotRowFixture } from './snapshot-row-fixture.mjs';
const variant = process.argv[2], iterations = Number(process.argv[3] ?? 500);
assert.ok(['baseline','candidate'].includes(variant));
assert.ok(Number.isInteger(iterations) && iterations >= 100 && iterations <= 2000);
const fixture = createSnapshotRowFixture({ baseline:variant==='baseline',count:2000,workerSlots:4 });
const sha = value => createHash('sha256').update(value).digest('hex');
const actorHash = sha(JSON.stringify(fixture.units)), views = [0,1,null];
const viewJsonHashes = views.map(team => sha(JSON.stringify(fixture.rows(team))));
for(let i=0;i<50;i++) fixture.rows(views[i%views.length]);
const session = new Session(); session.connect();
let profile, rows=0, checksum=0, report;
try {
  await session.post('HeapProfiler.startSampling',{samplingInterval:65536,
    includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
  const before = process.memoryUsage(), started = performance.now();
  for(let i=0;i<iterations;i++) {
    const result=fixture.rows(views[i%views.length]);
    rows+=result.length; checksum+=result[0][0]+result.at(-1)[0]+result.length;
  }
  const elapsedMs=performance.now()-started, after=process.memoryUsage();
  profile=(await session.post('HeapProfiler.stopSampling')).profile;
  let snapshotSelfEstimatedBytes=0,snapshotInclusiveEstimatedBytes=0;
  const visit=(node,inSnapshot=false)=>{
    const self=node.callFrame.functionName==='snapshotUnits';
    if(self)snapshotSelfEstimatedBytes+=node.selfSize;
    if(inSnapshot||self)snapshotInclusiveEstimatedBytes+=node.selfSize;
    for(const child of node.children)visit(child,inSnapshot||self);
  };
  visit(profile.head);
  assert.equal(sha(JSON.stringify(fixture.units)),actorHash,'snapshot authority unchanged');
  assert.deepEqual(views.map(team=>sha(JSON.stringify(fixture.rows(team)))),viewJsonHashes);
  report={schemaVersion:1,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,
    variant,iterations,warmupCalls:50,actors:2000,views,rows,checksum,viewJsonHashes,actorHash,
    functionSha256:sha(variant==='baseline'?baselineSnapshot:productionBody('snapshotUnits')+'\n'),
    samplingIntervalBytes:65536,sampleEntries:profile.samples.length,snapshotSelfEstimatedBytes,snapshotInclusiveEstimatedBytes,
    inclusiveEstimatedBytesPerRow:snapshotInclusiveEstimatedBytes/rows,
    elapsedWithSamplerMs:elapsedMs,netHeapChangeBytes:after.heapUsed-before.heapUsed,profile,
    limits:['fixed VM actor fixture and real production snapshot/helper bodies; not ordinary match or rendered acceptance',
      'V8 sampled estimates include collected objects, not precise/native allocation accounting',
      'sampler/warmup/host/JIT affect elapsed time; no whole-tick or capacity claim',
      'golden baseline body preserved from b4641998; identical view hashes/checksum/actor state required']};
} finally {session.disconnect();}
if(process.env.SNAPSHOT_ROW_ALLOC_RECORD) await writeFile(process.env.SNAPSHOT_ROW_ALLOC_RECORD,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,profile:undefined}));
