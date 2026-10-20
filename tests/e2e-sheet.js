// Fascicolo a scorrimento (turno privato): gesto sopra e sotto soglia, scatto veloce, pulsante alternativo, tastiera,
// richiusura, risposta conservata in memoria, scheda chiusa dopo la conferma, privacy (domanda mai nella pagina a scheda chiusa),
// nessuna differenza per l'impostore, movimento ridotto. Un telefono e party online. Chrome con tocco simulato.
const { startHarness } = require('./fake/harness');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function touchPhone(h, label, opts = {}) {
  const p = await h.newPlayer(label, { width: 390, height: 844, random: opts.random ?? 0.99 });
  await p.page.setViewport({ width: 390, height: 844, hasTouch: true });
  if (opts.reduced) await p.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  return p;
}
// geometria della scheda (a un telefono: #turnSheet, online: #onSheet)
const geo = (p, sheet) => p.page.evaluate(sheet => { const s = document.querySelector(sheet).getBoundingClientRect(); const g = document.querySelector(sheet + ' .sheet-cover .handle-bar').getBoundingClientRect(); return { x: Math.round(s.left + s.width / 2), top: Math.round(s.top), h: Math.round(s.height), handleY: Math.round(g.top + g.height / 2) }; }, sheet);
// trascinamento col dito: da (x,y0) a (x,y1) in `steps` passi, `delay` ms tra un passo e l'altro; `hold` ms prima del rilascio
async function drag(p, x, y0, y1, steps, delay, hold = 0, between) {
  const t = await p.page.touchscreen.touchStart(x, y0);
  for (let i = 1; i <= steps; i++) { await t.move(x, Math.round(y0 + (y1 - y0) * i / steps)); if (delay) await sleep(delay); if (between && i === Math.ceil(steps / 2)) await between(); }
  if (hold) await sleep(hold);
  await t.end();
}
// stato osservabile della scheda
const probe = (p, sheet) => p.page.evaluate(sheet => {
  const s = document.querySelector(sheet), cover = s.querySelector('.sheet-cover'), inside = s.querySelector('.sheet-inside');
  return { cls: s.className, transform: cover.style.transform, coverVisible: getComputedStyle(cover).visibility !== 'hidden', insideKids: inside.children.length, insideHidden: inside.classList.contains('hidden'),
    input: !!document.querySelector('#answerInput,#onAnswer'), questionEl: !!document.querySelector('#questionText,#onQuestion'), scrollY: window.scrollY };
}, sheet);
const settleAnim = p => p.settle(450);

(async () => {
  const h = await startHarness();
  try {
    // ================= un solo telefono =================
    console.log('\n== un solo telefono (Chrome, tocco) ==');
    const p = await touchPhone(h, 'locale');
    await p.open(); await p.click('#goLocal'); await p.waitScreen('homeScreen'); await p.click('#startGame'); await p.waitScreen('turnScreen'); await settleAnim(p);
    const texts = await p.page.evaluate(() => [state.round.q.common, state.round.q.impostor]);
    const inDom = () => p.page.evaluate(t => t.some(x => document.documentElement.innerHTML.includes(x) || document.body.innerText.includes(x)), texts);
    let g = await geo(p, '#turnSheet'); let st = await probe(p, '#turnSheet');
    check('scheda chiusa: domanda e campo di risposta non sono nella pagina (né nel DOM né nel testo)', !st.input && !st.questionEl && st.insideKids === 0 && !(await inDom()), st);
    check('scheda chiusa: copertina visibile, maniglia e scritta "Scorri per aprire il fascicolo"', st.coverVisible && (await p.text('#turnHandle')).includes('Scorri per aprire il fascicolo') && (await p.text('#turnScreen h2')).includes('Sospettato 1'));
    check('niente barra di pulsanti a scheda chiusa (area in basso libera)', await p.page.evaluate(() => getComputedStyle(document.getElementById('showQuestion').closest('.actions')).display === 'none'));
    const ta = await p.page.evaluate(() => [getComputedStyle(document.getElementById('turnCover')).touchAction, getComputedStyle(document.getElementById('turnHandle')).touchAction, getComputedStyle(document.getElementById('turnSheet')).overflow]);
    check('il gesto è limitato alla scheda: touch-action none sulla copertina e sulla maniglia', ta[0] === 'none' && ta[1] === 'none', ta);

    // sotto soglia (25% della corsa, lento): a metà la scheda segue il dito, al rilascio torna chiusa e la domanda sparisce
    let mid;
    await drag(p, g.x, g.handleY - 20, g.handleY - 20 - Math.round(g.h * 0.25), 6, 40, 60, async () => { mid = await probe(p, '#turnSheet'); });
    await settleAnim(p); st = await probe(p, '#turnSheet');
    check('sotto soglia: durante il trascinamento la scheda segue il dito (translateY negativo)', /translateY\(-/.test(mid.transform) && mid.cls.includes('dragging'), mid.transform);
    check('sotto soglia: al rilascio torna chiusa e la domanda esce dalla pagina', st.cls === 'sheet' && st.transform === '' && !st.input && !st.questionEl && !(await inDom()), st);
    check('sotto soglia: la pagina non è scorsa', st.scrollY === 0 && mid.scrollY === 0);

    // effetto: il foglio sale insieme alla copertina (attaccato al suo bordo basso); si legge prima la domanda, poi il campo
    {
      const t = await p.page.touchscreen.touchStart(g.x, g.handleY - 20);
      const dTarget = Math.round(g.h * 0.55); let m1, m2;
      for (let i = 1; i <= 8; i++) { await t.move(g.x, g.handleY - 20 - Math.round(dTarget * i / 8)); await sleep(30); if (i === 3) m1 = await p.page.evaluate(() => { const ty = e => parseFloat((e.style.transform.match(/-?[\d.]+/) || [0])[0]); const s = document.getElementById('turnSheet').getBoundingClientRect(); return { cover: ty(document.getElementById('turnCover')), inside: ty(document.getElementById('questionArea')), H: s.height }; }); }
      m2 = await p.page.evaluate(() => { const s = document.getElementById('turnSheet').getBoundingClientRect(); const q = document.getElementById('questionText').getBoundingClientRect(), f = document.getElementById('answerInput').getBoundingClientRect(); return { sheetBottom: s.bottom, qTop: q.top, qBottom: q.bottom, fieldTop: f.top }; });
      await t.end(); await settleAnim(p); await p.click('.sheet-grabber'); await settleAnim(p);
      check('la copertina e il foglio salgono insieme: quando la copertina è su di d, il foglio è a (altezza − d)', Math.abs((-m1.cover) + m1.inside - m1.H) <= 1.5 && m1.cover < 0 && m1.inside > 0, m1);
      check('a metà corsa la domanda è già leggibile e il campo sta ancora entrando (ordine di lettura)', m2.qBottom <= m2.sheetBottom && m2.qTop < m2.fieldTop && m2.fieldTop >= m2.sheetBottom - 20, m2);
    }

    // trascinamento lento molto corto: non apre
    await drag(p, g.x, g.handleY - 20, g.handleY - 50, 3, 120, 100); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('trascinamento corto e lento (30px): resta chiusa', st.cls === 'sheet' && !st.input, st);

    // sopra soglia (65%, lento): si apre, mostra domanda e campo, nessuno scorrimento della pagina, cursore non sul campo
    await drag(p, g.x, g.handleY - 20, g.handleY - 20 - Math.round(g.h * 0.65), 8, 30, 40); await settleAnim(p); st = await probe(p, '#turnSheet');
    const exp = await p.page.evaluate(() => { const r = state.round; return r.turn === r.impostor ? r.q.impostor : r.q.common; });
    check('sopra soglia: si apre e mostra la domanda del giocatore e il campo di risposta', st.cls.includes('is-open') && (await p.text('#questionText')) === exp && st.input && !st.coverVisible, st);
    check('sopra soglia: il cursore NON è sul campo (si apre col gesto) e la pagina non è scorsa', (await p.page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'answerInput' && st.scrollY === 0);
    check('aperta: compare "Metti a verbale" nella barra e non "Apri il fascicolo"', await p.visible('#confirmAnswer') && !(await p.visible('#showQuestion')));

    // richiusura trascinando in giù la striscia in cima; la risposta scritta resta in memoria, non nella pagina
    await p.type('#answerInput', '42');
    const gr = await p.page.evaluate(() => { const r = document.querySelector('.sheet-grabber').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    await drag(p, gr.x, gr.y, gr.y + Math.round(g.h * 0.2), 5, 40, 60); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('richiusura sotto soglia (20% in giù): resta aperta', st.cls.includes('is-open') && st.input, st);
    const gr2 = await p.page.evaluate(() => { const r = document.querySelector('.sheet-grabber').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    await drag(p, gr2.x, gr2.y, gr2.y + Math.round(g.h * 0.6), 8, 30, 40); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('richiusura sopra soglia (trascinando in giù): torna chiusa, domanda e campo escono dalla pagina', st.cls === 'sheet' && !st.input && !st.questionEl && !(await inDom()), st);

    // scatto veloce: poca strada ma veloce, apre
    await drag(p, g.x, g.handleY - 20, g.handleY - 70, 2, 0, 0); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('scatto veloce (50px in pochi ms): si apre', st.cls.includes('is-open') && st.input, st);
    check('riaperta: la risposta scritta prima (42) torna nel campo, senza essere stata nella pagina da chiusa', (await p.value('#answerInput')) === '42');
    await p.click('.sheet-grabber'); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('la maniglia in cima (pulsante) richiude senza trascinare', st.cls === 'sheet' && !st.input, st);

    // pulsante alternativo: maniglia -> "Apri il fascicolo" -> si apre col cursore sul campo
    await p.page.touchscreen.tap(g.x, g.handleY); await sleep(150); st = await probe(p, '#turnSheet');
    check('tocco sulla maniglia: compare "Apri il fascicolo" e la scheda resta chiusa (nessun contenuto nella pagina)', (await p.visible('#showQuestion')) && (await p.text('#showQuestion')).includes('Apri il fascicolo') && st.cls === 'sheet' && !st.input && !(await inDom()), st);
    check('tocco sulla maniglia: il fuoco passa al pulsante', (await p.page.evaluate(() => document.activeElement.id)) === 'showQuestion');
    await p.click('#showQuestion'); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('pulsante "Apri il fascicolo": apre e mette il cursore sul campo', st.cls.includes('is-open') && (await p.page.evaluate(() => document.activeElement.id)) === 'answerInput', st);
    await p.click('.sheet-grabber'); await settleAnim(p);

    // tastiera: maniglia + Invio/Spazio = apertura diretta
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('tastiera (Invio sulla maniglia): apertura diretta, senza passare dal pulsante, cursore sul campo', st.cls.includes('is-open') && !(await p.visible('#showQuestion')) && (await p.page.evaluate(() => document.activeElement.id)) === 'answerInput', st);
    await p.click('.sheet-grabber'); await settleAnim(p);
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Space'); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('tastiera (Spazio sulla maniglia): apertura diretta', st.cls.includes('is-open'), st);

    // app in background: la scheda si copre subito, la risposta resta in memoria
    await p.type('#answerInput', '77');
    await p.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    st = await probe(p, '#turnSheet');
    check('app in background (visibilitychange): scheda chiusa subito, domanda e campo fuori dalla pagina', st.cls === 'sheet' && !st.input && !(await inDom()), st);
    await p.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p);
    check('al ritorno la risposta già scritta (77) è rimessa nel campo', (await p.value('#answerInput')) === '77');
    await p.page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); st = await probe(p, '#turnSheet');
    check('pagehide: scheda chiusa subito', st.cls === 'sheet' && !st.input, st);

    // dopo "Metti a verbale": scheda chiusa, turno dopo con la copertina del giocatore dopo
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p);
    await p.type('#answerInput', '5'); await p.click('#confirmAnswer'); await settleAnim(p); st = await probe(p, '#turnSheet');
    check('dopo "Metti a verbale": turno 2, scheda chiusa, nessun contenuto, nome del giocatore dopo', (await p.text('#topLabel')) === 'TURNO 2 / 3' && (await p.text('#turnScreen h2')).includes('Sospettato 2') && st.cls === 'sheet' && !st.input && !st.questionEl && !(await inDom()), st);
    check('turno 2: la sagoma ha il colore del posto 2 e il campo parte vuoto alla riapertura', await p.page.evaluate(() => document.getElementById('turnAvatar').classList.contains('s2')));
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p);
    check('turno 2 aperto: campo vuoto (la risposta del turno 1 non è rimasta)', (await p.value('#answerInput')) === '');
    await p.click('.sheet-grabber'); await settleAnim(p);

    // nessuna differenza per l'impostore: stesso gesto, stessi stati visibili. Turno 1 (non impostore) e turno 3 (impostore, posto ultimo)
    const record = async () => {
      const g2 = await geo(p, '#turnSheet'); const out = {};
      await drag(p, g2.x, g2.handleY - 20, g2.handleY - 20 - 60, 4, 30, 50, async () => { const m = await probe(p, '#turnSheet'); out.mid = { cls: m.cls, tr: m.transform, kids: m.insideKids }; });
      await settleAnim(p); out.closed = (({ cls, transform, insideKids }) => ({ cls, transform, insideKids }))(await probe(p, '#turnSheet'));
      await drag(p, g2.x, g2.handleY - 20, g2.handleY - 20 - Math.round(g2.h * 0.7), 6, 25, 40); await settleAnim(p);
      const o = await probe(p, '#turnSheet'); out.open = { cls: o.cls, kids: o.insideKids, coverVisible: o.coverVisible };
      out.structure = await p.page.evaluate(() => [...document.querySelector('#turnSheet .sheet-inside').querySelectorAll('*')].map(e => e.tagName + '.' + e.className).join('|'));
      out.imp = await p.page.evaluate(() => state.round.turn === state.round.impostor);
      await p.click('.sheet-grabber'); await settleAnim(p);
      return out;
    };
    // turno 2 -> avanza al 3 senza leggere: si risponde da tastiera
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p); await p.type('#answerInput', '6'); await p.click('#confirmAnswer'); await settleAnim(p);
    const asThird = await record(); // turno 3: impostore
    // per il turno non impostore si rigioca: riparte da capo (stessi giocatori) con random 0.99 il 3° è sempre l'impostore
    check('turno dell\'impostore (3): è davvero l\'impostore nei dati', asThird.imp === true);
    await p.page.focus('#turnHandle'); await p.page.keyboard.press('Enter'); await settleAnim(p); await p.type('#answerInput', '7'); await p.click('#confirmAnswer'); await settleAnim(p);
    await p.waitScreen('voteScreen'); await p.click('#goVote'); await p.settle(100);
    (await p.page.$$('.vote-option'))[0].click(); await p.click('#confirmVote'); await p.settle(200); await p.click('#rematch'); await p.waitScreen('turnScreen'); await settleAnim(p);
    const asFirst = await record(); // nuovo round, turno 1: non impostore
    check('turno del non impostore (1): non è l\'impostore nei dati', asFirst.imp === false);
    check('impostore e non impostore: stessi stati, trasformazioni, struttura e animazione del gesto', JSON.stringify({ ...asThird, imp: 0 }) === JSON.stringify({ ...asFirst, imp: 0 }), [asThird, asFirst]);

    // ================= movimento ridotto =================
    console.log('\n== movimento ridotto ==');
    const r = await touchPhone(h, 'ridotto', { reduced: true });
    await r.open(); await r.click('#goLocal'); await r.waitScreen('homeScreen'); await r.click('#startGame'); await r.waitScreen('turnScreen'); await r.settle(100);
    const gg = await geo(r, '#turnSheet'); let rm;
    await drag(r, gg.x, gg.handleY - 20, gg.handleY - 20 - Math.round(gg.h * 0.25), 6, 30, 40, async () => { rm = await probe(r, '#turnSheet'); });
    let rs = await probe(r, '#turnSheet');
    check('movimento ridotto, sotto soglia: la scheda non segue il dito, nessun contenuto nella pagina, resta chiusa', rm.transform === '' && !rm.input && rs.cls === 'sheet' && !rs.input, [rm, rs]);
    await drag(r, gg.x, gg.handleY - 20, gg.handleY - 20 - Math.round(gg.h * 0.65), 8, 30, 40, async () => { rm = await probe(r, '#turnSheet'); });
    rs = await probe(r, '#turnSheet');
    check('movimento ridotto, sopra soglia: nessuna animazione durante il gesto, al rilascio si apre direttamente', rm.transform === '' && !rm.input && rs.cls.includes('is-open') && rs.input && (await r.page.evaluate(() => getComputedStyle(document.getElementById('turnCover')).transitionDuration)) === '0s', [rm, rs]);

    // ================= party online =================
    console.log('\n== party online (Chrome, tocco) ==');
    const a = await touchPhone(h, 'Anna'), b = await touchPhone(h, 'Bea'), c = await touchPhone(h, 'Carlo');
    const code = await a.create('Anna'); await b.join(code, 'Bea'); await c.join(code, 'Carlo');
    await a.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'avvio');
    await a.click('#onStart');
    for (const q of [a, b, c]) { await q.waitScreen('onTurnScreen'); await q.waitFor(() => { const e = document.getElementById('onHandle'); return !!e && !e.disabled; }, null, 8000, 'maniglia'); }
    await b.settle(500);
    const seat = n => ['p1', 'p2', 'p3'][['Anna', 'Bea', 'Carlo'].indexOf(n)];
    const privText = n => h.backend.valueAt(`games/${code}/private/${seat(n)}/question`);
    const bDom = () => b.page.evaluate(t => document.documentElement.innerHTML.includes(t) || document.body.innerText.includes(t), privText('Bea'));
    let bs = await probe(b, '#onSheet'); const bg = await geo(b, '#onSheet');
    check('online, scheda chiusa: la domanda privata non è nella pagina e il campo non esiste', !bs.input && !bs.questionEl && !(await bDom()) && (await b.text('#topLabel')) === 'ROUND 1', bs);
    await drag(b, bg.x, bg.handleY - 20, bg.handleY - 20 - Math.round(bg.h * 0.25), 6, 40, 60); await settleAnim(b); bs = await probe(b, '#onSheet');
    check('online, sotto soglia: resta chiusa e la domanda esce dalla pagina', bs.cls === 'sheet' && !bs.input && !(await bDom()), bs);
    await drag(b, bg.x, bg.handleY - 20, bg.handleY - 20 - Math.round(bg.h * 0.65), 8, 30, 40); await settleAnim(b); bs = await probe(b, '#onSheet');
    check('online, sopra soglia: si apre con la domanda giusta del suo posto', bs.cls.includes('is-open') && (await b.text('#onQuestion')) === privText('Bea') && bs.input, bs);
    await b.type('#onAnswer', '9');
    await b.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    bs = await probe(b, '#onSheet');
    check('online, app in background: scheda chiusa subito', bs.cls === 'sheet' && !bs.input && !(await bDom()), bs);
    await b.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
    await b.page.focus('#onHandle'); await b.page.keyboard.press('Enter'); await settleAnim(b);
    check('online, riaperta da tastiera: la risposta (9) è rimessa nel campo', (await b.value('#onAnswer')) === '9');
    await b.click('#onSend'); await b.waitFor(() => !document.getElementById('onWaitArea').classList.contains('hidden'), null, 8000, 'attesa');
    bs = await probe(b, '#onSheet');
    check('online, dopo "Metti a verbale": schermata di attesa, scheda chiusa, domanda e campo fuori dalla pagina', !bs.input && !bs.questionEl && !(await bDom()) && h.backend.valueAt(`games/${code}/answers/p2`) === '9', bs);
    // pulsante alternativo online
    await a.page.touchscreen.tap((await geo(a, '#onSheet')).x, (await geo(a, '#onSheet')).handleY); await sleep(150);
    check('online, tocco sulla maniglia: compare "Apri il fascicolo" e non c\'è ancora nulla nella pagina', (await a.visible('#onOpenSheet')) && !(await probe(a, '#onSheet')).input);
    await a.click('#onOpenSheet'); await settleAnim(a);
    check('online, "Apri il fascicolo": apre col cursore sul campo', (await probe(a, '#onSheet')).cls.includes('is-open') && (await a.page.evaluate(() => document.activeElement.id)) === 'onAnswer');
    check('online: nessun errore di pagina o console', h.players.every(q => q.errors.length === 0), h.players.flatMap(q => q.errors).slice(0, 3));
  } finally { await h.stop(); }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
