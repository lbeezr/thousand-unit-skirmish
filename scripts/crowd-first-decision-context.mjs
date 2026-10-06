// Reconstruct only the retained production decision, never a new match/journey.
import assert from 'node:assert/strict';
import vm from 'node:vm';
export function frameContext(frame, record, observed, dependencies, host) {
  const {movement, UNIT_DEFINITIONS, constructionMovementActive, workerPatrolAcquiredMovementActive} = dependencies;
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
  const columns=Math.floor((width-.5)/size)+1,rows=Math.floor((height-.5)/size)+1;
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
  const cell=(x,z)=>Math.floor(z+height/2)*width+Math.floor(x+width/2);
  const point=c=>({x:c%width-width/2+.5,z:Math.floor(c/width)-height/2+.5});
  const context=vm.createContext({...movement,...observed,UNIT_DEFINITIONS,constructionMovementActive,
    workerPatrolAcquiredMovementActive,units,STEP_SECONDS:1/30,MAP_WIDTH:width,MAP_HEIGHT:height,
    MAP_HALF_X:width/2,MAP_HALF_Z:height/2,SPATIAL_BUCKET_SIZE:size,
    spatialBucketColumns:columns,spatialBucketRows:rows,spatialBucketHeads:heads,spatialBucketNext:links,
    spatialBucketColumn:x=>Math.max(0,Math.min(columns-1,Math.floor((x+width/2)/size))),
    spatialBucketRow:z=>Math.max(0,Math.min(rows-1,Math.floor((z+height/2)/size))),
    spatialBucketRosterCurrent:true,elevationLevelByCell:Uint8Array.from(record.elevationLevels),
    cellToWorld:point,worldToCell:cell,isWalkable:c=>c>=0&&c<width*height&&record.navigationMask[c],
    SEPARATION_DIAGNOSTICS_ENABLED:false,tickNumber:frame.tick,
    navigationRevision:frame.navigationRevision,movePlanningEpoch:frame.epoch});
  vm.runInContext(host,context);
  return {context,unit:actorAt(frame.actor.id),decode,point};
}
