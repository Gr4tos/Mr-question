// Prove sul database Firebase VERO (progetto mr-question-c67d1) con il vero online.js e l'SDK vero.
// Ogni "telefono" e' un contesto di Chrome separato con la sua identita' anonima.
// ATTENZIONE: scrive sul database reale. Ogni partita viene riportata in sala e cancellata (l'ultimo
// giocatore che esce la cancella); alla fine si controlla che nessuna partita di prova sia rimasta.
// Uso: node live-online.js [l1 l2 l3 l45 ...]
const { startHarness } = require('./fake/harness');
const L = require('./fake/live');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEATS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const created = new Set();          // codici di tutte le partite create
const CREATED_FILE = require('path').join(__dirname, 'live-created.txt');
function track(tag, code) {
  created.add(code);
  console.log(`   [partita creata] ${tag} ${code}`);
  try { require('fs').appendFileSync(CREATED_FILE, `${new Date().toISOString()} ${tag} ${code}\n`); } catch { /* ignora */ }
}
const orphans = [];                 // utenti anonimi che non si possono cancellare (pagina chiusa per simulare la caduta)
let passes = 0, fails = 0;
const failed = [];

function tagger(tag) {
  const check = (label, cond, extra) => {
    if (cond) passes++; else { fails++; failed.push(`${tag}: ${label}`); }
    console.log(`${cond ? 'OK  ' : 'FAIL'} [${tag}] ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`);
  };
  return check;
}

let H = null;
const phone = async label => { const p = await H.newPlayer(label, { fake: false }); p.alive = true; return p; };
const allOn = async (ps, id) => { for (const p of ps) await p.waitScreen(id); };
const inLobby = (p, n) => p.waitFor(k => document.querySelectorAll('#lobbyPlayers .player-row').length === k, n, undefined, `${n} giocatori in sala`);
const ready = p => p.waitFor(() => { const e = document.getElementById('onHandle'); return !!e && !e.disabled && e.getClientRects().length > 0; }, null, 8000, 'la scheda chiusa, pronta da aprire');
const gread = (p, code, path) => L.read(p, `games/${code}/${path}`);
async function seatsByName(p, code) {
  const r = await gread(p, code, 'players');
  const m = {}; for (const [s, v] of Object.entries(r.value || {})) m[v.name] = s; return m;
}

// ---- attacchi: ogni rifiuto e' affiancato dalla stessa operazione fatta dall'attore giusto ----
async function mustDeny(T, label, p, code, arg) {
  const before = p.logs.length;
  const r = await L.run(p, code, arg);
  await sleep(250); p.logs.splice(before);   // l'avviso del browser per un rifiuto voluto non e' un problema
  T(`${label}: rifiutato`, L.isDenied(r), r.ok ? 'CONSENTITO (dovrebbe essere rifiutato)' : `${r.code} ${r.message}`);
}
async function mustAllow(T, label, p, code, arg) {
  const before = p.logs.length;
  const r = await L.run(p, code, arg);
  await sleep(150); p.logs.splice(before);
  T(`${label}: consentito`, r.ok, r.ok ? r.value : `${r.code} ${r.message}`);
  return r;
}
const GET = "return (await D.get(D.ref(db, arg))).val();";
const SETPATCH = "await D.update(D.ref(db, arg.path), arg.patch); return true;";

// attese che i dati arrivino dal database (mai leggere il segnaposto "…")
const resultReady = ps => Promise.all(ps.map(p => p.waitFor(() => document.getElementById('onResultTitle').textContent !== '…' && document.querySelectorAll('#onVotesList .wait-row').length > 0, null, undefined, 'i dati del verdetto')));
const summaryReady = (ps, n) => Promise.all(ps.map(p => p.waitFor(k => document.querySelectorAll('#onAnswers .answer-row').length === k && !document.getElementById('onAnswers').textContent.includes('…'), n, undefined, 'le risposte nel riepilogo')));

async function castVote(p, targetName) {
  await p.waitScreen('onVoteScreen');
  await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length > 0, null, undefined, 'le opzioni di voto');
  await p.page.evaluate(n => { [...document.querySelectorAll('#onVoteOptions .vote-option')].find(b => b.textContent.includes(n)).click(); }, targetName);
  await p.click('#onSign');
  await p.waitFor(() => !document.getElementById('onVoteWait').classList.contains('hidden') || !document.getElementById('onVoteScreen').classList.contains('active'), null, undefined, 'la conferma del voto');
}
// chi e' l'impostore, dedotto dalle domande mostrate sui telefoni
async function impostorByQuestions(ps) {
  const qs = {}; for (const p of ps) qs[p.name] = await p.readQuestion();
  const counts = {}; Object.values(qs).forEach(q => { counts[q] = (counts[q] || 0) + 1; });
  const common = Object.keys(counts).find(q => counts[q] > 1);
  return { common, impostor: Object.keys(qs).find(n => qs[n] !== common), qs };
}

// ---- chiusura: partita in sala, escono tutti (host per ultimo), la partita sparisce ----
async function dispose(T, ps, code) {
  const present = ps.filter(p => p.alive);
  for (let i = 0; i < 4; i++) {
    const scr = await present[0].screen();
    if (scr === 'onLobbyScreen') break;
    if (scr === 'onResultScreen') { for (const p of present) if (await p.visible('#onNewGame')) { await p.click('#onNewGame'); break; } }
    await sleep(1500);
  }
  await allOn(present, 'onLobbyScreen');
  // i posti degli assenti si liberano da soli: aspetto che restino solo i presenti
  await present[0].waitFor(n => document.querySelectorAll('#lobbyPlayers .player-row').length === n, present.length, 90000, 'la sala con i soli presenti');
  const host = (await Promise.all(present.map(async p => [p, await p.visible('#onStart')]))).find(x => x[1])[0];
  for (const p of present.filter(x => x !== host)) { await p.exit(true); await sleep(600); }
  await host.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 1, null, undefined, 'la sala con il solo host');
  await host.exit(true); await sleep(2000);
  const meta = await L.read(host, `games/${code}/meta`);
  T(`partita ${code} cancellata dopo l'uscita dell'ultimo giocatore`, meta.ok && meta.value === null, meta);
}
async function cleanupUsers(ps) {
  let n = 0;
  for (const p of ps) { if (p.alive) { const r = await L.deleteAnon(p); if (r.ok && r.value) n++; } else orphans.push(p.label); }
  return n;
}

// ===========================================================================
async function l1() {
  const T = tagger('L1');
  console.log('\n== L1: partita da 3 sul database vero, con attacchi alle regole in ogni fase ==');
  const a = await phone('Anna'), b = await phone('Bea'), c = await phone('Carlo'), x = await phone('Estraneo');
  [a, b, c, x].forEach((p, i) => { p.name = ['Anna', 'Bea', 'Carlo', 'Estraneo'][i]; });
  const code = await a.create('Anna'); track('L1', code);
  T('codice valido', /^[A-HJ-NP-Z]{5}$/.test(code), code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(a, 3); await inLobby(c, 3);
  await x.goOnline();
  const seat = await seatsByName(a, code);
  T('posti assegnati in ordine di ingresso', seat.Anna === 'p1' && seat.Bea === 'p2' && seat.Carlo === 'p3', seat);
  T('sala: HOST e TU, "Apri le indagini" attivo solo all\'host', (await a.texts('#lobbyPlayers .player-row'))[0].includes('HOST') && await a.visible('#onStart') && !(await a.disabled('#onStart')) && !(await b.visible('#onStart')));
  T('i messaggi di sala per chi non e\' host', /host/i.test(await b.text('#lobbyHint')));

  // --- attacchi in sala ---
  await mustAllow(T, 'sala: un giocatore legge i giocatori', b, GET, `games/${code}/players`);
  const base = `games/${code}`;
  await mustDeny(T, 'sala: B cambia la fase', b, SETPATCH, { path: `${base}/meta`, patch: { phase: 'answering' } });
  await mustDeny(T, 'sala: B si assegna il ruolo di host con l\'host collegato', b, SETPATCH, { path: `${base}/meta`, patch: { hostSeat: 'p2' } });
  await mustDeny(T, 'sala: B cancella il posto dell\'host', b, SETPATCH, { path: base, patch: { 'players/p1': null } });
  await mustDeny(T, 'sala: B cambia il proprio nome', b, SETPATCH, { path: `${base}/players/p2`, patch: { name: 'Bea2' } });
  await mustDeny(T, 'sala: l\'estraneo prende un posto gia\' occupato', x, "await D.set(D.ref(db, arg.path), arg.v); return true;", { path: `${base}/players/p2`, v: { owner: 'x', name: 'Zed', connected: true, joinedAt: 1 } });
  await mustDeny(T, 'sala: l\'estraneo entra con un nome gia\' usato (maiuscole diverse)', x, "await D.set(D.ref(db, arg.path), { owner: auth.currentUser.uid, name: 'ANNA', connected: true, joinedAt: D.serverTimestamp() }); return true;", { path: `${base}/players/p4` });
  await mustDeny(T, 'sala: l\'estraneo entra con un posto p8', x, "await D.set(D.ref(db, arg.path), { owner: auth.currentUser.uid, name: 'Otto', connected: true, joinedAt: D.serverTimestamp() }); return true;", { path: `${base}/players/p8` });
  await mustDeny(T, 'sala: l\'estraneo legge tutta la partita', x, GET, base);
  await mustDeny(T, 'sala: l\'estraneo legge l\'elenco delle partite (index)', x, GET, 'index');
  await mustAllow(T, 'sala: l\'estraneo legge la meta (serve per entrare con il codice)', x, GET, `${base}/meta`);

  // --- round 1 ---
  await a.click('#onStart');
  await allOn([a, b, c], 'onTurnScreen'); for (const p of [a, b, c]) await ready(p);
  const { common, impostor, qs } = await impostorByQuestions([a, b, c]);
  T('due telefoni con la stessa domanda, uno con una diversa', !!common && !!impostor, qs);
  const impSeat = seat[impostor];
  const ho = await gread(a, code, 'hostOnly');
  T('l\'host legge hostOnly e l\'impostore coincide con quello dedotto dalle domande', ho.ok && ho.value && ho.value.impostor === impSeat, { hostOnly: ho.value, dedotto: impSeat });
  const by = { Anna: a, Bea: b, Carlo: c };
  const imp = by[impostor];
  T('l\'impostore non vede la domanda comune', !(await imp.body()).includes(common));
  for (const p of [a, b, c]) T(`${p.name}: nessun testo rivela l'impostore`, !/impostor/i.test(await p.page.$eval('#onTurnScreen', e => e.innerText)));

  await mustDeny(T, 'risposte: B legge hostOnly', b, GET, `${base}/hostOnly`);
  await mustDeny(T, 'risposte: B legge la domanda comune (reveal)', b, GET, `${base}/reveal`);
  await mustAllow(T, 'risposte: l\'host legge reveal', a, GET, `${base}/reveal`);
  await mustAllow(T, 'risposte: B legge la propria domanda', b, GET, `${base}/private/p2`);
  await mustDeny(T, 'risposte: B legge la domanda di C', b, GET, `${base}/private/p3`);
  await mustDeny(T, 'risposte: l\'host legge la domanda di C', a, GET, `${base}/private/p3`);
  await mustDeny(T, 'risposte: l\'estraneo legge la domanda di A', x, GET, `${base}/private/p1`);
  await mustDeny(T, 'risposte: B legge tutte le risposte', b, GET, `${base}/answers`);
  await mustAllow(T, 'risposte: B legge la propria risposta (ancora vuota)', b, GET, `${base}/answers/p2`);
  await mustAllow(T, 'risposte: l\'estraneo legge chi ha risposto (pubblico)', x, GET, `${base}/answered`);
  await mustDeny(T, 'risposte: B scrive la risposta di C', b, SETPATCH, { path: base, patch: { 'answers/p3': '9', 'answered/p3': true } });
  await mustDeny(T, 'risposte: B scrive una domanda privata', b, SETPATCH, { path: `${base}/private/p2`, patch: { question: 'x', round: 1 } });
  await mustDeny(T, 'risposte: B cambia i partecipanti', b, SETPATCH, { path: `${base}/seats`, patch: { p9: true } });
  await mustDeny(T, 'risposte: B scrive una risposta non numerica', b, SETPATCH, { path: base, patch: { 'answers/p2': 'abc', 'answered/p2': true } });
  await mustDeny(T, 'risposte: l\'estraneo risponde senza essere nel round', x, SETPATCH, { path: base, patch: { 'answers/p4': '5', 'answered/p4': true } });

  await a.answer(111);
  await b.answer(222);
  await mustDeny(T, 'risposte: B cambia la risposta gia\' data', b, SETPATCH, { path: base, patch: { 'answers/p2': '5' } });
  const wl = await a.texts('#onWaitList .wait-row');
  T('si vede solo chi ha risposto (Carlo ancora "…")', wl.length === 3 && wl[2].includes('…') && wl[0].includes('✓'), wl);
  const bodies = [await a.body(), await b.body(), await c.body()];
  T('prima che rispondano tutti: nessuno vede le risposte altrui', !bodies[0].includes('222') && !bodies[1].includes('111') && !bodies[2].includes('111') && !bodies[2].includes('222'));
  await c.answer(333);

  // --- riepilogo ---
  await allOn([a, b, c], 'onSummaryScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onAnswers .answer-row').length === 3 && !document.getElementById('onAnswers').textContent.includes('…') && document.getElementById('onCommon').textContent !== '…', null, undefined, 'le risposte nel riepilogo');
  for (const p of [a, b, c]) T(`${p.name}: riepilogo con domanda comune e tre risposte`, (await p.text('#onCommon')) === common && (await p.texts('#onAnswers .answer-row')).join('|') === 'Anna111|Bea222|Carlo333');
  await mustAllow(T, 'riepilogo: B legge tutte le risposte', b, GET, `${base}/answers`);
  await mustAllow(T, 'riepilogo: B legge la domanda comune', b, GET, `${base}/reveal`);
  await mustDeny(T, 'riepilogo: B vota in anticipo', b, SETPATCH, { path: base, patch: { 'votes/p2': 'p3', 'voted/p2': true } });
  await mustDeny(T, 'riepilogo: B legge i voti', b, GET, `${base}/votes`);
  T('solo l\'host vede "Alle votazioni"', await a.visible('#onToVote') && !(await b.visible('#onToVote')));

  // --- voto: pareggio Anna->Bea, Bea->Carlo, Carlo->Anna ---
  await a.click('#onToVote'); await allOn([a, b, c], 'onVoteScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 2, null, undefined, '2 opzioni');
  await mustDeny(T, 'voto: B vota se stesso', b, SETPATCH, { path: base, patch: { 'votes/p2': 'p2', 'voted/p2': true } });
  await mustDeny(T, 'voto: B vota un posto inesistente', b, SETPATCH, { path: base, patch: { 'votes/p2': 'p9', 'voted/p2': true } });
  await mustDeny(T, 'voto: B vota al posto di C', b, SETPATCH, { path: base, patch: { 'votes/p3': 'p1', 'voted/p3': true } });
  await mustDeny(T, 'voto: B chiude il voto scrivendo il verdetto', b, SETPATCH, { path: base, patch: { 'meta/phase': 'result', result: { impostor: 'p2', round: 1 } } });
  await castVote(a, 'Bea'); await castVote(b, 'Carlo');
  await mustAllow(T, 'voto: B legge il proprio voto', b, GET, `${base}/votes/p2`);
  await mustDeny(T, 'voto: B legge il voto di A', b, GET, `${base}/votes/p1`);
  await mustDeny(T, 'voto: l\'host legge tutti i voti prima del verdetto', a, GET, `${base}/votes`);
  await mustDeny(T, 'voto: B cambia il voto gia\' dato', b, SETPATCH, { path: base, patch: { 'votes/p2': 'p1' } });
  await mustAllow(T, 'voto: tutti vedono chi ha votato', c, GET, `${base}/voted`);
  await castVote(c, 'Anna');
  await allOn([a, b, c], 'onResultScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 3 && document.getElementById('onResultTitle').textContent !== '…', null, undefined, 'i voti ricevuti');
  for (const p of [a, b, c]) T(`${p.name}: pareggio, l'impostore si salva e viene rivelato`, /Pareggio/.test(await p.text('#onResultText')) && (await p.text('#onResultTitle')) === 'Non questa volta.' && (await p.text('#onImpostor')) === impostor, await p.text('#onResultText'));
  await mustAllow(T, 'verdetto: B legge tutti i voti', b, GET, `${base}/votes`);
  await mustAllow(T, 'verdetto: B legge il verdetto', b, GET, `${base}/result`);
  await mustDeny(T, 'verdetto: B legge hostOnly', b, GET, `${base}/hostOnly`);
  await mustDeny(T, 'verdetto: B riscrive il verdetto', b, SETPATCH, { path: `${base}/result`, patch: { impostor: 'p2' } });
  T('verdetto: timbro CASO CHIUSO; "Continua" e "Nuova partita" solo all\'host', (await a.text('#caseStamp')) === 'CASO CHIUSO' && await a.visible('#onContinue') && await a.visible('#onNewGame') && !(await b.visible('#onContinue')));

  // --- round 2: "Continua", tutti votano l'impostore ---
  await a.click('#onContinue');
  await allOn([a, b, c], 'onTurnScreen'); for (const p of [a, b, c]) await ready(p);
  const r2 = await impostorByQuestions([a, b, c]);
  const ho2 = await gread(a, code, 'hostOnly');
  T('round 2: impostore diverso dal precedente e coerente con hostOnly', r2.impostor !== impostor && ho2.value.impostor === seat[r2.impostor], { prima: impostor, ora: r2.impostor, hostOnly: ho2.value });
  T('round 2: chi ha risposto azzerato nel database', (await gread(a, code, 'answered')).value === null);
  { const rr = await gread(a, code, 'result'); T("round 2: il verdetto non e' leggibile prima del verdetto", L.isDenied(rr), rr); }
  await a.answer(1); await b.answer(2); await c.answer(3);
  await allOn([a, b, c], 'onSummaryScreen'); await a.click('#onToVote');
  for (const n of ['Anna', 'Bea', 'Carlo']) await castVote(by[n], n === r2.impostor ? ['Anna', 'Bea', 'Carlo'].find(y => y !== n) : r2.impostor);
  await allOn([a, b, c], 'onResultScreen');
  for (const p of [a, b, c]) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 3 && document.getElementById('onResultTitle').textContent !== '…', null, undefined, 'i voti ricevuti');
  for (const p of [a, b, c]) T(`${p.name}: round 2 "Beccato."`, (await p.text('#onResultTitle')) === 'Beccato.' && (await p.text('#onImpostor')) === r2.impostor, { titolo: await p.text('#onResultTitle'), testo: await p.text('#onResultText'), impostore: await p.text('#onImpostor'), atteso: r2.impostor, voti: await p.texts('#onVotesList .wait-row') });

  // --- niente permessi negati nel flusso normale (spia di differenze col simulatore) ---
  for (const p of [a, b, c]) {
    const d = L.denials(p).filter(l => !/pulizia/.test(l));
    T(`${p.name}: nessun permesso negato nel flusso normale`, d.length === 0, d.slice(0, 3));
  }
  T('pagine senza errori', [a, b, c].every(p => p.errors.length === 0), [a, b, c].flatMap(p => p.errors));
  console.log('   [registri prima della chiusura]', JSON.stringify({ Anna: a.logs, Bea: b.logs, Carlo: c.logs }, null, 1).slice(0, 3000));

  await dispose(T, [a, b, c], code);
  console.log('   [registri dopo la chiusura]', JSON.stringify({ Anna: a.logs.length, Bea: b.logs.length, Carlo: c.logs.length }), JSON.stringify(b.logs.slice(-6), null, 1));
  const nUsers = await cleanupUsers([a, b, c, x]);
  console.log(`   utenti anonimi cancellati: ${nUsers}`);
}

// ===========================================================================
async function l2() {
  const T = tagger('L2');
  console.log('\n== L2: partita da 7, ottavo giocatore rifiutato ==');
  const names = ['Anna', 'Bea', 'Carlo', 'Dino', 'Eva', 'Fabio', 'Gina'];
  const ps = []; for (const n of names) { const p = await phone(n); p.name = n; ps.push(p); }
  const code = await ps[0].create('Anna'); track('L2', code);
  for (let i = 1; i < 7; i++) await ps[i].join(code, names[i]);
  await inLobby(ps[0], 7);
  T('sala piena 7 / 7', (await ps[0].text('#lobbyCount')) === '7 / 7');
  const h8 = await phone('Hugo'); h8.name = 'Hugo';
  await h8.goOnline(); await h8.type('#onName', 'Hugo'); await h8.type('#onCode', code); await h8.click('#onJoin');
  await h8.waitFor(() => !document.getElementById('onMenuError').classList.contains('hidden'), null, undefined, 'il messaggio di errore');
  T('l\'ottavo giocatore: "partita piena"', /piena/.test(await h8.text('#onMenuError')), await h8.text('#onMenuError'));
  await mustDeny(T, 'l\'ottavo scrive direttamente un ottavo posto', h8, "await D.set(D.ref(db, arg.path), { owner: auth.currentUser.uid, name: 'Hugo', connected: true, joinedAt: D.serverTimestamp() }); return true;", { path: `games/${code}/players/p8` });
  await mustDeny(T, 'l\'ottavo prova a prendere un posto occupato (p7)', h8, "await D.set(D.ref(db, arg.path), { owner: auth.currentUser.uid, name: 'Hugo', connected: true, joinedAt: D.serverTimestamp() }); return true;", { path: `games/${code}/players/p7` });
  await ps[0].click('#onStart'); await allOn(ps, 'onTurnScreen'); for (const p of ps) await ready(p);
  T('a partita iniziata chi entra con un nome nuovo viene respinto', await (async () => { await h8.type('#onName', 'Hugo2'); await h8.type('#onCode', code); await h8.click('#onJoin'); await h8.waitFor(() => /iniziata|piena/.test(document.getElementById('onMenuError').textContent), null, undefined, 'errore'); return /iniziata|piena/.test(await h8.text('#onMenuError')); })());
  for (let i = 0; i < 7; i++) await ps[i].answer(i + 1);
  await allOn(ps, 'onSummaryScreen'); await ps[0].click('#onToVote'); await allOn(ps, 'onVoteScreen');
  const { impostor } = await (async () => { await sleep(500); return { impostor: (await gread(ps[0], code, 'hostOnly')).value.impostor }; })();
  const impName = (await gread(ps[0], code, 'players')).value[impostor].name;
  for (const p of ps) await castVote(p, p.name === impName ? (p.name === 'Anna' ? 'Bea' : 'Anna') : impName);
  await allOn(ps, 'onResultScreen');
  for (const p of ps) await p.waitFor(() => document.querySelectorAll('#onVotesList .wait-row').length === 7, null, undefined, '7 voti');
  T('7 giocatori: verdetto concorde su tutti i telefoni', (await Promise.all(ps.map(p => p.text('#onResultTitle')))).every(t => t === 'Beccato.') && (await Promise.all(ps.map(p => p.text('#onImpostor')))).every(t => t === impName));
  for (const p of ps) { const d = L.denials(p).filter(l => !/pulizia/.test(l)); if (d.length) T(`${p.name}: nessun permesso negato nel flusso normale`, false, d.slice(0, 2)); }
  T('nessun permesso negato nel flusso normale (7 telefoni)', ps.every(p => L.denials(p).filter(l => !/pulizia/.test(l)).length === 0));
  T('pagine senza errori', ps.every(p => p.errors.length === 0), ps.flatMap(p => p.errors));
  await dispose(T, ps, code);
  const n = await cleanupUsers([...ps, h8]);
  console.log(`   utenti anonimi cancellati: ${n}`);
}

// ===========================================================================
// L3: l'host cade in sala. Tempi VERI (45 s).
async function l3() {
  const T = tagger('L3');
  console.log('\n== L3: host che cade in sala (45 s reali) ==');
  const a = await phone('Anna'), b = await phone('Bea'), c = await phone('Carlo');
  [a, b, c].forEach((p, i) => { p.name = ['Anna', 'Bea', 'Carlo'][i]; });
  const code = await a.create('Anna'); track('L3', code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await inLobby(b, 3);
  const t0 = Date.now();
  a.alive = false; await a.page.close();     // l'host "perde il telefono": cade la connessione
  await b.waitFor(() => document.querySelectorAll('#lobbyPlayers .dot.off').length === 1, null, 60000, 'il pallino grigio dell\'host');
  const tGrey = Math.round((Date.now() - t0) / 1000);
  T(`il server segna l'host scollegato (dopo ${tGrey} s) e gli altri leggono il messaggio`, /host è scollegato/.test(await b.text('#lobbyHint')), await b.text('#lobbyHint'));
  const early = (await gread(b, code, 'meta')).value;
  T('subito dopo la caduta il ruolo di host non e\' ancora passato', early.hostSeat === 'p1');
  await sleep(Math.max(0, 22000 - (Date.now() - t0)));
  T('a ~22 s dalla caduta il ruolo non e\' ancora passato (tolleranza)', (await gread(b, code, 'meta')).value.hostSeat === 'p1' && !(await b.visible('#onStart')));
  // con 2 collegati il nuovo host non ha il pulsante: riconosco il passaggio dal suo messaggio ("In attesa di almeno un altro sospettato")
  await b.waitFor(() => document.getElementById('lobbyHint').textContent === 'In attesa di almeno un altro sospettato', null, 150000, 'il ruolo di host');
  const tHost = Math.round((Date.now() - t0) / 1000);
  const meta = (await gread(b, code, 'meta')).value;
  T(`il ruolo passa a Bea dopo ${tHost} s dalla caduta (soglia 45 s + rilevamento)`, meta.hostSeat === 'p2' && tHost >= 45, { hostSeat: meta.hostSeat, secondi: tHost });
  T('Carlo non e\' host', !(await c.visible('#onStart')));
  await b.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 2, null, 30000, 'la rimozione dell\'ex host dalla sala');
  await c.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 2, null, 30000, 'la sala aggiornata su Carlo');
  T('il nuovo host libera il posto dell\'ex host assente', (await gread(b, code, 'players/p1')).value === null && (await c.texts('#lobbyPlayers .player-row')).length === 2);
  const d = await phone('Dino'); d.name = 'Dino'; await d.join(code, 'Dino'); await inLobby(b, 3);
  T('un nuovo giocatore occupa il posto liberato', (await gread(b, code, 'players/p1')).value.name === 'Dino');
  await b.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, undefined, 'il pulsante con 3 collegati');
  await b.click('#onStart'); await allOn([b, c, d], 'onTurnScreen');
  T('si parte regolarmente con il nuovo host', (await gread(b, code, 'meta')).value.round === 1);
  for (const p of [b, c, d]) await ready(p);
  const ps = [b, c, d]; const ans = { Bea: 2, Carlo: 3, Dino: 4 };
  for (const p of ps) await p.answer(ans[p.name]);
  await allOn(ps, 'onSummaryScreen'); await b.click('#onToVote'); await allOn(ps, 'onVoteScreen');
  const impSeat = (await gread(b, code, 'hostOnly')).value.impostor;
  const impName = (await gread(b, code, 'players')).value[impSeat].name;
  for (const p of ps) await castVote(p, p.name === impName ? ps.find(q => q !== p).name : impName);
  await allOn(ps, 'onResultScreen'); await resultReady(ps);
  T('il nuovo host chiude il round e legge hostOnly', (await b.text('#onImpostor')) === impName);
  T('pagine senza errori (escluso il telefono caduto)', ps.every(p => p.errors.length === 0), ps.flatMap(p => p.errors));
  await dispose(T, ps, code);
  console.log(`   utenti anonimi cancellati: ${await cleanupUsers([a, b, c, d])}`);
}

// ===========================================================================
// L4: un giocatore cade a meta' round e un altro telefono ne prende il posto. L5: cade l'host a meta' round.
async function l4() {
  const T = tagger('L4');
  console.log('\n== L4: posto ripreso da un altro telefono dopo 45 s reali ==');
  const a = await phone('Anna'), b = await phone('Bea'), c = await phone('Carlo'), d = await phone('Dino');
  [a, b, c, d].forEach((p, i) => { p.name = ['Anna', 'Bea', 'Carlo', 'Dino'][i]; });
  const code = await a.create('Anna'); track('L4', code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn([a, b, c, d], 'onTurnScreen'); for (const p of [a, b, c, d]) await ready(p);
  const oldUid = await L.uidOf(c);
  const t0 = Date.now();
  c.alive = false; await c.page.close();
  await a.answer(1); await b.answer(2); await d.answer(4);
  const x = await phone('Carlo2'); x.name = 'Carlo';
  await x.goOnline(); await x.type('#onName', 'carlo'); await x.type('#onCode', code); await x.click('#onJoin');
  await x.waitFor(() => !document.getElementById('onMenuError').classList.contains('hidden'), null, undefined, 'messaggio');
  const msg1 = await x.text('#onMenuError');
  T('prima dei 45 s: posto non recuperabile (messaggio con i secondi mancanti, o "collegato" se il server non ha ancora visto la caduta)', /riprova tra \d+ secondi|risulta collegato/.test(msg1), msg1);
  const wait = 47000 - (Date.now() - t0);
  if (wait > 0) await sleep(wait);
  let joined = false;
  for (let i = 0; i < 6 && !joined; i++) {
    await x.click('#onJoin'); await sleep(2500);
    joined = (await x.screen()) !== 'onMenuScreen' || false;
    if (!joined && i < 5) await sleep(3000);
  }
  const tTake = Math.round((Date.now() - t0) / 1000);
  T(`dopo ~${tTake} s il nuovo telefono riprende il posto (soglia 45 s)`, joined && tTake >= 45, { schermata: await x.screen(), secondi: tTake, messaggio: await x.text('#onMenuError') });
  const own = (await gread(a, code, 'players/p3')).value;
  T('il posto p3 ha il nuovo proprietario e il nome originale', own && own.owner !== oldUid && own.name === 'Carlo', own && { nome: own.name, cambiatoProprietario: own.owner !== oldUid });
  await x.waitScreen('onTurnScreen'); await ready(x);
  T('il nuovo telefono legge la domanda privata di quel posto', (await x.readQuestion()).length > 0);
  await mustDeny(T, 'il vecchio proprietario (uid) non puo\' piu\' scrivere nel posto', a, "await D.update(D.ref(db, arg.path), { connected: false }); return true;", { path: `games/${code}/players/p3` });
  await x.answer(3);
  await allOn([a, b, d, x], 'onSummaryScreen'); await summaryReady([a, b, d, x], 4);
  T('il round prosegue con il nuovo telefono: riepilogo con quattro risposte', (await a.texts('#onAnswers .answer-row')).join('|') === 'Anna1|Bea2|Carlo3|Dino4');
  await a.click('#onToVote'); await allOn([a, b, d, x], 'onVoteScreen');
  const impSeat = (await gread(a, code, 'hostOnly')).value.impostor;
  const impName = (await gread(a, code, 'players')).value[impSeat].name;
  const ps = [a, b, d, x];
  for (const p of ps) await castVote(p, p.name === impName ? ps.find(q => q !== p).name : impName);
  await allOn(ps, 'onResultScreen'); await resultReady(ps);
  T('verdetto su tutti i telefoni', (await a.text('#onImpostor')) === impName && (await x.text('#onImpostor')) === impName);
  T('pagine senza errori', ps.every(p => p.errors.length === 0), ps.flatMap(p => p.errors));
  await dispose(T, ps, code);
  console.log(`   utenti anonimi cancellati: ${await cleanupUsers([a, b, c, d, x])}`);
}

async function l5() {
  const T = tagger('L5');
  console.log('\n== L5: cade l\'host a meta\' round: passaggio del ruolo e "Prosegui senza gli assenti" (45 s reali) ==');
  const names = ['Anna', 'Bea', 'Carlo', 'Dino'];
  const ps = []; for (const n of names) { const p = await phone(n); p.name = n; ps.push(p); }
  const [a, b, c, d] = ps;
  const code = await a.create('Anna'); track('L5', code);
  await b.join(code, 'Bea'); await c.join(code, 'Carlo'); await d.join(code, 'Dino'); await inLobby(a, 4);
  await a.click('#onStart'); await allOn(ps, 'onTurnScreen'); for (const p of ps) await ready(p);
  const impSeat0 = (await gread(a, code, 'hostOnly')).value.impostor;
  const impName0 = (await gread(a, code, 'players')).value[impSeat0].name;
  const t0 = Date.now();
  a.alive = false; await a.page.close();
  const rest = [b, c, d];
  for (const p of rest) await p.answer({ Bea: 2, Carlo: 3, Dino: 4 }[p.name]);
  T('chi ha risposto aspetta e legge che l\'host e\' scollegato', await (async () => { await b.waitFor(() => /host è scollegato|scollegato/.test(document.body.innerText), null, 60000, 'il messaggio di host scollegato'); return true; })());
  await b.waitFor(() => !document.getElementById('onSkipAbsent').classList.contains('hidden') || document.getElementById('onSummaryScreen').classList.contains('active') || document.getElementById('onTurnScreen').classList.contains('active') && document.getElementById('onProgressText').textContent === '0 / 3', null, 180000, 'il passaggio del ruolo e il pulsante "Prosegui"');
  const tHost = Math.round((Date.now() - t0) / 1000);
  const meta = (await gread(b, code, 'meta')).value;
  T(`l'host passa a Bea dopo ${tHost} s (soglia 45 s)`, meta.hostSeat === 'p2' && tHost >= 45, { hostSeat: meta.hostSeat, secondi: tHost });
  if (await b.visible('#onSkipAbsent')) {
    T('"Prosegui senza gli assenti" compare solo al nuovo host', !(await c.visible('#onSkipAbsent')) && !(await d.visible('#onSkipAbsent')));
    await b.click('#onSkipAbsent');
  }
  await sleep(4000);
  const scr = await b.screen();
  if (impName0 === 'Anna') {
    await b.waitFor(() => document.getElementById('onProgressText').textContent === '0 / 3', null, 30000, 'il nuovo round');
    T('l\'impostore (Anna) era assente: il round viene annullato e riparte senza di lei', (await gread(b, code, 'meta')).value.round === 2);
    T('avviso neutro mostrato a tutti', (await Promise.all(rest.map(p => p.text('#onNotice')))).every(t => t === 'Un sospettato si è dileguato: si riapre il caso.'));
    for (const p of rest) await ready(p);
    for (const p of rest) await p.answer({ Bea: 2, Carlo: 3, Dino: 4 }[p.name]);
  } else {
    T('l\'impostore non era assente: il round prosegue con i 3 rimasti', scr === 'onSummaryScreen', scr);
  }
  await allOn(rest, 'onSummaryScreen');
  T('riepilogo con le 3 risposte dei presenti', (await b.texts('#onAnswers .answer-row')).length === 3);
  await b.click('#onToVote'); await allOn(rest, 'onVoteScreen');
  const impSeat = (await gread(b, code, 'hostOnly')).value.impostor;
  const impName = (await gread(b, code, 'players')).value[impSeat].name;
  for (const p of rest) await castVote(p, p.name === impName ? rest.find(q => q !== p).name : impName);
  await allOn(rest, 'onResultScreen'); await resultReady(rest);
  T('verdetto con l\'impostore giusto', (await c.text('#onImpostor')) === impName);
  T('pagine senza errori (escluso il telefono caduto)', rest.every(p => p.errors.length === 0), rest.flatMap(p => p.errors));
  await dispose(T, rest, code);
  console.log(`   utenti anonimi cancellati: ${await cleanupUsers(ps)}`);
}

// ===========================================================================
const SCENARIOS = { l1, l2, l3, l4, l5 };
(async () => {
  const want = process.argv.slice(2).map(s => s.toLowerCase());
  const run = Object.keys(SCENARIOS).filter(k => !want.length || want.includes(k));
  H = await startHarness(); H.timeout = 40000;
  // la prova lunga (45 s reali) per L3, L4, L5 va in parallelo
  const quick = run.filter(k => k === 'l1' || k === 'l2');
  const slow = run.filter(k => ['l3', 'l4', 'l5'].includes(k));
  try {
    for (const k of quick) { try { await SCENARIOS[k](); } catch (e) { fails++; failed.push(`${k}: ${e.message}`); console.log(`FAIL - ${k}: ${e.message}`); } }
    await Promise.all(slow.map(async k => { try { await SCENARIOS[k](); } catch (e) { fails++; failed.push(`${k}: ${e.message}`); console.log(`FAIL - ${k}: ${e.message}`); } }));

    // ---- controllo finale: nessuna partita di prova rimasta ----
    console.log('\n== Controllo finale: partite di prova rimaste nel database ==');
    const auditor = await phone('Revisore'); await auditor.goOnline();
    const left = [];
    for (const code of created) {
      const r = await L.read(auditor, `games/${code}/meta`);
      const pl = await L.read(auditor, `games/${code}/players`);
      if (!(r.ok && r.value === null && pl.ok && pl.value === null)) left.push({ code, meta: r.value, players: pl.value && Object.keys(pl.value) });
    }
    console.log(`partite create: ${created.size} | rimaste: ${left.length}`, left.length ? JSON.stringify(left) : '');
    await L.deleteAnon(auditor);
    console.log(`utenti anonimi lasciati (pagina chiusa per simulare la caduta): ${orphans.length} [${orphans.join(', ')}]`);
    if (left.length) failed.push(`partite rimaste: ${left.map(l => l.code).join(',')}`);
  } finally { try { await H.stop(); } catch (e) { console.log('(chiusura di Chrome non pulita: ' + String(e.message).slice(0, 80) + ')'); } }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  if (failed.length) console.log('FALLITI:\n - ' + failed.join('\n - '));
  process.exit(fails ? 1 : 0);
})();
