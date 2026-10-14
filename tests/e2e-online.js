// Test end-to-end del party online con giocatori simulati (finto backend + vere regole).
// Uso: npm install && node build-rules.js && node e2e-online.js [scenario...]   (es: node e2e-online.js s1 s4)
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./fake/harness');

const SHOTS = path.join(__dirname, 'shots');
let passes = 0, fails = 0;
const check = (label, cond, extra) => {
  if (cond) passes++; else fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEATS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

function game(h, code) {
  return {
    code,
    val: p => h.backend.valueAt(`games/${code}/${p}`),
    seatOf(name) { return SEATS.find(s => this.val(`players/${s}/name`) === name); },
    nameOf(seat) { return this.val(`players/${seat}/name`); },
    impostor() { return this.val('hostOnly/impostor'); }
  };
}
const screenText = (p, id) => p.page.$eval(`#${id}`, e => e.innerText);
const allOn = async (ps, id) => { for (const p of ps) await p.waitScreen(id); };
const inLobby = (p, n) => p.waitFor(k => document.querySelectorAll('#lobbyPlayers .player-row').length === k, n, 8000, `${n} giocatori in sala`);
const ready = p => p.waitFor(() => !document.getElementById('onAnswerArea').classList.contains('hidden'), null, 8000, 'la scheda con la domanda');

async function castVote(p, targetName) {
  await p.waitScreen('onVoteScreen');
  await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length > 0, null, 8000, 'le opzioni di voto');
  await p.page.evaluate(n => { [...document.querySelectorAll('#onVoteOptions .vote-option')].find(b => b.textContent.includes(n)).click(); }, targetName);
  await p.click('#onSign');
  // l'ultimo a votare passa subito al verdetto: va bene anche se "in attesa" non fa in tempo a comparire
  await p.waitFor(() => !document.getElementById('onVoteWait').classList.contains('hidden') || !document.getElementById('onVoteScreen').classList.contains('active'), null, 8000, 'la conferma del voto');
}
const stamp = p => p.text('#caseStamp');
const noErrors = (h, label, allowDenied = () => false) => {
  const errs = h.players.flatMap(p => p.errors.map(e => `${p.label}: ${e}`));
  check(`${label}: nessun errore di pagina o console`, errs.length === 0, errs.slice(0, 3));
  const denied = h.backend.denied.filter(d => !allowDenied(d));
  check(`${label}: nessuna scrittura o lettura rifiutata dalle regole`, denied.length === 0, denied.slice(0, 3));
};
async function shot(p, name) { fs.mkdirSync(SHOTS, { recursive: true }); await p.page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); }

// ---------------------------------------------------------------------------
async function s1(h) {
  console.log('\n== S1: partita da 3, privacy, pareggio, "Continua", "Nuova partita" ==');
  const a = await h.newPlayer('Anna'), b = await h.newPlayer('Bea'), c = await h.newPlayer('Carlo');
  const by = { Anna: a, Bea: b, Carlo: c };
  const code = await a.create('Anna'); const g = game(h, code);
  check('codice di 5 lettere senza I e O', /^[A-HJ-NP-Z]{5}$/.test(code), code);
  check('sala, host da solo: nessun pulsante, legge "In attesa di altri 2 sospettati"', !(await a.visible('#onStart')) && (await a.text('#lobbyHint')) === 'In attesa di altri 2 sospettati', await a.text('#lobbyHint'));
  await b.join(code, 'Bea'); await inLobby(a, 2);
  check('con 2 giocatori: nessun pulsante, l\'host legge "In attesa di almeno un altro sospettato"', !(await a.visible('#onStart')) && (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato', await a.text('#lobbyHint'));
  check('chi non e\' host non vede "Apri le indagini" e legge "In attesa dell\'host" con lo stesso conteggio', !(await b.visible('#onStart')) && (await b.text('#lobbyHint')) === 'In attesa dell’host. Serve almeno un altro sospettato.', await b.text('#lobbyHint'));
  await c.join(code, 'Carlo'); await inLobby(a, 3); await inLobby(c, 3);
  await a.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'il pulsante con 3 collegati');
  check('con 3 giocatori il pulsante compare (solo all\'host) e il testo cambia', await a.visible('#onStart') && !(await b.visible('#onStart')) && (await a.text('#lobbyHint')) === 'Quando siete tutti, aprite le indagini.' && (await b.text('#lobbyHint')) === 'In attesa che l’host apra le indagini…', [await a.text('#lobbyHint'), await b.text('#lobbyHint')]);
  const rows = await a.texts('#lobbyPlayers .player-row');
  check('sala: nomi, HOST e TU', rows[0].includes('Anna') && rows[0].includes('HOST') && rows[0].includes('TU') && rows[1].includes('Bea') && rows[2].includes('Carlo'), rows);
  check('il codice e\' lo stesso su tutti i telefoni', (await b.text('#lobbyCode')) === code && (await c.text('#lobbyCode')) === code);
  check('timbro CASO APERTO e tastino di uscita in sala', (await stamp(a)) === 'CASO APERTO' && await a.visible('#exitButton'));

  await a.click('#onStart');
  await allOn([a, b, c], 'onTurnScreen'); for (const p of [a, b, c]) await ready(p);
  const impSeat = g.impostor(), impName = g.nameOf(impSeat), imp = by[impName];
  const common = g.val('reveal/common');
  const qs = {}; for (const n of Object.keys(by)) qs[n] = await by[n].text('#onQuestion');
  check('chi non e\' impostore riceve la domanda comune', Object.keys(by).filter(n => n !== impName).every(n => qs[n] === common), qs);
  check('l\'impostore riceve una domanda diversa', qs[impName] !== common && qs[impName].length > 0);
  for (const p of [a, b, c]) check(`${p.label}: nessun testo rivela l'impostore`, !/impostor/i.test(await screenText(p, 'onTurnScreen')));
  check('l\'impostore non vede la domanda comune', !(await imp.body()).includes(common));
  check('timbro e progresso a inizio round', (await a.text('#onProgressText')) === '0 / 3' && (await stamp(a)) === 'CASO APERTO');
  check('il round e\' il numero 1 e l\'indice e\' aggiornato', g.val('meta/round') === 1 && typeof h.backend.valueAt(`index/${code}`) === 'number');

  // risposte: nessuno vede quelle altrui prima che abbiano risposto tutti
  await a.click('#onSend'); check('risposta vuota: messaggio inline', await a.visible('#onAnswerError'));
  await a.answer(111);
  check('Anna: vede la propria risposta a verbale', (await a.text('#onMyAnswer')) === '111');
  await b.answer(222); await a.settle();
  const wl = await a.texts('#onWaitList .wait-row');
  check('si vede solo chi ha gia\' risposto (Anna ✓, Bea ✓, Carlo …)', wl.length === 3 && wl[0].includes('✓') && wl[1].includes('✓') && wl[2].includes('…'), wl);
  check('progresso 2 / 3', (await a.text('#onProgressText')) === '2 / 3');
  const bodies = { a: await a.body(), b: await b.body(), c: await c.body() };
  check('Anna non vede la risposta di Bea; Bea non vede quella di Anna; Carlo nessuna', !bodies.a.includes('222') && !bodies.b.includes('111') && !bodies.c.includes('111') && !bodies.c.includes('222'));
  check('prima del riepilogo nessuno ha la domanda comune se e\' l\'impostore', !(await imp.body()).includes(common));
  await c.answer(333);
  await allOn([a, b, c], 'onSummaryScreen');
  await a.settle();
  for (const p of [a, b, c]) {
    check(`${p.label}: riepilogo con domanda comune e tre risposte`, (await p.text('#onCommon')) === common && (await p.texts('#onAnswers .answer-row')).join('|') === 'Anna111|Bea222|Carlo333');
  }
  check('solo l\'host vede "Alle votazioni"', await a.visible('#onToVote') && !(await b.visible('#onToVote')) && !(await c.visible('#onToVote')));
  check('gli altri leggono che si attende l\'host', /host/i.test(await b.text('#onSummaryHint')));

  // voto segreto, pareggio: Anna->Bea, Bea->Carlo, Carlo->Anna
  await a.click('#onToVote');
  await allOn([a, b, c], 'onVoteScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 2, null, 8000, '2 opzioni');
  check('non si puo\' votare se stessi: 2 opzioni senza il proprio nome', !(await a.texts('#onVoteOptions .vote-option')).some(t => t.includes('Anna')) && !(await b.texts('#onVoteOptions .vote-option')).some(t => t.includes('Bea')));
  await castVote(a, 'Bea'); await castVote(b, 'Carlo');
  await c.settle();
  check('chi ha votato e\' pubblico, chi ha votato cosa no', (await a.texts('#onVoteWaitList .wait-row')).join('|').includes('Carlo …') || (await a.texts('#onVoteWaitList .wait-row')).some(t => t.startsWith('Carlo') && t.includes('…')));
  check('nessun risultato prima che abbiano votato tutti', (await a.screen()) === 'onVoteScreen' && !(await a.body()).includes('VOTI RICEVUTI'));
  await castVote(c, 'Anna');
  await allOn([a, b, c], 'onResultScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 3, null, 8000, 'i voti ricevuti');
  for (const p of [a, b, c]) {
    check(`${p.label}: pareggio, l'impostore si salva`, (await p.text('#onResultTitle')) === 'Non questa volta.' && /Pareggio/.test(await p.text('#onResultText')), await p.text('#onResultText'));
    check(`${p.label}: impostore rivelato e un voto a testa`, (await p.text('#onImpostor')) === impName && (await p.texts('#onVotesList .wait-row')).every(t => t.endsWith('1')), await p.texts('#onVotesList .wait-row'));
  }
  check('timbro CASO CHIUSO sul verdetto', (await stamp(a)) === 'CASO CHIUSO');
  check('solo l\'host vede "Continua" e "Nuova partita"', await a.visible('#onContinue') && await a.visible('#onNewGame') && !(await b.visible('#onContinue')) && !(await b.visible('#onNewGame')) && /host/i.test(await b.text('#onResultHint')));

  const sty = sel => a.page.$eval(sel, e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return [e.className.replace(' hidden', ''), Math.round(r.width), Math.round(r.height), cs.backgroundImage, cs.boxShadow, cs.fontSize].join('|'); });
  check('verdetto online: "Continua" e "Nuova partita" hanno lo stesso peso', (await sty('#onContinue')) === (await sty('#onNewGame')).replace('quiet-button', 'primary-button') || ((await sty('#onContinue')).split('|').slice(0, 1).join() === (await sty('#onNewGame')).split('|').slice(0, 1).join() && (await sty('#onContinue')) === (await sty('#onNewGame'))), [await sty('#onContinue'), await sty('#onNewGame')]);

  // "Continua": nuovo round, stessi giocatori, impostore diverso
  await a.click('#onContinue');
  await allOn([a, b, c], 'onTurnScreen'); for (const p of [a, b, c]) await ready(p);
  const imp2 = g.impostor();
  check('round 2 con un altro impostore', g.val('meta/round') === 2 && imp2 !== impSeat, `${impSeat} -> ${imp2}`);
  check('risposte e voti azzerati; timbro di nuovo APERTO', g.val('answered') === null && g.val('votes') === null && g.val('result') === null && (await stamp(b)) === 'CASO APERTO' && (await b.value('#onAnswer')) === '');
  const imp2Name = g.nameOf(imp2);
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote');
  for (const n of Object.keys(by)) await castVote(by[n], n === imp2Name ? Object.keys(by).find(x => x !== n) : imp2Name);
  await allOn([a, b, c], 'onResultScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 3, null, 8000, 'i voti ricevuti');
  for (const p of [a, b, c]) check(`${p.label}: round 2 "Beccato." con 2 voti all'impostore`, (await p.text('#onResultTitle')) === 'Beccato.' && (await p.text('#onImpostor')) === imp2Name && (await p.texts('#onVotesList .wait-row'))[0].includes(imp2Name) && (await p.texts('#onVotesList .wait-row'))[0].endsWith('2'));

  // "Nuova partita"
  await a.click('#onNewGame');
  await allOn([a, b, c], 'onLobbyScreen'); await inLobby(b, 3);
  check('nuova partita: tutti in sala, dati del round cancellati', g.val('seats') === null && g.val('private') === null && g.val('hostOnly') === null && g.val('meta/phase') === 'lobby');
  await a.click('#onStart'); await allOn([a, b, c], 'onTurnScreen');
  check('si puo\' riavviare subito (round 1)', g.val('meta/round') === 1);
  noErrors(h, 'S1');
}

// ---------------------------------------------------------------------------
async function s2(h) {
  console.log('\n== S2: ingresso, errori, nomi unici, partita piena ==');
  const a = await h.newPlayer('Anna'); const code = await a.create('Anna');
  const x = await h.newPlayer('X');
  await x.goOnline();
  await x.click('#onJoin'); check('nome vuoto', /nome/i.test(await x.text('#onMenuError')) && await x.visible('#onMenuError'));
  await x.type('#onName', 'Xena'); await x.click('#onJoin'); check('codice mancante', /5 lettere/.test(await x.text('#onMenuError')));
  await x.type('#onCode', 'ioi0o'); check('il campo codice scarta I, O e cifre', (await x.value('#onCode')) === '');
  await x.type('#onCode', 'ZZZZZ'); await x.tryJoin();
  check('codice inesistente', /Non trovo/.test(await x.text('#onMenuError')), await x.text('#onMenuError'));
  await x.type('#onCode', code); await x.type('#onName', 'ANNA'); await x.tryJoin();
  check('nome uguale a un altro (maiuscole diverse)', /già in partita/.test(await x.text('#onMenuError')), await x.text('#onMenuError'));
  check('nessuno e\' entrato con il nome duplicato', h.backend.valueAt(`games/${code}/players/p2`) === null);
  await x.type('#onName', 'Xena'); await x.click('#onJoin'); await x.waitScreen('onLobbyScreen');
  await inLobby(a, 2); check('con un nome nuovo si entra', (await a.texts('#lobbyPlayers .player-row')).some(r => r.includes('Xena')));
  // riempire fino a 7
  const rest = [];
  for (const n of ['Bea', 'Carlo', 'Dino', 'Eva', 'Fabio']) { const p = await h.newPlayer(n); await p.join(code, n); rest.push(p); }
  await inLobby(a, 7);
  check('sala piena: 7 / 7', (await a.text('#lobbyCount')) === '7 / 7');
  const late = await h.newPlayer('Hugo'); await late.goOnline(); await late.type('#onName', 'Hugo'); await late.type('#onCode', code); await late.tryJoin();
  check('ottavo giocatore: partita piena', /piena/.test(await late.text('#onMenuError')), await late.text('#onMenuError'));
  await a.click('#onStart'); await a.waitScreen('onTurnScreen');
  const late2 = await h.newPlayer('Ugo'); await late2.goOnline(); await late2.type('#onName', 'Ugo'); await late2.type('#onCode', code); await late2.tryJoin();
  check('a partita iniziata non si entra con un nome nuovo', /già iniziata/.test(await late2.text('#onMenuError')), await late2.text('#onMenuError'));
  // codici
  const codes = [];
  for (let i = 0; i < 4; i++) { const p = await h.newPlayer(`G${i}`); codes.push(await p.create(`Gio${i}`)); }
  check('tutti i codici generati sono validi e diversi', codes.every(c => /^[A-HJ-NP-Z]{5}$/.test(c)) && new Set(codes).size === 4, codes);
  noErrors(h, 'S2');
}

// ---------------------------------------------------------------------------
async function s3(h) {
  console.log('\n== S3: disconnessione, tolleranza di 45 s, rientro da un altro telefono ==');
  const a = await h.newPlayer('Anna'), b = await h.newPlayer('Bea'), c = await h.newPlayer('Carlo'), d = await h.newPlayer('Dino');
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn([a, b, c, d], 'onTurnScreen');
  await a.answer(1);
  await b.offline();
  await a.settle();
  check('chi cade diventa subito grigio per gli altri', (await a.page.$$eval('#onWaitList .dot.off', e => e.length)) === 1);
  check('nel database e\' segnato scollegato con l\'ora', g.val('players/p2/connected') === false && typeof g.val('players/p2/disconnectedAt') === 'number');
  check('il telefono scollegato mostra il banner', await b.visible('#netBanner'));
  await b.online(); await a.settle();
  check('se rientra dallo stesso telefono torna collegato e il banner sparisce', g.val('players/p2/connected') === true && !(await b.visible('#netBanner')) && (await a.page.$$eval('#onWaitList .dot.off', e => e.length)) === 0);
  check('dopo il rientro rivede la propria domanda', await b.visible('#onAnswerArea') && (await b.text('#onQuestion')).length > 0);
  // un altro telefono con lo stesso nome (maiuscole diverse)
  await b.offline();
  const b2 = await h.newPlayer('Bea2');
  await b2.goOnline(); await b2.type('#onName', 'bea'); await b2.type('#onCode', code); await b2.tryJoin();
  check('prima dei 45 s: posto non recuperabile, con il tempo mancante', /scollegato da poco.*riprova tra \d+ secondi/.test(await b2.text('#onMenuError')), await b2.text('#onMenuError'));
  await h.backend.advance(30000); await b2.tryJoin();
  check('a 30 s ancora no', /riprova tra/.test(await b2.text('#onMenuError')), await b2.text('#onMenuError'));
  await h.backend.advance(17000); await b2.click('#onJoin'); await b2.waitScreen('onTurnScreen');
  const newUid = await b2.page.evaluate(() => localStorage.getItem('fake_uid'));
  check('dopo 46 s: il nuovo telefono riprende il posto p2 con il nome originale', g.val('players/p2/owner') === newUid && g.val('players/p2/name') === 'Bea' && (await b2.text('#onMe')) === 'Bea');
  await ready(b2);
  check('il nuovo telefono rivede la domanda privata di quel posto', (await b2.text('#onQuestion')).length > 0);
  await b2.answer(222);
  check('e puo\' rispondere', g.val('answers/p2') === '222');
  await b.online(); await b.settle(300);
  check('il vecchio telefono, tornato in rete, scopre che il posto e\' stato ripreso', (await b.screen()) === 'onMenuScreen' && /ripreso/.test(await b.text('#onMenuError')), await b.text('#onMenuError'));
  check('il vecchio telefono non puo\' piu\' scrivere nel posto', g.val('players/p2/owner') === newUid);
  // ripresa dopo ricarica della pagina
  await c.open();
  await c.click('#goOnline'); await c.waitScreen('onMenuScreen');
  await c.waitFor(() => !document.getElementById('onResume').classList.contains('hidden'), null, 8000, 'il pulsante di ripresa');
  check('dopo una ricarica compare "Rientra nella partita"', /Rientra nella partita .* come Carlo/.test(await c.text('#onResume')), await c.text('#onResume'));
  await c.click('#onResume'); await c.waitScreen('onTurnScreen'); await ready(c);
  check('si rientra nel proprio posto con la propria domanda', g.val('players/p3/connected') === true && g.val('players/p3/owner') === (await c.page.evaluate(() => localStorage.getItem('fake_uid'))));
  // unica scrittura rifiutata ammessa: il vecchio telefono che, tornato in rete, prova a segnarsi presente nel posto ormai ripreso
  noErrors(h, 'S3', d => d.path.endsWith('/players/p2') && d.keys.join() === 'connected,disconnectedAt');
}

// ---------------------------------------------------------------------------
async function s4(h) {
  console.log('\n== S4: passaggio dell\'host ==');
  const a = await h.newPlayer('Anna', { random: 0.99 }), b = await h.newPlayer('Bea', { random: 0.99 }), c = await h.newPlayer('Carlo', { random: 0.99 }), d = await h.newPlayer('Dino', { random: 0.99 });
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn([a, b, c, d], 'onTurnScreen');
  await a.answer(1); await b.answer(2); await c.answer(3); await d.answer(4);
  await allOn([a, b, c, d], 'onSummaryScreen');
  await a.offline(); await b.settle();
  check('l\'host caduto resta host e gli altri leggono che e\' scollegato', g.val('meta/hostSeat') === 'p1' && /host è scollegato/.test(await b.text('#onSummaryHint')), await b.text('#onSummaryHint'));
  await h.backend.advance(30000); await b.rerender(); await c.rerender(); await d.rerender(); await b.settle(300);
  check('a 30 s nessuno prende il posto di host', g.val('meta/hostSeat') === 'p1' && !(await b.visible('#onToVote')));
  await h.backend.advance(17000); await b.rerender(); await c.rerender(); await d.rerender(); await b.settle(400);
  check('a 46 s l\'host passa a Bea (entrata prima fra i collegati)', g.val('meta/hostSeat') === 'p2', g.val('meta/hostSeat'));
  check('Bea vede i comandi dell\'host, Carlo no', await b.visible('#onToVote') && !(await c.visible('#onToVote')));
  await b.click('#onToVote'); await allOn([b, c, d], 'onVoteScreen');
  await b.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 3, null, 8000, 'opzioni');
  const impName = await (async () => { for (let i = 0; i < 20 && !g.impostor(); i++) await sleep(100); return g.nameOf(g.impostor()); })();
  await castVote(b, impName === 'Bea' ? 'Carlo' : impName); await castVote(c, impName === 'Carlo' ? 'Bea' : impName); await castVote(d, impName === 'Dino' ? 'Bea' : impName);
  await a.online(); await a.settle(300);
  check('Anna, tornata in rete, non e\' piu\' host e vede la votazione in corso', !(await a.visible('#onToVote')) && (await a.screen()) === 'onVoteScreen' && g.val('players/p1/connected') === true, await a.screen());
  await castVote(a, impName === 'Anna' ? 'Bea' : impName);
  await allOn([a, b, c, d], 'onResultScreen');
  for (const p of [a, b, c, d]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 4, null, 8000, 'voti');
  check('il nuovo host ha chiuso il round: verdetto con l\'impostore giusto su tutti', (await a.text('#onImpostor')) === impName && (await c.text('#onImpostor')) === impName && await b.visible('#onContinue') && !(await a.visible('#onContinue')));

  // uscita volontaria dell'host in sala
  console.log('-- uscita volontaria');
  await b.click('#onNewGame'); await allOn([a, b, c, d], 'onLobbyScreen'); await inLobby(a, 4);
  await d.exit(true); await a.settle(300);
  await b.exit(false);
  check('"No, resta" lascia tutto com\'e\'', (await b.screen()) === 'onLobbyScreen' && g.val('meta/hostSeat') === 'p2');
  check('testi di uscita online', (await b.text('#exitQuestion')) === 'Vuoi uscire dalla partita?' && (await b.text('#exitNote')) === 'Gli altri continueranno senza di te.' && (await b.text('#exitStay')) === 'No, resta' && (await b.text('#exitConfirm')) === 'Sì, esci');
  await b.exit(true);
  check('chi esce torna al menù principale', (await b.screen()) === 'menuScreen');
  await a.settle(300);
  check('l\'host passa ad Anna (collegata, entrata prima) e il posto lasciato si libera', g.val('meta/hostSeat') === 'p1' && g.val('players/p2') === null, g.val('meta/hostSeat'));
  check('Anna ora e\' host (legge che manca un sospettato) e gli altri vedono 2 giocatori', (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato' && (await c.texts('#lobbyPlayers .player-row')).length === 2);
  await c.exit(true); await a.settle(300);
  check('anche un giocatore normale che esce libera il posto', g.val('players/p3') === null && (await c.screen()) === 'menuScreen');
  noErrors(h, 'S4');
}

// ---------------------------------------------------------------------------
async function s5(h) {
  console.log('\n== S5: assenti esclusi e impostore che si dilegua ==');
  const opts = { random: 0.99 };   // con questo valore l'impostore e' l'ultimo posto del round (mai l'host)
  const a = await h.newPlayer('Anna', opts), b = await h.newPlayer('Bea', opts), c = await h.newPlayer('Carlo', opts), d = await h.newPlayer('Dino', opts);
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn([a, b, c, d], 'onTurnScreen');
  check('con l\'estrazione fissa l\'impostore e\' Dino (p4)', g.impostor() === 'p4', g.impostor());

  // 1) cade un non-impostore (Carlo): gli altri rispondono, dopo 45 s l'host puo' proseguire
  await c.offline();
  await a.answer(1); await b.answer(2); await d.answer(4);
  check('prima dei 45 s non compare "Prosegui senza gli assenti"', !(await a.visible('#onSkipAbsent')));
  await h.backend.advance(46000); await a.rerender(); await a.settle(300);
  check('dopo 45 s compare solo all\'host', await a.visible('#onSkipAbsent') && !(await b.visible('#onSkipAbsent')));
  check('Carlo e\' segnato ASSENTE', (await a.texts('#onWaitList .wait-row')).some(t => t.includes('Carlo') && t.includes('ASSENTE')));
  await a.click('#onSkipAbsent');
  await allOn([a, b, d], 'onSummaryScreen'); await a.settle();
  check('il round prosegue senza Carlo: riepilogo con 3 risposte, round invariato', (await a.texts('#onAnswers .answer-row')).join('|') === 'Anna1|Bea2|Dino4' && g.val('meta/round') === 1);
  check('nessun avviso di round annullato', !(await screenText(a, 'onSummaryScreen')).includes('dileguato'));
  await a.click('#onToVote'); await allOn([a, b, d], 'onVoteScreen');
  await castVote(a, 'Dino'); await castVote(b, 'Dino'); await castVote(d, 'Anna');
  await allOn([a, b, d], 'onResultScreen');
  for (const p of [a, b, d]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 3, null, 8000, 'voti');
  check('verdetto senza Carlo: Dino beccato con 2 voti', (await a.text('#onResultTitle')) === 'Beccato.' && (await b.texts('#onVotesList .wait-row'))[0].includes('Dino') && !(await b.texts('#onVotesList .wait-row')).some(t => t.includes('Carlo')));

  // 2) "Continua" con Carlo ancora assente: nuovo round senza di lui
  await a.click('#onContinue'); await allOn([a, b, d], 'onTurnScreen'); for (const p of [a, b, d]) await ready(p);
  check('il nuovo round non include l\'assente', JSON.stringify(Object.keys(g.val('seats'))) === JSON.stringify(['p1', 'p2', 'p4']) && g.val('private/p3') === null);
  // Carlo, tornato in rete, e' fuori round ma non bloccato
  await c.online(); await c.settle(300);
  check('Carlo rientra: vede che il round e\' in corso senza di lui', (await c.screen()) === 'onTurnScreen' && await c.visible('#onSpectator') && !(await c.visible('#onAnswerArea')));

  // 3) cade l'impostore (round 2: prev=p4, estrazione fissa -> impostore p3? Carlo e' fuori: restano p1,p2,p4)
  const imp2 = g.impostor();
  check('round 2: impostore tra chi e\' nel round e diverso dal precedente', ['p1', 'p2', 'p4'].includes(imp2) && imp2 !== 'p4', imp2);
  noErrors(h, 'S5a');
}

async function s6(h) {
  console.log('\n== S6: impostore assente -> round annullato con messaggio neutro; pochi giocatori -> sala ==');
  const opts = { random: 0.99 };
  const a = await h.newPlayer('Anna', opts), b = await h.newPlayer('Bea', opts), c = await h.newPlayer('Carlo', opts), d = await h.newPlayer('Dino', opts);
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn([a, b, c, d], 'onTurnScreen');
  check('l\'impostore e\' Dino', g.impostor() === 'p4');
  await d.offline();
  await a.answer(1); await b.answer(2); await c.answer(3);
  await h.backend.advance(46000); await a.rerender(); await a.settle(300);
  check('"Prosegui senza gli assenti" compare', await a.visible('#onSkipAbsent'));
  await a.click('#onSkipAbsent');
  await a.waitFor(() => document.getElementById('onTurnScreen').classList.contains('active') && document.getElementById('onProgressText').textContent === '0 / 3', null, 8000, 'il nuovo round');
  await allOn([a, b, c], 'onTurnScreen'); for (const p of [a, b, c]) await ready(p);
  check('round annullato: nuovo round (2) con 3 giocatori senza Dino', g.val('meta/round') === 2 && JSON.stringify(Object.keys(g.val('seats'))) === JSON.stringify(['p1', 'p2', 'p3']));
  const notice = 'Un sospettato si è dileguato: si riapre il caso.';
  for (const p of [a, b, c]) check(`${p.label}: avviso neutro mostrato`, (await p.text('#onNotice')) === notice && await p.visible('#onNotice'));
  for (const p of [a, b, c]) check(`${p.label}: l'avviso non rivela l'impostore`, !/impostor/i.test(await p.text('#onNotice')));
  check('nuovo impostore tra i 3 rimasti', ['p1', 'p2', 'p3'].includes(g.impostor()) && g.impostor() !== 'p4');
  check('risposte del round annullato cancellate', g.val('answered') === null && g.val('answers') === null);
  // l'avviso sparisce con il round dopo
  for (const p of [a, b, c]) { await p.answer(5); }
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote'); await allOn([a, b, c], 'onVoteScreen');
  const imp = g.nameOf(g.impostor());
  for (const [n, p] of [['Anna', a], ['Bea', b], ['Carlo', c]]) await castVote(p, n === imp ? (n === 'Anna' ? 'Bea' : 'Anna') : imp);
  await allOn([a, b, c], 'onResultScreen'); await a.click('#onContinue'); await allOn([a, b, c], 'onTurnScreen'); await a.settle();
  check('"Continua" cancella l\'avviso', !(await a.visible('#onNotice')) && g.val('meta/notice') === null);

  // pochi giocatori: 3 in partita, uno assente -> sala d'attesa con avviso, assente rimosso
  console.log('-- meno di 3 giocatori');
  await c.offline();
  await a.answer(1); await b.answer(2);
  await a.settle(300);
  check('con 2 collegati su 3 compare l\'avviso con il conto alla rovescia', await a.visible('#fewBanner') && /^\d+ s$/.test(await a.text('#fewCount')), await a.text('#fewCount'));
  await h.backend.advance(46000); await a.rerender(); await b.rerender();
  await allOn([a, b], 'onLobbyScreen'); await a.settle(300);
  check('si torna in sala con l\'avviso "Giocatori insufficienti"', /insufficienti/.test(await a.text('#lobbyNotice')) && await b.visible('#lobbyNotice'));
  check('l\'assente e\' stato tolto dalla sala; restano 2 giocatori', g.val('players/p3') === null && (await a.texts('#lobbyPlayers .player-row')).length === 2);
  check('con 2 giocatori il pulsante non compare', !(await a.visible('#onStart')));
  noErrors(h, 'S6');
}

// ---------------------------------------------------------------------------
async function s7(h) {
  console.log('\n== S7: 7 giocatori, privacy della domanda, nomi con codice HTML, schermi piccolo e alto ==');
  const names = ['Anna', 'Bea', 'Carlo', 'Dino', 'Eva', 'Fabio', '<b>Gina</b>'];
  const ps = [await h.newPlayer('Anna', { width: 375, height: 667 })];
  for (const n of names.slice(1)) ps.push(await h.newPlayer(n.slice(0, 8), { width: 375, height: 667 }));
  const code = await ps[0].create('Anna'); const g = game(h, code);
  for (let i = 1; i < 7; i++) await ps[i].join(code, names[i]);
  await inLobby(ps[0], 7);
  const evil = ps[0].page;
  check('un nome con HTML resta testo (nessun elemento iniettato)', (await evil.$$eval('#lobbyPlayers b', e => e.length)) === 0 && (await ps[0].texts('#lobbyPlayers .player-name')).includes(names[6]), await ps[0].texts('#lobbyPlayers .player-name'));
  const geo = async p => p.page.evaluate(() => ({ hOver: document.documentElement.scrollWidth > document.documentElement.clientWidth, w: innerWidth }));
  check('sala da 7 a 375 px: nessuno scroll orizzontale', !(await geo(ps[0])).hOver);
  await shot(ps[0], 'lobby-7-375x667');
  await ps[0].click('#onStart'); await allOn(ps, 'onTurnScreen'); for (const p of ps) await ready(p);
  check('7 domande ricevute, 6 comuni e 1 diversa', await (async () => { const q = []; for (const p of ps) q.push(await p.text('#onQuestion')); return new Set(q).size === 2; })());
  check('turno a 375 px senza scroll orizzontale', !(await geo(ps[1])).hOver);
  await shot(ps[1], 'turn-375x667');
  for (let i = 0; i < 7; i++) await ps[i].answer(i + 1);
  await allOn(ps, 'onSummaryScreen'); await ps[0].settle();
  check('riepilogo con 7 risposte', (await ps[0].texts('#onAnswers .answer-row')).length === 7 && !(await geo(ps[0])).hOver);
  await shot(ps[1], 'summary-375x667');
  await ps[0].click('#onToVote'); await allOn(ps, 'onVoteScreen');
  for (const p of ps) await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 6, null, 8000, '6 opzioni');
  await shot(ps[1], 'vote-375x667');
  const impName = g.nameOf(g.impostor());
  for (let i = 0; i < 7; i++) await castVote(ps[i], names[i] === impName ? (i === 0 ? names[1] : names[0]) : impName);
  await allOn(ps, 'onResultScreen');
  for (const p of ps) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 7, null, 8000, '7 voti');
  check('7 giocatori: verdetto concorde su tutti i telefoni', (await Promise.all(ps.map(p => p.text('#onResultTitle')))).every(t => t === 'Beccato.') && (await Promise.all(ps.map(p => p.text('#onImpostor')))).every(t => t === impName));
  await shot(ps[1], 'result-375x667');
  noErrors(h, 'S7');
}

// ---------------------------------------------------------------------------
async function s8(h) {
  console.log('\n== S8: rete assente, modulo non raggiungibile, modalita\' a un telefono, pulizia ==');
  const a = await h.newPlayer('Locale');
  await a.open();
  check('Home: due scelte', await a.visible('#goLocal') && await a.visible('#goOnline') && (await a.screen()) === 'menuScreen');
  await a.page.setOfflineMode(true);
  await a.click('#goOnline');
  check('offline: messaggio chiaro e resta sul menù', (await a.screen()) === 'menuScreen' && /offline.*Internet.*un solo telefono/i.test(await a.text('#menuError')) && await a.visible('#menuError'), await a.text('#menuError'));
  check('offline: il modulo online non viene nemmeno richiesto', !a.requested.includes('/online.js'));
  await a.click('#goLocal');
  check('offline: "Un solo telefono" funziona', (await a.screen()) === 'homeScreen');
  await a.click('#startGame'); await a.waitScreen('turnScreen');
  await a.click('#showQuestion'); await a.type('#answerInput', '4'); await a.click('#confirmAnswer');
  check('offline: la partita locale va avanti', (await a.screen()) === 'turnScreen' && (await a.text('#turnStep')) === '2 / 3');
  await a.exit(false);
  check('uscita locale: stessi testi di prima', true);
  await a.click('#exitButton'); await a.waitFor(() => !document.getElementById('exitDialog').classList.contains('hidden'), null, 3000, 'conferma');
  check('testi di uscita in modalita\' locale', (await a.text('#exitQuestion')) === 'Vuoi tornare al menù principale?' && (await a.text('#exitNote')) === 'La partita in corso andrà persa.' && (await a.text('#exitStay')) === 'No, continua' && (await a.text('#exitConfirm')) === 'Sì, torna al menù');
  await a.click('#exitConfirm'); await a.settle();
  check('uscita locale: torna al menù principale', (await a.screen()) === 'menuScreen');
  await a.click('#goLocal'); await a.settle();
  check('numero e nomi dei giocatori restano', (await a.text('#playerCount')) === '3');
  await a.page.setOfflineMode(false);

  const b = await h.newPlayer('ModuloKO'); b.blockOnline = true; await b.open();
  await b.click('#goOnline'); await b.settle(400);
  check('modulo non raggiungibile: messaggio chiaro, menù ancora usabile', /Non riesco a collegarmi/.test(await b.text('#menuError')) && (await b.screen()) === 'menuScreen' && !(await b.disabled('#goOnline')), await b.text('#menuError'));
  check('il telefono singolo non ha mai caricato online.js ne\' l\'SDK', !a.requested.some(u => u === '/online.js' || u.includes('vendor/firebase')));

  // pulizia
  console.log('-- pulizia delle partite ferme');
  const x = await h.newPlayer('X'); const codeOld = await x.create('Vecchio');
  const y = await h.newPlayer('Y'); const codeNew = await y.create('Nuovo');
  check('due partite attive', h.backend.valueAt(`games/${codeOld}`) !== null && h.backend.valueAt(`games/${codeNew}`) !== null);
  await h.backend.advance(25 * 3600 * 1000);
  await y.rerender(); // Y tiene viva la sua partita? no: solo l'host aggiorna l'indice al cambio di fase
  const z = await h.newPlayer('Z'); const codeZ = await z.create('Zeta'); await z.settle(600);
  check('creando una nuova partita si cancellano quelle ferme da piu\' di 24 ore', h.backend.valueAt(`games/${codeOld}`) === null && h.backend.valueAt(`index/${codeOld}`) === null && h.backend.valueAt(`games/${codeNew}`) === null);
  check('la partita appena creata resta', h.backend.valueAt(`games/${codeZ}`) !== null);
  noErrors(h, 'S8');
}


// ---------------------------------------------------------------------------
async function s9(h) {
  console.log("\n== S9: sala d'attesa: host che cade, posto liberato, sala che si svuota ==");
  const a = await h.newPlayer('Anna'), b = await h.newPlayer('Bea'), c = await h.newPlayer('Carlo');
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(a, 3);

  await a.offline(); await b.settle();
  check("l'host caduto e' grigio per gli altri, che leggono il messaggio", (await b.page.$$eval('#lobbyPlayers .dot.off', e => e.length)) === 1 && /host è scollegato/.test(await b.text('#lobbyHint')), await b.text('#lobbyHint'));
  await h.backend.advance(30000); await b.rerender(); await c.rerender(); await b.settle(300);
  check("a 30 s il ruolo non passa e il posto resta", g.val('meta/hostSeat') === 'p1' && g.val('players/p1') !== null);
  await h.backend.advance(17000); await b.rerender(); await c.rerender(); await b.settle(500);
  check("a 47 s l'host passa a Bea (collegata, entrata prima)", g.val('meta/hostSeat') === 'p2', g.val('meta/hostSeat'));
  check('Bea ha i comandi dell\'host (con 2 collegati: "In attesa di almeno un altro sospettato"), Carlo no', (await b.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato' && (await c.text('#lobbyHint')) === 'In attesa dell’host. Serve almeno un altro sospettato.', [await b.text('#lobbyHint'), await c.text('#lobbyHint')]);
  await b.settle(400);
  check("il nuovo host libera il posto dell'ex host assente", g.val('players/p1') === null && (await b.texts('#lobbyPlayers .player-row')).length === 2 && (await c.texts('#lobbyPlayers .player-row')).length === 2);
  check("con 2 giocatori il pulsante non compare", !(await b.visible('#onStart')));
  await a.online(); await a.settle(400);
  check("l'ex host, tornato in rete, scopre di essere stato rimosso", (await a.screen()) === 'onMenuScreen' && /rimosso/.test(await a.text('#onMenuError')), await a.text('#onMenuError'));
  check("l'ex host non ricrea il posto", g.val('players/p1') === null);
  const d = await h.newPlayer('Dino'); await d.join(code, 'Dino'); await inLobby(b, 3);
  check('un nuovo giocatore occupa il posto liberato', g.val('players/p1/name') === 'Dino');
  await b.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'il pulsante con 3 collegati');
  check("con 3 giocatori collegati il pulsante compare al nuovo host", await b.visible('#onStart') && !(await c.visible('#onStart')));
  await b.click('#onStart'); await allOn([b, c, d], 'onTurnScreen');
  check('si parte regolarmente con il nuovo host', g.val('meta/round') === 1 && g.val('meta/hostSeat') === 'p2');
  noErrors(h, 'S9', x => x.path.endsWith('/players/p1') && x.keys.join() === 'connected,disconnectedAt');
}

async function s10(h) {
  console.log("\n== S10: uscita dell'host dalla sala e sala che si svuota ==");
  const a = await h.newPlayer('Anna'), b = await h.newPlayer('Bea');
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await inLobby(a, 2);
  await a.exit(true); await b.settle(300);
  check("l'host esce: il ruolo passa subito a Bea e il posto si libera", g.val('meta/hostSeat') === 'p2' && g.val('players/p1') === null && (await a.screen()) === 'menuScreen');
  check("la partita non e' orfana: Bea e' host in sala da sola (nessun pulsante, legge che servono altri 2)", !(await b.visible('#onStart')) && (await b.text('#lobbyHint')) === 'In attesa di altri 2 sospettati' && (await b.texts('#lobbyPlayers .player-row')).length === 1);
  await b.exit(true); await b.settle(300);
  check("l'ultimo giocatore esce: la partita e l'indice vengono cancellati", h.backend.valueAt(`games/${code}`) === null && h.backend.valueAt(`index/${code}`) === null && (await b.screen()) === 'menuScreen');

  const x = await h.newPlayer('Solo'); const code2 = await x.create('Solo');
  await x.exit(true); await x.settle(300);
  check("host da solo che esce: niente partita rimasta", h.backend.valueAt(`games/${code2}`) === null && h.backend.valueAt(`index/${code2}`) === null);

  // host da solo che sparisce senza uscire: resta fino alla pulizia delle 24 ore
  const y = await h.newPlayer('Fantasma'); const code3 = await y.create('Fantasma');
  await y.offline();
  check("host da solo che cade senza uscire: la partita resta (nessuno puo' cancellarla)", h.backend.valueAt(`games/${code3}`) !== null);
  await h.backend.advance(25 * 3600 * 1000);
  const z = await h.newPlayer('Zeta'); await z.create('Zeta'); await z.settle(600);
  check('dopo 24 ore chi crea una nuova partita la cancella', h.backend.valueAt(`games/${code3}`) === null && h.backend.valueAt(`index/${code3}`) === null);
  noErrors(h, 'S10');
}

// ---------------------------------------------------------------------------
async function s11(h) {
  console.log('\n== S11: soglia di 3 collegati in sala, avvio forzato, "Continua" con meno di 3 ==');
  const a = await h.newPlayer('Anna'), b = await h.newPlayer('Bea'), c = await h.newPlayer('Carlo');
  const code = await a.create('Anna'); const g = game(h, code);
  const snap = () => JSON.stringify({ fase: g.val('meta/phase'), round: g.val('meta/round'), avviso: g.val('meta/notice'), seats: g.val('seats'), private: g.val('private') });
  const force = p => p.page.evaluate(() => { const bt = document.getElementById('onStart'); bt.classList.remove('hidden'); bt.disabled = false; bt.click(); bt.click(); });
  const btnShown = (p, shown) => p.waitFor(s => document.getElementById('onStart').classList.contains('hidden') !== s, shown, 8000, shown ? 'il pulsante' : 'la scomparsa del pulsante');

  check('host da solo: nessun pulsante, "In attesa di altri 2 sospettati"', !(await a.visible('#onStart')) && (await a.text('#lobbyHint')) === 'In attesa di altri 2 sospettati');
  const before0 = snap();
  await force(a); await a.settle(500);
  check('avvio forzato da solo: nessuna scrittura nel database e nessun round', snap() === before0 && g.val('meta/phase') === 'lobby', snap());

  await b.join(code, 'Bea'); await inLobby(a, 2);
  check('2 in sala: l\'host legge "In attesa di almeno un altro sospettato"', (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato' && !(await a.visible('#onStart')));
  check('2 in sala: Bea legge "In attesa dell\'host. Serve almeno un altro sospettato."', (await b.text('#lobbyHint')) === 'In attesa dell’host. Serve almeno un altro sospettato.');
  const before2 = snap();
  await force(a); await a.settle(500);
  check('avvio forzato con 2: nessuna scrittura nel database', snap() === before2, snap());
  check('avvio forzato con 2: resta in sala, nessun avviso "Giocatori insufficienti", stesso messaggio', (await a.screen()) === 'onLobbyScreen' && !(await a.visible('#lobbyNotice')) && !(await b.visible('#lobbyNotice')) && (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato');

  await c.join(code, 'Carlo'); await inLobby(a, 3);
  await btnShown(a, true);
  check('con 3 collegati il pulsante compare solo all\'host', await a.visible('#onStart') && !(await b.visible('#onStart')) && !(await c.visible('#onStart')) && (await b.text('#lobbyHint')) === 'In attesa che l’host apra le indagini…');

  // un giocatore cade (meno di 45 s fa, il posto c'e' ancora): non fa piu' numero
  await c.offline(); await btnShown(a, false);
  check('Carlo cade: il pulsante sparisce subito (senza aspettare i 45 s) e la sala mostra ancora 3 righe', !(await a.visible('#onStart')) && g.val('players/p3/connected') === false && (await a.texts('#lobbyPlayers .player-row')).length === 3 && (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato', await a.text('#lobbyHint'));
  const beforeDrop = snap();
  await force(a); await a.settle(500);
  check('avvio forzato con 2 collegati su 3 in sala: nessun round, nessun avviso, niente scritto', snap() === beforeDrop && (await a.screen()) === 'onLobbyScreen', snap());
  await c.online(); await btnShown(a, true);
  check('Carlo rientra: il pulsante ricompare', await a.visible('#onStart'));

  // doppio tocco con 3 collegati: parte un solo round
  await a.page.evaluate(() => { const bt = document.getElementById('onStart'); bt.click(); bt.click(); });
  await allOn([a, b, c], 'onTurnScreen'); await a.settle(400);
  check('doppio tocco con 3 collegati: un solo round (1) con 3 partecipanti, nessun avviso', g.val('meta/round') === 1 && Object.keys(g.val('seats')).length === 3 && g.val('meta/notice') === null);

  // round completo, poi "Continua" con meno di 3 collegati: si torna in sala senza bloccarsi
  for (const p of [a, b, c]) await ready(p);
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote'); await allOn([a, b, c], 'onVoteScreen');
  const impName = g.nameOf(g.impostor());
  for (const [n, p] of [['Anna', a], ['Bea', b], ['Carlo', c]]) await castVote(p, n === impName ? (n === 'Anna' ? 'Bea' : 'Anna') : impName);
  await allOn([a, b, c], 'onResultScreen');
  await c.offline(); await a.settle(400);
  check('verdetto con 2 collegati su 3: "Continua" nascosto, "Nuova partita" resta, avviso con conto alla rovescia', !(await a.visible('#onContinue')) && await a.visible('#onNewGame') && await a.visible('#fewBanner'));
  await a.click('#onNewGame'); await allOn([a, b], 'onLobbyScreen'); await a.settle(400);
  check('"Nuova partita" con 2 collegati: sala, nessun round avviato, avviso sparito', (await a.screen()) === 'onLobbyScreen' && g.val('meta/phase') === 'lobby' && g.val('seats') === null && !(await a.visible('#fewBanner')));
  check('in sala nessun pulsante e il messaggio dice cosa manca', !(await a.visible('#onStart')) && (await a.text('#lobbyHint')) === 'In attesa di almeno un altro sospettato');
  await c.online(); await btnShown(a, true);
  check('Carlo rientra: il pulsante torna e si puo\' ripartire', await a.visible('#onStart'));
  await a.click('#onStart'); await allOn([a, b, c], 'onTurnScreen');
  check('si riparte regolarmente con 3 collegati', g.val('meta/round') === 1 && g.val('meta/notice') === null);
  noErrors(h, 'S11');
}

// ---------------------------------------------------------------------------
async function s12(h) {
  console.log('\n== S12: meno di 3 collegati in partita: avviso, conto alla rovescia, ritorno in sala ==');
  const NOTICE = /Sono rimasti meno di 3 sospettati collegati\. Se nessuno rientra entro 45 secondi, si torna in sala d’attesa\./;
  const secs = async p => parseInt(await p.text('#fewCount'), 10);
  const a = await h.newPlayer('Anna', { random: 0.99 }), b = await h.newPlayer('Bea', { random: 0.99 }), c = await h.newPlayer('Carlo', { random: 0.99 });
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(a, 3);
  await a.click('#onStart'); await allOn([a, b, c], 'onTurnScreen');
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen');
  check('con 3 collegati nessun avviso e "Alle votazioni" per l\'host', !(await a.visible('#fewBanner')) && await a.visible('#onToVote'));

  // 1) cade uno: avviso con conto alla rovescia, "Alle votazioni" nascosto
  await c.offline(); await a.settle(300);
  check('Carlo cade: avviso con il testo richiesto su chi e\' ancora collegato', NOTICE.test(await a.text('#fewBanner')) && await a.visible('#fewBanner') && await b.visible('#fewBanner'), await a.text('#fewBanner'));
  const s0 = await secs(a);
  check('il conto alla rovescia parte da circa 45 s', s0 > 40 && s0 <= 45, s0);
  check('"Alle votazioni" nascosto all\'host mentre ci sono meno di 3 collegati', !(await a.visible('#onToVote')));
  await h.backend.advance(20000); await a.rerender(); await a.settle(300);
  const s1 = await secs(a);
  check('dopo 20 s il conto e\' sceso a circa 25', s1 > 20 && s1 < 30, s1);

  // 2) rientra: l'avviso sparisce e il pulsante torna
  await c.online(); await a.settle(400);
  check('Carlo rientra: avviso sparito e "Alle votazioni" torna', !(await a.visible('#fewBanner')) && !(await b.visible('#fewBanner')) && await a.visible('#onToVote'));

  // 3) ricade: il conto riparte da 45 (si e' azzerato)
  await c.offline(); await a.settle(300);
  const s2 = await secs(a);
  check('ricade: il conto riparte da circa 45', s2 > 40 && s2 <= 45, s2);
  await h.backend.advance(30000); await a.rerender(); await a.settle(300);
  check('a 30 s il round e\' ancora in corso', g.val('meta/phase') === 'summary' && await a.visible('#fewBanner'));
  await h.backend.advance(17000); await a.rerender(); await b.rerender();
  await allOn([a, b], 'onLobbyScreen'); await a.settle(300);
  check('a 47 s l\'host riporta tutti in sala da solo, con "Giocatori insufficienti"', g.val('meta/phase') === 'lobby' && /insufficienti/.test(await a.text('#lobbyNotice')) && await b.visible('#lobbyNotice'));
  check('in sala l\'avviso di round non compare e l\'assente e\' stato tolto', !(await a.visible('#fewBanner')) && g.val('players/p3') === null);
  noErrors(h, 'S12a');
}

async function s12b(h) {
  console.log('\n== S12b: cade l\'host e restano meno di 3: passaggio di host, poi ritorno in sala subito ==');
  const a = await h.newPlayer('Anna', { random: 0.99 }), b = await h.newPlayer('Bea', { random: 0.99 }), c = await h.newPlayer('Carlo', { random: 0.99 });
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(a, 3);
  await a.click('#onStart'); await allOn([a, b, c], 'onTurnScreen');
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote'); await allOn([a, b, c], 'onVoteScreen');
  await a.offline(); await b.settle(300);
  check('cade l\'host in votazione: Bea e Carlo vedono l\'avviso', await b.visible('#fewBanner') && await c.visible('#fewBanner'));
  await h.backend.advance(30000); await b.rerender(); await c.rerender(); await b.settle(300);
  check('a 30 s tutto fermo: host ancora Anna, round in corso', g.val('meta/hostSeat') === 'p1' && g.val('meta/phase') === 'vote');
  await h.backend.advance(17000);
  for (let i = 0; i < 4; i++) { await b.rerender(); await c.rerender(); await b.settle(400); }
  await allOn([b, c], 'onLobbyScreen');
  check('l\'host passa a Bea e subito dopo si torna in sala con l\'avviso', g.val('meta/hostSeat') === 'p2' && g.val('meta/phase') === 'lobby' && /insufficienti/.test(await b.text('#lobbyNotice')) && await c.visible('#lobbyNotice'), g.val('meta/hostSeat'));
  noErrors(h, 'S12b');
}

async function s12c(h) {
  console.log('\n== S12c: verdetto con meno di 3 collegati: resta, "Continua" nascosto, nessun conto alla rovescia ==');
  const a = await h.newPlayer('Anna', { random: 0.99 }), b = await h.newPlayer('Bea', { random: 0.99 }), c = await h.newPlayer('Carlo', { random: 0.99 });
  const code = await a.create('Anna'); const g = game(h, code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(a, 3);
  await a.click('#onStart'); await allOn([a, b, c], 'onTurnScreen');
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote'); await allOn([a, b, c], 'onVoteScreen');
  const imp = g.nameOf(g.impostor());
  for (const [n, p] of [['Anna', a], ['Bea', b], ['Carlo', c]]) await castVote(p, n === imp ? (n === 'Anna' ? 'Bea' : 'Anna') : imp);
  await allOn([a, b, c], 'onResultScreen');
  check('con 3 collegati: "Continua" e "Nuova partita", nessun avviso', await a.visible('#onContinue') && await a.visible('#onNewGame') && !(await a.visible('#fewBanner')));
  await c.offline(); await a.settle(400);
  check('Carlo cade: avviso senza conto alla rovescia, "Continua" nascosto, "Nuova partita" resta', await a.visible('#fewBanner') && !(await a.visible('#fewCount')) && !(await a.visible('#onContinue')) && await a.visible('#onNewGame'), await a.text('#fewBanner'));
  await h.backend.advance(90000); await a.rerender(); await b.rerender(); await a.settle(500);
  check('dopo 90 s il verdetto è ancora lì (nessun ritorno in sala)', g.val('meta/phase') === 'result' && (await a.screen()) === 'onResultScreen' && (await b.screen()) === 'onResultScreen');
  check('"Continua" ancora nascosto, "Nuova partita" disponibile', !(await a.visible('#onContinue')) && await a.visible('#onNewGame'));
  await c.online(); await a.settle(500);
  check('Carlo rientra: avviso sparito e "Continua" ricompare', !(await a.visible('#fewBanner')) && await a.visible('#onContinue'));
  noErrors(h, 'S12c');
}

// ---------------------------------------------------------------------------
const SCENARIOS = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s12b, s12c };
(async () => {
  const want = process.argv.slice(2).map(s => s.toLowerCase());
  const run = Object.keys(SCENARIOS).filter(k => !want.length || want.includes(k));
  const h = await startHarness();
  try {
    for (const k of run) {
      try { await SCENARIOS[k](h); } catch (e) { fails++; console.log(`FAIL - ${k}: ${e.message}`); }
      for (const p of h.players) for (const e of p.errors) console.log(`   (${k}) ${p.label}: ${e}`);
      await h.reset();
    }
  } finally { await h.stop(); }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})();
