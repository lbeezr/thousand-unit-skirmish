import test from 'node:test';
import { runWorkerCombatRepathCase } from './worker-combat-repath-case.mjs';

for (const workerTeam of [0,1]) for (const rotation of [0,1,2,3]) for (const orderType of ['attack','attackMove']) {
  test(`Worker seat ${workerTeam}, rotation ${rotation}: ${orderType} completes moving-target pursuit`,async()=>{
    await runWorkerCombatRepathCase({workerTeam,rotation,orderType});
  });
}
