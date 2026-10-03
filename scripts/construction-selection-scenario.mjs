import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { constructionClientFixture } from './construction-client-fixture.mjs';

const observe=process.argv.includes('--observe');
const map=JSON.parse(await readFile(new URL('../maps/open-field.json',import.meta.url)));
Object.assign(map,{id:'selected-worker-construction',startingArmySize:16,fogOfWar:false,
  startingResources:{food:500,wood:1000},scenarioEvents:[]});
const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:30000});
const clientSha256=createHash('sha256').update(await readFile(new URL('../src/main.js',import.meta.url))).digest('hex');
let token=100;
const unitsFor=c=>c.latest.units.map(u=>({id:u[0],team:u[1],serverX:u[2],serverZ:u[3],hp:u[4],kind:u[5],generation:u[8]}));
const events=[];
try {
  await fixture.start();let clients=[await fixture.connect(0),await fixture.connect(1)];
  const sessions=clients.map(c=>c.welcome.player.sessionToken);
  clients[0].send({type:'publishMap',map,persist:true});
  await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'selected-worker map')));
  async function order(team,command,expected) {
    command.clientOrderToken??=token++;
    const notice=await clients[team].command(command,new RegExp(`(?:${expected.source})|REJECTED|FAILED`));
    assert.ok(expected.test(notice.message),notice.message);return notice;
  }
  const builders=[];
  for(const team of observe?[0]:[0,1]) {
    const c=clients[team],workers=c.latest.units.filter(u=>u[1]===team&&u[5]==='worker'),ids=workers.map(u=>u[0]);
    const sign=team?1:-1;
    for(const [offset,type] of [[1,'food'],[2,'wood']]) {
      const node=map.resourceNodes.find(n=>n.type===type&&(team?n.x>0:n.x<0));
      await order(team,{type:'gather',ids:[ids[offset]],nodeId:node.id},/GATHER ORDER/);
    }
    await order(team,{type:'move',ids:[ids[3]],x:sign*24.5,z:-6.5},/MOVE ORDER/);
    await order(team,{type:'move',ids:[ids[3]],x:sign*24.5,z:-12.5,queue:true},/WAYPOINT QUEUED/);
    const before=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.units[ids[3]].queuedWaypoints.length===1);
    const ui=constructionClientFixture({team,units:unitsFor(c),selection:[ids[0]],buildings:c.latest.buildings});
    ui.context.buildPlacementAt=()=>({valid:true,x:sign*18.5,z:10.5});
    ui.context.beginBuildPlacement('house');ui.context.submitBuildPlacement(0,0);
    const payload=ui.payloads[0];await order(team,payload,/BUILD ORDER/);
    const saved=await fixture.checkpoint(s=>s.state.units[ids[0]].buildingTargetId!==null);
    const buildingId=saved.state.units[ids[0]].buildingTargetId;
    const assigned=ids.filter(id=>saved.state.units[id].buildingTargetId===buildingId);
    events.push({team,selectedBefore:[ids[0]],selectedAfter:[...ui.selected],payload,assigned,
      gatherAfter:ids.slice(1,3).map(id=>saved.state.units[id].gatherNodeId),queuedAfter:saved.state.units[ids[3]].queuedWaypoints});
    if(observe)break;
    assert.deepEqual(payload.ids,[ids[0]]);assert.deepEqual(assigned,[ids[0]]);
    for(const id of ids.slice(1,3))assert.equal(saved.state.units[id].gatherNodeId,before.state.units[id].gatherNodeId);
    assert.deepEqual(saved.state.units[ids[3]].queuedWaypoints,before.state.units[ids[3]].queuedWaypoints);
    for(const bad of [[],[clients[1-team].latest.units.find(u=>u[1]===1-team&&u[5]==='worker')[0]]]) {
      await order(team,{type:'build',ids:bad,buildingType:'house',x:sign*10.5,z:16.5},/BUILD REJECTED/);
    }
    await order(team,{type:'build',ids:[ids[0]],unitGenerations:[workers[0][8]+1],buildingType:'house',x:sign*10.5,z:16.5},/BUILD REJECTED/);
    const cooperative=constructionClientFixture({team,units:unitsFor(c),selection:ids.slice(0,2),buildings:c.latest.buildings});
    cooperative.context.buildPlacementAt=()=>({valid:true,x:sign*11.5,z:12.5});
    cooperative.context.beginBuildPlacement('house');cooperative.context.submitBuildPlacement(0,0);
    await order(team,cooperative.payloads[0],/BUILD ORDER/);
    const cooperating=await fixture.checkpoint(s=>ids.slice(0,2).every(id=>s.state.units[id].buildingTargetId!==null&&s.state.units[id].buildingTargetId!==buildingId));
    assert.equal(cooperating.state.units[ids[0]].buildingTargetId,cooperating.state.units[ids[1]].buildingTargetId);
    await order(team,{type:'stop',ids:ids.slice(0,2)},/STOP ORDER/);
    const help=constructionClientFixture({team,units:unitsFor(c),selection:ids.slice(0,2),buildings:c.latest.buildings});
    help.context.resumeConstruction();assert.deepEqual(help.payloads[0].ids,ids.slice(0,2));
    assert.equal(help.payloads[0].buildingId,buildingId,'nearest unfinished site remains available for selected helpers');
    await order(team,help.payloads[0],/BUILD RESUME ORDER/);
    const helping=await fixture.checkpoint(s=>ids.slice(0,2).every(id=>s.state.units[id].buildingTargetId===buildingId));
    assert.equal(helping.state.units[ids[2]].gatherNodeId,before.state.units[ids[2]].gatherNodeId);
    assert.equal(helping.state.units[ids[3]].buildingTargetId,null);
    builders.push({team,ids:ids.slice(0,2),buildingId,untouchedGatherer:ids[2]});
  }
  if(!observe) {
    await fixture.stop();await fixture.start();
    clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
    const recovered=await fixture.checkpoint(s=>builders.every(b=>b.ids.every(id=>s.state.units[id].buildingTargetId===b.buildingId)));
    for(const b of builders) {
      assert.equal(recovered.state.units[b.untouchedGatherer].buildingTargetId,null);
      assert.ok(recovered.state.units[b.untouchedGatherer].gatherNodeId);
    }
    await fixture.checkpoint(s=>builders.every(b=>s.state.buildings.some(row=>row.id===b.buildingId&&row.complete)));
  }
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),clientSha256,observe,events,
    bothSeatSelectedOnly:!observe,cooperativeAndNearestResume:!observe,unselectedGatherAndQueuedMovePreserved:!observe,
    foreignStaleAndEmptyRejected:!observe,workerAssignmentsRecoverAndComplete:!observe,
    limits:['actual client functions in VM with rendering/picking supplied; native authoritative server, no Chrome capture',
      'current fork source; user production/staging session and deployment not verified']};
  if(process.env.CONSTRUCTION_SELECTION_RECORD)await writeFile(process.env.CONSTRUCTION_SELECTION_RECORD,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await fixture.dispose();}
