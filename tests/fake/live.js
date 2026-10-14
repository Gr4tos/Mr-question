// Strumenti per le prove sul database VERO: operazioni eseguite dentro la pagina di un giocatore,
// con la sua identita' anonima e l'SDK vero (la stessa istanza usata da online.js).
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// code: corpo di una funzione async con D (modulo database), A (modulo auth), db, auth, arg
async function run(p, code, arg) {
  return p.page.evaluate(async (code, arg) => {
    const D = await import('/assets/vendor/firebase/firebase-database.js');
    const A = await import('/assets/vendor/firebase/firebase-auth.js');
    const app = (await import('/assets/vendor/firebase/firebase-app.js')).getApp();
    const db = D.getDatabase(app), auth = A.getAuth(app);
    const f = new (Object.getPrototypeOf(async function () {}).constructor)('D', 'A', 'db', 'auth', 'arg', code);
    const limit = new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('nessuna risposta in 20 s'), { code: 'TIMEOUT' })), 20000));
    try { return { ok: true, value: await Promise.race([f(D, A, db, auth, arg), limit]) }; }
    catch (e) { return { ok: false, code: String(e.code || ''), message: String(e.message || e).slice(0, 160) }; }
  }, code, arg);
}
const isDenied = r => !r.ok && /permission[_ ]denied/i.test(`${r.code} ${r.message}`);
const read = (p, path) => run(p, 'return (await D.get(D.ref(db, arg))).val();', path);
const write = (p, path, patch) => run(p, 'await D.update(D.ref(db, arg.path), arg.patch); return true;', { path, patch });
const uidOf = async p => (await run(p, 'return auth.currentUser && auth.currentUser.uid;')).value;
const deleteAnon = p => run(p, 'if (auth.currentUser) { await A.deleteUser(auth.currentUser); return true; } return false;');

// messaggi di permesso negato registrati dal browser (spia: in un flusso normale non devono esserci)
const denials = p => p.logs.filter(l => /permission|denied/i.test(l));

module.exports = { run, read, write, uidOf, deleteAnon, isDenied, denials, AsyncFunction };
