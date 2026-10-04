import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile,writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';

// Custom-map bootstrap is trusted. All work/reconnect/restart is native through
// real sockets and production authority; the saved shutdown file is untouched.
test('native both-seat selected forest groups retain work/cargo privacy across warm reconnect and cold process restart',async()=>{
 const map={id:'forest-groups-native',name:'Forest groups native',width:64,height:64,startingArmySize:8,
  startingResources:{food:0,wood:0},fogOfWar:true,spawnPoints:[{team:0,x:-20,z:0},{team:1,x:20,z:0}],
  obstacles:[{column:20,row:30,width:3,height:4,material:'forest'},{column:41,row:30,width:3,height:4,material:'forest'}],
  resourceNodes:[],triggers:[],scenarioEvents:[]};
 const f=await createFortifiedFixture({mapPath:'maps/open-field.json',timeoutMs:30000});let seed;
 try {
  seed=await createPveHeadlessFixture(map,{matchModeId:'authored',matchModeVersion:1});
  await writeFile(f.checkpointPath,JSON.stringify(seed.replay.checkpoint()));await seed.dispose();seed=null;
  await f.start();let clients=[await f.connect(0),await f.connect(1)];
  const ids=[[0,1],[4,5]],anchors=[31*64+21,31*64+42],tokens=clients.map(c=>c.welcome.player.sessionToken);
  const privacy=()=>{for(const team of [0,1]){const s=clients[team].latest;
   assert.equal(s.units.some(u=>u[1]!==team),false);assert.equal(s.wood[1-team],null);assert.equal(s.food[1-team],null);
   assert.ok(s.forestStocks.every(([cell])=>team===0?cell%64<32:cell%64>32));}};
  for(const team of [0,1]) assert.match((await clients[team].command({type:'gather',ids:ids[team],forestCell:anchors[team]},/./)).message,/GATHER ORDER/);
  const productive=await f.checkpoint(cp=>ids.flat().every(id=>cp.state.units[id].cargo>0));privacy();
  const intents=ids.flat().map(id=>productive.state.units[id].workIntent);
  for(const team of [0,1]){const closed=once(clients[team].socket,'close');clients[team].socket.close();await closed;clients[team]=await f.connect(team,tokens[team]);}
  const warm=await f.checkpoint(cp=>cp.state.tickNumber>productive.state.tickNumber);
  assert.deepEqual(ids.flat().map(id=>warm.state.units[id].workIntent),intents);privacy();
  await f.stop();const saved=JSON.parse(await readFile(f.checkpointPath,'utf8'));
  await f.start();clients=[await f.connect(0,tokens[0]),await f.connect(1,tokens[1])];
  for(const c of clients)assert.ok(c.welcome.recoveredFromCheckpoint);privacy();
  const restored=await f.checkpoint(cp=>cp.state.tickNumber>saved.state.tickNumber);
  assert.equal(restored.matchId,saved.matchId);assert.equal(restored.mapDefinition.id,map.id);
  assert.deepEqual(ids.flat().map(id=>restored.state.units[id].workIntent),intents);
  const deposited=await f.checkpoint(cp=>cp.state.teamWood.every(bank=>bank>=20));privacy();
  const drawn=deposited.state.forestStocks.reduce((n,[,stock])=>n+6-stock,0);
  const cargo=deposited.state.units.filter(u=>u.cargoType==='wood').reduce((n,u)=>n+u.cargo,0);
  assert.ok(Math.abs(drawn-deposited.state.teamWood.reduce((a,b)=>a+b,0)-cargo)<1e-3);
  for(const team of [0,1])assert.match((await clients[team].command({type:'stop',ids:ids[team]},/./)).message,/STOP ORDER/);
  const done=await f.checkpoint(cp=>ids.flat().every(id=>cp.state.units[id].workIntent===null));
  console.log(JSON.stringify({scope:'native-authority',bothSeats:true,selectedPerSeat:2,warmReconnect:true,coldRestart:true,wood:deposited.state.teamWood,screenshots:0,stoppedTick:done.state.tickNumber}));
 }finally{if(seed)await seed.dispose();await f.dispose();}
});
