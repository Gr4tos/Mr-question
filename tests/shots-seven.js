// Screenshot con 7 giocatori a 375x667 (versione compatta): un solo telefono e party online.
// Uso: node shots-seven.js [cartella-uscita]
const fs = require('fs'), path = require('path');
const { startHarness } = require('./fake/harness');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots', 'party-7'));
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ['Daniele', 'Giulia', 'Marco', 'Sara', 'Bartolomeo', 'Francesca', 'Alessandro'];
const W = 375, H = 667;

(async () => {
  const h = await startHarness();
  const geo = p => p.page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, vh: innerHeight, hOver: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  const shot = async (p, name) => { await p.settle(450); await p.page.evaluate(async () => document.fonts.ready); const g = await geo(p); console.log(name.padEnd(22), JSON.stringify(g), g.scrollH <= g.vh ? 'entra' : 'scorre di ' + (g.scrollH - g.vh) + 'px'); await p.page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
  try {
    // ---- un solo telefono, 7 giocatori ----
    const l = await h.newPlayer('locale7', { width: W, height: H, random: 0.99 });
    await l.open(); await l.click('#goLocal'); await l.waitScreen('homeScreen');
    for (let i = 0; i < 4; i++) await l.click('#plusPlayers');
    for (let i = 0; i < 7; i++) await l.type(`#nameFields input:nth-child(${i + 1})`, NAMES[i]);
    await shot(l, 'L1-impostazione');
    await l.click('#startGame'); await l.waitScreen('turnScreen'); await shot(l, 'L2-turno-chiuso');
    await l.click('#showQuestion'); await l.type('#answerInput', '3'); await shot(l, 'L3-turno-domanda');
    await l.click('#confirmAnswer'); await l.settle(80);
    for (let i = 1; i < 7; i++) { await l.click('#showQuestion'); await l.type('#answerInput', String(i + 2)); await l.click('#confirmAnswer'); await l.settle(80); }
    await shot(l, 'L4-riepilogo');
    await l.click('#goVote'); await l.settle(80);
    (await l.page.$$('.vote-option'))[2].click(); await l.settle(60);
    await shot(l, 'L5-voto');
    await l.click('#confirmVote'); await l.settle(200); await shot(l, 'L6-verdetto');

    // ---- party online, 7 giocatori ----
    const ps = [];
    ps.push(await h.newPlayer(NAMES[0], { width: W, height: H, random: 0.99 }));
    for (let i = 1; i < 7; i++) ps.push(await h.newPlayer(NAMES[i]));
    const a = ps[0];
    const code = await a.create(NAMES[0]);
    for (let i = 1; i < 7; i++) await ps[i].join(code, NAMES[i]);
    await a.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 7, null, 10000, '7 in sala');
    await a.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, 10000, 'avvio');
    await shot(a, 'O1-sala');
    await a.click('#onStart');
    for (const p of ps) { await p.waitScreen('onTurnScreen'); await p.waitFor(() => !document.getElementById('onAnswerArea').classList.contains('hidden'), null, 10000, 'domanda'); }
    await shot(a, 'O2-risposta');
    await a.answer(3); for (let i = 1; i < 4; i++) await ps[i].answer(i + 2); await a.settle(300);
    await shot(a, 'O3-attesa');
    for (let i = 4; i < 7; i++) await ps[i].answer(i + 2);
    for (const p of ps) await p.waitScreen('onSummaryScreen');
    await shot(a, 'O4-riepilogo');
    await a.click('#onToVote');
    for (const p of ps) { await p.waitScreen('onVoteScreen'); await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 6, null, 10000, 'opzioni'); }
    await a.page.evaluate(() => { document.querySelectorAll('#onVoteOptions .vote-option')[1].click(); }); await a.settle(200);
    await shot(a, 'O5-voto');
    await a.click('#onSign');
    for (let i = 1; i < 7; i++) {
      const p = ps[i];
      await p.page.evaluate(() => { document.querySelectorAll('#onVoteOptions .vote-option')[i0()].click(); function i0() { return 0; } });
      await p.click('#onSign');
    }
    for (const p of ps) await p.waitScreen('onResultScreen');
    await a.waitFor(() => document.querySelectorAll('#onVotesList .vote-row').length >= 1, null, 10000, 'voti');
    await shot(a, 'O6-verdetto');
    console.log('screenshot in', OUT);
  } finally { await h.stop(); }
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
