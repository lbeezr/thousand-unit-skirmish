import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPveHeadlessFixture, assertRecoveredWorkerObservation } from './pve-headless-fixture.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
// Human-controlled legal loss prelude, then the unmodified configured policy.
// No checkpoint edits, grants, injected units/positions or hidden policy inputs.
export async function replayPaidSkirmishLoss(id, team, initial = null, options = {}) {
 const enemy = 1 - team;
 const map = JSON.parse(await readFile(new URL(`../maps/${id}.json`, import.meta.url)));
 const identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
 // Explicit native authored elimination can exercise the configured policy
 // while a new canonical map's native Skirmish admission remains pending.
 const nativeIdentity=options.nativeIdentity ?? identity;
 let fixture=await createPveHeadlessFixture(map,nativeIdentity),r=fixture.replay;
 const trace=[],stages={};
 const view=seat=>toOpponentObservation(r.observe(seat),seat,map);
 const commandFor=(units,type,extra={})=>({type,ids:units.map(u=>u.id),unitGenerations:units.map(u=>u.generation),...extra});
 const order=async(seat,command)=>{
  const notices=await r.order(seat,command);r.drain();
  assert.ok(!notices.some(n=>/REJECTED|FAILED|UNREACHABLE/.test(n.message||'')),JSON.stringify({command,notices}));
  trace.push({tick:r.observe(team).tick,team:seat,command,notices});
 };
 try {
  if(initial)r.restore(initial);else initial=r.checkpoint();
  assert.equal(initial.matchModeId,nativeIdentity.matchModeId);
  assert.equal(initial.matchModeVersion,nativeIdentity.matchModeVersion);
  const guards=view(enemy).units.friendly.filter(u=>u.hp>0&&u.kind==='infantry');
  await order(enemy,commandFor(guards,'holdPosition'));
  const openingPolicy=createDeterministicPolicy(20260925,identity);openingPolicy.next(view(team));
  for(let i=0;i<300;i++)r.step();
  const setup=openingPolicy.next(view(team));
  const purchase=setup.find(c=>c.type==='build'&&c.buildingType==='barracks');assert.ok(purchase);
  await order(team,purchase);
  for(let i=0;i<3000&&!view(team).buildings.friendly.some(b=>b.type==='barracks'&&b.complete);i++)r.step();
  const barracks=view(team).buildings.friendly.find(b=>b.type==='barracks'&&b.complete);assert.ok(barracks);
  stages.originalProducer=r.observe(team).tick;
  const opening=view(team).units.friendly.filter(u=>u.hp>0&&u.kind==='infantry'),destination=map.spawnPoints.find(p=>p.team===enemy);
  await order(team,commandFor(opening,'move',{x:destination.x,z:destination.z}));
  let focus=null;
  for(let i=0;i<9000&&view(team).units.friendly.some(u=>u.hp>0&&opening.some(first=>first.id===u.id));i++) {
   if(i%30===0) {
    const seen=view(enemy),target=seen.units.visibleEnemies.filter(u=>u.hp>0&&u.kind==='infantry'&&opening.some(first=>first.id===u.id))
     .sort((a,b)=>a.hp-b.hp||a.id-b.id)[0],key=target?`${target.id}:${target.generation}`:null;
    const living=seen.units.friendly.filter(u=>u.hp>0&&guards.some(first=>first.id===u.id));
    if(target&&focus!==key&&living.length) {
     await order(enemy,commandFor(living,'setStance',{stance:'aggressive'}));
     await order(enemy,commandFor(living,'attack',{targetId:target.id,targetGeneration:target.generation}));focus=key;
    }
   }
   r.step();
  }
  assert.equal(view(team).units.friendly.filter(u=>u.hp>0&&u.kind==='infantry').length,0,'opening army dies in real combat');
  stages.wipeout=r.observe(team).tick;
  // Builders finish, then leave the paid target before the opposing legal assault.
  const home=map.spawnPoints.find(p=>p.team===team),workers=view(team).units.friendly.filter(u=>u.hp>0&&u.kind==='worker');
  await order(team,commandFor(workers,'move',{x:home.x,z:home.z+12}));
  const livingGuards=view(enemy).units.friendly.filter(u=>u.hp>0&&guards.some(first=>first.id===u.id));
  await order(enemy,commandFor(livingGuards,'attackMove',{x:barracks.x,z:barracks.z}));
  let focusedProducer=false;
  for(let i=0;i<12000&&view(team).buildings.friendly.some(b=>b.id===barracks.id);i++) {
   if(i%30===0&&!focusedProducer) {
    const seen=view(enemy),target=seen.buildings.visibleEnemies.find(b=>b.id===barracks.id);
    if(target) {
     await order(enemy,commandFor(seen.units.friendly.filter(u=>u.hp>0&&livingGuards.some(first=>first.id===u.id)),
      'attackBuilding',{buildingId:target.id}));focusedProducer=true;
    }
   }
   r.step();
  }
  assert.ok(focusedProducer);assert.ok(!view(team).buildings.friendly.some(b=>b.id===barracks.id),'producer dies in actual combat');
  assert.equal(view(team).units.friendly.filter(u=>u.hp>0&&u.kind==='worker').length,4,'Workers survive both losses');
  stages.producerLost=r.observe(team).tick;
  await order(enemy,commandFor(view(enemy).units.friendly.filter(u=>u.hp>0&&livingGuards.some(first=>first.id===u.id)),
   'move',{x:destination.x,z:destination.z}));
  for(let i=0;i<1800;i++)r.step();
  await order(enemy,commandFor(view(enemy).units.friendly.filter(u=>u.hp>0&&livingGuards.some(first=>first.id===u.id)),'holdPosition'));
  assert.equal(view(team).units.friendly.filter(u=>u.hp>0&&u.kind==='worker').length,4);
  let policy=createDeterministicPolicy(20260925,identity),restarted=false,firstPressure=null,spentFood=0,spentWood=175;
  stages.recoveryStart=r.observe(team).tick;
  for(let i=0;i<18000;i++) {
   if(i%30===0) {
    const observation=view(team),foundation=observation.buildings.friendly.find(b=>b.type==='barracks'&&!b.complete);
    if(foundation&&!restarted) {
     // Welcome/checkpoint reads now derive current sight between broadcasts.
     // Keep this paid foundation at its actual observation tick on cold restore.
     stages.foundationObservation=observation.tick;
     r.drain();const before=[r.observe(0),r.observe(1)],checkpoint=r.checkpoint();
     const recovered=await createPveHeadlessFixture(map,nativeIdentity);
     try {
      recovered.replay.restore(checkpoint);
      for(const seat of [0,1])assertRecoveredWorkerObservation(recovered.replay.observe(seat),before[seat]);
     } catch(error) { await recovered.dispose();throw error; }
     await fixture.dispose();fixture=recovered;r=fixture.replay;
     policy=createDeterministicPolicy(20260925,identity);restarted=true;stages.restart=r.observe(team).tick;
     assert.equal(stages.restart,stages.foundationObservation,'cold foundation restore does not advance the observation tick');
     trace.push({tick:stages.restart,restart:true});
    }
    for(const command of policy.next(view(team))) {
     const before=r.observe(team);await order(team,command);const after=r.observe(team);
     spentFood+=before.food[team]-after.food[team];spentWood+=before.wood[team]-after.wood[team];
     if(command.type==='build'&&command.buildingType==='barracks')stages.replacementPurchase??=after.tick;
     if(['attack','attackBuilding','attackMove'].includes(command.type)&&command.ids?.length>=5)firstPressure??=after.tick;
    }
    if(view(team).buildings.friendly.some(b=>b.type==='barracks'&&b.complete))stages.replacementComplete??=r.observe(team).tick;
    if(firstPressure!==null&&restarted&&stages.replacementComplete!==undefined)break;
   }
   r.step();
  }
  assert.ok(restarted&&firstPressure!==null&&stages.replacementComplete!==undefined,JSON.stringify(stages));
  const final=r.checkpoint(),conservation={};
  assert.equal(final.state.units.filter(u=>u.team===team&&u.kind==='worker'&&u.hp>0).length,4);
  assert.ok(final.state.triggerStates.every(post=>post.owner===-1),'no capture resource grants fund recovery');
  for(const [resource,key,spent] of [['food','teamFood',spentFood],['wood','teamWood',spentWood]]) {
   const stockStart=initial.state.resourceNodes.filter(n=>n.type===resource).reduce((sum,n)=>sum+n.stock,0);
   const stockEnd=final.state.resourceNodes.filter(n=>n.type===resource).reduce((sum,n)=>sum+n.stock,0);
   const cargo=final.state.units.filter(u=>u.cargoType===resource).reduce((sum,u)=>sum+u.cargo,0);
   const residue=initial.state[key].reduce((a,b)=>a+b,0)+stockStart-stockEnd-cargo-spent-final.state[key].reduce((a,b)=>a+b,0);
   assert.ok(Math.abs(residue)<1e-5,`${resource}: all stock/cargo/banks/spending reconcile ${residue}`);
   conservation[resource]={stockStart,stockEnd,cargo,spent,residue};
  }
  const result={id,team,stages,firstPressure,spentFood,spentWood,conservation,trace,final};
  assert.equal(final.state.matchWinner,-1,'recoverable side survives both actual losses');
  return {initial,result};
 }finally{await fixture.dispose();}
}
