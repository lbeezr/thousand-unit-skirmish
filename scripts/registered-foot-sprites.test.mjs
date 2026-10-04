import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { normalRoster } from './audit-asset-adoption.mjs';
import { decodeRgba8, assertFrameUnclipped } from './sprite-pixel-bounds.mjs';
import { createUnitSpriteRuntime, spriteActionClip, spriteClipDuration } from '../src/unit-sprite-runtime.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const directions = ['north','north-east','east','south-east','south','south-west','west','north-west'];
const roster = normalRoster(read('src/main.js').toString());
const roles = ['infantry', 'archer'];

for (const role of roles) {
  const directory = `assets/units/${role}-sprite-${roster.unitSpritePreviewVersions[role]}`;
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
        roleSpriteVersions:{[role]:roster.unitSpritePreviewVersions[role]},approximateActionDirections:true});
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
