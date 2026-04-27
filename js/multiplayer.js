/* FlashForge — Multiplayer (Firebase Firestore) */
var MP = (function () {
  var COLL = 'mp_rooms';
  var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function db() { return Auth.getDb(); }

  function genCode() {
    var s = '';
    for (var i = 0; i < 4; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
    return s;
  }

  function shuffleDeck(cards) {
    var a = cards.map(function (c) {
      return { id: c.id, term: c.term, definition: c.definition };
    });
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  return {
    create: function (setId, uid, name) {
      if (!db()) return Promise.reject(new Error('Sign in to use multiplayer.'));
      var set = Storage.getOne(setId);
      if (!set || !set.cards.length) return Promise.reject(new Error('Set not found or empty.'));
      var code = genCode();
      return db().collection(COLL).doc(code).set({
        code:        code,
        hostId:      uid,
        hostName:    name,
        guestId:     null,
        guestName:   null,
        setId:       setId,
        setTitle:    set.title,
        deck:        shuffleDeck(set.cards),
        status:      'waiting',
        cardIndex:   0,
        hostScore:   0,
        guestScore:  0,
        roundWinner: null,
        createdAt:   Date.now(),
      }).then(function () { return code; });
    },

    join: function (code, uid, name) {
      if (!db()) return Promise.reject(new Error('Sign in to use multiplayer.'));
      var ref = db().collection(COLL).doc(code.toUpperCase().replace(/\s/g, ''));
      return db().runTransaction(function (tx) {
        return tx.get(ref).then(function (doc) {
          if (!doc.exists)                         throw new Error('Room not found. Check the code.');
          var d = doc.data();
          if (d.status === 'done')                 throw new Error('This game has already ended.');
          if (d.hostId === uid)                    throw new Error('You created this room — share the code with a friend.');
          if (d.guestId && d.guestId !== uid)      throw new Error('Room is full.');
          tx.update(ref, { guestId: uid, guestName: name, status: 'playing' });
          return doc.id;
        });
      });
    },

    /* Atomic "first buzz wins" — ignored if someone already buzzed this round */
    buzz: function (code, uid) {
      if (!db()) return Promise.resolve();
      var ref = db().collection(COLL).doc(code);
      return db().runTransaction(function (tx) {
        return tx.get(ref).then(function (doc) {
          if (!doc.exists || doc.data().roundWinner !== null) return;
          tx.update(ref, { roundWinner: uid });
        });
      });
    },

    /* Host-only: score the round, advance card, or end game */
    advance: function (code, cardIndex) {
      if (!db()) return Promise.resolve();
      var ref = db().collection(COLL).doc(code);
      return db().runTransaction(function (tx) {
        return tx.get(ref).then(function (doc) {
          if (!doc.exists) return;
          var d = doc.data();
          if (d.cardIndex !== cardIndex) return;
          var updates = { cardIndex: cardIndex + 1, roundWinner: null };
          if (d.roundWinner === d.hostId)  updates.hostScore  = d.hostScore  + 1;
          if (d.roundWinner === d.guestId) updates.guestScore = d.guestScore + 1;
          if (cardIndex + 1 >= d.deck.length) updates.status = 'done';
          tx.update(ref, updates);
        });
      });
    },

    end: function (code) {
      if (!db()) return Promise.resolve();
      return db().collection(COLL).doc(code).update({ status: 'done' }).catch(function () {});
    },

    listen: function (code, cb, onErr) {
      if (!db()) { if (onErr) onErr(new Error('Sign in to use multiplayer.')); return function () {}; }
      return db().collection(COLL).doc(code).onSnapshot(
        function (doc) { cb(doc.exists ? doc.data() : null); },
        function (err) { if (onErr) onErr(err); }
      );
    },
  };
})();
