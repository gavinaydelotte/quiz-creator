/* FlashForge — Daily Streak Tracker
 *
 * Storage key: 'qf-streak' → { current, longest, lastDate ('YYYY-MM-DD') }
 *
 * Call recordStudy() at the end of any study session.
 * Returns the updated streak object so callers can show feedback.
 */
var Streak = (function () {
  var KEY = 'qf-streak';

  var MILESTONES = [
    { days: 3,   label: 'On a Roll' },
    { days: 7,   label: 'Week Warrior' },
    { days: 14,  label: 'Two Weeks Strong' },
    { days: 30,  label: 'Monthly Master' },
    { days: 100, label: 'Centurion' },
  ];

  function dateStr(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }
  function today()     { return dateStr(new Date()); }
  function yesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { current: 0, longest: 0, lastDate: null }; }
    catch (e) { return { current: 0, longest: 0, lastDate: null }; }
  }
  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  return {
    MILESTONES: MILESTONES,

    /* Record a study session; returns updated streak data */
    recordStudy: function () {
      var data = load();
      var t    = today();
      if (data.lastDate === t) return data; /* already counted today */

      data.current = (data.lastDate === yesterday()) ? data.current + 1 : 1;
      if (data.current > data.longest) data.longest = data.current;
      data.lastDate = t;
      save(data);
      return data;
    },

    get: function () { return load(); },

    /* Highest milestone the user has reached at n days */
    getBadge: function (n) {
      var badge = null;
      MILESTONES.forEach(function (m) { if (n >= m.days) badge = m; });
      return badge;
    },

    /* True only on the exact milestone day (for "badge earned" toasts) */
    isMilestone: function (n) {
      return MILESTONES.some(function (m) { return m.days === n; });
    },
  };
})();
