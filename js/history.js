/* FlashForge — Score History
 * Records one entry per completed study session and provides a getter per set.
 * Storage key: 'qf-history' → array of entries, oldest first, capped at 500.
 * Entry shape: { setId, mode, pct, correct, total, date (ISO string) }
 */
var History = (function () {
  var KEY = 'qf-history';
  var MAX = 500;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  return {
    record: function (entry) {
      var data = load();
      data.push(Object.assign({}, entry, { date: new Date().toISOString() }));
      if (data.length > MAX) data = data.slice(data.length - MAX);
      save(data);
    },

    getForSet: function (setId) {
      return load().filter(function (e) { return e.setId === setId; });
    },
  };
})();
