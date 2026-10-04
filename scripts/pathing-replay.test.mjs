import test from 'node:test';
import assert from 'node:assert/strict';
import { createPathingReplayFixture } from './pathing-replay-fixture.mjs';
import { pathingBaselineMap } from './pathing-baseline-cases.mjs';
import { createPveHeadlessFixture } from './pve-headless-fixture.mjs';
import { captureReplayBoundary, recordAcceptedCommand, replayCommandTrace, sealCommandReplay } from './accepted-command-replay.mjs';

process.env.RTS_MAP='maps/open-field.json';process.env.RTS_GAME_MODE='pvp';process.env.RTS_PREGAME='0';
process.env.RTS_TICK_DIAGNOSTICS='1';process.env.RTS_SEPARATION_DIAGNOSTICS='1';
delete process.env.RTS_MATCH_STATE_PATH;
async function movingGroup(kind='dynamic-goal',team=0) {
  const fixture=await createPathingReplayFixture(pathingBaselineMap({group:64,kind})),r=fixture.replay;
  const army=r.units.filter(u=>u.team===team&&u.kind==='infantry');
  r.order(team,{type:'move',ids:army.map(u=>u.id),x:16.5,z:.5});r.drain();
  for(let tick=0;tick<15;tick++)r.step();
  return {fixture,r,army};
}

for(const team of [0,1])test(`seat ${team}: paid obstruction relocates blocked formation goals without reusing surviving friendly goals`,async()=>{
  const {fixture,r,army}=await movingGroup('dynamic-goal',team);
  try {
    const oldGoals=army.map(u=>u.moveGoalCell),worker=r.units.find(u=>u.kind==='worker'&&u.team===team);
    const notices=r.order(team,{type:'build',ids:[worker.id],buildingType:'house',x:16.5,z:.5});r.drain();
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

test('opponent movement destinations do not change friendly obstruction fallback cells',async()=>{
  async function repair(opponentGoal) {
    const {fixture,r,army}=await movingGroup();
    try {
      const oldGoals=army.map(u=>u.moveGoalCell);
      if(opponentGoal!==undefined) {
        const enemy=r.units.find(u=>u.team===1&&u.kind==='infantry'),p=r.point(opponentGoal);
        r.order(1,{type:'move',ids:[enemy.id],x:p.x,z:p.z});r.drain();
        assert.equal(enemy.moveGoalCell,opponentGoal);
      }
      const worker=r.units.find(u=>u.team===0&&u.kind==='worker');
      r.order(0,{type:'build',ids:[worker.id],buildingType:'house',x:16.5,z:.5});r.drain();
      return {goals:army.map(u=>u.moveGoalCell),relocated:army.find((u,i)=>u.moveGoalCell!==oldGoals[i]).moveGoalCell};
    } finally {await fixture.dispose();}
  }
  const first=await repair();
  assert.deepEqual((await repair(first.relocated)).goals,first.goals);
});

for(const team of [0,1])test(`seat ${team}: consecutive paid footprints reserve pending repaired destinations before planning drains`,async()=>{
  const {fixture,r,army}=await movingGroup('dynamic-goal',team);
  try {
    const workers=r.units.filter(u=>u.team===team&&u.kind==='worker');
    const first=r.order(team,{type:'build',ids:[workers[0].id],buildingType:'house',x:16.5,z:.5});
    assert.equal(r.buildings.length,1,'first paid footprint is admitted before planning drains');
    assert.ok(!first.some(n=>/REJECTED|FAILED/.test(n.message)));
    assert.ok(army.some(u=>u.movePlanningPending&&!r.isWalkable(u.moveGoalCell)),
      'first repair is pending while the unit still stores its blocked original destination');
    const second=r.order(team,{type:'build',ids:[workers[1].id],buildingType:'house',x:19.5,z:.5});
    assert.ok(!second.some(n=>/REJECTED|FAILED/.test(n.message)));
    assert.equal(r.buildings.length,2,'second paid footprint is admitted before planning drains');r.drain();
    assert.equal(new Set(army.map(u=>u.moveGoalCell)).size,64);
    for(const u of army)assert.equal(r.components[r.cell(u.x,u.z)],r.components[u.moveGoalCell]);
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

// The movement adapter above calls rule functions directly. This trace uses the
// full command handler and the unchanged checkpoint validator through the PvE
// fixture, with AI/listening/timers disabled and an explicit authored mode.
const replayIdentity = { matchModeId: 'authored', matchModeVersion: 1 };
function commandReplayMap() {
  return { ...pathingBaselineMap({ group: 4 }), id: 'accepted-command-replay',
    fogOfWar: true, obstacles: [],
    spawnPoints: [{ team: 0, x: -28, z: 0 }, { team: 1, x: 28, z: 0 }] };
}
async function recordedMovement(primaryTeam) {
  const fixture = await createPveHeadlessFixture(commandReplayMap(), replayIdentity), r = fixture.replay;
  try {
    const initial = r.checkpoint(), commands = [], boundaries = [], otherTeam = 1 - primaryTeam;
    const actors = [0, 1].map(team => initial.state.units.find(u => u.team === team && u.kind === 'infantry'));
    const packet = (team, type, token, extra = {}) => ({ type, ids: [actors[team].id],
      unitGenerations: [actors[team].generation], clientOrderToken: token, ...extra });
    const move = (team, queue = false) => packet(team, 'move', queue ? 2 : 1,
      { x: team ? 18.5 : -18.5, z: queue ? (team ? -3.5 : 3.5) : .5, ...(queue ? { queue: true } : {}) });
    let resume;
    for (let tick = 0; tick <= 60; tick++) {
      if (tick === 0 || tick === 30) for (const team of [primaryTeam, otherTeam]) {
        const command = move(team, tick === 30);
        commands.push(await recordAcceptedCommand(r, team, command,
          tick === 30 ? 'WAYPOINT QUEUED · 1 UNITS' : 'MOVE ORDER · 1 UNITS'));
        command.ids[0] = -1; // Caller reuse cannot change the recorded authority input.
      }
      if (tick === 30) {
        // A checkpoint between commands sharing one tick needs a command cursor;
        // tick alone cannot say whether the queued order was already accepted.
        resume = { checkpoint: r.checkpoint(), nextCommandIndex: commands.length };
        commands.push(await recordAcceptedCommand(r, primaryTeam, packet(primaryTeam, 'stop', 3), 'STOP ORDER · 1 UNITS'));
      }
      if (tick === 50) commands.push(await recordAcceptedCommand(r, otherTeam, packet(otherTeam, 'stop', 3), 'STOP ORDER · 1 UNITS'));
      boundaries.push(captureReplayBoundary(r, commands.length));
      if (tick < 60) r.step();
    }
    return { initial, commands, boundaries, resume, actors };
  } finally { await fixture.dispose(); }
}

for (const team of [0, 1]) test(`seat ${team}: immutable accepted-command trace resumes a same-tick cursor exactly`, async () => {
  const recorded = await recordedMovement(team);
  const input = structuredClone(recorded.initial);
  const trace = sealCommandReplay(input, recorded.commands, 60);
  input.mapDefinition.terrainSeed++;
  assert.equal(trace.initialCheckpoint.mapDefinition.terrainSeed, 881, 'sealed seed is detached from caller input');
  assert.throws(() => { trace.commands[0].command.ids[0] = -1; }, TypeError);
  const portable = JSON.parse(JSON.stringify(trace));
  const run = async resume => {
    const fixture = await createPveHeadlessFixture(portable.initialCheckpoint.mapDefinition, replayIdentity);
    try { return await replayCommandTrace(fixture.replay, portable, resume); }
    finally { await fixture.dispose(); }
  };
  assert.deepEqual(await run(), recorded.boundaries, 'all authoritative fields and both-seat views replay without normalization');
  const suffix = recorded.boundaries.filter(row => row.checkpoint.state.tickNumber >= 30);
  assert.deepEqual(await run(recorded.resume), suffix, 'restart resumes the unaccepted suffix, including the remaining same-tick Stop');
  for (const actor of recorded.actors) {
    const moved = suffix[0].checkpoint.state.units.find(unit => unit.id === actor.id);
    assert.ok(Math.hypot(moved.x - actor.x, moved.z - actor.z) > .1, 'accepted Move genuinely advances the actor');
    const stopped = recorded.boundaries.at(-1).checkpoint.state.units.find(unit => unit.id === actor.id);
    assert.deepEqual([stopped.path, stopped.queuedWaypoints], [[], []], 'accepted Stop clears route and queued intent');
    assert.equal(stopped.generation, actor.generation, 'replay never remaps actor generation');
  }
  for (const row of recorded.boundaries) for (const seat of [0, 1]) {
    assert.ok(row.views[seat].units.every(unit => unit[1] === seat), 'remote enemy orders remain hidden in each fog view');
    assert.equal(row.views[seat].population[1 - seat], null);
  }
  // Negative control: a lost cursor repeats the other seat's already accepted
  // queued Move. Both histories later Stop, so terminal pose alone is insufficient.
  const duplicate = await run({ ...recorded.resume, nextCommandIndex: recorded.resume.nextCommandIndex - 1 });
  const actorId = recorded.actors[1 - team].id;
  const queued = row => row.checkpoint.state.units.find(unit => unit.id === actorId).queuedWaypoints.length;
  assert.equal(queued(suffix[0]), 1);
  assert.equal(queued(duplicate[0]), 2, 'control genuinely repeats an authority-accepted queued order');
  assert.deepEqual(duplicate.at(-1), suffix.at(-1), 'later Stop hides the duplication from terminal checkpoint/view equality');
  assert.throws(() => assert.deepEqual(duplicate, suffix, 'replay boundary mismatch'), /replay boundary mismatch/);
});

for (const team of [0, 1]) test(`seat ${team}: checkpoint recovery rejects a saved command for a reused rematch slot`, async () => {
  const source = await createPveHeadlessFixture(commandReplayMap(), replayIdentity), original = source.replay;
  let trace, rematch, actor;
  try {
    const initial = original.checkpoint();
    actor = initial.state.units.find(unit => unit.team === team && unit.kind === 'infantry');
    const command = { type: 'move', ids: [actor.id], unitGenerations: [actor.generation],
      x: team ? 18.5 : -18.5, z: .5, clientOrderToken: 51 + team };
    const accepted = await recordAcceptedCommand(original, team, command, 'MOVE ORDER · 1 UNITS');
    trace = JSON.parse(JSON.stringify(sealCommandReplay(initial, [accepted], initial.state.tickNumber + 20)));
    await original.order(0, { type: 'reset' }); // Ordinary host reset, not an edited checkpoint.
    original.drain();
    rematch = original.checkpoint();
    const replacement = rematch.state.units.find(unit => unit.id === actor.id);
    assert.equal(replacement.team, team);
    assert.equal(replacement.kind, actor.kind);
    assert.equal(replacement.generation, actor.generation + 1, 'real reset reuses the ID with a fresh generation');
    assert.deepEqual([replacement.path, replacement.queuedWaypoints], [[], []]);
    assert.equal(rematch.state.unitGenerationCounters[actor.id], replacement.generation);
  } finally { await source.dispose(); }

  const recovered = await createPveHeadlessFixture(rematch.mapDefinition, replayIdentity), r = recovered.replay;
  try {
    r.restore(structuredClone(rematch));
    const before = captureReplayBoundary(r, 0);
    assert.deepEqual(before.checkpoint, rematch, 'cold fixture restores the actual rematch generation table exactly');
    const notices = await r.order(team, trace.commands[0].command);
    r.drain();
    assert.deepEqual(notices, [{ type: 'notice', clientOrderToken: 51 + team,
      message: 'MOVE REJECTED · NO VALID UNITS' }]);
    assert.deepEqual(captureReplayBoundary(r, 0), before, 'stale packet changes neither authority nor either fog view');
    await assert.rejects(replayCommandTrace(r, trace, { checkpoint: rematch }),
      /command must receive its acceptance notice/, 'old accepted trace cannot silently bind the replacement');
    assert.deepEqual(captureReplayBoundary(r, 0), before, 'failed replay preserves every checkpoint field and both views');

    // Negative control: the optional-generation compatibility path still accepts
    // IDs alone. Dropping the trace stamp must visibly break the no-change oracle.
    const unstamped = structuredClone(trace.commands[0].command);
    delete unstamped.unitGenerations;
    await recordAcceptedCommand(r, team, unstamped, 'MOVE ORDER · 1 UNITS');
    const moved = captureReplayBoundary(r, 0);
    assert.ok(moved.checkpoint.state.units.find(unit => unit.id === actor.id).path.length > 0);
    assert.throws(() => assert.deepEqual(moved, before, 'generation replay boundary mismatch'),
      /generation replay boundary mismatch/);
    for (let tick = 0; tick < 20; tick++) r.step();
    const replacement = r.checkpoint().state.units.find(unit => unit.id === actor.id);
    assert.equal(replacement.generation, actor.generation + 1);
    assert.ok(Math.hypot(replacement.x - actor.x, replacement.z - actor.z) > .1,
      'control genuinely moves the replacement instead of merely changing feedback');
  } finally { await recovered.dispose(); }
});
