import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { activeState, civilizationSpriteRole, createUnitSpriteRuntime, normalizedDirection,
  spriteActionClip, spriteActionProvenance, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';

const directories = { human: 'cast-human-sprite-v3', infantry: 'infantry-sprite-v3',
  spearman: 'spearman-sprite-v1', archer: 'archer-sprite-v2', scout: 'scout-sprite-v1',
  rider: 'rider-sprite-v1', 'siege-engine': 'siege-engine-sprite-v1',
  ...Object.fromEntries(['worker', 'infantry', 'spearman', 'archer', 'scout', 'rider', 'siege-engine']
    .map(kind => [`boughward-${kind}`, `boughward-${kind}-sprite-v1`])) };
const packs = Object.fromEntries(Object.entries(directories).map(([role, directory]) =>
  [role, JSON.parse(readFileSync(new URL(`../assets/units/${directory}/sprite-atlas-pack-v1.json`, import.meta.url)))]));
const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

async function withRuntime(run, role = null, version = null) {
  const savedFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    return { ok: true, json: async () => JSON.parse(readFileSync(new URL(`..${url}`, import.meta.url))) };
  };
  class TextureLoader {
    load(url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
  }
  try {
    const scene = new THREE.Scene();
    const roles = role ? [role] : Object.keys(directories);
    const runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
      teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles,
      roleSpriteVersions: { human: 'v3', infantry: 'v3', archer: 'v2', ...(version ? { [role]: version } : {}) },
      teamCivilizations: role ? null : ['human', 'boughward'], humanAppearancePreview: role === 'human',
      approximateActionDirections: true });
    runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
    assert.equal(await runtime.ready, true);
    await run(runtime, scene, urls);
  } finally { globalThis.fetch = savedFetch; }
}

function actor(team = 0, kind = 'worker') {
  return { id: team, team, slot: 0, kind, hp: 100, task: 'idle', angle: 3 * Math.PI / 4,
    renderX: 0, renderZ: 0, walking: false, attackStartedAt: 0, defeatStartedAt: 0,
    cargo: 0, cargoType: null, workResourceVariant: null, performingAction: null };
}

function assertFrame(scene, role, team, frameId, message) {
  const index = Object.keys(directories).indexOf(role) * 2 + team;
  const asset = packs[role].assets[0], page = packs[role].pages[0];
  const frame = asset.frames.find(frame => frame.id === frameId);
  assert.ok(frame, frameId);
  const rect = frame.frameRectsPx?.find(item => item.pageId === page.id)?.rectPx || frame.fallbackRectPx.rectPx;
  const inset = page.sampling?.uvInsetPx ?? 0.5;
  const expected = [(rect.x + inset) / page.dimensionsPx.width,
    (rect.y + rect.height - inset) / page.dimensionsPx.height,
    (rect.x + rect.width - inset) / page.dimensionsPx.width,
    (rect.y + inset) / page.dimensionsPx.height];
  assert.deepEqual(Array.from(scene.children[index].geometry.attributes.instanceAtlasRect.array),
    Array.from(new Float32Array(expected)), message || frameId);
}

test('authored action lifetimes exclude idle placeholders but preserve static poses', async () => {
  await withRuntime(runtime => {
    for (const [role, attack, defeat] of [['human', 840, 840], ['infantry', 850, 850],
      ['spearman', 880, 1080], ['archer', 1000, 850]]) {
      const asset = packs[role].assets[0];
      // Shipped actions can be shorter or longer than the 1,000 ms idle fallback.
      for (const [state, expected] of [['attack', attack], ['defeat', defeat]]) {
        const authored = asset.clips.find(clip => clip.stateId === state && clip.directionId === 'south-east');
        assert.equal(spriteClipDuration(authored), expected, `${role}/${state} fixture`);
        assert.equal(runtime.durationMs(role, state), expected, `${role}/${state} must not inherit idle time`);
      }
      assert.equal(runtime.durationMs(role, 'idle'), 1000);
    }
    for (const role of ['scout', 'rider', 'siege-engine', ...Object.keys(directories).filter(r => r.startsWith('boughward-'))]) {
      for (const state of ['attack', 'defeat']) assert.equal(runtime.durationMs(role, state), 1000, `${role}/${state}`);
    }
  });
});

test('legacy Human v2 idle-only attack and defeat states keep their fallback lifetime', async () => {
  await withRuntime((runtime, scene, urls) => {
    assert.deepEqual(urls, ['/assets/units/cast-human-sprite-v2/sprite-atlas-pack-v1.json']);
    assert.equal(runtime.durationMs('human', 'attack'), 1000);
    assert.equal(runtime.durationMs('human', 'defeat'), 1000);
    assert.equal(runtime.durationMs('human', 'idle'), 1000);
  }, 'human', 'v2');
});

test('a fresh attack plays once then resumes idle or work, on both default civilizations', async () => {
  await withRuntime((runtime, scene) => {
    for (const team of [0, 1]) for (const kind of ['worker', 'infantry', 'spearman', 'archer', 'scout', 'rider', 'siege-engine']) {
      const unit = actor(team, kind), role = civilizationSpriteRole(kind, team ? 'boughward' : 'human');
      unit.task = kind === 'worker' ? 'gathering' : null; unit.cargoType = 'food';
      unit.performingAction = kind === 'worker' ? 'gather-food' : null;
      const duration = runtime.durationMs(role, 'attack');
      unit.attackStartedAt = 1000;
      const clip = spriteActionClip(new Map(packs[role].assets[0].clips.map(c => [`${c.stateId}|${c.directionId}`, c])),
        'attack', 'south-east', unit.cargoType, role, true);
      runtime.update(unit, 1000, 1); assertFrame(scene, role, team, clip.sequence[0].frameId);
      runtime.update(unit, 1000 + duration - 1, 1); assertFrame(scene, role, team, clip.sequence.at(-1).frameId);
      runtime.update(unit, 1000 + duration, 1);
      assert.equal(activeState(unit, 1000 + duration, duration), kind === 'worker' ? 'gather' : 'idle');
      assertFrame(scene, role, team, `${kind === 'worker' ? 'gather-food' : 'idle'}-south-east-0`,
        `${role} cannot replay the opening attack keys after the authored end`);
      unit.attackStartedAt = 3000;
      runtime.update(unit, 3000, 1); assertFrame(scene, role, team, clip.sequence[0].frameId);
    }
  });
});

test('ordinary Worker actions, interruption and resumption bind real frames regardless of selection', async () => {
  await withRuntime((runtime, scene) => {
    for (const team of [0, 1]) for (const selected of [false, true]) {
      const unit = actor(team); unit.selected = selected;
      const role = team ? 'boughward-worker' : 'human';
      let now = 1000;
      const draw = (changes, frameId) => {
        Object.assign(unit, changes); runtime.update(unit, now, 1);
        assertFrame(scene, role, team, frameId); now += 300;
      };
      draw({}, 'idle-south-east-0');
      draw({ task: 'moving', walking: true }, 'walk-south-east-0');
      draw({ walking: false, task: 'gathering', cargoType: 'wood', performingAction: 'gather-wood' }, 'gather-wood-south-east-0');
      runtime.update(unit, now, 1);
      assertFrame(scene, role, team, `gather-wood-south-east-${team ? 0 : 2}`);
      draw({ task: 'idle' }, 'idle-south-east-0');
      draw({ task: 'gathering' }, 'gather-wood-south-east-0');
      draw({ task: 'building', performingAction: 'build' }, 'build-south-east-0');
      draw({ task: 'repairing', performingAction: 'repair' }, 'repair-south-east-0');
      draw({ walking: true }, 'walk-south-east-0');
      draw({ walking: false }, 'repair-south-east-0');
      draw({ task: 'gathering', cargoType: 'food', performingAction: 'gather-food' }, 'gather-food-south-east-0');
      draw({ workResourceVariant: 'shore-fish' }, `${team ? 'gather-food' : 'gather-fish'}-south-east-0`);
      draw({ task: 'returning', walking: true, cargo: 10, workResourceVariant: null }, 'walk-south-east-0');
      draw({ walking: false }, 'idle-south-east-0');
      draw({ task: 'idle', cargo: 0, cargoType: null }, 'idle-south-east-0');
      const defeatAt = now;
      draw({ hp: 0, defeatStartedAt: defeatAt, task: 'repairing', walking: true }, 'defeat-south-east-0');
      runtime.update(unit, now + 10000, 1);
      assertFrame(scene, role, team, `defeat-south-east-${team ? 0 : 7}`, 'death clamps instead of wrapping');
    }
  });
});

test('all shipped headings resolve available frames without resetting continuous walk/work clocks', async () => {
  await withRuntime((runtime, scene) => {
    for (const team of [0, 1]) {
      const unit = actor(team), role = team ? 'boughward-worker' : 'human';
      const clips = new Map(packs[role].assets[0].clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
      unit.task = 'moving'; unit.walking = true;
      for (const [index, direction] of directions.entries()) {
        unit.angle = index * Math.PI / 4;
        assert.equal(normalizedDirection(unit.angle), direction);
        runtime.update(unit, 1000 + index * 100, 1);
        assert.equal(unit.spriteClockStartedAt, 1000, 'turning does not continually restart walk');
        const clip = spriteActionClip(clips, 'walk', direction, null, role, true);
        assertFrame(scene, role, team, clip.sequence[index % clip.sequence.length].frameId);
      }
      unit.walking = false; unit.task = 'gathering'; unit.cargoType = 'food'; unit.performingAction = 'gather-food';
      runtime.update(unit, 2000, 1); assert.equal(unit.spriteClockStartedAt, 2000);
      runtime.update(unit, 2300, 1); assert.equal(unit.spriteClockStartedAt, 2000);
      runtime.update(unit, 10000, 0);
      const mesh = scene.children[Object.keys(directories).indexOf(role) * 2 + team];
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
      assert.equal(matrix.elements[0], 0, 'fog/LOD hiding clears the actor');
      runtime.update(unit, 10100, 1); assert.equal(unit.spriteClockStartedAt, 2000, 'visibility resumes elapsed work');
    }
  });
});

test('read-only action provenance exposes six Spearman idle walk gaps plus genuine SE and NE on both seats', async () => {
  await withRuntime((runtime, scene) => {
    let placeholders = 0, authored = 0;
    for (const team of [0, 1]) for (const [index, direction] of directions.entries()) {
      const unit = actor(team, 'spearman'); unit.angle = index * Math.PI / 4;
      unit.walking = true;
      runtime.update(unit, 1000, 1);
      const beforeUnit = JSON.stringify(unit);
      const beforeBuffers = scene.children.map(mesh => [Array.from(mesh.instanceMatrix.array),
        Array.from(mesh.geometry.attributes.instanceAtlasRect.array)]);
      const value = runtime.observeAction(unit, 1200, team);
      assert.equal(JSON.stringify(unit), beforeUnit, 'diagnosis must not start/reset a clock');
      assert.deepEqual(scene.children.map(mesh => [Array.from(mesh.instanceMatrix.array),
        Array.from(mesh.geometry.attributes.instanceAtlasRect.array)]), beforeBuffers);
      assert.equal(value.selectedDirection, direction);
      assert.equal(value.directionFallback, false);
      if (['south-east','north-east'].includes(direction)) {
        assert.equal(value.reason, 'exact'); assert.equal(value.distinctFrameIds, direction==='south-east'?8:4); authored++;
      } else {
        assert.equal(value.reason, 'idle-placeholder'); assert.equal(value.distinctFrameIds, 1); placeholders++;
        assert.equal(value.selectedAction, 'walk', 'clip label alone cannot certify motion');
      }
    }
    assert.deepEqual({ placeholders, authored }, { placeholders: 12, authored: 4 });
  }, 'spearman', 'v1');
});

test('provenance distinguishes direction borrowing, action fallback, idle, static action and absent clips', () => {
  const action = (stateId, directionId, frameIds) => ({ stateId, directionId,
    sequence: frameIds.map(frameId => ({ frameId, durationMs: 100 })) });
  const idle = action('idle', 'north', ['idle-north-0']);
  const attack = action('attack', 'south-east', ['attack-south-east-0', 'attack-south-east-1']);
  const food = action('gather-food', 'north', ['gather-food-north-0']);
  const build = action('build', 'north', ['build-north-0']);
  const clips = new Map([idle, attack, food, build].map(c => [`${c.stateId}|${c.directionId}`, c]));
  const read = (state, cargoType = null, approximate = false) =>
    spriteActionProvenance(clips, state, 'north', cargoType, 'human', approximate);
  assert.equal(read('attack', null, true).reason, 'direction-fallback');
  assert.equal(read('attack', null, true).selectedDirection, 'south-east');
  assert.equal(read('attack').reason, 'idle-placeholder');
  assert.equal(read('attack').actionFallback, true);
  assert.equal(read('gather-fish').reason, 'action-fallback');
  assert.equal(read('gather-fish').selectedAction, 'gather-food');
  assert.equal(read('repair').selectedAction, 'build');
  assert.equal(read('gather', 'food').reason, 'exact', 'typed gather is an exact action');
  assert.equal(read('build').reason, 'exact', 'an authored static action is not an idle placeholder');
  assert.equal(read('idle').reason, 'exact', 'ordinary idle is intentional');
  assert.equal(spriteActionProvenance(new Map(), 'walk', 'north', null, 'human').reason, 'missing-clip');
});

test('runtime action observations suppress enemy, fog and unknown seat records before inspecting them', async () => {
  await withRuntime(runtime => {
    const enemy = { team: 1, get kind() { throw Error('enemy fields inspected'); } };
    const hidden = { team: 0, visible: false, get kind() { throw Error('hidden fields inspected'); } };
    assert.equal(runtime.observeAction(enemy, 1000, 0), null);
    assert.equal(runtime.observeAction(hidden, 1000, 0), null);
    assert.equal(runtime.observeAction(actor(), 1000, null), null);
    assert.equal(runtime.observeAction(actor(), 1000, 2), null);
    assert.equal(runtime.observeAction(null, 1000, 0), null);
  }, 'human', 'v3');
});

async function inspectSpriteLoad(fault, inspect) {
  const originalFetch=globalThis.fetch,originalWarn=console.warn;
  const secretError=new Error('fixture-private-url-token-stack-do-not-export');
  let release,rejectRequest,requests=0,textureRequests=0;
  const warnings=[],scene=new THREE.Scene(),pack=structuredClone(packs.spearman);
  if(fault==='asset')pack.assets=[];
  if(fault==='page')pack.files=[];
  if(fault==='shape')pack.assets={};
  if(fault==='pack')pack.assets[0].clips=null;
  globalThis.fetch=()=>{requests++;return new Promise((resolve,reject)=>{release=resolve;rejectRequest=reject;});};
  console.warn=(...args)=>warnings.push(args);
  class TextureLoader { load(_url,done,_progress,failed) {
    const index=textureRequests++;
    if(fault==='texture-throw')throw secretError;
    const texture=new THREE.Texture();
    if(fault==='resolved-then-throw') {done(texture);throw secretError;}
    queueMicrotask(()=>fault===(index===0?'color':'mask')?failed(secretError):done(texture));
    return texture;
  } }
  const api={...THREE,TextureLoader};
  if(fault==='batch')api.PlaneGeometry=class {constructor(){throw secretError;}};
  try {
    const runtime=createUnitSpriteRuntime({THREE:api,scene,capacity:1,roles:['spearman'],
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),
      ...(fault==='visibility'?{fishingContact:{setVisible(){throw secretError;}}}:{})});
    assert.deepEqual(runtime.observeLoad(),{state:'pending',stage:'loading',cause:null});
    if(fault==='network')rejectRequest(secretError);
    else release({ok:fault!=='http',status:fault==='http'?404:200,json:async()=>{
      if(fault==='json')throw secretError;return pack;
    }});
    const result=await runtime.ready;
    await inspect({runtime,result,scene,warnings,requests,textureRequests,secretError});
  } finally {globalThis.fetch=originalFetch;console.warn=originalWarn;}
}

for(const [fault,stage,cause] of [
  ['http','manifest-request','http'],['network','manifest-request','rejected'],
  ['json','manifest-decode','rejected'],['asset','manifest-shape','invalid'],
  ['page','manifest-shape','invalid'],['shape','manifest-shape','exception'],
  ['color','color-texture','rejected'],['mask','mask-texture','rejected'],
  ['texture-throw','color-texture','rejected'],['pack','pack-setup','exception'],
  ['batch','batch-admission','exception'],['visibility','batch-admission','exception'],
]) test(`bounded load provenance records ${fault} without changing admission or exporting errors`,async()=>{
  await inspectSpriteLoad(fault,({runtime,result,scene,warnings,requests,secretError})=>{
    assert.equal(result,false);assert.equal(requests,1);assert.equal(warnings.length,1);
    assert.equal(warnings[0][0],'Unit sprite atlases unavailable; keeping current unit renderer.');
    if(['network','json','color','mask','texture-throw','batch','visibility'].includes(fault))
      assert.equal(warnings[0][1],secretError,'original rejection object reaches the existing warning');
    const value=runtime.observeLoad();assert.deepEqual(value,{state:'failed',stage,cause});
    assert.equal(JSON.stringify(value).includes('fixture-private'),false);
    assert.deepEqual(Object.keys(value),['state','stage','cause']);
    value.state='ready';value.stage='complete';value.cause=null;
    assert.deepEqual(runtime.observeLoad(),{state:'failed',stage,cause},'fresh observation cannot mutate terminal status');
    assert.equal(scene.children.length,fault==='visibility'?2:0,'original admission side effects retained');
  });
});

for(const fault of ['none','resolved-then-throw'])test(`load success preserves actual fulfilled promise outcomes: ${fault}`,async()=>{
  await inspectSpriteLoad(fault,({runtime,result,scene,warnings,requests,textureRequests})=>{
    assert.equal(result,true);assert.equal(requests,1);assert.equal(textureRequests,2);assert.equal(warnings.length,0);
    assert.equal(scene.children.length,2);assert.deepEqual(runtime.observeLoad(),{state:'ready',stage:'complete',cause:null});
    const before=scene.children.map(mesh=>Array.from(mesh.instanceMatrix.array));
    for(let i=0;i<10;i++)runtime.observeLoad();
    assert.deepEqual(scene.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),before);
  });
});

test('synchronous manifest fetch throw still aborts the factory before returning a runtime',()=>{
  const originalFetch=globalThis.fetch,error=new Error('private synchronous transport payload');
  globalThis.fetch=()=>{throw error;};
  try {
    assert.throws(()=>createUnitSpriteRuntime({THREE,scene:new THREE.Scene(),capacity:1,roles:['spearman'],
      teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion()}),caught=>caught===error);
  } finally {globalThis.fetch=originalFetch;}
});

test('late successful or failed sibling cannot overwrite the aggregate first load failure',async()=>{
  const originalFetch=globalThis.fetch,originalWarn=console.warn;
  for(const lateFailure of [false,true]) {
    const pending=new Map(),warnings=[],scene=new THREE.Scene();let textures=0;
    globalThis.fetch=url=>new Promise(resolve=>pending.set(url.includes('cast-human')?'human':'spearman',resolve));
    console.warn=(...args)=>warnings.push(args);
    class TextureLoader {load(_url,done){textures++;const t=new THREE.Texture();queueMicrotask(()=>done(t));return t;}}
    try {
      const runtime=createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,roles:['human','spearman'],
        roleSpriteVersions:{human:'v3'},teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion()});
      pending.get('spearman')({ok:false,status:404});assert.equal(await runtime.ready,false);
      pending.get('human')({ok:!lateFailure,status:503,json:async()=>packs.human});
      for(let i=0;i<20;i++)await Promise.resolve();
      assert.deepEqual(runtime.observeLoad(),{state:'failed',stage:'manifest-request',cause:'http'});
      assert.equal(scene.children.length,0);assert.equal(warnings.length,1);assert.equal(textures,lateFailure?0:2);
    } finally {globalThis.fetch=originalFetch;console.warn=originalWarn;}
  }
});
