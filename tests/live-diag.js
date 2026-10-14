// Diagnosi sul database vero: quale variante della regola di lettura di "index" accetta la ricerca di pulizia?
// Richiede di aver pubblicato tests/diag-index.rules.json (non tocca partite: legge solo i nodi diag/*).
const { startHarness } = require('./fake/harness');
const L = require('./fake/live');
(async () => {
  const h = await startHarness(); h.timeout = 30000;
  let p = null;
  try {
    p = await h.newPlayer('diag', { fake: false });
    await p.goOnline();
    const keys = Object.keys(require('./diag-index.rules.json').rules.diag).filter(k => k.startsWith('d'));
    console.log('Ricerca: orderByValue + endAt(1000) + limitToFirst(5) su ogni variante della regola\n');
    for (const k of keys) {
      const r = await L.run(p, "const {query,ref,get,orderByValue,endAt,limitToFirst}=D; return (await get(query(ref(db, arg), orderByValue(), endAt(1000), limitToFirst(5)))).val();", `diag/${k}`);
      console.log(k.padEnd(34), r.ok ? 'CONSENTITA' : (L.isDenied(r) ? 'rifiutata ' : 'ERRORE ' + r.code + ' ' + r.message));
    }
    console.log('\nRicerca senza filtri su index (deve essere rifiutata):');
    const r2 = await L.run(p, "return (await D.get(D.ref(db, 'index'))).val();");
    console.log(r2.ok ? 'CONSENTITA' : (L.isDenied(r2) ? 'rifiutata' : 'ERRORE ' + r2.message));
  } catch (e) { console.error('ERRORE:', e.message); }
  finally { if (p) await L.deleteAnon(p).catch(() => {}); try { await h.stop(); } catch { /* ignora */ } }
})();
