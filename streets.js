/* ============================================================
   STREETS MODE
   Toggles a red-themed alternate UI with relabeled buttons.
   All names here are PLACEHOLDERS — edit freely later.
   Logic stays here; wording stays here too (self-contained).
   ============================================================ */

const STREETS = {
  tabs: {
    production: 'The Grind',
    inventory:  'The Stash',
    market:     'The Plug',
    character:  'The Rep',
    properties: 'The Blocks',
    story:      'The Word',
    notes:      'The Ledger'
  },
  prod: {
    synthstim:'Block Synth', stim:'Block Stim', synthop:'Block Down',
    opioids:'Block Tar', party:'Block Roll', cannabis:'Block Green'
  },
  inv: {
    synthstim:'Synth Stash', stim:'Stim Stash', synthop:'Down Stash',
    opioids:'Tar Stash', party:'Roll Stash', cannabis:'Green Stash'
  },
  market: {
    precursor:'The Supplier', smuggling:'The Mule', smurf:'The Runner'
  },
  prop: {
    legal:'Clean Houses', illegal:'Trap Houses', personal:'Crib'
  },
  char: {
    player:'Your Rep', partners:'The Crew', connections:'The Network'
  }
};

/* ---------- internal: snapshot originals so we can toggle back ---------- */
const CATEGORY_REFS = {
  prod:   prodCategories,
  inv:    invCategories,
  market: marketCategories,
  prop:   propCategories,
  char:   charCategories
};
const ORIGINAL_NAMES = {};
for(const key in CATEGORY_REFS){
  ORIGINAL_NAMES[key] = {};
  CATEGORY_REFS[key].forEach(c => ORIGINAL_NAMES[key][c.id] = c.name);
}
const TAB_ORIGINALS = {};
document.querySelectorAll('.tab-btn').forEach(b => TAB_ORIGINALS[b.dataset.tab] = b.textContent.trim());

/* ---------- apply / restore labels ---------- */
function applyCategoryLabels(streets){
  for(const key in CATEGORY_REFS){
    CATEGORY_REFS[key].forEach(c => {
      const override = streets && STREETS[key] && STREETS[key][c.id];
      c.name = override ? override : ORIGINAL_NAMES[key][c.id];
    });
  }
}
function applyTabLabels(streets){
  document.querySelectorAll('.tab-btn').forEach(b => {
    const t = b.dataset.tab;
    b.textContent = (streets && STREETS.tabs[t]) ? STREETS.tabs[t] : TAB_ORIGINALS[t];
  });
  applyTabLocks();   // re-applies 🔒 prefixes on locked tabs
}

/* ---------- the toggle ---------- */
function toggleStreets(){
  game.streets = !game.streets;
  document.body.classList.toggle('streets-mode', game.streets);

  applyCategoryLabels(game.streets);
  applyTabLabels(game.streets);

  const btn = document.getElementById('streets-btn');
  if(btn) btn.textContent = game.streets ? '⬑ RETURN TO BASE' : '☰ ENTER THE STREETS';

  // collapse any open sub-panels so they re-render with new labels
  ui.prodOpen = ui.invOpen = ui.marketOpen = ui.propOpen = ui.charOpen = null;
  ui.negotiate = null;

  render();
  logMsg(game.streets ? 'You step out into the streets...' : 'You head back to base.');
}

/* hook up the button */
const _streetsBtn = document.getElementById('streets-btn');
if(_streetsBtn) _streetsBtn.addEventListener('click', toggleStreets);