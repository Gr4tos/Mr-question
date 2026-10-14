// Controlla che online.js si colleghi all'SDK Firebase VERO salvato nel progetto (senza usare la rete):
// se manca un'esportazione o un percorso e' sbagliato, l'import fallisce.
const { startHarness } = require('./fake/harness');
(async () => {
  const h = await startHarness();
  let ok = false;
  try {
    const p = await h.newPlayer('reale', { fake: false });
    await p.open();
    const r = await p.page.evaluate(async () => {
      const mod = await import('/online.js');
      const app = await import('/assets/vendor/firebase/firebase-app.js');
      const db = await import('/assets/vendor/firebase/firebase-database.js');
      const au = await import('/assets/vendor/firebase/firebase-auth.js');
      const a = app.initializeApp({ apiKey: 'x', authDomain: 'x.firebaseapp.com', databaseURL: 'https://x-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'x', appId: '1:1:web:1' }, 'linkcheck');
      const d = db.getDatabase(a);
      const q = db.query(db.ref(d, 'index'), db.orderByValue(), db.endAt(1), db.limitToFirst(5));
      return { startOnline: typeof mod.startOnline, auth: typeof au.getAuth(a), ref: db.ref(d, 'games/ABCDE/meta').toString(), ts: JSON.stringify(db.serverTimestamp()), query: typeof q, signIn: typeof au.signInAnonymously, onDisconnect: typeof db.onDisconnect };
    });
    console.log(JSON.stringify(r, null, 1));
    console.log('errori di pagina:', p.errors.length ? p.errors : '(nessuno)');
    ok = r.startOnline === 'function' && r.signIn === 'function' && r.onDisconnect === 'function' && p.errors.length === 0;
  } catch (e) { console.error('ERRORE:', e.message); } finally { await h.stop(); }
  console.log(ok ? 'OK - online.js si collega all\'SDK vero' : 'FAIL');
  process.exit(ok ? 0 : 1);
})();
