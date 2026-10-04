import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { activeMoveGoalPoint, canTraverseUnitStep } from '../src/unit-movement.mjs';
import { CAMERA_VIEW_DIRECTION } from '../src/camera-controls.mjs';

process.env.RTS_MAP = 'maps/open-field.json';
process.env.RTS_GAME_MODE = 'pvp'; process.env.RTS_PREGAME = '0';
delete process.env.RTS_MATCH_STATE_PATH;
const map = { id: 'open-ground-bearings', name: 'OPEN GROUND BEARINGS', width: 96, height: 96,
  terrainSeed: 881, fogOfWar: false, startingArmySize: 16,
  spawnPoints: [{ team: 0, x: -32, z: -24 }, { team: 1, x: 32, z: 24 }],
  resourceNodes: [], obstacles: [], triggers: [], scenarioEvents: [] };
const specs = [
  ...[[12,12],[12,-12],[-12,12],[-12,-12],[12,0],[0,12],[-12,0],[0,-12]]
    .map(([dx,dz],i) => ({ name: `heading-${i}`, start: { x: -.5, z: -.5 }, click: { x: dx-.5, z: dz-.5 } })),
  ...[[13.71,-2.83],[2.19,11.37],[-17.61,4.83],[-2.93,-21.77]]
    .map(([x,z],i) => ({ name: `arbitrary-${i}`, start: { x: -8.27, z: -9.19 }, click: { x,z } })),
];
const fixture = await createPathingReplayFixture(map), r = fixture.replay;
const records = [];
try {
  for (const spec of specs) {
    const runs = [];
    for (let repeat = 0; repeat < 2; repeat++) {
      r.prepare(map);
      const u = r.units.find(u => u.team === 0 && u.kind === 'infantry');
      Object.assign(u, spec.start);
      r.step(); // Rebuild the real spatial buckets after test-only placement.
      const notices = r.order(0, { type: 'move', ids: [u.id], unitGenerations: [u.generation], ...spec.click });
      r.drain(); assert.ok(notices.some(n => n.message.startsWith('MOVE ORDER')));
      const selectedGoal = activeMoveGoalPoint(u)??r.point(u.moveGoalCell);
      const goal = {x:selectedGoal.x,z:selectedGoal.z}, path = u.path.slice(), points = [{x:u.x,z:u.z}], headings = new Set();
      const straight = Math.hypot(goal.x-u.x,goal.z-u.z);
      let distance = 0, invalidSteps = 0, maxDeviation = 0;
      for (let tick = 0; tick < 1200 && u.pathIndex < u.path.length; tick++) {
        const before = {x:u.x,z:u.z}, from = r.cell(u.x,u.z);
        r.step();
        const dx = u.x-before.x, dz = u.z-before.z;
        distance += Math.hypot(dx,dz);
        if (Math.hypot(dx,dz)>1e-8) headings.add(Number(Math.atan2(dx,dz).toFixed(6)));
        if (!canTraverseUnitStep(from,r.cell(u.x,u.z),map.width,r.levels,r.isWalkable)) invalidSteps++;
        maxDeviation = Math.max(maxDeviation, Math.abs((goal.x-spec.start.x)*(u.z-spec.start.z)
          -(goal.z-spec.start.z)*(u.x-spec.start.x))/straight);
        points.push({x:u.x,z:u.z});
      }
      assert.equal(invalidSteps,0); assert.equal(u.pathIndex,u.path.length);
      assert.ok(Math.hypot(u.x-goal.x,u.z-goal.z)<.02);
      const arrived = {x:u.x,z:u.z}; for(let tick=0;tick<10;tick++)r.step();
      assert.deepEqual({x:u.x,z:u.z},arrived,'arrival remains stationary');
      runs.push({goal,path,distance,straight,ratio:distance/straight,maxDeviation,
        clickError:Math.hypot(spec.click.x-goal.x,spec.click.z-goal.z),headings:[...headings],
        ticks:points.length-1,invalidSteps,
        traceSha256:createHash('sha256').update(JSON.stringify(points)).digest('hex')});
    }
    assert.deepEqual(runs[0],runs[1],'fixed-tick trajectory repeats');
    records.push({...spec,runs});
  }
} finally {await fixture.dispose();}
let pathLineSha256 = null;
try { pathLineSha256 = createHash('sha256').update(await readFile(new URL('../src/unit-path-line.mjs',import.meta.url))).digest('hex'); }
catch(error) { if(error.code !== 'ENOENT')throw error; } // The retained baseline predates this helper.
const report = {head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  serverSha256:fixture.sourceSha256,pathLineSha256,
  node:process.version,camera:CAMERA_VIEW_DIRECTION,records,
  limits:['real authoritative command/planner/tick bodies with fixed callback drain; no browser pixels or wall-clock capacity claim',
    'one isolated land Infantry; requested-to-arrival projection measured separately; crowd/terrain checked by focused suites']};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(records.map(({name,runs:[r]})=>({name,ratio:r.ratio,maxDeviation:r.maxDeviation,headings:r.headings,pathLength:r.path.length,ticks:r.ticks})),null,2));
