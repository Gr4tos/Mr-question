// Screenshot di tutte le schermate (un telefono e party online) a 390x844, per confrontarle con design/design-reference.html.
// Uso: node shots-party.js [dark|light] [cartella-uscita] [file-css-da-aggiungere]
// L'ultimo argomento serve solo per provare una proposta di tema senza toccare style.css.
const fs = require('fs'), path = require('path');
const { startHarness } = require('./fake/harness');
const theme = process.argv[2] === 'light' ? 'light' : 'dark';
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'shots', `party-${theme}`));
const extraCss = process.argv[4] ? fs.readFileSync(path.resolve(process.argv[4]), 'utf8') : '';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const h = await startHarness();
  const prep = async p => {
    await p.page.evaluateOnNewDocument((t, css) => {
      try { localStorage.setItem('mq_theme', t); } catch (e) {}
      if (css) document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); });
    }, theme, extraCss);
  };
  const shot = async (p, name) => { await p.settle(450); await p.page.evaluate(async () => document.fonts.ready); await p.page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
  try {
    // ---- un solo telefono ----
    const l = await h.newPlayer('locale', { width: 390, height: 844, random: 0.99 });
    await prep(l); await l.open();
    await shot(l, '01-menu');
    await l.click('#goLocal'); await l.waitScreen('homeScreen');
    await l.type('#nameFields input:nth-child(1)', 'Daniele'); await l.type('#nameFields input:nth-child(2)', 'Giulia'); await l.type('#nameFields input:nth-child(3)', 'Marco');
    await shot(l, '02-impostazione');
    await l.click('#startGame'); await l.waitScreen('turnScreen');
    await shot(l, '03-turno-chiuso');
    await l.click('#showQuestion'); await l.type('#answerInput', '3'); await shot(l, '04-turno-domanda');
    await l.click('#helpButton'); await shot(l, '05-aiuto'); await l.click('#helpClose'); await l.settle(200);
    await l.click('#exitButton'); await shot(l, '06-uscita'); await l.click('#exitStay'); await l.settle(200);
    await l.click('#confirmAnswer'); await l.settle(80);
    for (const v of ['2', '7']) { await l.click('#showQuestion'); await l.type('#answerInput', v); await l.click('#confirmAnswer'); await l.settle(80); }
    await shot(l, '07-riepilogo');
    await l.click('#goVote'); await l.settle(80);
    (await l.page.$$('.vote-option'))[1].click(); await l.settle(60);
    await shot(l, '08-voto');
    await l.click('#confirmVote'); await l.settle(200); await shot(l, '09-verdetto');

    // ---- party online ----
    const a = await h.newPlayer('Daniele', { width: 390, height: 844, random: 0.99 }), b = await h.newPlayer('Giulia'), c = await h.newPlayer('Marco');
    await prep(a); await prep(b); await prep(c);
    await a.open(); await a.click('#goOnline'); await a.waitScreen('onMenuScreen'); await shot(a, '10-online-menu');
    const code = await a.create('Daniele');
    await b.join(code, 'Giulia'); await c.join(code, 'Marco');
    await a.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 3 && !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'sala');
    await shot(a, '11-sala');
    await a.click('#onStart');
    for (const p of [a, b, c]) { await p.waitScreen('onTurnScreen'); await p.waitFor(() => !document.getElementById('onAnswerArea').classList.contains('hidden'), null, 8000, 'domanda'); }
    await shot(a, '12-online-risposta');
    await a.answer(3); await b.answer(2); await a.settle(300);
    await shot(a, '13-online-attesa');
    await c.answer(7);
    for (const p of [a, b, c]) await p.waitScreen('onSummaryScreen');
    await shot(a, '14-online-riepilogo');
    await a.click('#onToVote');
    for (const p of [a, b, c]) { await p.waitScreen('onVoteScreen'); await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 2, null, 8000, 'opzioni'); }
    await a.page.evaluate(() => { document.querySelector('#onVoteOptions .vote-option').click(); }); await a.settle(200);
    await shot(a, '15-online-voto');
    await a.click('#onSign');
    for (const [p, n] of [[b, 'Marco'], [c, 'Giulia']]) {
      await p.page.evaluate(t => { [...document.querySelectorAll('#onVoteOptions .vote-option')].find(x => x.textContent.includes(t)).click(); }, n); await p.click('#onSign');
    }
    for (const p of [a, b, c]) await p.waitScreen('onResultScreen');
    await a.waitFor(() => document.querySelectorAll('#onVotesList .vote-row').length >= 1, null, 8000, 'voti');
    await shot(a, '16-online-verdetto');
    console.log('screenshot in', OUT);
  } finally { await h.stop(); }
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
