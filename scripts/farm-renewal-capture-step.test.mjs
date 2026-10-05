import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runFarmRenewalCaptureStep } from './farm-renewal-capture-step.mjs';
function fixture({debit=60,deposit=10,selected=[1,2],retained=selected,oldAlive=false}={}) {
  const plot={id:7,type:'farm',team:0,x:-10.5,z:7.5,complete:true,harvestStock:0,
    screen:{x:150,y:210},capture:{visible:true,decoded:true,state:'exhausted'}};
  const before={team:0,bank:{wood:340,food:200.000000000008},buildings:[plot]};
  const fresh={...plot,id:8,complete:false,harvestStock:0};
  const paid={...before,bank:{wood:340-debit,food:before.bank.food},buildings:[fresh,...oldAlive?[plot]:[]]};
  const delivered={...paid,bank:{wood:paid.bank.wood,food:before.bank.food+deposit},buildings:[{...fresh,complete:true,harvestStock:180}]};
  const states=[before,paid,delivered],selections=[selected,retained],inputs=[],clicks=[],frames=[],waits=[];
  const page={cdp:{evaluate:async expression=>expression.includes('RecoverySnapshot')?selections.shift():states.shift(),
    call:async(method,value)=>inputs.push({method,...value})},wait:async(expression,label)=>{
      waits.push({expression,label});return label==='fresh paid renewal foundation'?fresh:true;
    }};
  return {options:{page,team:0,plotId:7,workerIds:[1,2],capture:async name=>frames.push(name)},
    deps:{click:async(_,selector)=>clicks.push(selector)},inputs,clicks,frames,waits};
}
test('ordinary helper performs explicit Worker/plot/Replant pointer flow and demands renewed deposit',async()=>{
  const f=fixture(); const report=await runFarmRenewalCaptureStep(f.options,f.deps);
  assert.equal(report.status,'captured-needs-review');assert.equal(report.woodDebit,60);assert.equal(report.foodDeposit,10);
  assert.deepEqual(f.clicks,['[data-context-proxy="select-idle-workers"]','[data-action="replantFarm"]']);
  assert.deepEqual(f.inputs.map(x=>x.type),['mousePressed','mouseReleased']);
  assert.deepEqual(f.frames,['farm-renewal-selected','farm-renewal-foundation','farm-renewal-first-delivery']);
  assert.match(f.waits.at(-1).expression,/bank.food>200.000000000008\+0.00001/);
});
for(const [label,changes]of [['wrong charge',{debit:0}],['duplicate charge',{debit:120}],
  ['old identity survives',{oldAlive:true}],['wrong Workers',{selected:[1,2,3]}],
  ['lost selection',{retained:[]}],['no deposit',{deposit:0}],['floating residue',{deposit:1e-10}]]) {
  test(`${label} fails acceptance instead of reporting a capture pass`,async()=>{
    const f=fixture(changes);await assert.rejects(()=>runFarmRenewalCaptureStep(f.options,f.deps));
    assert.ok(!f.frames.includes('farm-renewal-first-delivery'));
  });
}
test('existing paid-economy recipe consumes the pointer renewal helper by default',()=>{
  const source=readFileSync(new URL('./frontier-economy-game-capture.mjs',import.meta.url),'utf8');
  assert.match(source,/report.renewal=await runFarmRenewalCaptureStep/);
  assert.doesNotMatch(source,/type:'cancelConstruction',buildingId:farm.id/);
  assert.doesNotMatch(source,/type:'build',buildingType:'farm',ids:workers\[0\]/);
});
