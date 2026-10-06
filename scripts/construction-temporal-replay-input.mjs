// Public captured inputs reconstruct a decision, not an independent match replay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as movement from '../src/unit-movement.mjs';
import { UNIT_DEFINITIONS } from '../src/gameplay-definitions.mjs';
import { constructionMovementActive } from '../src/construction-work-intent.mjs';
import { workerPatrolAcquiredMovementActive } from '../src/combat-movement.mjs';

export const packed = readFileSync(new URL('../docs/qa-evidence/construction-temporal-2026-10-06/actor75-temporal.json.gz', import.meta.url));
export const record = JSON.parse(gunzipSync(packed));
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const start = server.indexOf('function getMoveVector('), end = server.indexOf('function stationaryWorkerCellsNear(', start);
assert.ok(start >= 0 && end > start);
const host = server.slice(start, end);

export function frameContext(frame, row, observed) {
  const actors = new Map(), paths = new Map();
  const actorAt = id => { if (!actors.has(id)) actors.set(id,{id}); return actors.get(id); };
  function decode(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.$undefined) return undefined;
    if (value.$number) return Number(value.$number);
    if (value.$actor !== undefined) return actorAt(value.$actor);
    if (value.$path !== undefined) {
      if (!paths.has(value.$path)) paths.set(value.$path,[...value.cells]);
      return paths.get(value.$path);
    }
    if (Array.isArray(value)) return value.map(decode);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
  }
  for(const visit of frame.queryVisits) Object.assign(actorAt(visit.actor.id),decode(visit.actor));
  for(const body of frame.bodies??[]) Object.assign(actorAt(body.actor.id),decode(body.actor));
  Object.assign(actorAt(frame.actor.id),decode(frame.actor));
  observed.seedReplayStates((frame.bodies??[]).map(body=>[actorAt(body.actor.id),decode(body.state)]));
  observed.seedReplayPaths(paths);
  const width=record.map.width,height=record.map.height,size=1.2;
  const columns=Math.ceil(width/size),rows=Math.ceil(height/size);
  const units=[],heads=new Int32Array(columns*rows).fill(-1),links=new Int32Array(136).fill(-1);
  for(const [id,actor] of actors) units[id]=actor;
  const buckets=new Map();
  for(const visit of frame.queryVisits) {
    if(!buckets.has(visit.bucket))buckets.set(visit.bucket,[]);
    buckets.get(visit.bucket).push(visit.actor.id);
  }
  for(const [bucket,ids] of buckets) {
    assert.equal(new Set(ids).size,ids.length,'actual bucket chain has no duplicate actor');
    heads[bucket]=ids[0]; for(let i=0;i<ids.length;i++)links[ids[i]]=ids[i+1]??-1;
  }
  const blocked=new Set(row.blockedCells);
  for(const obstacle of record.map.obstacles)for(let z=obstacle.row;z<obstacle.row+obstacle.height;z++)
    for(let x=obstacle.column;x<obstacle.column+obstacle.width;x++)blocked.add(z*width+x);
  const cell=(x,z)=>Math.floor(z+height/2)*width+Math.floor(x+width/2);
  const point=c=>({x:c%width-width/2+.5,z:Math.floor(c/width)-height/2+.5});
  const context=vm.createContext({...movement,...observed,UNIT_DEFINITIONS,constructionMovementActive,
    workerPatrolAcquiredMovementActive,units,STEP_SECONDS:1/30,MAP_WIDTH:width,MAP_HEIGHT:height,
    MAP_HALF_X:width/2,MAP_HALF_Z:height/2,SPATIAL_BUCKET_SIZE:size,
    spatialBucketColumns:columns,spatialBucketRows:rows,spatialBucketHeads:heads,spatialBucketNext:links,
    spatialBucketColumn:x=>Math.max(0,Math.min(columns-1,Math.floor((x+width/2)/size))),
    spatialBucketRow:z=>Math.max(0,Math.min(rows-1,Math.floor((z+height/2)/size))),
    spatialBucketRosterCurrent:true,elevationLevelByCell:new Uint8Array(width*height),
    cellToWorld:point,worldToCell:cell,isWalkable:c=>c>=0&&c<width*height&&!blocked.has(c),
    SEPARATION_DIAGNOSTICS_ENABLED:false,tickNumber:frame.tick,
    navigationRevision:frame.navigationRevision,movePlanningEpoch:frame.epoch});
  vm.runInContext(host,context);
  return {context,unit:actorAt(frame.actor.id),decode,point};
}

export const capturedCrowdSource = gunzipSync(readFileSync(new URL(
  '../docs/qa-evidence/construction-temporal-2026-10-06/crowd-selector-7628e8f8.mjs.gz', import.meta.url))).toString();
assert.equal(createHash('sha256').update(capturedCrowdSource).digest('hex'),
  '5c619a38b3b71e8fae312d61951ab8f2491baca25c7da22f3d993d75d0d56a06');
