import assert from 'node:assert/strict';
import test from 'node:test';
import { arrivedAtMoveGoal } from './pathing-arrival.mjs';

test('a cleared path away from its assigned goal cannot be reported as arrival',()=>{
  const unit={x:0,z:0,path:[],pathIndex:0,movePlanningPending:false,moveGoalCell:42};
  assert.equal(arrivedAtMoveGoal(unit,{x:10,z:10}),false);
  assert.equal(arrivedAtMoveGoal({...unit,x:10,z:10},{x:10,z:10}),true);
  assert.equal(arrivedAtMoveGoal({...unit,moveGoalCell:-1},{x:0,z:0}),false);
  assert.equal(arrivedAtMoveGoal({...unit,movePlanningPending:true},{x:0,z:0}),false);
});
