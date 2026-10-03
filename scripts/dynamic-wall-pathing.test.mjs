import test from 'node:test';
import assert from 'node:assert/strict';
import {runDynamicWallCase} from './dynamic-wall-pathing.mjs';
for(const team of [0,1])for(const mode of ['active-route','queued-target','queued-removal'])
  test(`seat ${team}: paid wall ${mode} preserves distinct reachable formation destinations`,async()=>{
    const r=await runDynamicWallCase({team,mode});
    assert.equal(r.distinctGoals,64);
  });
