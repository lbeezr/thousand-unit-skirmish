import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { canTraverseUnitStep } from '../src/unit-movement.mjs';

process.env.RTS_MAP='maps/open-field.json'; process.env.RTS_GAME_MODE='pvp'; process.env.RTS_PREGAME='0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = {id:'open-ground-regression',name:'OPEN GROUND REGRESSION',width:96,height:96,
  terrainSeed:881,fogOfWar:false,startingArmySize:16,startingResources:{food:500,wood:500},
  spawnPoints:[{team:0,x:-32,z:-24},{team:1,x:32,z:24}],
  resourceNodes:[],obstacles:[],triggers:[],scenarioEvents:[]};
const order = (r,u,x,z,extra={}) => {
  const notices = r.order(u.team,{type:'move',ids:[u.id],unitGenerations:[u.generation],x,z,...extra});
  r.drain(); assert.ok(notices.some(n=>n.message.startsWith('MOVE ORDER')||n.message.startsWith('WAYPOINT')));
};
function arrive(r,units,maxTicks=1600) {
  let distance=0;
  for(let tick=0;tick<maxTicks && units.some(u=>u.movePlanningPending||u.pathIndex<u.path.length||u.queuedWaypoints.length);tick++){
    const before=units.map(u=>({x:u.x,z:u.z,cell:r.cell(u.x,u.z)}));
    r.step();
    for(let i=0;i<units.length;i++){
      const u=units[i],p=before[i]; distance+=Math.hypot(u.x-p.x,u.z-p.z);
      assert.ok(canTraverseUnitStep(p.cell,r.cell(u.x,u.z),map.width,r.levels,r.isWalkable),'every authoritative step remains legal');
    }
  }
  for(const u of units){
    assert.equal(u.movePlanningPending,false); assert.equal(u.pathIndex,u.path.length);
    assert.equal(u.queuedWaypoints.length,0);
    const goal=r.point(u.moveGoalCell); assert.ok(Math.hypot(u.x-goal.x,u.z-goal.z)<.02);
  }
  return distance;
}
for(const team of [0,1])for(const kind of ['worker','infantry'])
  test(`seat ${team} ${kind}: eight world headings and arbitrary fractional clicks travel directly`,async()=>{
    const f=await createPathingReplayFixture(map),r=f.replay;
    try{
      for(const [x,z] of [[11.5,11.5],[11.5,-12.5],[-12.5,11.5],[-12.5,-12.5],
        [11.5,-.5],[-.5,11.5],[-12.5,-.5],[-.5,-12.5],[13.71,-2.83],[2.19,11.37]]){
        r.prepare(map);const u=r.units.find(u=>u.team===team&&u.kind===kind);
        Object.assign(u,{x:-8.27,z:-9.19});r.step();
        const start={x:u.x,z:u.z}; order(r,u,x,z);
        assert.equal(u.path.length,1);
        const goal=r.point(u.moveGoalCell),straight=Math.hypot(goal.x-start.x,goal.z-start.z);
        assert.ok(Math.hypot(x-goal.x,z-goal.z)<=Math.SQRT1_2,'existing goal-cell quantization is retained');
        assert.ok(Math.abs(arrive(r,[u])-straight)<1e-8,'no Manhattan excess distance');
        const settled={x:u.x,z:u.z};for(let tick=0;tick<20;tick++)r.step();
        assert.deepEqual({x:u.x,z:u.z},settled,'idle does not drift on near-zero movement');
      }
    }finally{await f.dispose();}
  });
test('blocked corner and a cliff retain obstacle/elevation routing without shortcuts',async()=>{
  for(const terrain of ['corner','cliff']){
    const scene={...map,id:`open-ground-${terrain}`,
      ...(terrain==='corner'?{obstacles:[{id:'corner',column:48,row:47,width:1,height:1,material:'stone'}]}:
        {elevationPatches:[{column:48,row:47,width:1,height:1,level:2}]})};
    const f=await createPathingReplayFixture(scene),r=f.replay;
    try{
      const u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:-.5,z:-.5});r.step();
      order(r,u,3.5,3.5);assert.ok(u.path.length>1,'the obstructed supercover is not shortened');
      arrive(r,[u]);
    }finally{await f.dispose();}
  }
});
test('fractional assignee rejoins the safe cell center before a shared long waypoint',async()=>{
  const scene={...map,obstacles:[{id:'grazed-corner',column:48,row:47,width:1,height:1,material:'stone'}]};
  const f=await createPathingReplayFixture(scene),r=f.replay;
  try{
    const u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:-.05,z:-.95});r.step();
    const start=r.cell(u.x,u.z);order(r,u,3.5,7.5);
    assert.deepEqual(u.path,[start,u.moveGoalCell]);arrive(r,[u]);
  }finally{await f.dispose();}
});
test('paid wall across the interior of a long segment repairs immediately and preserves the goal',async()=>{
  const f=await createPathingReplayFixture(map),r=f.replay;
  try{
    const u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:-8.5,z:-8.5});r.step();
    order(r,u,10.5,10.5);const goal=u.moveGoalCell,revision=u.orderRevision;assert.equal(u.path.length,1);
    const worker=r.units.find(u=>u.team===0&&u.kind==='worker');
    const notices=r.order(0,{type:'build',ids:[worker.id],buildingType:'palisade-wall',x:.5,z:.5});
    assert.ok(u.movePlanningPending,'segment interior triggers repair at construction admission');
    r.drain();assert.ok(notices.some(n=>n.message.startsWith('WALL BUILD ORDER')),JSON.stringify(notices));
    assert.equal(u.moveGoalCell,goal);assert.equal(u.orderRevision,revision+1);arrive(r,[u]);
  }finally{await f.dispose();}
});
test('near-corner fractional start cannot loop through the same rejected shortcut repair',async()=>{
  const scene={...map,obstacles:[{id:'physical-corner',column:47,row:48,width:1,height:1,material:'stone'}]};
  const f=await createPathingReplayFixture(scene),r=f.replay;
  try{
    const u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:-.02,z:-.01});r.step();
    order(r,u,3.5,1.5);const revision=u.orderRevision;
    assert.equal(u.path.length,2,'start-center leg avoids the physical diagonal corner');
    arrive(r,[u]);assert.equal(u.orderRevision,revision,'no per-tick repair loop');
  }finally{await f.dispose();}
});
test('later near-corner crossing uses the traversable fallback instead of repeated repairs',async()=>{
  const scene={...map,obstacles:[{id:'later-physical-corner',column:54,row:55,width:1,height:1,material:'stone'}]};
  const f=await createPathingReplayFixture(scene),r=f.replay;
  try{
    const u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:.5,z:.5});r.step();
    order(r,u,8.5,11.5);const revision=u.orderRevision;
    assert.ok(u.path.length>1,'the unsafe whole segment does not get a shortcut');
    arrive(r,[u]);assert.equal(u.orderRevision,revision,'no later corner repair loop');
  }finally{await f.dispose();}
});
test('queued turns, active checkpoint recovery, Stop and replacement retain order intent',async()=>{
  const f=await createPathingReplayFixture(map),r=f.replay;
  try{
    let u=r.units.find(u=>u.team===0&&u.kind==='infantry');Object.assign(u,{x:-8.5,z:-8.5});r.step();
    order(r,u,10.5,4.5);order(r,u,-3.5,15.5,{queue:true});
    for(let tick=0;tick<60;tick++)r.step();
    const checkpoint=r.checkpoint();assert.ok(r.validate(checkpoint));
    r.restore(checkpoint);u=r.units[u.id];assert.equal(u.queuedWaypoints.length,1);
    arrive(r,[u]);assert.deepEqual({x:u.x,z:u.z},{x:-3.5,z:15.5});
    order(r,u,13.5,-8.5);r.step();r.order(0,{type:'stop',ids:[u.id]});
    const stopped={x:u.x,z:u.z};for(let tick=0;tick<20;tick++)r.step();assert.deepEqual({x:u.x,z:u.z},stopped);
    order(r,u,3.5,5.5);order(r,u,-9.5,11.5);arrive(r,[u]);
    assert.deepEqual({x:u.x,z:u.z},{x:-9.5,z:11.5});
  }finally{await f.dispose();}
});
for(const team of [0,1])test(`seat ${team}: open-ground group retains distinct formation cells and arrivals`,async()=>{
  const f=await createPathingReplayFixture({...map,startingArmySize:136}),r=f.replay;
  try{
    const units=r.units.filter(u=>u.team===team&&u.kind==='infantry');assert.equal(units.length,64);
    const notices=r.order(team,{type:'move',ids:units.map(u=>u.id),x:team?-8.5:8.5,z:team?-4.5:4.5});
    r.drain();assert.ok(notices.some(n=>n.message.startsWith('MOVE ORDER')));
    assert.equal(new Set(units.map(u=>u.moveGoalCell)).size,64);arrive(r,units);
  }finally{await f.dispose();}
});
