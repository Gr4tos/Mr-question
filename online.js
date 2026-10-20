// Party online: ogni giocatore sul proprio telefono, Firebase Realtime Database + accesso anonimo.
// Caricato solo quando si tocca "Party online" (import dinamico da app.js): la modalita'
// "un solo telefono" non lo usa mai. Dati e regole: vedi database.rules.json e CLAUDE.md.
import { initializeApp } from './assets/vendor/firebase/firebase-app.js';
import { getAuth, signInAnonymously } from './assets/vendor/firebase/firebase-auth.js';
import { getDatabase, ref, get, set, update, onValue, onDisconnect, serverTimestamp, query, orderByValue, endAt, limitToFirst } from './assets/vendor/firebase/firebase-database.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD9TyEpftjGp5NCcpPm9BWt5Bn_ZfkO-jY',
  authDomain: 'mr-question-c67d1.firebaseapp.com',
  databaseURL: 'https://mr-question-c67d1-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'mr-question-c67d1',
  storageBucket: 'mr-question-c67d1.firebasestorage.app',
  messagingSenderId: '952091692304',
  appId: '1:952091692304:web:ce18c7cb203fa6b402e995'
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24 lettere, senza I e O
const CODE_RE = /^[A-HJ-NP-Z]{5}$/;
const SEATS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const MIN_PLAYERS = 3;
const GRACE = 45000;          // un giocatore e' "assente" solo dopo 45 s di disconnessione continua
const MARGIN = 1000;          // margine sull'orologio prima di tentare azioni che le regole verificano
const DAY = 86400000;

const $ = id => document.getElementById(id);
const M = window.MRQ;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const isDenied = e => e && (e.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(e.message || ''));

let app = null, auth = null, db = null, uid = null, offset = 0;
let S = null;                 // sessione: { code, seat, name }
let D = {};                   // dati ricevuti dai listener
let unsubs = [], gated = {}, gatedRetry = {}, hostUnsub = null;
let ticker = null, renderQueued = false, hostRetry = 0, fewTimer = null, fewDeadline = null, fewLow = false;
let connected = true, busy = false, claiming = false, leaving = false, lastFail = 0;
let curScreen = null;
const ui = { vote: null, optKey: '', turnRound: null };
// fascicolo del turno privato: la domanda entra nella pagina solo a scheda aperta (vedi createSheet in app.js)
const sheetOn = M.createSheet({ root: $('onSheet'), cover: $('onCover'), inside: $('onAnswerArea'), handle: $('onHandle'), peekBtn: $('onOpenSheet'), sendBtn: $('onSend'), template: $('onAnswerTemplate'),
  canOpen: () => !!(D && D.priv && D.meta && D.priv.round === D.meta.round),
  fill: box => {
    $('onQuestion').textContent = D.priv.question;
    box.querySelector('.sheet-who').textContent = 'FASCICOLO DI ' + String(S.name || '').toLocaleUpperCase('it');
    const inp = $('onAnswer'); inp.addEventListener('input', () => say('onAnswerError', '')); inp.addEventListener('keydown', e => { if (e.key === 'Enter') sendAnswer(); });
  } });

const now = () => Date.now() + offset;
const base = () => `games/${S.code}`;

// ---------- collegamento ----------
async function ensureFirebase() {
  if (uid) return;
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getDatabase(app);
    onValue(ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  }
  await withTimeout(auth.authStateReady(), 10000);
  if (!auth.currentUser) await withTimeout(signInAnonymously(auth), 12000);
  uid = auth.currentUser.uid;
}

export async function startOnline() {
  await ensureFirebase();
  say('onMenuError', '');
  $('onName').value = localStorage.getItem('mq_oname') || '';
  $('onCode').value = '';
  await showResume();
  curScreen = null;
  show('onMenu');
}

function genCode() {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return Array.from(b, x => ALPHABET[x % ALPHABET.length]).join('');
}

// ---------- sessione salvata ----------
const loadSession = () => { try { return JSON.parse(localStorage.getItem('mq_online') || 'null'); } catch { return null; } };
const saveSession = () => { try { localStorage.setItem('mq_online', JSON.stringify(S)); } catch { /* ignora */ } };
const clearSession = () => { try { localStorage.removeItem('mq_online'); } catch { /* ignora */ } };

async function showResume() {
  const btn = $('onResume');
  btn.classList.add('hidden');
  const s = loadSession();
  if (!s || !CODE_RE.test(s.code || '')) { clearSession(); return; }
  try {
    const meta = await withTimeout(get(ref(db, `games/${s.code}/meta`)), 6000);
    if (!meta.exists()) { clearSession(); return; }
  } catch { return; }
  btn.textContent = `Rientra nella partita ${s.code} come ${s.name}`;
  btn.classList.remove('hidden');
}

// ---------- messaggi e schermate ----------
function say(id, msg) { const e = $(id); if (!e) return; e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
function show(name) { if (curScreen !== name) { curScreen = name; M.showScreen(name); } }

// ---------- crea / entra ----------
function readName() {
  const name = $('onName').value.trim().replace(/\s+/g, ' ');
  if (!name) { say('onMenuError', 'Scrivi il tuo nome.'); return null; }
  try { localStorage.setItem('mq_oname', name); } catch { /* ignora */ }
  return name;
}

function lockMenu(on) { ['onCreate', 'onJoin', 'onResume'].forEach(id => { $(id).disabled = on; }); }

async function createGame() {
  const name = readName(); if (!name) return;
  say('onMenuError', ''); lockMenu(true);
  try {
    for (let i = 0; i < 6; i++) {
      const code = genCode();
      try {
        await withTimeout(update(ref(db), {
          [`games/${code}`]: {
            meta: { hostSeat: 'p1', phase: 'lobby', round: 0, createdAt: serverTimestamp() },
            players: { p1: { owner: uid, name, connected: true, joinedAt: serverTimestamp() } }
          },
          [`index/${code}`]: serverTimestamp()
        }), 10000);
        enter(code, 'p1', name);
        cleanupStale();
        return;
      } catch (e) { if (!isDenied(e)) throw e; }
    }
    console.warn('Creazione partita rifiutata dal database (regole non pubblicate?)');
    say('onMenuError', 'Non riesco a creare la partita. Riprova tra poco.');
  } catch (e) {
    console.warn(e);
    say('onMenuError', 'Non riesco a collegarmi. Controlla la connessione e riprova.');
  } finally { lockMenu(false); }
}

async function joinFromForm() {
  const name = readName(); if (!name) return;
  const code = $('onCode').value.trim().toUpperCase();
  if (!CODE_RE.test(code)) { say('onMenuError', 'Il codice ha 5 lettere (senza I e O).'); return; }
  await join(code, name);
}

async function join(code, name) {
  say('onMenuError', ''); lockMenu(true);
  try {
    const found = await findSeat(code, name);
    enter(code, found.seat, found.name);
  } catch (e) {
    const msgs = {
      notfound: 'Non trovo nessuna partita con questo codice.',
      started: 'La partita è già iniziata. Per rientrare usa lo stesso nome di prima.',
      full: 'La partita è piena (7 giocatori).',
      taken: 'Questo nome è già in partita e risulta collegato. Se sei tu, riprova tra poco; altrimenti scegli un altro nome.'
    };
    if (e && msgs[e.kind]) say('onMenuError', msgs[e.kind]);
    else if (e && e.kind === 'wait') say('onMenuError', `Quel giocatore risulta scollegato da poco. Se sei tu, riprova tra ${e.secs} secondi.`);
    else if (isDenied(e)) say('onMenuError', 'Non riesco a entrare: nome già usato o posti esauriti. Riprova.');
    else { console.warn(e); say('onMenuError', 'Non riesco a collegarmi. Controlla la connessione e riprova.'); }
  } finally { lockMenu(false); }
}

async function findSeat(code, name) {
  const B = `games/${code}`;
  const meta = await withTimeout(get(ref(db, `${B}/meta`)), 10000);
  if (!meta.exists()) throw { kind: 'notfound' };
  const players = (await withTimeout(get(ref(db, `${B}/players`)), 10000)).val() || {};
  const mine = SEATS.find(s => players[s] && players[s].owner === uid);
  if (mine) return { seat: mine, name: players[mine].name };
  const lname = name.toLowerCase();
  const same = SEATS.find(s => players[s] && players[s].name.toLowerCase() === lname);
  if (same) {
    const p = players[same];
    if (!isAbsent(p, GRACE + MARGIN)) {
      if (p.connected === false && typeof p.disconnectedAt === 'number') throw { kind: 'wait', secs: Math.max(1, Math.ceil((GRACE + MARGIN - (now() - p.disconnectedAt)) / 1000)) };
      throw { kind: 'taken' };
    }
    await withTimeout(update(ref(db, `${B}/players/${same}`), { owner: uid, connected: true, disconnectedAt: null }), 10000);
    return { seat: same, name: p.name };
  }
  if (meta.val().phase !== 'lobby') throw { kind: 'started' };
  const free = SEATS.filter(s => !players[s]);
  if (!free.length) throw { kind: 'full' };
  for (const s of free) {
    try {
      await withTimeout(set(ref(db, `${B}/players/${s}`), { owner: uid, name, connected: true, joinedAt: serverTimestamp() }), 10000);
      return { seat: s, name };
    } catch (e) { if (!isDenied(e)) throw e; }
  }
  throw { kind: 'full' };
}

// ---------- ingresso nella partita ----------
function enter(code, seat, name) {
  S = { code, seat, name };
  saveSession();
  M.setMode('online');
  D = {}; curScreen = null; busy = false; claiming = false; leaving = false; lastFail = 0;
  ui.vote = null; ui.optKey = ''; ui.turnRound = null;
  const B = base();
  const on = (path, key) => unsubs.push(onValue(ref(db, path), snap => { D[key] = snap.val(); scheduleRender(); },
    err => console.warn(`lettura ${path}:`, err.message)));
  on(`${B}/meta`, 'meta'); on(`${B}/players`, 'players'); on(`${B}/seats`, 'seats');
  on(`${B}/answered`, 'answered'); on(`${B}/voted`, 'voted');
  on(`${B}/private/${seat}`, 'priv'); on(`${B}/answers/${seat}`, 'myAnswer'); on(`${B}/votes/${seat}`, 'myVote');
  unsubs.push(onValue(ref(db, '.info/connected'), snap => {
    connected = snap.val() === true;
    if (connected) registerPresence();
    scheduleRender();
  }));
  ticker = setInterval(scheduleRender, 4000);
}

function registerPresence() {
  if (!S) return;
  const me = ref(db, `${base()}/players/${S.seat}`);
  onDisconnect(me).update({ connected: false, disconnectedAt: serverTimestamp() })
    .then(() => update(me, { connected: true, disconnectedAt: null }))
    .catch(e => console.warn('presenza', e.message));
}

function detach() {
  unsubs.forEach(u => u()); unsubs = [];
  Object.values(gated).forEach(u => u()); gated = {}; gatedRetry = {};
  if (hostUnsub) { hostUnsub(); hostUnsub = null; }
  if (ticker) { clearInterval(ticker); ticker = null; }
  stopFew();
}

function resetLocal(msg) {
  detach(); S = null; D = {}; curScreen = null; leaving = false;
  $('netBanner').classList.add('hidden');
  M.setMode('local');
  if (msg) { M.showScreen('onMenu'); say('onMenuError', msg); curScreen = 'onMenu'; } else { M.showScreen('menu'); }
}

function endSession(msg) { clearSession(); resetLocal(msg); }

async function leaveOnline() {
  const s = S;
  if (!s) { M.setMode('local'); M.showScreen('menu'); return; }
  leaving = true;
  const B = base(), me = `${B}/players/${s.seat}`;
  const lobby = D.meta && D.meta.phase === 'lobby';
  const patch = {};
  let handed = false;
  if (isHost()) {
    const cand = nextHostCandidate();
    if (cand) { patch[`${B}/meta/hostSeat`] = cand; handed = true; }
  }
  if (lobby && isHost() && seatsOf().length === 1) {
    // ultimo giocatore in sala: la partita non ha piu' ragione di esistere
    patch[me] = null; patch[`${B}/meta`] = null; patch[`index/${s.code}`] = null;
  } else if (lobby && (!isHost() || handed)) patch[me] = null;
  else { patch[`${me}/connected`] = false; patch[`${me}/disconnectedAt`] = serverTimestamp(); }
  clearSession();
  detach();   // niente ascoltatori attivi mentre si cancellano posto e partita
  try { await withTimeout(onDisconnect(ref(db, me)).cancel(), 2500); } catch { /* ignora */ }
  try { await withTimeout(update(ref(db), patch), 3000); } catch (e) { console.warn('uscita', e.message); }
  resetLocal();
}
M.leaveOnline = leaveOnline;

// ---------- pulizia partite ferme da 24 ore (senza Cloud Functions) ----------
async function cleanupStale() {
  try {
    const snap = await withTimeout(get(query(ref(db, 'index'), orderByValue(), endAt(now() - DAY - 5000), limitToFirst(5))), 8000);
    const codes = [];
    snap.forEach(ch => { codes.push(ch.key); });
    for (const c of codes) {
      try { await update(ref(db), { [`games/${c}`]: null, [`index/${c}`]: null }); } catch (e) { console.warn('pulizia', c, e.message); }
    }
  } catch (e) { console.warn('pulizia', e.message); }
}

// ---------- ruoli e presenze ----------
const isHost = () => !!(S && D.meta && D.meta.hostSeat === S.seat);
const seatsOf = () => SEATS.filter(s => D.players && D.players[s]);
const connectedSeats = () => seatsOf().filter(s => D.players[s].connected === true);
const roundSeats = () => SEATS.filter(s => D.seats && D.seats[s]);
const roundConnected = () => roundSeats().filter(s => D.players[s] && D.players[s].connected === true);

// ---------- meno di 3 collegati durante il round ----------
// La scadenza (45 s) parte da quando i collegati sono scesi sotto 3: cioe' dalla (N-2)-esima disconnessione tra i posti del round.
function computeFewDeadline() {
  if (!D.meta || D.meta.phase === 'lobby' || D.meta.phase === 'result') return null;
  const seats = roundSeats();
  if (seats.length < MIN_PLAYERS || roundConnected().length >= MIN_PLAYERS) return null;
  const times = seats.filter(s => !(D.players[s] && D.players[s].connected === true))
    .map(s => (D.players[s] && typeof D.players[s].disconnectedAt === 'number') ? D.players[s].disconnectedAt : now())
    .sort((a, b) => a - b);
  return times[seats.length - MIN_PLAYERS] + GRACE;
}
function paintFew() {
  if (fewDeadline == null) return;
  $('fewCount').textContent = `${Math.max(0, Math.ceil((fewDeadline - now()) / 1000))} s`;
}
const FEW_TEXT = 'Sono rimasti meno di 3 sospettati collegati. Se nessuno rientra entro 45 secondi, si torna in sala d’attesa.';
const FEW_TEXT_RESULT = 'Sono rimasti meno di 3 sospettati collegati. Per continuare servono almeno 3 collegati.';
function updateFew() {
  const ph = D.meta && D.meta.phase;
  fewLow = ph === 'result' && roundSeats().length >= MIN_PLAYERS && roundConnected().length < MIN_PLAYERS;
  fewDeadline = computeFewDeadline();
  $('fewBanner').classList.toggle('hidden', fewDeadline == null && !fewLow);
  $('fewText').textContent = fewLow ? FEW_TEXT_RESULT : FEW_TEXT;
  $('fewCount').classList.toggle('hidden', fewLow);
  if (fewLow) { if (fewTimer) { clearInterval(fewTimer); fewTimer = null; } return; }
  if (fewDeadline == null) { stopFew(); return; }
  paintFew();
  if (!fewTimer) fewTimer = setInterval(() => {
    paintFew();
    if (fewDeadline != null && now() > fewDeadline + MARGIN) scheduleRender();
  }, 1000);
}
function stopFew() {
  if (fewTimer) { clearInterval(fewTimer); fewTimer = null; }
  fewDeadline = null; fewLow = false;
  const b = document.getElementById('fewBanner'); if (b) b.classList.add('hidden');
}
const hostAwayMsg = () => { const hp = D.players[D.meta.hostSeat]; return hp && hp.connected === false && !isHost() ? 'L’host è scollegato. Se non rientra a breve, un altro giocatore prenderà il suo posto.' : ''; };
const nameOf = s => (D.players && D.players[s] && D.players[s].name) || s;
function isAbsent(p, grace = GRACE) { return !!p && p.connected === false && typeof p.disconnectedAt === 'number' && now() - p.disconnectedAt > grace; }
const byJoin = (a, b) => ((D.players[a].joinedAt || 0) - (D.players[b].joinedAt || 0)) || (SEATS.indexOf(a) - SEATS.indexOf(b));
function nextHostCandidate() {
  return seatsOf().filter(s => s !== S.seat && D.players[s].connected === true).sort(byJoin)[0] || null;
}

// ---------- listener che dipendono dalla fase (le regole li aprono solo al momento giusto) ----------
function syncGated() {
  const ph = D.meta && D.meta.phase;
  const open = ['summary', 'vote', 'result'].includes(ph);
  const want = { reveal: open, answers: open, votes: ph === 'result', result: ph === 'result' };
  const wantedNow = k => { const p = D.meta && D.meta.phase; return (k === 'votes' || k === 'result') ? p === 'result' : ['summary', 'vote', 'result'].includes(p); };
  for (const k of Object.keys(want)) {
    if (want[k] && !gated[k] && !(gatedRetry[k] > Date.now())) {
      const mine = onValue(ref(db, `${base()}/${k}`), snap => { D[k] = snap.val(); scheduleRender(); },
        err => {
          // Il database annulla da solo l'ascoltatore quando la fase cambia e il permesso di lettura sparisce:
          // non e' un errore, si buttano i dati vecchi. Un ascoltatore vecchio non deve staccarne uno nuovo.
          if (gated[k] === mine) { delete gated[k]; D[k] = null; }
          // a volte l'annullamento arriva un istante prima dell'evento che cambia la fase: si riprova presto
          // e si avvisa solo se, dopo un po', quel dato serve ancora e non si riesce a leggerlo
          gatedRetry[k] = Date.now() + 1500;
          setTimeout(scheduleRender, 1600);
          setTimeout(() => { if (S && wantedNow(k) && !gated[k]) console.warn(`lettura ${k}:`, err.message); }, 4000);
        });
      gated[k] = mine;
    } else if (!want[k]) {
      if (gated[k]) { gated[k](); delete gated[k]; }
      if (D[k] != null) D[k] = null;
    }
  }
  if (isHost() && !hostUnsub && !(hostRetry > Date.now())) {
    const mine = onValue(ref(db, `${base()}/hostOnly`), snap => { D.hostOnly = snap.val(); scheduleRender(); },
      err => {
        if (hostUnsub === mine) { hostUnsub = null; D.hostOnly = null; }
        if (isHost()) { console.warn('lettura hostOnly:', err.message); hostRetry = Date.now() + 3000; scheduleRender(); }
      });
    hostUnsub = mine;
  } else if (!isHost() && hostUnsub) { hostUnsub(); hostUnsub = null; D.hostOnly = null; }
}

// ---------- disegno ----------
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; try { render(); } catch (e) { console.error(e); } }, 0);
}

function render() {
  if (!S || leaving) return;
  $('netBanner').classList.toggle('hidden', connected);
  if (D.meta === undefined || D.players === undefined) return;
  if (D.meta === null) { endSession('La partita non esiste più.'); return; }
  const me = D.players && D.players[S.seat];
  if (!me) { endSession('Sei stato rimosso dalla partita.'); return; }
  if (me.owner !== uid) { endSession('Il tuo posto è stato ripreso da un altro telefono.'); return; }
  syncGated();
  updateFew();
  if (D.meta.phase !== 'vote') { ui.vote = null; ui.optKey = ''; }
  switch (D.meta.phase) {
    case 'lobby': renderLobby(); break;
    case 'answering': renderTurn(); break;
    case 'summary': renderSummary(); break;
    case 'vote': renderVote(); break;
    case 'result': renderResult(); break;
    default: break;
  }
  maybeClaimHost();
  hostDuties();
}

const seatNum = s => SEATS.indexOf(s) + 1;

function renderLobby() {
  show('onLobby');
  $('lobbyCode').textContent = S.code;
  const list = $('lobbyPlayers'); list.textContent = '';
  const seats = seatsOf();
  // la misura dei riquadri dipende da quanti ne vengono mostrati (giocatori + la tessera "In arrivo"), non dai giocatori
  list.classList.toggle('compact', seats.length + (seats.length < SEATS.length ? 1 : 0) >= 5);
  seats.forEach(s => {
    const p = D.players[s];
    const tags = [];
    if (s === D.meta.hostSeat) tags.push('HOST');
    if (s === S.seat) tags.push('TU');
    if (isAbsent(p)) tags.push('ASSENTE');
    list.append(M.buildTile({ n: seatNum(s), name: p.name, off: !p.connected, tag: tags.join(' · '), cls: 'player-row' + (s === S.seat ? ' me' : '') }));
  });
  if (seats.length < SEATS.length) {
    const empty = el('div', 'tile empty');
    empty.append(M.avatarSvg(0, 'av-empty'), el('div', 'tile-name', 'In arrivo…'));
    list.append(empty);
  }
  // contano solo i giocatori COLLEGATI adesso: chi e' appena caduto non fa numero
  const missing = Math.max(0, MIN_PLAYERS - connectedSeats().length);
  const host = isHost();
  const start = $('onStart');
  start.classList.toggle('hidden', !(host && missing === 0));
  start.disabled = false;
  const need = missing === 1 ? 'almeno un altro sospettato' : `altri ${missing} sospettati`;
  $('lobbyHint').textContent = host
    ? (missing === 0 ? '' : `In attesa di ${need}`)
    : (hostAwayMsg() || (missing === 0 ? 'In attesa che l’host apra le indagini…' : `In attesa dell’host. ${missing === 1 ? 'Serve' : 'Servono'} ${need}.`));
  const n = D.meta.notice;
  say('lobbyNotice', n && n.code === 'few' ? 'Giocatori insufficienti: si torna alla sala d’attesa.' : '');
}

function waitTile(s, doneMap, pendingText) {
  const p = D.players[s] || { name: s, connected: false };
  const done = !!(doneMap && doneMap[s]);
  const absent = isAbsent(p);
  const tag = absent ? 'ASSENTE' : (done ? '' : pendingText);
  return M.buildTile({ n: seatNum(s), name: s === S.seat ? `${p.name} (tu)` : p.name, off: !p.connected, ok: done, tag, cls: 'wait-row' + (done ? ' done' : ' pending') + (s === S.seat ? ' me' : '') });
}

function missingAbsent(doneMap) {
  const missing = roundSeats().filter(s => !(doneMap && doneMap[s]));
  return missing.length && missing.every(s => isAbsent(D.players[s])) ? missing : null;
}

function renderTurn() {
  show('onTurn');
  const round = D.meta.round;
  const seats = roundSeats();
  const inRound = !!(D.seats && D.seats[S.seat]);
  const done = seats.filter(s => D.answered && D.answered[s]).length;
  $('topLabel').textContent = `ROUND ${round}`;
  $('onMe').textContent = S.name;
  M.setSeat($('onAvatar'), seatNum(S.seat));
  $('onAvatar').classList.toggle('hidden', !inRound);
  const n = D.meta.notice;
  say('onNotice', n && n.code === 'vanished' && n.round === round ? 'Un sospettato si è dileguato: si riapre il caso.' : '');
  if (ui.turnRound !== round) { ui.turnRound = round; sheetOn.reset(); }
  const ready = D.priv && D.priv.round === round;
  const answered = !!(D.answered && D.answered[S.seat]);
  const showAnswer = inRound && ready && !answered;
  const showWait = inRound && answered;
  $('onAnswerView').classList.toggle('hidden', showWait);
  if (!showAnswer) sheetOn.reset();
  $('onHandle').disabled = !ready;
  $('onSheet').classList.toggle('hidden', !inRound);
  $('onSpectatorCard').classList.toggle('hidden', inRound);
  $('onWaitArea').classList.toggle('hidden', !showWait);
  $('onMe').classList.toggle('hidden', !inRound);
  if (showWait) {
    $('onMyAnswer').textContent = D.myAnswer == null ? '…' : D.myAnswer;
    const list = $('onWaitList'); list.textContent = '';
    list.classList.toggle('compact', seats.length >= 5);
    seats.forEach(s => list.append(waitTile(s, D.answered, 'DEVE RISPONDERE')));
    $('onWaitSummary').textContent = `${done} su ${seats.length} ${done === 1 ? 'ha' : 'hanno'} messo a verbale`;
    const miss = isHost() && D.hostOnly ? missingAbsent(D.answered) : null;
    $('onSkipAbsent').classList.toggle('hidden', !miss);
    $('onWaitHint').textContent = hostAwayMsg();
  }
}

function renderSummary() {
  show('onSummary');
  $('onCommon').textContent = D.reveal ? D.reveal.common : '…';
  const list = $('onAnswers'); list.textContent = '';
  list.classList.toggle('compact', roundSeats().length >= 6);
  roundSeats().forEach(s => {
    const row = el('div', 'answer-row');
    row.append(M.avatarSvg(seatNum(s)), el('span', 'answer-name', nameOf(s)), el('strong', null, D.answers && D.answers[s] != null ? D.answers[s] : '…'));
    list.append(row);
  });
  const host = isHost();
  $('onToVote').classList.toggle('hidden', !(host && fewDeadline == null));
  $('onSummaryHint').textContent = host ? '' : (hostAwayMsg() || 'In attesa che l’host apra le votazioni…');
}

function renderVote() {
  show('onVote');
  const seats = roundSeats();
  const inRound = !!(D.seats && D.seats[S.seat]);
  const voted = !!(D.voted && D.voted[S.seat]);
  const options = $('onVoteOptions');
  const targets = seats.filter(s => s !== S.seat);
  const key = targets.join(',');
  if (inRound && !voted) {
    if (ui.optKey !== key) {
      ui.optKey = key; options.textContent = '';
      options.classList.toggle('compact', targets.length >= 5);
      if (ui.vote && !targets.includes(ui.vote)) ui.vote = null;
      targets.forEach(s => {
        const b = M.buildTile({ n: seatNum(s), name: nameOf(s), button: true, cls: 'vote-option' }); b.dataset.seat = s;
        b.addEventListener('click', () => { ui.vote = s; paintVote(); });
        options.append(b);
      });
    }
    paintVote();
  }
  options.classList.toggle('hidden', !(inRound && !voted));
  $('onSign').classList.toggle('hidden', !(inRound && !voted && ui.vote));
  $('onVoteSub').textContent = inRound ? 'Tocca il sospettato da accusare. Il voto è segreto.' : 'Questo round è in corso senza di te. Guarda chi ha già votato.';
  $('onVoteSub').classList.toggle('hidden', inRound && voted);
  const wait = $('onVoteWait');
  wait.classList.toggle('hidden', inRound && !voted);
  if (!(inRound && !voted)) {
    const list = $('onVoteWaitList'); list.textContent = '';
    list.classList.toggle('compact', seats.length >= 5);
    seats.forEach(s => list.append(waitTile(s, D.voted, 'DEVE VOTARE')));
    $('onSkipAbsentV').classList.toggle('hidden', !(isHost() && D.hostOnly && missingAbsent(D.voted)));
    $('onVoteHint').textContent = hostAwayMsg();
  }
}
function paintVote() {
  $('onVoteOptions').querySelectorAll('.vote-option').forEach(b => b.classList.toggle('sel', b.dataset.seat === ui.vote));
  if (ui.vote) $('onSignText').textContent = `Firma l’accusa a ${nameOf(ui.vote)}`;
  $('onSign').classList.toggle('hidden', !ui.vote);
}

function tally() {
  const counts = {};
  Object.values(D.votes || {}).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(counts));
  const tops = Object.keys(counts).filter(s => counts[s] === max && max > 0);
  return { counts, accused: tops.length === 1 ? tops[0] : null };
}

function renderResult() {
  show('onResult');
  const host = isHost();
  $('onContinue').classList.toggle('hidden', !(host && !fewLow));
  $('onNewGame').classList.toggle('hidden', !host);
  $('onResultHint').textContent = host ? '' : (hostAwayMsg() || 'In attesa dell’host…');
  if (!D.result || D.result.round !== D.meta.round || !D.votes || !D.seats) {
    // dati del verdetto non ancora arrivati: mai mostrare quelli del round precedente
    $('onResultIcon').textContent = '…'; $('onResultIcon').classList.remove('is-correct', 'is-wrong');
    $('onResultEyebrow').textContent = 'VERDETTO'; $('onResultTitle').textContent = '…'; $('onResultText').textContent = '';
    $('onImpostor').textContent = '…'; $('onVotesList').textContent = '';
    return;
  }
  const imp = D.result.impostor;
  const { counts, accused } = tally();
  const caught = accused === imp;
  $('onResultIcon').textContent = caught ? '✓' : '×';
  $('onResultIcon').classList.toggle('is-correct', caught);
  $('onResultIcon').classList.toggle('is-wrong', !caught);
  $('onResultEyebrow').textContent = caught ? 'ACCUSA CORRETTA' : 'ACCUSA SBAGLIATA';
  $('onResultTitle').textContent = caught ? 'Beccato!' : 'Non questa volta.';
  M.setSeat($('onRevealAvatar'), seatNum(imp));
  $('onResultText').textContent = caught ? `Avete individuato ${nameOf(imp)}.`
    : accused ? `Avete accusato ${nameOf(accused)}. L’impostore era ${nameOf(imp)}.`
      : 'Pareggio nel voto: l’impostore si salva.';
  $('onImpostor').textContent = nameOf(imp);
  const list = $('onVotesList'); list.textContent = '';
  // solo chi ha ricevuto voti, dal più votato; i più votati in giallo
  const shown = Object.keys(counts).filter(s => counts[s] > 0);
  shown.sort((a, b) => counts[b] - counts[a] || SEATS.indexOf(a) - SEATS.indexOf(b));
  const top = Math.max(0, ...shown.map(s => counts[s]));
  list.classList.toggle('compact', shown.length >= 6 || roundSeats().length >= 5);
  $('onRevealAvatar').classList.toggle('small', shown.length >= 5);
  shown.forEach(s => {
    const row = el('div', 'vote-row' + (counts[s] === top ? ' top' : ''));
    row.append(M.avatarSvg(seatNum(s)), el('span', 'answer-name', nameOf(s)), el('span', 'vote-count', `${counts[s]} ${counts[s] === 1 ? 'VOTO' : 'VOTI'}`));
    list.append(row);
  });
}

// ---------- azioni del giocatore ----------
async function sendAnswer() {
  const inp = $('onAnswer'); if (!inp) return;
  const val = inp.value.trim();
  if (val === '' || !Number.isFinite(Number(val))) { say('onAnswerError', 'Serve una risposta numerica.'); return; }
  if (val.length > 24) { say('onAnswerError', 'Numero troppo lungo.'); return; }
  say('onAnswerError', '');
  const btn = $('onSend'); btn.disabled = true;
  try {
    await withTimeout(update(ref(db), { [`${base()}/answers/${S.seat}`]: val, [`${base()}/answered/${S.seat}`]: true }), 10000);
    sheetOn.reset();
  } catch (e) {
    console.warn(e); say('onAnswerError', 'Non sono riuscito a mettere a verbale. Riprova.');
  } finally { btn.disabled = false; }
}

async function signVote() {
  if (!ui.vote) return;
  say('onVoteError', '');
  const btn = $('onSign'); btn.disabled = true;
  try {
    await withTimeout(update(ref(db), { [`${base()}/votes/${S.seat}`]: ui.vote, [`${base()}/voted/${S.seat}`]: true }), 10000);
  } catch (e) {
    console.warn(e); say('onVoteError', 'Non sono riuscito a firmare l’accusa. Riprova.');
  } finally { btn.disabled = false; }
}

// ---------- azioni dell'host ----------
async function hostRun(fn) {
  if (busy || !isHost()) return;
  busy = true;
  try { await fn(); lastFail = 0; }
  catch (e) { console.warn('azione host', e.message); lastFail = Date.now(); }
  finally { busy = false; scheduleRender(); }
}

function hostDuties() {
  if (!isHost() || busy || Date.now() - lastFail < 5000) return;
  const ph = D.meta.phase, seats = roundSeats();
  if (ph !== 'lobby' && fewDeadline != null && now() > fewDeadline + MARGIN) {
    hostRun(() => toLobbyNow({ code: 'few', round: D.meta.round || 0 }));
  } else if (ph === 'lobby') {
    // in sala i posti di chi e' assente da piu' di 45 s si liberano (anche quello di un ex host)
    const gone = seatsOf().filter(x => x !== S.seat && isAbsent(D.players[x], GRACE + MARGIN));
    if (gone.length) hostRun(() => update(ref(db), Object.fromEntries(gone.map(x => [`${base()}/players/${x}`, null]))));
  } else if (ph === 'answering' && seats.length && seats.every(s => D.answered && D.answered[s])) {
    hostRun(() => setPhase('summary'));
  } else if (ph === 'vote' && seats.length && seats.every(s => D.voted && D.voted[s]) && D.hostOnly) {
    hostRun(() => update(ref(db), {
      [`${base()}/meta/phase`]: 'result',
      [`${base()}/result`]: { impostor: D.hostOnly.impostor, round: D.meta.round },
      [`index/${S.code}`]: serverTimestamp()
    }));
  }
}

const setPhase = ph => update(ref(db), { [`${base()}/meta/phase`]: ph, [`index/${S.code}`]: serverTimestamp() });

function startRound(notice) {
  return hostRun(async () => {
    const B = base();
    // un round parte solo con giocatori COLLEGATI adesso (chi e' appena caduto resta fuori e rientra al round dopo)
    const parts = connectedSeats();
    if (parts.length < MIN_PLAYERS) {
      // dalla sala: non si fa niente (il messaggio "In attesa di..." e' gia' sullo schermo); da un round finito: si torna in sala
      if (D.meta.phase !== 'lobby') await toLobbyNow({ code: 'few', round: D.meta.round || 0 });
      return;
    }
    const q = M.pickQuestion();
    if (!q) throw new Error('nessuna domanda disponibile');
    const prev = D.hostOnly && D.hostOnly.impostor;
    let pool = parts.filter(s => s !== prev); if (!pool.length) pool = parts;
    const imp = pool[Math.floor(Math.random() * pool.length)];
    const round = (D.meta.round || 0) + 1;
    const priv = {};
    parts.forEach(s => { priv[s] = { question: s === imp ? q.impostor : q.common, round }; });
    // 1) azzeramento di risposte e voti + nuove domande private, in un unico update
    await update(ref(db), {
      [`${B}/answered`]: null, [`${B}/answers`]: null, [`${B}/voted`]: null, [`${B}/votes`]: null, [`${B}/result`]: null,
      [`${B}/seats`]: Object.fromEntries(parts.map(s => [s, true])),
      [`${B}/private`]: priv,
      [`${B}/reveal`]: { common: q.common, round },
      [`${B}/hostOnly`]: prev ? { impostor: imp, prev } : { impostor: imp },
      [`${B}/meta/notice`]: notice ? { code: notice.code, round } : null
    });
    // 2) solo dopo, il cambio di fase
    await update(ref(db), { [`${B}/meta/phase`]: 'answering', [`${B}/meta/round`]: round, [`index/${S.code}`]: serverTimestamp() });
  });
}

async function toLobbyNow(notice) {
  const B = base();
  const patch = {
    [`${B}/answered`]: null, [`${B}/answers`]: null, [`${B}/voted`]: null, [`${B}/votes`]: null, [`${B}/result`]: null,
    [`${B}/seats`]: null, [`${B}/private`]: null, [`${B}/reveal`]: null, [`${B}/hostOnly`]: null,
    [`${B}/meta/phase`]: 'lobby', [`${B}/meta/round`]: 0, [`${B}/meta/notice`]: notice || null,
    [`index/${S.code}`]: serverTimestamp()
  };
  seatsOf().forEach(s => { if (isAbsent(D.players[s], GRACE + MARGIN)) patch[`${B}/players/${s}`] = null; });
  await update(ref(db), patch);
}
const toLobby = notice => hostRun(() => toLobbyNow(notice));

function excludeAbsent(doneMap) {
  const missing = missingAbsent(doneMap);
  // un nuovo host non sa ancora chi e' l'impostore finche' non legge hostOnly: senza quel dato non si esclude nessuno
  if (!missing || !D.hostOnly) return;
  const remaining = roundSeats().filter(s => !missing.includes(s));
  if (remaining.length < MIN_PLAYERS) { toLobby({ code: 'few', round: D.meta.round || 0 }); return; }
  if (D.hostOnly && missing.includes(D.hostOnly.impostor)) { startRound({ code: 'vanished' }); return; }
  hostRun(() => update(ref(db), { [`${base()}/seats`]: Object.fromEntries(remaining.map(s => [s, true])) }));
}

// ---------- passaggio dell'host (dopo 45 s di assenza continua) ----------
function maybeClaimHost() {
  if (isHost() || claiming || Date.now() - lastFail < 5000) return;
  const hostP = D.players[D.meta.hostSeat];
  if (!hostP || !isAbsent(hostP, GRACE + MARGIN)) return;
  const cand = seatsOf().filter(s => s !== D.meta.hostSeat && D.players[s].connected === true).sort(byJoin)[0];
  if (cand !== S.seat) return;
  claiming = true;
  update(ref(db, `${base()}/meta`), { hostSeat: S.seat })
    .then(() => { lastFail = 0; })
    .catch(e => { console.warn('passaggio host', e.message); lastFail = Date.now(); })
    .finally(() => { claiming = false; scheduleRender(); });
}

// ---------- collegamenti dei pulsanti ----------
$('onCreate').addEventListener('click', createGame);
$('onJoin').addEventListener('click', joinFromForm);
$('onBack').addEventListener('click', () => { say('onMenuError', ''); curScreen = null; M.showScreen('menu'); });
$('onResume').addEventListener('click', () => { const s = loadSession(); if (s) join(s.code, s.name); });
$('onCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z]/g, '').slice(0, 5); say('onMenuError', ''); });
$('onName').addEventListener('input', () => say('onMenuError', ''));
$('onStart').addEventListener('click', () => startRound(null));
$('onSend').addEventListener('click', sendAnswer);
$('onToVote').addEventListener('click', () => hostRun(() => setPhase('vote')));
$('onSign').addEventListener('click', signVote);
$('onContinue').addEventListener('click', () => startRound(null));
$('onNewGame').addEventListener('click', () => toLobby(null));
$('onSkipAbsent').addEventListener('click', () => excludeAbsent(D.answered));
$('onSkipAbsentV').addEventListener('click', () => excludeAbsent(D.voted));
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(); });
