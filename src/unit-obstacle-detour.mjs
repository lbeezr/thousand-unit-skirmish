import { canTraverseUnitStep } from './unit-movement.mjs';

// Replace at most two nearby path cells with a cardinal detour around one
// stationary Worker. This local 5x5 search does not change terrain occupancy,
// final destinations, commands, or the blocker. Failure keeps soft separation.
export function findStationaryWorkerDetour(unit, blocker, width, levels, isWalkable, point, cell) {
  const start=cell(unit.x,unit.z),blocked=cell(blocker.x,blocker.z),next=unit.path[unit.pathIndex];
  const target=point(next);
  const waypointBlocked=next===blocked;
  const acrossBlocker=start===blocked
    &&(target.x-blocker.x)*(unit.x-blocker.x)+(target.z-blocker.z)*(unit.z-blocker.z)<0;
  if(!waypointBlocked&&!acrossBlocker)return null;
  const replaceCount=waypointBlocked?2:1;
  const goal=unit.path[unit.pathIndex+replaceCount-1];
  if(goal===undefined||goal===blocked||!isWalkable(goal))return null;
  const column=blocked%width,row=Math.floor(blocked/width);
  const local=c=>c>=0&&c<levels.length&&c!==blocked&&isWalkable(c)
    &&Math.abs(c%width-column)<=2&&Math.abs(Math.floor(c/width)-row)<=2;
  if(!local(goal))return null;
  const previous=new Map([[start,-1]]),queue=[start];
  for(let i=0;i<queue.length;i++) {
    const from=queue[i];
    if(from===goal) {
      const path=[];for(let c=goal;c!==start;c=previous.get(c))path.push(c);
      path.reverse();return path.length?{path,replaceCount}:null;
    }
    for(const to of [from-width,from+width,from-1,from+1]) {
      if(previous.has(to)||!local(to)||!canTraverseUnitStep(from,to,width,levels,local))continue;
      if(from===start&&start===blocked) {
        const p=point(to);
        if((p.x-blocker.x)*(unit.x-blocker.x)+(p.z-blocker.z)*(unit.z-blocker.z)<0)continue;
      }
      previous.set(to,from);queue.push(to);
    }
  }
  return null;
}
