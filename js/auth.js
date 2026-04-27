/* FlashForge — Firebase Authentication */
var Auth = (function () {
  var USER_KEY  = 'qf-user';
  var _onChange = null;
  var _db       = null;
  var _authReady = false;
  var _authReadyCbs = [];

  /* ── Helpers ── */
  function isConfigured() {
    return FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
    catch (e) { return null; }
  }
  function setUser(u) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    if (_onChange) _onChange(u);
  }
  function clearUser() {
    localStorage.removeItem(USER_KEY);
    if (_onChange) _onChange(null);
  }
  function getDb() { return _db; }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  /* ── Init ── */
  function init() {
    if (!isConfigured() || !window.firebase) return;

    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();

    firebase.auth().onAuthStateChanged(function (fbUser) {
      if (fbUser) {
        setUser({
          name:    fbUser.displayName || '',
          email:   fbUser.email       || '',
          picture: fbUser.photoURL    || '',
          sub:     fbUser.uid,
        });
        if (window.Sync) Sync.pull(fbUser.uid);
      } else {
        clearUser();
      }
      /* Mark auth as resolved and flush any waiting callbacks */
      if (!_authReady) {
        _authReady = true;
        _authReadyCbs.forEach(function (cb) { cb(); });
        _authReadyCbs = [];
      }
    });

    /* Handle redirect result after returning from Google sign-in on mobile */
    firebase.auth().getRedirectResult().catch(function (err) {
      if (window.showToast) showToast('Sign-in failed: ' + err.message);
    });
  }

  /* ── Sign in ── */
  function signIn() {
    if (!isConfigured()) {
      if (window.showToast) showToast('Firebase not configured — see js/firebase-config.js');
      return;
    }
    if (!window.firebase) {
      if (window.showToast) showToast('Firebase still loading, try again in a moment.');
      return;
    }
    var provider = new firebase.auth.GoogleAuthProvider();
    if (isMobile()) {
      firebase.auth().signInWithRedirect(provider);
    } else {
      firebase.auth().signInWithPopup(provider).catch(function (err) {
        if (window.showToast) showToast('Sign-in failed: ' + err.message);
      });
    }
  }

  /* ── Sign out ── */
  function signOut() {
    if (window.firebase && firebase.apps.length) {
      firebase.auth().signOut();
    } else {
      clearUser();
    }
  }

  function onChange(cb) { _onChange = cb; }

  /* Calls cb immediately if auth is already resolved, otherwise queues it */
  function onReady(cb) {
    if (_authReady) cb();
    else _authReadyCbs.push(cb);
  }

  return { getUser, setUser, clearUser, getDb, isConfigured, init, signIn, signOut, onChange, onReady };
})();
