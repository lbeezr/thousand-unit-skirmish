import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkirmishTargetPolicy, selectSkirmishTarget, PVE_SKIRMISH_LIMITS as limits } from '../src/pve-skirmish-targets.mjs';
import { createDeterministicPolicy, toOpponentObservation } from '../src/pve-opponent.mjs';
import { replayRememberedSearch } from './pve-remembered-search-case.mjs';
import { replayProgressSearch } from './pve-progress-search-case.mjs';
import { createContactMemoryCase, replayContactMemory } from './pve-contact-memory-case.mjs';

const skirmish = { matchModeId: 'skirmish', matchModeVersion: 1 };
for (const cold of [false, true]) test(`real Medium progressing route: ${cold ? 'cold restart during extension' : 'warm policy'} retains discovery past sixty seconds`, async () => {
  const result = await replayProgressSearch('progressing', { cold });
  assert.ok(result.disclosed > result.initialTick + limits.searchTicks);
  assert.ok(result.disclosed < result.initialTick + limits.maxSearchTicks);
  assert.ok(result.firstChanged === null || result.firstChanged >= result.disclosed, 'the original goal survives until actual native discovery');
  if (cold) assert.equal(result.stages.restart, result.initialTick + 1830, 'fresh native fixture and policy at sixty-one seconds');
  assert.deepEqual(await replayProgressSearch('progressing', { cold }), result);
  console.log(JSON.stringify({ name: result.name, cold, disclosed: result.disclosed, firstChanged: result.firstChanged,
    newCells: result.newCells, newCellsNearGoal: result.newCellsNearGoal, stages: result.stages }));
});
test('real Medium blocked route: bounded policy releases the genuinely stalled hidden goal', async () => {
  const result = await replayProgressSearch('stalled');
  assert.equal(result.firstChanged, result.initialTick + limits.searchTicks,
    'short blocked routes keep the original escape deadline');
  assert.equal(result.disclosed, null, 'the blocked original point stays unknown');
  assert.ok(result.newCells > 0, 'the replacement route still discovers new ground');
  assert.deepEqual(await replayProgressSearch('stalled'), result);
});
const unit = (team, id, extra = {}) => ({ team, id, generation: 1, x: team ? 20 : -20,
  z: 0, hp: 100, kind: 'infantry', focusedCount: 0, lastAttack: null, ...extra });
const building = (team, id, extra = {}) => ({ team, id, type: 'barracks', hp: 1800,
  complete: true, x: 0, z: 0, ...extra });
function observation(team) {
  return { schemaVersion: 1, team, tick: 0, fogOfWar: true,
    map: { id: 'bellweather-millrace', width: 80, height: 64 },
    visibility: { columns: 80, rows: 64, data: Buffer.alloc(1280).toString('base64') },
    units: { friendly: Array.from({ length: 8 }, (_, i) => unit(team, i)), visibleEnemies: [] },
    buildings: { friendly: [], visibleEnemies: [building(1 - team, 100)] },
    resources: { food: 0, wood: 0 }, resourceNodes: [], population: null, workerProduction: null,
    research: null, objectives: [{ id: 'bonus', owner: -1, victory: false,
      zone: { column: 37, row: 41, width: 6, height: 6 } }] };
}
function longObservation(team) {
  const state = observation(team);
  state.map.width = state.map.height = 224;
  state.visibility = { columns: 224, rows: 224, data: Buffer.alloc(12544).toString('base64') };
  state.buildings.visibleEnemies = [];
  for (const soldier of state.units.friendly) { soldier.x = 60; soldier.z = 60; }
  return state;
}

test('the versioned policy input rejects partial/unknown identities and preserves the legacy default', () => {
  for (const value of [{ matchModeId: 'skirmish' }, { matchModeVersion: 1 },
    { matchModeId: 'skirmish', matchModeVersion: 2 }, { matchModeId: 'invented', matchModeVersion: 1 }]) {
    assert.throws(() => createDeterministicPolicy(0, value), /Match mode|Unsupported/);
  }
});

for (const team of [0, 1]) for (const seed of [0, 20260925, 0xffffffff]) {
  test(`seat ${team}, seed ${seed}: explicit Skirmish attacks visible recovery after reward ownership`, () => {
    for (const owner of [-1, team]) {
      const state = observation(team); state.objectives[0].owner = owner;
      const candidate = createDeterministicPolicy(seed, skirmish), repeat = createDeterministicPolicy(seed, skirmish);
      const commands = candidate.next(state);
      assert.deepEqual(commands, repeat.next(structuredClone(state)));
      assert.deepEqual(commands, [{ type: 'attackBuilding', ids: state.units.friendly.map(u => u.id),
        unitGenerations: Array(8).fill(1), buildingId: 100 }]);
      assert.deepEqual(candidate.next(state), [], 'duplicate snapshots do not repeat an assault');
      const legacy = createDeterministicPolicy(seed), authored = createDeterministicPolicy(seed,
        { matchModeId: 'authored', matchModeVersion: 1 }), objective = createDeterministicPolicy(seed,
        { matchModeId: 'objective-control', matchModeVersion: 1 });
      for (const tick of [0, 30, 300, 900, 2700]) {
        state.tick = tick;
        const expected = legacy.next(state);
        assert.deepEqual(authored.next(structuredClone(state)), expected);
        assert.deepEqual(objective.next(structuredClone(state)), expected);
        if (tick === 0) assert.equal(expected.some(c => c.type === 'attackMove'), owner !== team);
      }
    }
  });
}

for (const team of [0, 1]) {
  test(`Medium seat ${team}: real remembered fog yields to new ground through exact cold recovery`, async () => {
    const first = await replayRememberedSearch(team);
    assert.equal(first.firstMemory, 0, 'unexplored ground precedes the remembered candidate');
    assert.equal(first.nextMemory, 0, 'fresh policy still searches new ground after cold restore');
    assert.deepEqual(await replayRememberedSearch(team), first, 'native orders, fog, cold checkpoint and recovery replay exactly');
    console.log(JSON.stringify({ team, seed: first.seed, first: first.first, next: first.next, stages: first.stages }));
  });

  test(`seat ${team}: unexplored candidates precede remembered ground within the existing budget`, () => {
    const state = observation(team), soldiers = state.units.friendly;
    state.buildings.visibleEnemies = [];
    const mask = Buffer.alloc(1280, 0x55);
    const set = (column, row, value) => {
      const cell = row * 80 + column;
      mask[cell >> 2] = (mask[cell >> 2] & ~(3 << ((cell & 3) * 2))) | value << ((cell & 3) * 2);
    };
    set(12, 12, 0); state.visibility.data = mask.toString('base64');
    const command = createSkirmishTargetPolicy(0).next(state, soldiers)[0];
    assert.deepEqual([command.x, command.z], [-27.5, -19.5],
      'the second global candidate is unknown; the first is already explored');
  });

  test(`seat ${team}: unknown ground outside the budget preserves a useful remembered fallback`, () => {
    const state = observation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const mask = Buffer.alloc(1280, 0x55), cell = 52 * 80 + 36;
    mask[cell >> 2] &= ~(3 << ((cell & 3) * 2));
    state.visibility.data = mask.toString('base64');
    const first = policy.next(state, soldiers)[0];
    assert.deepEqual([first.x, first.z], [-35.5, -27.5], 'the 65th candidate is outside this turn');
    state.tick += limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.deepEqual([next.x, next.z], [-3.5, 20.5], 'fallback advances by one candidate, so the unknown cell enters the next budget');
  });

  test(`seat ${team}: persistent unknown goals cannot starve remembered-territory coverage`, () => {
    const state = observation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const mask = Buffer.alloc(1280, 0x55);
    for (const [column, row] of [[12, 12], [4, 36]]) {
      const cell = row * 80 + column;
      mask[cell >> 2] &= ~(3 << ((cell & 3) * 2));
    }
    state.visibility.data = mask.toString('base64');
    const cells = new Set();
    let remembered = 0;
    for (let index = 0; index <= 80; index++) {
      const command = policy.next(state, soldiers)[0];
      assert.ok(command, 'an expired goal permits another bounded decision');
      const cell = Math.floor(command.z + 32) * 80 + Math.floor(command.x + 40);
      const memory = mask[cell >> 2] >> ((cell & 3) * 2) & 3;
      if (index === 0) assert.equal(memory, 0, 'new ground gets the first search turn');
      if (memory === 1) remembered++;
      cells.add(`${command.x}:${command.z}`);
      state.tick += limits.searchTicks;
    }
    assert.equal(cells.size, 80, 'one complete cursor sweep follows an unreached, still-hidden goal');
    assert.equal(remembered, 78, 'both unknown cells and every remembered cell receive a turn');
    const preferred = policy.next(state, soldiers)[0];
    const cell = Math.floor(preferred.z + 32) * 80 + Math.floor(preferred.x + 40);
    assert.equal(mask[cell >> 2] >> ((cell & 3) * 2) & 3, 0, 'unknown preference resumes after coverage');
  });

  test(`seat ${team}: original soldiers keep a moving goal past sixty seconds, then escape a stall`, () => {
    const state = longObservation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    for (const tick of [1700, 1790]) {
      state.tick = tick;
      for (const soldier of soldiers) soldier.x += 1;
      policy.next(state, soldiers);
    }
    state.tick = limits.searchTicks;
    assert.deepEqual(policy.next(state, soldiers), [], 'ongoing movement does not receive a new goal at sixty seconds');
    state.tick = 1790 + limits.retryTicks;
    const stalled = policy.next(state, soldiers)[0];
    assert.ok(stalled, 'ten seconds without movement escapes after the initial grace');
    assert.notDeepEqual([stalled.x, stalled.z], [first.x, first.z]);
  });

  test(`seat ${team}: continuous original-cohort movement cannot exceed the hard goal bound`, () => {
    const state = longObservation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    for (let tick = 300; tick < limits.maxSearchTicks; tick += 300) {
      state.tick = tick;
      for (const soldier of soldiers) soldier.x += .75;
      assert.deepEqual(policy.next(state, soldiers), [], `moving goal remains held at ${tick}`);
    }
    state.tick = limits.maxSearchTicks;
    for (const soldier of soldiers) soldier.x += .75;
    const bounded = policy.next(state, soldiers)[0];
    assert.notDeepEqual([bounded.x, bounded.z], [first.x, first.z], 'even continuous motion releases at three minutes');
  });

  for (const replacement of [false, true]) test(`seat ${team}: ${replacement ? 'reused generations' : 'reinforcements'} cannot fake old-goal progress`, () => {
    const state = longObservation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    if (replacement) for (const soldier of soldiers) soldier.generation++;
    else soldiers.push(unit(team, 100));
    state.tick = 1790;
    for (const soldier of soldiers) if (replacement || soldier.id === 100) soldier.x += 1;
    policy.next(state, soldiers);
    state.tick = limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.notDeepEqual([next.x, next.z], [first.x, first.z], 'only original identities can extend the goal');
  });

  test(`seat ${team}: current enemy sight interrupts an extended moving goal`, () => {
    const state = longObservation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    policy.next(state, soldiers);
    state.tick = 1790;
    for (const soldier of soldiers) soldier.x += 1;
    policy.next(state, soldiers);
    state.tick = limits.searchTicks;
    assert.deepEqual(policy.next(state, soldiers), []);
    state.buildings.visibleEnemies = [building(1 - team, 100)]; state.tick++;
    assert.equal(policy.next(state, soldiers)[0].buildingId, 100);
  });

  test(`seat ${team}: short direct routes retain the original deadline despite movement`, () => {
    const state = observation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    state.tick = 1790;
    for (const soldier of soldiers) soldier.x += 1;
    policy.next(state, soldiers);
    state.tick = limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.notDeepEqual([next.x, next.z], [first.x, first.z]);
  });

  test(`seat ${team}: admitted Tiny keeps its deadline even for a long direct crossing`, () => {
    const state = longObservation(team), soldiers = state.units.friendly, policy = createSkirmishTargetPolicy(0);
    state.map.width = state.map.height = 160;
    state.visibility = { columns: 160, rows: 160, data: Buffer.alloc(6400).toString('base64') };
    const first = policy.next(state, soldiers)[0];
    state.tick = 1790;
    for (const soldier of soldiers) soldier.x += 1;
    policy.next(state, soldiers);
    state.tick = limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.notDeepEqual([next.x, next.z], [first.x, first.z], 'Tiny stays on its previously qualified policy');
  });

  test(`seat ${team}: revealing an exploration goal preserves the approach until arrival`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    const mask = Buffer.alloc(1280), cell = Math.floor(first.z + 32) * 80 + Math.floor(first.x + 40);
    mask[cell >> 2] |= 2 << ((cell & 3) * 2);
    state.visibility.data = mask.toString('base64'); state.tick = 30;
    for (const soldier of soldiers) soldier.x += team ? -1 : 1;
    assert.deepEqual(policy.next(state, soldiers), [], 'forward sight cannot interrupt moving soldiers');
    state.tick += limits.retryTicks;
    const retry = policy.next(state, soldiers)[0];
    assert.deepEqual([retry.x, retry.z], [first.x, first.z], 'stationary retries retain the revealed goal');
    for (const soldier of soldiers) { soldier.x = first.x; soldier.z = first.z; }
    state.tick++;
    const arrived = policy.next(state, soldiers)[0];
    assert.notDeepEqual([arrived.x, arrived.z], [first.x, first.z], 'arrival permits a new frontier');
    state.buildings.visibleEnemies = [building(1 - team, 100)]; state.tick++;
    assert.equal(policy.next(state, soldiers)[0].buildingId, 100, 'current enemy sight takes priority');
  });

  test(`seat ${team}: an unreached frontier gives the global cursor a turn at its deadline`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    state.buildings.visibleEnemies = [];
    const first = policy.next(state, soldiers)[0];
    state.tick = limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.deepEqual([next.x, next.z], [-27.5, -19.5], 'unknown local probes cannot starve bounded global search');
    assert.notDeepEqual([next.x, next.z], [first.x, first.z]);
    state.tick += limits.searchTicks;
    const third = policy.next(state, soldiers)[0];
    assert.deepEqual([third.x, third.z], [-19.5, -11.5], 'subsequent expired goals distribute the cursor across rows');
  });

  test(`seat ${team}: arriving at successive frontiers advances global search across rows`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    state.buildings.visibleEnemies = [];
    let command = policy.next(state, soldiers)[0];
    const goals = [];
    for (let index = 0; index < 4; index++) {
      goals.push([command.x, command.z]);
      for (const soldier of soldiers) { soldier.x = command.x; soldier.z = command.z; }
      state.tick += 30;
      const prior = command;
      command = policy.next(state, soldiers)[0];
      assert.ok(command, 'an arrived army receives another legal search order');
      assert.notDeepEqual([command.x, command.z], [prior.x, prior.z]);
    }
    assert.deepEqual(goals, [[-35.5, -27.5], [-27.5, -19.5], [-19.5, -11.5], [-11.5, -3.5]],
      'successfully reached goals also distribute search across rows');
  });

  test(`seat ${team}: recovery priorities exclude dead, friendly and water-only targets`, () => {
    const state = observation(team), enemy = 1 - team;
    state.buildings.visibleEnemies = [building(enemy, 120, { type: 'dock', x: -20 }),
      building(team, 121), building(enemy, 122, { hp: 0 }), building(enemy, 123, { complete: false }),
      building(enemy, 125), building(enemy, 124)];
    state.units.visibleEnemies = [unit(enemy, 90, { kind: 'worker' }), unit(enemy, 91, { kind: 'skiff' })];
    assert.equal(selectSkirmishTarget(state, state.units.friendly).buildingId, 124, 'stable producer tie');
    state.buildings.visibleEnemies = state.buildings.visibleEnemies.filter(b => b.id < 124);
    assert.equal(selectSkirmishTarget(state, state.units.friendly).targetId, 90, 'living land units precede foundations');
    state.units.visibleEnemies = [unit(enemy, 91, { kind: 'skiff' }), unit(enemy, 92, { hp: 0 })];
    assert.equal(selectSkirmishTarget(state, state.units.friendly).buildingId, 123, 'paid recovery foundations remain targets');
    state.buildings.visibleEnemies = [];
    assert.equal(selectSkirmishTarget(state, state.units.friendly), null);
  });

  test(`seat ${team}: visibility loss, reused identities, reinforcements and combat remain safe`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    policy.next(state, soldiers); soldiers[0].focusedCount = 1; soldiers[1].lastAttack = { tick: 30 };
    state.tick = 30; state.buildings.visibleEnemies = [building(1 - team, 101)];
    assert.deepEqual(policy.next(state, soldiers)[0].ids, soldiers.slice(2).map(u => u.id));
    state.tick = 150; soldiers[0].focusedCount = 0;
    assert.deepEqual(policy.next(state, soldiers)[0].ids, [0, 1], 'fighters join only after protection expires');
    soldiers[2].generation++; state.tick++;
    assert.deepEqual(policy.next(state, soldiers)[0].unitGenerations, [2]);
    soldiers.push(unit(team, 20)); state.tick++;
    assert.deepEqual(policy.next(state, soldiers)[0].ids, [20]);
    state.buildings.visibleEnemies = []; state.tick++;
    const search = policy.next(state, soldiers)[0];
    assert.equal(search.type, 'attackMove');
    assert.ok(!Object.hasOwn(search, 'buildingId'), 'no unseen entity commands');
    state.units.visibleEnemies = [unit(1 - team, 50, { generation: 3 })]; state.tick++;
    assert.equal(policy.next(state, soldiers)[0].targetGeneration, 3);
    state.units.visibleEnemies[0].generation++; state.tick++;
    assert.equal(policy.next(state, soldiers)[0].targetGeneration, 4);
    assert.deepEqual(policy.next(state, [unit(1 - team, 80), unit(team, 81, { kind: 'worker' }),
      unit(team, 82, { kind: 'skiff' })]), [], 'ownership and noncombat roles cannot leak into assaults');
  });

  test(`seat ${team}: bounded retries and search rotation leave moving and fighting soldiers alone`, () => {
    const state = observation(team), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    policy.next(state, soldiers);
    for (const [tick, expected] of [[299, false], [300, true], [899, false], [900, true],
      [2099, false], [2100, true], [3899, false], [3900, true], [5700, true]]) {
      state.tick = tick; assert.equal(policy.next(state, soldiers).length > 0, expected);
    }
    soldiers[0].x++; soldiers[1].focusedCount = 1; state.tick = 7500;
    assert.ok(policy.next(state, soldiers)[0].ids.every(id => id !== 0 && id !== 1));
    state.buildings.visibleEnemies = []; soldiers[1].focusedCount = 0; state.tick++;
    const first = policy.next(state, soldiers)[0];
    state.tick += limits.searchTicks;
    const next = policy.next(state, soldiers)[0];
    assert.notDeepEqual([next.x, next.z], [first.x, first.z], 'an obstructed unknown frontier is not pursued forever');
    assert.ok(next.x > -40 && next.x < 40 && next.z > -32 && next.z < 32);
  });
}

test('filtered observations and commands remain identical when hidden enemy state changes', () => {
  const map = { id: 'bellweather-millrace', width: 80, height: 64, triggers: [], resourceNodes: [] };
  const mask = Buffer.alloc(1280); const cell = 32 * 80 + 40; mask[cell >> 2] = 2 << ((cell & 3) * 2);
  const state = { type: 'state', tick: 0, fogOfWar: true,
    visibility: { columns: 80, rows: 64, data: mask.toString('base64') }, food: [0, 800], wood: [0, 999],
    units: [[0, 0, -20, 0, 100, 'infantry', 0, '', 1]],
    buildings: [building(1, 100), building(1, 101, { x: 30, z: 20 })], objectives: [] };
  const altered = structuredClone(state);
  altered.food[1] = 1; altered.wood[1] = 0; altered.buildings[1].type = 'town-center';
  altered.units.push([70, 1, 30, 20, 100, 'worker', 0, '', 4]);
  const a = toOpponentObservation(state, 0, map), b = toOpponentObservation(altered, 0, map);
  assert.deepEqual(a, b);
  assert.deepEqual(createSkirmishTargetPolicy(1).next(a, a.units.friendly),
    createSkirmishTargetPolicy(1).next(b, b.units.friendly));
});

for (const memory of [0, 1]) for (const [width, height] of [[80, 64], [80, 88], [160, 160], [224, 224]]) {
  test(`global search covers every coarse cell once on ${width}×${height}, memory ${memory}`, () => {
    const state = observation(0), policy = createSkirmishTargetPolicy(0), soldiers = state.units.friendly;
    state.map.width = width; state.map.height = height;
    state.visibility = { columns: width, rows: height,
      data: Buffer.alloc(Math.ceil(width * height / 4), memory ? 0x55 : 0).toString('base64') };
    state.buildings.visibleEnemies = [];
    for (const soldier of soldiers) { soldier.x = 0; soldier.z = 0; }
    policy.next(state, soldiers);
    const cells = new Set(), count = Math.ceil(width / 8) * Math.ceil(height / 8);
    for (let index = 0; index < count; index++) {
      state.tick += limits.searchTicks;
      const command = policy.next(state, soldiers)[0];
      assert.ok(command && command.type === 'attackMove');
      assert.ok(command.x > -width / 2 && command.x < width / 2);
      assert.ok(command.z > -height / 2 && command.z < height / 2);
      cells.add(`${command.x}:${command.z}`);
    }
    assert.equal(cells.size, count, 'cursor cannot become trapped in a short stride cycle');
  });
}

const actor=(team,id,extra={})=>({team,id,generation:1,kind:'infantry',hp:100,x:-20,z:0,focusedCount:0,lastAttack:null,...extra});
function state(team=0,side=160){return {team,tick:0,fogOfWar:true,map:{id:'contact-case',width:side,height:side},
 visibility:{columns:side,rows:side,data:Buffer.alloc(side*side/4).toString('base64')},
 units:{friendly:[actor(team,0),actor(team,1)],visibleEnemies:[actor(1-team,90,{x:0,z:0})]},
 buildings:{friendly:[],visibleEnemies:[]}};}
const point=command=>[command.x,command.z];
const hide=o=>{o.units.visibleEnemies=[];o.tick=30;};

for(const team of [0,1]){
 test(`Tiny seat ${team}: lost contact uses one public coordinate and expires despite movement/reinforcement`,()=>{
  const o=state(team),policy=createSkirmishTargetPolicy(0);assert.equal(policy.next(o,o.units.friendly)[0].targetId,90);
  hide(o);const remembered=policy.next(o,o.units.friendly)[0];assert.equal(remembered.type,'attackMove');assert.deepEqual(point(remembered),[0,0]);
  assert(!('targetId'in remembered)&&!('targetGeneration'in remembered));assert.deepEqual(policy.next(o,o.units.friendly),[]);
  o.tick=limits.contactMemoryTicks-1;o.units.friendly[0].x++;o.units.friendly.push(actor(team,44,{x:0,z:0}));
  const join=policy.next(o,o.units.friendly)[0];assert.deepEqual(join.ids,[44]);assert.deepEqual(point(join),[0,0],'reinforcement cannot fake an original visit');
  o.tick=limits.contactMemoryTicks;const released=policy.next(o,o.units.friendly)[0];assert.notDeepEqual(point(released),[0,0],'motion and joining do not extend disclosure expiry');
 });
 test(`Tiny seat ${team}: original arrival, complete loss and reused generations release contact`,()=>{
  for(const cause of ['arrival','loss','reuse','empty']){
   const o=state(team),policy=createSkirmishTargetPolicy(0);policy.next(o,o.units.friendly);hide(o);policy.next(o,o.units.friendly);o.tick++;
   if(cause==='arrival')o.units.friendly[0].x=1.9;
   if(cause==='loss')o.units.friendly=o.units.friendly.map(u=>({...u,hp:0})).concat(actor(team,44));
   if(cause==='reuse')o.units.friendly.forEach(u=>u.generation++);
   if(cause==='empty'){assert.deepEqual(policy.next(o,[]),[]);o.tick++;}
   const released=policy.next(o,o.units.friendly)[0];assert.ok(released,cause);assert.notDeepEqual(point(released),[0,0],cause);
  }
 });
 test(`Tiny seat ${team}: visible recovery/identity reacquisition outranks coordinate memory`,()=>{
  const o=state(team),policy=createSkirmishTargetPolicy(0);policy.next(o,o.units.friendly);hide(o);policy.next(o,o.units.friendly);
  o.tick++;o.buildings.visibleEnemies=[{team:1-team,id:700,type:'town-center',hp:1000,complete:true,x:10,z:10}];
  assert.equal(policy.next(o,o.units.friendly)[0].buildingId,700);
  o.tick++;o.buildings.visibleEnemies=[];o.units.visibleEnemies=[actor(1-team,90,{generation:2,x:25,z:0})];
  const current=policy.next(o,o.units.friendly)[0];assert.equal(current.targetId,90);assert.equal(current.targetGeneration,2);
  o.tick++;o.units.visibleEnemies=[];assert.deepEqual(point(policy.next(o,o.units.friendly)[0]),[25,0]);
 });
 test(`Tiny seat ${team}: rewind, map/seat change and fresh policy cannot inherit unseen contact`,()=>{
  for(const change of ['rewind','map','seat','fresh']){
   const o=state(team);let policy=createSkirmishTargetPolicy(0);policy.next(o,o.units.friendly);hide(o);policy.next(o,o.units.friendly);o.tick++;
   if(change==='rewind')o.tick=0;
   if(change==='map')o.map.id='other-map';
   if(change==='seat'){o.team=1-team;o.units.friendly.forEach(u=>u.team=1-team);}
   if(change==='fresh')policy=createSkirmishTargetPolicy(0);
   assert.notDeepEqual(point(policy.next(o,o.units.friendly)[0]),[0,0],change);
  }
 });
 for(const side of [80,192,224,256])test(`side ${side} seat ${team}: contact memory does not change other tiers`,()=>{
  const o=state(team,side),policy=createSkirmishTargetPolicy(0);policy.next(o,o.units.friendly);hide(o);
  assert.notDeepEqual(point(policy.next(o,o.units.friendly)[0]),[0,0]);
 });
}

test('Tiny contact history remains invariant under hidden enemy movement, generation and banks',()=>{
 const map={id:'contact-case',width:160,height:160,resourceNodes:[],triggers:[]},mask=Buffer.alloc(6400),cell=80*160+80;
 mask[cell>>2]|=2<<((cell&3)*2);
 const raw={type:'state',tick:0,fogOfWar:true,visibility:{columns:160,rows:160,data:mask.toString('base64')},food:[150,150],wood:[250,250],
  units:[[0,0,-20,0,100,'infantry',0,'',1],[90,1,0,0,100,'worker',0,'',1]],buildings:[],objectives:[]};
 const a=createSkirmishTargetPolicy(0),b=createSkirmishTargetPolicy(0);
 for(const tick of [0,30,60,299,300,600]){
  raw.tick=tick;if(tick>0)raw.visibility.data=Buffer.alloc(6400,0x55).toString('base64');
  const changed=structuredClone(raw);if(tick>0){changed.units[1][2]=50;changed.units[1][3]=-30;changed.units[1][8]=99;changed.food[1]=99999;changed.wood[1]=0;}
  const first=toOpponentObservation(raw,0,map),second=toOpponentObservation(changed,0,map);assert.deepEqual(second,first);
  assert.deepEqual(b.next(second,second.units.friendly),a.next(first,first.units.friendly));
 }
});

test('current native Tiny contact inspection is useful, bounded and forgotten by cold recovery',async()=>{
 const data=await createContactMemoryCase(),baseline=await replayContactMemory(data,{disclosed:false});
 const candidate=await replayContactMemory(data),cold=await replayContactMemory(data,{cold:true});
 assert.equal(baseline.metrics.firstWithin2,null,'no disclosed history follows normal global search');
 assert(candidate.metrics.firstWithin2!==null);assert(candidate.metrics.nearest<baseline.metrics.nearest);
 assert(candidate.metrics.firstGlobal<=data.priming.tick+limits.contactMemoryTicks,'arrival/expiry returns to global search');
 const memory=candidate.trace[0];assert.equal(memory.command.type,'attackMove');assert.deepEqual(point(memory.command),[data.contact.x,data.contact.z]);
 assert.equal(cold.stages.restart,data.tick+30);assert.notDeepEqual(point(cold.trace.find(t=>t.tick===cold.stages.restart).command),[data.contact.x,data.contact.z]);
 for(const result of [baseline,candidate,cold]){assert.equal(result.metrics.rejected,0);assert.equal(result.final.state.matchWinner,-1);assert.equal(result.final.state.units.find(u=>u.id===data.enemyId).hp,100);}
 assert.deepEqual(await replayContactMemory(data),candidate,'complete controlled result repeats exactly');
});
