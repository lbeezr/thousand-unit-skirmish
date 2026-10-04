import { economyClientBindings } from './economy-client-fixture.mjs';
// Runs real client selection, placement, resume and serialization functions.
// Rendering/picking are supplied by the fixture; the emitted payload is real.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { formatResourceRequirement } from '../src/resource-format.mjs';
import { buildingCanRotate, turnBuildingOrientation } from '../src/building-orientation.mjs';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const span=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to));
export function constructionClientFixture({team=0,units,selection=[],buildings=[]}={}) {
  const payloads=[],toasts=[],selected=new Set(selection);let token=0;
  const context=vm.createContext({ ...economyClientBindings(),units,selected,localTeam:team,selectedBuildingId:null,
    teamUnits:[0,1].map(t=>units.filter(u=>u?.team===t)),latestBuildings:buildings,
    latestFood:[1000,1000],latestWood:[1000,1000],BUILDING_DEFINITIONS,formatResourceRequirement,
    matchWinner:-1,tapOrderArmed:false,attackMoveMode:false,persistentTargetMode:null,
    buildPlacementType:'house',buildPlacementOrientation:0,buildPlacementActive:false,buildPlacementPending:false,
    pendingBuildingPlacement:null,lastBuildingPlacementPointer:null,cursorPointer:null,
    buildingCanRotate,turnBuildingOrientation,updateBuildPlacementGhost(){},
    pendingBuildOrderToken:null,pendingBuildBaseline:new Set(),selectionDirty:false,
    placementGhost:{visible:false},buildingLabel:type=>BUILDING_DEFINITIONS[type].label.toUpperCase(),
    buildingWoodCost:type=>BUILDING_DEFINITIONS[type].cost.wood,
    window:{matchMedia:()=>({matches:false})},TextEncoder,WebSocket:{OPEN:1},
    renderer:{domElement:{focus(){}}},resetWallPlacement(){},wallPlacementGesture:{},
    cursorShift:false,pendingWallPreview:null,
    wallPlacementAt:()=>({valid:true,points:[{column:1,row:1}],axisOrder:'column-first'}),
    socket:{readyState:1,send:text=>payloads.push(JSON.parse(text))},
    audio:{play(){},playEvent(){}},orderAudioGate:{sent(){}},beginOrderStatus:()=>++token,finishOrderStatus(){},
    showToast:text=>toasts.push(text),buildPlacementAt:()=>({valid:true,x:-16.5,z:10.5}),
    wallPointerCell:()=>({column:1,row:1}),
    clearActiveControlGroup(){},syncSelectionMesh(){},updateSelectionUI(){},updateCommandUI(){},
    updateEconomyUI(){},updateBuildPlacementHint(){},cancelBuildPlacement(){},setTapOrderArmed(){},
    setAttackMoveMode(){},cameraTarget:{set(){}},setCamera(){},drawMinimap(){},performance,
  });
  vm.runInContext([
    span('function selectedIds(', '\nfunction issueStationaryOrder('),
    span('function sendTrackedOrder(', '\nfunction projectUnit('),
    span('function cancelBuildPlacement(', '\nfunction queueWorker('),
    span('function rotateBuildPlacement(', '\nmountBuildingRotationControls('),
    span('function resumeConstruction(', '\nlet cursorPointer ='),
  ].join('\n'),context);
  return {context,selected,payloads,toasts};
}
