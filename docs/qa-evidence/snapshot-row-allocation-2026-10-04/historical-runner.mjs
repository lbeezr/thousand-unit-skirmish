import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const roots={baseline:'/workspace/thousand-unit-skirmish-snapshot-baseline',candidate:'/workspace/thousand-unit-skirmish-tick-proposal'};
const sha=data=>createHash('sha256').update(data).digest('hex');
const identities={};
for(const [variant,root]of Object.entries(roots))identities[variant]={root,
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  srcTree:execFileSync('git',['rev-parse','HEAD:src'],{cwd:root,encoding:'utf8'}).trim(),
  serverSha256:sha(await readFile(`${root}/server.mjs`)),harnessSha256:sha(await readFile(`${root}/scripts/paid-battle-tick-budget.mjs`)),
  observerSha256:sha(await readFile(`${root}/scripts/tick-attribution-observer.mjs`))};
assert.equal(identities.baseline.srcTree,identities.candidate.srcTree);
assert.equal(identities.baseline.harnessSha256,identities.candidate.harnessSha256);
assert.equal(identities.baseline.observerSha256,identities.candidate.observerSha256);
const cases=[['baseline',0,1,false],['candidate',0,1,false],['candidate',0,2,false],['baseline',0,2,false],
 ['candidate',4,1,false],['baseline',4,1,false],['baseline',4,2,false],['candidate',4,2,false],
 ['baseline',0,1,true],['candidate',0,1,true],['candidate',4,1,true],['baseline',4,1,true]];
const record={schemaVersion:1,startedUtc:new Date().toISOString(),identities,cases,
  retentionCriteria:{exactSnapshotWireAndRecovery:true,minimumFixedProbeAllocationReductionFraction:.2,
    processProfilesConfirmAllocationDirection:true,wholeTickDistributionsRetained:true,defaultSchedulerUnchanged:true},runs:[]};
await writeFile('/tmp/snapshot-row-comparison-run-manifest.json',JSON.stringify(record,null,2)+'\n');
for(const [variant,policy,repeat,observed]of cases){
 const kind=observed?'observed':'plain',name=`snapshot-row-${variant}-${kind}-${policy}-r${repeat}`;
 const root=roots[variant],output=`/tmp/${name}.json`,log=`/tmp/${name}.log`,startedUtc=new Date().toISOString();
 assert.equal(sha(await readFile(`${root}/server.mjs`)),identities[variant].serverSha256,'frozen runtime source');
 console.log(JSON.stringify({status:'start',variant,policy,repeat,observed,startedUtc}));
 const fd=await open(log,'w');
 let result;
 try{result=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/paid-battle-tick-budget.mjs',String(policy),'2000'],{
   cwd:root,env:{...process.env,PAID_BATTLE_ATTRIBUTION:observed?'1':'0',PAID_BATTLE_TICK_RECORD:output},stdio:['ignore',fd.fd,fd.fd]});
  child.once('error',reject);child.once('exit',(code,signal)=>resolve({exitCode:code,signal}));
 });}finally{await fd.close();}
 const raw=JSON.parse(await readFile(output));
 assert.equal(raw.head,identities[variant].head);assert.equal(raw.sourceSha256,identities[variant].serverSha256);
 const row={variant,policy,repeat,observed,startedUtc,endedUtc:new Date().toISOString(),output,log,...result,
  failure:raw.failure??null,summary:raw.summary??null,casualties:raw.casualties??null};
 record.runs.push(row);await writeFile('/tmp/snapshot-row-comparison-run-manifest.json',JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify({status:'complete',...row}));
 assert.equal(result.exitCode,0,'functional run failed; preserve evidence and inspect before continuing');
}
record.completedUtc=new Date().toISOString();await writeFile('/tmp/snapshot-row-comparison-run-manifest.json',JSON.stringify(record,null,2)+'\n');
