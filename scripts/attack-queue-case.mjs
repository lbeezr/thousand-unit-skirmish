import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';

export function attackQueueMap(){
  return {id:'attack-queue-water',name:'ATTACK QUEUE WATER',width:64,height:64,terrainSeed:19,fogOfWar:true,
    startingArmySize:24,startingResources:{food:1000,wood:1000},
    spawnPoints:[{team:0,x:-20,z:0},{team:1,x:20,z:0}],
    obstacles:[{column:25,row:42,width:14,height:14,material:'water'}],resourceNodes:[],triggers:[],scenarioEvents:[]};
}
export async function runAttackQueueCase({team=0,mode='unreachable',orderType='attack',queuedType='move',interrupt=null,observe=false}={}){
  const map=attackQueueMap(),fixture=await createPathingReplayFixture(map),r=fixture.replay;
  try{
    const defender=1-team,workers=t=>r.units.filter(u=>u.team===t&&u.kind==='worker').map(u=>u.id);
    const order=(t,command,pattern)=>{
      const notices=r.order(t,command);r.drain();assert.ok(notices.some(n=>pattern.test(n.message)),JSON.stringify(notices));
    };
    order(defender,{type:'build',buildingType:'dock',ids:workers(defender),x:.5,z:8.5},/DOCK PLACED/);
    order(team,{type:'build',buildingType:'archery-range',ids:workers(team),x:team?20.5:-20.5,z:-8.5},/RANGE PLACED/);
    while(r.buildings.some(b=>!b.complete)&&r.tick<1500)r.step();assert.ok(r.buildings.every(b=>b.complete));
    order(defender,{type:'trainUnit',buildingId:r.buildings.find(b=>b.type==='dock').id,kind:'skiff'},/QUEUED/);
    order(team,{type:'trainUnit',buildingId:r.buildings.find(b=>b.type==='archery-range').id,kind:'archer'},/QUEUED/);
    order(defender,{type:'move',ids:workers(defender),x:defender?20.5:-20.5,z:-14.5},/MOVE ORDER/);
    while((!r.units.some(u=>u.kind==='skiff')||!r.units.some(u=>u.kind==='archer'))&&r.tick<2200)r.step();
    const target=r.units.find(u=>u.kind==='skiff'),attacker=r.units.find(u=>u.kind==='archer'),observer=r.units[workers(team)[0]];
    assert.ok(target&&attacker);const firing={x:team?2.5:-1.5,z:9.5},destination={x:team?20.5:-20.5,z:-14.5};
    if(mode==='unreachable'){
      order(team,{type:'move',ids:[observer.id],x:7.5,z:14.5},/MOVE ORDER/);
      while(observer.pathIndex<observer.path.length&&r.tick<2800)r.step();
    }
    const reveal=mode==='hidden'?observer:attacker;
    order(team,{type:'move',ids:[reveal.id],...firing},/MOVE ORDER/);
    while(reveal.pathIndex<reveal.path.length&&r.tick<2800)r.step();
    if(mode==='hidden'&&orderType==='attackMove'){
      order(team,{type:'move',ids:[attacker.id],x:team?2.5:-1.5,z:7.5},/MOVE ORDER/);
      while(attacker.pathIndex<attacker.path.length&&r.tick<3200)r.step();
    }
    assert.ok(r.snapshot(team).units.some(u=>u[0]===target.id),'target is visible at attack admission');
    if(orderType==='attack')order(team,{type:'attack',ids:[attacker.id],targetId:target.id,targetGeneration:target.generation},/ATTACK ORDER/);
    else{
      order(team,{type:'attackMove',ids:[attacker.id],x:attacker.x,z:attacker.z},/ATTACK MOVE ORDER/);
      const scanStart=r.tick;while(attacker.attackTargetId!==target.id&&r.tick-scanStart<30)r.step();
      assert.equal(attacker.attackTargetId,target.id,'attack-move acquires the visible boat');
    }
    order(team,{type:queuedType,ids:[attacker.id],...destination,queue:true},/WAYPOINT QUEUED/);
    const goal=attacker.queuedWaypoints[0].destination,startTick=r.tick,trace=createHash('sha256');
    if(mode==='hidden')order(team,{type:'move',ids:[observer.id],...destination},/MOVE ORDER/);
    else if(mode!=='dead')order(defender,{type:'move',ids:[target.id],x:.5,z:16.5},/SKIFF WATER ROUTE/);
    if(interrupt){
      order(team,{type:interrupt,ids:[attacker.id]},interrupt==='stop'?/STOP ORDER/:/HOLD POSITION ORDER/);
      const before={x:attacker.x,z:attacker.z,orderRevision:attacker.orderRevision};
      for(let i=0;i<180;i++){
        r.step();assert.deepEqual({x:attacker.x,z:attacker.z,orderRevision:attacker.orderRevision},before);
        assert.equal(attacker.queuedWaypoints.length,0);assert.equal(attacker.holdingPosition,interrupt==='holdPosition');
      }
      return {team,mode,orderType,queuedType,interrupt,sourceSha256:fixture.sourceSha256,stationaryIntentPreserved:true,queued:0};
    }
    const done=()=>attacker.hp>0&&attacker.attackTargetId<0&&attacker.queuedWaypoints.length===0&&!attacker.movePlanningPending
      &&attacker.pathIndex===attacker.path.length&&attacker.moveGoalCell===goal
      &&Math.hypot(attacker.x-r.point(goal).x,attacker.z-r.point(goal).z)<.02;
    let releasedAt=null,hiddenAt=null,minTargetHp=target.hp,hiddenHp=null;
    while(!done()&&r.tick-startTick<1200){
      r.step();minTargetHp=Math.min(minTargetHp,target.hp);
      if(!r.snapshot(team).units.some(u=>u[0]===target.id)&&target.hp>0&&hiddenAt===null){hiddenAt=r.tick-startTick;hiddenHp=target.hp;}
      if(attacker.attackTargetId<0&&releasedAt===null)releasedAt=r.tick-startTick;
      trace.update(JSON.stringify([attacker.x,attacker.z,attacker.attackTargetId,attacker.path,attacker.pathIndex,
        attacker.moveGoalCell,attacker.queuedWaypoints,attacker.lastAttackTick,target.x,target.z,target.hp])+'\n');
    }
    const result={team,mode,orderType,queuedType,sourceSha256:fixture.sourceSha256,ticks:r.tick-startTick,arrived:done(),goal,
      attackTargetId:attacker.attackTargetId,queued:attacker.queuedWaypoints.length,releasedAt,hiddenAt,
      targetVisible:r.snapshot(team).units.some(u=>u[0]===target.id),targetHp:target.hp,minTargetHp,
      attackerPosition:{x:attacker.x,z:attacker.z},targetPosition:{x:target.x,z:target.z},traceSha256:trace.digest('hex')};
    if(!observe)assert.equal(result.arrived,true,JSON.stringify(result));
    if(mode==='dead')assert.equal(target.hp,0);
    if(mode==='hidden'&&!observe){assert.notEqual(hiddenAt,null);assert.notEqual(releasedAt,null);
      assert.ok(releasedAt<=hiddenAt+1);assert.equal(target.hp,hiddenHp,'hidden target cannot take continuing attacks');}
    if(mode==='unreachable')assert.equal(hiddenAt,null,'target remains visible until queued route starts');
    return result;
  }finally{await fixture.dispose();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const records=[];
  for(const team of [0,1])for(const orderType of ['attack','attackMove'])for(const mode of ['dead','hidden','unreachable']){
    const runs=[];for(let i=0;i<2;i++)runs.push(await runAttackQueueCase({team,orderType,mode,
      queuedType:orderType==='attack'?'move':'attackMove',observe:process.argv.includes('--observe')}));
    assert.equal(runs[0].traceSha256,runs[1].traceSha256);records.push({team,orderType,mode,runs});
    console.log(JSON.stringify({team,orderType,mode,ticks:runs[0].ticks,arrived:runs[0].arrived,releasedAt:runs[0].releasedAt,repeatExact:true}));
  }
  if(process.env.ATTACK_QUEUE_RECORD)await writeFile(process.env.ATTACK_QUEUE_RECORD,JSON.stringify({
    head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,
    limits:['real server bodies; fixed ticks with planning callbacks drained between ticks; native timing and rendering excluded']},null,2)+'\n');
}
