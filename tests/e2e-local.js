// Regressione della modalita' "un solo telefono" (flusso invariato) dopo l'aggiunta del party online.
const { startHarness } = require('./fake/harness');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };

async function playRound(p, n, answers) {
  for (let i = 0; i < n; i++) {
    await p.click('#showQuestion');
    await p.type('#answerInput', String(answers ? answers[i] : i + 1));
    await p.click('#confirmAnswer'); await p.settle(60);
  }
}
async function vote(p, wrong) {
  await p.click('#goVote'); await p.settle(80);
  const imp = await p.page.evaluate(() => state.round.impostor);
  const n = await p.page.evaluate(() => state.names.length);
  (await p.page.$$('.vote-option'))[wrong ? (imp + 1) % n : imp].click(); await p.settle(60);
  await p.click('#confirmVote'); await p.settle(80);
  return { imp, title: await p.text('#resultTitle'), reveal: await p.text('#impostorReveal') };
}

(async () => {
  const h = await startHarness();
  try {
    const p = await h.newPlayer('Locale');
    await p.open();
    check('primo schermo: menù con le due scelte', (await p.screen()) === 'menuScreen' && await p.visible('#goLocal') && await p.visible('#goOnline'));
    check('timbro CASO APERTO, tastino di uscita nascosto', (await p.text('#caseStamp')) === 'CASO APERTO' && !(await p.visible('#exitButton')));
    await p.click('#goLocal'); await p.waitScreen('homeScreen');
    check('Home a un telefono: campi vuoti con placeholder "Sospettato N"', JSON.stringify(await p.page.$$eval('#nameFields input', e => e.map(i => [i.value, i.placeholder]))) === JSON.stringify([['', 'Sospettato 1'], ['', 'Sospettato 2'], ['', 'Sospettato 3']]));
    check('"Indietro" visibile', await p.visible('#backToMenu'));

    // 3 giocatori senza nomi: verdetto corretto, rivincita, verdetto sbagliato
    await p.click('#startGame'); await p.waitScreen('turnScreen');
    check('turno 1 / 3 con il nome di riserva', (await p.text('#turnStep')) === '1 / 3' && (await p.text('#currentPlayerName')) === 'Sospettato 1');
    await playRound(p, 3);
    check('riepilogo con le tre risposte', (await p.screen()) === 'voteScreen' && (await p.texts('.answer-row')).join('|') === 'Sospettato 11|Sospettato 22|Sospettato 33');
    const r1 = await vote(p, false);
    check('verdetto corretto, timbro CASO CHIUSO', r1.title === 'Beccato.' && (await p.text('#caseStamp')) === 'CASO CHIUSO', r1);
    await p.click('#rematch'); await p.waitScreen('turnScreen');
    check('"Continua": stessi nomi e timbro di nuovo APERTO', (await p.text('#currentPlayerName')) === 'Sospettato 1' && (await p.text('#caseStamp')) === 'CASO APERTO');
    await playRound(p, 3);
    const r2 = await vote(p, true);
    check('verdetto sbagliato e impostore diverso dal precedente', r2.title === 'Non questa volta.' && r2.imp !== r1.imp, [r1.imp, r2.imp]);
    await p.click('#newGame'); await p.waitScreen('homeScreen');
    check('nuovo fascicolo: si torna alla Home a un telefono con i campi vuoti', (await p.page.$$eval('#nameFields input', e => e.every(i => i.value === ''))));

    // nomi duplicati sul nome effettivo
    const inputs = await p.page.$$('#nameFields input');
    await p.page.evaluate(() => { const i = document.querySelectorAll('#nameFields input')[0]; i.value = 'sospettato 2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#startGame'); await p.settle(100);
    check('nome duplicato (campo 1 = placeholder del campo 2): errore inline, resta sulla Home', (await p.screen()) === 'homeScreen' && await p.visible('#homeError'), await p.text('#homeError'));
    void inputs;

    // 7 giocatori con nomi
    await p.page.evaluate(() => { const i = document.querySelectorAll('#nameFields input')[0]; i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    for (let i = 0; i < 4; i++) await p.click('#plusPlayers');
    const names = ['Dani', 'Tommy', 'Luca', 'Giulia', 'Marco', 'Sara', 'Alex'];
    for (let i = 0; i < 7; i++) await p.page.evaluate((k, v) => { const e = document.querySelectorAll('#nameFields input')[k]; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, i, names[i]);
    await p.click('#startGame'); await p.waitScreen('turnScreen');
    check('7 giocatori: turno 1 / 7', (await p.text('#turnStep')) === '1 / 7');
    await playRound(p, 7);
    check('7 risposte nel riepilogo', (await p.page.$$('.answer-row')).length === 7);
    const r7 = await vote(p, true);
    check('7 giocatori: verdetto sbagliato con l\'impostore giusto', r7.title === 'Non questa volta.' && r7.reveal === names[r7.imp], r7);

    // verdetto: due pulsanti di pari peso, "Continua" e "Nuova partita"
    const btn = sel => p.page.$eval(sel, e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { cls: e.className, text: e.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundImage, shadow: cs.boxShadow, font: cs.fontSize, color: cs.color, vis: r.height > 0 }; });
    const bc = await btn('#rematch'), bn = await btn('#newGame');
    check('verdetto: pulsanti "Continua" e "Nuova partita"', bc.text.startsWith('Continua') && bn.text.startsWith('Nuova partita'), [bc.text, bn.text]);
    check('verdetto: entrambi pulsanti principali, stessa forma, dimensione e stile', bc.cls === bn.cls && bc.cls.includes('primary-button') && bc.w === bn.w && bc.h === bn.h && bc.bg === bn.bg && bc.shadow === bn.shadow && bc.font === bn.font && bc.color === bn.color && bc.vis && bn.vis, { c: bc, n: bn });
    check('verdetto: i vecchi testi "Riapri il caso" e "Nuovo fascicolo" non ci sono piu\'', !(await p.body()).includes('Riapri il caso') && !(await p.body()).includes('Nuovo fascicolo'));
    await p.click('#newGame'); await p.waitScreen('homeScreen');
    check('"Nuova partita": torna all\'impostazione con numero e nomi memorizzati', (await p.text('#playerCount')) === '7' && (await p.page.$$eval('#nameFields input', e => e.map(i => i.value))).join() === names.join());

    // "Continua" con nomi: stessi giocatori e stessi nomi
    await p.click('#startGame'); await p.waitScreen('turnScreen');
    await playRound(p, 7); await vote(p, false);
    await p.click('#rematch'); await p.waitScreen('turnScreen');
    check('"Continua": nuovo round con gli stessi 7 nomi', (await p.text('#turnStep')) === '1 / 7' && (await p.page.evaluate(() => state.names.join())) === names.join() && (await p.text('#currentPlayerName')) === 'Dani');
    await p.exit(true); await p.click('#goLocal'); await p.waitScreen('homeScreen');

    // uscita a meta' partita
    await p.click('#startGame'); await p.waitScreen('turnScreen');
    await p.click('#showQuestion'); await p.type('#answerInput', '42');
    const q = await p.text('#questionText');
    await p.exit(false);
    check('"No, continua": domanda, risposta scritta e turno restano', (await p.screen()) === 'turnScreen' && (await p.text('#questionText')) === q && (await p.value('#answerInput')) === '42');
    await p.exit(true);
    check('"Sì, torna al menù": menù principale', (await p.screen()) === 'menuScreen');
    await p.click('#goLocal'); await p.waitScreen('homeScreen');
    check('numero e nomi dei giocatori mantenuti', (await p.text('#playerCount')) === '7' && (await p.page.$$eval('#nameFields input', e => e.map(i => i.value))).join() === names.join());
    await p.click('#backToMenu'); await p.settle();
    check('"Indietro" riporta al menù', (await p.screen()) === 'menuScreen');

    check('modalita\' a un telefono: mai caricato online.js né l\'SDK', !p.requested.some(u => u === '/online.js' || u.includes('vendor/firebase')), p.requested.filter(u => u.includes('online') || u.includes('firebase')));
    check('nessun alert()', p.dialogs === 0);
    check('nessun errore di pagina o console', p.errors.length === 0, p.errors);
  } finally { await h.stop(); }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERRORE', e); process.exit(1); });
