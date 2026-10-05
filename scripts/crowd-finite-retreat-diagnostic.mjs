import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {ordinaryCrowdBodyRadius} from '../src/unit-crowd-steering.mjs';
import { LAND_CLEARANCE_PROFILE } from '../src/unit-movement.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const replaceOnce = (text, before, after) => {
  assert.equal(text.split(before).length - 1, 1, `diagnostic adapter seam changed: ${before}`);
  return text.replace(before, () => after);
};

// Adapt copies of the canonical fixed-tick fixture, crowd module and server.
// Shared production files and the original admission/position-write branches stay intact.
export async function createFiniteRoomFixture(map, config, { probeModuleUrl = new URL('./crowd-finite-retreat-probe.mjs', import.meta.url).href } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'rts-finite-room-'));
  let fixture;
  try {
    const original = await readFile(path.join(root, 'server.mjs'), 'utf8');
    const crowdPath = path.join(directory, 'crowd.mjs');
    const crowd = (await readFile(path.join(root, 'src/unit-crowd-steering.mjs'), 'utf8'))
      .replace(/from '(\.\/?[^']+)'/g, (_, name) => `from '${pathToFileURL(path.resolve(root, 'src', name)).href}'`)
      + '\nexport function diagnosticHasGrant(unit){const s=steeringStates.get(unit);return Boolean(s?.lease||s?.contour);}\n';
    await writeFile(crowdPath, crowd);
    let source = `import {createFiniteRoomProbe} from ${JSON.stringify(probeModuleUrl)};\nconst finiteRoomProbe=createFiniteRoomProbe(${JSON.stringify(config)});\n` + original;
    source = replaceOnce(source, "from './src/unit-crowd-steering.mjs'", `from '${pathToFileURL(crowdPath).href}'`);
    source = replaceOnce(source, 'stationaryCrowdObstacle, selectCrowdStep, crowdPassagePoint, CROWD_NEIGHBOR_LIMIT',
      'stationaryCrowdObstacle, selectCrowdStep, crowdPassagePoint, CROWD_NEIGHBOR_LIMIT, diagnosticHasGrant');
    source = replaceOnce(source, 'function getMoveVector(unit, remainingStep = UNIT_DEFINITIONS[unit.kind].combat.moveSpeed * STEP_SECONDS, allowLocalDetour = true) {',
      'function getMoveVectorImplementation(unit, remainingStep = UNIT_DEFINITIONS[unit.kind].combat.moveSpeed * STEP_SECONDS, allowLocalDetour = true) {');
    const listen = source.lastIndexOf('\nserver.listen(PORT, HOST, () => {');
    assert.ok(listen > 0);
    source = source.slice(0, listen) + `
function getMoveVector(unit, remainingStep, allowLocalDetour){
 const query=ordinaryCrowdBodyRadius(unit)?crowdNeighborsNear(unit):null;
 const normal=getMoveVectorImplementation(unit,remainingStep,allowLocalDetour);
 return finiteRoomProbe.select({unit,tick:tickNumber,remainingStep,query,queryFor:crowdNeighborsNear,units,navigationRevision,epoch:movePlanningEpoch,normal,hasGrant:diagnosticHasGrant(unit),map:{width:MAP_WIDTH,height:MAP_HEIGHT,point:cellToWorld,cell:worldToCell,levels:elevationLevelByCell,isWalkable}});
}
` + source.slice(listen);
    let adapter = await readFile(path.join(root, 'scripts/pathing-replay-fixture.mjs'), 'utf8');
    adapter = replaceOnce(adapter, "const root = fileURLToPath(new URL('..', import.meta.url));", `const root = ${JSON.stringify(root)};`);
    adapter = replaceOnce(adapter, "const original = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');", `const original = ${JSON.stringify(source)};`);
    adapter = replaceOnce(adapter, '  get units() { return units; },', '  get finiteRoomReport(){ return structuredClone(finiteRoomProbe.report); },\n  get units() { return units; },');
    const adapterPath = path.join(directory, 'fixture.mjs');
    await writeFile(adapterPath, adapter);
    const { createPathingReplayFixture } = await import(pathToFileURL(adapterPath).href);
    fixture = await createPathingReplayFixture(map, { traceLandSteps: true, traceCrowdSteps: true });
    return { ...fixture, baseSourceSha256: createHash('sha256').update(original).digest('hex'),
      async dispose() { await fixture.dispose(); await rm(directory, { recursive: true, force: true }); } };
  } catch (error) {
    await fixture?.dispose(); await rm(directory, { recursive: true, force: true }); throw error;
  }
}

import { configureLandBodyReplay } from './land-body-clearance-fixture.mjs';
import { sweptStaticBodyContacts, sweptBodyPairMargin } from './land-body-clearance.mjs';

const retainedIntent = u => JSON.stringify([u.id,u.generation,u.x,u.z,u.hp,u.orderRevision,u.moveGoalCell,
  u.moveGoalPoint,u.pathIndex,u.path,u.queuedWaypoints,u.holdingPosition,u.persistentOrder,u.combatStance,
  u.gatherPhase,u.gatherNodeId,u.gatherForestCell,u.buildingTargetId,u.workIntent]);

export async function runFiniteRoomTrial({ input, ownerId, peerIds, angle, mode = 'baseline', ticks = 48 }) {
  assert.ok(Number.isInteger(ticks) && ticks > 0 && ticks <= 120);
  assert.ok(['baseline', 'retreat'].includes(mode));
  configureLandBodyReplay();
  const config = { mode, ownerId, peerIds, angle, startTick: input.state.tickNumber + 1 };
  const fixture = await createFiniteRoomFixture(input.mapDefinition, config), r = fixture.replay;
  try {
    assert.ok(r.validate(structuredClone(input)), 'valid retained checkpoint required');
    r.restore(structuredClone(input));
    const owner = r.units[ownerId];assert.ok(ordinaryCrowdBodyRadius(owner));
    const selected = r.units.filter(u => u.team === owner.team && u.kind === 'infantry');
    const ids = new Set(selected.map(u => u.id));
    const inactive = r.units.filter(u => !ids.has(u.id)).map(retainedIntent);
    const actors = [ownerId, ...peerIds].map(id => {
      const u = r.units[id];assert.ok(u && ids.has(id));
      return { id, x:u.x, z:u.z, revision:u.orderRevision, pathIndex:u.pathIndex,
        goal:u.moveGoalCell, queue:u.queuedWaypoints.map(q=>q.destination), raw:r.point(u.path[u.pathIndex] ?? u.moveGoalCell) };
    });
    const trace = createHash('sha256'), samples=[];
    let selectedSubsteps=0,staticContacts=0,pairContacts=0,worstPairMargin=Infinity;
    for(let tick=1;tick<=ticks;tick++) {
      r.step();
      for(const step of r.landSteps.filter(s=>ids.has(s.id))) {
        selectedSubsteps++;const radius=LAND_CLEARANCE_PROFILE.radiusByKind[step.kind];
        staticContacts+=Number(sweptStaticBodyContacts(step.from,step.to,radius,input.mapDefinition.width,
          input.mapDefinition.height,r.isWalkable).contacts.length>0);
        let contact=false;
        for(const other of step.neighbours) {
          const margin=sweptBodyPairMargin(step,radius,other,LAND_CLEARANCE_PROFILE.radiusByKind[other.kind]);
          worstPairMargin=Math.min(worstPairMargin,margin);contact ||= margin < -1e-9;
        }
        pairContacts+=Number(contact);
      }
      const idle=r.units.filter(u=>!ids.has(u.id));
      assert.equal(idle.filter((u,i)=>retainedIntent(u)!==inactive[i]).length,0,'inactive position, health and accepted intent retained');
      trace.update(JSON.stringify(r.units)+'\n');
      if(tick<=15||tick===24||tick===ticks) samples.push({tick,actors:actors.map(before=>{
        const u=r.units[before.id];return {id:u.id,revision:u.orderRevision,pathIndex:u.pathIndex,
          goal:u.moveGoalCell,queue:u.queuedWaypoints.map(q=>q.destination),
          rawProgress:Math.hypot(before.x-before.raw.x,before.z-before.raw.z)-Math.hypot(u.x-before.raw.x,u.z-before.raw.z)};
      })});
    }
    assert.equal(staticContacts,0);assert.equal(pairContacts,0);
    return {mode,ticks,ownerId,peerIds,inputSha256:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      baseSourceSha256:fixture.baseSourceSha256,adapterSourceSha256:fixture.sourceSha256,
      selectedSubsteps,staticContacts,pairContacts,worstPairMargin,inactiveActorsPreserved:inactive.length,
      traceSha256:trace.digest('hex'),samples,probe:r.finiteRoomReport};
  } finally { await fixture.dispose(); }
}

// Observe the existing successful paid-gate controls; no retreat is injected here.
export async function runFiniteRoomGateControls() {
  const directory=await mkdtemp(path.join(tmpdir(),'rts-room-gates-'));
  try {
    const helperUrl=pathToFileURL(path.join(root,'scripts/crowd-finite-retreat-diagnostic.mjs')).href;
    const shim=path.join(directory,'fixture.mjs');
    await writeFile(shim,`import {createFiniteRoomFixture} from ${JSON.stringify(helperUrl)};
export const observations=[];
export async function createPathingReplayFixture(map){
 const f=await createFiniteRoomFixture(map,{mode:'baseline',ownerId:0,peerIds:[],angle:180,startTick:0});
 return {...f,async dispose(){observations.push(f.replay.finiteRoomReport);await f.dispose();}};
}`);
    let scenario=await readFile(path.join(root,'scripts/queued-gate-pathing.mjs'),'utf8');
    scenario=scenario.replace(/from '(\.\/?[^']+)'/g,(_,name)=>`from '${pathToFileURL(path.resolve(root,'scripts',name)).href}'`);
    scenario=replaceOnce(scenario,pathToFileURL(path.join(root,'scripts/pathing-replay-fixture.mjs')).href,pathToFileURL(shim).href);
    const filename=path.join(directory,'gate.mjs');await writeFile(filename,scenario);
    const {runQueuedGateCase}=await import(pathToFileURL(filename).href);
    const records=[];for(const team of[0,1])records.push(await runQueuedGateCase({team,tracePhysical:true}));
    const {observations}=await import(pathToFileURL(shim).href);
    return records.map((r,i)=>({team:r.team,ticks:r.ticks,arrived:r.arrived,physical:r.physical,
      inactiveActorsPreserved:r.inactiveActorsPreserved,projection:observations[i].stats}));
  } finally {await rm(directory,{recursive:true,force:true});}
}

async function main() {
  const options=Object.fromEntries(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');assert.ok(i>2,'use --name=value');return [arg.slice(2,i),arg.slice(i+1)];}));
  if(options['gate-controls']==='true'){console.log(JSON.stringify(await runFiniteRoomGateControls(),null,2));}
  else {
  assert.ok(options.input,'--input=LOCAL_CHECKPOINT required; this tool never fetches archives');
  const input=JSON.parse(await readFile(options.input,'utf8'));
  const ownerId=Number(options.owner),peerIds=options.peers.split(',').map(Number),angle=Number(options.angle),ticks=Number(options.ticks??48);
  const runs=[];
  for(const mode of ['baseline','retreat']) for(let repeat=0;repeat<2;repeat++) runs.push(await runFiniteRoomTrial({input,ownerId,peerIds,angle,ticks,mode}));
  assert.equal(runs[0].traceSha256,runs[1].traceSha256,'baseline exact repeat');
  assert.equal(runs[2].traceSha256,runs[3].traceSha256,'finite retreat exact repeat');
  console.log(JSON.stringify({limits:['cold transient state / fixed planning-drain diagnostic; no native completion or fairness qualification','no production executor adoption, deployment or rendered proof'],runs:runs.filter((_,i)=>i%2===0)},null,2));
}
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error=>{console.error(error);process.exitCode=1;});
