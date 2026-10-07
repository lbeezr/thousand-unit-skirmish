import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { BUILDING_DEFINITIONS, UNIT_DEFINITIONS, TECHNOLOGY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import * as selection from '../src/unit-selection.mjs';
import * as economyProfile from '../src/economy-profile.mjs';
import * as economyClient from '../src/economy-client.mjs';
import { farmHarvestNode } from '../src/farm-harvest.mjs';
import { isShoreFish } from '../src/shore-fishing.mjs';
import { applyUnitStances } from '../src/combat-stance-ui.mjs';
import { rememberNotice } from '../src/objective-summary.mjs';
import { classifyOrderNotice } from '../src/order-feedback.mjs';
import * as audioPolicy from '../src/audio-policy.mjs';
import { formatResourceStock } from '../src/resource-format.mjs';
import { readWorkerPerformingAction } from '../src/worker-work-presentation.mjs';
import { createNeutralWildlifeRenderer } from '../src/neutral-wildlife-renderer.mjs';
import { wildlifeClientBindings, wildlifeClientFunctionSource } from './wildlife-client-fixture-bindings.mjs';
import { clearOwnedBuildingFog } from '../src/building-fog-composition.mjs';
import { selectionContext } from '../src/selection-context.mjs';
import { fixedMatchArmySize } from '../src/match-mode-controls.mjs';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';
import { renderMatchRecap } from '../src/client/hud/match-recap.mjs';
import { createWelcomeSession } from '../src/client/networking/welcome-session.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
export const controlsMap = {
  id: 'wildlife-client-controls', name: 'WILDLIFE CLIENT CONTROLS', width: 64, height: 64,
  fogOfWar: true, startingArmySize: 4,
  spawnPoints: [{team:0,x:-18.5,z:-18.5},{team:1,x:18.5,z:-18.5}],
  obstacles: [{column:34,row:38,width:1,height:1,material:'stone'},
    {column:37,row:38,width:1,height:1,material:'water'}], triggers: [], scenarioEvents: [],
  resourceNodes: [{id:'sheep-0',type:'food',stock:100,x:-4.5,z:3.5,wildlifeSpecies:'bellweather-sheep'},
    {id:'sheep-1',type:'food',stock:100,x:4.5,z:3.5,wildlifeSpecies:'bellweather-sheep'},
    {id:'sheep-neutral',type:'food',stock:100,x:.5,z:10.5,wildlifeSpecies:'bellweather-sheep'},
    {id:'berries',type:'food',stock:100,x:.5,z:-1.5}],
};
export const controlsUnits = [[0,0,-12.5,-10.5,100,'worker',0,null,11,'idle'],
  [1,0,-9.5,-10.5,100,'infantry',0,null,12,'idle'],
  [2,1,12.5,-10.5,100,'worker',0,null,13,'idle'],
  [3,1,9.5,-10.5,100,'infantry',0,null,14,'idle']];

export function visibilityFor(map, hidden = []) {
  const data = Buffer.alloc(Math.ceil(map.width * map.height / 4), 0xaa);
  for (const point of hidden) {
    const cell = Math.floor(point.z + map.height / 2) * map.width + Math.floor(point.x + map.width / 2);
    data[cell >> 2] &= ~(3 << ((cell & 3) * 2));
  }
  return {columns:map.width,rows:map.height,data:data.toString('base64')};
}
export function controlsState(map = controlsMap, changes = {}) {
  return {type:'state',mapId:map.id,armySize:4,tick:30,matchElapsedSeconds:1,winner:-1,
    fogOfWar:true,forestEpoch:7,forestStocks:[],units:structuredClone(controlsUnits),
    resourceNodes:map.resourceNodes.map(node=>node.wildlifeSpecies === undefined ? {...node} : {
      id:node.id,type:node.type,stock:node.stock,x:node.x,z:node.z,wildlifeSpecies:node.wildlifeSpecies,
      wildlifeState:'alive',wildlifeTeam:node.id==='sheep-0'?0:node.id==='sheep-1'?1:null,
      wildlifeHeading:0,wildlifeActivity:'grazing',
    }),visibility:visibilityFor(map),...changes};
}

function callPath(node) {
  if (node?.type === 'ChainExpression') return callPath(node.expression);
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'MemberExpression' && !node.computed) return `${callPath(node.object)}.${node.property.name}`;
  return '';
}

// A CPU/DOM input fixture, not a GPU/browser appearance claim. Actual production
// source owns disclosure, picking, selection, endpoint validation, wire payloads,
// socket receipt and feedback. Only rendering/audio/layout effects are bounded.
export async function wildlifeControlsFixture(team = 0, options = {}) {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const program = parse(source,{ecmaVersion:'latest',sourceType:'module'}).body;
  const functions = new Map(program.filter(node=>node.type==='FunctionDeclaration').map(node=>[node.id.name,node]));
  const declaration = name => {
    const node = functions.get(name);assert.ok(node,`production function ${name}`);
    return source.slice(node.start,node.end);
  };
  const dom = new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/game'});
  const w = dom.window, sent = [], notices = [], captures = new Set(), errors = [], connections = [];
  w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
  const map = structuredClone(options.map || controlsMap), packet = options.state || controlsState(map);
  const canvas = w.document.createElement('canvas');canvas.tabIndex=0;
  w.document.querySelector('#viewport').append(canvas);
  const rect = {left:40,top:20,width:800,height:800,right:840,bottom:820};
  canvas.getBoundingClientRect=()=>rect;
  for (const element of [canvas,w.document.querySelector('#minimap-canvas')]) {
    element.setPointerCapture=id=>captures.add(id);
    element.hasPointerCapture=id=>captures.has(id);
    element.releasePointerCapture=id=>captures.delete(id);
  }
  const minimap = w.document.querySelector('#minimap-canvas');minimap.width=minimap.height=384;
  minimap.getBoundingClientRect=()=>({left:900,top:20,width:192,height:192,right:1092,bottom:212});
  const size = Math.max(map.width,map.height);
  const camera = new THREE.OrthographicCamera(-size/2,size/2,size/2,-size/2,.1,1000);
  camera.position.set(0,200,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const scene = new THREE.Scene(), noop=()=>{};
  class WireSocket {
    static OPEN=1;
    constructor() {this.readyState=1;this.events=new Map();connections.push(this);}
    addEventListener(type,callback) {const list=this.events.get(type)||[];list.push(callback);this.events.set(type,list);}
    send(text) {const value=JSON.parse(text);sent.push(value);options.onSend?.(value);}
    message(value) {for(const callback of this.events.get('message')||[]) callback({data:JSON.stringify(value)});}
    close() {this.readyState=3;}
  }
  const query = selector => w.document.querySelector(selector);
  Object.assign(w, {...browserRecoveryBindings(),...selection,...economyProfile,...economyClient,...audioPolicy,...wildlifeClientBindings(),
    clearOwnedBuildingFog,selectionContext,castPreview:false,updateBuildingLifecycleActions:noop,updateCombatStanceUI:noop,
    updateSelectionPortrait:noop,updateProductionPortrait:noop,updateRosterProductionOptions:noop,
    updateResearchOptions:noop,commandFocusTarget:()=>canvas,
    THREE,UNIT_DEFINITIONS,BUILDING_DEFINITIONS,TECHNOLOGY_DEFINITIONS,farmHarvestNode,isShoreFish,applyUnitStances,fixedMatchArmySize,
    rememberNotice,classifyOrderNotice,formatResourceStock,readWorkerPerformingAction,renderMatchRecap,matchDecisions:{update(){}},TextEncoder,WebSocket:WireSocket,
    mapDefinition:map,MAP_WIDTH:map.width,MAP_HEIGHT:map.height,MAP_HALF_X:map.width/2,MAP_HALF_Z:map.height/2,
    localTeam:team,cameraSeatTeam:team,isHost:false,matchWinner:-1,matchWinnerReason:null,
    activeMatchMode:{},soloPracticeActive:false,knownMaps:[],matchModeView:{update:noop},
    currentArmySize:packet.armySize,latestMatchElapsedSeconds:0,latestForestEpoch:null,
    latestForestStocks:new Map(),latestResourceStocks:new Map(),latestStone:[0,0],
    selected:new Set(),selectedBuildingId:null,selectedWildlifeId:null,units:[],teamUnits:[[],[]],
    controlGroups:Array.from({length:10},()=>new Set()),activeControlGroup:null,lastControlGroupRecall:null,
    buildingVisuals:new Map(),resourceNodeVisuals:new Map(),latestBuildings:[],
    renderer:{domElement:canvas},scene,camera,groundHeight:()=>0,baseFrustum:size,
    screenPoint:new THREE.Vector3(),pointerNdc:new THREE.Vector2(),raycaster:new THREE.Raycaster(),
    groundPlane:new THREE.Plane(new THREE.Vector3(0,1,0),0),groundHit:new THREE.Vector3(),terrainSurface:null,
    selectionMesh:new THREE.InstancedMesh(new THREE.RingGeometry(.45,.5,12),new THREE.MeshBasicMaterial(),5000),
    dummy:new THREE.Object3D(),ringRotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),
    selectionDirty:false,lastFriendlyUnitClick:null,lastUnitPickState:null,
    buildPlacementActive:false,buildPlacementType:'house',buildPlacementPending:false,pendingBuildOrderToken:null,
    pendingWallPreview:null,attackMoveMode:false,persistentTargetMode:null,tapOrderArmed:false,tapOrderPointer:null,
    spaceDown:false,spaceCenterPending:false,movedPointer:false,pan:null,drag:null,cursorPointer:null,cursorShift:false,lastCursorSample:0,
    wallPlacementGesture:{owner:null},selectionBox:query('#selection-box'),viewport:query('#viewport'),
    appShell:query('.app-shell'),matchMenu:query('#match-menu'),helpPanel:query('#help-panel'),
    scenarioBriefPanel:query('#scenario-brief-panel'),matchResult:query('#match-result'),
    commandDock:query('.control-dock'),TEAM_NAMES:['Azure','Ember'],
    minimapCanvas:minimap,minimapPointerId:null,zoom:1,mapFitActive:false,cameraTarget:new THREE.Vector3(),
    moveMarker:new THREE.Mesh(new THREE.RingGeometry(.4,.5,12),new THREE.MeshBasicMaterial()),moveMarkerAge:0,
    forestTreeSlots:new Map(),forestStumpSlots:new Map(),waterStudyFishBinding:null,
    fogMesh:{visible:true},fogTexture:{image:{data:new Uint8Array(map.width*map.height*4)}},
    minimapFogImage:{data:new Uint8Array(map.width*map.height*4)},minimapFogContext:{putImageData:noop},latestFogCells:null,
    MAX_UNITS:5000,MAX_PER_TEAM:2500,WORKERS_PER_TEAM:4,WORKER_TASK_STATES:new Set(['idle','travelling','gathering','returning','building','repairing']),
    nextAttackFocusSlot:0,attackFocusDirty:false,attackFocusMesh:{count:0,instanceMatrix:{}},
    unitHealthBackground:{count:0},unitHealthFill:{count:0},
    orderAudioGate:new audioPolicy.OrderAudioGate(),unitLifecycleAudioGate:new audioPolicy.UnitLifecycleAudioGate(),
    combatAudioGate:new audioPolicy.CombatAudioGate(),audio:{play:noop,playEvent:noop,updateWork:noop,stopWork:noop},
    nextClientOrderToken:1,currentOrderToken:null,orderStatusTimeout:null,fieldOrderFeedbackTimer:null,
    noticeHistory:[],toast:query('.toast'),toastTimer:null,
    pageLeaving:false,HAS_ROOM_PARAMETER:false,ROOM_SESSION_STORAGE_KEY:'fixture-session',
    ROOM_INSTANCE_STORAGE_KEY:'fixture-instance',ROOM_MATCH_STORAGE_KEY:'fixture-match',waitingForResume:false,
    reconnectDelayMs:500,defaultCameraZoom:1,cameraMinZoom:.1,
    setConnection:noop,applyLobby:noop,updateLobbyHostControls:noop,roomLobby:{updateChat:noop,disconnect:noop},
    setMapCatalog:noop,loadMapAudio:noop,updateRoomUI:noop,scheduleReconnect:noop,resize:noop,centerCameraOnHomeBase:noop,
    setCamera:noop,drawMinimap:noop,updateContextualCommands:noop,updateBuildingResearchControls:noop,
    updateBuildPlacementHint:noop,syncBattlefieldCursor:noop,updateEconomyUI:noop,updateEnvironmentStateCaptureSnapshot:noop,
    updateObjectives:noop,updateVictoryHoldCard:noop,
    updateScenarioEventCards(_events,elapsed) {if(Number.isFinite(elapsed))w.latestMatchElapsedSeconds=elapsed;},
    setUnitInstanceCount:noop,setUnitTint:noop,updateUnitTransform:noop,updateUnitCargoCueColor:noop,
    markUnitInstanceMatricesDirty:noop,flushUnitCargoPackColor:noop,setForestTreeVisual:noop,
    updateBuildingSelectionVisual:noop,reconcileBuildings(rows) {w.latestBuildings=rows;return 0;},
    buildingFootprint:type=>BUILDING_DEFINITIONS[type].footprint,
    // This fixture has no environment tree meshes; real instance picking has
    // its own Three geometry contract in environment-instance-picking.
    pickHarvestableTreeAt:()=>null,
    cancelBuildPlacement() {w.buildPlacementActive=w.buildPlacementPending=false;},
    setArmySize() {throw new Error('This input fixture does not simulate army replacement; use the recovery fixture.');},
  });
  w.welcomeSession = createWelcomeSession({ getStorage: () => w.sessionStorage,
    sessionKey: w.ROOM_SESSION_STORAGE_KEY, instanceKey: w.ROOM_INSTANCE_STORAGE_KEY, matchKey: w.ROOM_MATCH_STORAGE_KEY });
  w.matchMedia=()=>({matches:false});
  Object.defineProperty(w.document,'visibilityState',{value:'visible',configurable:true});
  w.matchMenu.hidden=w.helpPanel.hidden=w.scenarioBriefPanel.hidden=true;
  const uiNode=program.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(n=>n.id.name==='ui');
  assert.ok(uiNode?.init, 'production UI element bindings');
  w.eval(`window.ui = ${source.slice(uiNode.init.start,uiNode.init.end)};`);
  const wildlifeRenderer=createNeutralWildlifeRenderer({THREE,scene,groundHeight:()=>0,loadArt:()=>Promise.reject(new Error('CPU fixture'))});
  wildlifeRenderer.reset(map.resourceNodes,map);await wildlifeRenderer.ready();w.wildlifeRenderer=wildlifeRenderer;
  const names=['selectedIds','selectedWorkerIds','selectedWaterUnits','projectUnit','pickAt','pickResourceNodeAt','pickForestCellAt',
    'pickBuildingAt','selectBuilding','pickFriendly','selectInRect','worldAt','mapCellToWorld','getBuildingQueueLength','buildingLabel',
    'buildingSupportsRally','buildingSupportsResearch','clearActiveControlGroup','revalidateControlGroups','clearControlGroups','controlGroupKeyLabel',
    'assignControlGroup','recallControlGroup','centerCameraOnControlGroup','syncSelectionMesh',
    'updateStationaryOrderControls','updateContextualCommands','updateSelectionUI','updateCommandUI','syncTargetOrderUI',
    'issueStationaryOrder','issueReturnCargo','setPersistentTargetMode','setAttackMoveMode','setTapOrderArmed',
    'issueMove','issueBuildingRallyPoint','issueAttack','issueAttackBuilding','issueGather','issueForestGather','issueContextOrder',
    'minimapMapRect','worldFromMinimap','focusCameraFromMinimap','canIssueMinimapMove','finishMinimapPointer','finishPointer','captureBattlefieldPointer',
    'selectWholeTeam','selectFriendlyUnitKinds','selectFriendlyUnitKind','selectWorkers','selectIdleWorkers',
    'keyboardTargetIsEditing','controlGroupIndexFromKey','selectionCenterShortcutAllowed',
    'showToast','setOrderStatus','armOrderStatusTimeout','beginOrderStatus','finishOrderStatus','applyOrderNotice','sendTrackedOrder','sendCommand',
    'appendUnitFromState','applyState','applyWaypointQueueCounts','updateFogFromState','applyForestState',
    'syncMatchResultActions','updateMatchResult','formatVictoryHoldTime','updateMatchArmySizeControls','setPlayer','connectSocket'];
  // Control-group painting is a layout side effect; group contents are changed
  // only by production assign/recall/revalidation bodies above.
  w.pickHarvestableTreeAt=()=>null; // This Sheep fixture has no rendered tree crowns.
  w.updateControlGroupUI=noop;w.cameraNavigationKeydown=()=>false;w.wallPlacementKeydown=()=>false;
  w.eval([wildlifeClientFunctionSource(source),...names.map(declaration)].join('\n'));
  const listeners=program.filter(node=>{
    if(node.type==='ForOfStatement') return source.slice(node.start,node.end).includes("querySelectorAll('[data-stationary-order]')");
    if(node.type!=='ExpressionStatement')return false;
    const call=node.expression.type==='ChainExpression'?node.expression.expression:node.expression;
    if(call.type!=='CallExpression')return false;
    const target=callPath(call.callee),event=call.arguments[0]?.value,text=source.slice(node.start,node.end);
    return (target==='renderer.domElement.addEventListener' && ['contextmenu','pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'].includes(event))
      || (target==='minimapCanvas.addEventListener' && ['contextmenu','pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'].includes(event))
      || (target==='window.addEventListener' && event==='keydown' && text.includes('controlGroupIndexFromKey(event)'))
      || (target==='ui.orderTargetToggle.addEventListener' && event==='click')
      || (event==='click' && text.includes('[data-harvest-wildlife]'));
  });
  assert.ok(listeners.length>=10,'production battlefield, minimap, keyboard and button handlers');
  w.eval(listeners.map(node=>source.slice(node.start,node.end)).join('\n'));
  w.connectSocket();
  w.applyState(packet,true);wildlifeRenderer.update(camera);
  const identify = state => ({ ...state, tick: Number.isSafeInteger(state.tick) ? state.tick : 0,
    serverInstanceId: state.serverInstanceId ?? packet.serverInstanceId ?? 'fixture-server',
    matchId: state.matchId ?? packet.matchId ?? 'fixture-match' });
  w.browserStateRecovery.reset(identify(packet), w.performance.now());
  w.browserStateRecovery.pending = null;
  w.browserStateRecovery.snap = false;
  const checkErrors=()=>{if(errors.length)throw errors.shift();};checkErrors();
  const screen=point=>{
    const p=new THREE.Vector3(point.x,.22,point.z).project(camera);
    return {x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height};
  };
  function pointer(element,type,{x,y,button=0,id=1,shiftKey=false,pointerType='mouse'}={}) {
    const event=new w.MouseEvent(type,{clientX:x,clientY:y,button,shiftKey,bubbles:true,cancelable:true});
    Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:pointerType}});
    element.dispatchEvent(event);checkErrors();return event;
  }
  // This input fixture samples a visible presentation frame per receipt. Real
  // suspension timing is covered by browser-state-recovery and cloud captures.
  let presentationTime = w.performance.now();
  const receive=value=>{
    if (value.type === 'state' || value.type === 'stateRefresh') value = identify(value);
    if (value.state) value = { ...value, state: identify(value.state) };
    connections.at(-1).message(value);
    const update = w.browserStateRecovery.frame(presentationTime += 16);
    if (update) w.applyState(update.state, false, update.snap);
    const counts = w.browserStateRecovery.takeWaypointCounts();
    if (counts !== null) w.applyWaypointQueueCounts(counts);
    wildlifeRenderer.update(camera);checkErrors();
  };
  return {w,dom,canvas,minimap,sent,notices,connections,map,packet,screen,pointer,receive,
    click(point,extra={}) {const p=screen(point);pointer(canvas,'pointerdown',{...p,...extra});pointer(canvas,'pointerup',{...p,...extra});},
    right(point,extra={}) {return pointer(canvas,'pointerdown',{...screen(point),button:2,...extra});},
    key(key,extra={}) {const event=new w.KeyboardEvent('keydown',{key,code:extra.code||key,bubbles:true,cancelable:true,...extra});w.dispatchEvent(event);checkErrors();return event;},
    mini(point,extra={}) {const r=w.minimapMapRect(minimap.width,minimap.height);return pointer(minimap,'pointerdown',{
      x:900+(r.left+(point.x+w.MAP_HALF_X)*r.scale)/2,y:20+(r.top+(point.z+w.MAP_HALF_Z)*r.scale)/2,button:2,...extra});},
    welcome(state=packet,definition=map,seat=team) {receive({type:'welcome',map:definition,maps:[],state,player:{team:seat,isHost:seat===0,resumed:true}});},
    async close() {wildlifeRenderer.dispose();w.selectionMesh.geometry.dispose();w.selectionMesh.material.dispose();
      w.moveMarker.geometry.dispose();w.moveMarker.material.dispose();dom.window.close();},
    assumptions:['JSDOM CPU input/Three geometry; no GPU pixels','map building/army replacement and unrelated contextual layout use separate fixtures'],
  };
}
