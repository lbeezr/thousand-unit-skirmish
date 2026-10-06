import test from 'node:test';
import './registered-infantry-ne-walk.test.mjs';
import './registered-infantry-walk-history.test.mjs';
import './renderer-worker-animation-scenario.test.mjs';
import './registered-spearman-ne-walk.test.mjs';
import './registered-spearman-east-walk.test.mjs';
import './registered-spearman-north-walk.test.mjs';
import './registered-spearman-south-walk.test.mjs';
import './registered-spearman-south-west-walk.test.mjs';
import './registered-spearman-west-walk.test.mjs';
import './registered-spearman-north-west-walk.test.mjs';
import './registered-spearman-ne-attack.test.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { decodeRgba8, assertFrameUnclipped } from './sprite-pixel-bounds.mjs';
import { createUnitSpriteRuntime, spriteActionClip, spriteClipDuration, spriteGroundDepthBias } from '../src/unit-sprite-runtime.mjs';
import { analyzeUnitArtCoverage, checkUnitClipTiming, decodeRegisteredUnitFrames, validateUnitArtProduction } from './unit-art-production-contract.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const directions = ['north','north-east','east','south-east','south','south-west','west','north-west'];
// Held legacy-art packet is validated explicitly, independently of normal roster identity.
const candidateVersions = {infantry:'v4'};
const roles = ['infantry'];

for (const role of roles) {
  const directory = `assets/units/${role}-sprite-${candidateVersions[role]}`;
  const pack = JSON.parse(read(`${directory}/sprite-atlas-pack-v1.json`));
  const asset = pack.assets[0], page = pack.pages[0];
  const image = decodeRgba8(read(`${directory}/${role}-atlas-runtime.png`));
  const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
  test(`${role}: real unclipped directional artwork, one pivot, retained public provenance`, () => {
    const registration = JSON.parse(read(`${directory}/registration.json`));
    assert.equal(createHash('sha256').update(read(registration.sourcePath)).digest('hex'), registration.sourceSha256);
    assert.equal(registration.reusedUniquePoses, 48);
    for (const key of ['newlyAuthoredPoses','interpolatedPoses','mirroredPoses']) assert.equal(registration[key],0);
    assert.equal(new Set(registration.sourceColumnsInRuntimeOrder).size,8);
    assert.equal(asset.frames.length,48);
    for (const frame of asset.frames) {
      assertFrameUnclipped(image,frame,4);
      assert.deepEqual(frame.groundPivotPx,{x:160,y:308});
    }
    const camera=new THREE.PerspectiveCamera();
    camera.position.set(.78,1.12,.78);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const toward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
    const scale=asset.heightWorld/Math.max(...asset.frames.map(f=>f.alphaBoundsPx.height));
    for(const frame of asset.frames) {
      const b=frame.alphaBoundsPx,p=frame.groundPivotPx;
      const bias=spriteGroundDepthBias(b,p,scale,up.y,toward.y);
      for(const x of [b.x,b.x+b.width]) for(const y of [b.y,b.y+b.height]) {
        const point=new THREE.Vector3(0,.018,0).addScaledVector(right,(x-p.x)*scale)
          .addScaledVector(up,(p.y-y)*scale).addScaledVector(toward,bias);
        for(const bounds of [asset.artBoundsWorld,asset.cullingBoundsWorld]) for(let axis=0;axis<3;axis++) {
          const value=point.getComponent(axis);
          assert.ok(value>=bounds.min[axis]-1e-10&&value<=bounds.max[axis]+1e-10,
            `${frame.id}: rooted/depth-corrected billboard corner lies inside exported bounds`);
        }
      }
    }
    for (const state of ['idle','walk','attack','defeat']) {
      const firstPoses = new Set();
      for (const direction of directions) {
        const clip = spriteActionClip(clips,state,direction,null,role,true);
        assert.equal(clip.directionId,direction,'default approximation must resolve this actual heading');
        assert.equal(clip.loop,['walk','idle'].includes(state));
        assert.equal(clip.sequence.length,state==='idle'?1:2);
        const frameId = clip.sequence[state==='defeat'?1:0].frameId;
        const frame = asset.frames.find(f=>f.id===frameId), r = frame.fallbackRectPx.rectPx;
        const pixels = [];
        for(let y=r.y;y<r.y+r.height;y++) pixels.push(Buffer.from(image.pixels.subarray((y*image.width+r.x)*4,(y*image.width+r.x+r.width)*4)));
        firstPoses.add(createHash('sha256').update(Buffer.concat(pixels)).digest('hex'));
        assert.equal(spriteClipDuration(clip),{idle:1000,walk:800,attack:role==='infantry'?850:1000,defeat:850}[state]);
      }
      assert.equal(firstPoses.size,8,`${state}: no copy-labelled facings`);
    }
  });

  test(`${role}: both teams advance exact-heading keys, loop walks, clamp defeat and resume`, async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(read(url.slice(1)))});
    class TextureLoader { load(_url,done) {const texture=new THREE.Texture(); queueMicrotask(()=>done(texture)); return texture;} }
    try {
      const scene = new THREE.Scene();
      const runtime = createUnitSpriteRuntime({THREE:{...THREE,TextureLoader},scene,capacity:1,
        teamHex:[0x5aa7d7,0xe67a5e],cameraQuaternion:new THREE.Quaternion(),roles:[role],
        roleSpriteVersions:{[role]:candidateVersions[role]},approximateActionDirections:true});
      assert.equal(await runtime.ready,true); runtime.setCount(0,1);runtime.setCount(1,1);runtime.setVisible(true);
      const assertUv = (unit,frameId) => {
        const frame = asset.frames.find(f=>f.id===frameId); const r = frame.frameRectsPx[0].rectPx;
        assert.deepEqual(Array.from(scene.children[unit.team].geometry.attributes.instanceAtlasRect.array),
          Array.from(new Float32Array([(r.x+.5)/page.dimensionsPx.width,(r.y+r.height-.5)/page.dimensionsPx.height,
            (r.x+r.width-.5)/page.dimensionsPx.width,(r.y+.5)/page.dimensionsPx.height])),frameId);
      };
      for(const team of [0,1]) for(const selected of [false,true]) for(const [index,direction] of directions.entries()) {
        const unit={id:team,team,slot:0,kind:role,hp:100,task:'idle',angle:index*Math.PI/4,renderX:0,renderZ:0,selected};
        runtime.update(unit,1000,1);assertUv(unit,`idle-${direction}-0`);
        unit.walking=true;runtime.update(unit,1100,1);assertUv(unit,`walk-${direction}-0`);
        runtime.update(unit,1500,1);assertUv(unit,`walk-${direction}-1`);
        runtime.update(unit,1900,1);assertUv(unit,`walk-${direction}-0`);
        unit.walking=false;unit.attackStartedAt=2000;
        runtime.update(unit,2000,1);assertUv(unit,`attack-${direction}-0`);
        runtime.update(unit,2000+Math.ceil(runtime.durationMs(role,'attack')/2),1);assertUv(unit,`attack-${direction}-1`);
        runtime.update(unit,2000+runtime.durationMs(role,'attack'),1);assertUv(unit,`idle-${direction}-0`);
        unit.attackStartedAt=4000;runtime.update(unit,4000,1);assertUv(unit,`attack-${direction}-0`);
        unit.hp=0;unit.defeatStartedAt=5000;runtime.update(unit,5000,1);assertUv(unit,`idle-${direction}-0`);
        runtime.update(unit,5120,1);assertUv(unit,`defeat-${direction}-0`);
        runtime.update(unit,8000,1);assertUv(unit,`defeat-${direction}-0`);
        unit.hp=100;unit.defeatStartedAt=0;unit.attackStartedAt=0;unit.walking=true;
        runtime.update(unit,9000,1);assertUv(unit,`walk-${direction}-0`);
      }
    } finally {globalThis.fetch=previousFetch;}
  });
}

// Production pilot guards the established family separately from the held v4 packet.
const production = JSON.parse(read('docs/art-direction/human-roster-v1/infantry-production-contract.json'));
const establishedPack = JSON.parse(read(production.manifest));
const established = establishedPack.assets[0];
const establishedPage = establishedPack.pages[0];
const establishedPixels = decodeRgba8(read('assets/units/infantry-sprite-v3/infantry-atlas-runtime.png'));
const registered = decodeRegisteredUnitFrames(established, establishedPage, establishedPixels);

test('established Infantry production: decoded fallbacks retain15 missing cells after reviewed local walks, independent of descriptions', async () => {
  const before = createHash('sha256').update(read('assets/units/infantry-sprite-v3/infantry-atlas-runtime.png')).digest('hex');
  const edited = structuredClone(production);
  edited.gameDescription = 'An edited gameplay description must not trigger regeneration.';
  const report = await validateUnitArtProduction({contract: edited});
  assert.deepEqual(report.errors, []);
  assert.equal(report.requiredCells, 32); assert.equal(report.authoredCells, 17);
  assert.deepEqual(report.missingCells, production.missingSourceCells);
  assert.equal(report.normalBinding, 'v3'); assert.equal(report.renderAcceptance, 'pending');
  assert.equal(createHash('sha256').update(read('assets/units/infantry-sprite-v3/infantry-atlas-runtime.png')).digest('hex'), before);
  const strict = await validateUnitArtProduction({requireComplete: true});
  assert.match(strict.errors.join('\n'), /15 action\/heading cells missing/);
});

test('production failure controls: frozen actions and copy-labelled directions cannot close cells', () => {
  const frozen = structuredClone(established);
  const walk = frozen.clips.find(c => c.stateId === 'walk' && c.directionId === 'south-east');
  walk.sequence.forEach(key => { key.frameId = walk.sequence[0].frameId; });
  assert.equal(analyzeUnitArtCoverage(frozen, registered).rows.find(r => r.key === 'walk|south-east').status, 'static-action');
  const borrowed = structuredClone(established);
  const se = borrowed.clips.find(c => c.stateId === 'attack' && c.directionId === 'south-east');
  for (const clip of borrowed.clips.filter(c => c.stateId === 'attack')) clip.sequence = structuredClone(se.sequence);
  const report = analyzeUnitArtCoverage(borrowed, registered);
  assert.equal(report.rows.filter(r => r.state === 'attack' && r.status === 'borrowed-facing').length, 8);
  assert.ok(report.missingCells.includes('attack|north-east'));
  const absent = structuredClone(established);
  absent.clips = absent.clips.filter(c => !(c.stateId === 'idle' && c.directionId === 'north'));
  assert.match(analyzeUnitArtCoverage(absent, registered).errors.join('\n'), /required clip absent: idle\|north/);
});

test('production timing rejects 24 FPS samples played at 30 FPS and altered explicit keys', () => {
  const source = {mode:'sampled-frames', sourceFPS:24, playbackFPS:24, frameCount:24, durationMs:1000};
  const sequence = Array.from({length:24}, () => ({durationMs:1000/24}));
  assert.deepEqual(checkUnitClipTiming(source, sequence), []);
  const accelerated = {...source, playbackFPS:30};
  const result = checkUnitClipTiming(accelerated, sequence.map(() => ({durationMs:1000/30})));
  assert.match(result.join('\n'), /source\/playback FPS mismatch/);
  assert.match(result.join('\n'), /duration/);
  const keys = production.timing.walk;
  assert.deepEqual(checkUnitClipTiming(keys, established.clips.find(c => c.stateId === 'walk' && c.directionId === 'south-east').sequence), []);
  const ne = established.clips.find(c => c.stateId === 'walk' && c.directionId === 'north-east').sequence;
  assert.deepEqual(checkUnitClipTiming(production.timing.walk.directions['north-east'], ne), []);
  assert.match(checkUnitClipTiming(keys, ne).join('\n'), /explicit source key durations changed/);
  assert.match(checkUnitClipTiming(keys, [{durationMs:800}]).join('\n'), /explicit source key durations changed/);
});

test('production failure controls reject identity replacement, unreviewed calibration and premature acceptance', async () => {
  const changes = [
    [c => { c.identity.sources[0].sha256 = '0'.repeat(64); }, /approved identity\/source hash changed/],
    [c => { c.identity.approvedRuntimeFiles[0].sha256 = '0'.repeat(64); }, /approved runtime bytes changed/],
    [c => { c.identity.anchors[0].rgbaSha256 = '0'.repeat(64); }, /established identity anchor changed/],
    [c => { c.integration.runtimeVersion = 'v4'; }, /ordinary roster does not bind/],
    [c => { c.calibration.worldPerPixel *= 1.1; }, /world-per-pixel calibration changed/],
    [c => { c.calibration.registrationSha256 = '0'.repeat(64); }, /registered pivots\/canvas\/offsets changed/],
    [c => { c.calibration.cameraStatus = 'verified'; }, /verified camera requires/],
    [c => { c.calibration.pivotStatus = 'reviewed'; }, /pivot acceptance cannot exceed/],
    [c => { c.sourceComplete = true; }, /source completion cannot be claimed/],
    [c => { c.renderAcceptance.status = 'accepted'; }, /identified ordinary-game render evidence missing/],
    [c => { c.publication.newUploadsAuthorized = true; }, /no new uploads/],
    [c => { c.provenance.trainingPermission = 'inferred-from-private-visibility'; }, /independent training-permission status/],
    [c => { c.provenance.trainingPermission = 'documented'; }, /retained hashed receipt/],
  ];
  for (const [change, expected] of changes) {
    const contract = structuredClone(production); change(contract);
    const report = await validateUnitArtProduction({contract});
    assert.match(report.errors.join('\n'), expected);
  }
});

test('render receipt controls require literal booleans and a recognized browser/native backend', async () => {
  for (const invalid of [{normalEntry:'false'}, {webgl2:'false'}, {backend:'cpu'}, {backend:'mock'}]) {
    const contract = structuredClone(production);
    contract.renderAcceptance.status = 'accepted';
    contract.renderAcceptance.evidence = contract.renderAcceptance.requiredScenes.map(kind => ({
      kind, normalEntry:true, webgl2:true, backend:'Chromium/CDP',
      sourceRevision:'a'.repeat(40), servedRevision:'a'.repeat(40), runtimeVersion:'v3',
      path:contract.identity.sources[0].path, sha256:contract.identity.sources[0].sha256, ...invalid,
    }));
    const report = await validateUnitArtProduction({contract});
    assert.match(report.errors.join('\n'), /identified ordinary-game render evidence missing/);
  }
});

test('catalog import returns errors for missing sources and malformed pinned-file records', async () => {
  const missing = structuredClone(production);
  missing.identity.sources[0].path = 'docs/art-direction/human-roster-v1/source/nonexistent.png';
  const missingReport = await validateUnitArtProduction({contract:missing});
  assert.match(missingReport.errors.join('\n'), /could not be audited.*ENOENT/);
  const malformed = structuredClone(production);
  malformed.identity.approvedRuntimeFiles = {};
  const malformedReport = await validateUnitArtProduction({contract:malformed});
  assert.match(malformedReport.errors.join('\n'), /nonempty source\/anchor\/runtime arrays/);
  const unpinned = structuredClone(production); unpinned.identity.anchors = [];
  assert.ok((await validateUnitArtProduction({contract:unpinned})).errors.length);
});

test('a canonically valid shortened attack crop cannot silently remove retained visible source pixels', async () => {
  const root = mkdtempSync(path.join(tmpdir(),'infantry-crop-contract-'));
  const repository = fileURLToPath(new URL('..',import.meta.url));
  try {
    const files = [...production.identity.sources.map(s=>s.path), production.manifest, 'src/main.js',
      ...establishedPack.files.map(f=>path.posix.join(path.posix.dirname(production.manifest),f.path))];
    for (const file of files) {
      const target = path.join(root,file); mkdirSync(path.dirname(target),{recursive:true});
      cpSync(path.join(repository,file),target);
    }
    const shortened = structuredClone(establishedPack);
    const crop = shortened.assets[0].frames.find(f=>f.id==='attack-south-east-3');
    crop.frameRectsPx[0].rectPx.width -= 20;
    writeFileSync(path.join(root,production.manifest),JSON.stringify(shortened));
    const report = await validateUnitArtProduction({root,contract:production});
    assert.match(report.errors.join('\n'), /registered pivots\/canvas\/offsets changed/);
    assert.match(report.errors.join('\n'), /registered source pixels changed/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

import './registered-spearman-east-attack.test.mjs';

import './registered-spearman-north-attack.test.mjs';

import './registered-spearman-south-attack.test.mjs';

import './registered-spearman-south-west-attack.test.mjs';

import './registered-spearman-west-attack.test.mjs';

import './registered-spearman-north-west-attack.test.mjs';
