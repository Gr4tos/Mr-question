// Test offline delle regole di database.rules.json con il simulatore Targaryen.
// Uso: npm install && node build-rules.js && node --test rules.test.js
// Ogni divieto e' affiancato dalla stessa operazione fatta dall'attore giusto, cosi' un rifiuto
// per errore di sintassi non passa per buono.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('targaryen');
const RULES = require('../database.rules.json');

const T0 = 1700000000000;
const TS = { '.sv': 'timestamp' };
const DAY = 86400000;
const C = 'ABCDE';
const G = `/games/${C}`;

class Sim {
  constructor() { this.now = T0; this.db = T.database(RULES, {}, T0); }
  tick(ms) { this.now += ms; }
  // with({auth: null}) in Targaryen mantiene l'utente precedente: per l'anonimo si riparte da un database nuovo
  as(uid) { return uid ? this.db.with({ auth: { uid }, now: this.now }) : T.database(RULES, this.db.root, this.now); }
  read(uid, p, query) { return this.as(uid).read(p, query ? { query, now: this.now } : { now: this.now }); }
  write(uid, p, v) { return this.as(uid).write(p, v, { now: this.now }); }
  update(uid, p, patch) { return this.as(uid).update(p, patch, { now: this.now }); }
  commit(r) { assert.ok(r.allowed, `negato ma doveva passare: ${r.path} ${String(r.info || '').slice(0, 500)}`); this.db = r.newDatabase; return r; }
  w(uid, p, v) { return this.commit(this.write(uid, p, v)); }
  u(uid, p, patch) { return this.commit(this.update(uid, p, patch)); }
}
const yes = (r, msg) => assert.ok(r.allowed, `${msg || ''} doveva passare: ${String(r.info || '').slice(0, 400)}`);
const no = (r, msg) => assert.ok(!r.allowed, `${msg || ''} doveva essere rifiutato`);

const seatObj = (uid, name) => ({ owner: uid, name, connected: true, joinedAt: TS });

function lobby(sim, names = ['Anna', 'Bea', 'Carlo', 'Dino']) {
  sim.u('u1', '/', {
    [`games/${C}`]: { meta: { hostSeat: 'p1', phase: 'lobby', round: 0, createdAt: TS }, players: { p1: seatObj('u1', names[0]) } },
    [`index/${C}`]: TS
  });
  names.slice(1).forEach((n, i) => sim.w(`u${i + 2}`, `${G}/players/p${i + 2}`, seatObj(`u${i + 2}`, n)));
}

// "Apri le indagini"/"Continua": 1) dati del round in un unico update, 2) cambio di fase
function startRound(sim, { seats = ['p1', 'p2', 'p3'], impostor = 'p2', round = 1, notice = null } = {}) {
  const priv = {};
  seats.forEach(s => { priv[s] = { question: s === impostor ? `Alt ${s}` : 'Domanda comune?', round }; });
  sim.u('u1', G, {
    answered: null, answers: null, voted: null, votes: null, result: null,
    seats: Object.fromEntries(seats.map(s => [s, true])),
    private: priv,
    reveal: { common: 'Domanda comune?', round },
    hostOnly: { impostor },
    'meta/notice': notice
  });
  sim.u('u1', '/', { [`games/${C}/meta/phase`]: 'answering', [`games/${C}/meta/round`]: round, [`index/${C}`]: TS });
}
const setPhase = (sim, p) => sim.u('u1', '/', { [`games/${C}/meta/phase`]: p, [`index/${C}`]: TS });
const answerAll = sim => ['u1:p1:5', 'u2:p2:7', 'u3:p3:9'].forEach(x => { const [u, s, v] = x.split(':'); sim.u(u, G, { [`answers/${s}`]: v, [`answered/${s}`]: true }); });

test('creazione partita', () => {
  const s = new Sim();
  const game = (over = {}) => ({ [`games/${C}`]: { meta: { hostSeat: 'p1', phase: 'lobby', round: 0, createdAt: TS, ...(over.meta || {}) }, players: { p1: over.p1 || seatObj('u1', 'Anna') } }, [`index/${C}`]: TS });
  no(s.update(null, '/', game()), 'senza login');
  no(s.update('u1', '/', game({ meta: { hostSeat: 'p2' } })), 'host non p1');
  no(s.update('u1', '/', game({ meta: { phase: 'answering' } })), 'fase iniziale diversa da lobby');
  no(s.update('u1', '/', game({ p1: seatObj('u9', 'Anna') })), 'posto p1 intestato a un altro');
  no(s.update('u1', '/', game({ p1: seatObj('u1', '') })), 'nome vuoto');
  no(s.update('u1', '/', game({ p1: seatObj('u1', 'N'.repeat(21)) })), 'nome troppo lungo');
  no(s.update('u1', '/', { ...game(), ['games/ABCDI']: game()[`games/${C}`] }), 'codice con la I');
  yes(s.update('u1', '/', game()), 'creazione valida');
  s.u('u1', '/', game());
  no(s.update('u2', '/', game({ p1: seatObj('u2', 'Bea') })), 'codice gia\' esistente (altro utente)');
  no(s.write('u2', `${G}`, { meta: { hostSeat: 'p1', phase: 'lobby', round: 0 }, players: { p1: seatObj('u2', 'Bea') } }), 'sovrascrittura');
});

test('ingresso in sala d\'attesa', () => {
  const s = new Sim(); lobby(s, ['Anna', 'Bea']);
  yes(s.write('u3', `${G}/players/p3`, seatObj('u3', 'Carlo')), 'ingresso valido');
  no(s.write('u3', `${G}/players/p3`, seatObj('u9', 'Carlo')), 'posto intestato a un altro');
  no(s.write('u3', `${G}/players/p3`, seatObj('u3', 'ANNA')), 'nome uguale a Anna (maiuscole)');
  no(s.write('u3', `${G}/players/p3`, seatObj('u3', 'bea')), 'nome uguale a Bea (minuscole)');
  no(s.write('u3', `${G}/players/p8`, seatObj('u3', 'Carlo')), 'posto p8');
  no(s.write('u3', `${G}/players/p2`, seatObj('u3', 'Carlo')), 'posto gia\' occupato');
  no(s.write('u3', `${G}/players/p3`, { ...seatObj('u3', 'Carlo'), extra: 1 }), 'campo extra');
  no(s.write('u3', `${G}/players/p3`, seatObj('u3', 'N'.repeat(21))), 'nome troppo lungo');
  no(s.write(null, `${G}/players/p3`, seatObj('u3', 'Carlo')), 'senza login');
  s.w('u3', `${G}/players/p3`, seatObj('u3', 'Carlo'));
  no(s.write('u3', `${G}/players/p3/name`, 'Carletto'), 'cambio nome');
  // fino a 7 giocatori, poi non c'e' un ottavo posto
  ['Dino', 'Eva', 'Fabio', 'Gina'].forEach((n, i) => s.w(`u${i + 4}`, `${G}/players/p${i + 4}`, seatObj(`u${i + 4}`, n)));
  no(s.write('u8', `${G}/players/p8`, seatObj('u8', 'Hugo')), 'ottavo giocatore');
  // nomi unici anche fra posti alti e bassi
  const s2 = new Sim(); lobby(s2, ['Anna']);
  ['Bea', 'Carlo', 'Dino', 'Eva', 'Fabio'].forEach((n, i) => s2.w(`u${i + 2}`, `${G}/players/p${i + 2}`, seatObj(`u${i + 2}`, n)));
  no(s2.write('u7', `${G}/players/p7`, seatObj('u7', 'anna')), 'p7 uguale a p1');
  no(s2.write('u7', `${G}/players/p7`, seatObj('u7', 'FABIO')), 'p7 uguale a p6');
  yes(s2.write('u7', `${G}/players/p7`, seatObj('u7', 'Gina')), 'p7 valido');
  // a partita avviata non si entra con un nome nuovo
  startRound(s);
  no(s.write('u9', `${G}/players/p6`, seatObj('u9', 'Nuovo')), 'ingresso a partita avviata');
});

test('inizio round: solo l\'host scrive, nessuno legge i dati altrui', () => {
  const s = new Sim(); lobby(s); startRound(s);
  // scritture non permesse a un giocatore
  for (const [p, v] of [[`${G}/private/p2`, { question: 'x', round: 1 }], [`${G}/hostOnly`, { impostor: 'p1' }], [`${G}/seats/p4`, true],
    [`${G}/reveal`, { common: 'x', round: 1 }], [`${G}/meta/phase`, 'summary'], [`${G}/meta/round`, 9], [`${G}/result`, { impostor: 'p1', round: 1 }]]) {
    no(s.write('u2', p, v), `u2 scrive ${p}`);
  }
  no(s.update('u2', G, { answered: null, answers: null }), 'u2 azzera risposte');
  no(s.update('u2', G, { 'meta/notice': { code: 'vanished', round: 1 } }), 'u2 scrive un avviso');
  // lettura: domanda privata solo del proprietario
  yes(s.read('u2', `${G}/private/p2`), 'u2 legge la sua domanda');
  no(s.read('u2', `${G}/private/p1`), 'u2 legge la domanda di p1');
  no(s.read('u2', `${G}/private`), 'u2 legge tutte le domande');
  no(s.read('u1', `${G}/private/p2`), 'anche l\'host non legge le domande altrui dal client');
  yes(s.read('u1', `${G}/private/p1`), 'host legge la propria');
  // impostore e domanda comune
  yes(s.read('u1', `${G}/hostOnly`), 'host legge hostOnly');
  no(s.read('u2', `${G}/hostOnly`), 'u2 legge hostOnly');
  no(s.read('u2', `${G}/reveal`), 'u2 legge la domanda comune prima del riepilogo');
  yes(s.read('u1', `${G}/reveal`), 'host legge reveal');
  // dati pubblici
  for (const p of ['meta', 'players', 'seats', 'answered', 'voted']) yes(s.read('u3', `${G}/${p}`), `u3 legge ${p}`);
  for (const p of ['answers', 'votes', 'result']) no(s.read('u3', `${G}/${p}`), `u3 legge ${p} troppo presto`);
  no(s.read('u3', G), 'u3 legge tutta la partita');
  no(s.read(null, `${G}/meta`), 'senza login');
  // anche l'avviso (notice) viene scritto dall'host in un unico update
  yes(s.update('u1', G, { 'meta/notice': { code: 'vanished', round: 1 } }), 'avviso scritto dall\'host');
  no(s.update('u1', G, { hostOnly: { impostor: 'p9' } }), 'impostore non valido');
  no(s.update('u1', G, { private: { p2: { question: '', round: 1 } } }), 'domanda vuota');
  no(s.update('u1', G, { private: { p2: { question: 'q'.repeat(241), round: 1 } } }), 'domanda troppo lunga');
});

test('risposte', () => {
  const s = new Sim(); lobby(s); startRound(s);
  yes(s.update('u2', G, { 'answers/p2': '42', 'answered/p2': true }), 'risposta valida');
  s.u('u2', G, { 'answers/p2': '42', 'answered/p2': true });
  no(s.update('u2', G, { 'answers/p2': '43' }), 'seconda risposta');
  no(s.update('u3', G, { 'answers/p2': '1', 'answered/p2': true }), 'risposta nel posto altrui');
  for (const bad of ['abc', '', '1,5', '0x10', '1e', ' 5', '5 ', 'Infinity', '9'.repeat(25)])
    no(s.update('u3', G, { 'answers/p3': bad, 'answered/p3': true }), `risposta non valida "${bad}"`);
  for (const good of ['0', '-3', '007', '.5', '12.75', '1e3', '-2.5E-2'])
    yes(s.update('u3', G, { 'answers/p3': good, 'answered/p3': true }), `risposta valida "${good}"`);
  no(s.update('u4', G, { 'answers/p4': '5', 'answered/p4': true }), 'giocatore non nel round');
  no(s.update('u3', G, { 'answered/p3': 'si' }), 'flag non booleano');
  // letture
  yes(s.read('u2', `${G}/answers/p2`), 'u2 legge la propria risposta');
  no(s.read('u3', `${G}/answers/p2`), 'u3 legge la risposta di p2');
  no(s.read('u3', `${G}/answers`), 'u3 legge tutte le risposte');
  no(s.read('u1', `${G}/answers`), 'nemmeno l\'host legge le risposte prima del riepilogo');
  yes(s.read('u3', `${G}/answered`), 'chi ha risposto e\' pubblico');
  // fase sbagliata
  s.u('u3', G, { 'answers/p3': '9', 'answered/p3': true });
  s.u('u1', G, { 'answers/p1': '5', 'answered/p1': true });
  setPhase(s, 'summary');
  no(s.update('u4', G, { 'answers/p4': '1', 'answered/p4': true }), 'risposta in fase riepilogo');
  yes(s.read('u3', `${G}/answers`), 'dopo il riepilogo tutti leggono le risposte');
  yes(s.read('u3', `${G}/reveal`), 'dopo il riepilogo tutti leggono la domanda comune');
  no(s.read('u3', `${G}/votes`), 'i voti restano chiusi');
});

test('voto segreto', () => {
  const s = new Sim(); lobby(s); startRound(s); answerAll(s); setPhase(s, 'summary');
  no(s.update('u2', G, { 'votes/p2': 'p3', 'voted/p2': true }), 'voto in fase riepilogo');
  setPhase(s, 'vote');
  yes(s.update('u2', G, { 'votes/p2': 'p3', 'voted/p2': true }), 'voto valido');
  no(s.update('u2', G, { 'votes/p2': 'p2', 'voted/p2': true }), 'voto per se stessi');
  no(s.update('u2', G, { 'votes/p2': 'p4', 'voted/p2': true }), 'voto per chi non e\' nel round');
  no(s.update('u2', G, { 'votes/p2': 'p9', 'voted/p2': true }), 'voto per un posto inesistente');
  no(s.update('u2', G, { 'votes/p2': 'Anna', 'voted/p2': true }), 'voto non valido');
  no(s.update('u3', G, { 'votes/p2': 'p1', 'voted/p2': true }), 'voto nel posto altrui');
  no(s.update('u4', G, { 'votes/p4': 'p1', 'voted/p4': true }), 'voto di chi non e\' nel round');
  s.u('u2', G, { 'votes/p2': 'p3', 'voted/p2': true });
  no(s.update('u2', G, { 'votes/p2': 'p1' }), 'cambio voto');
  yes(s.read('u2', `${G}/votes/p2`), 'u2 legge il proprio voto');
  no(s.read('u3', `${G}/votes/p2`), 'u3 legge il voto di p2');
  no(s.read('u3', `${G}/votes`), 'u3 legge tutti i voti');
  no(s.read('u1', `${G}/votes`), 'l\'host non legge i voti prima del verdetto');
  yes(s.read('u3', `${G}/voted`), 'chi ha votato e\' pubblico');
  s.u('u1', G, { 'votes/p1': 'p2', 'voted/p1': true });
  s.u('u3', G, { 'votes/p3': 'p2', 'voted/p3': true });
  // verdetto: fase e impostore in un unico update dell'host
  no(s.update('u2', G, { 'meta/phase': 'result', result: { impostor: 'p2', round: 1 } }), 'u2 chiude il voto');
  no(s.read('u2', `${G}/result`), 'impostore non leggibile prima del verdetto');
  s.u('u1', G, { 'meta/phase': 'result', result: { impostor: 'p2', round: 1 } });
  for (const p of ['votes', 'result', 'answers', 'reveal']) yes(s.read('u3', `${G}/${p}`), `u3 legge ${p} al verdetto`);
  no(s.read('u3', `${G}/hostOnly`), 'hostOnly resta chiuso');
  no(s.read('u3', `${G}/private/p2`), 'le domande private restano chiuse');
});

test('cambio fase e avanzamento', () => {
  const s = new Sim(); lobby(s);
  no(s.update('u2', G, { 'meta/phase': 'answering' }), 'u2 cambia fase');
  no(s.update('u1', G, { 'meta/phase': 'finita' }), 'fase non valida');
  no(s.update('u1', G, { 'meta/round': 'uno' }), 'round non numerico');
  no(s.update('u1', G, { 'meta/hostSeat': 'p9' }), 'host inesistente');
  yes(s.update('u1', G, { 'meta/phase': 'answering', 'meta/round': 1 }), 'host cambia fase');
  no(s.update('u1', G, { 'meta/extra': 1 }), 'campo extra in meta');
  no(s.write('u1', `${G}/extra`, 1), 'nodo extra nella partita');
  // "Continua": azzeramento + nuove domande in un solo update, poi la fase
  startRound(s); answerAll(s); setPhase(s, 'summary'); setPhase(s, 'vote'); setPhase(s, 'result');
  const next = { answered: null, answers: null, voted: null, votes: null, result: null, seats: { p1: true, p2: true, p3: true },
    private: { p1: { question: 'N', round: 2 }, p2: { question: 'N2', round: 2 }, p3: { question: 'N', round: 2 } },
    reveal: { common: 'N', round: 2 }, hostOnly: { impostor: 'p3', prev: 'p2' }, 'meta/notice': { code: 'vanished', round: 2 } };
  no(s.update('u2', G, next), 'u2 avvia un nuovo round');
  yes(s.update('u1', G, next), 'host avvia un nuovo round');
  s.u('u1', G, next);
  assert.equal(s.db.root.games[C].answers?.$value?.(), undefined);
  yes(s.update('u1', G, { 'meta/phase': 'answering', 'meta/round': 2 }), 'poi cambia fase');
  // "Nuova partita": torna in sala d'attesa
  const reset = { answered: null, answers: null, voted: null, votes: null, result: null, seats: null, private: null, reveal: null, hostOnly: null, 'meta/phase': 'lobby', 'meta/round': 0, 'meta/notice': null };
  no(s.update('u2', G, reset), 'u2 apre una nuova partita');
  yes(s.update('u1', G, reset), 'host apre una nuova partita');
});

test('presenza, recupero del posto (tolleranza 45 s) e passaggio dell\'host', () => {
  const s = new Sim(); lobby(s); startRound(s);
  // presenza: solo il proprietario
  yes(s.update('u2', `${G}/players/p2`, { connected: false, disconnectedAt: TS }), 'u2 si segna scollegato');
  no(s.update('u3', `${G}/players/p2`, { connected: false, disconnectedAt: TS }), 'u3 segna scollegato p2');
  no(s.update('u2', `${G}/players/p2`, { disconnectedAt: T0 + 99999999 }), 'timestamp nel futuro');
  s.u('u2', `${G}/players/p2`, { connected: false, disconnectedAt: TS });
  // recupero del posto da un altro telefono
  const claim = { owner: 'u9', connected: true, disconnectedAt: null };
  s.tick(10000); no(s.update('u9', `${G}/players/p2`, claim), 'recupero dopo 10 s');
  s.tick(34000); no(s.update('u9', `${G}/players/p2`, claim), 'recupero dopo 44 s');
  s.tick(2000);
  no(s.update('u9', `${G}/players/p2`, { ...claim, name: 'Altro' }), 'recupero con nome diverso');
  no(s.update('u9', `${G}/players/p2`, { ...claim, owner: 'u8' }), 'recupero a nome di un altro');
  no(s.update('u3', `${G}/players/p2`, claim), 'owner diverso dall\'autore');
  yes(s.update('u9', `${G}/players/p2`, claim), 'recupero dopo 46 s');
  s.u('u9', `${G}/players/p2`, claim);
  yes(s.read('u9', `${G}/private/p2`), 'il nuovo telefono legge la domanda del posto');
  no(s.read('u2', `${G}/private/p2`), 'il vecchio telefono non la legge piu\'');
  no(s.update('u2', `${G}/players/p2`, { connected: false, disconnectedAt: TS }), 'vecchio onDisconnect respinto');
  // chi e' ancora collegato non si puo' scavalcare
  no(s.update('u8', `${G}/players/p3`, { owner: 'u8', connected: true }), 'furto di un posto collegato');
  // rientro dallo stesso telefono: sempre possibile
  s.u('u3', `${G}/players/p3`, { connected: false, disconnectedAt: TS });
  yes(s.update('u3', `${G}/players/p3`, { connected: true, disconnectedAt: null }), 'rientro stesso telefono subito');

  // passaggio dell'host
  const s2 = new Sim(); lobby(s2); startRound(s2);
  no(s2.update('u2', `${G}/meta`, { hostSeat: 'p2' }), 'u2 prende l\'host con host collegato');
  s2.u('u1', `${G}/players/p1`, { connected: false, disconnectedAt: TS });
  s2.tick(30000); no(s2.update('u2', `${G}/meta`, { hostSeat: 'p2' }), 'passaggio dopo 30 s');
  s2.tick(16000);
  no(s2.update('u2', `${G}/meta`, { hostSeat: 'p3' }), 'u2 assegna l\'host a un posto non suo');
  no(s2.update('u9', `${G}/meta`, { hostSeat: 'p2' }), 'estraneo prende l\'host');
  yes(s2.update('u2', `${G}/meta`, { hostSeat: 'p2' }), 'passaggio dopo 46 s');
  s2.u('u2', `${G}/meta`, { hostSeat: 'p2' });
  no(s2.update('u3', `${G}/meta`, { hostSeat: 'p3' }), 'secondo passaggio con host collegato');
  no(s2.update('u1', `${G}/meta`, { phase: 'summary' }), 'il vecchio host non comanda piu\'');
  yes(s2.update('u2', `${G}/meta`, { phase: 'summary' }), 'il nuovo host comanda');
  yes(s2.read('u2', `${G}/hostOnly`), 'il nuovo host legge l\'impostore');
  no(s2.read('u1', `${G}/hostOnly`), 'il vecchio host no');
});

test('uscita e rimozione di giocatori', () => {
  const s = new Sim(); lobby(s);
  // l'host passa il ruolo e lascia in una sola operazione
  no(s.update('u2', G, { 'meta/hostSeat': 'p2', 'players/p1': null }), 'u2 espelle l\'host');
  no(s.update('u1', G, { 'players/p1': null }), 'host esce senza passare il ruolo: lascerebbe la partita senza host');
  yes(s.update('u1', G, { 'meta/hostSeat': 'p2', 'players/p1': null }), 'host passa il ruolo ed esce');
  s.u('u1', G, { 'meta/hostSeat': 'p2', 'players/p1': null });
  yes(s.update('u3', G, { 'players/p3': null }), 'un giocatore esce dalla sala');
  no(s.update('u2', G, { 'players/p4': null }), 'host rimuove un giocatore collegato');
  s.u('u4', `${G}/players/p4`, { connected: false, disconnectedAt: TS });
  s.tick(46000);
  no(s.update('u3', G, { 'players/p4': null }), 'un giocatore rimuove un assente');
  yes(s.update('u2', G, { 'players/p4': null }), 'host rimuove un assente da piu\' di 45 s');
  // una volta fuori da una partita avviata il posto resta (serve per rientrare)
  const s2 = new Sim(); lobby(s2); startRound(s2);
  yes(s2.update('u3', `${G}/players/p3`, { connected: false, disconnectedAt: TS }), 'segna scollegato');
});

test('assenti esclusi dal round', () => {
  const s = new Sim(); lobby(s); startRound(s);
  no(s.update('u2', G, { seats: { p1: true, p2: true } }), 'u2 esclude p3');
  yes(s.update('u1', G, { seats: { p1: true, p2: true } }), 'host esclude p3');
  s.u('u1', G, { seats: { p1: true, p2: true } });
  no(s.update('u3', G, { 'answers/p3': '1', 'answered/p3': true }), 'l\'escluso non risponde piu\'');
  yes(s.update('u2', G, { 'answers/p2': '1', 'answered/p2': true }), 'chi e\' nel round risponde');
  no(s.update('u1', G, { 'meta/notice': { code: 'vanished' } }), 'avviso senza round');
});

test('pulizia delle partite ferme da 24 ore', () => {
  const s = new Sim(); lobby(s); startRound(s);
  const stale = { orderByValue: true, endAt: T0 - 1000, limitToFirst: 5 };
  const fresh = () => ({ orderByValue: true, endAt: s.now, limitToFirst: 5 });
  no(s.read('u9', '/index', fresh()), 'elenco delle partite attive');
  no(s.read('u9', '/index'), 'lettura senza query');
  no(s.read(null, '/index', { orderByValue: true, endAt: 1, limitToFirst: 5 }), 'senza login');
  s.tick(DAY + 5000);
  const old = { orderByValue: true, endAt: s.now - DAY - 1000, limitToFirst: 5 };
  yes(s.read('u9', '/index', old), 'elenco delle partite ferme');
  no(s.read('u9', '/index', { ...old, limitToFirst: 50 }), 'troppi risultati');
  no(s.read('u9', '/index', { orderByKey: true, endAt: 'ZZZZZ', limitToFirst: 5 }), 'query per chiave');
  no(s.read('u9', '/index', fresh()), 'elenco recente');
  void stale;
  // cancellazione
  const del = { [`games/${C}`]: null, [`index/${C}`]: null };
  no(s.update(null, '/', del), 'cancellazione senza login');
  yes(s.update('u9', '/', del), 'cancellazione di una partita ferma da 24 ore');
  // partita recente: non si cancella
  const s2 = new Sim(); lobby(s2); startRound(s2); s2.tick(DAY - 60000);
  no(s2.update('u9', '/', del), 'cancellazione di una partita recente');
  no(s2.write('u9', `/index/${C}`, null), 'cancellazione indice recente');
  // l'host mantiene viva la partita
  s2.u('u1', '/', { [`index/${C}`]: TS });
  s2.tick(120000);
  no(s2.update('u9', '/', del), 'partita tenuta viva dall\'host');
  no(s2.update('u2', '/', { [`index/${C}`]: TS }), 'un giocatore aggiorna l\'attivita\'');
  yes(s2.update('u1', '/', { [`index/${C}`]: TS }), 'host aggiorna l\'attivita\'');
  // indice inventato: si puo' creare ma si cancella solo quando e' vecchio
  yes(s2.write('u9', '/index/ZZZZZ', TS), 'indice per un nuovo codice');
  no(s2.write('u9', '/index/ZZZZI', TS), 'indice con codice non valido');
  no(s2.write('u9', '/index/ZZZZY', 'ieri'), 'indice con valore non numerico');
  no(s2.write('u9', '/index/ZZZZY', s2.now + 999999999), 'indice con data nel futuro');
  yes(s2.write('u9', '/index/ZZZZY', s2.now), 'indice con data valida');
});

test('nessun accesso senza login, nessun accesso fuori dalla partita', () => {
  const s = new Sim(); lobby(s);
  for (const p of ['/', '/games', `${G}`, `${G}/players`, '/index']) no(s.read(null, p), `lettura anonima ${p}`);
  no(s.read('u9', '/'), 'lettura della radice');
  no(s.read('u9', '/games'), 'elenco delle partite');
  no(s.write('u9', '/foo', 1), 'scrittura fuori schema');
  no(s.write('u1', '/games', {}), 'scrittura dell\'elenco partite');
});

test('ultimo giocatore in sala: la partita si cancella solo se resta vuota', () => {
  const closeAlone = { [`games/${C}/players/p1`]: null, [`games/${C}/meta`]: null, [`index/${C}`]: null };
  // da solo: l'host puo' chiudere la sala
  const s = new Sim(); lobby(s, ['Anna']);
  no(s.update('u2', '/', closeAlone), 'un estraneo cancella la sala');
  no(s.update(null, '/', closeAlone), 'senza login');
  yes(s.update('u1', '/', closeAlone), 'host da solo chiude la sala');
  s.u('u1', '/', closeAlone);
  assert.equal(s.db.root.$value(), null, 'la partita e l\'indice sono spariti: il database e\' vuoto');
  // con altri giocatori in sala non si puo'
  const s2 = new Sim(); lobby(s2, ['Anna', 'Bea']);
  no(s2.update('u1', '/', closeAlone), 'host cancella la sala con un altro giocatore dentro');
  no(s2.update('u1', G, { meta: null }), 'host cancella solo meta con un altro giocatore dentro');
  no(s2.update('u1', '/', { [`index/${C}`]: null }), 'host cancella solo l\'indice con un altro giocatore dentro');
  no(s2.update('u2', '/', closeAlone), 'un giocatore cancella la sala');
  // dopo che il secondo se n'e' andato, l'host e' di nuovo solo
  s2.u('u2', G, { 'players/p2': null });
  yes(s2.update('u1', '/', closeAlone), 'host di nuovo solo');
  // un giocatore che non e' host non cancella meta nemmeno restando solo lui
  const s3 = new Sim(); lobby(s3, ['Anna', 'Bea']);
  s3.u('u1', G, { 'meta/hostSeat': 'p2', 'players/p1': null });
  no(s3.update('u1', '/', { [`games/${C}/meta`]: null }), 'ex host cancella meta');
  yes(s3.update('u2', '/', { [`games/${C}/players/p2`]: null, [`games/${C}/meta`]: null, [`index/${C}`]: null }), 'nuovo host da solo chiude la sala');
});

test('in sala l\'host libera i posti di chi e\' assente da piu\' di 45 s (anche l\'ex host)', () => {
  const s = new Sim(); lobby(s, ['Anna', 'Bea', 'Carlo']);
  s.u('u1', `${G}/players/p1`, { connected: false, disconnectedAt: TS });
  s.tick(46000);
  s.u('u2', `${G}/meta`, { hostSeat: 'p2' });
  no(s.update('u3', G, { 'players/p1': null }), 'un giocatore normale rimuove l\'assente');
  yes(s.update('u2', G, { 'players/p1': null }), 'il nuovo host rimuove l\'ex host assente');
  s.u('u2', G, { 'players/p1': null });
  yes(s.write('u4', `${G}/players/p1`, seatObj('u4', 'Dino')), 'il posto liberato si puo\' occupare (limite di 7 non bloccato da fantasmi)');
});

test('cancellare un posto gia\' inesistente non genera rifiuti (solo per l\'host)', () => {
  const s = new Sim(); lobby(s, ['Anna', 'Bea']);
  yes(s.update('u1', G, { 'players/p5': null }), 'host cancella un posto che non esiste');
  no(s.update('u2', G, { 'players/p5': null }), 'un giocatore cancella un posto che non esiste');
  no(s.update('u1', G, { 'players/p2': null }), 'host cancella un posto collegato');
  no(s.update(null, G, { 'players/p5': null }), 'senza login');
});

test('risposte e voti: anche quando si aprono, restano riservati a chi ha fatto il login', () => {
  const s = new Sim(); lobby(s); startRound(s); answerAll(s); setPhase(s, 'summary');
  yes(s.read('u3', `${G}/answers`), 'giocatore loggato legge le risposte al riepilogo');
  no(s.read(null, `${G}/answers`), 'utente non loggato legge le risposte al riepilogo');
  setPhase(s, 'vote');
  s.u('u2', G, { 'votes/p2': 'p3', 'voted/p2': true }); s.u('u3', G, { 'votes/p3': 'p2', 'voted/p3': true }); s.u('u1', G, { 'votes/p1': 'p2', 'voted/p1': true });
  s.u('u1', G, { 'meta/phase': 'result', result: { impostor: 'p2', round: 1 } });
  yes(s.read('u3', `${G}/votes`), 'giocatore loggato legge i voti al verdetto');
  no(s.read(null, `${G}/votes`), 'utente non loggato legge i voti al verdetto');
  no(s.read(null, `${G}/answers`), 'utente non loggato legge le risposte al verdetto');
  no(s.read(null, `${G}/result`), 'utente non loggato legge il verdetto');
});
