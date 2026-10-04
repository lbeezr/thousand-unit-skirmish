import { economyClientBindings } from './economy-client-fixture.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { UnitLifecycleAudioGate, OrderAudioGate, workAudioEvents } from '../src/audio-policy.mjs';
import { createWaterStudyFishBinding } from '../src/water-study-fish-binding.mjs';
import { selectWaterStudyFish } from '../src/water-study-state.mjs';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { applyUnitStances } from '../src/combat-stance-ui.mjs';
import * as THREE from 'three';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { readWorkerPerformingAction } from '../src/worker-work-presentation.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const declaration = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`\nfunction ${next}(`));
const socketSource = source.slice(source.indexOf('function connectSocket('), source.indexOf("\nwindow.addEventListener('beforeunload'"));
const map = { id: 'forked-vale', fogOfWar: true, obstacles: [], triggers: [], scenarioEvents: [],
  spawnPoints: [{team: 0, x: -18, z: 0}, {team: 1, x: 18, z: 0}] };
const row = (id, team, generation = 1) => [id, team, team ? 18 : -18, 0, 100, 'worker', 0, null, generation, 'idle', 0];
function snapshot(team, { winner = -1, elapsed = 0, trained = false, generation = 1 } = {}) {
  return { type: 'state', tick: Math.round(elapsed * 10), mapId: map.id, armySize: 24, matchElapsedSeconds: elapsed, winner,
    winnerReason: winner < 0 ? null : 'elimination', fogOfWar: true, connected: 2,
    units: [...Array.from({ length: 12 }, (_, slot) => row(team * 12 + slot, team, generation)),
      ...(trained ? [row(24, team, generation)] : [])] };
}
function fixture(team) {
  const connections = [];
  const fishUpdates = [];
  const modeViews = [];
  const elements = new Map();
  const counts = [0, 0];
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, dataset: {}, classList: {toggle(){}}, setAttribute(){} });
    return elements.get(id);
  };
  class WebSocket {
    constructor() { this.events = new Map(); connections.push(this); }
    addEventListener(type, callback) { this.events.set(type, callback); }
    message(value) { this.events.get('message')({data: JSON.stringify(value)}); }
    closeEvent() { this.events.get('close')(); }
    close() {}
  }
  const noop = () => {};
  const context = vm.createContext({ ...economyClientBindings(), ...wildlifeClientBindings(), readWorkerPerformingAction, applyUnitStances, UNIT_DEFINITIONS,
    applyLobby() {}, updateLobbyHostControls() {}, roomLobby: { disconnect() {}, updateChat() {} },
    waterStudyFishBinding: { update(state, options) { fishUpdates.push({ state, options }); }, clear() {} },
    WebSocket, URL, performance: {now: () => 1000}, location: {protocol:'http:',host:'localhost'},
    document: {querySelector:element,querySelectorAll:() => []}, window: {clearTimeout:noop},
    sessionStorage: {getItem:() => null,setItem:noop,removeItem:noop},
    pageLeaving:false, localTeam:team, cameraSeatTeam:team, isHost:team === 0, socket:null,
    HAS_ROOM_PARAMETER:false, ROOM_SESSION_STORAGE_KEY:'session', waitingForResume:false,
    mapDefinition:map, currentArmySize:24, matchWinner:-1, matchWinnerReason:null,
    activeMatchMode: {}, knownMaps: [], matchModeView: { update(value) { modeViews.push(value); } },
    latestMatchElapsedSeconds:0, matchResult:element('result'), TEAM_NAMES:['Azure','Ember'],
    buildPlacementActive:false, buildPlacementPending:false, attackMoveMode:false, tapOrderArmed:false,
    persistentTargetMode:null,tapOrderPointer:null,selectedBuildingId:null,
    activeControlGroup:null,lastControlGroupRecall:null,buildingVisuals:new Map(),
    resourceNodeVisuals:new Map(),wildlifeRenderer:{reconcile(){},isAvailable:() => false,positionFor:() => null},
    units:[],teamUnits:[[],[]],selected:new Set(),controlGroups:[new Set()], MAX_UNITS:2000,MAX_PER_TEAM:1000,WORKERS_PER_TEAM:4,
    WORKER_TASK_STATES:new Set(['idle']),nextAttackFocusSlot:0,attackFocusDirty:false,selectionDirty:false,
    unitHealthBackground:{count:0},unitHealthFill:{count:0},
    attackFocusMesh:{count:0,instanceMatrix:{}}, arrowTraces:[],arrowImpacts:[],arrowMesh:{count:0},arrowImpactMesh:{count:0},
    lastFriendlyUnitClick:null,lastUnitPickState:null, currentOrderToken:null, orderStatusTimeout:null,reconnectDelayMs:500,
    ui:{total:element('total'),orderStatus:element('orders'),mapStudio:{open:false},
      playerTeam:element('player-team'),mapSelect:element('map-select'),mapStudioOpen:element('studio-open')},
    audio:{play:noop,playEvent:noop,stopWork:noop,updateWork:noop},combatAudioGate:{reset:noop,observe:noop},unitLifecycleAudioGate:new UnitLifecycleAudioGate(),orderAudioGate:new OrderAudioGate(),workAudioEvents,cameraTarget:{x:0,z:0},
    setUnitInstanceCount:(side,count) => {counts[side] = count;},
    setUnitTint:noop,updateUnitTransform:noop,updateUnitCargoCueColor:noop,
    markUnitInstanceMatricesDirty:noop,flushUnitCargoPackColor:noop,
    clearControlGroups(){ for (const group of context.controlGroups) group.clear(); },
    syncSelectionMesh:noop,updateSelectionUI:noop,updateCommandUI:noop,updateControlGroupUI:noop,updateBuildPlacementHint:noop,
    updateFogFromState:noop,applyForestState:noop,updateObjectives:noop,updateVictoryHoldCard:noop,
    updateScenarioEventCards(_events,elapsed){context.latestMatchElapsedSeconds = elapsed;},
    updateEconomyUI:noop,updateEnvironmentStateCaptureSnapshot:noop,revalidateControlGroups:noop,
    setConnection:noop,setMapCatalog:noop,loadMapAudio:noop,updateRoomUI:noop,showToast:noop,scheduleReconnect:noop,
    zoom:1.7,defaultCameraZoom:0.91,cameraMinZoom:0.1,mapFitActive:false,resize:noop,centerCameraOnHomeBase:noop,
  });
  vm.runInContext([
    wildlifeClientFunctionSource(source), declaration('clearActiveControlGroup','assignControlGroup'),
    declaration('syncMatchResultActions','updateMatchResult'),declaration('updateMatchResult','updateCommandUI'),
    declaration('setArmySize','updateSelectionUI'),declaration('appendUnitFromState','applyState'),
    declaration('applyState','updateEnvironmentStateCaptureSnapshot'),declaration('setPlayer','setMapCatalog'),socketSource,
    'setArmySize(24); connectSocket();',
  ].join('\n'),context);
  const connect = () => { vm.runInContext('connectSocket()',context); return connections.at(-1); };
  const welcome = (connection,state,definition = map) => connection.message({type:'welcome',map:definition,maps:[],state,
    player:{team,isHost:team === 0,resumed:true}});
  return {context,connections,connect,welcome,element,counts,fishUpdates,modeViews};
}

test('actual state/reconnect hooks preserve authoritative read-only mode identity and ignore rejected snapshots', () => {
  const f = fixture(0), identity = { matchModeId: 'skirmish', matchModeVersion: 1 };
  f.welcome(f.connections[0], { ...snapshot(0), ...identity });
  assert.equal(f.modeViews.at(-1).identity.matchModeId, 'skirmish');
  assert.equal(f.modeViews.at(-1).editable, false);
  f.welcome(f.connect(), { ...snapshot(0), ...identity });
  assert.equal(f.modeViews.at(-1).identity.matchModeVersion, 1);
  const count = f.modeViews.length;
  f.connections.at(-1).message({ ...snapshot(0), matchModeId: 'future', matchModeVersion: 99, rulesetRevision: 'future-rules' });
  f.connections.at(-1).message({ ...snapshot(0), mapId: 'different-map' });
  assert.equal(f.modeViews.length, count, 'rejected economy/map states cannot relabel the match');
  f.welcome(f.connect(), snapshot(0));
  assert.deepEqual(Object.keys(f.modeViews.at(-1).identity), [], 'legacy reconnect does not inherit a previous Skirmish selection');
  assert.equal(f.context.units[0].kind, 'worker');
});

function resourceFixture(team) {
  const f = fixture(team);
  const node = { id: 'formerly-depleted-sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep',
    stock: 100, x: -0.5, z: -0.5 };
  const definition = { ...map, width: 16, height: 16, resourceNodes: [node] };
  Object.assign(f.context, { mapDefinition: definition, BUILDING_DEFINITIONS,
    MAP_WIDTH: 16, MAP_HEIGHT: 16, MAP_HALF_X: 8, MAP_HALF_Z: 8,
    latestFogCells: new Uint8Array(256).fill(2),
    latestResourceStocks: new Map(), latestForestStocks: new Map(), latestForestEpoch: 7,
    forestTreeSlots: new Map(), setForestTreeVisual() {}, drawMinimap() {},
    resourceNodeVisuals: new Map(), wildlifeRenderer: { reconcile() {}, isAvailable: () => false },
    buildPlacementType: 'house', latestFood: [150, 150], latestWood: [250, 250], latestBuildings: [],
    buildingFootprint: type => BUILDING_DEFINITIONS[type].footprint,
    buildingWoodCost: type => BUILDING_DEFINITIONS[type].cost.wood,
    formatResourceRequirement: String, worldAt: () => ({ x: node.x, z: node.z }),
    selectedIds: () => [team * 12],
  });
  const rowsStart = source.indexOf('  if (Array.isArray(state.resourceNodes))', source.indexOf('function updateEconomyUI('));
  const rows = source.slice(rowsStart, source.indexOf('  if (ui.foodStock)', rowsStart));
  // Keep actual socket/applyState receipt ordering and actual stock/preview code;
  // omit unrelated economy DOM work and rendering objects from this fixture.
  vm.runInContext([
    source.slice(source.indexOf('function applyForestState('), source.indexOf('\nlet terrainSurface')),
    declaration('updateResourceNodeVisual', 'updateResourceNodeCallouts'),
    `function updateEconomyUI(state = {}) {\n${rows}\n}`,
    declaration('buildPlacementAt', 'updateBuildPlacementGhost'),
  ].join('\n'), f.context);
  const packet = (overrides = {}) => ({ ...snapshot(team, { elapsed: 100 }),
    forestEpoch: 7, forestStocks: [], resourceNodes: [{ ...node, stock: 0, wildlifeState: 'depleted',
      wildlifeTeam: null, wildlifeHeading: 0 }], ...overrides });
  f.connections[0].message(packet());
  assert.equal(f.context.latestResourceStocks.get(node.id), 0);
  assert.equal(f.context.buildPlacementAt(0, 0).valid, true);
  return { ...f, node, definition, packet };
}

function wildlifeFixture(team, t) {
  const f = fixture(team);
  const node = { id: 'recovery-sheep', type: 'food', wildlifeSpecies: 'bellweather-sheep',
    stock: 100, x: 2.5, z: -3.5 };
  const definition = { ...map, width: 16, height: 16, resourceNodes: [node] };
  const disclosed = { ...node, x: -4.5, z: 3.5, wildlifeState: 'alive', wildlifeTeam: team,
    wildlifeHeading: Math.PI / 2, wildlifeActivity: 'wandering' };
  const scene = new THREE.Scene();
  const wildlifeRenderer = createNeutralWildlifeRenderer({ THREE, scene, groundHeight: () => 0,
    loadArt: () => Promise.reject(new Error('explicit CPU fallback')) });
  wildlifeRenderer.reset(definition.resourceNodes, definition);
  t.after(() => wildlifeRenderer.dispose());
  function prepareMap(next) {
    Object.assign(f.context, { MAP_WIDTH: next.width, MAP_HEIGHT: next.height,
      MAP_HALF_X: next.width / 2, MAP_HALF_Z: next.height / 2,
      fogMesh: { visible: true }, latestFogCells: null,
      fogTexture: { image: { data: new Uint8Array(next.width * next.height * 4) } },
      minimapFogImage: { data: new Uint8Array(next.width * next.height * 4) } });
    wildlifeRenderer.reset(next.resourceNodes, next);
  }
  Object.assign(f.context, { mapDefinition: definition, atob, wildlifeRenderer,
    latestResourceStocks: new Map(), latestForestStocks: new Map(), latestForestEpoch: null,
    forestTreeSlots: new Map(), setForestTreeVisual() {}, drawMinimap() {},
    minimapFogContext: { putImageData() {} }, latestBuildings: [],
    cameraTarget: new THREE.Vector3(), buildMap: prepareMap,
  });
  prepareMap(definition);
  vm.runInContext([
    declaration('updateFogFromState', 'setForestTreeVisual'),
    source.slice(source.indexOf('function applyForestState('), source.indexOf('\nlet terrainSurface')),
  ].join('\n'), f.context);
  const visibility = (stateCode = 2, point = disclosed) => {
    const { MAP_WIDTH: width, MAP_HEIGHT: height } = f.context;
    const bytes = Buffer.alloc(Math.ceil(width * height / 4));
    const cell = Math.floor(point.z + height / 2) * width + Math.floor(point.x + width / 2);
    bytes[cell >> 2] |= stateCode << ((cell & 3) * 2);
    return { columns: width, rows: height, data: bytes.toString('base64') };
  };
  const packet = (overrides = {}) => ({ ...snapshot(f.context.localTeam, { elapsed: 100 }),
    mapId: f.context.mapDefinition.id, forestEpoch: 7, forestStocks: [],
    resourceNodes: [{ ...disclosed, wildlifeTeam: f.context.localTeam }], visibility: visibility(), ...overrides });
  f.connections[0].message(packet());
  const current = f.context.latestWildlifeView.rows.get(node.id);
  assert.deepEqual({ x: current.x, z: current.z }, { x: disclosed.x, z: disclosed.z });
  assert.equal(f.context.wildlifePointVisible(node), false, 'the authored cell supplies no sight');
  assert.equal(f.context.wildlifePointVisible(current), true, 'accepted current fog reveals the moved pose');
  f.context.selectWildlife(current);
  assert.equal(f.context.selectedWildlifeId, node.id);
  assert.equal(f.context.selected.size, 0, 'Sheep selection stays outside the unit Set');
  f.context.tapOrderArmed = true;
  f.context.tapOrderPointer = { id: 3 };
  return { ...f, node, definition, disclosed, packet, visibility };
}

function assertWildlifeCleared(f) {
  assert.equal(f.context.selectedWildlifeId, null);
  assert.equal(f.context.selectedWildlifeView, null);
  assert.equal(f.context.selectedWildlife(), null);
  assert.equal(f.context.tapOrderArmed, false);
  assert.equal(f.context.tapOrderPointer, null);
}

const wildlifeLosses = [
  ['unseen current cell', f => ({ visibility: f.visibility(0) })],
  ['explored current cell', f => ({ visibility: f.visibility(1) })],
  ['omitted row', () => ({ resourceNodes: [] })],
  ['missing resource table', () => ({ resourceNodes: undefined })],
  ['recaptured row', f => ({ resourceNodes: [{ ...f.disclosed, wildlifeTeam: 1 - f.context.localTeam }] })],
  ['neutral row', f => ({ resourceNodes: [{ ...f.disclosed, wildlifeTeam: null }] })],
  ['harvested carcass', f => ({ resourceNodes: [{ ...f.disclosed, stock: 40, wildlifeState: 'carcass', wildlifeActivity: undefined }] })],
  ['depleted food', f => ({ resourceNodes: [{ ...f.disclosed, stock: 0, wildlifeState: 'depleted', wildlifeActivity: undefined }] })],
  ['malformed pose', f => ({ resourceNodes: [{ ...f.disclosed, x: null }] })],
  ['resource epoch transition', () => ({ forestEpoch: 8, resourceNodes: [] })],
];

for (const team of [0, 1]) {
  for (const [reason, change] of wildlifeLosses) test(`seat ${team}: accepted ${reason} clears selected Sheep without revival`, t => {
    const f = wildlifeFixture(team, t), connection = f.connections[0];
    const patch = change(f);
    connection.message(f.packet(patch));
    assertWildlifeCleared(f);
    connection.message(f.packet({ forestEpoch: patch.forestEpoch ?? 7 }));
    assert.equal(f.context.latestWildlifeView.rows.has(f.node.id), true, 'later disclosure can make the Sheep eligible again');
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: hidden relocated rows cannot update remembered construction positions`, t => {
    const f = wildlifeFixture(team, t), connection = f.connections[0];
    const remembered = f.context.wildlifePositionMemory.positions.get(f.node.id);
    const hidden = { ...f.disclosed, x: 5.5, z: 5.5 };
    connection.message(f.packet({ resourceNodes: [hidden], visibility: f.visibility(1, hidden) }));
    assertWildlifeCleared(f);
    assert.deepEqual(f.context.wildlifePositionMemory.positions.get(f.node.id), remembered);
    assert.deepEqual({ x: f.context.constructionResourceNodes()[0].x, z: f.context.constructionResourceNodes()[0].z }, remembered);
    assert.equal(f.context.latestWildlifeView.rows.size, 0);
    connection.message(f.packet({ forestEpoch: 8, resourceNodes: [] }));
    assert.equal(f.context.wildlifePositionMemory.positions.size, 0, 'epoch reset discards the prior moved position');
  });

  for (const visible of [false, true]) test(`seat ${team}: same-epoch ${visible ? 'visible' : 'hidden'} welcome clears Sheep selection and old socket authority`, t => {
    const f = wildlifeFixture(team, t), old = f.connections[0], current = f.connect();
    f.welcome(current, f.packet({ resourceNodes: visible ? [f.disclosed] : [] }), f.definition);
    assert.equal(f.context.latestWildlifeView.resourceEpoch, 7, 'welcome can reuse a numeric epoch');
    assertWildlifeCleared(f);
    if (!visible) assert.equal(f.context.wildlifePositionMemory.positions.size, 0, 'hidden welcome clears old position knowledge');
    const view = f.context.latestWildlifeView;
    old.message(f.packet());
    assert.equal(f.context.latestWildlifeView, view, 'stale socket cannot restore any disclosure');
    current.message(f.packet());
    assert.equal(f.context.latestWildlifeView.rows.has(f.node.id), true);
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: actual map-change receipt clears Sheep focus and position knowledge`, t => {
    const f = wildlifeFixture(team, t), connection = f.connections[0];
    const next = { ...f.definition, id: `${map.id}-new` };
    connection.message({ type: 'mapChange', map: next, maps: [],
      state: f.packet({ mapId: next.id, resourceNodes: [] }) });
    assertWildlifeCleared(f);
    assert.equal(f.context.latestWildlifeView.mapId, next.id);
    assert.equal(f.context.wildlifePositionMemory.positions.size, 0);
    connection.message(f.packet());
    assert.equal(f.context.latestWildlifeView.rows.has(f.node.id), true);
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: same-size clock rewind clears Sheep focus without changing its numeric epoch`, t => {
    const f = wildlifeFixture(team, t), connection = f.connections[0];
    connection.message(f.packet({ matchElapsedSeconds: 0, tick: 0 }));
    assert.equal(f.context.latestWildlifeView.resourceEpoch, 7);
    assertWildlifeCleared(f);
    connection.message(f.packet());
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: welcome seat reassignment clears Sheep selection before new ownership disclosure`, t => {
    const f = wildlifeFixture(team, t), current = f.connect(), nextTeam = 1 - team;
    const state = { ...snapshot(nextTeam), forestEpoch: 7, forestStocks: [], visibility: f.visibility(),
      resourceNodes: [{ ...f.disclosed, wildlifeTeam: nextTeam }] };
    current.message({ type: 'welcome', map: f.definition, maps: [], state, player: { team: nextTeam, isHost: nextTeam === 0 } });
    assert.equal(f.context.localTeam, nextTeam);
    assert.equal(f.context.latestWildlifeView.team, nextTeam);
    assert.equal(f.context.latestWildlifeView.rows.get(f.node.id).wildlifeTeam, nextTeam);
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: spectator welcome and later seat return never restore selected Sheep`, t => {
    const f = wildlifeFixture(team, t), current = f.connect();
    current.message({ type: 'welcome', map: f.definition, maps: [], state: f.packet(),
      player: { team: null, isHost: false } });
    assert.equal(f.context.localTeam, null);
    assert.equal(f.context.latestWildlifeView.team, null);
    assertWildlifeCleared(f);
    f.welcome(current, { ...snapshot(team), forestEpoch: 7, forestStocks: [],
      resourceNodes: [f.disclosed], visibility: f.visibility() }, f.definition);
    assert.equal(f.context.localTeam, team);
    assert.equal(f.context.latestWildlifeView.rows.has(f.node.id), true);
    assertWildlifeCleared(f);
  });

  test(`seat ${team}: rejected rules/map packets preserve current Sheep selection and fog`, t => {
    const f = wildlifeFixture(team, t), connection = f.connections[0], view = f.context.latestWildlifeView;
    const fog = f.context.latestFogCells;
    for (const patch of [{ rulesetRevision: 'future-rules' }, { mapId: 'other-map' }]) {
      connection.message(f.packet({ ...patch, forestEpoch: 8, resourceNodes: [], visibility: f.visibility(0) }));
      assert.equal(f.context.selectedWildlifeId, f.node.id);
      assert.equal(f.context.latestWildlifeView, view);
      assert.equal(f.context.latestFogCells, fog);
    }
  });
}

for (const team of [0, 1]) {
  test(`seat ${team} hidden rematch resource restores construction exclusion on its reset epoch`, () => {
    const f = resourceFixture(team), connection = f.connections[0];
    connection.message(f.packet({ resourceNodes: [] }));
    assert.equal(f.context.buildPlacementAt(0, 0).valid, true, 'ordinary fog omissions retain disclosed depletion');
    connection.message(f.packet({ forestEpoch: 8, matchElapsedSeconds: 0, tick: 0, resourceNodes: [] }));
    assert.equal(f.context.latestResourceStocks.get(f.node.id), 100);
    assert.equal(f.context.buildPlacementAt(0, 0).blockedReason, 'RESOURCE IN THIS SITE');
    connection.message(f.packet({ forestEpoch: 8, matchElapsedSeconds: 1, tick: 10 }));
    assert.equal(f.context.buildPlacementAt(0, 0).valid, true, 'same-match disclosed depletion still releases the site');
  });

  test(`seat ${team} same-map welcome clears hidden resource depletion even when a fresh server reuses its epoch`, () => {
    const f = resourceFixture(team), current = f.connect();
    f.welcome(current, f.packet({ resourceNodes: [] }), f.definition);
    assert.equal(f.context.latestForestEpoch, 7, 'numeric epoch alone cannot identify a fresh server');
    assert.equal(f.context.latestResourceStocks.get(f.node.id), 100);
    assert.equal(f.context.buildPlacementAt(0, 0).blockedReason, 'RESOURCE IN THIS SITE');
    f.welcome(current, f.packet(), f.definition);
    assert.equal(f.context.buildPlacementAt(0, 0).valid, true, 'welcome applies currently disclosed stock after clearing knowledge');
  });
}

test('accepted state packets alone drive fish cues through recovery, omitted stocks and seat changes', () => {
  const f = fixture(0), old = f.connections[0];
  const packet = { ...snapshot(0), resourceNodes: [{ id: 'fish', stock: 1 }], visibility: { data: 'current-packet' } };
  old.message(packet);
  assert.deepEqual(JSON.parse(JSON.stringify(f.fishUpdates.at(-1))), { state: packet, options: { spectator: false } });
  const current = f.connect();
  f.welcome(current, { ...packet, resourceNodes: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(f.fishUpdates.at(-1).state.resourceNodes)), []);
  const count = f.fishUpdates.length;
  old.message(packet);
  assert.equal(f.fishUpdates.length, count, 'stale socket snapshots cannot restore stock activity');
  current.message(snapshot(0));
  assert.equal(f.fishUpdates.at(-1).state.resourceNodes, undefined, 'missing current nodes reach the binding for clearing');
  f.context.localTeam = null;
  current.message(packet);
  assert.equal(f.fishUpdates.at(-1).options.spectator, true);
});

test('a malformed packet clears fish activity before the existing fog parser can throw', () => {
  const f = fixture(0), connection = f.connections[0];
  const definition = { id: map.id, width: 8, height: 8, fogOfWar: true,
    obstacles: [{ column: 3, row: 1, width: 4, height: 6, material: 'water' }],
    resourceNodes: [{ id: 'fish', type: 'food', resourceVariant: 'shore-fish', x: -1.5, z: -.5, stock: 60 }] };
  let schools = [];
  f.context.waterStudyFishBinding = createWaterStudyFishBinding(definition, { userData: {
    updateWaterStudyFish(packet) { schools = selectWaterStudyFish(definition, packet); return schools; },
  } });
  const bytes = Buffer.alloc(16); bytes[6] = (2 << 4) | (2 << 6);
  const packet = { ...snapshot(0), resourceNodes: [{ id: 'fish', type: 'food', resourceVariant: 'shore-fish', stock: 1 }],
    visibility: { columns: 8, rows: 8, data: bytes.toString('base64') } };
  Object.assign(f.context, { atob, MAP_WIDTH: 8, MAP_HEIGHT: 8, fogMesh: { visible: true } });
  for (const resources of [[], [{ ...packet.resourceNodes[0], stock: 0 }]]) {
    f.context.updateFogFromState = () => {};
    connection.message(packet);
    assert.equal(schools.length, 1);
    vm.runInContext(declaration('updateFogFromState', 'setForestTreeVisual'), f.context);
    assert.throws(() => connection.message({ ...packet, resourceNodes: resources,
      visibility: { ...packet.visibility, data: '!' } }), /Invalid character/);
    assert.deepEqual(schools, [], 'legacy fog parse failure cannot retain a prior school');
  }
});

for (const team of [0,1]) for (const reconnect of [false,true]) {
  test(`seat ${team} removes prior production on ${reconnect ? 'reconnected' : 'connected'} rematch`, () => {
    const f = fixture(team);
    const old = f.connections[0];
    old.message(snapshot(team,{trained:true,elapsed:50}));
    f.context.selected.add(24);
    f.context.controlGroups[0].add(24);
    old.message(snapshot(team,{trained:true,elapsed:60,winner:team}));
    assert.equal(f.element('#match-result-title').textContent,'VICTORY');
    assert.equal(f.element('#match-play-again').hidden,team !== 0);
    const current = reconnect ? f.connect() : old;
    const fresh = snapshot(team,{generation:2});
    if (reconnect) f.welcome(current,fresh); else current.message(fresh);
    assert.equal(f.context.matchWinner,-1);
    assert.equal(f.context.matchResult.hidden,true);
    assert.equal(f.context.units[24],undefined,'prior-match trained unit must leave the client roster');
    assert.equal(f.context.teamUnits[team].length,12,'unit render slots must shrink to the opening roster');
    assert.equal(f.context.unitHealthBackground.count,24,'health render slots reset with the roster');
    assert.equal(f.context.unitHealthFill.count,24);
    assert.equal(f.counts[team],12);
    assert.equal(f.context.selected.has(24),false);
    assert.equal(f.context.controlGroups[0].has(24),false);
    // The same ID may be trained for the opposite side in the new match.
    current.message({...fresh,fogOfWar:false,units:[...fresh.units,row(24,1-team,3)]});
    assert.equal(f.context.units[24].team,1-team,'a reused ID must accept the new owner');
    if (reconnect) {
      old.message(snapshot(team,{trained:true,elapsed:60,winner:1-team}));
      f.welcome(old,snapshot(team,{winner:1-team,elapsed:60}));
      old.closeEvent();
      assert.equal(f.context.socket,current);
      assert.equal(f.context.matchWinner,-1,'old socket cannot restore a terminal result');
      assert.equal(f.context.localTeam,team);
      assert.equal(f.context.units[24].team,1-team);
    }
  });
}

test('ordinary same-match reconnect retains trained units and selection', () => {
  const f = fixture(0);
  f.connections[0].message(snapshot(0,{trained:true,elapsed:50}));
  f.context.selected.add(24);
  f.context.controlGroups[0].add(24);
  f.welcome(f.connect(),snapshot(0,{trained:true,elapsed:50}));
  assert.equal(f.context.units[24].team,0);
  assert.equal(f.context.selected.has(24),true);
  assert.equal(f.context.controlGroups[0].has(24),true);
});

for (const team of [0,1]) {
  test(`seat ${team} reconnect preserves terminal result until the authoritative rematch`, () => {
    const f = fixture(team);
    for (const winner of [team,1-team,2]) {
      f.welcome(f.connect(),snapshot(team,{winner,elapsed:60,trained:true}));
      assert.equal(f.context.matchWinner,winner);
      assert.equal(f.context.matchResult.hidden,false);
      assert.equal(f.element('#match-result-title').textContent,winner === 2 ? 'DRAW' : winner === team ? 'VICTORY' : 'DEFEAT');
      assert.equal(f.context.units[24].team,team);
    }
    const old = f.connections.at(-1);
    const current = f.connect();
    const newTeam = 1-team;
    current.message({type:'welcome',map,maps:[],state:snapshot(newTeam,{generation:2}),
      player:{team:newTeam,isHost:newTeam === 0}});
    assert.equal(f.context.localTeam,newTeam);
    assert.equal(f.element('#match-play-again').hidden,newTeam !== 0);
    f.welcome(old,snapshot(team,{winner:team,elapsed:60,trained:true}));
    old.closeEvent();
    assert.equal(f.context.localTeam,newTeam);
    assert.equal(f.context.socket,current);
    assert.equal(f.context.matchWinner,-1);
    assert.equal(f.context.units[24],undefined);
  });

  test(`seat ${team} reconnect after an unseen rematch rebuilds on clock rewind`, () => {
    const f = fixture(team);
    f.connections[0].message(snapshot(team,{trained:true,elapsed:50}));
    f.welcome(f.connect(),snapshot(team,{generation:2}));
    assert.equal(f.context.units[24],undefined);
    assert.equal(f.context.teamUnits[team].length,12);
  });
}

for (const team of [0, 1]) test(`seat ${team}: real tuple decoding preserves Stone cargo through cold welcome and ordinary updates`, () => {
  const f = fixture(team), definition = { ...map, economyProfileId: 'stone-defense-v1' };
  f.context.buildMap = () => {};
  // Exercise production append/apply functions; the cargo tuple layout is unchanged.
  const packet = { ...snapshot(team), economyProfileId: definition.economyProfileId,
    rulesetRevision: f.context.economyRulesetRevision(definition.economyProfileId), stone: team === 0 ? [7.25, null] : [null, 7.25] };
  packet.units[0][6] = 3.125; packet.units[0][7] = 'stone';
  f.welcome(f.connections[0], packet, definition);
  assert.equal(f.context.units[team * 12].cargo, 3.125);
  assert.equal(f.context.units[team * 12].cargoType, 'stone');
  const changed = structuredClone(packet); changed.units[0][6] = 4.25;
  f.connections[0].message(changed);
  assert.equal(f.context.units[team * 12].cargo, 4.25); assert.equal(f.context.units[team * 12].cargoType, 'stone');
  const food = structuredClone(changed); food.units[0][6] = 1; food.units[0][7] = 'food';
  f.connections[0].message(food);
  const unsupported = structuredClone(food); unsupported.units[0][6] = 3.125; unsupported.units[0][7] = 'gold';
  f.connections[0].message(unsupported);
  assert.equal(f.context.units[team * 12].cargoType, null, 'supplied unsupported cargo clears a previous food label');
  assert.equal(f.context.sumTypedCargo(f.context.units, definition.economyProfileId).food, 0);
  f.connections[0].message(changed);
  const mismatched = structuredClone(changed); mismatched.rulesetRevision = 'future-rules'; mismatched.units[0][6] = 10;
  f.connections[0].message(mismatched);
  assert.equal(f.context.units[team * 12].cargo, 4.25, 'mismatched snapshot cannot update typed cargo');
});
