/* QuizForge — Firestore Sync
 * Keeps localStorage and Firestore in sync when a user is signed in.
 * All app logic uses localStorage (fast, sync). Firestore is updated in the background.
 */
var Sync = (function () {

  function uid()    { var u = Auth.getUser(); return u ? u.sub : null; }
  function db()     { return Auth.getDb(); }
  function active() { return !!(uid() && db()); }

  function setsRef() {
    return db().collection('users').doc(uid()).collection('sets');
  }

  /* Push one set to Firestore */
  function push(set) {
    if (!active()) return;
    setsRef().doc(set.id).set(set).catch(function (e) {
      console.warn('[Sync] push failed:', e.message);
    });
  }

  /* Remove one set from Firestore */
  function remove(setId) {
    if (!active()) return;
    setsRef().doc(setId).delete().catch(function (e) {
      console.warn('[Sync] remove failed:', e.message);
    });
  }

  /* Pull all sets from Firestore on sign-in */
  function pull(userId) {
    var d = db();
    if (!d) return;

    if (window.showToast) showToast('Loading your sets...');

    d.collection('users').doc(userId).collection('sets')
      .orderBy('createdAt', 'desc')
      .get()
      .then(function (snap) {
        if (snap.empty) {
          /* First sign-in on this account — push existing local sets up */
          var local = Storage.getAll();
          if (local.length) {
            local.forEach(function (s) { push(s); });
            if (window.showToast) showToast('Your sets have been saved to your account.');
          }
        } else {
          /* Load cloud sets, replace local storage */
          var sets = [];
          snap.forEach(function (doc) { sets.push(doc.data()); });
          Storage.save(sets);
          if (window.showToast) showToast('Sets loaded from your account.');
          /* Re-render so the page reflects the cloud sets */
          if (window.handleRoute) handleRoute();
        }
      })
      .catch(function (e) {
        console.warn('[Sync] pull failed:', e.message);
        if (window.showToast) showToast('Could not load cloud sets — showing local data.');
      });
  }

  return { active, push, remove, pull };
})();
