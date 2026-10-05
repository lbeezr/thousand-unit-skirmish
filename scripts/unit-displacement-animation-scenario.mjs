// CPU integration only: committed client interpolation/update scheduling ->
// real sprite selector/clock -> Three UV buffers -> decoded committed cells.
// Textures are CPU stubs. This neither creates a GL context nor accepts a render.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createUnitSpriteRuntime, normalizedDirection, spriteActionClip } from '../src/unit-sprite-runtime.mjs';
import { workerWorkAction } from '../src/worker-work-presentation.mjs';
import { shouldUpdateUnitTransformForFrame } from '../src/unit-lod-state.mjs';
import { normalRoster } from './audit-asset-adoption.mjs';
import { analyzeUnitArtCoverage } from './unit-art-production-contract.mjs';
import { decodeAnimationCells } from './unit-animation-cells.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputArg = process.argv.slice(2).find(a => a.startsWith('--output='));
assert.ok(outputArg, 'Usage: node scripts/unit-displacement-animation-scenario.mjs --output=DIRECTORY');
const output = path.resolve(outputArg.slice(9));
const negative = process.argv.slice(2).find(a => a.startsWith('--negative='))?.slice(11) ?? null;
assert.ok([null, 'frozen-clock', 'wrong-heading', 'duplicate-cells'].includes(negative));
mkdirSync(output, { recursive: true });
const source = readFileSync(path.join(root, 'src/main.js'), 'utf8');
const loopStart = source.indexOf('  const alpha = 1 - Math.exp(-frameDelta * 16);');
const loopEnd = source.indexOf('  if (artAnimated) {', loopStart);
assert.ok(loopStart >= 0 && loopEnd > loopStart, 'committed client animation loop must be found');
const frameLoop = new vm.Script(`{${source.slice(loopStart, loopEnd)}}`, { filename: 'src/main.js:client-frame-loop' });
const poseConstants = Object.fromEntries(['IDLE_POSE_INTERVAL_MS', 'ATTACK_POSE_MS', 'HIT_POSE_MS', 'SPAWN_POSE_MS', 'DEFEAT_POSE_MS']
  .map(name => {
    const value = source.match(new RegExp(`const ${name} = (\\d+);`));
    assert.ok(value, `committed client constant ${name} must be found`);
    return [name, Number(value[1])];
  }));
const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const roster=normalRoster(source);
const directories=Object.fromEntries(['human','infantry','spearman'].map(role=>{
  assert.ok(roster.unitSpritePreviewRoles.includes(role),'actual no-option roster must include the qualified role');
  return [role,`${role==='human'?'cast-human':role}-sprite-${roster.unitSpritePreviewVersions[role]}`];
}));
const packs = Object.fromEntries(Object.entries(directories).map(([role, dir]) =>
  [role, JSON.parse(readFileSync(path.join(root, 'assets/units', dir, 'sprite-atlas-pack-v1.json')))]));
const pixels = decodeAnimationCells(root, packs, directories);
const report = { schemaVersion: 1, scope: 'CPU-client-displacement-selector-clock-UV-and-source-pixels',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  rendered: false, gpu: false, ordinaryServerCommands: false, negativeControl: negative,
  textureLoader: 'CPU stub; committed manifests and atlas pixels are real', rows: [], failures: [], missingArt: [] };
const savedFetch = globalThis.fetch;
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(readFileSync(path.join(root, url))) });
class TextureLoader {
  load(url, done) { const texture = new THREE.Texture(); queueMicrotask(() => done(texture)); return texture; }
}
try {
  const scene = new THREE.Scene();
  const runtime = createUnitSpriteRuntime({ THREE: { ...THREE, TextureLoader }, scene, capacity: 1,
    teamHex: [0x5aa7d7, 0xe67a5e], cameraQuaternion: new THREE.Quaternion(), roles: Object.keys(directories),
    roleSpriteVersions: roster.unitSpritePreviewVersions, humanAppearancePreview: roster.humanRosterPreview, approximateActionDirections: true });
  runtime.setCount(0, 1); runtime.setCount(1, 1); runtime.setVisible(true);
  assert.equal(await runtime.ready, true);
  for (const [role, pack] of Object.entries(packs)) for (const team of [0, 1]) for (const lowDetail of [false, true]) {
    const coverage=analyzeUnitArtCoverage(pack.assets[0],Object.fromEntries(Object.entries(pixels[role].cells)
      .map(([id,cell])=>[id,{rgba:cell.rgbaSha256,alpha:cell.alphaSha256}])),['idle','walk']);
    assert.deepEqual(coverage.errors,[],'actual registered default cells must be valid');
    const unit = { id: team, team, slot: 0, kind: role === 'human' ? 'worker' : role, hp: 100,
      task: 'idle', walking: false, angle: 0, targetAngle: 0, serverX: 0, serverZ: 0, renderX: 0, renderZ: 0,
      motionPhase: 0, attackStartedAt: 0, hitStartedAt: 0, spawnStartedAt: 0, defeatStartedAt: 0 };
    const mesh = scene.children[Object.keys(directories).indexOf(role) * 2 + team];
    const asset = pack.assets[0], page = pack.pages[0];
    const clips = new Map(asset.clips.map(c => [`${c.stateId}|${c.directionId}`, c]));
    const rect = frame => frame.frameRectsPx.find(r => r.pageId === page.id && r.layerId === 'actor').rectPx;
    const uv = frame => { const r = rect(frame), i = page.sampling?.uvInsetPx ?? 0.5;
      return Array.from(new Float32Array([(r.x + i) / page.dimensionsPx.width,
        (r.y + r.height - i) / page.dimensionsPx.height, (r.x + r.width - i) / page.dimensionsPx.width,
        (r.y + i) / page.dimensionsPx.height])); };
    const context = vm.createContext({ THREE, units: [unit], frameDelta: 0.1, now: 900,
      ...poseConstants, lastIdlePoseStep: -1, unitLowDetailActive: lowDetail,
      unitSpritePreviewActive: true, unitSpritePreviewRoleSet: new Set(['worker', 'infantry', 'spearman']), castPreview: roster.castPreview,
      unitSpriteRuntime: runtime, workerWorkAction, shouldUpdateUnitTransformForFrame, setUnitTint() {},
      updateUnitTransform(u, now) {
        const angle = u.angle;
        if (negative === 'wrong-heading') u.angle = 3 * Math.PI / 4;
        runtime.update(u, negative === 'frozen-clock' ? 900 : now, 1);
        u.angle = angle;
      } });
    const step = (dx = 0, dz = 0) => {
      const before = { x: unit.renderX, z: unit.renderZ };
      unit.serverX += dx; unit.serverZ += dz; context.now += 100;
      frameLoop.runInContext(context);
      const actualUv = Array.from(mesh.geometry.attributes.instanceAtlasRect.array);
      const matches = asset.frames.filter(f => JSON.stringify(uv(f)) === JSON.stringify(actualUv));
      assert.ok(matches.length, 'UV must identify a committed actor cell');
      return { now: context.now, walking: unit.walking, angle: unit.angle,
        direction: normalizedDirection(unit.angle), velocityHeading: normalizedDirection(Math.atan2(unit.renderX - before.x, unit.renderZ - before.z)),
        clientDisplacement: { x: unit.renderX - before.x, z: unit.renderZ - before.z }, frameIds: matches.map(f => f.id), uv: actualUv };
    };
    step();
    for (const [index, requestedHeading] of directions.entries()) {
      const row = { role, packVersion: pixels[role].packVersion, atlasSha256: pixels[role].atlasSha256,
        team, lowDetail, requestedHeading, samples: [], assertions: [] };
      report.rows.push(row);
      try {
        const bearing = index * Math.PI / 4, dx = Math.sin(bearing) * 0.25, dz = Math.cos(bearing) * 0.25;
        // Settle the actual easing turn before sampling a full authored cycle.
        unit.task = 'moving';
        const continuingClock = unit.walking ? unit.spriteClockStartedAt : null;
        for (let n = 0; n < 5; n++) row.samples.push(step(dx, dz));
        const start = unit.spriteClockStartedAt;
        if (continuingClock !== null) assert.equal(start, continuingClock, 'changing movement bearing preserves clock');
        const clip = spriteActionClip(clips, 'walk', requestedHeading, null, role, true);
        const exactHeadingFrames = new Set(clip.sequence.map(item => item.frameId));
        assert.equal(clip.directionId, requestedHeading, 'selector must retain displacement heading');
        for (let n = 0; n < 10; n++) row.samples.push(step(dx, dz));
        const settled = row.samples.slice(5);
        for (const sample of settled) {
          assert.equal(sample.direction, requestedHeading, 'eased unit heading must converge to displacement');
          assert.equal(sample.velocityHeading, requestedHeading, 'actual client velocity must match requested bearing');
          assert.ok(sample.frameIds.every(id => exactHeadingFrames.has(id)), 'UV cell must face actual bearing');
          let boundary = 0;
          const period = clip.sequence.reduce((sum, item) => sum + item.durationMs, 0);
          const phase = (sample.now - start) % period;
          const expected = clip.sequence.find(item => { boundary += item.durationMs; return phase < boundary; });
          assert.ok(sample.frameIds.includes(expected.frameId), 'actual UV must match the authored timeline phase');
        }
        assert.equal(unit.spriteClockStartedAt, start, 'turning/LOD cannot reset continuous walking clock');
        const keys = [...new Set(settled.flatMap(s => s.frameIds))];
        const hashFor = id => negative === 'duplicate-cells' ? 'same' : pixels[role].cells[id].rgbaSha256;
        row.distinctFrameKeys = keys.length; row.distinctVisibleCells = new Set(keys.map(hashFor)).size;
        row.distinctSilhouettes = new Set(keys.map(id => pixels[role].cells[id].alphaSha256)).size;
        row.duplicateCellGroups = [...new Set(keys.map(hashFor))].map(hash => keys.filter(id => hashFor(id) === hash))
          .filter(group => group.length > 1);
        row.authoredWalk = coverage.rows.find(r=>r.state==='walk'&&r.direction===requestedHeading).status==='authored';
        row.motionStatus=row.authoredWalk?'animated':'incomplete-art-correct-facing';
        if (row.authoredWalk) {
          assert.ok(row.distinctFrameKeys > 1, 'authored walk must advance UV/frame keys');
          assert.ok(row.distinctSilhouettes > 1, 'walk must change its registered silhouette');
          assert.ok(row.distinctVisibleCells > 1, 'distinct walk keys must not disguise duplicate/static source pixels');
          assert.deepEqual(row.duplicateCellGroups, [], 'different walk keys must not alias identical visible source pixels');
        } else {
          assert.ok(clip.sequence.every(s=>s.frameId.startsWith(`idle-${requestedHeading}-`)),
            'missing gait must retain its explicit exact-facing idle placeholder');
          assert.equal(row.distinctVisibleCells,1,'idle placeholders cannot qualify as gait');
          if (!report.missingArt.some(m => m.role === role && m.direction === requestedHeading)) {
            report.missingArt.push({ role, direction: requestedHeading, fallback: clip.sequence[0].frameId });
          }
        }
        // Hold authoritative position as a Stop-equivalent snapshot. Residual
        // interpolation must settle before idle is expected; no teleport.
        unit.task = 'idle';
        for (let n = 0; n < 20; n++) step();
        assert.equal(unit.walking, false, 'Stop must settle displacement to idle');
        assert.equal(unit.spriteClockState, 'idle');
        const idleSample = step();
        assert.ok(idleSample.frameIds.includes(`idle-${requestedHeading}-0`), 'Stop preserves last heading');
        const resumed = step(dx, dz);
        assert.equal(unit.spriteClockStartedAt, resumed.now, 'resumed walk starts a fresh clock');
        assert.ok(resumed.frameIds.includes(clip.sequence[0].frameId), 'resume starts at first real/fallback cell');
        row.assertions = ['bearing', 'actual-velocity', 'UV-facing', 'clock-continuity', 'Stop-idle', 'resume',
          ...(row.authoredWalk ? ['frame-advancement', 'distinct-visible-source-pixels'] : ['missing-art-reported'])];
        row.status = 'passed';
      } catch (error) { row.status = 'failed'; row.error = error.message; report.failures.push({ role, team, lowDetail, requestedHeading, error: error.message }); }
    }
  }
} finally { globalThis.fetch = savedFetch; }
report.authoredWalkHeadings=Object.fromEntries(Object.keys(packs).map(role=>[role,report.rows.filter(r=>r.role===role&&r.team===0&&!r.lowDetail&&r.authoredWalk).length]));
report.status = report.failures.length ? 'failed' : 'passed-with-art-gaps';
writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, rows: report.rows.length, failures: report.failures.length,
  missingArt: report.missingArt, rendered: false, output }));
process.exitCode = report.failures.length ? 1 : 0;
