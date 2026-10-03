import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:60000});
const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
let token=100;const records=[];
try {
  await fixture.start();const clients=[await fixture.connect(0),await fixture.connect(1)];
  for(const team of [0,1]) {
    const map={...pathingBaselineMap({group:64}),id:`queued-wall-native-${team}`},c=clients[team];
    clients[0].send({type:'publishMap',map});
    await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'queued wall map')));
    const army=c.latest.units.filter(u=>u[1]===team&&u[5]==='infantry'),ids=army.map(u=>u[0]);
    const worker=c.latest.units.find(u=>u[1]===team&&u[5]==='worker');
    async function order(command,expected) {
      command.clientOrderToken=token++;
      const notice=await c.command(command,new RegExp(`(?:${expected.source})|REJECTED|FAILED`));
      assert.ok(expected.test(notice.message),notice.message);
    }
    await order({type:'move',ids,unitGenerations:army.map(u=>u[8]),x:-8.5,z:.5},/MOVE ORDER/);
    await order({type:'move',ids,unitGenerations:army.map(u=>u[8]),x:16.5,z:.5,queue:true},/WAYPOINT QUEUED/);
    const before=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every(id=>s.state.units[id].queuedWaypoints.length===1));
    const requested=ids.map(id=>before.state.units[id].queuedWaypoints[0].destination);
    assert.equal(new Set(requested).size,64);
    await order({type:'buildWall',ids:[worker[0]],unitGenerations:[worker[8]],points:[{column:61,row:32},{column:67,row:32}]},/PALISADE LINE PLACED/);
    const wall=new Set(Array.from({length:7},(_,i)=>32*map.width+61+i));
    const admitted=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.buildings.length===7);
    assert.deepEqual(admitted.state.units.filter(u=>u.buildingTargetId!==null).map(u=>u.id),[worker[0]]);
    assert.ok(requested.some(c=>wall.has(c)));
    const done=u=>u.queuedWaypoints.length===0&&!u.movePlanningPending&&u.pathIndex===u.path.length
      &&Math.hypot(u.x-(u.moveGoalCell%map.width-map.width/2+.5),u.z-(Math.floor(u.moveGoalCell/map.width)-map.height/2+.5))<.02;
    const completed=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every(id=>done(s.state.units[id])));
    const goals=ids.map(id=>completed.state.units[id].moveGoalCell);
    assert.equal(new Set(goals).size,64);
    assert.ok(goals.every(c=>!wall.has(c)));
    assert.ok(goals.every((c,i)=>wall.has(requested[i])||c===requested[i]));
    records.push({team,group:64,queuedBefore:requested,goalsAfter:goals,arrived:64,distinctGoals:64,
      onlyNamedBuilder:true,unblockedDestinationsPreserved:true,ticks:completed.state.tickNumber-before.state.tickNumber});
    console.log(JSON.stringify({team,arrived:64,distinctGoals:64,ticks:records.at(-1).ticks}));
  }
  const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,records,
    limits:['actual native two-seat WebSocket commands, no renderer/deployment evidence','native scheduling excluded from exact replay claim; no hosted capacity or speedup claim']};
  if(process.env.DYNAMIC_WALL_NATIVE_RECORD)await writeFile(process.env.DYNAMIC_WALL_NATIVE_RECORD,JSON.stringify(report,null,2)+'\n');
}finally{await fixture.dispose();}
