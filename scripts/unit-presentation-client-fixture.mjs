// CPU fixture: actual client snapshot receipt and per-unit frame scheduling,
// shipped manifests and Three instanced UV/matrix buffers. No DOM/GPU/network claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { economyClientBindings } from './economy-client-fixture.mjs';
import { createUnitSpriteRuntime } from '../src/unit-sprite-runtime.mjs';
import { shouldUpdateUnitTransformForFrame } from '../src/unit-lod-state.mjs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function slice(startText, endText, from = 0) {
  const start = source.indexOf(startText, from);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= from && end > start, `Missing client fixture boundary: ${startText}`);
  return source.slice(start, end);
}
const snapshotSource = slice('function appendUnitFromState(', '\nfunction updateEnvironmentStateCaptureSnapshot(');
const poseConstants = ['ATTACK_POSE_MS', 'HIT_POSE_MS', 'SPAWN_POSE_MS', 'DEFEAT_POSE_MS', 'IDLE_POSE_INTERVAL_MS']
  .map(name => {
    const declaration = source.match(new RegExp(`^const ${name} = [^;]+;$`, 'm'));
    assert.ok(declaration, `Missing client pose constant ${name}`);
    return declaration[0];
  }).join('\n');
const frameSource = slice('  const alpha = 1 - Math.exp(-frameDelta * 16);',
  '\n  if (moved && selected.size)', source.indexOf('function animate('));
const roles = ['human', 'boughward-worker'];
const directories = ['cast-human-sprite-v3', 'boughward-worker-sprite-v1'];
const packs = roles.map((_, index) => JSON.parse(readFileSync(
  new URL(`../assets/units/${directories[index]}/sprite-atlas-pack-v1.json`, import.meta.url))));

export function workerSnapshotRow({ id = 0, team = 0, x = 0, z = 0, hp = 100,
  cargo = 0, cargoType = null, generation = 1, task = 'idle', attackTick = -1,
  attackX = null, attackZ = null, audioExecution = null, workHeading = null,
  workResourceVariant = null } = {}) {
  return [id, team, x, z, hp, 'worker', cargo, cargoType, generation, task, 0,
    attackTick, attackX, attackZ, audioExecution, workHeading, workResourceVariant];
}

export async function createUnitPresentationClientFixture({ localTeam = 0 } = {}) {
  const scene = new THREE.Scene();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const index = directories.findIndex(directory => String(url).includes(`/${directory}/`));
    assert.ok(index >= 0, `Unexpected fixture atlas request ${url}`);
    return { ok: true, json: async () => packs[index] };
  };
  class TextureLoader {
    load(_url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
  }
  let runtime;
  try {
    runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 4,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles,
      roleSpriteVersions: { human: 'v3' }, teamCivilizations: ['human', 'boughward'],
      approximateActionDirections: true });
  } finally { globalThis.fetch = originalFetch; }
  // Construction synchronously dispatches atlas requests. Release the temporary
  // fetch binding before yielding so concurrent fixtures preserve their caller's.
  runtime.setVisible(true);
  assert.equal(await runtime.ready, true);

  let clock = 1000;
  const transformCalls = [], dirtyTeams = [];
  const noop = () => {};
  const elements = new Map();
  const context = vm.createContext({ ...economyClientBindings(), THREE,
    mapDefinition: { id: 'unit-presentation-fixture' }, localTeam, isHost: false,
    document: { querySelector(id) {
      if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '' });
      return elements.get(id);
    } }, performance: { now: () => clock },
    units: [], teamUnits: [[], []], selected: new Set(), controlGroups: [new Set()],
    currentArmySize: 24, matchWinner: -1, latestMatchElapsedSeconds: 0,
    MAX_UNITS: 8, MAX_PER_TEAM: 4, nextAttackFocusSlot: 0,
    WORKER_TASK_STATES: new Set(['idle', 'moving', 'gathering', 'returning', 'building',
      'repairing', 'attacking', 'holding', 'patrolling', 'following']),
    attackFocusDirty: false, selectionDirty: false,
    attackFocusMesh: { count: 0, instanceMatrix: {} },
    unitHealthBackground: { count: 0 }, unitHealthFill: { count: 0 },
    cameraTarget: { x: 0, z: 0 }, ui: { total: { textContent: '' } },
    audio: { updateWork: noop, stopWork: noop, playEvent: noop },
    orderAudioGate: { reset: noop }, unitLifecycleAudioGate: { observe: () => [] },
    combatAudioGate: { reset: noop, observe: noop }, workAudioEvents: () => [],
    waterStudyFishBinding: null, addArrowTrace: noop,
    setUnitInstanceCount: (team, count) => runtime.setCount(team, count), setUnitTint: noop,
    updateUnitTransform(unit, now = clock) {
      // Delegate to the real default sprite runtime. Other presentation paths,
      // spawn/fade envelopes, cargo/HUD and GPU uploads are outside this fixture.
      transformCalls.push({ id: unit.id, now });
      runtime.update(unit, now, unit.visible === false ? 0 : 1);
    },
    markUnitInstanceMatricesDirty(team) { dirtyTeams.push(team); runtime.markTeamDirty(team); },
    updateUnitCargoCueColor: noop, flushUnitCargoPackColor: noop, applyWaypointQueueCounts: noop,
    updateFogFromState: noop, applyForestState: noop, updateObjectives: noop,
    updateVictoryHoldCard: noop, updateScenarioEventCards: noop, updateMatchResult: noop,
    updateRoomUI: noop, updateEconomyUI: noop, updateEnvironmentStateCaptureSnapshot: noop,
    revalidateControlGroups: noop, updateControlGroupUI: noop, syncSelectionMesh: noop,
    updateSelectionUI: noop, showToast: noop,
    unitSpriteRuntime: runtime, unitSpritePreviewActive: true,
    unitSpritePreviewRoleSet: new Set(['worker']), unitLowDetailActive: false, castPreview: true,
    lastIdlePoseStep: -1,
    shouldUpdateUnitTransformForFrame,
  });
  vm.runInContext(`${poseConstants}\n${snapshotSource}\nfunction animateUnitPresentation(now, frameDelta) {\n${frameSource}\n}`, context);

  const meshFor = unit => scene.children[roles.indexOf(runtime.roleForUnit(unit)) * 2 + unit.team];
  return { context, runtime, scene, transformCalls, dirtyTeams,
    apply(rows, { initial = false, now = clock, ...state } = {}) {
      clock = now;
      context.applyState({ mapId: 'unit-presentation-fixture', units: rows, ...state }, initial);
    },
    frame(now, seconds = (now - clock) / 1000) {
      clock = now;
      context.animateUnitPresentation(now, seconds);
    },
    unit: id => context.units[id],
    mesh: id => meshFor(context.units[id]),
    frameId(id) {
      const unit = context.units[id], index = roles.indexOf(runtime.roleForUnit(unit));
      const pack = packs[index], page = pack.pages[0];
      const uv = Array.from(meshFor(unit).geometry.getAttribute('instanceAtlasRect').array
        .subarray(unit.slot * 4, unit.slot * 4 + 4));
      const frame = pack.assets[0].frames.find(candidate => {
        const rect = candidate.frameRectsPx[0].rectPx, inset = page.sampling?.uvInsetPx ?? 0.5;
        const expected = [(rect.x + inset) / page.dimensionsPx.width,
          (rect.y + rect.height - inset) / page.dimensionsPx.height,
          (rect.x + rect.width - inset) / page.dimensionsPx.width,
          (rect.y + inset) / page.dimensionsPx.height];
        return uv.every((value, axis) => Math.abs(value - expected[axis]) < 1e-7);
      });
      assert.ok(frame, `Unbound real UV rectangle for unit ${id}`);
      return frame.id;
    },
    hidden(id) {
      const unit = context.units[id], matrix = new THREE.Matrix4();
      meshFor(unit).getMatrixAt(unit.slot, matrix);
      return matrix.elements[0] === 0 && matrix.elements[5] === 0;
    },
    clearObservations() { transformCalls.length = 0; dirtyTeams.length = 0; },
    dispose() {
      for (const mesh of scene.children) { mesh.geometry.dispose(); mesh.material.dispose(); }
    },
  };
}
