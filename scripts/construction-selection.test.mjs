import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionClientFixture } from './construction-client-fixture.mjs';
const units=Array.from({length:10},(_,id)=>({id,team:id<5?0:1,hp:id%5===4?0:100,
  kind:id%5===3?'infantry':'worker',generation:20+id,x:id<5?-20:20,z:0}));
for(const team of [0,1]) {
  const base=team*5;
  test(`seat ${team}: one selected worker stays selected and is the sole serialized builder`,()=>{
    const f=constructionClientFixture({team,units,selection:[base]});
    f.context.beginBuildPlacement('house');
    assert.deepEqual([...f.selected],[base]);
    f.context.submitBuildPlacement(10,20);
    assert.deepEqual(f.payloads[0].ids,[base]);assert.deepEqual(f.payloads[0].unitGenerations,[20+base]);
  });
  test(`seat ${team}: cooperative selection excludes military, dead and foreign units`,()=>{
    const selection=[base,base+1,base+3,base+4,(1-team)*5];
    const f=constructionClientFixture({team,units,selection});f.context.beginBuildPlacement('palisade-wall');
    const points=[{column:1,row:1},{column:3,row:1}];
    assert.deepEqual([...f.selected],selection);f.context.submitBuildPlacement(0,0,points);
    assert.deepEqual(f.payloads[0].ids,[base,base+1]);
    assert.equal(f.payloads[0].type,'buildWall');assert.deepEqual(f.payloads[0].points,points);
    assert.deepEqual(f.payloads[0].unitGenerations,[20+base,21+base]);
  });
  test(`seat ${team}: no selected eligible workers cannot start or submit construction`,()=>{
    for(const selection of [[],[base+3],[base+4],[(1-team)*5]]) {
      const f=constructionClientFixture({team,units,selection});f.context.beginBuildPlacement('house');
      assert.equal(f.context.buildPlacementActive,false);assert.equal(f.payloads.length,0);
      assert.deepEqual([...f.selected],selection);
    }
  });
  test(`seat ${team}: changes during placement apply only the live explicit selection`,()=>{
    const f=constructionClientFixture({team,units,selection:[base]});f.context.beginBuildPlacement('house');
    f.selected.clear();f.context.submitBuildPlacement(0,0);assert.equal(f.payloads.length,0);
    f.selected.add(base+1);f.context.cursorShift=true;f.context.submitBuildPlacement(0,0);
    assert.deepEqual(f.payloads[0].ids,[base+1]);assert.equal(f.payloads[0].queue,undefined,'build retains its immediate command contract');
  });
  test(`seat ${team}: nearby construction help uses selected workers without replacing selection`,()=>{
    const buildings=[{id:1,team,type:'house',complete:false,x:team?-20:20,z:0},
      {id:2,team,type:'house',complete:false,x:team?18:-18,z:0},
      {id:3,team:1-team,type:'house',complete:false,x:units[base].x,z:0}];
    const f=constructionClientFixture({team,units,selection:[base],buildings});
    f.context.resumeConstruction();assert.deepEqual([...f.selected],[base]);
    assert.deepEqual(f.payloads[0].ids,[base]);assert.equal(f.payloads[0].buildingId,2);
    const empty=constructionClientFixture({team,units,selection:[],buildings});
    empty.context.resumeConstruction();assert.equal(empty.payloads.length,0);
    assert.deepEqual([...empty.selected],[]);
  });
}
