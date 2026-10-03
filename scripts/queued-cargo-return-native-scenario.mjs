import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { assertCargoConserved, queuedCargoMap } from './queued-cargo-return-case.mjs';

const fixture = await createFortifiedFixture({ mapPath: 'maps/open-field.json', timeoutMs: 30000 });
const sourceSha256 = createHash('sha256').update(await readFile(new URL('../server.mjs', import.meta.url))).digest('hex');
const records = []; let token = 200;
try {
  await fixture.start(); let clients = [await fixture.connect(0), await fixture.connect(1)];
  const sessions = clients.map(c => c.welcome.player.sessionToken);
  for(const [type,stock] of [['food',.5],['food',.004],['wood',7.25]]) {
    const map = await queuedCargoMap({type,stock}); map.id += `-${String(stock).replace('.', '-')}`;
    clients[0].send({type:'publishMap',map,persist:true});
    await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'cargo map')));
    const selected = clients.map((c,team)=>c.latest.units.find(u=>u[1]===team&&u[5]==='worker'));
    const ids=selected.map(u=>u[0]);
    const bank = s => type==='food'?s.state.teamFood:s.state.teamWood;
    const conserve = s => assertCargoConserved({stock:s.state.resourceNodes.reduce((n,v)=>n+v.stock,0),
      bank:bank(s).reduce((n,v)=>n+v,0),cargo:s.state.units.filter(u=>u.cargoType===type).reduce((n,v)=>n+v.cargo,0)},stock*2);
    async function order(team,value,expected) {
      const notice = await clients[team].command({...value,clientOrderToken:token++},
        new RegExp(`${expected.source}|REJECTED|FAILED`));
      assert.ok(expected.test(notice.message),notice.message);
    }
    await Promise.all(clients.map(async(c,team)=>{
      const node=map.resourceNodes[team];
      await order(team,{type:'move',ids:[ids[team]],x:node.x,z:node.z},/MOVE ORDER/);
      await c.state(s=>s.resourceNodes.some(n=>n.id===node.id),'own source revealed');
      await order(team,{type:'gather',ids:[ids[team]],nodeId:node.id},/GATHER ORDER/);
    }));
    await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&s.state.resourceNodes.every(n=>n.stock===0)
      &&ids.every(id=>Math.abs(s.state.units[id].cargo-stock)<1e-12));
    await Promise.all(clients.map((c,team)=>order(team,{type:'stop',ids:[ids[team]]},/STOP ORDER/)));
    const stopped=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every(id=>s.state.units[id].gatherPhase===''));
    conserve(stopped);assert.deepEqual(bank(stopped),[0,0]);
    const untouched=stopped.state.units.filter(u=>!ids.includes(u.id));
    for(const team of [0,1]) {
      assert.ok(!clients[team].latest.resourceNodes.some(n=>n.id===map.resourceNodes[1-team].id),'hidden foreign source is absent');
      assert.ok(clients[team].latest.units.every(u=>u[1]===team),'hidden foreign units are absent');
      await order(team,{type:'gather',ids:[ids[team]],nodeId:map.resourceNodes[team].id},/RESOURCE NODE EMPTY/);
      await order(team,{type:'returnCargo',ids:[ids[1-team]]},/RETURN CARGO REJECTED/);
      await order(team,{type:'returnCargo',ids:[ids[team]],unitGenerations:[selected[team][8]-1]},/RETURN CARGO REJECTED/);
    }
    await Promise.all(clients.map(async(c,team)=>{
      await order(team,{type:'returnCargo',ids:[ids[team]],unitGenerations:[selected[team][8]]},/RETURN CARGO ORDER/);
      await order(team,{type:'move',ids:[ids[team]],x:team?15.5:-15.5,z:-8.5,queue:true},/WAYPOINT QUEUED/);
      await order(team,{type:'attackMove',ids:[ids[team]],x:team?11.5:-11.5,z:-12.5,queue:true},/WAYPOINT QUEUED/);
    }));
    const queued=await fixture.checkpoint(s=>s.mapDefinition.id===map.id&&ids.every(id=>s.state.units[id].gatherPhase==='to-base'
      &&s.state.units[id].queuedWaypoints.length===2&&s.state.units[id].cargo>0));
    conserve(queued);const destinations=ids.map(id=>queued.state.units[id].queuedWaypoints[1].destination);
    await fixture.stop(); const saved=JSON.parse(await readFile(fixture.checkpointPath,'utf8'));
    conserve(saved);assert.ok(ids.every(id=>saved.state.units[id].cargo>0&&saved.state.units[id].queuedWaypoints.length===2));
    await fixture.start();clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
    let snapshotsChecked=0;
    const completed=await fixture.checkpoint(s=>{
      if(s.mapDefinition.id!==map.id)return false;
      conserve(s);snapshotsChecked++;
      assert.deepEqual(s.state.units.filter(u=>!ids.includes(u.id)),untouched,'unselected units retain their intent and position');
      for(const id of ids)if(s.state.units[id].cargo>0)assert.equal(s.state.units[id].queuedWaypoints.length,2,'queue waits for deposit');
      return ids.every((id,i)=>{
        const u=s.state.units[id],cell=destinations[i];
        return u.cargo===0&&u.gatherPhase===''&&u.queuedWaypoints.length===0&&!u.movePlanningPending
          &&u.pathIndex===u.path.length&&u.moveGoalCell===cell&&u.attackMove
          &&Math.hypot(u.x-(cell%map.width-map.width/2+.5),u.z-(Math.floor(cell/map.width)-map.height/2+.5))<.02;
      });
    });
    assert.ok(bank(completed).every(n=>Math.abs(n-stock)<1e-12));
    for(const team of [0,1])await order(team,{type:'returnCargo',ids:[ids[team]]},/RETURN CARGO REJECTED/);
    await fixture.stop();await fixture.start();clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    const stable=await fixture.checkpoint(s=>s.sequence>completed.sequence);conserve(stable);
    assert.deepEqual(bank(stable),bank(completed));
    records.push({type,stock,teams:[0,1],arrived:2,waypointsPerWorker:2,bank:bank(stable),cargo:ids.map(id=>stable.state.units[id].cargo),
      snapshotsChecked,unselectedUnitsUnchanged:true,hiddenForeignSourcesAndUnitsAbsent:true,
      foreignAndStaleGenerationRejected:true,deliveryQueueRecovery:true,postDepositRestartCreditOnce:true,
      ticks:completed.state.tickNumber-queued.state.tickNumber});
    console.log(JSON.stringify(records.at(-1)));
  }
  if(process.env.QUEUED_CARGO_NATIVE_RECORD)await writeFile(process.env.QUEUED_CARGO_NATIVE_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256,records,
    limits:['actual asynchronous two-seat WebSocket server with natural gathering and restart; no injected cargo or position',
      'selected delivery and two queued ground legs only; no universal target-lifecycle or navigation claim','no renderer, deployment or performance claim']},null,2)+'\n');
}finally{await fixture.dispose();}
