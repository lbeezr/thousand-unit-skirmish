import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createMapStudioFormState } from '../../src/authoring/map-studio-form-state.mjs';
import { MAP_STUDIO_DRAFT_VERSION, createMapStudioDraftStore } from '../../src/authoring/map-studio-draft-store.mjs';
import { ScenarioEditHistory, createScenarioEditCoordinator } from '../../src/authoring/scenario-authoring.mjs';
import * as mapUtils from '../../src/map-utils.mjs';
import * as scenarioRegions from '../../src/scenario-regions.mjs';
import * as definitions from '../../src/gameplay-definitions.mjs';
import { economyResources } from '../../src/economy-profile.mjs';
import { validateMapAudioReference } from '../../src/world/map-audio-reference.mjs';
import { validateMapRegion } from '../../src/regions.mjs';
import { validWildlifeNodeDefinition } from '../../src/wildlife-state.mjs';
import { findInvalidResourceVariant } from '../../src/shore-fishing.mjs';
import { TERRAIN_MATERIALS } from '../../src/terrain-materials.mjs';

const source = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Production draft hook: ${start}`);
  return source.slice(a, b);
}

// Real host draft, map population/validation/import/export and dialog handlers.
// Only rendering/audio/subpanel synchronization and browser platform APIs are stubbed.
export function mapStudioDraftFixture(t, { roomId = null, saved = {} } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, timers = new Map(), downloads = [];
  let timerId = 0;
  w.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  w.clearTimeout = id => timers.delete(id);
  for (const [key, raw] of Object.entries(saved)) w.localStorage.setItem(key, raw);
  for (const [, name, selector] of source.matchAll(/^\s*(\w+): document\.querySelector\('([^']+)'\)/gm)) {
    (w.ui ??= {})[name] = d.querySelector(selector);
  }
  Object.assign(w, mapUtils, scenarioRegions, definitions, {
    createMapStudioFormState, MAP_STUDIO_DRAFT_VERSION, createMapStudioDraftStore,
    economyResources, validateMapAudioReference, validateMapRegion, validWildlifeNodeDefinition,
    findInvalidResourceVariant, TERRAIN_MATERIALS, ROOM_ID: roomId,
    SESSION_STORAGE_KEY: 'thousand-unit-skirmish-session', isHost: true, knownMaps: [],
    EDITOR_MATERIALS: ['stone', 'forest', 'water'], ELEVATION_EDITOR_TOOLS: new Set(),
    MAX_PER_TEAM: 1000, MAX_MAP_RESOURCE_NODES: 128, MAX_MAP_TRIGGERS: 32,
    MAX_MAP_SCENARIO_EVENTS: 32, MAX_SCENARIO_EVENT_REPEATS: 20,
    MIN_SCENARIO_EVENT_REPEAT_SECONDS: 5, MAX_OBJECTIVE_FOOD_REWARD: 10000, MAX_TRIGGER_UNIT_REWARD: 25,
    editorDraftSourceMapId: null, editorDraftStorageKey: null, editorDraftDirty: false, editorDraftWriteTimer: 0,
    editorDefinition: null, editorTool: 'stone', editorDrag: null, editorPanDrag: null,
    scenarioEditHistory: new ScenarioEditHistory(64), createScenarioEditCoordinator,
    selectedEditorRegionId: null, resourceBrushControls: null, redraws: 0,
    groundBaseMaterial: () => { throw new Error('Fixture maps must specify terrainBase'); },
    selectedStudioAudio: () => w.editorDefinition?.audio,
    drawEditorGrid: () => { w.redraws++; }, fitMapStudioViewport() {},
    syncEditorTriggerControls() {}, syncEditorScenarioEventControls() {}, syncEditorResourceControls() {},
    saveSelectedEditorTriggerFields() {}, saveSelectedEditorScenarioEventFields() {}, saveEditorTimedVictoryFields() {},
    saveEditorVictoryHoldFields() {}, saveSelectedEditorResourceStock: () => true,
    setEditorTool: tool => { w.editorTool = tool; }, refreshStudioAudioPacks: async () => {},
    Blob: globalThis.Blob,
  });
  w.mapDefinition = {
    id: 'draft-source', name: 'DRAFT SOURCE', width: 32, height: 32, terrainBase: 'meadow', terrainSeed: 93000,
    obstacles: [], spawnPoints: [{ team: 0, x: -10.5, z: 0.5 }, { team: 1, x: 10.5, z: 0.5 }],
    terrainPatches: [{ column: 13, row: 14, width: 2, height: 2, material: 'dirt' }],
    resourceNodes: [{ id: 'food', type: 'food', x: 0.5, z: 0.5, stock: 300 }],
    triggers: [], scenarioEvents: [], regions: [], fogOfWar: false, victoryMode: 'any',
  };
  w.ui.mapStudio.showModal = () => { w.ui.mapStudio.open = true; };
  w.ui.mapStudio.close = () => {
    w.ui.mapStudio.open = false; w.ui.mapStudio.dispatchEvent(new w.Event('close'));
  };
  w.ui.mapStudioOpen.disabled = false;
  w.URL.createObjectURL = blob => { downloads.push({ blob }); return 'blob:http://localhost/export'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads.at(-1).filename = this.download; };
  w.eval([
    between('const MAP_STUDIO_DRAFT_DEBOUNCE_MS', 'function getSelectedEditorTrigger('),
    between('function selectedEditorPrerequisiteIds(', 'function setEditorTriggerPrerequisites('),
    between('function scenarioEditorState(', 'let editorDraftSourceMapId'),
    between('function readEditorRegions(', 'function getSelectedEditorScenarioEvent('),
    between('function saveEditorStartingResourcesFields(', 'function syncEditorTriggerControls('),
    between('function populateMapEditor(', 'function isGroundEditorTool('),
    between('function compressEditorGround(', 'function showToast('),
    between('ui.mapStudioOpen.addEventListener(', "document.querySelector('#studio-import').addEventListener("),
    between("ui.mapStudio.addEventListener('close'", "window.addEventListener('resize'"),
    between("document.querySelector('#studio-scenario-undo').addEventListener(", 'for (const field of [ui.studioEventRegion,'),
    'window.draftStore = mapStudioDraftStore; window.lastDraftSavedAt = () => editorDraftLastSavedAt;',
  ].join('\n'));
  return { w, d, timers, downloads, copy,
    open() { w.ui.mapStudioOpen.click(); },
    click(id) { d.getElementById(id).click(); },
    edit(id, value) {
      const field = d.getElementById(id);
      if (field.type === 'checkbox') field.checked = value; else field.value = value;
      field.dispatchEvent(new w.Event('input', { bubbles: true }));
    },
    flush() {
      for (const [id, timer] of [...timers]) if (timer.delay === 160) { timers.delete(id); timer.callback(); }
    },
    saved() { return Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)])); },
    cancel() {
      if (w.ui.mapStudio.dispatchEvent(new w.Event('cancel', { cancelable: true }))) w.ui.mapStudio.close();
    },
  };
}
