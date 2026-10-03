import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_TICK_DIAGNOSTICS='1';process.env.RTS_SEPARATION_DIAGNOSTICS='1';
delete process.env.RTS_MATCH_STATE_PATH;
async function movingGroup(kind='dynamic-goal') {
  const fixture=await createPathingReplayFixture(pathingBaselineMap({group:64,kind})),r=fixture.replay;
  const army=r.units.filter(u=>u.team===0&&u.kind==='infantry');
  r.order(0,{type:'move',ids:army.map(u=>u.id),x:16.5,z:.5});r.drain();
  for(let tick=0;tick<15;tick++)r.step();
  return {fixture,r,army};
}

test('paid obstruction relocates blocked formation goals without reusing surviving friendly goals',async()=>{
  const {fixture,r,army}=await movingGroup();
  try {
    const oldGoals=army.map(u=>u.moveGoalCell),worker=r.units.find(u=>u.kind==='worker'&&u.team===0);
    const notices=r.order(0,{type:'build',ids:[worker.id],buildingType:'house',x:16.5,z:.5});r.drain();
    assert.ok(notices.some(n=>n.message.startsWith('BUILD ORDER')));
    const footprint=new Set(r.buildings.at(-1).footprint);
    assert.equal(footprint.size,9);
    assert.equal(new Set(army.map(u=>u.moveGoalCell)).size,64,'repair must retain distinct destinations');
    for(let i=0;i<army.length;i++) {
      const u=army[i];assert.ok(!footprint.has(u.moveGoalCell));
      assert.equal(r.components[r.cell(u.x,u.z)],r.components[u.moveGoalCell]);
      if(!footprint.has(oldGoals[i]))assert.equal(u.moveGoalCell,oldGoals[i],'valid player destinations stay fixed');
    }
    for(let tick=0;tick<1000&&army.some(u=>u.pathIndex<u.path.length);tick++)r.step();
    for(const u of army) {
      const p=r.point(u.moveGoalCell);
      assert.equal(u.pathIndex,u.path.length);assert.ok(Math.hypot(u.x-p.x,u.z-p.z)<.02);
    }
  } finally {await fixture.dispose();}
});

test('a footprint across the only choke is rejected without changing movement goals or navigation',async()=>{
  const {fixture,r,army}=await movingGroup('disconnect-rejection');
  try {
    const goals=army.map(u=>u.moveGoalCell),revision=r.navigationRevision;
    const notices=r.order(0,{type:'build',ids:[0],buildingType:'palisade-wall',x:.5,z:.5});
    assert.ok(notices.some(n=>n.message==='BUILD REJECTED · WOULD BLOCK A ROUTE'));
    assert.equal(r.navigationRevision,revision);assert.equal(r.buildings.length,0);
    assert.deepEqual(army.map(u=>u.moveGoalCell),goals);
  } finally {await fixture.dispose();}
});
