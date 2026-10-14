// Cancella una partita di prova rimasta nel database vero (dopo una prova interrotta).
// Ogni nome della partita viene "ripreso" da un telefono nuovo (possibile solo se il giocatore e' assente
// da piu' di 45 s) e poi lasciato con "Esci": l'ultimo che esce cancella la partita.
// Uso: node live-clean.js CODICE Nome1 Nome2 ...
const { startHarness } = require('./fake/harness');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const [code, ...names] = process.argv.slice(2);
  if (!code || !names.length) { console.log('Uso: node live-clean.js CODICE Nome1 Nome2 ...'); process.exit(1); }
  const h = await startHarness();
  try {
    for (const n of names) {
      const p = await h.newPlayer(`pulizia-${n}`, { fake: false });
      await p.goOnline(); await p.type('#onName', n); await p.type('#onCode', code); await p.click('#onJoin');
      let ok = false;
      for (let i = 0; i < 20 && !ok; i++) { await sleep(500); ok = (await p.screen()) !== 'onMenuScreen'; }
      if (!ok) { console.log(`${n}: non riesco a riprendere il posto:`, await p.text('#onMenuError')); continue; }
      await p.exit(true); await sleep(1500);
      console.log(`${n}: posto ripreso e lasciato`);
    }
  } finally { await h.stop(); }
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(1); });
