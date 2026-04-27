/* FlashForge — Spaced Repetition (SM-2 algorithm)
 *
 * Each card gets a scheduling record: { ef, interval, reps, dueDate }
 *   ef       — easiness factor (starts 2.5; higher = longer gaps)
 *   interval — days until next review
 *   reps     — consecutive correct-recall streak
 *   dueDate  — ISO string of next scheduled review
 *
 * Grades fed to update(): 4 = Got It, 1 = Missed  (SM-2 uses 0–5)
 * Cards never studied are always considered due.
 *
 * Storage key: 'qf-sr' → { [setId]: { [cardId]: record } }
 */
var SR = (function () {
  var KEY = 'qf-sr';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  /* Apply SM-2 and write updated record back to localStorage */
  function update(setId, cardId, grade) {
    var data = load();
    if (!data[setId]) data[setId] = {};
    var c = data[setId][cardId] || { ef: 2.5, interval: 1, reps: 0 };

    if (grade < 3) {
      /* Incorrect: start interval over from tomorrow */
      c.reps     = 0;
      c.interval = 1;
    } else {
      /* Correct: step up the interval */
      if      (c.reps === 0) c.interval = 1;
      else if (c.reps === 1) c.interval = 6;
      else                   c.interval = Math.round(c.interval * c.ef);

      /* Adjust easiness factor (SM-2 formula) */
      c.ef = c.ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
      if (c.ef < 1.3) c.ef = 1.3;
      c.reps++;
    }

    var due = new Date();
    due.setDate(due.getDate() + c.interval);
    c.dueDate = due.toISOString();

    data[setId][cardId] = c;
    save(data);
  }

  /* Cards with no record or whose dueDate is now or past */
  function getDue(setId, cards) {
    var now     = new Date();
    var data    = load();
    var setData = data[setId] || {};
    return cards.filter(function (card) {
      var c = setData[card.id];
      return !c || !c.dueDate || new Date(c.dueDate) <= now;
    });
  }

  function dueCount(setId, cards) {
    return getDue(setId, cards).length;
  }

  return { update: update, getDue: getDue, dueCount: dueCount };
})();
