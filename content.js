/* ============================================================
   LOCALISATION / CONTENT
   Edit wording here. Game logic lives in script.js.
   - get_player()   -> returns the player's chosen name
   - get_business() -> returns the business name
   Wrap any line that uses a name in a function: () => `...`
   ============================================================ */

function get_player(){
  return (typeof game !== 'undefined' && game.player_name) ? game.player_name : 'Unknown';
}
function get_business(){
  return (typeof game !== 'undefined' && game.business_name) ? game.business_name : '—';
}

const LOCALE = {
  story: {
    entries: [
      {
        id: 'beginnings',
        title: 'Beginnings',
        text: () => `Your name is ${get_player()} you're broke, frankly. Your family dislikes you and has kicked you out. You have little to no friends beyond Gabriel. Luckily for you, Gabriel is also broke. The idea? Use his Masters Chemistry degree to cook high purity illicit substances while avoiding regulated precursors.`
      },
      {
        id: 'whatNow',
        title: 'What Now?',
        speaker: 'Gabriel',
        line: () => `"Hey ${get_player()}, we need to get to work."`,
        options: [
          { id: 'option_a', text: "Hey, let's talk about this", tooltip: "Doesn't Skip the Intro" },
          { id: 'option_b', text: "Alright, let's get going",   tooltip: "Skips the Intro" }
        ]
      }
    ]
  },

  notes: [
    { id: 'goals', title: 'Current Goals', body: 'Make 25K USD' }
  ]

  ,
  tutorial: {
    start:        () => "Alright. Let's cook a batch of Meth — open Production.",
    pickCategory: () => "Synthetic Stimulants. That's our department.",
    chooseRecipe: () => "Now hit Choose Recipe.",
    pickRecipe:   () => "Pseudo Cook — start with that.",
    pickProperty: () => "Pick the lab we'll be working out of.",
    pickWorker:   () => "Now choose who's doing the cooking.",
    confirm:      () => "Lock it in. Confirm the cook.",
    cooking:      () => "Now we wait until it's cooked."
  }
};