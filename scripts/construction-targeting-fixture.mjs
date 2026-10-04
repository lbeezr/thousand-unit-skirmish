import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { browserRecoveryBindings } from './browser-recovery-fixture.mjs';
import { BUILDING_DEFINITIONS } from '../src/gameplay-definitions.mjs';

// Actual client picking, contextual resolution and command serialization, with
// a real Three ray/camera but no browser/GPU. sourcePath supports retained builds.
export function constructionTargetingFixture({ team = 0, units = [], selection = [], buildings = [],
  sourcePath = new URL('../src/main.js', import.meta.url) } = {}) {
  const source = readFileSync(sourcePath, 'utf8');
  const span = (from, to) => {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`Missing client span: ${from}`);
    return source.slice(start, end);
  };
  const payloads = [], toasts = [], selected = new Set(selection), buildingVisuals = new Map();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
  camera.position.set(0, 10, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const rect = { left: 10, top: 20, width: 400, height: 400 };
  const context = vm.createContext({ ...browserRecoveryBindings(), THREE, BUILDING_DEFINITIONS, localTeam: team, units, selected,
    latestBuildings: buildings, buildingVisuals, camera, pointerNdc: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(), groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    groundHit: new THREE.Vector3(), terrainSurface: null,
    renderer: { domElement: { getBoundingClientRect: () => rect } },
    selectedWildlifeId: null, selectedBuildingId: null, matchWinner: -1,
    attackMoveMode: false, persistentTargetMode: null, buildPlacementActive: false,
    selectedWaterUnits: () => false, pickAt: () => ({ unit: null }),
    pickResourceNodeAt: () => null, pickForestCellAt: () => null, pickHarvestableTreeAt: () => null,
    issueAttack: unit => payloads.push({ type: 'attack', targetId: unit.id }),
    issueAttackBuilding: building => payloads.push({ type: 'attackBuilding', buildingId: building.id }),
    issueGather: node => payloads.push({ type: 'gather', nodeId: node.id }),
    issueForestGather: cell => payloads.push({ type: 'gather', forestCell: cell }),
    issueMove: (point, queue) => payloads.push({ type: 'move', ...point, ...(queue ? { queue: true } : {}) }),
    buildingLabel: type => BUILDING_DEFINITIONS[type].label.toUpperCase(),
    TextEncoder, WebSocket: { OPEN: 1 },
    socket: { readyState: 1, send: text => payloads.push(JSON.parse(text)) },
    audio: { play() {}, playEvent() {} }, orderAudioGate: { sent() {} },
    beginOrderStatus: () => 700, finishOrderStatus() {}, showToast: text => toasts.push(text),
    cancelBuildPlacement() {}, setAttackMoveMode() {}, setTapOrderArmed() {}, updateCommandUI() {},
    cameraTarget: { set() {} }, setCamera() {}, drawMinimap() {}, performance,
  });
  vm.runInContext([
    span('function selectedIds(', '\nfunction issueStationaryOrder('),
    span('function sendTrackedOrder(', '\nfunction projectUnit('),
    span('function pickBuildingAt(', '\nfunction selectBuilding('),
    span('function worldAt(', '\nfunction '),
    span('function issueContextOrder(', '\nfunction buildPlacementAt('),
    span('function resumeConstruction(', '\nlet cursorPointer ='),
  ].join('\n'), context);
  function screenAt(x, z) {
    const point = new THREE.Vector3(x, 0, z).project(camera);
    return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2 };
  }
  for (const building of buildings) {
    const group = new THREE.Group(); group.position.set(building.x, 0, building.z);
    buildingVisuals.set(building.id, { group });
  }
  function clickAt(x, z, queue = false) {
    const point = screenAt(x, z);
    context.issueContextOrder(point.x + rect.left, point.y + rect.top, queue);
  }
  return { context, selected, payloads, toasts, buildingVisuals, screenAt, clickAt };
}
