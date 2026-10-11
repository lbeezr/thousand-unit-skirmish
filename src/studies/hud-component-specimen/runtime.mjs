(() => {
  'use strict';
  const root = document.getElementById('hud-component-specimen');
  const shells = [...root.querySelectorAll('.hs-shell')];
  const D = GAMEPLAY_DEFINITIONS;
  const choices = [['worker','Worker'],['barracks','Barracks'],['army','Army'],['mixed','Mixed group'],['none','Deselect']];
  const fixtures = [['ready','Ready'],['low-food','Low food'],['population','Population full'],['queue','Queue full'],['tier2','Military tier II'],['offline','Connection lost']];
  const categories = {Economy:['house','mill','farm','storehouse','town-center','dock'],Military:['barracks','archery-range','stable','workshop'],Defenses:['watchtower','palisade-wall','palisade-gate']};
  const initial = () => ({selection:'worker',fixture:'ready',food:420,wood:275,capacity:35,alive:24,queue:[{kind:'infantry',remaining:6}],research:null,upgrades:{},cargo:8,workerTask:'Gathering wood',order:'Holding position',stance:'defensive',formation:'box',drawer:null,category:'Economy',target:null,feedback:'',error:false,pending:false});
  let state = initial();
  const design = {lighting:'Daylight',team:'Azure',hotkeys:true};
  const saved = window.openai?.widgetState;
  function restore(snapshot) {
    const s = snapshot?.privateContent?.specimen;
    if (s && choices.some(([id]) => id === s.selection)) state.selection = s.selection;
  }
  restore(saved);
  const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const human = label => label.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bIi\b/g,'II');
  const money = cost => Object.entries(cost).filter(([,v])=>v>0).map(([k,v])=>`${Number(v.toFixed(2))} ${k}`).join(' · ') || 'No cost';
  const reasonText = (reason,cost) => {
    if(reason.startsWith('NEED ')&&cost)return `Need ${Object.entries(cost).filter(([k,v])=>v>state[k]).map(([k,v])=>`${Number((v-state[k]).toFixed(2))} more ${k}`).join(' · ')}`;
    if(reason.startsWith('REQUIRES '))return `Requires ${human(reason.slice(9))}`;
    return reason ? reason[0]+reason.slice(1).toLowerCase() : '';
  };
  const effectText = technology => technology.effects.map(effect=>effect.stat==='damage-multiplier'
    ? `+${Math.round((effect.value-1)*100)}% ${effect.targetTags.map(tag=>D.units[tag]?.label||human(tag)).join('/')} damage`
    : effect.stat==='armor'?`+${effect.value} ${effect.attackClass} armor`:'').filter(Boolean).join(' · ');
  const icon = name => ASSETS[name] ? `<img src="${ASSETS[name]}" alt="" width="21" height="21">` : '';
  const button = (action,label,attrs='',cls='') => `<button type="button" class="cursor-interaction ${cls}" data-action="${esc(action)}" ${attrs}>${label}</button>`;
  const building = () => ({id:42,type:'barracks',team:0,complete:true,queue:state.queue.length});
  const reservation = () => state.queue.reduce((sum,q)=>sum+D.units[q.kind].population,0);
  const ruleState = () => ({team:0,food:state.food,wood:state.wood,upgrades:state.upgrades,active:state.research,queueLimit:FACTS.queueLimit,seatUnits:state.alive,seatReservedUnits:state.queue.length,seatLimit:1000,totalUnits:state.alive,totalReservedUnits:state.queue.length,totalLimit:2000,populationAvailable:Math.max(0,state.capacity-state.alive-reservation()),matchOver:false});
  const gate = () => state.fixture === 'offline' ? 'Connection offline' : state.pending ? 'Awaiting confirmation' : '';
  const productReason = kind => gate() || productionAction(building(),kind,ruleState()).reason;
  const researchReason = id => gate() || researchAction(building(),id,ruleState()).reason;
  const buildReason = id => gate() || (missingTechnologyPrerequisites(D.buildings[id].requires,state.upgrades,D.technologies).length ? technologyRequirementReason(missingTechnologyPrerequisites(D.buildings[id].requires,state.upgrades,D.technologies),D.technologies) : foodWoodShortfallReason(state,D.buildings[id].cost));
  function save() {
    window.openai?.setWidgetState?.({modelContent:{selection:state.selection,fixture:state.fixture,portraitComparison:'Compact 52px and Expressive 72px',source:FACTS.revision.slice(0,7)},privateContent:{specimen:{selection:state.selection}}})?.catch(()=>{});
  }
  function command(id,label,art,key='',reason='',primary=false) {
    const unavailable = reason || gate();
    return button(id,`${icon(art)}<span>${esc(label)}</span>${key&&design.hotkeys?`<kbd>${esc(key)}</kbd>`:''}`,`aria-disabled="${Boolean(unavailable)}" data-tooltip="${esc(unavailable||label)}"`, `hs-command${primary?' hs-command-primary':''}`);
  }
  function portrait(kind) {
    let style;
    if (kind === 'barracks') style = 'width:170.6667%;left:-35.3333%;top:-41%;height:auto';
    else { const p = FACTS.portraits[kind];style=`width:${p.sourceWidth/p.cropSize*100}%;left:${-p.cropX/p.cropSize*100}%;top:${-p.cropY/p.cropSize*100}%;height:auto`; }
    return button('details',`<img src="${ASSETS[kind]}" style="${style}" alt="">`,'aria-label="Selection details"','hs-portrait');
  }
  function identity() {
    const isWorker=state.selection==='worker',isBuilding=state.selection==='barracks',mixed=state.selection==='mixed';
    const kind=isWorker?'worker':isBuilding?'barracks':'infantry';
    const hp=isWorker?D.units.worker.combat.maxHp:isBuilding?D.buildings.barracks.maxHp:8*D.units.infantry.combat.maxHp+4*D.units.spearman.combat.maxHp+(mixed?3*D.units.worker.combat.maxHp:0);
    const title=isWorker?'Worker':isBuilding?'Barracks':mixed?'Mixed group':'Army';
    const role=isWorker?'Economy unit':isBuilding?'Military production':`${mixed?'15':'12'} units selected`;
    const status=isWorker?`<b>${esc(state.workerTask)}</b><span>Carrying ${state.cargo} / ${FACTS.carryCapacity} wood</span>`:isBuilding?`<b>${state.queue.length?`Training ${D.units[state.queue[0].kind].label}`:'Ready to train'}</b><span>${state.queue.length} / ${FACTS.queueLimit} queued${state.research?' · Research active':''}</span>`:`<b>8 Infantry · 4 Spearmen</b><span>${mixed?'3 Workers · 24 wood carried':esc(state.order)}</span>`;
    return `<div class="hs-identity"><div class="hs-id-top">${portrait(kind)}<div><div class="hs-role">${role}</div><h3 class="hs-name">${title}</h3><div class="hs-health"><span class="hs-health-track"><span class="hs-health-fill" style="display:block;width:100%"></span></span><span>${hp} / ${hp}</span></div></div></div><div class="hs-status">${status}</div></div>`;
  }
  function queueMarkup() {
    return `<div class="hs-queue"><span class="hs-queue-label">Queue ${state.queue.length}/${FACTS.queueLimit}</span>${state.queue.map((q,index)=>{
      const unit=D.units[q.kind];const refund=unfinishedRefund(unit.cost,index===0?q.remaining:unit.trainSeconds,unit.trainSeconds);
      return button(`cancel:${index}`,esc(unit.label.slice(0,1))+`<span class="hs-queue-fill" style="width:${index===0?(1-q.remaining/unit.trainSeconds)*100:0}%"></span>`,`aria-label="Cancel ${unit.label}, queue position ${index+1}" data-tooltip="${esc(`${unit.label} · ${index===0?q.remaining:unit.trainSeconds}s · Cancel refunds ${money(refund)}`)}" aria-disabled="${Boolean(gate())}"`);
    }).join('')}${state.queue.length?`<span class="hs-queue-time">${state.queue[0].remaining}s remaining</span>`:'<span class="hs-queue-empty">Empty</span>'}</div>`;
  }
  function product(id,mode) {
    const item=mode==='build'?D.buildings[id]:mode==='research'?D.technologies[id]:D.units[id];
    const reason=mode==='build'?buildReason(id):mode==='research'?researchReason(id):productReason(id);
    const duration=item.buildSeconds||item.trainSeconds||item.durationSeconds;
    const label=mode==='research'?human(item.label):item.label;
    return button(`${mode}:${id}`,`${esc(label)}<small>${esc(money(item.cost))} · ${duration}s${item.population?` · ${item.population} pop`:''}</small>${mode==='research'?`<small>${esc(effectText(item))}</small>`:''}${reason?`<small class="hs-reason">${esc(reasonText(reason,item.cost))}</small>`:''}`,`aria-disabled="${Boolean(reason)}" data-tooltip="${esc(reason||`${label}: ${money(item.cost)}, ${duration} seconds`)}"`,'hs-product');
  }
  function actions() {
    if (state.selection==='barracks') return `<div class="hs-actions"><div class="hs-producer">${D.buildings.barracks.products.map(id=>product(id,'train')).join('')}</div>${queueMarkup()}<div class="hs-more-row">${button('research','Research',`aria-expanded="${state.drawer==='research'}"`)}${button('rally','Set rally',`aria-disabled="${Boolean(gate())}"`)}${state.order==='Rally set'?button('clear-rally','Clear rally'):''}${button('details','Details')}</div></div>`;
    const worker=state.selection==='worker';
    const commands=worker ? [command('build','Build','build','','',true),command('gather','Gather','gather'),command('repair','Repair','build'),command('cargo','Return cargo','cargo','',state.cargo?'':'No carried resources'),command('move','Move','move'),command('stop','Stop','stop',FACTS.bindings.stop)]
      : [command('move','Move','move'),command('attack','Attack move','attack',FACTS.bindings.attack),command('stop','Stop','stop',FACTS.bindings.stop),command('patrol','Patrol','patrol',FACTS.bindings.patrol),command('follow','Follow','follow',FACTS.bindings.follow),command('hold','Hold position','hold',FACTS.bindings.hold)];
    const stances=worker?'':`<div class="hs-stances" role="group" aria-label="Military stance">${FACTS.stances.map(s=>button(`stance:${s.id}`,esc(s.label),`aria-pressed="${state.stance===s.id}" aria-disabled="${Boolean(gate())}" data-tooltip="${esc(s.hint)}"`)).join('')}</div>`;
    return `<div class="hs-actions"><div class="hs-command-grid">${commands.join('')}</div>${stances}<div class="hs-more-row"><span class="hs-current">${worker?'Economy orders':state.stance==='mixed'?'Stance: Mixed':`Stance: ${FACTS.stances.find(s=>s.id===state.stance)?.label||'Mixed'}`}</span>${state.selection==='mixed'?button('cargo','Return cargo · 3',`aria-disabled="${Boolean(gate())}"`):''}${button('orders',worker?'More orders':'Formation',`aria-expanded="${state.drawer==='orders'}"`)}${button('details','Details')}</div></div>`;
  }
  function drawer() {
    if (!state.drawer) return '';
    let title='',body='';
    if (state.drawer==='build') {
      title='Construction';body=`<div class="hs-categories">${Object.keys(categories).map(c=>button(`category:${c}`,c,`aria-pressed="${c===state.category}"`)).join('')}</div><div class="hs-products">${categories[state.category].map(id=>product(id,'build')).join('')}</div>`;
    } else if (state.drawer==='research') {
      title='Barracks research';body=`<div class="hs-research-grid">${Object.values(D.technologies).filter(t=>t.building==='barracks').map(t=>product(t.id,'research')).join('')}</div>${state.research?`<div class="hs-more-row"><span class="hs-current">${human(D.technologies[state.research.id].label)} · ${state.research.remaining}s remaining</span>${button('cancel-research','Cancel research',`aria-disabled="${Boolean(gate())}"`)}</div>`:''}`;
    } else if (state.drawer==='orders') {
      title=state.selection==='worker'?'Additional Worker orders':'Formation';body=`${state.selection==='worker'?`<div class="hs-command-grid">${command('attack','Attack move','attack',FACTS.bindings.attack)}${command('patrol','Patrol','patrol',FACTS.bindings.patrol)}${command('follow','Follow','follow',FACTS.bindings.follow)}${command('hold','Hold position','hold',FACTS.bindings.hold)}</div>`:''}<div class="hs-more-row">${FACTS.formations.map(f=>button(`formation:${f.id}`,f.label,`aria-pressed="${state.formation===f.id}" aria-disabled="${Boolean(gate())}"`)).join('')}</div>`;
    } else {
      title='Selection details';
      if(state.selection==='worker') {const u=D.units.worker;body=`<div class="hs-note">Abilities: ${u.capabilities.join(', ')}<br>Health ${u.combat.maxHp} · Speed ${u.combat.moveSpeed} · Damage ${u.combat.damage} every ${u.combat.period}s<br>Train at Town Center · ${money(u.cost)} · ${u.trainSeconds}s · ${u.population} population</div>`;}
      else if(state.selection==='barracks') {const b=D.buildings.barracks;body=`<div class="hs-note">${b.maxHp} health · ${money(b.cost)} · ${b.buildSeconds}s construction<br>Produces ${b.products.map(id=>D.units[id].label).join(' and ')}. Research is limited to this building.</div>`;}
      else body=`<div class="hs-note">8 Infantry · ${money(D.units.infantry.cost)} each · ${D.units.infantry.combat.maxHp} HP<br>4 Spearmen · ${money(D.units.spearman.cost)} each · ${D.units.spearman.combat.maxHp} HP${state.selection==='mixed'?'<br>3 Workers · Military stance applies to the 12 military units only.':''}</div>`;
    }
    return `<div class="hs-drawer" role="region" aria-label="${title}"><div class="hs-drawer-heading"><span>${title}</span>${button('close','Close · Esc','','hs-close')}</div>${body}</div>`;
  }
  function targetMarkup() {
    if(state.target) {
      const t=state.target;
      const title=t.startsWith('build:')?`Place ${D.buildings[t.slice(6)].label}`:({gather:'Gather from this woodline',repair:'Repair a damaged friendly building',rally:'Set Barracks rally point',follow:'Follow a friendly unit',patrol:'Set patrol destination',attack:'Attack move to this point',move:'Move to this point'})[t];
      return button('target',`${icon(t.startsWith('build:')?'build':'move')}<span>${esc(title)}<small>${t.startsWith('build:')?`${money(D.buildings[t.slice(6)].cost)} · `:''}Click to preview order · Esc cancels</small></span>`,'','hs-target');
    }
    return state.feedback?`<div class="hs-feedback" role="status" aria-live="polite" data-error="${state.error}">${esc(state.feedback)}</div>`:'';
  }
  function render() {
    const focused=document.activeElement;const focusShell=focused?.closest('.hs-shell');const action=focused?.dataset.action;const fixtureFocused=focused?.matches('[data-fixture]');
    for (const shell of shells) {
      const expressive=shell.dataset.treatment==='expressive';
      shell.dataset.light=design.lighting.toLowerCase();shell.style.setProperty('--hs-team',design.team==='Azure'?'#5aa7d7':'#e67a5e');
      const used=state.alive+reservation();
      shell.innerHTML=`<div class="hs-review"><div><span class="hs-review-name">Obsidian / ${expressive?'Expressive':'Compact'}</span><span class="hs-review-label">${expressive?'72px framed portrait':'52px portrait'}</span></div><label class="hs-state-label">Match state <select data-fixture aria-label="Simulated match state">${fixtures.map(([id,label])=>`<option value="${id}"${state.fixture===id?' selected':''}>${label}</option>`).join('')}</select></label>${button('step','Step +6s',`aria-disabled="${Boolean(gate())}" data-tooltip="Advance the simulated queue and research by six seconds"`)}</div>
      ${state.fixture==='offline'?'<div class="hs-connection" role="status">Connection lost · Orders unavailable · Last known selection retained</div>':''}
      <div class="hs-field" style="background-image:url('${ASSETS.battlefield}')"><div class="hs-match"><div class="hs-resources"><span class="hs-resource">${icon('food')}<b data-food>${Number(state.food.toFixed(1))}</b></span><span class="hs-resource">${icon('wood')}<b data-wood>${Number(state.wood.toFixed(1))}</b></span><span class="hs-resource ${used>=state.capacity?'hs-over-cap':''}"><small>POP</small><b>${used}/${state.capacity}</b></span></div><div class="hs-mode">Simulated match<span>Game data ${FACTS.revision.slice(0,7)} · ${design.team}</span></div></div>
      <nav class="hs-selectors" aria-label="Selection specimen">${choices.map(([id,label])=>button(`select:${id}`,label,`aria-pressed="${state.selection===id}"`)).join('')}</nav>
      <div class="hs-target-area">${targetMarkup()}</div><div class="hs-lower"><div class="hs-map" aria-label="Illustrative minimap"><img src="${ASSETS.battlefield}" alt=""><span class="hs-map-frame"></span><span class="hs-map-name">CONCEPT MAP</span></div><div class="hs-workspace">${drawer()}${state.selection==='none'?'<div class="hs-empty"><strong>Select a unit or building</strong><small>Resources and navigation remain available.</small></div>':`<div class="hs-dock" role="region" aria-label="Selection commands">${identity()}${actions()}</div>`}</div></div></div>
      <div class="hs-specs"><span><strong>${expressive?'72px':'52px'}</strong> portrait · ${expressive?'250px':'225px'} identity column · same game state</span><span>DM Sans / Barlow Condensed · existing game icons</span></div>
      <details class="hs-data"><summary>Game data and specimen scope</summary><div class="hs-data-content"><div><b>Source ${FACTS.revision.slice(0,7)}</b><br>Registered costs, health, durations and requirements.<br>Production and research use copied source rule functions.</div><div><b>Simulated match</b><br>Resources, cargo, selection, queue progress and connection are fixtures.<br>Terrain placement and combat are not simulated.</div><div><b>Comparison</b><br>Selections and interactions are shared between portrait variants.<br>Population includes reserved training slots.</div></div></details>`;
    }
    if(action&&focusShell){const replacement=[...focusShell.querySelectorAll('[data-action]')].find(el=>el.dataset.action===action);replacement?.focus({preventScroll:true});}
    if(fixtureFocused&&focusShell)focusShell.querySelector('[data-fixture]')?.focus({preventScroll:true});
  }
  const feedback=(message,error=false)=>{state.feedback=message;state.error=error;};
  const debit=cost=>{state.food-=cost.food;state.wood-=cost.wood;};
  const credit=cost=>{state.food+=cost.food;state.wood+=cost.wood;};
  function select(id) {state.selection=id;state.drawer=null;state.target=null;state.feedback='';state.error=false;if(id==='mixed')state.stance='mixed';}
  function simulate(callback) {
    const fixtureState=state;
    state.pending=true;feedback('Order pending · simulated confirmation');render();
    setTimeout(()=>{if(state!==fixtureState)return;state.pending=false;if(state.fixture==='offline'){feedback('Order rejected · Connection offline',true);}else callback();render();save();},420);
  }
  function closeDrawer() {
    const opener=state.drawer;const shell=document.activeElement?.closest('.hs-shell');
    state.drawer=null;render();
    [...(shell?.querySelectorAll('[data-action]')||[])].find(el=>el.dataset.action===opener)?.focus({preventScroll:true});
  }
  function handle(action) {
    if(action.startsWith('select:')){select(action.slice(7));render();save();return;}
    if(action==='close'){closeDrawer();return;}
    if(action==='details'||action==='orders'||action==='research'||action==='build') {state.drawer=state.drawer===action?null:action;state.target=null;render();save();return;}
    if(action.startsWith('category:')){state.category=action.slice(9);render();return;}
    if(gate()){feedback(gate(),true);render();return;}
    if(action.startsWith('train:')) {
      const id=action.slice(6),reason=productReason(id);if(reason){feedback(human(reason),true);render();return;}
      simulate(()=>{const reason=productReason(id);if(reason){feedback(human(reason),true);return;}debit(D.units[id].cost);state.queue.push({kind:id,remaining:D.units[id].trainSeconds});feedback(`${D.units[id].label} queued · ${money(D.units[id].cost)}`);});return;
    }
    if(action.startsWith('cancel:')) {
      const index=Number(action.slice(7));const q=state.queue[index];if(!q)return;
      simulate(()=>{const unit=D.units[q.kind];const refund=unfinishedRefund(unit.cost,index===0?q.remaining:unit.trainSeconds,unit.trainSeconds);credit(refund);state.queue.splice(index,1);feedback(`${unit.label} cancelled · Refund ${money(refund)}`);});return;
    }
    if(action.startsWith('research:')) {
      const id=action.slice(9),reason=researchReason(id);if(reason){feedback(human(reason),true);render();return;}
      simulate(()=>{const reason=researchReason(id);if(reason){feedback(human(reason),true);return;}debit(D.technologies[id].cost);state.research={id,remaining:D.technologies[id].durationSeconds};feedback(`${human(D.technologies[id].label)} started`);});return;
    }
    if(action==='cancel-research'&&state.research) {simulate(()=>{const t=D.technologies[state.research.id];const refund=unfinishedRefund(t.cost,state.research.remaining,t.durationSeconds);credit(refund);state.research=null;feedback(`Research cancelled · Refund ${money(refund)}`);});return;}
    if(action.startsWith('build:')) {
      const id=action.slice(6),reason=buildReason(id);if(reason){feedback(human(reason),true);render();return;}state.target=action;state.drawer=null;state.feedback='';
    } else if(['move','attack','gather','repair','patrol','follow','rally'].includes(action)){state.target=action;state.drawer=null;state.feedback='';}
    else if(action==='target'&&state.target){
      const target=state.target,orderedSelection=state.selection;
      if(target.startsWith('build:')){const id=target.slice(6),reason=buildReason(id);if(reason){feedback(human(reason),true);state.target=null;render();return;}simulate(()=>{debit(D.buildings[id].cost);state.workerTask=`Building ${D.buildings[id].label}`;state.target=null;feedback(`${D.buildings[id].label} placement preview · ${money(D.buildings[id].cost)}`);});return;}
      simulate(()=>{const label=({rally:'Rally set',move:'Moving',attack:'Attack moving',gather:'Gathering wood',repair:'Repair order',patrol:'Patrolling',follow:'Following'})[target];state.order=label;if(orderedSelection==='worker')state.workerTask=label;state.target=null;feedback(`${label} · simulated order accepted`);});return;
    } else if(action.startsWith('stance:')){const id=action.slice(7);simulate(()=>{state.stance=id;feedback(`${FACTS.stances.find(s=>s.id===id).label} · 12 military units${state.selection==='mixed'?' · Workers unchanged':''}`);});return;}
    else if(action.startsWith('formation:')){state.formation=action.slice(10);feedback(`${human(state.formation)} formation selected`);}
    else if(action==='cargo') {if(state.selection==='worker'&&!state.cargo){feedback('No carried resources',true);}else{state.workerTask='Returning cargo';feedback(`${state.selection==='mixed'?'3 Workers':'Worker'} returning to an owned drop-off · cargo retained until arrival`);}}
    else if(action==='stop'||action==='hold'){state.order=action==='stop'?'Stopped':'Holding position';state.workerTask=state.order;if(state.selection!=='worker')state.stance=action==='stop'?'noAttack':'standGround';state.target=null;feedback(state.order);}
    else if(action==='clear-rally'){state.order='Rally cleared';feedback('Barracks rally cleared');}
    else if(action==='step'){
      let budget=6;const completed=[];
      while(state.queue.length&&budget>0){const q=state.queue[0],spent=Math.min(budget,q.remaining);q.remaining-=spent;budget-=spent;if(q.remaining<=0){state.alive+=D.units[q.kind].population;completed.push(D.units[q.kind].label);state.queue.shift();}}
      if(state.research){state.research.remaining=Math.max(0,state.research.remaining-6);if(state.research.remaining===0){const t=D.technologies[state.research.id];state.upgrades[t.upgradeKey]=true;completed.push(human(t.label));state.research=null;}}
      feedback(completed.length?`${completed.join(', ')} completed · simulated +6s`:'Simulated +6s');
    }
    render();save();
  }
  root.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control&&root.contains(control)){event.stopPropagation();handle(control.dataset.action);}});
  root.addEventListener('change',event=>{if(!event.target.matches('[data-fixture]'))return;const selection=state.selection;state=initial();state.selection=selection;state.fixture=event.target.value;if(state.fixture==='low-food')state.food=20;if(state.fixture==='population')state.capacity=state.alive+reservation();if(state.fixture==='queue')state.queue=Array.from({length:FACTS.queueLimit},(_,i)=>({kind:i%2?'spearman':'infantry',remaining:i===0?6:12}));if(state.fixture==='tier2')state.upgrades.militaryTier2=true;if(selection==='mixed')state.stance='mixed';render();save();});
  root.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.matches('select,input,textarea'))return;
    if(event.key==='Escape'){event.preventDefault();if(state.target){state.target=null;feedback('Targeting cancelled');}else if(state.drawer){closeDrawer();return;}else select('none');render();return;}
    if(state.selection==='none'||state.selection==='barracks')return;
    const binding=Object.entries(FACTS.bindings).find(([,key])=>key.toLowerCase()===event.key.toLowerCase());if(binding){event.preventDefault();handle(binding[0]);}
  });
  window.addEventListener('openai:set_globals',event=>{if(event.detail?.globals?.widgetState){restore(event.detail.globals.widgetState);render();}});
  render();
  if(globalThis.Tweak){const tweak=new Tweak({container:root,onChange:render});tweak.addSelect(design,'lighting',{label:'Battlefield light',options:['Daylight','Dusk']});tweak.addSelect(design,'team',{label:'Team identity',options:['Azure','Ember']});tweak.addToggle(design,'hotkeys',{label:'Show key bindings'});}
})();
