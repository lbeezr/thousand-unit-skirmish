import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { GAMEPLAY_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { STANCE_CHOICES } from '../src/combat-stance-ui.mjs';
import { WORKER_PORTRAITS, INFANTRY_PORTRAITS } from '../src/selection-portrait.mjs';
import { productionAction } from '../src/rules/production-actions.mjs';
import { researchAction } from '../src/rules/research-actions.mjs';
import { missingTechnologyPrerequisites, technologyRequirementReason, foodWoodShortfallReason } from '../src/rules/gameplay-action-rules.mjs';
import { unfinishedRefund } from '../src/rules/base-lifecycle.mjs';

// A source-only specimen. Nothing here is imported by the game or shipped as HUD.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const here = resolve(root, 'src/studies/hud-component-specimen');
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/build-hud-component-specimen.mjs ABSOLUTE_OUTPUT.html');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const source = file => readFileSync(resolve(root, file), 'utf8');
const server = source('server.mjs');
const client = source('src/main.js');
const markup = source('index.html');
const queueLimit = Number(server.match(/const MAX_BUILDING_QUEUE = (\d+);/)?.[1]);
if (!queueLimit || queueLimit !== Number(client.match(/const BARRACKS_QUEUE_LIMIT = (\d+);/)?.[1])) throw new Error('Queue limit extraction disagrees');
const bindings = {};
for (const [id, marker] of Object.entries({patrol:'Patrol',follow:'Follow',stop:'Stop',hold:'Hold position',attack:'Attack move'})) {
  const match = markup.match(new RegExp(`<span>${marker} · ([A-Z])<`));
  if (!match) throw new Error(`Missing binding: ${id}`);
  bindings[id] = match[1];
}
const formations = [...markup.matchAll(/<option value="(box|line|column)"[^>]*>([^<]+)<\/option>/g)].map(([,id,label]) => ({id,label}));
const asset = (path, type) => `data:${type};base64,${readFileSync(resolve(here,path)).toString('base64')}`;
const assets = {
  worker: asset('assets/worker.png','image/png'), infantry: asset('assets/infantry.png','image/png'),
  barracks: asset('assets/barracks.png','image/png'), battlefield: asset('assets/battlefield.jpg','image/jpeg'),
};
for (const [name,path] of Object.entries({food:'food',wood:'wood',build:'build',gather:'gather',move:'move',attack:'attack',patrol:'actions/patrol',follow:'actions/follow',stop:'actions/stop',hold:'actions/hold-position',cargo:'actions/return-cargo',formation:'actions/formation'})) {
  assets[name] = `data:image/svg+xml;base64,${readFileSync(resolve(root,`assets/ui/icons/${path}.svg`)).toString('base64')}`;
}
const carryCapacity = Number(server.match(/const WORKER_CARRY_CAPACITY = (\d+);/)?.[1]);
if (!carryCapacity) throw new Error('Missing Worker capacity');
const facts = {revision,queueLimit,carryCapacity,bindings,formations,stances:STANCE_CHOICES,portraits:{worker:WORKER_PORTRAITS.human,infantry:INFANTRY_PORTRAITS.infantry}};
const functions = [missingTechnologyPrerequisites,technologyRequirementReason,foodWoodShortfallReason,productionAction,researchAction,unfinishedRefund].map(fn => fn.toString()).join('\n');
const runtime = readFileSync(resolve(here,'runtime.mjs'),'utf8');
const boot = `const GAMEPLAY_DEFINITIONS=${JSON.stringify(GAMEPLAY_DEFINITIONS)};\nconst FACTS=${JSON.stringify(facts)};\nconst ASSETS=${JSON.stringify(assets)};\n${functions}\n${runtime}`;
const html = readFileSync(resolve(here,'specimen.html'),'utf8').replace('/* SPECIMEN_BOOT */',boot);
if (html.includes('/* SPECIMEN_BOOT */') || Buffer.byteLength(html) >= 1_000_000) throw new Error('Invalid or oversized fragment');
writeFileSync(output,html);
const inputs=['src/gameplay-definitions.mjs','src/combat-stance-ui.mjs','src/selection-portrait.mjs','src/rules/production-actions.mjs','src/rules/research-actions.mjs','src/rules/gameplay-action-rules.mjs','src/rules/base-lifecycle.mjs','src/palisade-profile.mjs','src/farm-harvest.mjs','src/main.js','server.mjs','index.html'];
const hashes=Object.fromEntries(inputs.map(file=>[file,createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex')]));
writeFileSync(output.replace(/\.html$/,'.provenance.json'),JSON.stringify({revision,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),inputs:hashes,facts,scope:'Actual registered definitions and rule functions, simulated match fixtures. No gameplay network, geometry, production HUD integration or deployment.'},null,2)+'\n');
console.log(`Built ${Buffer.byteLength(html)} bytes from ${revision}`);
