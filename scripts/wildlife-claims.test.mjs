import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { createResourceNodeState, validWildlifeNodeState, validWildlifeTeam } from '../src/wildlife-state.mjs';
import { validWildlifeMotion, sameWildlifeCell, wildlifeCell } from '../src/wildlife-motion.mjs';
import { validResourceVariantState } from '../src/shore-fishing.mjs';
import { validWildlifeHerdState } from '../src/wildlife-herding.mjs';
import assert from 'node:assert/strict';
import { resolveWildlifeClaim, stepWildlifeClaims, SHEEP_CLAIM_RADIUS, clearWildlifeClaimSegment, migrateWildlifeClaimsCheckpoint } from '../src/wildlife-claims.mjs';

const clear = { canClaim: () => true };
const sheep = (patch = {}) => ({ id: 'meadow-sheep', type: 'food', stock: 130, x: 0, z: 0,
  wildlifeSpecies: 'bellweather-sheep', wildlifeState: 'alive', wildlifeTeam: null,
  wildlifeMotion: { sequence: 4, targetX: .2, targetZ: 0, waitTicks: 0, activity: 'wandering', heading: Math.PI / 2 },
  ...patch });
const unit = (patch = {}) => ({ id: 10, team: 0, hp: 40, x: 1, z: 0, kind: 'worker', cargo: 0,
  cargoType: null, gatherNodeId: null, gatherPhase: '', ...patch });
const withoutTeam = ({ wildlifeTeam, ...node }) => node;

test('both seats automatically claim neutral live Sheep without mutating resolution inputs', () => {
  for (const team of [0, 1]) {
    const node = sheep(), units = [unit({ team })];
    const original = structuredClone({ node, units });
    assert.equal(resolveWildlifeClaim(node, units, clear), team);
    assert.deepEqual({ node, units }, original);
    assert.equal(stepWildlifeClaims([node], units, clear), true);
    assert.equal(node.wildlifeTeam, team);
    assert.deepEqual(withoutTeam(node), withoutTeam(original.node));
    assert.deepEqual(units, original.units);
    assert.equal(stepWildlifeClaims([node], units, clear), false, 'same-owner updates emit no claim change');
  }
});

test('eligible owner presence retains a claim even when an enemy is nearer or has a lower ID', () => {
  for (const owner of [0, 1]) {
    const node = sheep({ wildlifeTeam: owner });
    const own = unit({ id: 80, team: owner, x: 1.39 });
    const enemy = unit({ id: 1, team: 1 - owner, x: .1 });
    for (const units of [[own, enemy], [enemy, own]]) {
      assert.equal(resolveWildlifeClaim(node, units, clear), owner);
      assert.equal(stepWildlifeClaims([node], units, clear), false);
    }
  }
});

test('both seats recapture only after all eligible owner presence leaves', () => {
  for (const owner of [0, 1]) {
    const node = sheep({ wildlifeTeam: owner });
    const enemy = unit({ id: 1, team: 1 - owner, x: .4 });
    const own = unit({ id: 2, team: owner, x: 1 });
    assert.equal(stepWildlifeClaims([node], [enemy, own], clear), false);
    own.x = 1.401;
    assert.equal(stepWildlifeClaims([node], [enemy, own], clear), true);
    assert.equal(node.wildlifeTeam, 1 - owner);
    assert.equal(stepWildlifeClaims([node], [enemy, own], clear), false);
    assert.equal(node.wildlifeState, 'alive');
    assert.equal(node.stock, 130);
  }
});

test('a claim persists with no eligible nearby unit; neutral Sheep stay neutral', () => {
  for (const owner of [null, 0, 1]) {
    const node = sheep({ wildlifeTeam: owner }), before = structuredClone(node);
    for (const units of [[], [unit({ x: 10 })], [unit({ hp: 0 })]]) {
      assert.equal(resolveWildlifeClaim(node, units, clear), owner);
      assert.equal(stepWildlifeClaims([node], units, clear), false);
      assert.deepEqual(node, before);
    }
  }
});

test('nearest eligible unit wins independently of team, array order or unit kind', () => {
  for (const nearestTeam of [0, 1]) {
    const node = sheep();
    const nearest = unit({ id: 90, team: nearestTeam, x: .25, kind: 'infantry' });
    const farther = unit({ id: 1, team: 1 - nearestTeam, x: .5, kind: 'worker' });
    for (const units of [[nearest, farther], [farther, nearest]]) {
      assert.equal(resolveWildlifeClaim(node, units, clear), nearestTeam);
    }
  }
});

test('exact distance ties use the lower stable unit ID, never array or team order', () => {
  for (const lowTeam of [0, 1]) {
    const low = unit({ id: 3, team: lowTeam, x: 0, z: -1 });
    const high = unit({ id: 4, team: 1 - lowTeam, x: 1, z: 0 });
    for (const units of [[low, high], [high, low]]) {
      assert.equal(resolveWildlifeClaim(sheep(), units, clear), lowTeam);
    }
    high.x = .999999999;
    assert.equal(resolveWildlifeClaim(sheep(), [low, high], clear), high.team,
      'only exact ties use ID; a genuinely nearer unit wins');
  }
});

test('claim radius includes exactly 1.4 world units and excludes farther units in any direction', () => {
  assert.equal(SHEEP_CLAIM_RADIUS, 1.4);
  for (const position of [{ x: 1.4, z: 0 }, { x: -1.4, z: 0 }, { x: 0, z: 1.4 }, { x: 0, z: -1.4 }]) {
    assert.equal(resolveWildlifeClaim(sheep(), [unit(position)], clear), 0);
  }
  for (const position of [{ x: 1.400000001, z: 0 }, { x: 0, z: -1.400000001 }, { x: 1, z: 1 }]) {
    assert.equal(resolveWildlifeClaim(sheep(), [unit(position)], clear), null);
  }
  assert.equal(resolveWildlifeClaim(sheep({ x: 12, z: -8 }), [unit({ x: 13, z: -8 })], clear), 0,
    'distance uses actual current world positions');
});

test('dead, water, invalid-domain/team/ID/position and distant units never reach canClaim', () => {
  const invalid = [{ hp: 0 }, { hp: -1 }, { hp: NaN }, { movementDomain: 'water' },
    { movementDomain: 'air' }, { team: null }, { team: 2 }, { id: -1 }, { id: .5 },
    { x: Infinity }, { z: NaN }, { x: 1.5 }];
  for (const patch of invalid) {
    const calls = [];
    const options = { canClaim: candidate => { calls.push(candidate.id); return true; } };
    assert.equal(resolveWildlifeClaim(sheep(), [unit(patch)], options), null, JSON.stringify(patch));
    assert.deepEqual(calls, [], 'core eligibility runs before legal-segment callback');
  }
  assert.equal(resolveWildlifeClaim(sheep(), [unit({ movementDomain: 'land' })], clear), 0);
  assert.equal(resolveWildlifeClaim(sheep(), [unit()], clear), 0, 'ordinary server land rows omit the domain');
});

test('canClaim excludes a blocked nearer candidate and receives the exact unit/node rows', () => {
  const node = sheep(), blocked = unit({ id: 1, team: 0, x: .1 });
  const allowed = unit({ id: 2, team: 1, x: 1 });
  const calls = [];
  const options = { canClaim: (candidate, actualNode) => {
    assert.equal(actualNode, node);
    assert.ok(candidate === blocked || candidate === allowed);
    calls.push(candidate.id);
    return candidate !== blocked;
  } };
  assert.equal(resolveWildlifeClaim(node, [blocked, allowed], options), 1);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(resolveWildlifeClaim(node, [blocked], options), null, 'blocked presence alone cannot claim');
});

test('blocked owner presence does not prevent an eligible opposing recapture', () => {
  for (const owner of [0, 1]) {
    const node = sheep({ wildlifeTeam: owner });
    const units = [unit({ id: 1, team: owner, x: .1 }), unit({ id: 2, team: 1 - owner, x: 1 })];
    assert.equal(resolveWildlifeClaim(node, units, { canClaim: candidate => candidate.id === 2 }), 1 - owner);
    assert.equal(resolveWildlifeClaim(node, units, { canClaim: () => false }), owner,
      'absence of any eligible contender preserves the last owner');
  }
});

test('carcasses, depleted Sheep and ordinary/non-food nodes never gain or change claims', () => {
  const variants = [{ wildlifeState: 'carcass', stock: 42.5 }, { wildlifeState: 'depleted', stock: 0 },
    { wildlifeSpecies: undefined }, { wildlifeSpecies: 'deer' }, { type: 'wood' }, { stock: 0 }];
  for (const patch of variants) {
    const node = sheep({ ...patch, wildlifeTeam: 0 }), before = structuredClone(node);
    const options = { canClaim: () => { assert.fail('non-live Sheep must not attempt claims'); } };
    assert.equal(resolveWildlifeClaim(node, [unit({ team: 1 })], options), 0);
    assert.equal(stepWildlifeClaims([node], [unit({ team: 1 })], options), false);
    assert.deepEqual(node, before);
  }
});

test('claim update accepts resource values iterators and changes only wildlifeTeam', () => {
  const nodes = new Map([['left', sheep({ id: 'left', x: -4 })], ['right', sheep({ id: 'right', x: 4 })],
    ['carcass', sheep({ id: 'carcass', x: -4, stock: 42.5, wildlifeState: 'carcass', wildlifeTeam: 1 })]]);
  const units = [unit({ id: 1, team: 0, x: -4, cargo: .004, cargoType: 'food', gatherNodeId: 'carcass', gatherPhase: 'gathering' }),
    unit({ id: 2, team: 1, x: 4 })];
  const banks = [150.25, 149.75];
  const beforeNodes = structuredClone([...nodes.values()]), beforeUnits = structuredClone(units), beforeBanks = [...banks];
  const motions = [...nodes.values()].map(node => node.wildlifeMotion);
  const totalFood = () => [...nodes.values()].reduce((total, node) => total + node.stock, 0)
    + units.reduce((total, unit) => total + (unit.cargoType === 'food' ? unit.cargo : 0), 0)
    + banks.reduce((total, bank) => total + bank, 0);
  const food = totalFood();
  assert.equal(stepWildlifeClaims(nodes.values(), units, clear), true);
  assert.deepEqual([...nodes.values()].map(node => node.wildlifeTeam), [0, 1, 1]);
  assert.deepEqual([...nodes.values()].map(withoutTeam), beforeNodes.map(withoutTeam));
  assert.ok([...nodes.values()].every((node, index) => node.wildlifeMotion === motions[index]));
  assert.deepEqual(units, beforeUnits, 'claiming cannot alter shared Gather intent or cargo');
  assert.deepEqual(banks, beforeBanks);
  assert.equal(totalFood(), food, 'claims neither consume stock nor create a second food pool');
  assert.equal(stepWildlifeClaims(nodes.values(), units, clear), false);
});

test('legal-segment callback is required before a live claim can be resolved', () => {
  assert.throws(() => resolveWildlifeClaim(sheep(), [unit()], {}), /require canClaim/);
});


test('actual land-segment guard rejects water/walls, blocked diagonals, cliffs and map edges', () => {
  const map = { width: 8, height: 8 }, levels = new Uint8Array(64), blocked = new Set();
  const options = { map, levels, isWalkable: cell => cell >= 0 && cell < 64 && !blocked.has(cell) };
  const from = { x: -.5, z: .5 }, to = { x: .5, z: .5 };
  assert.equal(clearWildlifeClaimSegment(from, to, options), true);
  blocked.add(36); assert.equal(clearWildlifeClaimSegment(from, to, options), false, 'wall/water destination');
  blocked.clear(); levels[36] = 2;
  assert.equal(clearWildlifeClaimSegment(from, to, options), false, 'impassable elevation');
  levels[36] = 1; assert.equal(clearWildlifeClaimSegment(from, to, options), true, 'legal one-level step');
  levels[36] = 0;
  blocked.add(28);
  assert.equal(clearWildlifeClaimSegment({ x: -.5, z: -.5 }, to, options), false, 'cannot cut blocked diagonal');
  assert.equal(clearWildlifeClaimSegment({ x: -4.01, z: .5 }, to, options), false);
  assert.equal(clearWildlifeClaimSegment(from, { x: Infinity, z: .5 }, options), false);
});

test('exact schema25 claim migration adds only neutral labels, never repairs a forged owner', () => {
  const original = { schemaVersion: 25, state: { resourceNodes: [sheep(), sheep({ id: 'carcass', wildlifeState: 'carcass', stock: 42.5 }),
    { id: 'wood', type: 'wood', stock: .004 }], teamFood: [151.25, 152.75], units: [unit({cargo:.004,cargoType:'food'})] } };
  for (const node of original.state.resourceNodes) delete node.wildlifeTeam;
  const saved = structuredClone(original);
  assert.equal(migrateWildlifeClaimsCheckpoint(saved), true); assert.equal(saved.schemaVersion, 26);
  assert.deepEqual(saved.state.resourceNodes.slice(0,2).map(node=>node.wildlifeTeam), [null,null]);
  assert.equal(Object.hasOwn(saved.state.resourceNodes[2], 'wildlifeTeam'), false);
  const normalized = structuredClone(saved); normalized.schemaVersion = 25;
  for (const node of normalized.state.resourceNodes) delete node.wildlifeTeam;
  assert.deepEqual(normalized, original, 'stock, cargo, balances and existing motion stay byte-equivalent');
  for (const team of [null,0,1,2,'0']) {
    const forged = structuredClone(original); forged.state.resourceNodes[0].wildlifeTeam = team;
    const before = structuredClone(forged);
    assert.equal(migrateWildlifeClaimsCheckpoint(forged), false); assert.deepEqual(forged, before);
  }
});


test('actual server callback admits living visible land roster units and rejects Skiffs/hidden/blocked/unknown', () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const source = server.slice(server.indexOf('function updateWildlifeClaims('), server.indexOf('function updateWildlifeMotion('));
  const map = { width: 8, height: 8 }, levels = new Uint8Array(64);
  const node = sheep({ x: .5, z: .5 }), actor = unit({ x: .5, z: -.5 });
  let visible = true, open = true;
  const context = vm.createContext({ UNIT_DEFINITIONS, mapDefinition: map, elevationLevelByCell: levels,
    units: [actor], resourceNodeStates: new Map([[node.id,node]]), dirty: false,
    stepWildlifeClaims, clearWildlifeClaimSegment, wildlifeCell,
    cellVisibleToTeam: () => visible, isWalkable: () => open });
  vm.runInContext(source, context);
  for (const kind of Object.keys(UNIT_DEFINITIONS).filter(kind => UNIT_DEFINITIONS[kind].movementDomain !== 'water')) {
    for (const team of [0,1]) {
      Object.assign(actor,{kind,team,hp:40}); node.wildlifeTeam=null;
      context.updateWildlifeClaims(); assert.equal(node.wildlifeTeam,team,kind);
    }
  }
  for (const patch of [{kind:'skiff'},{kind:'unknown'},{hp:0}]) {
    Object.assign(actor,{kind:'worker',hp:40},patch);node.wildlifeTeam=null;
    context.updateWildlifeClaims();assert.equal(node.wildlifeTeam,null);
  }
  Object.assign(actor,{kind:'worker',hp:40});
  visible=false;context.updateWildlifeClaims();assert.equal(node.wildlifeTeam,null);
  visible=true;open=false;context.updateWildlifeClaims();assert.equal(node.wildlifeTeam,null);
});

test('actual current checkpoint validation requires a real team and disallows labels on ordinary food', () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = server.indexOf('  assertSnapshot(Array.isArray(state.resourceNodes)');
  const source = server.slice(start,server.indexOf('  const resourceCells = new Set(state.resourceNodes',start));
  const authored = { id:'saved-sheep',type:'food',stock:130,x:.5,z:.5,wildlifeSpecies:'bellweather-sheep' };
  function validate(node, definition = authored) {
    const context = vm.createContext({ definition: {width:8,height:8,resourceNodes:[definition]},state:{resourceNodes:[node]},
      finite:Number.isFinite,validWildlifeNodeState,validWildlifeTeam,validWildlifeMotion,sameWildlifeCell,validResourceVariantState,
      validWildlifeHerdState,checkpointWildlifeWalkable:()=>true,checkpointWildlifeTraverse:()=>true,
      assertSnapshot: (condition,message)=>{assert.ok(condition,message);} });
    vm.runInContext(source,context);
  }
  const node = createResourceNodeState(authored);
  for (const team of [null,0,1]) validate({...node,wildlifeTeam:team});
  for (const team of [undefined,2,-1,.5,'0',false]) {
    assert.throws(()=>validate({...node,wildlifeTeam:team}),/invalid resource/);
  }
  const ordinary = {...authored};delete ordinary.wildlifeSpecies;
  validate(createResourceNodeState(ordinary),ordinary);
  assert.throws(()=>validate({...createResourceNodeState(ordinary),wildlifeTeam:null},ordinary),/invalid resource/);
});
