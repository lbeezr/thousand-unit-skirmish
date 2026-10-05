// Shared step in the existing qualified ordinary paid-Farm capture. Reads only
// diagnostics; selection and spending use real pointer input and the default UI.
import assert from 'node:assert/strict';
import { clickControl } from './catalog-barracks-scenario.mjs';
const snapshot='window.__rtsEnvironmentStateSnapshot';
export async function runFarmRenewalCaptureStep({page,team,plotId,workerIds,capture},
  {click=clickControl}={}) {
  assert.ok([0,1].includes(team)&&Number.isSafeInteger(plotId)&&plotId>0);
  assert.ok(Array.isArray(workerIds)&&workerIds.length>0&&new Set(workerIds).size===workerIds.length);
  assert.equal(typeof capture,'function');
  const ids=JSON.stringify(workerIds);
  await page.wait(`${snapshot}?.team===${team} && ${snapshot}.workers.filter(w=>${ids}.includes(w.id)).length===${workerIds.length} && ${snapshot}.workers.filter(w=>${ids}.includes(w.id)).every(w=>w.team===${team}&&w.task==='idle')`,
    'exhausted Farm Workers finished their real cargo deliveries',40000);
  const before=await page.cdp.evaluate(snapshot);
  const plot=before.buildings.find(b=>b.id===plotId);
  assert.ok(plot?.team===team&&plot.type==='farm'&&plot.complete&&plot.harvestStock===0,
    'renewal capture begins at a real owned completed depleted plot');
  assert.ok(before.bank.wood>=60,'renewal capture needs real wood');
  assert.ok(plot.capture?.visible&&plot.capture.decoded&&plot.capture.state==='exhausted',
    'exhausted plot must use the admitted default art');
  await click(page,'[data-context-proxy="select-idle-workers"]');
  const selected=await page.cdp.evaluate('window.__rtsBrowserRecoverySnapshot().selected');
  assert.deepEqual([...selected].sort((a,b)=>a-b),[...workerIds].sort((a,b)=>a-b),
    'actual Idle Workers control selected exactly the declared Workers');
  const point=plot.screen;
  assert.ok(Number.isFinite(point?.x)&&Number.isFinite(point?.y),'real plot projection is required');
  for(const type of ['mousePressed','mouseReleased']) await page.cdp.call('Input.dispatchMouseEvent',{
    type,x:point.x,y:point.y,button:'left',clickCount:1});
  await page.wait(`document.querySelector('[data-action="replantFarm"]')?.textContent==='Replant · 60 wood'`,
    'selected exhausted plot exposes its explicit price');
  assert.deepEqual(await page.cdp.evaluate('window.__rtsBrowserRecoverySnapshot().selected'),selected,
    'plot body selection retains the actual chosen Workers');
  await capture('farm-renewal-selected');
  await click(page,'[data-action="replantFarm"]');
  const fresh=await page.wait(`${snapshot}.buildings.find(b=>b.team===${team}&&b.type==='farm'&&b.id!==${plotId}&&b.x===${plot.x}&&b.z===${plot.z}&&!b.complete&&b.harvestStock===0)`,
    'fresh paid renewal foundation',10000);
  const paid=await page.cdp.evaluate(snapshot);
  assert.equal(paid.bank.wood,before.bank.wood-60,'explicit click charges exactly 60 wood');
  assert.ok(paid.buildings.every(b=>b.id!==plotId),'stale plot identity is gone');
  await capture('farm-renewal-foundation');
  await page.wait(`${snapshot}.buildings.some(b=>b.id===${fresh.id}&&b.complete&&b.harvestStock<200&&b.capture?.state==='complete'&&b.capture.decoded) && ${snapshot}.bank.food>${before.bank.food}+0.00001`,
    'renewed crop materially delivers food without another Gather command',60000);
  const delivered=await page.cdp.evaluate(snapshot);
  assert.equal(delivered.bank.wood,paid.bank.wood,'completion and harvest do not spend again');
  assert.ok(delivered.bank.food>before.bank.food+1e-5,'first renewed food must exceed baseline residue');
  const crop=delivered.buildings.find(b=>b.id===fresh.id);
  assert.ok(crop?.complete&&crop.harvestStock<200&&crop.harvestStock>=0);
  await capture('farm-renewal-first-delivery');
  return {status:'captured-needs-review',team,oldPlotId:plotId,newPlotId:fresh.id,
    selectedWorkerIds:selected,woodDebit:60,foodDeposit:delivered.bank.food-before.bank.food,
    scope:'ordinary renewal step after paid natural depletion; rendered frames require inspection'};
}
