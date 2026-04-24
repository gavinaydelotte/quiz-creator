/* QuizForge — Main Application (router + all pages) */

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */

var $app = document.getElementById('app');
var _activeTimer = null;
var _aiCallback  = null;
var _confirmCb   = null;

/* Escape user content before injecting into innerHTML */
function e(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function navigate(path) {
  location.hash = path;
}

function clearTimer() {
  if (_activeTimer) { clearInterval(_activeTimer); _activeTimer = null; }
}

function announce(msg) {
  var el = document.getElementById('page-announcer');
  if (!el) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = msg; }, 80);
}

function showToast(msg, type) {
  var old = document.getElementById('qf-toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.id = 'qf-toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.className = 'toast' + (type ? ' toast-' + type : ' toast-success');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add('toast-show'); }, 10);
  setTimeout(function () { t.classList.remove('toast-show'); setTimeout(function () { t.remove(); }, 280); }, 3200);
}

/* ══════════════════════════════════════
   SHARED COMPONENT: SET CARD
══════════════════════════════════════ */

function createSetCard(set, onDelete) {
  var dateStr = new Date(set.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  var article = document.createElement('article');
  article.className = 'set-card card';

  article.innerHTML =
    '<div class="set-card-body">' +
      '<header class="set-card-header">' +
        '<span class="set-card-cat"></span>' +
        '<div class="set-card-actions" role="group" aria-label="Set actions">' +
          '<a href="#/create/' + e(set.id) + '" class="btn btn-ghost btn-icon" aria-label="Edit set" title="Edit">&#9998;</a>' +
          '<button class="btn btn-icon set-card-delete" type="button" aria-label="Delete set" title="Delete">&#10005;</button>' +
        '</div>' +
      '</header>' +
      '<h3 class="set-card-title"></h3>' +
      (set.description ? '<p class="set-card-desc"></p>' : '') +
      '<footer class="set-card-footer">' +
        '<span class="set-card-count">' + set.cards.length + ' card' + (set.cards.length !== 1 ? 's' : '') + '</span>' +
        '<time datetime="' + e(set.createdAt) + '" class="set-card-date">' + dateStr + '</time>' +
      '</footer>' +
    '</div>';

  /* Set text content safely */
  article.querySelector('.set-card-cat').textContent   = set.category || 'Uncategorized';
  article.querySelector('.set-card-title').textContent = set.title;
  if (set.description) article.querySelector('.set-card-desc').textContent = set.description;

  /* Navigate on body click (not on action buttons) */
  article.querySelector('.set-card-body').addEventListener('click', function (ev) {
    if (ev.target.closest('a, button')) return;
    navigate('#/set/' + set.id);
  });
  article.querySelector('.set-card-body').style.cursor = 'pointer';

  /* Delete */
  article.querySelector('.set-card-delete').addEventListener('click', function (ev) {
    ev.stopPropagation();
    showConfirm('Delete "' + set.title + '"? This cannot be undone.', function () {
      Storage.delete(set.id);
      showToast('"' + set.title + '" deleted');
      if (typeof onDelete === 'function') onDelete();
    });
  });

  return article;
}

/* ══════════════════════════════════════
   DIALOGS
══════════════════════════════════════ */

function showConfirm(message, cb) {
  _confirmCb = cb;
  document.getElementById('confirm-msg').textContent = message;
  document.getElementById('confirm-dialog').showModal();
}

function openAIDialog(cb) {
  /* If no key is saved, open settings first with a prompt */
  if (!AI.getKey()) {
    document.getElementById('api-key-input').value = '';
    document.getElementById('settings-dialog').showModal();
    showToast('Add your Gemini API key first, then click Generate with AI again.');
    return;
  }
  _aiCallback = cb;
  document.getElementById('ai-error').hidden = true;
  document.getElementById('ai-topic').value = '';
  document.getElementById('ai-dialog').showModal();
  setTimeout(function () { document.getElementById('ai-topic').focus(); }, 50);
}

function initDialogs() {
  /* ── Settings dialog ── */
  var settingsDialog = document.getElementById('settings-dialog');
  document.getElementById('settings-btn').addEventListener('click', function () {
    document.getElementById('api-key-input').value = AI.getKey();
    settingsDialog.showModal();
  });
  document.getElementById('settings-close').addEventListener('click', function ()  { settingsDialog.close(); });
  document.getElementById('settings-cancel').addEventListener('click', function () { settingsDialog.close(); });
  document.getElementById('settings-save').addEventListener('click', function () {
    AI.setKey(document.getElementById('api-key-input').value);
    settingsDialog.close();
    showToast('API key saved!');
  });

  /* ── AI generator dialog ── */
  var aiDialog  = document.getElementById('ai-dialog');
  var aiErrEl   = document.getElementById('ai-error');
  var aiGenBtn  = document.getElementById('ai-generate');

  function closeAI() { aiDialog.close(); }
  document.getElementById('ai-close').addEventListener('click',  closeAI);
  document.getElementById('ai-cancel').addEventListener('click', closeAI);

  aiGenBtn.addEventListener('click', function () {
    var topic = document.getElementById('ai-topic').value.trim();
    var count = parseInt(document.getElementById('ai-count').value, 10) || 8;
    if (!topic) { document.getElementById('ai-topic').focus(); return; }

    function reset() {
      aiGenBtn.disabled    = false;
      aiGenBtn.textContent = 'Generate';
    }

    aiErrEl.hidden       = true;
    aiGenBtn.disabled    = true;
    aiGenBtn.textContent = 'Generating...';

    AI.generate(topic, count)
      .then(function (cards) {
        reset();
        if (!cards || cards.length === 0) {
          aiErrEl.hidden      = false;
          aiErrEl.textContent = 'No cards were returned. Try a more specific topic.';
          return;
        }
        aiDialog.close();
        if (typeof _aiCallback === 'function') _aiCallback(cards);
        showToast(cards.length + ' cards generated');
      })
      .catch(function (err) {
        reset();
        aiErrEl.hidden      = false;
        aiErrEl.textContent = err.message || 'Something went wrong. Check your API key and try again.';
      });
  });

  /* ── Confirm dialog ── */
  var confirmDialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-cancel').addEventListener('click', function () { confirmDialog.close(); });
  document.getElementById('confirm-ok').addEventListener('click', function () {
    confirmDialog.close();
    if (typeof _confirmCb === 'function') _confirmCb();
  });
}

/* ══════════════════════════════════════
   ROUTER
══════════════════════════════════════ */

function updateNavActive() {
  var hash  = location.hash || '#/';
  var base  = '#/' + (hash.replace(/^#\/?/, '').split('/')[0] || '');

  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(function (a) {
    var href = a.getAttribute('href');
    /* exact match for home, prefix match for everything else */
    var active = href === '#/' ? hash === '#/' : href === base;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else        a.removeAttribute('aria-current');
  });
}

function handleRoute() {
  clearTimer();
  updateNavActive();

  var hash  = location.hash || '#/';
  var path  = hash.replace(/^#\/?/, ''); /* strip leading '#/' */
  var parts = path ? path.split('/') : [];

  if (parts.length === 0 || parts[0] === '') {
    renderHome();
  } else if (parts[0] === 'library') {
    renderLibrary();
  } else if (parts[0] === 'create') {
    renderCreate(parts[1] || null);
  } else if (parts[0] === 'set' && parts[1]) {
    renderSetDetail(parts[1]);
  } else if (parts[0] === 'study' && parts[1] && parts[2]) {
    var mode = parts[2];
    if      (mode === 'flashcards') renderFlashcards(parts[1]);
    else if (mode === 'test')       renderTestMode(parts[1]);
    else if (mode === 'write')      renderWriteMode(parts[1]);
    else renderHome();
  } else if (parts[0] === 'games') {
    if (parts.length <= 1 || !parts[1]) {
      renderGames();
    } else if (parts.length === 2) {
      renderGameSetPicker(parts[1]);          /* #/games/gameKey */
    } else {
      var gk = parts[2];                      /* #/games/setId/gameKey */
      var gameMap = {
        match:     function() { renderMatchGame(parts[1]); },
        speed:     function() { renderSpeedRound(parts[1]); },
        hangman:   function() { renderHangman(parts[1]); },
        scramble:  function() { renderScramble(parts[1]); },
        truefalse: function() { renderTrueFalse(parts[1]); },
        survival:  function() { renderSurvival(parts[1]); },
        gravity:   function() { renderGravity(parts[1]); },
        lightning: function() { renderLightning(parts[1]); },
      };
      if (gameMap[gk]) gameMap[gk](); else renderGames();
    }
  } else {
    renderHome();
  }
}

/* ══════════════════════════════════════
   PAGE: HOME
══════════════════════════════════════ */

function renderHome() {
  announce('Home');
  var sets = Storage.getAll();
  var featured = sets[0] || null;
  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  $app.innerHTML =
    '<section class="page home-page animate-fade-up" aria-labelledby="home-heading">' +

      /* ── Greeting ── */
      '<header class="home-greeting">' +
        '<div>' +
          '<h1 id="home-heading" class="home-greeting-text">' + e(greeting) + '</h1>' +
          '<p class="home-greeting-sub">What will you study today?</p>' +
        '</div>' +
        '<a href="#/create" class="btn btn-primary">New Set</a>' +
      '</header>' +

      /* ── Search ── */
      '<div class="home-search-wrap" role="search">' +
        '<label for="home-q" class="sr-only">Search your sets</label>' +
        '<input id="home-q" type="search" class="input home-search-input" placeholder="Search your sets..." autocomplete="off" />' +
      '</div>' +

      /* ── Featured "continue studying" card ── */
      (featured
        ? '<section class="mt-4" aria-labelledby="continue-heading">' +
            '<header class="home-section-header">' +
              '<h2 id="continue-heading" class="section-eyebrow">Continue studying</h2>' +
              '<a href="#/set/' + e(featured.id) + '" class="link-subtle">View set</a>' +
            '</header>' +
            '<article class="featured-card card" id="featured-card"></article>' +
          '</section>'
        : ''
      ) +

      /* ── Your sets ── */
      '<section class="mt-4" aria-labelledby="your-sets-heading">' +
        '<header class="home-section-header">' +
          '<h2 id="your-sets-heading">' + (sets.length > 0 ? 'Your sets' : '') + '</h2>' +
          (sets.length > 0 ? '<a href="#/library" class="link-subtle">See all</a>' : '') +
        '</header>' +
        '<ul class="card-grid" role="list" id="home-grid"></ul>' +
      '</section>' +

    '</section>';

  /* Build featured card */
  if (featured) {
    var fc = document.getElementById('featured-card');
    var firstCard = featured.cards[0] || { term: '' };

    fc.innerHTML =
      '<div class="featured-left">' +
        '<p class="featured-meta"></p>' +
        '<h3 class="featured-title"></h3>' +
        (featured.description ? '<p class="featured-desc"></p>' : '') +
        '<nav class="featured-actions" aria-label="Study ' + e(featured.title) + '">' +
          '<a href="#/study/' + e(featured.id) + '/flashcards" class="feat-btn">Flashcards</a>' +
          '<a href="#/study/' + e(featured.id) + '/test"       class="feat-btn">Test</a>' +
          '<a href="#/study/' + e(featured.id) + '/write"      class="feat-btn">Write</a>' +
          '<a href="#/games/' + e(featured.id) + '/match"      class="feat-btn">Match</a>' +
          '<a href="#/games/' + e(featured.id) + '/survival"   class="feat-btn">Survival</a>' +
        '</nav>' +
      '</div>' +
      '<div class="featured-right" aria-hidden="true">' +
        '<div class="featured-preview">' +
          '<p class="featured-preview-label">First card</p>' +
          '<p class="featured-preview-term" id="feat-term"></p>' +
        '</div>' +
      '</div>';

    fc.querySelector('.featured-meta').textContent =
      featured.category + ' · ' + featured.cards.length + ' card' + (featured.cards.length !== 1 ? 's' : '');
    fc.querySelector('.featured-title').textContent = featured.title;
    if (featured.description) fc.querySelector('.featured-desc').textContent = featured.description;
    document.getElementById('feat-term').textContent = firstCard.term;
  }

  /* Build / filter grid */
  function renderGrid(q) {
    var grid = document.getElementById('home-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var filtered = q
      ? sets.filter(function (s) { return s.title.toLowerCase().includes(q.toLowerCase()); })
      : sets;

    if (filtered.length === 0 && sets.length === 0) {
      grid.innerHTML =
        '<li class="home-empty" style="grid-column:1/-1">' +
          '<p>You have no sets yet.</p>' +
          '<a href="#/create" class="btn btn-primary" style="margin-top:.75rem">Create your first set</a>' +
        '</li>';
      return;
    }
    if (filtered.length === 0) {
      grid.innerHTML = '<li style="grid-column:1/-1;color:var(--text-3)">No sets match your search.</li>';
      return;
    }

    filtered.forEach(function (set) {
      var li = document.createElement('li');
      li.appendChild(createSetCard(set, function () { renderGrid(document.getElementById('home-q') ? document.getElementById('home-q').value : ''); }));
      grid.appendChild(li);
    });
  }

  renderGrid('');

  var searchEl = document.getElementById('home-q');
  if (searchEl) searchEl.addEventListener('input', function () { renderGrid(this.value); });
}

/* ══════════════════════════════════════
   PAGE: LIBRARY
══════════════════════════════════════ */

var CATEGORIES = ['All','Geography','Entertainment','Lifestyle','Technology','Science','History','Language','Math','Other'];

function renderLibrary() {
  announce('Library');
  var sets = Storage.getAll();

  $app.innerHTML =
    '<section class="page animate-fade-up" aria-labelledby="library-heading">' +
      '<header class="flex items-center justify-between mb-3">' +
        '<div>' +
          '<h1 id="library-heading">My Library</h1>' +
          '<p id="lib-count" aria-live="polite" style="color:var(--text-dim);margin-top:.2rem">' + sets.length + ' set' + (sets.length !== 1 ? 's' : '') + '</p>' +
        '</div>' +
        '<a href="#/create" class="btn btn-primary">+ New Set</a>' +
      '</header>' +

      '<search aria-label="Search and filter sets">' +
        '<label for="lib-search" class="sr-only">Search sets</label>' +
        '<input id="lib-search" type="search" class="input library-search" placeholder="Search sets..." />' +
        '<fieldset>' +
          '<legend class="sr-only">Filter by category</legend>' +
          '<div class="category-pills" role="group" aria-label="Category filters">' +
            CATEGORIES.map(function (c) {
              return '<button type="button" class="pill' + (c === 'All' ? ' active' : '') + '" data-cat="' + e(c) + '">' + e(c) + '</button>';
            }).join('') +
          '</div>' +
        '</fieldset>' +
      '</search>' +

      '<div id="lib-results" class="mt-3"></div>' +
    '</section>';

  var currentCat    = 'All';
  var currentSearch = '';

  function filterRender() {
    var fresh    = Storage.getAll();
    var filtered = fresh.filter(function (s) {
      var matchQ = !currentSearch ||
        s.title.toLowerCase().includes(currentSearch.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(currentSearch.toLowerCase());
      var matchC = currentCat === 'All' || s.category === currentCat;
      return matchQ && matchC;
    });

    var results = document.getElementById('lib-results');
    var countEl = document.getElementById('lib-count');
    if (!results) return;

    if (filtered.length === 0) {
      results.innerHTML =
        '<div class="empty-state">' +
          '<h2>' + (currentSearch || currentCat !== 'All' ? 'No sets match your filters' : 'Your library is empty') + '</h2>' +
          '<p>' + (currentSearch || currentCat !== 'All' ? 'Try a different search or category' : 'Create your first set to get started') + '</p>' +
          (!currentSearch && currentCat === 'All' ? '<a href="#/create" class="btn btn-primary" style="margin-top:.75rem">New Set</a>' : '') +
        '</div>';
      return;
    }

    var ul = document.createElement('ul');
    ul.className = 'card-grid';
    ul.setAttribute('role', 'list');
    filtered.forEach(function (set) {
      var li = document.createElement('li');
      li.appendChild(createSetCard(set, filterRender));
      ul.appendChild(li);
    });
    results.innerHTML = '';
    results.appendChild(ul);

    if (countEl) countEl.textContent = filtered.length + ' set' + (filtered.length !== 1 ? 's' : '');
  }

  document.getElementById('lib-search').addEventListener('input', function (ev) {
    currentSearch = ev.target.value;
    filterRender();
  });

  document.querySelectorAll('.pill').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.pill').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      filterRender();
    });
  });

  filterRender();
}

/* ══════════════════════════════════════
   PAGE: CREATE / EDIT
══════════════════════════════════════ */

function renderCreate(editId) {
  announce(editId ? 'Edit Set' : 'Create New Set');
  var existingSet = editId ? Storage.getOne(editId) : null;

  var cards = existingSet
    ? existingSet.cards.map(function (c) { return Object.assign({}, c); })
    : [makeNewCard(), makeNewCard()];

  function makeNewCard() {
    return { id: 'c-' + Date.now() + '-' + Math.random(), term: '', definition: '' };
  }

  $app.innerHTML =
    '<section class="page animate-fade-up" aria-labelledby="create-heading">' +
      '<header class="create-header">' +
        '<div>' +
          '<h1 id="create-heading">' + (editId ? 'Edit Set' : 'Create New Set') + '</h1>' +
          '<p id="card-count-note" aria-live="polite" style="color:var(--text-dim);margin-top:.2rem">' + cards.length + ' cards</p>' +
        '</div>' +
        '<div class="create-header-actions">' +
          '<a href="' + (editId ? '#/set/' + e(editId) : '#/library') + '" class="btn btn-ghost">Cancel</a>' +
          '<button id="save-top" type="button" class="btn btn-primary">' + (editId ? 'Save Changes' : 'Create Set') + '</button>' +
        '</div>' +
      '</header>' +

      /* Set details */
      '<article class="card create-meta">' +
        '<fieldset>' +
          '<legend>Set Details</legend>' +
          '<div class="create-meta-fields">' +
            '<div class="field">' +
              '<label for="set-title">Title <span aria-hidden="true">*</span></label>' +
              '<input id="set-title" type="text" class="input" placeholder="e.g. Spanish Vocab, Marvel Trivia…" value="' + e(existingSet ? existingSet.title : '') + '" required aria-required="true" />' +
              '<span id="err-title" class="field-error" role="alert" hidden>Title is required</span>' +
            '</div>' +
            '<div class="field">' +
              '<label for="set-desc">Description</label>' +
              '<input id="set-desc" type="text" class="input" placeholder="Optional description" value="' + e(existingSet ? existingSet.description || '' : '') + '" />' +
            '</div>' +
            '<div class="field">' +
              '<label for="set-cat">Category</label>' +
              '<select id="set-cat" class="input">' +
                ['Geography','Entertainment','Lifestyle','Technology','Science','History','Language','Math','Other'].map(function (c) {
                  var sel = (existingSet && existingSet.category === c) ? ' selected' : '';
                  return '<option' + sel + '>' + e(c) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
        '</fieldset>' +
      '</article>' +

      /* Cards */
      '<section class="cards-section" aria-labelledby="cards-heading">' +
        '<header class="ai-section-header mt-4 mb-2">' +
          '<h2 id="cards-heading">Cards</h2>' +
          '<button id="ai-open-btn" type="button" class="btn btn-primary btn-sm">Generate with AI</button>' +
        '</header>' +
        '<span id="err-cards" class="field-error" role="alert" hidden>All cards need a term and definition</span>' +
        '<ol id="cards-list" class="cards-list" aria-label="Flashcard pairs"></ol>' +
        '<button id="add-card-btn" type="button" class="btn btn-ghost add-card-btn mt-2">+ Add Card</button>' +
      '</section>' +

      '<footer class="create-footer mt-4">' +
        '<a href="' + (editId ? '#/set/' + e(editId) : '#/library') + '" class="btn btn-ghost">Cancel</a>' +
        '<button id="save-bottom" type="button" class="btn btn-primary btn-lg">' + (editId ? 'Save Changes' : 'Create Set') + '</button>' +
      '</footer>' +
    '</section>';

  /* ── Card list builder ── */
  function rebuildList() {
    var ol = document.getElementById('cards-list');
    if (!ol) return;
    ol.innerHTML = '';

    cards.forEach(function (card, idx) {
      var li = document.createElement('li');
      li.className = 'create-card card';

      li.innerHTML =
        '<span class="create-card-num" aria-hidden="true">' + (idx + 1) + '</span>' +
        '<div class="create-card-fields">' +
          '<div class="field">' +
            '<label for="term-' + e(card.id) + '">Term</label>' +
            '<input id="term-' + e(card.id) + '" type="text" class="input" placeholder="Enter term, question, or prompt" value="' + e(card.term) + '" />' +
          '</div>' +
          '<div class="field">' +
            '<label for="def-' + e(card.id) + '">Definition / Answer</label>' +
            '<textarea id="def-' + e(card.id) + '" class="input" placeholder="Enter the definition, answer, or description" rows="2">' + e(card.definition) + '</textarea>' +
          '</div>' +
        '</div>' +
        '<div class="create-card-actions" role="group" aria-label="Card ' + (idx + 1) + ' actions">' +
          '<button type="button" class="btn btn-ghost btn-icon" data-move="-1" ' + (idx === 0 ? 'disabled' : '') + ' aria-label="Move card up">↑</button>' +
          '<button type="button" class="btn btn-ghost btn-icon" data-move="1" ' + (idx === cards.length - 1 ? 'disabled' : '') + ' aria-label="Move card down">↓</button>' +
          '<button type="button" class="btn btn-icon create-card-remove" ' + (cards.length <= 2 ? 'disabled' : '') + ' aria-label="Remove card">✕</button>' +
        '</div>';

      /* Sync inputs to cards array */
      li.querySelector('#term-' + card.id).addEventListener('input', function (ev) { card.term = ev.target.value; });
      li.querySelector('#def-'  + card.id).addEventListener('input', function (ev) { card.definition = ev.target.value; });

      /* Move */
      li.querySelectorAll('[data-move]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var dir  = parseInt(btn.dataset.move, 10);
          var swap = idx + dir;
          if (swap >= 0 && swap < cards.length) {
            var tmp = cards[idx]; cards[idx] = cards[swap]; cards[swap] = tmp;
            rebuildList();
          }
        });
      });

      /* Remove */
      li.querySelector('.create-card-remove').addEventListener('click', function () {
        if (cards.length <= 2) return;
        cards = cards.filter(function (c) { return c.id !== card.id; });
        document.getElementById('card-count-note').textContent = cards.length + ' cards';
        rebuildList();
      });

      ol.appendChild(li);
    });

    /* Re-bind add button after rebuild */
    var addBtn = document.getElementById('add-card-btn');
    if (addBtn) {
      addBtn.onclick = function () {
        cards.push(makeNewCard());
        document.getElementById('card-count-note').textContent = cards.length + ' cards';
        rebuildList();
        var ol2 = document.getElementById('cards-list');
        if (ol2 && ol2.lastElementChild) ol2.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }

  rebuildList();

  /* ── Save ── */
  function handleSave() {
    var title     = document.getElementById('set-title').value.trim();
    var errTitle  = document.getElementById('err-title');
    var errCards  = document.getElementById('err-cards');
    errTitle.hidden = errCards.hidden = true;

    var valid = true;
    if (!title) { errTitle.hidden = false; valid = false; }
    if (cards.some(function (c) { return !c.term.trim() || !c.definition.trim(); })) { errCards.hidden = false; valid = false; }
    if (!valid) return;

    var payload = {
      title:       title,
      description: document.getElementById('set-desc').value.trim(),
      category:    document.getElementById('set-cat').value,
      cards:       cards.map(function (c) { return Object.assign({}, c, { term: c.term.trim(), definition: c.definition.trim() }); }),
    };

    if (editId) {
      Storage.update(editId, payload);
      navigate('#/set/' + editId);
    } else {
      var newId = Storage.add(payload);
      navigate('#/set/' + newId);
    }
  }

  document.getElementById('save-top').addEventListener('click', handleSave);
  document.getElementById('save-bottom').addEventListener('click', handleSave);

  /* ── AI generate ── */
  document.getElementById('ai-open-btn').addEventListener('click', function () {
    openAIDialog(function (generated) {
      generated.forEach(function (c) { cards.push(c); });
      document.getElementById('card-count-note').textContent = cards.length + ' cards';
      rebuildList();
    });
  });
}

/* ══════════════════════════════════════
   PAGE: SET DETAIL
══════════════════════════════════════ */

function renderSetDetail(setId) {
  var set = Storage.getOne(setId);
  if (!set) { navigate('#/library'); return; }
  announce(set.title);

  var previewIdx = 0;
  var isFlipped  = false;

  $app.innerHTML =
    '<section class="page animate-fade-up" aria-labelledby="detail-heading">' +
      '<header class="detail-header">' +
        '<a href="#/library" class="btn btn-ghost btn-sm">&larr; Back</a>' +
        '<nav class="detail-header-actions" aria-label="Set actions">' +
          '<a href="#/create/' + e(set.id) + '" class="btn btn-ghost btn-sm">Edit</a>' +
          '<button id="btn-delete" type="button" class="btn btn-danger btn-sm">Delete</button>' +
        '</nav>' +
      '</header>' +

      '<div class="mt-2">' +
        '<h1 id="detail-heading"></h1>' +
        (set.description ? '<p class="detail-desc"></p>' : '') +
        '<div class="flex gap-sm items-center mt-2">' +
          '<span class="tag">' + e(set.category) + '</span>' +
          '<span class="tag">' + set.cards.length + ' card' + (set.cards.length !== 1 ? 's' : '') + '</span>' +
        '</div>' +
      '</div>' +

      /* Card Preview */
      '<section class="detail-preview mt-3" aria-labelledby="preview-heading">' +
        '<h2 id="preview-heading" class="sr-only">Card Preview</h2>' +
        '<div id="preview-card" class="preview-flip-card" role="button" tabindex="0" aria-label="Term: ' + e(set.cards[0].term) + '. Press to see definition.">' +
          '<div class="preview-flip-inner">' +
            '<div class="preview-face preview-front">' +
              '<p class="preview-label" aria-hidden="true">Term</p>' +
              '<p class="preview-text" id="preview-term">' + e(set.cards[0].term) + '</p>' +
              '<p class="preview-hint" aria-hidden="true">Click to flip</p>' +
            '</div>' +
            '<div class="preview-face preview-back" aria-hidden="true">' +
              '<p class="preview-label">Definition</p>' +
              '<p class="preview-text" id="preview-def">' + e(set.cards[0].definition) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<nav class="preview-nav" aria-label="Card navigation">' +
          '<button id="btn-prev" type="button" class="btn btn-ghost btn-sm" aria-label="Previous card">← Prev</button>' +
          '<output id="preview-counter" aria-live="polite">1 / ' + set.cards.length + '</output>' +
          '<button id="btn-next" type="button" class="btn btn-ghost btn-sm" aria-label="Next card">Next →</button>' +
        '</nav>' +
      '</section>' +

      /* Study modes */
      '<section class="mt-4" aria-labelledby="study-heading">' +
        '<h2 id="study-heading">Study</h2>' +
        '<ul class="modes-grid mt-2" role="list">' +
          [
            { href: '#/study/'+set.id+'/flashcards', label:'Flashcards', desc:'Flip through cards at your own pace'   },
            { href: '#/study/'+set.id+'/write',      label:'Write Mode', desc:'Type the definition from memory'       },
            { href: '#/study/'+set.id+'/test',       label:'Test Mode',  desc:'Multiple-choice test on the full set'  },
          ].map(function (m) {
            return '<li><a href="' + m.href + '" class="mode-card card">' +
              '<span class="mode-label">' + e(m.label) + '</span>' +
              '<span class="mode-desc">' + e(m.desc) + '</span>' +
            '</a></li>';
          }).join('') +
        '</ul>' +
      '</section>' +

      /* Game modes */
      '<section class="mt-3" aria-labelledby="games-heading">' +
        '<h2 id="games-heading">Games</h2>' +
        '<ul class="modes-grid mt-2" role="list">' +
          ALL_GAMES.map(function (g) {
            return '<li><a href="#/games/' + e(set.id) + '/' + g.key + '" class="mode-card card" style="--mc:' + g.gc + '">' +
              '<span class="mode-label">' + e(g.label) + '</span>' +
              '<span class="mode-desc">' + e(g.desc) + '</span>' +
            '</a></li>';
          }).join('') +
        '</ul>' +
      '</section>' +

      /* All cards */
      '<section class="mt-4" aria-labelledby="allcards-heading">' +
        '<h2 id="allcards-heading">All Cards (' + set.cards.length + ')</h2>' +
        '<ol class="all-cards-list mt-2" id="all-cards" aria-label="All flashcards"></ol>' +
      '</section>' +
    '</section>';

  /* Set text content safely */
  document.getElementById('detail-heading').textContent = set.title;
  if (set.description) document.querySelector('.detail-desc').textContent = set.description;

  /* All cards list */
  var ol = document.getElementById('all-cards');
  set.cards.forEach(function (card, i) {
    var li = document.createElement('li');
    li.className = 'card all-card';
    li.innerHTML =
      '<span class="all-card-num" aria-hidden="true">' + (i + 1) + '</span>' +
      '<div class="all-card-term"></div>' +
      '<div class="all-card-sep" aria-hidden="true"></div>' +
      '<div class="all-card-def"></div>';
    li.querySelector('.all-card-term').textContent = card.term;
    li.querySelector('.all-card-def').textContent  = card.definition;
    ol.appendChild(li);
  });

  /* Preview flip */
  function updatePreview() {
    var card = set.cards[previewIdx];
    var cardEl = document.getElementById('preview-card');
    if (!cardEl) return;
    cardEl.classList.toggle('flipped', isFlipped);
    document.getElementById('preview-term').textContent = card.term;
    document.getElementById('preview-def').textContent  = card.definition;
    document.getElementById('preview-counter').textContent = (previewIdx + 1) + ' / ' + set.cards.length;
    cardEl.setAttribute('aria-label', isFlipped
      ? 'Definition: ' + card.definition
      : 'Term: ' + card.term + '. Press to see definition.'
    );
  }

  var previewCard = document.getElementById('preview-card');
  previewCard.addEventListener('click', function () { isFlipped = !isFlipped; updatePreview(); });
  previewCard.addEventListener('keydown', function (ev) {
    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); isFlipped = !isFlipped; updatePreview(); }
  });

  document.getElementById('btn-prev').addEventListener('click', function () {
    previewIdx = (previewIdx - 1 + set.cards.length) % set.cards.length;
    isFlipped = false; updatePreview();
  });
  document.getElementById('btn-next').addEventListener('click', function () {
    previewIdx = (previewIdx + 1) % set.cards.length;
    isFlipped = false; updatePreview();
  });

  /* Delete */
  document.getElementById('btn-delete').addEventListener('click', function () {
    showConfirm('Delete "' + set.title + '"? This cannot be undone.', function () {
      Storage.delete(set.id);
      showToast('"' + set.title + '" deleted');
      navigate('#/library');
    });
  });
}

/* ══════════════════════════════════════
   PAGE: FLASHCARDS
══════════════════════════════════════ */

function renderFlashcards(setId) {
  var set = Storage.getOne(setId);
  if (!set) { navigate('#/library'); return; }
  announce('Flashcards — ' + set.title);

  var deck     = shuffle(set.cards.slice());
  var index    = 0;
  var known    = {};
  var missed   = {};
  var isFlipped = false;

  function render() {
    if (index >= deck.length) { showDone(); return; }
    var card = deck[index];
    var pct  = Math.round((index / deck.length) * 100);

    $app.innerHTML =
      '<section class="page fc-page animate-fade-up" aria-labelledby="fc-sr-heading">' +
        '<header class="fc-header">' +
          '<nav aria-label="Flashcard controls">' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost btn-sm">← Back</a>' +
            '<span class="fc-set-title">' + e(set.title) + '</span>' +
            '<button id="fc-restart" type="button" class="btn btn-ghost btn-sm" aria-label="Restart flashcards">↺ Restart</button>' +
          '</nav>' +
          '<h1 id="fc-sr-heading" class="sr-only">Flashcards: ' + e(set.title) + '</h1>' +
          '<div class="fc-progress">' +
            '<progress value="' + index + '" max="' + deck.length + '" aria-label="Progress: card ' + (index + 1) + ' of ' + deck.length + '"></progress>' +
            '<output>' + (index + 1) + ' / ' + deck.length + '</output>' +
          '</div>' +
        '</header>' +

        '<article id="fc-card" class="flip-card' + (isFlipped ? ' flipped' : '') + '" role="button" tabindex="0" aria-label="' + (isFlipped ? 'Definition: ' + card.definition : 'Term: ' + card.term + '. Press to reveal definition.') + '">' +
          '<div class="flip-card-inner">' +
            '<div class="flip-card-front">' +
              '<header><small>Term</small></header>' +
              '<p class="fc-card-text" id="fc-term"></p>' +
              '<footer><small>Click or press Space to flip</small></footer>' +
            '</div>' +
            '<div class="flip-card-back" aria-hidden="true">' +
              '<header><small>Definition</small></header>' +
              '<p class="fc-card-text" id="fc-def"></p>' +
            '</div>' +
          '</div>' +
        '</article>' +

        '<div id="fc-actions" class="fc-actions' + (isFlipped ? ' visible' : '') + '" role="group" aria-label="How well did you know it?">' +
          '<button id="fc-miss" type="button" class="btn fc-miss-btn">Still Learning</button>' +
          '<button id="fc-got"  type="button" class="btn fc-got-btn">Got It</button>' +
        '</div>' +

        (!isFlipped ? '<p class="fc-flip-hint" aria-hidden="true">Flip the card to reveal the answer</p>' : '') +
      '</section>';

    /* Set text content safely */
    document.getElementById('fc-term').textContent = card.term;
    document.getElementById('fc-def').textContent  = card.definition;

    var fcCard = document.getElementById('fc-card');
    fcCard.addEventListener('click', function () { isFlipped = !isFlipped; render(); });
    fcCard.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); isFlipped = !isFlipped; render(); }
    });

    document.getElementById('fc-restart').addEventListener('click', function () {
      deck = shuffle(set.cards.slice()); index = 0; known = {}; missed = {}; isFlipped = false; render();
    });

    if (isFlipped) {
      document.getElementById('fc-got').addEventListener('click', function () {
        known[card.id] = true; isFlipped = false; index++; render();
      });
      document.getElementById('fc-miss').addEventListener('click', function () {
        missed[card.id] = true; isFlipped = false; index++; render();
      });
    }
  }

  function showDone() {
    var knownCount  = Object.keys(known).length;
    var missedCount = Object.keys(missed).length;
    var pct = deck.length > 0 ? Math.round((knownCount / deck.length) * 100) : 0;

    $app.innerHTML =
      '<section class="page fc-done animate-fade-up" aria-labelledby="fc-done-heading">' +
        '<article class="card fc-done-card">' +
          '<p class="result-label">' + (pct === 100 ? 'Perfect!' : pct >= 70 ? 'Nice work.' : 'Keep at it.') + '</p>' +
          '<h1 id="fc-done-heading">Round Complete!</h1>' +
          '<div class="fc-score-ring" style="--pct:' + pct + '" role="img" aria-label="' + pct + '% correct">' +
            '<div class="fc-score-ring-inner">' +
              '<output class="fc-score-pct">' + pct + '%</output>' +
              '<small>got it</small>' +
            '</div>' +
          '</div>' +
          '<dl class="fc-score-detail">' +
            '<div><dd style="color:var(--green)">' + knownCount + '</dd><dt>Got It</dt></div>' +
            '<div><dd style="color:var(--red)">' + missedCount + '</dd><dt>Missed</dt></div>' +
          '</dl>' +
          '<nav class="fc-done-actions" aria-label="Next steps">' +
            (missedCount > 0 ? '<button id="study-missed" type="button" class="btn btn-pink btn-lg">Study ' + missedCount + ' Missed Card' + (missedCount !== 1 ? 's' : '') + '</button>' : '') +
            '<button id="restart-all" type="button" class="btn btn-primary btn-lg">Restart All</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';

    document.getElementById('restart-all').addEventListener('click', function () {
      deck = shuffle(set.cards.slice()); index = 0; known = {}; missed = {}; isFlipped = false; render();
    });

    var studyMissedBtn = document.getElementById('study-missed');
    if (studyMissedBtn) {
      studyMissedBtn.addEventListener('click', function () {
        var missedCards = set.cards.filter(function (c) { return missed[c.id]; });
        deck = shuffle(missedCards); index = 0; known = {}; missed = {}; isFlipped = false; render();
      });
    }
  }

  render();
}

/* ══════════════════════════════════════
   PAGE: TEST MODE
══════════════════════════════════════ */

function renderTestMode(setId) {
  var set = Storage.getOne(setId);
  if (!set) { navigate('#/library'); return; }
  if (set.cards.length < 2) { navigate('#/set/' + setId); return; }
  announce('Test Mode — ' + set.title);

  var questions = shuffle(set.cards).map(function (card) {
    var wrong = shuffle(set.cards.filter(function (c) { return c.id !== card.id; })).slice(0, 3).map(function (c) { return c.definition; });
    return { question: card.term, choices: shuffle(wrong.concat(card.definition)), correct: card.definition };
  });

  var index   = 0;
  var selected = null;
  var answers  = [];

  function renderQ() {
    var q   = questions[index];
    var pct = Math.round((index / questions.length) * 100);

    $app.innerHTML =
      '<section class="page test-page animate-fade-up" aria-labelledby="test-q-heading">' +
        '<header class="test-header">' +
          '<a href="#/set/' + e(setId) + '" class="btn btn-ghost btn-sm">← Back</a>' +
          '<span class="test-set-name">' + e(set.title) + '</span>' +
          '<output class="test-counter" aria-live="polite">' + (index + 1) + ' / ' + questions.length + '</output>' +
        '</header>' +
        '<progress value="' + pct + '" max="100" class="mt-2 mb-3" aria-label="Progress: ' + (index + 1) + ' of ' + questions.length + '"></progress>' +
        '<article class="test-question card animate-fade-up">' +
          '<p class="test-q-label" aria-hidden="true">Question ' + (index + 1) + '</p>' +
          '<h1 id="test-q-heading" class="test-q-text"></h1>' +
          '<div class="test-choices" role="group" aria-label="Answer choices" id="choices"></div>' +
          '<div id="test-feedback" hidden class="test-feedback"></div>' +
        '</article>' +
      '</section>';

    document.getElementById('test-q-heading').textContent = q.question;

    var choicesEl = document.getElementById('choices');
    q.choices.forEach(function (choice, ci) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      btn.setAttribute('aria-label', String.fromCharCode(65 + ci) + ': ' + choice);

      var letterSpan = document.createElement('span');
      letterSpan.className = 'choice-letter';
      letterSpan.setAttribute('aria-hidden', 'true');
      letterSpan.textContent = String.fromCharCode(65 + ci);

      var textSpan = document.createElement('span');
      textSpan.textContent = choice;

      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);

      btn.addEventListener('click', function () {
        if (selected !== null) return;
        selected = choice;

        choicesEl.querySelectorAll('.choice-btn').forEach(function (b) {
          var bText = b.querySelector('span:last-child').textContent;
          if (bText === q.correct)  b.classList.add('correct');
          if (bText === selected && selected !== q.correct) b.classList.add('wrong');
          b.disabled = true;
        });

        var isCorrect = selected === q.correct;
        answers.push({ question: q.question, selected: selected, correct: q.correct, isCorrect: isCorrect });

        var fb = document.getElementById('test-feedback');
        fb.hidden = false;
        fb.innerHTML =
          (isCorrect
            ? '<span class="feedback-correct">Correct!</span>'
            : '<span class="feedback-wrong">Incorrect &mdash; correct answer: <strong></strong></span>'
          ) +
          '<button id="next-q" type="button" class="btn btn-primary">' + (index + 1 === questions.length ? 'See Results →' : 'Next →') + '</button>';

        if (!isCorrect) fb.querySelector('strong').textContent = q.correct;

        document.getElementById('next-q').addEventListener('click', function () {
          selected = null; index++;
          if (index >= questions.length) showResults();
          else renderQ();
        });
      });

      choicesEl.appendChild(btn);
    });
  }

  function showResults() {
    var correct = answers.filter(function (a) { return a.isCorrect; }).length;
    var pct = Math.round((correct / questions.length) * 100);

    $app.innerHTML =
      '<section class="page test-done animate-fade-up" aria-labelledby="test-done-heading">' +
        '<article class="card test-results">' +
          '<p class="result-label">' + (pct === 100 ? 'Perfect score.' : pct >= 70 ? 'Good work.' : 'Keep practicing.') + '</p>' +
          '<h1 id="test-done-heading">Test Complete!</h1>' +
          '<p class="test-score-pill" style="background:' + (pct >= 70 ? 'var(--green-dim)' : 'var(--red-dim)') + ';color:' + (pct >= 70 ? 'var(--green)' : 'var(--red)') + '">' +
            correct + ' / ' + questions.length + ' correct — ' + pct + '%' +
          '</p>' +
          '<ol class="test-review" aria-label="Review" id="review-list"></ol>' +
          '<nav class="test-done-actions" aria-label="Next steps">' +
            '<button id="try-again" type="button" class="btn btn-primary btn-lg">Try Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';

    var reviewList = document.getElementById('review-list');
    answers.forEach(function (a) {
      var li = document.createElement('li');
      li.className = 'review-item ' + (a.isCorrect ? 'correct' : 'incorrect');

      var icon = document.createElement('span');
      icon.className = 'review-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = a.isCorrect ? 'pass' : 'fail';
      icon.style.fontSize = '0.65rem';

      var body = document.createElement('div');
      var q = document.createElement('p');
      q.className = 'review-question';
      q.textContent = a.question;
      body.appendChild(q);

      if (!a.isCorrect) {
        var yours = document.createElement('p');
        yours.className = 'review-yours';
        yours.textContent = 'Your answer: ' + a.selected;
        var corr = document.createElement('p');
        corr.className = 'review-correct-ans';
        corr.textContent = 'Correct: ' + a.correct;
        body.appendChild(yours);
        body.appendChild(corr);
      }

      li.appendChild(icon);
      li.appendChild(body);
      reviewList.appendChild(li);
    });

    document.getElementById('try-again').addEventListener('click', function () {
      index = 0; selected = null; answers = [];
      questions = shuffle(set.cards).map(function (card) {
        var wrong = shuffle(set.cards.filter(function (c) { return c.id !== card.id; })).slice(0, 3).map(function (c) { return c.definition; });
        return { question: card.term, choices: shuffle(wrong.concat(card.definition)), correct: card.definition };
      });
      renderQ();
    });
  }

  renderQ();
}

/* ══════════════════════════════════════
   PAGE: WRITE MODE
══════════════════════════════════════ */

function renderWriteMode(setId) {
  var set = Storage.getOne(setId);
  if (!set) { navigate('#/library'); return; }
  announce('Write Mode — ' + set.title);

  var deck    = shuffle(set.cards.slice());
  var index   = 0;
  var result  = null;
  var answers = [];

  function normalize(s) { return String(s).trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''); }
  function grade(input, correct) {
    var a = normalize(input), b = normalize(correct);
    if (a === b) return 'correct';
    if (a.length > 2 && (b.includes(a) || a.includes(b))) return 'close';
    return 'wrong';
  }

  function render() {
    var card = deck[index];

    $app.innerHTML =
      '<section class="page write-page animate-fade-up" aria-labelledby="write-heading">' +
        '<header class="write-header">' +
          '<a href="#/set/' + e(setId) + '" class="btn btn-ghost btn-sm">← Back</a>' +
          '<span class="fc-set-title">' + e(set.title) + '</span>' +
          '<output class="test-counter" aria-live="polite">' + (index + 1) + ' / ' + deck.length + '</output>' +
        '</header>' +
        '<progress value="' + Math.round((index / deck.length) * 100) + '" max="100" class="mt-2 mb-3" aria-label="Progress"></progress>' +
        '<article class="write-card card animate-fade-up">' +
          '<p class="write-prompt-label" aria-hidden="true">Write the definition for:</p>' +
          '<h1 id="write-heading" class="write-term"></h1>' +
          '<form class="write-form" id="write-form" novalidate>' +
            '<label for="write-input" class="sr-only">Your definition</label>' +
            '<textarea id="write-input" class="input" rows="3" placeholder="Type the definition here…"' + (result ? ' disabled' : '') + '></textarea>' +
            '<div id="write-fb"></div>' +
          '</form>' +
        '</article>' +
      '</section>';

    document.getElementById('write-heading').textContent = card.term;

    var input  = document.getElementById('write-input');
    var fbEl   = document.getElementById('write-fb');
    var form   = document.getElementById('write-form');
    input.focus();

    if (result) {
      input.classList.add('input-' + result);
      var label = result === 'correct' ? '<span class="wf-correct">Correct!</span>'
                : result === 'close'   ? '<span class="wf-close">Close</span>'
                :                       '<span class="wf-wrong">Incorrect</span>';
      var ansLine = result !== 'correct' ? '<p style="font-size:.85rem;margin-top:.35rem;color:var(--text-dim)">Answer: <strong></strong></p>' : '';
      fbEl.innerHTML =
        '<div class="write-feedback">' +
          label + ansLine +
          '<button id="next-write" type="button" class="btn btn-primary">' + (index + 1 === deck.length ? 'See Results →' : 'Next →') + '</button>' +
        '</div>';
      if (ansLine) fbEl.querySelector('strong').textContent = card.definition;
      input.value = answers[answers.length - 1] ? answers[answers.length - 1].input : '';
      document.getElementById('next-write').addEventListener('click', function () {
        result = null; index++;
        if (index >= deck.length) showDone();
        else render();
      });
    } else {
      fbEl.innerHTML = '<button id="check-write" type="button" class="btn btn-primary" disabled>Check Answer</button>';
      input.addEventListener('input', function () {
        document.getElementById('check-write').disabled = !input.value.trim();
      });
      function check() {
        var val = input.value.trim();
        if (!val) return;
        result = grade(val, card.definition);
        answers.push({ term: card.term, input: val, correct: card.definition, grade: result });
        render();
      }
      document.getElementById('check-write').addEventListener('click', check);
      form.addEventListener('submit', function (ev) { ev.preventDefault(); check(); });
    }
  }

  function showDone() {
    var correct = answers.filter(function (a) { return a.grade === 'correct'; }).length;
    var close   = answers.filter(function (a) { return a.grade === 'close'; }).length;
    var wrong   = answers.filter(function (a) { return a.grade === 'wrong'; }).length;

    $app.innerHTML =
      '<section class="page write-done animate-fade-up" aria-labelledby="write-done-heading">' +
        '<article class="card write-results">' +
          '<p class="result-label">' + (((correct + close * 0.5) / deck.length) >= 0.8 ? 'Great job.' : 'Keep practicing.') + '</p>' +
          '<h1 id="write-done-heading">Round Complete!</h1>' +
          '<dl class="write-score-row">' +
            '<div><dd style="color:var(--green)">' + correct + '</dd><dt>Correct</dt></div>' +
            '<div><dd style="color:var(--amber)">' + close + '</dd><dt>Close</dt></div>' +
            '<div><dd style="color:var(--red)">' + wrong + '</dd><dt>Wrong</dt></div>' +
          '</dl>' +
          '<ol class="write-review mt-2" id="write-review" aria-label="Review"></ol>' +
          '<nav class="write-done-actions" aria-label="Next steps">' +
            '<button id="wr-restart" type="button" class="btn btn-primary btn-lg">Try Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';

    var rl = document.getElementById('write-review');
    answers.forEach(function (a) {
      var li = document.createElement('li');
      li.className = 'write-review-item ' + a.grade;
      var term = document.createElement('p'); term.className = 'wr-term'; term.textContent = a.term;
      var yours = document.createElement('p'); yours.className = 'wr-yours'; yours.textContent = 'You wrote: "' + a.input + '"';
      li.appendChild(term);
      li.appendChild(yours);
      if (a.grade !== 'correct') {
        var corr = document.createElement('p'); corr.className = 'wr-correct'; corr.textContent = 'Answer: ' + a.correct;
        li.appendChild(corr);
      }
      rl.appendChild(li);
    });

    document.getElementById('wr-restart').addEventListener('click', function () {
      deck = shuffle(set.cards.slice()); index = 0; result = null; answers = []; render();
    });
  }

  render();
}

/* ══════════════════════════════════════
   ALL GAME DEFINITIONS (shared)
══════════════════════════════════════ */
/* SVG icons — 48×48 viewBox, stroke-based, transparent */
var S = 'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
var SVG = function(body) { return '<svg viewBox="0 0 48 48" fill="none" ' + S + '>' + body + '</svg>'; };

var ALL_GAMES = [
  {
    key:'match', label:'Match', gc:'var(--green)',
    svg: SVG(
      '<rect x="4" y="6" width="18" height="12" rx="3"/>' +
      '<rect x="26" y="30" width="18" height="12" rx="3"/>' +
      '<path d="M13 18 L13 30 L35 30" stroke-dasharray="4 3"/>'
    ),
    desc:'Find all term/definition pairs before the clock stops.', min:2
  },
  {
    key:'speed', label:'Speed Round', gc:'var(--amber)',
    svg: SVG(
      '<circle cx="24" cy="28" r="16"/>' +
      '<polyline points="24 17 24 28 31 34"/>' +
      '<line x1="18" y1="5" x2="30" y2="5"/>' +
      '<line x1="24" y1="5" x2="24" y2="12"/>'
    ),
    desc:'Multiple choice, 12 seconds per question. Points for speed.', min:2
  },
  {
    key:'hangman', label:'Hangman', gc:'var(--red)',
    svg: SVG(
      '<line x1="6" y1="44" x2="42" y2="44"/>' +
      '<line x1="14" y1="44" x2="14" y2="5"/>' +
      '<line x1="14" y1="5" x2="32" y2="5"/>' +
      '<line x1="32" y1="5" x2="32" y2="13"/>' +
      '<circle cx="32" cy="20" r="7"/>' +
      '<line x1="32" y1="27" x2="32" y2="37"/>' +
      '<line x1="32" y1="31" x2="25" y2="35"/>' +
      '<line x1="32" y1="31" x2="39" y2="35"/>' +
      '<line x1="32" y1="37" x2="25" y2="43"/>' +
      '<line x1="32" y1="37" x2="39" y2="43"/>'
    ),
    desc:'Given the definition, guess the term letter by letter.', min:1
  },
  {
    key:'scramble', label:'Word Scramble', gc:'var(--blue)',
    svg: SVG(
      '<rect x="4" y="4" width="13" height="13" rx="2"/>' +
      '<rect x="31" y="4" width="13" height="13" rx="2"/>' +
      '<rect x="18" y="17" width="12" height="12" rx="2"/>' +
      '<rect x="4" y="31" width="13" height="13" rx="2"/>' +
      '<rect x="31" y="31" width="13" height="13" rx="2"/>'
    ),
    desc:'Letters of the term are shuffled. Tap them in the right order.', min:1
  },
  {
    key:'truefalse', label:'True or False', gc:'var(--accent)',
    svg: SVG(
      '<circle cx="13" cy="24" r="10"/>' +
      '<polyline points="8 24 12 28 19 20"/>' +
      '<circle cx="35" cy="24" r="10"/>' +
      '<line x1="30" y1="19" x2="40" y2="29"/>' +
      '<line x1="40" y1="19" x2="30" y2="29"/>'
    ),
    desc:'Is this term/definition pair correct? Decide fast.', min:2
  },
  {
    key:'survival', label:'Survival', gc:'var(--red)',
    svg: SVG(
      '<path d="M24 40 C24 40 6 28 6 16 C6 9 11 5 17 5 C20 5 22 7 24 10 C26 7 28 5 31 5 C37 5 42 9 42 16 C42 28 24 40 24 40Z"/>'
    ),
    desc:'3 lives. Infinite questions. Beat your high score.', min:2
  },
  {
    key:'gravity', label:'Gravity', gc:'var(--purple)',
    svg: SVG(
      '<circle cx="24" cy="9" r="7"/>' +
      '<line x1="24" y1="16" x2="24" y2="36"/>' +
      '<polyline points="15 28 24 37 33 28"/>' +
      '<line x1="6" y1="21" x2="13" y2="21" stroke-width="2" opacity="0.45"/>' +
      '<line x1="35" y1="21" x2="42" y2="21" stroke-width="2" opacity="0.45"/>' +
      '<line x1="4" y1="28" x2="13" y2="28" stroke-width="2" opacity="0.45"/>' +
      '<line x1="35" y1="28" x2="44" y2="28" stroke-width="2" opacity="0.45"/>'
    ),
    desc:'Type the term before the definition card hits the bottom.', min:2
  },
  {
    key:'lightning', label:'Lightning Run', gc:'var(--amber)',
    svg: SVG(
      '<polyline points="30 4 16 26 25 26 18 44"/>'
    ),
    desc:'Race through the entire deck as fast as possible.', min:1
  },
];

/* ══════════════════════════════════════
   PAGE: GAMES HUB
══════════════════════════════════════ */

function renderGames() {
  announce('Games');

  $app.innerHTML =
    '<section class="page animate-fade-up" aria-labelledby="games-heading">' +
      '<header class="games-header">' +
        '<h1 id="games-heading">Game Modes</h1>' +
        '<p style="color:var(--text-3);margin-top:.35rem">Pick a game, then choose a set</p>' +
      '</header>' +
      '<ul class="games-hub-grid mt-4" role="list" id="games-hub-list"></ul>' +
    '</section>';

  var list = document.getElementById('games-hub-list');
  ALL_GAMES.forEach(function (game) {
    var li = document.createElement('li');
    var a  = document.createElement('a');
    a.href      = '#/games/' + game.key;
    a.className = 'game-hub-tile';
    a.style.setProperty('--gc', game.gc);
    a.setAttribute('aria-label', game.label + ': ' + game.desc);

    var iconArea = document.createElement('div');
    iconArea.className = 'game-hub-icon-area';
    iconArea.setAttribute('aria-hidden', 'true');
    iconArea.innerHTML = '<div class="game-hub-icon">' + game.svg + '</div>';

    var body = document.createElement('div');
    body.className = 'game-hub-body';

    var title = document.createElement('h2');
    title.className   = 'game-hub-title';
    title.textContent = game.label;

    var desc = document.createElement('p');
    desc.className   = 'game-hub-desc';
    desc.textContent = game.desc;

    body.appendChild(title);
    body.appendChild(desc);
    a.appendChild(iconArea);
    a.appendChild(body);
    li.appendChild(a);
    list.appendChild(li);
  });
}

/* ══════════════════════════════════════
   PAGE: GAME SET PICKER
══════════════════════════════════════ */

function renderGameSetPicker(gameKey) {
  var meta = ALL_GAMES.find(function (g) { return g.key === gameKey; });
  if (!meta) { navigate('#/games'); return; }
  announce(meta.label);

  var sets = Storage.getAll().filter(function (s) { return s.cards.length >= meta.min; });

  $app.innerHTML =
    '<section class="page animate-fade-up" aria-labelledby="gsp-heading">' +
      '<a href="#/games" class="btn btn-ghost btn-sm" style="display:inline-flex;margin-bottom:1.25rem">&larr; All Games</a>' +
      '<header class="gsp-header" style="--gc:' + meta.gc + '">' +
        '<div class="gsp-header-icon" aria-hidden="true">' + meta.svg + '</div>' +
        '<div>' +
          '<h1 id="gsp-heading">' + e(meta.label) + '</h1>' +
          '<p class="gsp-header-desc">' + e(meta.desc) + '</p>' +
        '</div>' +
      '</header>' +
      '<h2 class="section-eyebrow mb-2">Choose a set</h2>' +
      (sets.length > 0
        ? '<ul class="gsp-list" role="list" id="gsp-sets"></ul>'
        : '<p style="color:var(--text-3);margin-top:.75rem">No sets with ' + meta.min + '+ cards. <a href="#/create" style="color:var(--accent)">Create one</a>.</p>'
      ) +
    '</section>';

  var list = document.getElementById('gsp-sets');
  if (!list) return;

  sets.forEach(function (set) {
    var li  = document.createElement('li');
    var row = document.createElement('a');
    row.href      = '#/games/' + set.id + '/' + gameKey;
    row.className = 'gsp-row card';

    var info  = document.createElement('span');
    var name  = document.createElement('span');
    name.className   = 'gsp-name';
    name.textContent = set.title;
    var count = document.createElement('span');
    count.className   = 'gsp-count';
    count.textContent = set.cards.length + ' cards';
    info.appendChild(name);
    info.appendChild(count);

    var arrow = document.createElement('span');
    arrow.className   = 'gsp-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';

    row.appendChild(info);
    row.appendChild(arrow);
    li.appendChild(row);
    list.appendChild(li);
  });
}

/* ══════════════════════════════════════
   PAGE: MATCH GAME
══════════════════════════════════════ */

function renderMatchGame(setId) {
  var set = Storage.getOne(setId);
  if (!set) { navigate('#/library'); return; }
  announce('Match Game — ' + set.title);

  var pairs = set.cards.slice(0, 6);
  var tiles = shuffle(
    pairs.map(function (c) { return { id: 'term-' + c.id, pairId: c.id, text: c.term,       type: 'term' }; }).concat(
    pairs.map(function (c) { return { id: 'def-'  + c.id, pairId: c.id, text: c.definition, type: 'def'  }; }))
  );

  var selected = null;
  var matched  = {};
  var seconds  = 0;
  var moves    = 0;

  $app.innerHTML =
    '<section class="page match-page animate-fade-up" aria-labelledby="match-sr-heading">' +
      '<header class="match-header">' +
        '<a href="#/set/' + e(setId) + '" class="btn btn-ghost btn-sm">← Back</a>' +
        '<div class="match-header-center">' +
          '<h1 id="match-sr-heading" class="sr-only">Match Game: ' + e(set.title) + '</h1>' +
          '<p class="match-set-name">' + e(set.title) + '</p>' +
          '<div class="match-stats" aria-live="off">' +
            '<span class="match-stat" id="match-timer">0s</span>' +
            '<output class="match-stat" id="match-progress" aria-live="polite">0/' + pairs.length + ' matched</output>' +
          '</div>' +
        '</div>' +
        '<button id="match-restart" type="button" class="btn btn-ghost btn-sm" aria-label="Restart game">↺</button>' +
      '</header>' +
      '<ul class="match-grid" id="match-grid" role="list" aria-label="Match cards"></ul>' +
      '<p class="match-hint" id="match-hint" aria-live="polite">Click a term, then click its matching definition</p>' +
    '</section>';

  /* Build tile buttons */
  var gridEl = document.getElementById('match-grid');
  tiles.forEach(function (tile) {
    var li  = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-tile ' + tile.type;
    btn.dataset.tileId = tile.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', (tile.type === 'term' ? 'Term' : 'Definition') + ': ' + tile.text);
    btn.innerHTML = '<span class="tile-type-dot" aria-hidden="true"></span><span class="tile-text"></span>';
    btn.querySelector('.tile-text').textContent = tile.text;
    li.appendChild(btn);
    gridEl.appendChild(li);
  });

  /* Timer */
  _activeTimer = setInterval(function () {
    seconds++;
    var el = document.getElementById('match-timer');
    if (el) {
      var m = Math.floor(seconds / 60);
      el.textContent = (m > 0 ? m + 'm ' : '') + (seconds % 60) + 's';
    }
  }, 1000);

  function getTile(id) { return tiles.find(function (t) { return t.id === id; }); }
  function getTileEl(id) { return document.querySelector('[data-tile-id="' + CSS.escape(id) + '"]'); }

  function refreshTile(id) {
    var btn = getTileEl(id);
    if (!btn) return;
    btn.classList.toggle('matched', !!matched[id]);
    btn.classList.toggle('sel', selected && selected.id === id);
    btn.disabled = !!matched[id];
    btn.setAttribute('aria-pressed', (selected && selected.id === id) ? 'true' : 'false');
  }

  gridEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.match-tile');
    if (!btn) return;
    var tileId = btn.dataset.tileId;
    if (matched[tileId]) return;

    var tile = getTile(tileId);

    if (selected && selected.id === tileId) {
      selected = null; refreshTile(tileId); return;
    }

    if (!selected) {
      selected = tile; refreshTile(tileId); return;
    }

    moves++;

    if (selected.pairId === tile.pairId) {
      /* Match! */
      matched[selected.id] = true; matched[tile.id] = true;
      refreshTile(selected.id); refreshTile(tile.id);
      selected = null;

      var matchedPairs = Object.keys(matched).length / 2;
      var prog = document.getElementById('match-progress');
      if (prog) prog.textContent = matchedPairs + '/' + pairs.length + ' matched';
      var hint = document.getElementById('match-hint');
      var left = pairs.length - matchedPairs;
      if (hint && left > 0) hint.textContent = left + ' pair' + (left !== 1 ? 's' : '') + ' left';

      if (matchedPairs === pairs.length) {
        clearTimer();
        setTimeout(showMatchDone, 500);
      }
    } else {
      /* Wrong */
      var prev = selected;
      btn.classList.add('wrong-flash');
      getTileEl(prev.id).classList.add('wrong-flash');
      selected = null;
      setTimeout(function () {
        var bPrev = getTileEl(prev.id);
        var bCurr = getTileEl(tile.id);
        if (bPrev) bPrev.classList.remove('wrong-flash');
        if (bCurr) bCurr.classList.remove('wrong-flash');
      }, 900);
    }
  });

  document.getElementById('match-restart').addEventListener('click', function () {
    clearTimer(); renderMatchGame(setId);
  });

  function showMatchDone() {
    var m = Math.floor(seconds / 60);
    var timeStr = (m > 0 ? m + 'm ' : '') + (seconds % 60) + 's';

    $app.innerHTML =
      '<section class="page match-done animate-fade-up" aria-labelledby="match-done-heading">' +
        '<article class="card match-results">' +
          '<h1 id="match-done-heading">You matched them all!</h1>' +
          '<dl class="match-final-stats">' +
            '<div class="mfs-item"><dd class="mfs-val">' + timeStr + '</dd><dt class="mfs-label">Time</dt></div>' +
            '<div class="mfs-item"><dd class="mfs-val">' + moves + '</dd><dt class="mfs-label">Attempts</dt></div>' +
            '<div class="mfs-item"><dd class="mfs-val">' + pairs.length + '</dd><dt class="mfs-label">Pairs</dt></div>' +
          '</dl>' +
          '<nav class="match-done-actions" aria-label="Next steps">' +
            '<button id="match-again" type="button" class="btn btn-primary btn-lg">Play Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
            '<a href="#/games" class="btn btn-ghost">All Games</a>' +
          '</nav>' +
        '</article>' +
      '</section>';

    document.getElementById('match-again').addEventListener('click', function () { renderMatchGame(setId); });
  }
}

/* ══════════════════════════════════════
   PAGE: SPEED ROUND
══════════════════════════════════════ */

function renderSpeedRound(setId) {
  var set = Storage.getOne(setId);
  if (!set || set.cards.length < 2) { navigate('#/set/' + setId); return; }
  announce('Speed Round — ' + set.title);

  var TIME_PER_Q = 12;

  var questions = shuffle(set.cards).map(function (card) {
    var wrong = shuffle(set.cards.filter(function (c) { return c.id !== card.id; })).slice(0, 3).map(function (c) { return c.definition; });
    return { question: card.term, choices: shuffle(wrong.concat(card.definition)), correct: card.definition };
  });

  var index    = 0;
  var score    = 0;
  var streak   = 0;
  var best     = 0;
  var timeLeft = TIME_PER_Q;
  var results  = [];
  var answered = false;

  function startTimer() {
    clearTimer();
    _activeTimer = setInterval(function () {
      timeLeft--;
      updateTimerUI();
      if (timeLeft <= 0) { clearTimer(); handleAnswer(null); }
    }, 1000);
  }

  function updateTimerUI() {
    var fill = document.getElementById('sr-fill');
    var num  = document.getElementById('sr-num');
    if (fill) { fill.style.width = (timeLeft / TIME_PER_Q * 100) + '%'; fill.style.background = timeLeft > 7 ? 'var(--green)' : timeLeft > 4 ? 'var(--amber)' : 'var(--red)'; }
    if (num)  { num.textContent = timeLeft + 's'; num.style.color = timeLeft > 7 ? 'var(--green)' : timeLeft > 4 ? 'var(--amber)' : 'var(--red)'; }
    var hint = document.getElementById('sr-hint');
    if (hint) hint.textContent = timeLeft <= 3 ? 'Hurry!' : '';
  }

  function render() {
    var q = questions[index];

    $app.innerHTML =
      '<section class="page sr-page animate-fade-up" aria-labelledby="sr-sr-heading">' +
        '<header class="sr-header">' +
          '<a href="#/set/' + e(setId) + '" class="btn btn-ghost btn-sm">← Back</a>' +
          '<div class="sr-header-center">' +
            '<h1 id="sr-sr-heading" class="sr-only">Speed Round: ' + e(set.title) + '</h1>' +
            '<p class="sr-set-name">' + e(set.title) + '</p>' +
            '<div class="sr-header-stats">' +
              '<span class="sr-pts">' + score + ' pts</span>' +
              (streak >= 2 ? '<span class="tag tag-amber">' + streak + ' streak</span>' : '') +
            '</div>' +
          '</div>' +
          '<output class="test-counter" aria-live="polite">' + (index + 1) + '/' + questions.length + '</output>' +
        '</header>' +

        '<div class="sr-timer-bar" aria-hidden="true">' +
          '<div id="sr-fill" class="sr-timer-fill" style="width:100%;background:var(--green)"></div>' +
          '<output id="sr-num" class="sr-timer-num" style="color:var(--green)">' + TIME_PER_Q + 's</output>' +
        '</div>' +

        '<article class="sr-question card animate-fade-up">' +
          '<p class="sr-q-label" aria-hidden="true">What is the definition of:</p>' +
          '<h2 class="sr-q-text" id="sr-q"></h2>' +
          '<div class="sr-choices test-choices" role="group" aria-label="Answer choices" id="sr-choices"></div>' +
          '<p id="sr-hint" class="sr-timeout-hint" aria-live="assertive"></p>' +
        '</article>' +
      '</section>';

    document.getElementById('sr-q').textContent = q.question;

    var choicesEl = document.getElementById('sr-choices');
    q.choices.forEach(function (choice, ci) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';

      var letter = document.createElement('span');
      letter.className = 'choice-letter';
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = String.fromCharCode(65 + ci);

      var text = document.createElement('span');
      text.textContent = choice;

      btn.appendChild(letter);
      btn.appendChild(text);
      btn.addEventListener('click', function () { if (!answered) handleAnswer(choice); });
      choicesEl.appendChild(btn);
    });

    startTimer();
  }

  function handleAnswer(choice) {
    if (answered) return;
    answered = true;
    clearTimer();

    var q = questions[index];
    var isCorrect = choice === q.correct;
    var isFast    = timeLeft >= TIME_PER_Q / 2;
    var pts = isCorrect ? (isFast ? 2 : 1) : 0;
    score += pts;
    streak = isCorrect ? streak + 1 : 0;
    if (streak > best) best = streak;

    results.push({ isCorrect: isCorrect });

    document.querySelectorAll('.choice-btn').forEach(function (btn) {
      var t = btn.querySelector('span:last-child').textContent;
      if (t === q.correct) btn.classList.add('correct');
      if (t === choice && !isCorrect) btn.classList.add('wrong');
      btn.disabled = true;
    });

    setTimeout(function () {
      answered = false; index++;
      if (index >= questions.length) showSpeedDone();
      else { timeLeft = TIME_PER_Q; render(); }
    }, 1100);
  }

  function showSpeedDone() {
    var correct = results.filter(function (r) { return r.isCorrect; }).length;
    var pct     = Math.round((correct / questions.length) * 100);
    var maxPts  = questions.length * 2;

    $app.innerHTML =
      '<section class="page sr-done animate-fade-up" aria-labelledby="sr-done-heading">' +
        '<article class="card sr-results">' +
          '<p class="result-label">' + (score >= maxPts * 0.8 ? 'Top score.' : score >= maxPts * 0.5 ? 'Good run.' : 'Keep going.') + '</p>' +
          '<h1 id="sr-done-heading">Speed Round Done!</h1>' +
          '<div class="sr-score-display">' +
            '<output class="sr-score-num" aria-label="Score: ' + score + ' out of ' + maxPts + '">' + score + '</output>' +
            '<span class="sr-score-max">/ ' + maxPts + ' pts</span>' +
          '</div>' +
          '<dl class="sr-final-stats">' +
            '<div class="sr-fstat"><dd><span style="color:var(--green)">' + correct + '</span></dd><dt><small>Correct</small></dt></div>' +
            '<div class="sr-fstat"><dd><span style="color:var(--amber)">' + best + '</span></dd><dt><small>Best Streak</small></dt></div>' +
            '<div class="sr-fstat"><dd><span style="color:var(--text)">' + pct + '%</span></dd><dt><small>Accuracy</small></dt></div>' +
          '</dl>' +
          '<p class="sr-bonus-note">Answering in the first 6 seconds earns 2 pts. Any correct answer earns 1 pt.</p>' +
          '<nav class="sr-done-actions" aria-label="Next steps">' +
            '<button id="sr-again" type="button" class="btn btn-primary btn-lg">Play Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';

    document.getElementById('sr-again').addEventListener('click', function () { renderSpeedRound(setId); });
  }

  render();
}

/* ══════════════════════════════════════
   GAME: HANGMAN
══════════════════════════════════════ */

function renderHangman(setId) {
  var set = Storage.getOne(setId);
  if (!set || !set.cards.length) { navigate('#/games'); return; }
  announce('Hangman');

  var MAX_WRONG = 6;
  var deck = shuffle(set.cards.slice());
  var deckIdx = 0;
  var score = 0;
  var card, termUpper, termLetterSet, wrongCount, guessed;

  function loadCard() {
    card = deck[deckIdx % deck.length];
    if (deckIdx > 0 && deckIdx % deck.length === 0) deck = shuffle(set.cards.slice());
    termUpper = card.term.toUpperCase();
    termLetterSet = {};
    termUpper.split('').forEach(function(ch) { if (/[A-Z]/.test(ch)) termLetterSet[ch] = true; });
    wrongCount = 0;
    guessed = {};
  }

  loadCard();

  function isWon() {
    return Object.keys(termLetterSet).every(function(ch) { return guessed[ch]; });
  }

  function render() {
    var won  = isWon();
    var lost = wrongCount >= MAX_WRONG;

    var displayWord = termUpper.split('').map(function(ch) {
      if (ch === ' ') return '<span class="hm-space"></span>';
      if (!/[A-Z]/.test(ch)) return '<span class="hm-letter revealed">' + e(ch) + '</span>';
      return guessed[ch]
        ? '<span class="hm-letter revealed">' + ch + '</span>'
        : (lost ? '<span class="hm-letter revealed" style="color:var(--red)">' + ch + '</span>'
                : '<span class="hm-letter blank">_</span>');
    }).join('');

    var PARTS = [
      '<circle cx="140" cy="72" r="20" class="hm-part"/>',
      '<line x1="140" y1="92" x2="140" y2="150" class="hm-part"/>',
      '<line x1="140" y1="112" x2="112" y2="138" class="hm-part"/>',
      '<line x1="140" y1="112" x2="168" y2="138" class="hm-part"/>',
      '<line x1="140" y1="150" x2="112" y2="188" class="hm-part"/>',
      '<line x1="140" y1="150" x2="168" y2="188" class="hm-part"/>',
    ];

    $app.innerHTML =
      '<section class="page hm-page animate-fade-up" aria-labelledby="hm-heading">' +
        '<header class="game-topbar">' +
          '<a href="#/games/hangman" class="btn btn-ghost btn-sm">&larr; Back</a>' +
          '<h1 id="hm-heading" class="sr-only">Hangman</h1>' +
          '<span class="game-set-name">' + e(set.title) + '</span>' +
          '<output class="game-score" aria-live="polite">' + score + ' correct</output>' +
        '</header>' +
        '<div class="hm-layout">' +
          '<div class="hm-left">' +
            '<svg class="hm-svg" viewBox="0 0 200 210" aria-hidden="true">' +
              '<line x1="20" y1="200" x2="180" y2="200" class="hm-scaffold"/>' +
              '<line x1="60" y1="200" x2="60" y2="10" class="hm-scaffold"/>' +
              '<line x1="60" y1="10" x2="140" y2="10" class="hm-scaffold"/>' +
              '<line x1="140" y1="10" x2="140" y2="52" class="hm-scaffold"/>' +
              PARTS.slice(0, wrongCount).join('') +
            '</svg>' +
            '<p class="hm-lives">' + (MAX_WRONG - wrongCount) + ' wrong left</p>' +
          '</div>' +
          '<div class="hm-right">' +
            '<p class="hm-def-label">Definition</p>' +
            '<p class="hm-definition"></p>' +
            '<div class="hm-word" aria-live="polite">' + displayWord + '</div>' +
            (won || lost
              ? '<div class="game-result ' + (won ? 'win' : 'lose') + '">' +
                  '<p>' + (won ? 'Correct!' : 'The answer was: ' + e(card.term)) + '</p>' +
                  '<button id="hm-next" type="button" class="btn btn-primary">Next Card</button>' +
                '</div>'
              : '<div class="hm-keyboard" role="group" aria-label="Letters">' +
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function(l) {
                    var g = guessed[l];
                    var cls = g ? (termLetterSet[l] ? ' letter-correct' : ' letter-wrong') : '';
                    return '<button class="letter-btn' + cls + '" data-l="' + l + '" ' + (g ? 'disabled' : '') + '>' + l + '</button>';
                  }).join('') +
                '</div>'
            ) +
          '</div>' +
        '</div>' +
      '</section>';

    document.querySelector('.hm-definition').textContent = card.definition;

    var kb = document.querySelector('.hm-keyboard');
    if (kb) {
      kb.addEventListener('click', function(ev) {
        var btn = ev.target.closest('.letter-btn');
        if (!btn || btn.disabled) return;
        var l = btn.dataset.l;
        guessed[l] = true;
        if (!termLetterSet[l]) wrongCount++;
        if (isWon()) score++;
        render();
      });
    }

    var nxt = document.getElementById('hm-next');
    if (nxt) nxt.addEventListener('click', function() { deckIdx++; loadCard(); render(); });
  }

  render();
}

/* ══════════════════════════════════════
   GAME: WORD SCRAMBLE
══════════════════════════════════════ */

function renderScramble(setId) {
  var set = Storage.getOne(setId);
  if (!set || !set.cards.length) { navigate('#/games'); return; }
  announce('Word Scramble');

  var deck = shuffle(set.cards.slice());
  var idx = 0, score = 0;
  var tiles, answer, card;

  function loadCard() {
    card = deck[idx % deck.length];
    if (idx > 0 && idx % deck.length === 0) deck = shuffle(set.cards.slice());
    var nonSpace = card.term.toUpperCase().split('').filter(function(c) { return c !== ' '; });
    tiles  = shuffle(nonSpace).map(function(c, i) { return { id: i, ch: c, used: false }; });
    answer = [];
  }

  loadCard();

  function termChars()    { return card.term.toUpperCase().split(''); }
  function nonSpaceChars(){ return termChars().filter(function(c){ return c !== ' '; }); }
  function isCorrect()    {
    var ans = answer.map(function(t){ return t.ch; }).join('');
    return ans === nonSpaceChars().join('');
  }

  function render() {
    var correct = isCorrect();
    var typedSoFar = answer.map(function(t){ return t.ch; });
    var tIdx = 0;
    var slots = termChars().map(function(ch) {
      if (ch === ' ') return '<span class="sc-space"></span>';
      var filled = tIdx < typedSoFar.length ? typedSoFar[tIdx++] : '';
      return '<span class="sc-slot' + (filled ? ' filled' : '') + '">' + e(filled) + '</span>';
    }).join('');

    $app.innerHTML =
      '<section class="page animate-fade-up" aria-labelledby="sc-heading">' +
        '<header class="game-topbar">' +
          '<a href="#/games/scramble" class="btn btn-ghost btn-sm">&larr; Back</a>' +
          '<h1 id="sc-heading" class="sr-only">Word Scramble</h1>' +
          '<span class="game-set-name">' + e(set.title) + '</span>' +
          '<output class="game-score" aria-live="polite">' + score + ' correct</output>' +
        '</header>' +
        '<article class="sc-card card">' +
          '<p class="hm-def-label">Definition</p>' +
          '<p class="sc-definition"></p>' +
          '<div class="sc-answer-row" aria-live="polite">' + slots + '</div>' +
          '<div class="sc-tiles" id="sc-tiles" role="group" aria-label="Available letters">' +
            tiles.map(function(t) {
              return '<button class="sc-tile' + (t.used ? ' used' : '') + '" data-id="' + t.id + '" ' + (t.used || correct ? 'disabled' : '') + '>' + t.ch + '</button>';
            }).join('') +
          '</div>' +
          '<div class="sc-actions">' +
            '<button id="sc-undo" class="btn btn-ghost"' + (answer.length === 0 ? ' disabled' : '') + '>Undo</button>' +
            '<button id="sc-skip" class="btn btn-ghost">Skip</button>' +
            (correct ? '<button id="sc-next" class="btn btn-primary">Next</button>' : '') +
          '</div>' +
          (correct ? '<p class="sc-success">Correct!</p>' : '') +
        '</article>' +
      '</section>';

    document.querySelector('.sc-definition').textContent = card.definition;

    document.getElementById('sc-tiles').addEventListener('click', function(ev) {
      var btn = ev.target.closest('.sc-tile');
      if (!btn || btn.disabled || correct) return;
      var id  = parseInt(btn.dataset.id, 10);
      var tile = tiles.find(function(t){ return t.id === id; });
      if (!tile || tile.used) return;
      tile.used = true;
      answer.push(tile);
      if (isCorrect()) score++;
      render();
    });

    var undoBtn = document.getElementById('sc-undo');
    if (undoBtn) undoBtn.addEventListener('click', function() {
      if (!answer.length) return;
      tiles.find(function(t){ return t.id === answer[answer.length-1].id; }).used = false;
      answer.pop(); render();
    });

    document.getElementById('sc-skip').addEventListener('click', function() { idx++; loadCard(); render(); });
    var nextBtn = document.getElementById('sc-next');
    if (nextBtn) nextBtn.addEventListener('click', function() { idx++; loadCard(); render(); });
  }

  render();
}

/* ══════════════════════════════════════
   GAME: TRUE OR FALSE
══════════════════════════════════════ */

function renderTrueFalse(setId) {
  var set = Storage.getOne(setId);
  if (!set || set.cards.length < 2) { navigate('#/games'); return; }
  announce('True or False');

  var shuffled = shuffle(set.cards.slice());
  var qs = [];
  shuffled.forEach(function(card, i) {
    qs.push({ term: card.term, def: card.definition, isTrue: true });
    var other = shuffled[(i + 1) % shuffled.length];
    qs.push({ term: card.term, def: other.definition, isTrue: false });
  });
  qs = shuffle(qs).slice(0, Math.min(qs.length, 20));

  var idx = 0, score = 0, answered = null;

  function render() {
    if (idx >= qs.length) { showDone(); return; }
    var q = qs[idx];

    $app.innerHTML =
      '<section class="page animate-fade-up" aria-labelledby="tf-heading">' +
        '<header class="game-topbar">' +
          '<a href="#/games/truefalse" class="btn btn-ghost btn-sm">&larr; Back</a>' +
          '<h1 id="tf-heading" class="sr-only">True or False</h1>' +
          '<span class="game-set-name">' + e(set.title) + '</span>' +
          '<output class="game-score" aria-live="polite">' + score + ' / ' + idx + '</output>' +
        '</header>' +
        '<progress value="' + idx + '" max="' + qs.length + '" class="mb-3" aria-label="Progress"></progress>' +
        '<article class="tf-card card">' +
          '<p class="tf-term"></p>' +
          '<p class="tf-connector">means</p>' +
          '<p class="tf-definition"></p>' +
          (answered !== null
            ? '<p class="tf-result ' + (answered === q.isTrue ? 'tf-correct' : 'tf-wrong') + '" aria-live="polite">' +
                (answered === q.isTrue ? 'Correct!' : 'Wrong — it was ' + (q.isTrue ? 'true' : 'false')) + '</p>' +
              '<button id="tf-next" type="button" class="btn btn-primary tf-next-btn">' + (idx + 1 >= qs.length ? 'See Results' : 'Next') + '</button>'
            : '<div class="tf-buttons" role="group" aria-label="True or false?">' +
                '<button class="tf-btn tf-true"  data-ans="true">True</button>' +
                '<button class="tf-btn tf-false" data-ans="false">False</button>' +
              '</div>'
          ) +
        '</article>' +
      '</section>';

    document.querySelector('.tf-term').textContent = q.term;
    document.querySelector('.tf-definition').textContent = q.def;

    if (answered === null) {
      document.querySelector('.tf-buttons').addEventListener('click', function(ev) {
        var btn = ev.target.closest('[data-ans]');
        if (!btn) return;
        answered = btn.dataset.ans === 'true';
        if (answered === q.isTrue) score++;
        render();
      });
    } else {
      document.getElementById('tf-next').addEventListener('click', function() {
        idx++; answered = null; render();
      });
    }
  }

  function showDone() {
    var pct = Math.round((score / qs.length) * 100);
    $app.innerHTML =
      '<section class="page test-done animate-fade-up" aria-labelledby="tf-done-heading">' +
        '<article class="card test-results">' +
          '<p class="result-label">' + (pct === 100 ? 'Perfect!' : pct >= 70 ? 'Nice work.' : 'Keep at it.') + '</p>' +
          '<h1 id="tf-done-heading">Done!</h1>' +
          '<p class="test-score-pill" style="background:' + (pct>=70?'var(--green-dim)':'var(--red-dim)') + ';color:' + (pct>=70?'var(--green)':'var(--red)') + '">' + score + ' / ' + qs.length + ' correct &mdash; ' + pct + '%</p>' +
          '<nav class="test-done-actions">' +
            '<button id="tf-restart" class="btn btn-primary btn-lg">Play Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';
    document.getElementById('tf-restart').addEventListener('click', function() { renderTrueFalse(setId); });
  }

  render();
}

/* ══════════════════════════════════════
   GAME: SURVIVAL
══════════════════════════════════════ */

function renderSurvival(setId) {
  var set = Storage.getOne(setId);
  if (!set || set.cards.length < 2) { navigate('#/games'); return; }
  announce('Survival');

  var HS_KEY = 'hs-sv-' + setId;
  var best   = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
  var lives  = 3, score = 0, selected = null;
  var pool   = shuffle(set.cards.slice()), poolIdx = 0;

  function nextQ() {
    if (poolIdx >= pool.length) { pool = shuffle(set.cards.slice()); poolIdx = 0; }
    var card  = pool[poolIdx++];
    var wrong = shuffle(set.cards.filter(function(c){ return c.id !== card.id; })).slice(0,3).map(function(c){ return c.definition; });
    return { term: card.term, choices: shuffle(wrong.concat(card.definition)), correct: card.definition };
  }

  var q = nextQ();

  function render() {
    $app.innerHTML =
      '<section class="page sv-page animate-fade-up" aria-labelledby="sv-heading">' +
        '<header class="game-topbar">' +
          '<a href="#/games/survival" class="btn btn-ghost btn-sm">&larr; Back</a>' +
          '<h1 id="sv-heading" class="sr-only">Survival</h1>' +
          '<span class="game-set-name">' + e(set.title) + '</span>' +
          '<div class="sv-lives" aria-label="Lives: ' + lives + '">' +
            [0,1,2].map(function(i){ return '<span class="sv-life' + (i < lives ? ' alive' : '') + '" aria-hidden="true"></span>'; }).join('') +
          '</div>' +
        '</header>' +
        '<div class="sv-score-row">' +
          '<output class="sv-score">' + score + '</output>' +
          '<span class="sv-score-label">correct</span>' +
          (best > 0 ? '<span class="sv-high-score">Best: ' + best + '</span>' : '') +
        '</div>' +
        '<article class="card test-question">' +
          '<p class="test-q-label">Definition of:</p>' +
          '<h2 class="test-q-text" id="sv-q"></h2>' +
          '<div class="test-choices" id="sv-choices" role="group" aria-label="Choices"></div>' +
        '</article>' +
      '</section>';

    document.getElementById('sv-q').textContent = q.term;

    var choicesEl = document.getElementById('sv-choices');
    q.choices.forEach(function(choice, ci) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'choice-btn';
      var ltr = document.createElement('span'); ltr.className = 'choice-letter'; ltr.setAttribute('aria-hidden','true'); ltr.textContent = String.fromCharCode(65+ci);
      var txt = document.createElement('span'); txt.textContent = choice;
      btn.appendChild(ltr); btn.appendChild(txt);
      btn.addEventListener('click', function() {
        if (selected !== null) return;
        selected = choice;
        var ok = choice === q.correct;
        if (ok) { score++; if (score > best) { best = score; localStorage.setItem(HS_KEY, best); } }
        else lives--;
        choicesEl.querySelectorAll('.choice-btn').forEach(function(b) {
          var t = b.querySelector('span:last-child').textContent;
          if (t === q.correct) b.classList.add('correct');
          if (t === selected && !ok) b.classList.add('wrong');
          b.disabled = true;
        });
        if (lives <= 0) { setTimeout(showOver, 900); }
        else { setTimeout(function(){ selected = null; q = nextQ(); render(); }, 900); }
      });
      choicesEl.appendChild(btn);
    });
  }

  function showOver() {
    $app.innerHTML =
      '<section class="page test-done animate-fade-up" aria-labelledby="sv-over">' +
        '<article class="card test-results">' +
          '<p class="result-label">Game Over</p>' +
          '<h1 id="sv-over">' + score + ' correct</h1>' +
          '<p class="test-score-pill" style="background:var(--accent-dim);color:var(--accent)">Best: ' + best + '</p>' +
          '<nav class="test-done-actions">' +
            '<button id="sv-restart" class="btn btn-primary btn-lg">Play Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';
    document.getElementById('sv-restart').addEventListener('click', function() { renderSurvival(setId); });
  }

  render();
}

/* ══════════════════════════════════════
   GAME: GRAVITY
══════════════════════════════════════ */

function renderGravity(setId) {
  var set = Storage.getOne(setId);
  if (!set || set.cards.length < 2) { navigate('#/games'); return; }
  announce('Gravity');

  var lives = 3, score = 0, speed = 9, gone = false;
  var pool = shuffle(set.cards.slice()), poolIdx = 0;
  var fallTimer = null, current;

  function nextCard() {
    if (poolIdx >= pool.length) { pool = shuffle(set.cards.slice()); poolIdx = 0; }
    return pool[poolIdx++];
  }

  current = nextCard();

  $app.innerHTML =
    '<section class="page gv-page animate-fade-up" aria-labelledby="gv-heading">' +
      '<header class="game-topbar">' +
        '<a href="#/games/gravity" class="btn btn-ghost btn-sm">&larr; Back</a>' +
        '<h1 id="gv-heading" class="sr-only">Gravity</h1>' +
        '<span class="game-set-name">' + e(set.title) + '</span>' +
        '<div class="sv-lives" id="gv-lives" aria-label="Lives">' +
          [0,1,2].map(function(i){ return '<span class="sv-life alive" aria-hidden="true"></span>'; }).join('') +
        '</div>' +
      '</header>' +
      '<output class="gv-score" id="gv-score" aria-live="polite">0</output>' +
      '<div class="gv-arena" id="gv-arena">' +
        '<div class="gv-card" id="gv-card"><p class="gv-def" id="gv-def"></p></div>' +
      '</div>' +
      '<form class="gv-form" id="gv-form">' +
        '<label for="gv-input" class="sr-only">Type the term</label>' +
        '<input id="gv-input" type="text" class="input gv-input" placeholder="Type the term..." autocomplete="off" />' +
        '<button type="submit" class="btn btn-primary">Check</button>' +
      '</form>' +
    '</section>';

  var defEl  = document.getElementById('gv-def');
  var cardEl = document.getElementById('gv-card');
  var inputEl= document.getElementById('gv-input');
  var scoreEl= document.getElementById('gv-score');
  var livesEl= document.getElementById('gv-lives');

  function updateLives() {
    livesEl.innerHTML = [0,1,2].map(function(i){ return '<span class="sv-life' + (i<lives?' alive':'') + '" aria-hidden="true"></span>'; }).join('');
  }

  function startFall() {
    if (gone) return;
    defEl.textContent = current.definition;
    cardEl.style.animation = 'none';
    void cardEl.offsetHeight;
    cardEl.style.animation = 'gv-fall ' + speed + 's linear forwards';
    inputEl.value = ''; inputEl.focus();
    fallTimer = setTimeout(function() { missCard(); }, speed * 1000);
  }

  function missCard() {
    if (gone) return;
    lives--; updateLives();
    if (lives <= 0) { gone = true; endGame(); return; }
    current = nextCard();
    speed = Math.max(3, speed - 0.4);
    startFall();
  }

  document.getElementById('gv-form').addEventListener('submit', function(ev) {
    ev.preventDefault();
    if (gone) return;
    var val = inputEl.value.trim();
    if (!val) return;
    if (val.toLowerCase() === current.term.toLowerCase()) {
      clearTimeout(fallTimer);
      score++; scoreEl.textContent = score;
      speed = Math.max(3, speed - 0.6);
      current = nextCard();
      startFall();
    } else {
      inputEl.value = '';
      inputEl.classList.add('input-wrong');
      setTimeout(function() { inputEl.classList.remove('input-wrong'); }, 500);
    }
  });

  window.addEventListener('hashchange', function cleanup() {
    clearTimeout(fallTimer); gone = true;
    window.removeEventListener('hashchange', cleanup);
  }, { once: true });

  function endGame() {
    clearTimeout(fallTimer);
    $app.innerHTML =
      '<section class="page test-done animate-fade-up" aria-labelledby="gv-over">' +
        '<article class="card test-results">' +
          '<p class="result-label">Game Over</p>' +
          '<h1 id="gv-over">You caught ' + score + ' card' + (score!==1?'s':'') + '</h1>' +
          '<nav class="test-done-actions">' +
            '<button id="gv-restart" class="btn btn-primary btn-lg">Play Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';
    document.getElementById('gv-restart').addEventListener('click', function() { renderGravity(setId); });
  }

  startFall();
}

/* ══════════════════════════════════════
   GAME: LIGHTNING RUN
══════════════════════════════════════ */

function renderLightning(setId) {
  var set = Storage.getOne(setId);
  if (!set || !set.cards.length) { navigate('#/games'); return; }
  announce('Lightning Run');

  var HS_KEY  = 'hs-ln-' + setId;
  var bestRaw = localStorage.getItem(HS_KEY);
  var bestMs  = bestRaw ? parseInt(bestRaw, 10) : null;

  var deck  = shuffle(set.cards.slice());
  var idx   = 0, score = 0;
  var start = Date.now();
  var tick  = null;

  function render() {
    clearInterval(tick);
    if (idx >= deck.length) { showDone(); return; }
    var card = deck[idx];

    $app.innerHTML =
      '<section class="page ln-page animate-fade-up" aria-labelledby="ln-heading">' +
        '<header class="game-topbar">' +
          '<a href="#/games/lightning" class="btn btn-ghost btn-sm">&larr; Back</a>' +
          '<h1 id="ln-heading" class="sr-only">Lightning Run</h1>' +
          '<span class="game-set-name">' + e(set.title) + '</span>' +
          '<output class="ln-timer" id="ln-timer" aria-live="off">0.0s</output>' +
        '</header>' +
        '<progress value="' + idx + '" max="' + deck.length + '" class="mb-3" aria-label="Card ' + (idx+1) + ' of ' + deck.length + '"></progress>' +
        '<article class="ln-card card">' +
          '<p class="hm-def-label">' + (idx+1) + ' / ' + deck.length + '</p>' +
          '<h2 class="ln-term"></h2>' +
          '<div class="ln-divider" aria-hidden="true"></div>' +
          '<p class="ln-definition"></p>' +
          '<div class="ln-actions" role="group" aria-label="Did you know it?">' +
            '<button id="ln-miss" type="button" class="btn fc-miss-btn">Missed it</button>' +
            '<button id="ln-got"  type="button" class="btn fc-got-btn">Got it</button>' +
          '</div>' +
        '</article>' +
      '</section>';

    document.querySelector('.ln-term').textContent = card.term;
    document.querySelector('.ln-definition').textContent = card.definition;

    tick = setInterval(function() {
      var el = document.getElementById('ln-timer');
      if (el) el.textContent = ((Date.now() - start) / 1000).toFixed(1) + 's';
    }, 100);

    function advance(gotIt) {
      clearInterval(tick);
      if (gotIt) score++;
      idx++; render();
    }

    document.getElementById('ln-got').addEventListener('click', function() { advance(true); });
    document.getElementById('ln-miss').addEventListener('click', function() { advance(false); });
  }

  function showDone() {
    var elapsed = Date.now() - start;
    var isNew   = bestMs === null || elapsed < bestMs;
    if (isNew) localStorage.setItem(HS_KEY, elapsed.toString());
    var pct = Math.round((score / deck.length) * 100);

    $app.innerHTML =
      '<section class="page test-done animate-fade-up" aria-labelledby="ln-done">' +
        '<article class="card test-results">' +
          '<p class="result-label">' + (isNew ? 'New personal best!' : 'Run complete.') + '</p>' +
          '<h1 id="ln-done">Lightning Run</h1>' +
          '<div class="ln-final-stats">' +
            '<div class="ln-stat"><output>' + (elapsed/1000).toFixed(1) + 's</output><span>Time</span></div>' +
            '<div class="ln-stat"><output>' + score + '/' + deck.length + '</output><span>Correct</span></div>' +
            '<div class="ln-stat"><output>' + pct + '%</output><span>Accuracy</span></div>' +
            (bestMs && !isNew ? '<div class="ln-stat"><output>' + (bestMs/1000).toFixed(1) + 's</output><span>Best</span></div>' : '') +
          '</div>' +
          '<nav class="test-done-actions">' +
            '<button id="ln-restart" class="btn btn-primary btn-lg">Run Again</button>' +
            '<a href="#/set/' + e(setId) + '" class="btn btn-ghost">Back to Set</a>' +
          '</nav>' +
        '</article>' +
      '</section>';
    document.getElementById('ln-restart').addEventListener('click', function() { renderLightning(setId); });
  }

  render();
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */

window.addEventListener('hashchange', handleRoute);
document.addEventListener('DOMContentLoaded', function () {
  initDialogs();
  handleRoute();
});
