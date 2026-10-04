// Authoritative scene preparation only: no browser, rendered/deployed acceptance.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createFortifiedFixture } from './fortified-crossing-fixture.mjs';
import { regressionMap } from './renderer-site-composition-scenario.mjs';
const startedAt = performance.now();
const fixture = await createFortifiedFixture({mapPath:null,supervisor:true,timeoutMs:60000});
const report={scope:'native-paid-scene-preparation',renderedFrames:0,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),rootDomEntry:false,matchMode:'authored@1',launchRoute:'public-Practice-room',mapId:regressionMap.id,checks:[]};
let clients,token=30000;
try {
  await fixture.start();
  const response=await fetch(`http://127.0.0.1:${fixture.port}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'pvp',practice:true,matchModeId:'authored',matchModeVersion:1})});
  assert.equal(response.status,201);
  const {roomId}=await response.json();
  const checkpointPath=fixture.directory+'/rooms/rooms/'+roomId+'/match-state.json';
  const nativeCheckpoint=fixture.checkpoint.bind(fixture);fixture.checkpoint=(predicate)=>nativeCheckpoint(predicate,checkpointPath);
  clients=[await fixture.connect(0,null,roomId),await fixture.connect(1,null,roomId)];
  const after=clients[0].messages.length;clients[0].send({type:'publishMap',map:regressionMap});
  const applied=await clients[0].wait(m=>m.type==='mapRejected'||(m.type==='mapChange'&&m.state.mapId===regressionMap.id),'map applied',after);assert.equal(applied.type,'mapChange',applied.message);
  const snapshot=await fixture.checkpoint(s=>s.mapDefinition.id===regressionMap.id);
  const builders=[0,1].map(team=>snapshot.state.units.filter(u=>u.team===team&&u.kind==='worker'));
  const command=async(team,value,notice)=>{
    const reply=await clients[team].command({...value,clientOrderToken:token++},new RegExp(notice.source+'|REJECTED'));
    assert.match(reply.message,notice);return reply;
  };
  for(const team of [0,1]) {
    const sign=team===0?-1:1,cols=team===0?[15,20]:[48,43];
    const work=(slot,value)=>({...value,ids:[builders[team][slot].id],unitGenerations:[builders[team][slot].generation]});
    await command(team,work(0,{type:'build',buildingType:'watchtower',x:sign*16.5,z:-6.5}),/PLACED · WORKERS BUILDING/);
    await command(team,work(1,{type:'build',buildingType:'house',x:sign*10.5,z:-6.5}),/PLACED · WORKERS BUILDING/);
    await command(team,work(2,{type:'buildWall',points:[{column:cols[0],row:38},{column:cols[1],row:38},{column:cols[1],row:40}]}),/PALISADE LINE PLACED/);
    await command(team,work(3,{type:'build',buildingType:'palisade-gate',x:team===0?-10.5:10.5,z:8.5}),/PLACED · WORKERS BUILDING/);
  }
  const initial=await fixture.checkpoint(s=>s.state.buildings.length===22);
  assert.deepEqual(initial.state.teamWood,[1640,1640]); assert.deepEqual(initial.state.teamFood,[950,950]);
  report.checks.push({id:'real-paid-22-sites-ledger',passed:true});
  for(const team of[0,1]) {
    await fixture.checkpoint(s=>s.state.buildings.some(b=>b.team===team&&b.type==='palisade-wall'&&b.progress>=.4&&!b.complete));
    const live=await fixture.checkpoint();
    const gap=live.state.buildings.find(b=>b.team===team&&b.type==='palisade-wall'&&b.z===6.5&&b.x===(team===0?-13.5:13.5));
    assert.ok(gap&&!gap.complete); await command(team,{type:'cancelConstruction',buildingId:gap.id},/CONSTRUCTION CANCELLED/);
  }
  const done=await fixture.checkpoint(s=>s.state.buildings.length===20&&s.state.buildings.every(b=>b.complete));
  report.checks.push({id:'both-seat-natural-completion-after-gap',passed:true});
  report.completeSites=done.state.buildings.length;
  for(const team of[0,1]) {
    const worker=done.state.units.find(u=>u.id===builders[team][0].id),x=team===0?-16.5:16.5;
    for(const z of[-3.5,-9.5]) {
      await command(team,{type:'move',ids:[worker.id],unitGenerations:[worker.generation],x,z},/MOVE ORDER/);
      await fixture.checkpoint(s=>{const w=s.state.units[worker.id];return w.pathIndex>=w.path.length&&w.buildingTargetId===null&&Math.hypot(w.x-x,w.z-z)<.7});
    }
  }
  report.checks.push({id:'real-front-rear-approaches',passed:true});
  const raised={...regressionMap,id:regressionMap.id+'-raised',name:'Raised Site Composition Regression',fogOfWar:true,
    spawnPoints:[{team:0,x:22.5,z:22.5},{team:1,x:-12,z:0}]};
  const index=clients[0].messages.length;clients[0].send({type:'publishMap',map:raised});
  await clients[0].wait(m=>m.type==='mapChange'&&m.state.mapId===raised.id,'raised map',index);
  const fresh=await fixture.checkpoint(s=>s.mapDefinition.id===raised.id);
  const worker=fresh.state.units.find(u=>u.team===0&&u.kind==='worker');
  await command(0,{type:'build',buildingType:'house',ids:[worker.id],unitGenerations:[worker.generation],x:22.5,z:18.5},/PLACED · WORKERS BUILDING/);
  await fixture.checkpoint(s=>s.state.buildings.some(b=>b.team===0&&b.type==='house'&&b.complete));
  report.checks.push({id:'real-raised-house-reachable-completed',passed:true});
  report.status='passed';
} catch(error) {report.status='failed';report.error=error.message.split('\n')[0];throw error;}
finally {await fixture.dispose();report.durationMs=Math.round(performance.now()-startedAt);if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
