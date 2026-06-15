/* ========== STATE ========== */
const state = {
  money: 100,        // CASH (unclean)
  digital: 0,        // DIGITAL (clean)
  inventory: { meth: 0, pseudoephedrine: 3, ephedrine: 3, phenylacetone: 2, reactingAgent: 6 },
  assets: { lab: 0, chemist: 0 },
  methBatches: {}
};
const NAMES = {
  meth: 'Methamphetamine', pseudoephedrine: 'Pseudoephedrine',
  ephedrine: 'Ephedrine', phenylacetone: 'Phenylacetone', reactingAgent: 'Reacting Agent'
};
const LEVEL_NAMES = { 0:'None', 1:'Low', 2:'Mid', 3:'High' };

/* ========== UI STATE ========== */
const ui = { prodOpen:null, invOpen:null, marketOpen:null, propOpen:null, charOpen:null, playerTab:'level', charPartnerOpen:null, methOpen:false, recipeOpen:false, negotiate:null, cookFlow:null, logiOpen:null };
/* ========== GAME / MENU STATE ========== */
const game = {
  player_name: '',
  business_name: '',
  devAllowed: false,
  slot: null,
  assignedProperty: null,
  job: null,            // { name, endAbs, yield, purity, propertyId }
  streets: false,
  time: 360,            // minutes since midnight (360 = 6:00 AM)
  day: 1,
  sleepPlace: null,     // active sleeping place id
  sleepOffered: false,
  sleepForced: false,
  extraUnlocked: [],
  tutorialActive: false,
  tutorialStep: 0,
  tutorialDone: false,
  storyExtra: [],       // dynamically appended dialogue lines
  resolvedChoices: [],  // entry ids whose options are hidden
  level: 1, xp: 0, xpToNext: 100, maxLevel: 50,
  stats:  { health:100, energy:100, shelter:0 },
  skills: { chemistry:1, negotiation:1, strength:1, cultivation:1 }
};
const MAX_SKILL = 5;
const ALWAYS_UNLOCKED = ['story', 'notes'];
const PLAYER_WORK_ENERGY = 40;   // energy cost for the player to work a job


/* ========== AUDIO ENGINE (synthesized, no files needed) ========== */
const audio = {
  ctx: null,
  enabled: true,
  init(){
    if(!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) this.ctx = new AC();
    }
    // browsers suspend audio until a user gesture; resume on first interaction
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
/* short filtered noise burst = a real "click" */
  noiseClick(dur=0.025, vol=0.18, filterFreq=2200, type='highpass'){
    if(!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<frames; i++) data[i] = Math.random()*2 - 1;  // white noise
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);  // sharp decay
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
    src.stop(t + dur);
  },
  click(){ this.noiseClick(0.03, 0.22, 1800, 'highpass'); },   // chunky UI click
  type(){ this.noiseClick(0.012, 0.10, 3500, 'highpass'); }    // light key tick
};

/* Unlock/resume audio on the very first user interaction */
document.addEventListener('pointerdown', ()=>audio.init(), { once:false });

/* ========== CATEGORIES ========== */
const prodCategories = [
  { id:'synthstim', name:'Synthetic Stimulants', type:'meth' },
  { id:'stim',      name:'Stimulants',          type:'na'   },
  { id:'synthop',   name:'Synthetic Opioids',   type:'na'   },
  { id:'opioids',   name:'Opioids',             type:'na'   },
  { id:'party',     name:'Party Drugs',         type:'na'   },
  { id:'cannabis',  name:'Cannabis',            type:'na'   }
];
const invCategories = [
  { id:'synthstim', name:'Synthetic Stimulants',
    finished:['meth'],
    precursor:['pseudoephedrine','ephedrine','phenylacetone','reactingAgent'] },
  { id:'stim',      name:'Stimulants',          finished:[], precursor:[] },
  { id:'synthop',   name:'Synthetic Opioids',   finished:[], precursor:[] },
  { id:'opioids',   name:'Opioids',             finished:[], precursor:[] },
  { id:'party',     name:'Party Drugs',         finished:[], precursor:[] },
  { id:'cannabis',  name:'Cannabis',            finished:[], precursor:[] }
];
const marketCategories = [
  { id:'precursor', name:'Precursor Market', type:'precursor' },
  { id:'smuggling', name:'Smuggling Market', type:'na' },
  { id:'smurf',     name:'Smurf Market',     type:'na' }
];
const propCategories = [
  { id:'legal',    name:'Legal Properties',    type:'na' },
  { id:'illegal',  name:'Illegal Properties',  type:'illegal' },
  { id:'personal', name:'Personal Properties', type:'personal' }
];

const charCategories = [
  { id:'player',      name:'player_name', type:'player' },
  { id:'partners',    name:'Partners/Employees', type:'partners' },
  { id:'connections', name:'Connections', type:'connections' }
];
const connections = {
  legal:   [],   // populate later
  illegal: []
};

/* ========== RECIPES ========== */
const recipes = [
  { id:'pseudo', name:'Pseudo Cook',
    materials:[{good:'pseudoephedrine',qty:3},{good:'reactingAgent',qty:2}],
    lab:{min:1,label:'Level 1 Lab or Higher'},
    chemist:{min:1,label:'Level 1 Chemist or Higher',note:'higher influences purity'}, yield:1 },
  { id:'ephedrine', name:'Ephedrine Cook',
    materials:[{good:'ephedrine',qty:3},{good:'reactingAgent',qty:2}],
    lab:{min:2,label:'Level 2 Lab or Higher'},
    chemist:{min:2,label:'Level 2 Chemist or Higher'}, yield:1 },
  { id:'p2p', name:'P2P Cook',
    materials:[{good:'phenylacetone',qty:2},{good:'reactingAgent',qty:2}],
    lab:{min:2,label:'Level 2 Lab or Higher'},
    chemist:{min:3,label:'Level 3 Chemist or Higher'}, yield:1 }
];

/* ========== MARKET ITEMS ========== */
const marketItems = [
  { id:'phenylacetone', name:'Phenylacetone',
    businesses:[{region:'Chinese',flag:'🇨🇳',price:1200},{region:'American',flag:'🇺🇸',price:1850},{region:'European',flag:'🇪🇺',price:2100}] },
  { id:'pseudoephedrine', name:'Pseudoephedrine',
    businesses:[{region:'Chinese',flag:'🇨🇳',price:800},{region:'American',flag:'🇺🇸',price:1500},{region:'European',flag:'🇪🇺',price:1350}] },
  { id:'ephedrine', name:'Ephedrine',
    businesses:[{region:'Chinese',flag:'🇨🇳',price:950},{region:'American',flag:'🇺🇸',price:1650},{region:'European',flag:'🇪🇺',price:1500}] }
];




/* ========== HELPERS ========== */
function fmt(n){ return n.toLocaleString(); }

function catPanelHtml(categories, openId, dataAttr, contentFn){
  if(openId===null){
    let h='<div class="cat-buttons">';
    categories.forEach(c=>{ h+=`<button class="cat-btn" ${dataAttr}="${c.id}">${c.name}</button>`; });
    return h+'</div>';
  }
  const cat=categories.find(x=>x.id===openId);
  return `<div class="cat-buttons"><button class="cat-btn active" ${dataAttr}="${cat.id}">${cat.name} ✕</button></div>
          <div class="cat-content">${contentFn(cat)}</div>`;
}

/* ========== XP / LEVELING ========== */
function addXP(amount){
  if(game.level >= game.maxLevel){ game.xp = 0; return; }
  game.xp += amount;
  while(game.xp >= game.xpToNext && game.level < game.maxLevel){
    game.xp -= game.xpToNext;
    game.level++;
    game.xpToNext = Math.floor(game.xpToNext * 1.15);   // each level needs ~15% more
    logMsg(`LEVEL UP! You are now level ${game.level}.`);
  }
  if(game.level >= game.maxLevel) game.xp = 0;
  renderCharacter();
}

function absMinutes(){ return game.day*1440 + game.time; }

/* ========== GAME TIME ========== */
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


function advanceTime(min){
  for(let i=0;i<min;i++){
    game.time++;
    if(game.time>=1440){ game.time=0; game.day++; }
    checkTimeEvents();
  }
  renderGameClock();
}
function checkTimeEvents(){
  if(game.time===1200 && !game.sleepOffered){
    game.sleepOffered=true;
    logMsg('It is 8:00 PM — you can sleep at a personal property.');
  }
  if(game.time===120 && !game.sleepForced){
    game.sleepForced=true;
    openSleepModal(true);   // forced
  }
  if(document.getElementById('logistics')?.classList.contains('active')) renderLogistics();
  updateSleepButton();
}
function updateSleepButton(){
  const b=document.getElementById('sleep-btn');
  if(b) b.style.display = isSleepTime() ? '' : 'none';
}

/* ========== SLEEP ========== */
function openSleepModal(forced){
  const list=document.getElementById('sleep-list'); list.innerHTML='';
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
  // wake exactly 8 hours after sleeping
  let t = game.time + 480;
  while(t>=1440){ t-=1440; game.day++; }
  game.time = t;
  game.sleepOffered=false;
  game.sleepForced=false;
  closeModal('modal-sleep');
  renderGameClock(); render(); updateSleepButton(); autosave();
  logMsg(`Slept at ${p.name}. Woke at ${fmtTime(game.time)}, Day ${game.day}. +${p.energy} Energy, Shelter ${p.shelter}.`);
}

/* ========== METH BATCHES ========== */
function methTotal(){ return Object.values(state.methBatches).reduce((a,b)=>a+b,0); }
function addMethBatch(purity, count){
  const key = String(purity);
  state.methBatches[key] = (state.methBatches[key]||0) + count;
}
function batchPrice(purity){ return Math.round(400 + purity * 0.5); }  // per 10G batch

/* ========== WAREHOUSE / INVENTORY CAPACITY ========== */
function totalBatchCapacity(){
  // sum batchSlots across all owned warehouse properties
  if(typeof illegalProperties === 'undefined') return 0;
  return illegalProperties
    .filter(p=>p.category==='warehouse')
    .reduce((a,p)=>a + (p.stats.batchSlots||0), 0);
}
function countInventorySlots(){
  // every batch of meth + every precursor unit counts as one slot
  let used = methTotal();
  ['pseudoephedrine','ephedrine','phenylacetone','reactingAgent']
    .forEach(g=>{ used += state.inventory[g]||0; });
  return used;
}
function hasSpace(n=1){ return countInventorySlots() + n <= totalBatchCapacity(); }

/* ========== PURITY ========== */
function labBasePurity(labLevel){
  const lvl = Math.min(5, Math.max(1, labLevel || 1));   // clamp 1–5
  return 20 + (lvl - 1) * 10;                            // L1=20 .. L5=60
}
function computePurity(chemistrySkill, labLevel){
  const base = labBasePurity(labLevel);
  const purity = base * (1 + chemistrySkill * 0.1);      // BASE + BASE×(skill×0.1)
  return Math.min(100, Math.round(purity));
}


/* ========== SAVE SYSTEM (localStorage, 3 slots) ========== */
const SAVE_PREFIX = 'tmgs_save_';   // tmgs_save_1, _2, _3
let slotMode = 'load';              // 'new' = pick where to save | 'load' = pick what to load

function slotKey(n){ return SAVE_PREFIX + n; }

function getSaveInfo(n){
  const raw = localStorage.getItem(slotKey(n));
  if(!raw) return null;
  try { return JSON.parse(raw); } catch(e){ return null; }
}

function saveGame(n){
  const data = {
    player_name: game.player_name,
    business_name: game.business_name,
    devAllowed: game.devAllowed,
    storyExtra: game.storyExtra, resolvedChoices: game.resolvedChoices,
    state: state,                       // money, inventory, assets
    time: game.time, day: game.day, sleepPlace: game.sleepPlace,
    assignedProperty: game.assignedProperty, job: game.job,
    extraUnlocked: game.extraUnlocked, tutorialStep: game.tutorialStep,
    tutorialActive: game.tutorialActive, tutorialDone: game.tutorialDone,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(slotKey(n), JSON.stringify(data));
  game.slot = n;
}

/* ========== QUIT TO MENU ========== */
function quitToMenu(){
  clearInterval(gameTimer);          // stop the game clock
  clearTyping();                     // stop any typewriter in progress
  document.getElementById('console').classList.remove('active');
  closeModal('modal-slots'); closeModal('modal-sleep');
  closeModal('modal-name'); closeModal('modal-business'); closeModal('modal-settings');
  // reset transient flags so a fresh load/new game is clean
  game.slot = null;
  game.streets = false;
  document.body.classList.remove('streets-mode');
  showMenu();
}
document.getElementById('menu-btn').addEventListener('click', ()=>{
  if(confirm('Return to main menu? Make sure you have saved.')) quitToMenu();
});

/* ========== DELETE SAVE ========== */
function deleteSave(n){
  localStorage.removeItem(slotKey(n));
  if(game.slot === n) game.slot = null;
  logMsg(`Slot ${n} deleted.`);
}

function loadGame(n){
  const data = getSaveInfo(n);
  if(!data) return false;
  game.player_name   = data.player_name;
  game.business_name = data.business_name;
  game.devAllowed    = !!data.devAllowed;
  game.storyExtra      = data.storyExtra      ?? [];
  game.resolvedChoices = data.resolvedChoices ?? [];
  game.extraUnlocked  = data.extraUnlocked  ?? [];
  game.tutorialStep   = data.tutorialStep   ?? 0;
  game.tutorialActive = data.tutorialActive ?? false;
  game.tutorialDone   = data.tutorialDone   ?? false;
  game.assignedProperty = data.assignedProperty ?? null;
  game.job              = data.job ?? null;
  game.time       = data.time ?? 360;
  game.day        = data.day ?? 1;
  game.sleepPlace = data.sleepPlace ?? null;
  game.sleepOffered=false; game.sleepForced=false;
  game.slot          = n;
  // restore state (merge to keep any new fields the save predates)
  if(data.state){
    state.money = data.state.money ?? state.money;
    if(data.state.inventory) Object.assign(state.inventory, data.state.inventory);
    if(data.state.assets)    Object.assign(state.assets, data.state.assets);
    if(data.state.methBatches) state.methBatches = data.state.methBatches;
    state.digital = data.state.digital ?? state.digital;
  }
  return true;
}

function autosave(){ if(game.slot) saveGame(game.slot); }

/* Build the slot modal for either mode */
function openSlotModal(mode){
  slotMode = mode;
  const titles = { new:'SAVE TO SLOT', load:'LOAD SLOT', delete:'DELETE A SAVE' };
  document.getElementById('slots-title').textContent = titles[mode] || 'SELECT SLOT';

  const list = document.getElementById('slots-list');
  list.innerHTML = '';
  for(let n=1; n<=3; n++){
    const info = getSaveInfo(n);
    const btn = document.createElement('button');
    btn.className = 'slot-btn' + (info ? '' : ' empty');
    btn.dataset.slot = n;
    if(info){
      const when = new Date(info.savedAt).toLocaleString();
      btn.innerHTML = `<div class="slot-head">SLOT ${n} — ${info.player_name} / ${info.business_name}</div>
                       <div class="slot-meta">saved ${when}</div>`;
    } else {
      btn.innerHTML = `<div class="slot-head">SLOT ${n} — [ EMPTY ]</div>`;
      if(mode==='load' || mode==='delete') btn.disabled = true;
    }
    list.appendChild(btn);
  }

  // show the "delete mode" toggle only when picking a save to load
  const delBtn = document.getElementById('delete-mode-btn');
  delBtn.style.display = (mode==='load') ? '' : 'none';

  openModal('modal-slots');
}

function chooseSlot(n){
  if(slotMode==='delete'){
    if(confirm(`Permanently delete Slot ${n}? This cannot be undone.`)){
      deleteSave(n);
      openSlotModal('delete');   // refresh the list, stay in delete mode
    }
    return;
  }
  closeModal('modal-slots');
  if(slotMode==='new'){
    game.extraUnlocked=[]; game.tutorialStep=0; game.tutorialActive=false; game.tutorialDone=false;
    game.storyExtra=[]; game.resolvedChoices=[];
    game.time=360; game.day=1; game.sleepPlace=null;
    game.sleepOffered=false; game.sleepForced=false;
    saveGame(n);
    startGame();
  } else {
    if(loadGame(n)) startGame();
  }
}

/* Slot modal events */
document.getElementById('close-slots').addEventListener('click', ()=>closeModal('modal-slots'));
document.getElementById('slots-list').addEventListener('click', e=>{
  const b = e.target.closest('.slot-btn');
  if(b && !b.disabled) chooseSlot(parseInt(b.dataset.slot,10));
});

document.getElementById('sleep-btn').addEventListener('click', ()=>openSleepModal(false));
document.getElementById('close-sleep').addEventListener('click', ()=>closeModal('modal-sleep'));
document.getElementById('sleep-list').addEventListener('click', e=>{
  const b=e.target.closest('[data-sleep]');
  if(b) sleepAt(b.dataset.sleep);
});

document.getElementById('delete-mode-btn').addEventListener('click', ()=>openSlotModal('delete'));

/* Manual save button */
function manualSave(){
  if(!game.slot){ logMsg('No active slot — start or load a game first.'); return; }
  saveGame(game.slot);
  logMsg(`Game saved to Slot ${game.slot}.`);
}
document.getElementById('save-btn').addEventListener('click', manualSave);

/* ========== PRODUCTION ========== */
function recipesHtml(){
  let out='';
  recipes.forEach(r=>{
    let met=true, req='';
    r.materials.forEach(m=>{
      const have=state.inventory[m.good]||0, ok=have>=m.qty;
      if(!ok) met=false;
      req+=`<div class="req ${ok?'met':'unmet'}">${m.qty}x ${NAMES[m.good]} (have ${have})</div>`;
    });
    const labOk=state.assets.lab>=r.lab.min;
    req+=`<div class="req ${labOk?'met':'pending'}">1x ${r.lab.label} <span class="pnote">(current: ${LEVEL_NAMES[state.assets.lab]} — future use)</span></div>`;
    const chemOk=state.assets.chemist>=r.chemist.min;
    const note=r.chemist.note?` — ${r.chemist.note}`:'';
    req+=`<div class="req ${chemOk?'met':'pending'}">1x ${r.chemist.label} <span class="pnote">(from Character tab${note})</span></div>`;
    out+=`<div class="recipe"><div class="rname">${r.name}</div>${req}
      <div class="cook-wrap"><button class="action" data-cook="${r.id}" ${met?'':'disabled'}>COOK</button></div></div>`;
  });
  return out;
}
function methBlockHtml(){
  if(ui.cookFlow) return cookFlowHtml();
  return `<div class="row">
      <div class="info"><div class="name">Methamphetamine</div>
        <div class="sub">In stock: <span class="inv-qty">${methTotal()}</span> batches (10G each)</div></div>
      <button class="action" id="choose-recipe">CHOOSE RECIPE</button>
    </div>
    <div id="recipe-list" class="${ui.recipeOpen?'open':''}">${recipesHtml()}</div>`;
}

/* ===== COOK FLOW (property -> worker -> confirm) ===== */
function startCookFlow(recipeId){ ui.cookFlow = { recipe:recipeId, property:null, worker:null }; renderProduction(); }
function selectCookProperty(pid){
  ui.cookFlow.property = pid||null; ui.cookFlow.worker=null; renderProduction();
  if(game.tutorialActive && pid && tutorialSteps[game.tutorialStep] && tutorialSteps[game.tutorialStep].key==='pickProperty'){
    nextTutorialStep();
  } else if(game.tutorialActive){ setTimeout(refreshTutorial,0); }
}
function selectCookWorker(cid){ ui.cookFlow.worker = cid; renderProduction(); }
function cancelCookFlow(){ ui.cookFlow = null; renderProduction(); }

function cookFlowHtml(){
  const cf = ui.cookFlow;
  const r = recipes.find(x => x.id === cf.recipe);
  if(!r){ return '<div class="na">Recipe error.</div>'; }

  let h = `<div class="recipe"><div class="rname">${r.name} — Setup</div>`;

  // --- property dropdown (labs only) ---
  h += `<div class="req">Select Property:</div>
        <select class="cook-select" onchange="selectCookProperty(this.value)">
          <option value="">-- choose illegal property --</option>`;
  illegalProperties.filter(p => p.category === 'lab').forEach(p => {
    h += `<option value="${p.id}" ${cf.property===p.id?'selected':''}>${p.name} (Lab ${p.stats.labLevel})</option>`;
  });
  h += `</select>`;

  // --- worker selection ---
  if(cf.property){
    const prop = illegalProperties.find(p => p.id === cf.property);
    const workers = characters.filter(c => c.assignedProperty === cf.property);
    const playerHere = game.assignedProperty === cf.property;

    h += `<div class="req" style="margin-top:10px;">Workers at ${prop.name} (req. Chemistry ≥ ${r.chemist.min}, Lab ≥ ${r.lab.min}):</div>`;

    if(!workers.length && !playerHere){
      h += `<div class="na">No workers assigned here.</div>`;
    } else {
      // player row
      if(playerHere){
        const sel  = cf.worker === '__player__';
        const busy = !!game.job;
        const lowE = game.stats.energy < PLAYER_WORK_ENERGY;
        const lowSkill = game.skills.chemistry < r.chemist.min;
        const pips = '●'.repeat(game.skills.chemistry) + '○'.repeat(MAX_SKILL - game.skills.chemistry);
        const label = sel ? 'SELECTED' : (lowSkill ? 'LOW SKILL' : (lowE ? 'LOW ENERGY' : 'SELECT'));
        h += `<div class="row">
            <div class="info"><div class="name">${game.player_name||'You'} (You)${sel?' ✓':''}${busy?' <span class="inv-qty">[busy]</span>':''}</div>
              <div class="sub">Chemistry ${pips} · costs ${PLAYER_WORK_ENERGY} energy${lowSkill?' — too low':''}</div></div>
            <button class="action" data-cookworker="__player__" ${busy||lowE||lowSkill?'disabled':''}>${label}</button>
          </div>`;
      }
      // employee rows
      workers.forEach(w => {
        const sel  = cf.worker === w.id;
        const busy = isBusy(w);
        const lowSkill = w.skills.chemistry < r.chemist.min;
        const pips = '●'.repeat(w.skills.chemistry) + '○'.repeat(MAX_SKILL - w.skills.chemistry);
        const label = sel ? 'SELECTED' : (lowSkill ? 'LOW SKILL' : 'SELECT');
        h += `<div class="row">
            <div class="info"><div class="name">${w.name}${sel?' ✓':''}${busy?' <span class="inv-qty">[busy]</span>':''}</div>
              <div class="sub">Chemistry ${pips} (${w.skills.chemistry}/${MAX_SKILL})${lowSkill?' — too low':''}</div></div>
            <button class="action" data-cookworker="${w.id}" ${busy||lowSkill?'disabled':''}>${label}</button>
          </div>`;
      });
    }
  }

  // --- confirm ---
  if(cf.property && cf.worker){
    const prop = illegalProperties.find(p => p.id === cf.property);
    const isPlayer = cf.worker === '__player__';
    const chem = isPlayer ? game.skills.chemistry : (getCharacter(cf.worker) ? getCharacter(cf.worker).skills.chemistry : 0);
    const labOk  = prop.stats.labLevel >= r.lab.min;
    const chemOk = chem >= r.chemist.min;
    const meets  = labOk && chemOk;
    let why = '';
    if(!labOk)  why += `<div class="req unmet">Lab level ${prop.stats.labLevel} &lt; required ${r.lab.min}.</div>`;
    if(!chemOk) why += `<div class="req unmet">Chemistry ${chem} &lt; required ${r.chemist.min}.</div>`;
    h += `<div class="cook-wrap">
            <button class="action" id="confirm-cook" ${meets?'':'disabled'}>CONFIRM COOK (8h)</button>
            ${why}
          </div>`;
  }

  h += `<div style="margin-top:8px;"><span class="back" id="cancel-cook">[ ← cancel ]</span></div></div>`;
  return h;
}

function confirmCook(){
  const cf = ui.cookFlow; if(!cf) return;
  const r = recipes.find(x => x.id === cf.recipe); if(!r) return;
  const prop = illegalProperties.find(p => p.id === cf.property); if(!prop) return;

  // ----- PLAYER working -----
  if(cf.worker === '__player__'){
    if(game.job){ logMsg('You are already busy.'); return; }
    if(game.stats.energy < PLAYER_WORK_ENERGY){ logMsg('Not enough energy to work.'); return; }
    for(const m of r.materials){ if((state.inventory[m.good]||0) < m.qty){ logMsg(`Not enough ${NAMES[m.good]}.`); return; } }
    if(!hasSpace(r.yield)){ logMsg('Warehouse full — no batch slots free.'); return; }
    if(prop.stats.labLevel < r.lab.min){ logMsg(`Lab level too low (need ${r.lab.min}).`); return; }
    if(game.skills.chemistry < r.chemist.min){ logMsg(`Your chemistry too low (need ${r.chemist.min}).`); return; }

    r.materials.forEach(m => { state.inventory[m.good] -= m.qty; });
    game.stats.energy -= PLAYER_WORK_ENERGY;
    const purity = computePurity(game.skills.chemistry, prop.stats.labLevel);
    game.job = { name:'Cooking Meth', endAbs: absMinutes()+480, yield:r.yield, purity, propertyId:prop.id };
    logMsg(`You started cooking at ${prop.name}. Ready in 8h. -${PLAYER_WORK_ENERGY} energy.`);
    ui.cookFlow = null;
    render(); autosave();
    return;
  }

  // ----- NPC working -----
  const w = getCharacter(cf.worker); if(!w) return;
  if(isBusy(w)){ logMsg(`${w.name} is already busy.`); return; }
  for(const m of r.materials){ if((state.inventory[m.good]||0) < m.qty){ logMsg(`Not enough ${NAMES[m.good]}.`); return; } }
  if(!hasSpace(r.yield)){ logMsg('Warehouse full — no batch slots free.'); return; }
  if(prop.stats.labLevel < r.lab.min){ logMsg(`Lab level too low (need ${r.lab.min}).`); return; }
  if(w.skills.chemistry < r.chemist.min){ logMsg(`${w.name}'s chemistry too low (need ${r.chemist.min}).`); return; }

  r.materials.forEach(m => { state.inventory[m.good] -= m.qty; });
  const purity = computePurity(w.skills.chemistry, prop.stats.labLevel);
  w.job = { name:'Cooking Meth', endAbs: absMinutes()+480, recipe:r.id, yield:r.yield, purity, propertyId:prop.id };
  logMsg(`${w.name} started cooking at ${prop.name}. Ready in 8h (@~${purity}%).`);
  ui.cookFlow = null;
  render(); autosave();
}
function renderProduction(){
  document.getElementById('prod-categories').innerHTML =
    catPanelHtml(prodCategories, ui.prodOpen, 'data-prodcat',
      cat => cat.type==='meth' ? methBlockHtml() : '<div class="na">N/A</div>');
}

/* ========== INVENTORY ========== */
function renderInventory(){
  document.getElementById('inv-categories').innerHTML =
    catPanelHtml(invCategories, ui.invOpen, 'data-invcat', cat=>{
      const list = (title, cls, arr) => {
        if(!arr.length) return `<div class="inv-header ${cls}">${title}</div><div class="na">N/A</div>`;
        const rows = arr.map(g=>{
          if(g === 'meth') return methInvRow();
          return `<div class="inv-item"><span class="name">${NAMES[g]}</span><span class="inv-qty">x${state.inventory[g]||0}</span></div>`;
        }).join('');
        return `<div class="inv-header ${cls}">${title}</div>${rows}`;
      };
      return list('Finished Product', 'finished', cat.finished)
           + list('Precursor Chemical', 'precursor', cat.precursor);
    });
}

function methInvRow(){
  const total = methTotal();
  let html = `<div class="inv-item meth-row" data-methtoggle="1">
      <span class="name">${NAMES.meth} <span class="meth-hint">${ui.methOpen?'[ click to collapse ]':'[ click to inspect ]'}</span></span>
      <span class="inv-qty">x${total}</span>
    </div>`;
  if(ui.methOpen){
    const purities = Object.keys(state.methBatches).map(Number).filter(p=>state.methBatches[String(p)]>0).sort((a,b)=>a-b);
    html += `<div class="meth-batches">`;
    if(!purities.length){
      html += `<div class="na">No batches yet — go cook some.</div>`;
    } else {
      purities.forEach(p=>{
        const count = state.methBatches[String(p)];
        html += `<div class="batch-line">
            <span class="batch-purity">${p}% Purity</span>
            <span class="batch-count">x${count} (${count*10}G)</span>
            <span class="batch-price">~$${fmt(batchPrice(p))}/batch</span>
          </div>`;
      });
    }
    html += `</div>`;
  }
  return html;
}

/* ========== MARKET ========== */
function negotiationHtml(id){
  const it=marketItems.find(x=>x.id===id);
  let h=`<div class="negotiation"><span class="back" id="neg-back">[ ← back ]</span>
    <div style="color:var(--blue);margin:6px 0;letter-spacing:1px;">Negotiation // ${it.name}</div>`;
  it.businesses.forEach(b=>{ h+=`<div class="biz"><div><span class="flag">${b.flag}</span>${b.region} Supplier</div><div class="price">$${fmt(b.price)}</div></div>`; });
  return h+'</div>';
}
function renderMarket(){
  document.getElementById('market-categories').innerHTML =
    catPanelHtml(marketCategories, ui.marketOpen, 'data-marketcat', cat=>{
      if(cat.type!=='precursor') return '<div class="na">N/A</div>';
      if(ui.negotiate) return negotiationHtml(ui.negotiate);
      return marketItems.map(it=>
        `<div class="row"><div class="info"><div class="name">${it.name}</div></div>
         <button class="action" data-negotiate="${it.id}">NEGOTIATION</button></div>`).join('');
    });
}

/* ========== PROPERTIES ========== */
function renderProperties(){
  document.getElementById('prop-categories').innerHTML =
    catPanelHtml(propCategories, ui.propOpen, 'data-propcat', cat=>{
      if(cat.type!=='personal') return '<div class="na">N/A</div>';
      return personalProperties.map(p=>{
        const active = game.sleepPlace===p.id;
        return `<div class="row"><div class="info">
            <div class="name">${p.name}${active?' <span class="inv-qty">[ active ]</span>':''}</div>
            <div class="sub">+${p.energy} Energy · Shelter ${p.shelter}</div>
          </div>
          <button class="action" data-setsleep="${p.id}">${active?'ACTIVE':'SET ACTIVE'}</button></div>`;
      }).join('');
    });
}

/* ========== LOGISTICS ========== */
function getActiveCooks(){
  const list = [];
  characters.forEach(c=>{
    if(c.job) list.push({ id:'npc-'+c.id, operator:c.name, role:c.category, job:c.job });
  });
  if(game.job) list.push({ id:'player', operator:(game.player_name||'You'), role:'you', job:game.job });
  return list;
}

function renderLogistics(){
  const c=document.getElementById('logistics-content'); if(!c) return;
  const cooks = getActiveCooks();
  if(!cooks.length){ c.innerHTML='<div class="na">No running operations.</div>'; return; }

  c.innerHTML = cooks.map(ck=>{
    const open = ui.logiOpen===ck.id;
    const left = Math.max(0, ck.job.endAbs - absMinutes());
    const eta = `${Math.floor(left/60)}h ${left%60}m`;
    const propName = (illegalProperties.find(p=>p.id===ck.job.propertyId)?.name) || ck.job.propertyId || '—';

    let detail='';
    if(open){
      detail = `<div class="cook-detail">
          <div class="row"><div class="info"><div class="name">Operator</div></div><span class="inv-qty">${ck.operator}</span></div>
          <div class="row"><div class="info"><div class="name">Location</div></div><span class="inv-qty">${propName}</span></div>
          <div class="row"><div class="info"><div class="name">Output</div></div><span class="inv-qty">${ck.job.yield} batch @ ${ck.job.purity}%</span></div>
          <div class="row"><div class="info"><div class="name">Time Left</div></div><span class="cook-eta">${eta}</span></div>
        </div>`;
    }
    return `<div class="cook-card">
        <div class="cook-head" data-logi="${ck.id}">
          <span class="cook-title">${ck.job.name} — ${ck.operator} ${open?'▾':'▸'}</span>
          <span class="cook-eta">${eta}</span>
        </div>${detail}
      </div>`;
  }).join('');
}

/* ========== CHARACTER ========== */
function renderCharacter(){
  charCategories[0].name = game.player_name || 'player_name';

  document.getElementById('char-categories').innerHTML =
    catPanelHtml(charCategories, ui.charOpen, 'data-charcat', cat=>{
      if(cat.type==='player')      return playerHtml();
      if(cat.type==='connections') return connectionsHtml();
      return '<div class="na">N/A</div>';
    });
}

function playerHtml(){
  // inner tab strip
  const tabs = [
    { id:'level',  label:'Level'  },
    { id:'stats',  label:'Stats'  },
    { id:'skills', label:'Skills' }
  ];
  let strip = '<div class="cat-buttons">';
  tabs.forEach(t=>{
    strip += `<button class="cat-btn ${ui.playerTab===t.id?'active':''}" data-playertab="${t.id}">${t.label}</button>`;
  });
  strip += '</div>';

  let body = '';
  if(ui.playerTab==='level'){
    const capped = game.level >= game.maxLevel;
    const pct = capped ? 100 : Math.min(100, Math.round((game.xp / game.xpToNext) * 100));
    body = `
      <div class="row"><div class="info"><div class="name">${game.player_name||'Unknown'}</div>
        <div class="sub">Business: ${game.business_name||'—'}</div></div></div>
      <div class="row"><div class="info"><div class="name">Level</div></div>
        <span class="inv-qty">${game.level} / ${game.maxLevel}</span></div>
      <div class="row"><div class="info">
        <div class="name">XP</div>
        <div class="sub">${capped ? 'MAX LEVEL' : `${game.xp} / ${game.xpToNext}`}</div>
      </div></div>
      <div class="xp-bar"><div class="xp-fill" style="width:${pct}%;"></div></div>`;
  }
  else if(ui.playerTab==='stats'){
    const stat = (label, val, max=100) => `
      <div class="row"><div class="info"><div class="name">${label}</div></div>
        <span class="inv-qty">${val}${max?` / ${max}`:''}</span></div>`;
    body = stat('Health', game.stats.health)
         + stat('Energy', game.stats.energy)
         + stat('Shelter', game.stats.shelter);
  }
  else if(ui.playerTab==='skills'){
    const skill = (label, val) => {
      const pips = '●'.repeat(val) + '○'.repeat(MAX_SKILL - val);
      return `<div class="row"><div class="info"><div class="name">${label}</div></div>
        <span class="inv-qty">${pips} (${val}/${MAX_SKILL})</span></div>`;
    };
    body = skill('Chemistry',   game.skills.chemistry)
         + skill('Negotiation', game.skills.negotiation)
         + skill('Strength',    game.skills.strength)
         + skill('Cultivation', game.skills.cultivation);
  }

  return strip + `<div class="cat-content">${body}</div>`;
}

function connectionsHtml(){
  const list = (title, arr) => {
    const b = arr.length
      ? arr.map(c=>`<div class="inv-item"><span class="name">${c}</span></div>`).join('')
      : '<div class="na">N/A</div>';
    return `<div class="rname" style="margin-top:6px;">${title}</div>${b}`;
  };
  return list('Legal Connections', connections.legal)
       + list('Illegal Connections', connections.illegal);
}

/* ========== NOTES ========== */
function renderNotes(){
  const nl=document.getElementById('notes-list'); nl.innerHTML='';
  LOCALE.notes.forEach(n=>{ const d=document.createElement('div'); d.className='note-item'; d.textContent=n.title; d.dataset.note=n.id; nl.appendChild(d); });
}
function openNote(id){
  const n=LOCALE.notes.find(x=>x.id===id), b=document.getElementById('note-body');
  b.innerHTML=`<div class="nb-title">${n.title}</div><div>${n.body}</div>`; b.classList.add('active');
}

/* ========== STORY ========== */
let typedSegments = new Set();

function renderStory(){
  const c=document.getElementById('story-content'); if(!c) return;
  clearTyping();
  const queue=[];
  let html='';

  // base story entries
  LOCALE.story.entries.forEach((entry,ei)=>{
    html += `<div class="story-entry"><div class="etitle">${entry.title}</div>`;
    if(entry.text){
      const id='tw-text-'+ei, done=typedSegments.has(id);
      html += `<div class="story-text" id="${id}">${done?entry.text():''}</div>`;
      if(!done) queue.push({id, text:entry.text()});
    }
    if(entry.line){
      const id='tw-line-'+ei, done=typedSegments.has(id);
      html += `<div class="dialogue"><span class="speaker">${entry.speaker}:</span> <span class="line" id="${id}">${done?entry.line():''}</span></div>`;
      if(!done) queue.push({id, text:entry.line()});
    }
    if(entry.options && !game.resolvedChoices.includes(entry.id)){
      html += `<div class="choices" id="tw-choices-${ei}" style="opacity:0;pointer-events:none;">`;
      entry.options.forEach(o=>{ html += `<button class="choice" data-choice="${o.id}" title="${o.tooltip}">${o.text}</button>`; });
      html += `</div>`;
      queue.push({reveal:'tw-choices-'+ei});
    }
    html += `</div>`;
  });

  // appended (tutorial / dynamic) dialogue
  (game.storyExtra||[]).forEach((ln,xi)=>{
    const id='tw-extra-'+xi, done=typedSegments.has(id);
    html += `<div class="story-entry"><div class="dialogue"><span class="speaker">${ln.speaker}:</span> <span class="line" id="${id}">${done?ln.text:''}</span></div></div>`;
    if(!done) queue.push({id, text:ln.text});
  });

  c.innerHTML = html;

  let qi=0;
  const next=()=>{
    if(qi>=queue.length) return;
    const item=queue[qi++];
    if(item.reveal){
      const el=document.getElementById(item.reveal);
      if(el){ el.style.opacity='1'; el.style.pointerEvents='auto'; }
      next();
    } else {
      const el=document.getElementById(item.id);
      typedSegments.add(item.id);
      typeWriter(el, item.text, 28, next);
    }
  };
  next();
}

function addStoryLine(speaker, text){
  if(!game.storyExtra) game.storyExtra=[];
  game.storyExtra.push({ speaker, text });
  renderStory();
}


/* ========== TYPEWRITER ========== */
let typingTimers = [];
function clearTyping(){ typingTimers.forEach(t=>clearTimeout(t)); typingTimers = []; }

function typeWriter(el, text, speed=28, done){
  el.textContent = '';
  let i = 0;
  const step = () => {
    if(i < text.length){
      el.textContent += text.charAt(i);
      if(text.charAt(i) !== ' ') audio.type();   // blip per visible char
      i++;
      typingTimers.push(setTimeout(step, speed));
    } else if(done){ done(); }
  };
  step();
}

/* ========== COOK ========== */
function cook(id){
  const r=recipes.find(x=>x.id===id); if(!r) return;
  for(const m of r.materials){ if((state.inventory[m.good]||0)<m.qty){ logMsg(`Not enough ${NAMES[m.good]} for ${r.name}.`); return; } }
  r.materials.forEach(m=>{ state.inventory[m.good]-=m.qty; });
  const purity = state.assets.chemist>0 ? (55+state.assets.chemist*12) : 50;
  addMethBatch(purity, r.yield);
  logMsg(`${r.name} complete: +${r.yield} batch @ ${purity}% purity.`);
  render();
  autosave();
}
/* ========== LOG ========== */
function logMsg(msg){
  const log=document.getElementById('log'); if(!log) return;
  const d=document.createElement('div'); d.textContent=msg;
  log.prepend(d); while(log.children.length>12) log.removeChild(log.lastChild);
}

/* ========== MASTER RENDER ========== */
function render(){
  document.getElementById('money').textContent=fmt(state.money);
  document.getElementById('digital').textContent=fmt(state.digital);
  renderProduction(); renderInventory(); renderMarket(); renderProperties(); renderCharacter(); renderLogistics();
}

/* ========== MENU / FLOW ========== */
function showMenu(){
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('game').classList.add('hidden');
}
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

function startGame(){
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="story"]').classList.add('active');
  document.getElementById('story').classList.add('active');
  typedSegments.clear();
  applyTabLocks();
 render(); renderNotes(); renderStory();
 if(game.tutorialActive) setTimeout(refreshTutorial, 100);
  startGameClock(); updateSleepButton();
  logMsg(`System initialized for ${game.player_name} // ${game.business_name}.`);
}

function applyTabLocks(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    const tab = btn.dataset.tab;
    const unlocked = game.devAllowed || ALWAYS_UNLOCKED.includes(tab) || (game.extraUnlocked && game.extraUnlocked.includes(tab));
    btn.classList.toggle('locked', !unlocked);
    const base = btn.textContent.replace(/^🔒\s*/, '');
    btn.textContent = unlocked ? base : '🔒 ' + base;
  });
}

/* Menu button clicks */
document.querySelectorAll('.menu-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const m = btn.dataset.menu;
    if(m === 'new') openModal('modal-name');
    else if(m === 'continue') openSlotModal('load');
    else if(m === 'settings') openModal('modal-settings');
    else if(m === 'quit') { document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#33aaff;letter-spacing:2px;">SESSION TERMINATED.</div>'; }
  });
});

/* Name modal */
function submitName(){
  const v = document.getElementById('input-player-name').value.trim();
  if(!v) return;
  game.player_name = v;
  closeModal('modal-name');
  openModal('modal-business');
  document.getElementById('input-business-name').focus();
}
document.getElementById('confirm-name').addEventListener('click', submitName);
document.getElementById('input-player-name').addEventListener('keydown', e=>{ if(e.key==='Enter') submitName(); });

/* Business modal */
function submitBusiness(){
  const v = document.getElementById('input-business-name').value.trim();
  if(!v) return;
  game.business_name = v;
  closeModal('modal-business');
  openSlotModal('new');     // pick a slot to save the new game into
}
document.getElementById('confirm-business').addEventListener('click', submitBusiness);
document.getElementById('input-business-name').addEventListener('keydown', e=>{ if(e.key==='Enter') submitBusiness(); });

/* Settings modal */
document.getElementById('close-settings').addEventListener('click', ()=>closeModal('modal-settings'));

/* ========== COMMAND CONSOLE (Ctrl-B) ========== */
document.addEventListener('keydown', e=>{
  if(e.ctrlKey && (e.key === 'b' || e.key === 'B')){
    e.preventDefault();
    const c = document.getElementById('console');
    c.classList.toggle('active');
    if(c.classList.contains('active')) document.getElementById('console-input').focus();
  }
});
/* Click sound on any button */
document.addEventListener('click', e=>{
  if(e.target.closest('button')) audio.click();
});
document.getElementById('console-input').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){
    runCommand(e.target.value.trim().toLowerCase());
    e.target.value = '';
  } else if(e.key === 'Escape'){
    document.getElementById('console').classList.remove('active');
  }
});
function runCommand(cmd){
  if(!cmd) return;
  const parts = cmd.split(/\s+/);
  const base = parts[0];

  if(base === 'dev_allowed'){
    game.devAllowed = true;
    applyTabLocks();
    autosave();
    logMsg('DEV ACCESS GRANTED — all tabs unlocked.');
    return;
  }

  // give <item> <amount>   e.g.  give pseudo 5
  if(base === 'give'){
    const alias = {
      pseudo:'pseudoephedrine', pseudoephedrine:'pseudoephedrine',
      ephedrine:'ephedrine', ephe:'ephedrine',
      phenyl:'phenylacetone', phenylacetone:'phenylacetone', p2p:'phenylacetone',
      agent:'reactingAgent', reactingagent:'reactingAgent', ra:'reactingAgent'
    };
    // money <amount>  |  digital <amount>
  if(base === 'money' || base === 'digital'){
    const amt = parseInt(parts[1], 10);
    if(isNaN(amt)){ logMsg(`Usage: ${base} <amount>`); return; }
    if(base === 'money') state.money += amt;
    else state.digital += amt;
    render(); autosave();
    logMsg(`${base==='money'?'CASH':'DIGITAL'} adjusted by $${fmt(amt)}.`);
    return;
  }
    const good = alias[parts[1]];
    const amt  = parseInt(parts[2], 10);
    if(!good){ logMsg(`Unknown item: ${parts[1]||'(none)'}. Try: pseudo, ephedrine, phenyl, agent`); return; }
    if(isNaN(amt) || amt <= 0){ logMsg('Usage: give <item> <amount>'); return; }
    state.inventory[good] = (state.inventory[good]||0) + amt;
    render(); autosave();
    logMsg(`+${amt} ${NAMES[good]} added.`);
    return;
  }

  // give_all <amount>   e.g.  give_all 10
  if(base === 'give_all'){
    const amt = parseInt(parts[1], 10);
    if(isNaN(amt) || amt <= 0){ logMsg('Usage: give_all <amount>'); return; }
    ['pseudoephedrine','ephedrine','phenylacetone','reactingAgent'].forEach(g=>{
      state.inventory[g] = (state.inventory[g]||0) + amt;
    });
    render(); autosave();
    logMsg(`+${amt} of every precursor chemical added.`);
    return;
  }

  // money <amount>   e.g.  money 5000
  if(base === 'money'){
    const amt = parseInt(parts[1], 10);
    if(isNaN(amt)){ logMsg('Usage: money <amount>'); return; }
    state.money += amt;
    render(); autosave();
    logMsg(`Balance adjusted by $${fmt(amt)}.`);
    return;
  }

  // settime <hour 0-23>  -> jump the game clock (for testing)
  if(base === 'settime'){
    const h = parseInt(parts[1], 10);
    if(isNaN(h) || h < 0 || h > 23){ logMsg('Usage: settime <hour 0-23>'); return; }
    game.time = h * 60;
    game.sleepOffered = false;
    game.sleepForced  = false;
    renderGameClock(); updateSleepButton();
    logMsg(`Time set to ${fmtTime(game.time)}.`);
    return;
  }

  // sleep -> force-open the sleep modal right now (for testing)
  if(base === 'sleep'){
    openSleepModal(false);
    logMsg('Sleep menu opened.');
    return;
  }

  logMsg(`Unknown command: ${cmd}`);
}

/* ========== TUTORIAL ========== */
const tutorialSteps = [
  { key:'start',        selector:'.tab-btn[data-tab="production"]' },
  { key:'pickCategory', selector:'[data-prodcat="synthstim"]' },
  { key:'chooseRecipe', selector:'#choose-recipe' },
  { key:'pickRecipe',   selector:'[data-cook="pseudo"]' },
  { key:'pickProperty', selector:'.cook-select' },
  { key:'pickWorker',   selector:'[data-cookworker]' },
  { key:'confirm',      selector:'#confirm-cook' }
];

function startTutorial(){
  if(game.tutorialDone) return;
  if(!game.extraUnlocked) game.extraUnlocked = [];
  if(!game.extraUnlocked.includes('production')) game.extraUnlocked.push('production');
  applyTabLocks();
  game.tutorialActive = true;
  game.tutorialStep = 0;
  addStoryLine('Gabriel', LOCALE.tutorial.start());
  refreshTutorial();
  autosave();
}

function nextTutorialStep(){
  game.tutorialStep++;
  if(game.tutorialStep >= tutorialSteps.length){ finishTutorial(); return; }
  const step = tutorialSteps[game.tutorialStep];
  addStoryLine('Gabriel', LOCALE.tutorial[step.key]());
  refreshTutorial();
}

function refreshTutorial(){
  if(!game.tutorialActive) return;
  const step = tutorialSteps[game.tutorialStep];
  if(!step) return;
  showGabriel(LOCALE.tutorial[step.key]());
  positionArrow(step.selector);
}

function finishTutorial(){
  game.tutorialActive = false;
  game.tutorialDone = true;
  hideArrow();
  addStoryLine('Gabriel', LOCALE.tutorial.cooking());
  showGabriel(LOCALE.tutorial.cooking());
  autosave();
  setTimeout(hideGabriel, 6000);
}

function positionArrow(selector){
  const arrow = document.getElementById('tutorial-arrow');
  if(!arrow) return;
  const el = document.querySelector(selector);
  if(!el){ arrow.style.display='none'; return; }
  const r = el.getBoundingClientRect();
  arrow.style.display = 'block';
  arrow.style.top  = (r.top - 34) + 'px';
  arrow.style.left = (r.left + r.width/2 - 12) + 'px';
}

function showGabriel(text){ const b=document.getElementById('gabriel-bubble'); if(b){ b.textContent=text; b.style.display='block'; } }
function hideGabriel(){ const b=document.getElementById('gabriel-bubble'); if(b) b.style.display='none'; }
function hideArrow(){ const a=document.getElementById('tutorial-arrow'); if(a) a.style.display='none'; }

/* dedicated listener — advances when the correct element is clicked */
document.addEventListener('click', e=>{
  if(!game.tutorialActive) return;
  const step = tutorialSteps[game.tutorialStep];
  if(step && e.target.closest(step.selector)){ nextTutorialStep(); }
  else { setTimeout(refreshTutorial, 0); }
});
window.addEventListener('resize', refreshTutorial);
window.addEventListener('scroll', ()=>{ if(game.tutorialActive) refreshTutorial(); }, true);

/* ========== TAB SWITCHING ========== */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(btn.classList.contains('locked')) return;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/* ========== GLOBAL CLICK HANDLER ========== */
document.addEventListener('click', e=>{
  const pc=e.target.closest('[data-prodcat]');
  if(pc){ ui.prodOpen = ui.prodOpen===pc.dataset.prodcat?null:pc.dataset.prodcat; ui.recipeOpen=false; renderProduction(); return; }
  const ic=e.target.closest('[data-invcat]');
  if(ic){ ui.invOpen = ui.invOpen===ic.dataset.invcat?null:ic.dataset.invcat; renderInventory(); return; }
  const mt=e.target.closest('[data-methtoggle]');
  if(mt){ ui.methOpen = !ui.methOpen; renderInventory(); return; }
  const mc=e.target.closest('[data-marketcat]');
  if(mc){ ui.marketOpen = ui.marketOpen===mc.dataset.marketcat?null:mc.dataset.marketcat; ui.negotiate=null; renderMarket(); return; }
  const prc=e.target.closest('[data-propcat]');
  if(prc){ ui.propOpen = ui.propOpen===prc.dataset.propcat?null:prc.dataset.propcat; renderProperties(); return; }
  const lg=e.target.closest('[data-logi]');
  if(lg){ const id=lg.dataset.logi; ui.logiOpen = ui.logiOpen===id?null:id; renderLogistics(); return; }
  const cc=e.target.closest('[data-charcat]');
  if(cc){ ui.charOpen = ui.charOpen===cc.dataset.charcat?null:cc.dataset.charcat; renderCharacter(); return; }
  const pt=e.target.closest('[data-playertab]');
  if(pt){ ui.playerTab = pt.dataset.playertab; renderCharacter(); return; }

  const ss=e.target.closest('[data-setsleep]');
  if(ss){ game.sleepPlace = ss.dataset.setsleep; renderProperties(); logMsg('Active sleeping place updated.'); return; }

 const pn=e.target.closest('[data-partner]');
  if(pn){ const id=pn.dataset.partner; ui.charPartnerOpen = ui.charPartnerOpen===id?null:id; renderCharacter(); return; }
  const ipx=e.target.closest('[data-illegalprop]');
  if(ipx){ const id=ipx.dataset.illegalprop; ui.illegalOpen = ui.illegalOpen===id?null:id; renderProperties(); return; }

  if(e.target.id==='choose-recipe'){ ui.recipeOpen=!ui.recipeOpen; renderProduction(); return; }
  if(e.target.dataset.cook){ startCookFlow(e.target.dataset.cook); return; }
  if(e.target.dataset.cookworker){ selectCookWorker(e.target.dataset.cookworker); return; }
  if(e.target.id==='confirm-cook'){ confirmCook(); return; }
  if(e.target.id==='cancel-cook'){ cancelCookFlow(); return; }
  const neg=e.target.closest('[data-negotiate]');
  if(neg){ ui.negotiate=neg.dataset.negotiate; renderMarket(); return; }
  if(e.target.id==='neg-back'){ ui.negotiate=null; renderMarket(); return; }

  if(e.target.dataset.note){ openNote(e.target.dataset.note); return; }

if(e.target.classList.contains('choice')){
    const entry = LOCALE.story.entries.find(en => en.options && en.options.some(o=>o.id===e.target.dataset.choice));
    if(entry && !game.resolvedChoices.includes(entry.id)) game.resolvedChoices.push(entry.id);
    if(e.target.dataset.choice === 'option_b'){
      addStoryLine(get_player(), "Alright, let's get going.");
      logMsg(`${get_player()}: Alright, let's get going.`);
      startTutorial();
    } else {
      addStoryLine(get_player(), "Hey, let's talk about this.");
      logMsg(`${get_player()}: Hey, let's talk about this.`);
    }
    return;
  }
});

/* ========== CLOCK ========== */
function tick(){ document.getElementById('clock').textContent=new Date().toLocaleTimeString(); }
setInterval(tick,1000); tick();
/* ========== AUTOSAVE TIMER (every 5 minutes) ========== */
setInterval(()=>{
  if(game.slot){
    saveGame(game.slot);
    logMsg('Auto-saved.');
  }
}, 5 * 60 * 1000);   // 300,000 ms = 5 minutes

/* ========== INIT ========== */
showMenu();