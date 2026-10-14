// Collegamento minimo al database VERO: crea una partita, entra in sala, esce (la partita deve sparire).
const { startHarness } = require('./fake/harness');
const L = require('./fake/live');
(async () => {
  const h = await startHarness();
  h.timeout = 30000;
  let code = null, p = null;
  try {
    p = await h.newPlayer('smoke', { fake: false });
    const t0 = Date.now();
    code = await p.create('Prova');
    console.log(`partita creata sul database vero: ${code} (${Date.now() - t0} ms)`);
    console.log('uid anonimo:', (await L.uidOf(p) || '').slice(0, 8) + '...');
    console.log('meta letto dal database:', JSON.stringify(await L.read(p, `games/${code}/meta`)));
    await p.exit(true);
    await new Promise(r => setTimeout(r, 1500));
    const after = await L.read(p, `games/${code}/meta`);
    console.log('dopo l\'uscita meta =', JSON.stringify(after), after.ok && after.value === null ? '-> partita cancellata' : '-> ANCORA PRESENTE');
    console.log('messaggi di permesso negato:', L.denials(p));
    console.log('altri messaggi:', p.logs.filter(l => !/permission|denied/i.test(l)).slice(0, 5), 'errori di pagina:', p.errors);
    console.log('utente anonimo cancellato:', JSON.stringify(await L.deleteAnon(p)));
  } catch (e) { console.error('ERRORE:', e.message, '| codice:', code, '| log:', p && p.logs.slice(0, 5)); }
  finally { await h.stop(); }
})();
