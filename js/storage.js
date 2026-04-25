/* QuizForge — Data Layer (localStorage + Firestore sync) */
var Storage = (function () {
  var KEY = 'qf-sets';

  var SAMPLE_SETS = [
    {
      id: 'sample-1',
      title: 'World Capitals',
      description: 'Test your knowledge of world capitals',
      category: 'Geography',
      createdAt: new Date().toISOString(),
      cards: [
        { id: 's1a', term: 'France',    definition: 'Paris' },
        { id: 's1b', term: 'Japan',     definition: 'Tokyo' },
        { id: 's1c', term: 'Brazil',    definition: 'Brasília' },
        { id: 's1d', term: 'Australia', definition: 'Canberra' },
        { id: 's1e', term: 'Canada',    definition: 'Ottawa' },
        { id: 's1f', term: 'Germany',   definition: 'Berlin' },
        { id: 's1g', term: 'Egypt',     definition: 'Cairo' },
        { id: 's1h', term: 'Argentina', definition: 'Buenos Aires' },
      ],
    },
    {
      id: 'sample-2',
      title: 'Marvel Universe',
      description: 'Heroes, villains, and everything in between',
      category: 'Entertainment',
      createdAt: new Date().toISOString(),
      cards: [
        { id: 's2a', term: 'Iron Man',      definition: 'Tony Stark — genius billionaire in a powered suit of armor' },
        { id: 's2b', term: 'Thanos',        definition: 'The Mad Titan who seeks the Infinity Stones to reshape the universe' },
        { id: 's2c', term: 'Black Widow',   definition: 'Natasha Romanoff — master spy, assassin, and founding Avenger' },
        { id: 's2d', term: 'Vibranium',     definition: "A rare metal found in Wakanda, used in Captain America's shield" },
        { id: 's2e', term: 'S.H.I.E.L.D.', definition: 'Strategic Homeland Intervention, Enforcement and Logistics Division' },
        { id: 's2f', term: 'The Snap',      definition: 'Thanos using the Infinity Gauntlet to eliminate half of all life' },
      ],
    },
    {
      id: 'sample-3',
      title: 'Cooking Essentials',
      description: 'Key terms every home chef should know',
      category: 'Lifestyle',
      createdAt: new Date().toISOString(),
      cards: [
        { id: 's3a', term: 'Sauté',         definition: 'Cook quickly in a small amount of fat over high heat' },
        { id: 's3b', term: 'Blanching',     definition: 'Briefly boiling food then plunging it into ice water to stop cooking' },
        { id: 's3c', term: 'Mise en Place', definition: 'Having all ingredients prepped and ready before you start cooking' },
        { id: 's3d', term: 'Deglaze',       definition: 'Adding liquid to a hot pan to loosen and dissolve browned bits' },
        { id: 's3e', term: 'Fold',          definition: 'Gently combine ingredients to preserve air in a light mixture' },
      ],
    },
    {
      id: 'sample-4',
      title: 'Programming Basics',
      description: 'Core concepts every developer should know',
      category: 'Technology',
      createdAt: new Date().toISOString(),
      cards: [
        { id: 's4a', term: 'Variable', definition: 'A named container that stores a value in memory' },
        { id: 's4b', term: 'Function', definition: 'A reusable block of code that performs a specific task' },
        { id: 's4c', term: 'Array',    definition: 'An ordered list of elements accessible by numeric index' },
        { id: 's4d', term: 'Loop',     definition: 'A structure that repeats a block of code until a condition is met' },
        { id: 's4e', term: 'API',      definition: 'Application Programming Interface — a contract between software components' },
        { id: 's4f', term: 'Boolean',  definition: 'A data type with only two values: true or false' },
      ],
    },
  ];

  function _defaults() {
    var sets = SAMPLE_SETS.map(function (s) {
      return Object.assign({}, s, { createdAt: new Date().toISOString() });
    });
    localStorage.setItem(KEY, JSON.stringify(sets));
    return sets;
  }

  return {
    getAll: function () {
      try {
        var raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : _defaults();
      } catch (e) { return _defaults(); }
    },

    save: function (sets) {
      localStorage.setItem(KEY, JSON.stringify(sets));
    },

    getOne: function (id) {
      return this.getAll().find(function (s) { return s.id === id; }) || null;
    },

    add: function (set) {
      var newSet = Object.assign({}, set, {
        id: 'set-' + Date.now(),
        createdAt: new Date().toISOString(),
      });
      var sets = this.getAll();
      sets.unshift(newSet);
      this.save(sets);
      if (window.Sync && Sync.active()) Sync.push(newSet);
      return newSet.id;
    },

    update: function (id, updates) {
      var sets = this.getAll();
      var idx  = sets.findIndex(function (s) { return s.id === id; });
      if (idx !== -1) {
        sets[idx] = Object.assign({}, sets[idx], updates);
        this.save(sets);
        if (window.Sync && Sync.active()) Sync.push(sets[idx]);
      }
    },

    delete: function (id) {
      this.save(this.getAll().filter(function (s) { return s.id !== id; }));
      if (window.Sync && Sync.active()) Sync.remove(id);
    },
  };
})();
