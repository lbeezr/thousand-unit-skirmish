// Offline exact-source replay of two captured calls. Does not create game fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createTemporalObserver} from './crowd-first-decision-observer.mjs';
import {frameContext} from './crowd-first-decision-context.mjs';
const sha=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const rootAt=process.argv.slice(2,4);assert.equal(rootAt.length,2,'provide exact baseline and candidate checkout roots');
const packed=await readFile(new URL('../docs/qa-evidence/crowd-first-decision-2026-10-06/first-decision.json.gz',import.meta.url));
assert.equal(sha(packed),'74ede1895682f64b9f1d512f9fe9fb200e542c77ad1568165aaf8ea38e18b11a');
const record=JSON.parse(gunzipSync(packed)), f=record.firstDivergence;
for(const [name,expected] of Object.entries(record.observerSha256)) {
 const snapshot=gunzipSync(await readFile(new URL('../docs/qa-evidence/crowd-first-decision-2026-10-06/'+name+'.gz',import.meta.url)));
 assert.equal(sha(snapshot),expected,'exact capture observer/driver snapshot '+name);
}
assert.equal(record.status,'captured');assert.equal(record.lastJourneyTick,142);assert.equal(record.matchedCalls,4906);
assert.ok(!/(?:seatSessions|tokenHash|matchId|recoveryToken|checkpointSequence)/.test(JSON.stringify(record)));
assert.deepEqual(record.matchingTickHashes.map(r=>r.journeyTick),Array.from({length:141},(_,i)=>i+1));
assert.deepEqual([f.journeyTick,f.productionTick,f.serialCall,f.actor],[142,143,21,28]);
assert.equal(f.previousMatched.serialCall,20);assert.equal(f.previousMatched.actor,27);
// Inputs, complete query and transient controller histories are genuinely paired.
for(const field of ['actor','input','query','queryVisits','bodies'])assert.deepEqual(f.baseline[field],f.candidate[field]);
const result={schema:1,artifactCompressedSha256:sha(packed),replayedCalls:[],causal:{journeyTick:142,actor:28,peer:24},limits:[
 'Offline replay of retained decision inputs; no new simulation.',
 'Capture candidate stops after the actual steering write, before clamp/budget finalization.',
 'This locates the first changed policy and write; it does not prove the full later fairness delay mechanism.'
]};
for(const [index,label] of ['baseline','candidate'].entries()) {
 const root=path.resolve(rootAt[index]), source=record.source[label];
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source.head,label+' exact checkout head');
 for(const [name,expected] of Object.entries(source.sha256))assert.equal(sha(await readFile(path.join(root,name))),expected,label+' exact source '+name);
 const at=name=>import(pathToFileURL(path.join(root,'src',name)).href);
 const movement=await at('unit-movement.mjs');const {UNIT_DEFINITIONS}=await at('gameplay-definitions.mjs');
 const {constructionMovementActive}=await at('construction-work-intent.mjs');const {workerPatrolAcquiredMovementActive}=await at('combat-movement.mjs');
 const server=await readFile(path.join(root,'server.mjs'),'utf8');
 const start=server.indexOf('function getMoveVector('),end=server.indexOf('function stationaryWorkerCellsNear(',start);
 assert.ok(start>=0&&end>start);const host=server.slice(start,end);
 const observer=await createTemporalObserver(null,{prepareOnly:true,actorId:record.selectedActorIds,sourceRoot:root});
 try {
  const frame=f[label],{context,unit,decode}=frameContext(frame,record,observer.observed,{movement,UNIT_DEFINITIONS,constructionMovementActive,workerPatrolAcquiredMovementActive},host);
  assert.deepEqual(Array.from({length:record.navigationMask.length},(_,cell)=>context.isWalkable(cell)),record.navigationMask,'complete physical map oracle');
  assert.deepEqual(Array.from(context.elevationLevelByCell),record.elevationLevels);
  const query=context.crowdNeighborsNear(unit);
  assert.equal(query.visits,frame.query.visits);assert.equal(query.overflow,frame.query.overflow);assert.deepEqual(Array.from(query.neighbors,u=>u.id),frame.query.ids);
  observer.observed.replayHostStart(unit,frame.tick,frame.navigationRevision,frame.epoch);
  const entry=frame.events.find(e=>e.type==='host-entry');assert.ok(entry);
  const replayedResult=context.getMoveVector(unit,entry.remainingStep,entry.allowLocalDetour);
  observer.observed.replayHostEnd(unit,replayedResult);
  const [replayed]=observer.observed.drainReplayFrames();
  assert.deepEqual(structuredClone(replayedResult),decode(frame.result),label+' complete production host decision');
  assert.deepEqual(replayed.afterState,frame.afterState,label+' actual transient state');
  assert.deepEqual(replayed.events,frame.events.filter(e=>!['host-entry','host-oracle'].includes(e.type)),label+' exact proposals, visited bodies, scoring and priority');
  const priority=frame.events.find(e=>e.type==='priority');
  assert.equal(priority.yieldingToPeer,label==='baseline');
  const best=priority.best,from={x:unit.x,z:unit.z},to={x:unit.x+best.x*best.stepDistance,z:unit.z+best.z*best.stepDistance};
  const sameBest={...best};assert.deepEqual(f.baseline.events.find(e=>e.type==='priority').best,sameBest);
  const terrain=movement.canTraverseStaticBodySegment(unit,to,frame.input.radius,record.map.width,record.map.height,context.isWalkable,{allowEscape:true});
  const cell=movement.canTraverseUnitStep(context.worldToCell(from.x,from.z),context.worldToCell(to.x,to.z),record.map.width,context.elevationLevelByCell,context.isWalkable);
  const body=observer.observed.canTraverseCrowdBodySegment(unit,to,frame.input.radius,query.neighbors,{allowEscape:true});
  assert.equal(terrain,true);assert.equal(cell,true);assert.equal(body,true);
  assert.equal(movement.canTraverseStaticBodySegment(unit,to,frame.input.radius,record.map.width,record.map.height,context.isWalkable),true,'strict static circle clearance');
  assert.equal(observer.observed.canTraverseCrowdBodySegment(unit,to,frame.input.radius,query.neighbors),true,'strict body pair clearance');
  const minimumQueryBodyMargin=Math.min(...query.neighbors.map(other=>Math.sqrt(movement.pointSegmentDistanceSquared(other,from,to))-frame.input.radius-movement.LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]));
  assert.ok(minimumQueryBodyMargin>=-1e-9);
  const gain=Math.hypot(frame.input.progressTarget.x-from.x,frame.input.progressTarget.z-from.z)-Math.hypot(frame.input.progressTarget.x-to.x,frame.input.progressTarget.z-to.z);
  const peer=frame.bodies.find(b=>b.actor.id===24);const peerUnit=decode(peer.actor);
  const required=frame.input.radius+movement.LAND_CLEARANCE_PROFILE.radiusByKind[peerUnit.kind];
  const peerSweptMargin=Math.sqrt(movement.pointSegmentDistanceSquared(peerUnit,from,to))-required;
  result.replayedCalls.push({label,sourceHead:source.head,queryVisits:query.visits,returnedBodies:query.neighbors.length,
   priorityYield:priority.yieldingToPeer,resultSha256:sha(frame.result),controllerAfterSha256:sha(frame.afterState),
   cellAdmitted:cell,staticAdmitted:terrain,bodyAdmitted:body,rawWaypointGain:gain,peerSweptMargin,minimumQueryBodyMargin,
   observedAdmission:frame.admissions[0].admission,executorPrefixFinalized:frame.admissions[0].finalized});
  if(label==='baseline') {assert.equal(frame.result.waitingForCrowd,true);assert.equal(f.baselineSubsteps.length,0);assert.equal(frame.admissions[0].admission,'crowd-wait');}
  else {
   assert.ok(frame.events.some(e=>e.type==='claim-predicate'&&e.predicate==='directed-join'&&e.id===24&&e.result===true));
   assert.equal(f.candidateSubsteps.length,1);const step=f.candidateSubsteps[0];
   assert.deepEqual([step.tick,step.id,step.generation,step.revision],[frame.tick,frame.actor.id,frame.actor.generation,frame.actor.orderRevision]);
   assert.deepEqual(step.from,from);assert.deepEqual(step.to,to);assert.equal(step.reason,'steering');
   const admission=frame.admissions[0];assert.equal(admission.admission,'steering-admitted');assert.equal(admission.finalized,false);
   assert.deepEqual([admission.actor.x,admission.actor.z],[to.x,to.z]);assert.equal(admission.actor.pathIndex,frame.actor.pathIndex);
  }
 } finally {await observer.dispose();}
}
result.status='passed';console.log(JSON.stringify(result,null,2));
if(process.argv[4])await writeFile(process.argv[4],JSON.stringify(result,null,2)+'\n');
