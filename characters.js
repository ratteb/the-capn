/* ============================================================
   NON-PLAYER CHARACTERS — Partners/Employees
   Grouped lists, clickable stat cards, assignment + jobs.
   ============================================================ */

const employeeCategories = [
  { id:'chemist',  label:'Chemists' },
  { id:'botanist', label:'Botanists' },
  { id:'security', label:'Security' },
  { id:'mule',     label:'Mule Workers' }
];

const characters = [
  {
    id:'gabriel', name:'Gabriel', role:'Partner',
    category:'chemist',
    skills:{ chemistry:2, negotiation:3, strength:2, cultivation:1 },
    assignedProperty:'shakebake',
    job:null   // { name, endAbs, recipe, yield, purity, propertyId } or null
  }
];

function getCharacter(id){ return characters.find(c => c.id === id); }
function isBusy(c){ return !!c.job; }

/* which employee type a property accepts */
function propertyAllowedCategory(cat){
  if(cat==='lab')        return 'chemist';
  if(cat==='plantation') return 'botanist';
  if(cat==='warehouse')  return 'mule';
  return null;
}
function countAssigned(pid, excludeId){
  let n = characters.filter(c => c.assignedProperty===pid && c.id!==excludeId).length;
  if(typeof game!=='undefined' && game.assignedProperty===pid && excludeId!=='__player__') n++;
  return n;
}

/* ---------- ASSIGNMENT ---------- */
function assignCharacter(cid, pid){
  const c = getCharacter(cid); if(!c) return;
  if(isBusy(c)){ logMsg(`${c.name} is busy and can't be reassigned.`); renderCharacter(); return; }
  if(!pid){ c.assignedProperty=null; renderCharacter(); autosave(); logMsg(`${c.name} unassigned.`); return; }

  const prop = illegalProperties.find(p=>p.id===pid);
  if(!prop) return;
  const allowed = propertyAllowedCategory(prop.category);
  if(allowed && c.category!==allowed){ logMsg(`${c.name} (${c.category}) can't work a ${prop.category}.`); renderCharacter(); return; }
  const limit = prop.stats.employeeLimit||0;
  if(countAssigned(pid, cid) >= limit){ logMsg(`${prop.name} is full (limit ${limit}).`); renderCharacter(); return; }

  c.assignedProperty = pid;
  renderCharacter(); autosave();
  logMsg(`${c.name} assigned to ${prop.name}.`);
}

/* ---------- RENDER ---------- */
function partnersHtml(){
  return employeeCategories.map(cat=>{
    const members = characters.filter(c => c.category === cat.id);
    const body = members.length ? members.map(characterRowHtml).join('') : '<div class="na">N/A</div>';
    return `<div class="rname" style="margin-top:6px;">${cat.label}</div>${body}`;
  }).join('');
}

function characterRowHtml(c){
  const open = ui.charPartnerOpen === c.id;
  let busyTag = '';
  if(isBusy(c)){
    const left = Math.max(0, c.job.endAbs - absMinutes());
    const h = Math.floor(left/60), m = left%60;
    busyTag = ` <span class="inv-qty">[ ${c.job.name} — ${h}h ${m}m ]</span>`;
  }

  let row = `<div class="row char-row" data-partner="${c.id}">
      <div class="info">
        <div class="name">${c.name} <span class="meth-hint">${open?'[ click to collapse ]':'[ click to inspect ]'}</span>${busyTag}</div>
        <div class="sub">${c.role}</div>
      </div>
      <span class="inv-qty">${open?'▾':'▸'}</span>
    </div>`;

  if(open){
    const skill = (label, val) => {
      const pips = '●'.repeat(val) + '○'.repeat(MAX_SKILL - val);
      return `<div class="row"><div class="info"><div class="name">${label}</div></div>
        <span class="inv-qty">${pips} (${val}/${MAX_SKILL})</span></div>`;
    };
    const propName = c.assignedProperty
      ? ((typeof illegalProperties!=='undefined' && illegalProperties.find(p=>p.id===c.assignedProperty)?.name) || c.assignedProperty)
      : 'None';
    const jobName = isBusy(c) ? c.job.name : 'Idle';

    // assignment dropdown (only properties matching this employee's category)
    const opts = (typeof illegalProperties!=='undefined' ? illegalProperties : [])
      .filter(p=>propertyAllowedCategory(p.category)===c.category);
    let assignSel = `<select class="cook-select" ${isBusy(c)?'disabled':''} onchange="assignCharacter('${c.id}', this.value)">
        <option value="" ${!c.assignedProperty?'selected':''}>-- Unassigned --</option>`;
   opts.forEach(p=>{
      const used = countAssigned(p.id);                       // true count
      const alreadyHere = c.assignedProperty===p.id;
      const full = !alreadyHere && used >= (p.stats.employeeLimit||0);
      assignSel += `<option value="${p.id}" ${alreadyHere?'selected':''} ${full?'disabled':''}>${p.name} (${used}/${p.stats.employeeLimit||0})</option>`;
    });
    assignSel += `</select>`;

    row += `<div class="char-detail">
        <div class="rname" style="margin-top:6px;">Skills</div>
        ${skill('Chemistry',   c.skills.chemistry)}
        ${skill('Negotiation', c.skills.negotiation)}
        ${skill('Strength',    c.skills.strength)}
        ${skill('Cultivation', c.skills.cultivation)}
        <div class="row"><div class="info"><div class="name">Assigned at Property</div></div>
          <span class="inv-qty">${propName}</span></div>
        <div class="row"><div class="info"><div class="name">Assigned at Job</div></div>
          <span class="inv-qty">${jobName}</span></div>
        <div class="rname" style="margin-top:6px;">Reassign</div>
        ${assignSel}
      </div>`;
  }
  return row;
}

/* ---------- JOB COMPLETION (called every game-minute) ---------- */
function checkJobs(){
  let changed=false;
  characters.forEach(c=>{
    if(c.job && absMinutes() >= c.job.endAbs){
      addMethBatch(c.job.purity, c.job.yield);
      logMsg(`${c.name} finished ${c.job.name}: +${c.job.yield} batch @ ${c.job.purity}%.`);
      c.job=null; changed=true;
    }
  });
  if(changed){ render(); autosave(); }
}