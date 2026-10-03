import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { workerCombatMap } from './worker-combat-repath-case.mjs';

const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceSha256=createHash('sha256').update(await readFile(new URL('../server.mjs',import.meta.url))).digest('hex');
async function run(workerTeam) {
  const fixture=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:35000});
  const workerId=workerTeam?5:0,infantryId=workerTeam?4:9;
  try {
    await fixture.start();let clients=[await fixture.connect(0),await fixture.connect(1)];
    const sessions=clients.map(c=>c.welcome.player.sessionToken),map=await workerCombatMap();
    map.id+=`-native-${workerTeam}`;
    clients[0].send({type:'publishMap',map,persist:true});
    await Promise.all(clients.map(c=>c.wait(m=>m.type==='mapChange'&&m.map.id===map.id,'Worker duel map')));
    const before=await fixture.checkpoint(s=>s.mapDefinition.id===map.id);
    const parked=s=>s.state.units.filter(u=>![workerId,infantryId].includes(u.id))
      .map(u=>({id:u.id,x:u.x,z:u.z,orderRevision:u.orderRevision}));
    await Promise.all([[workerTeam,workerId,infantryId],[1-workerTeam,infantryId,workerId]].map(async([team,id,targetId])=>{
      const notice=await clients[team].command({type:'attack',ids:[id],targetId,clientOrderToken:10+team},/ATTACK ORDER|REJECTED/);
      assert.match(notice.message,/ATTACK ORDER/);
    }));
    const pursuit=await fixture.checkpoint(s=>s.state.units[workerId].attackTargetId===infantryId
      &&s.state.units[infantryId].attackTargetId===workerId&&s.state.units[workerId].hp===100
      &&s.state.units[infantryId].hp===100);
    await fixture.stop();await fixture.start();
    clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
    const resolved=await fixture.checkpoint(s=>s.state.units[workerId].hp===0&&s.state.units[infantryId].attackTargetId===-1);
    const infantryHp=resolved.state.units[infantryId].hp;
    assert.ok(infantryHp>0&&infantryHp<100,'Infantry survives real reciprocal damage');
    assert.deepEqual(parked(resolved),parked(before),'idle units retain positions and orders');
    await fixture.stop();await fixture.start();
    clients=[await fixture.connect(0,sessions[0]),await fixture.connect(1,sessions[1])];
    assert.ok(clients.every(c=>c.welcome.recoveredFromCheckpoint));
    const stable=await fixture.checkpoint(s=>s.sequence>resolved.sequence);
    assert.equal(stable.state.units[workerId].hp,0);assert.equal(stable.state.units[infantryId].hp,infantryHp);
    assert.equal(stable.state.units[infantryId].attackTargetId,-1);assert.deepEqual(parked(stable),parked(before));
    const result={workerTeam,workerHp:0,infantryHp,ticks:resolved.state.tickNumber-pursuit.state.tickNumber,
      restartDuringPursuit:true,postCombatRestartStable:true,parkedRosterUnchanged:true};
    console.log(JSON.stringify(result));return result;
  } finally { await fixture.dispose(); }
}
const records=await Promise.all([run(0),run(1)]);
if(process.env.WORKER_COMBAT_NATIVE_RECORD)await writeFile(process.env.WORKER_COMBAT_NATIVE_RECORD,JSON.stringify({head,sourceSha256,records,
  limits:['ordinary two-seat native starting roster and attack commands; no actor/HP/position injection',
    'native proof uses open fog-off map and direct attacks; fixed-body matrix also covers Attack Move and four spawn orientations',
    'no renderer, deployment or performance claim']},null,2)+'\n');
