/* ============================================================
   PLAYER SYSTEMS
   Stats, skills, XP, game-time, sleep, personal properties.
   Loads AFTER script.js so these definitions are authoritative.
   ============================================================ */

/* ---------- PERSONAL PROPERTIES ---------- */
const personalProperties = [
  { id:'dads',  name:"Dad's House", energy:60, shelter:70 },
  { id:'bench', name:'The Bench',   energy:25, shelter:15 }
];

const illegalProperties = [
  { id:'shakebake', name:'Shake n Bake Setup', category:'lab', desc:'',
    stats:{ labLevel:1, plantationLevel:0, secrecy:1, skillRequirement:1, employeeLimit:2 } },
  { id:'oldgarage', name:'Old Garage', category:'warehouse', desc:'',
    stats:{ batchSlots:30, secrecy:1, employeeLimit:1 } }
];

const illegalCategories = [
  { id:'lab',       label:'Labs' },
  { id:'plantation',label:'Weed Plantation' },
  { id:'warehouse', label:'Warehouse' }
];

/* ---------- XP / LEVELING ---------- */
function addXP(amount){
  if(game.level >= game.maxLevel){ game.xp = 0; return; }
  game.xp += amount;
  while(game.xp >= game.xpToNext && game.level < game.maxLevel){
    game.xp -= game.xpToNext;
    game.level++;
    game.xpToNext = Math.floor(game.xpToNext * 1.15);
    logMsg(`LEVEL UP! You are now level ${game.level}.`);
  }
  if(game.level >= game.maxLevel) game.xp = 0;
  renderCharacter();
}

/* ---------- GAME TIME ---------- */
function fmtTime(min){
  let h = Math.floor(min/60), m = min%60;
  const ap = h<12 ? 'AM' : 'PM';
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,'0')} ${ap}`;
}
function renderGameClock(){
  const el=document.getElementById('game-clock');
  if(el) el.textContent = `DAY ${game.day} // ${fmtTime(game.time)}`;
}
function isSleepTime(){ return game.time>=1200 || game.time<120; }  // 8 PM .. 2 AM

let gameTimer = null;
function startGameClock(){
  clearInterval(gameTimer);
  gameTimer = setInterval(()=>advanceTime(1), 5000);  // 1 game min / 5 real sec
  renderGameClock();
  updateSleepButton();
}
function advanceTime(min){
  for(let i=0;i<min;i++){
    game.time++;
    if(game.time>=1440){ game.time=0; game.day++; }
    checkTimeEvents();
  }
  renderGameClock();
}
function checkTimeEvents(){
  if(typeof checkJobs === 'function') checkJobs();
  if(typeof checkPlayerJob === 'function') checkPlayerJob();
  // ...existing 8 PM / 2 AM logic...
  if(game.time===1200 && !game.sleepOffered){
    game.sleepOffered=true;
    logMsg('It is 8:00 PM — you can sleep at a personal property.');
  }
  if(game.time===120 && !game.sleepForced){
    game.sleepForced=true;
    openSleepModal(true);   // forced
  }
  updateSleepButton();
}
function updateSleepButton(){
  const b=document.getElementById('sleep-btn');
  if(b) b.style.display = isSleepTime() ? '' : 'none';
}

/* ---------- SLEEP ---------- */
function openSleepModal(forced){
  const list=document.getElementById('sleep-list');
  if(!list) return;
  list.innerHTML='';
  personalProperties.forEach(p=>{
    const active = game.sleepPlace===p.id;
    const btn=document.createElement('button');
    btn.className='slot-btn';
    btn.dataset.sleep=p.id;
    btn.innerHTML=`<div class="slot-head">${p.name}${active?' ★':''}</div>
                   <div class="slot-meta">+${p.energy} Energy · Shelter ${p.shelter}</div>`;
    list.appendChild(btn);
  });
  document.getElementById('sleep-title').textContent =
    forced ? 'IT IS 2 AM — YOU MUST SLEEP' : 'CHOOSE WHERE TO SLEEP';
  document.getElementById('close-sleep').style.display = forced ? 'none' : '';
  openModal('modal-sleep');
}
function sleepAt(id){
  const p=personalProperties.find(x=>x.id===id); if(!p) return;
  game.sleepPlace = id;
  game.stats.energy  = Math.min(100, game.stats.energy + p.energy);
  game.stats.shelter = p.shelter;
  let t = game.time + 480;                 // wake exactly 8h later
  while(t>=1440){ t-=1440; game.day++; }
  game.time = t;
  game.sleepOffered=false;
  game.sleepForced=false;
  closeModal('modal-sleep');
  renderGameClock(); render(); updateSleepButton(); autosave();
  logMsg(`Slept at ${p.name}. Woke at ${fmtTime(game.time)}, Day ${game.day}. +${p.energy} Energy, Shelter ${p.shelter}.`);
}

/* ---------- CHARACTER RENDER ---------- */
function renderCharacter(){
  charCategories[0].name = game.player_name || 'player_name';
  document.getElementById('char-categories').innerHTML =
    catPanelHtml(charCategories, ui.charOpen, 'data-charcat', cat=>{
      if(cat.type==='player')      return playerHtml();
      if(cat.type==='partners')    return partnersHtml();
      if(cat.type==='connections') return connectionsHtml();
      return '<div class="na">N/A</div>';
    });
}
function playerHtml(){
  const tabs = [
    { id:'level',  label:'Level'  },
    { id:'stats',  label:'Stats'  },
    { id:'skills', label:'Skills' }
  ];
  let strip = '<div class="cat-buttons">';
  tabs.forEach(t=>{ strip += `<button class="cat-btn ${ui.playerTab===t.id?'active':''}" data-playertab="${t.id}">${t.label}</button>`; });
  strip += '</div>';

  let body='';
  if(ui.playerTab==='level'){
    const capped = game.level >= game.maxLevel;
    const pct = capped ? 100 : Math.min(100, Math.round((game.xp / game.xpToNext) * 100));
    body = `
      <div class="row"><div class="info"><div class="name">${game.player_name||'Unknown'}</div>
        <div class="sub">Business: ${game.business_name||'—'}</div></div></div>
      <div class="row"><div class="info"><div class="name">Level</div></div>
        <span class="inv-qty">${game.level} / ${game.maxLevel}</span></div>
      <div class="row"><div class="info"><div class="name">XP</div>
        <div class="sub">${capped ? 'MAX LEVEL' : `${game.xp} / ${game.xpToNext}`}</div></div></div>
      <div class="xp-bar"><div class="xp-fill" style="width:${pct}%;"></div></div>`;
  }
  else if(ui.playerTab==='stats'){
    const stat=(l,v,m=100)=>`<div class="row"><div class="info"><div class="name">${l}</div></div><span class="inv-qty">${v}${m?` / ${m}`:''}</span></div>`;
    body = stat('Health',game.stats.health)+stat('Energy',game.stats.energy)+stat('Shelter',game.stats.shelter)
         + playerWorkHtml();
  }
  else if(ui.playerTab==='skills'){
    const skill=(l,v)=>{ const pips='●'.repeat(v)+'○'.repeat(MAX_SKILL-v); return `<div class="row"><div class="info"><div class="name">${l}</div></div><span class="inv-qty">${pips} (${v}/${MAX_SKILL})</span></div>`; };
    body = skill('Chemistry',game.skills.chemistry)+skill('Negotiation',game.skills.negotiation)+skill('Strength',game.skills.strength)+skill('Cultivation',game.skills.cultivation);
  }
  return strip + `<div class="cat-content">${body}</div>`;
}

function playerWorkHtml(){
  const propName = game.assignedProperty
    ? (illegalProperties.find(p=>p.id===game.assignedProperty)?.name || game.assignedProperty)
    : 'None';
  let jobName = 'Idle';
  if(game.job){
    const left = Math.max(0, game.job.endAbs - absMinutes());
    jobName = `${game.job.name} (${Math.floor(left/60)}h ${left%60}m)`;
  }

  let sel = `<div class="rname" style="margin-top:6px;">Work Assignment</div>
    <div class="row"><div class="info"><div class="name">Assigned Property</div></div><span class="inv-qty">${propName}</span></div>
    <div class="row"><div class="info"><div class="name">Current Job</div></div><span class="inv-qty">${jobName}</span></div>
    <select class="cook-select" ${game.job?'disabled':''} onchange="assignPlayer(this.value)">
      <option value="" ${!game.assignedProperty?'selected':''}>-- Unassigned --</option>`;
  (typeof illegalProperties!=='undefined'?illegalProperties:[]).forEach(p=>{
    const used = countAssigned(p.id);
    const here = game.assignedProperty===p.id;
    const full = !here && used >= (p.stats.employeeLimit||0);
    sel += `<option value="${p.id}" ${here?'selected':''} ${full?'disabled':''}>${p.name} (${used}/${p.stats.employeeLimit||0})</option>`;
  });
  sel += `</select>`;
  return sel;
}

function assignPlayer(pid){
  if(game.job){ logMsg('You are busy working and cannot reassign.'); renderCharacter(); return; }
  if(!pid){ game.assignedProperty=null; renderCharacter(); autosave(); logMsg('You unassigned yourself.'); return; }
  const prop = illegalProperties.find(p=>p.id===pid); if(!prop) return;
  if(game.assignedProperty!==pid && countAssigned(pid) >= (prop.stats.employeeLimit||0)){
    logMsg(`${prop.name} is full.`); renderCharacter(); return;
  }
  game.assignedProperty = pid;
  renderCharacter(); autosave();
  logMsg(`You assigned yourself to ${prop.name}.`);
}

function checkPlayerJob(){
  if(game.job && absMinutes() >= game.job.endAbs){
    addMethBatch(game.job.purity, game.job.yield);
    logMsg(`You finished ${game.job.name}: +${game.job.yield} batch @ ${game.job.purity}%.`);
    game.job=null; render(); autosave();
  }
}
function connectionsHtml(){
  const list=(title,arr)=>{
    const b=arr.length ? arr.map(c=>`<div class="inv-item"><span class="name">${c}</span></div>`).join('') : '<div class="na">N/A</div>';
    return `<div class="rname" style="margin-top:6px;">${title}</div>${b}`;
  };
  return list('Legal Connections', connections.legal) + list('Illegal Connections', connections.illegal);
}

/* ---------- PROPERTIES RENDER ---------- */
function renderProperties(){
  document.getElementById('prop-categories').innerHTML =
    catPanelHtml(propCategories, ui.propOpen, 'data-propcat', cat=>{
      if(cat.type==='personal') return personalPropsHtml();
      if(cat.type==='illegal')  return illegalPropsHtml();
      return '<div class="na">N/A</div>';
    });
}

function personalPropsHtml(){
  return personalProperties.map(p=>{
    const active = game.sleepPlace===p.id;
    return `<div class="row"><div class="info">
        <div class="name">${p.name}${active?' <span class="inv-qty">[ active ]</span>':''}</div>
        <div class="sub">+${p.energy} Energy · Shelter ${p.shelter}</div>
      </div>
      <button class="action" data-setsleep="${p.id}">${active?'ACTIVE':'SET ACTIVE'}</button></div>`;
  }).join('');
}

function illegalPropsHtml(){
  return illegalCategories.map(cat=>{
    const members = illegalProperties.filter(p=>p.category===cat.id);
    const body = members.length
      ? members.map(illegalPropRowHtml).join('')
      : '<div class="na">N/A</div>';
    return `<div class="rname" style="margin-top:6px;">${cat.label}</div>${body}`;
  }).join('');
}

function illegalPropRowHtml(p){
  const open = ui.illegalOpen === p.id;
  let row = `<div class="row char-row" data-illegalprop="${p.id}">
      <div class="info">
        <div class="name">${p.name} <span class="meth-hint">${open?'[ click to collapse ]':'[ click to inspect ]'}</span></div>
      </div>
      <span class="inv-qty">${open?'▾':'▸'}</span>
    </div>`;

  if(open){
    const stat=(l,v)=>`<div class="row"><div class="info"><div class="name">${l}</div></div><span class="inv-qty">${v}</span></div>`;
    let statsHtml='';
    if(p.category==='lab'){
      statsHtml = stat('Lab Level', p.stats.labLevel)
                + stat('Plantation Level', p.stats.plantationLevel)
                + stat('Secrecy', p.stats.secrecy)
                + stat('Skill Requirement', p.stats.skillRequirement);
      statsHtml += stat('Employees', `${countAssigned(p.id)} / ${p.stats.employeeLimit||0}`);
    } else if(p.category==='plantation'){
      statsHtml = stat('Plantation Level', p.stats.plantationLevel||0)
                + stat('Secrecy', p.stats.secrecy||0)
                + stat('Skill Requirement', p.stats.skillRequirement||0);
                // add to every category's statsHtml:
      statsHtml += stat('Employees', `${countAssigned(p.id)} / ${p.stats.employeeLimit||0}`);
    } else if(p.category==='warehouse'){
      const used = countInventorySlots();
      statsHtml = stat('Batch Slots', `${used} / ${p.stats.batchSlots}`)
                + stat('Secrecy', p.stats.secrecy||0);
                // add to every category's statsHtml:
      statsHtml += stat('Employees', `${countAssigned(p.id)} / ${p.stats.employeeLimit||0}`);
    }

    row += `<div class="char-detail">
        <div class="prop-media">[ image slot ]</div>
        <div class="prop-desc">${p.desc || 'No description yet.'}</div>
        <div class="rname" style="margin-top:6px;">Stats</div>
        ${statsHtml}
      </div>`;
  }
  return row;
}