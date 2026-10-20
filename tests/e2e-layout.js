// Layout: il pulsante principale (e l'eventuale secondario) sta in fondo allo schermo, il contenuto parte dall'alto
// e scorre sopra la barra senza finirci sotto; con la tastiera aperta la barra non copre il campo.
// Verifiche a 375x667 e 390x844, un telefono e party online.
const { startHarness } = require('./fake/harness');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''}`); };

// primo piano della pagina: barra in fondo al viewport, pulsante dentro, contenuto che a fine scorrimento resta sopra la barra
// regola: compatta se e solo se i riquadri mostrati nella griglia sono 5 o più
const gridRule = (p, sel, expectCompact) => p.page.evaluate((sel, exp) => { const g = document.querySelector(sel); const n = g.children.length; return g.classList.contains('compact') === (n >= 5) && (exp === undefined || g.classList.contains('compact') === exp); }, sel, expectCompact);
const measure = (p, sel) => p.page.evaluate(sel => {
  const btn = document.querySelector(sel); const bar = btn.closest('.actions');
  window.scrollTo(0, 0);
  const top = { barBottom: Math.round(bar.getBoundingClientRect().bottom), btnBottom: Math.round(btn.getBoundingClientRect().bottom), btnTop: Math.round(btn.getBoundingClientRect().top), vh: innerHeight };
  const scrolls = document.documentElement.scrollHeight > innerHeight + 1;
  window.scrollTo(0, 1e6);
  const screen = document.querySelector('.screen.active');
  const kids = [...screen.querySelectorAll(':scope > *, :scope > div > *')].filter(e => !bar.contains(e) && e !== bar && e.getClientRects().length && !e.classList.contains('actions') && !e.closest('.actions') && e.parentElement.id !== 'onAnswerView' || false);
  const content = [...screen.children].filter(e => e !== bar && !e.contains(bar) && e.getClientRects().length);
  let last = 0; for (const e of content) last = Math.max(last, e.getBoundingClientRect().bottom);
  const inner = document.querySelector('#onAnswerView:not(.hidden)');
  if (inner) for (const e of inner.children) if (e !== bar && e.getClientRects().length) last = Math.max(last, e.getBoundingClientRect().bottom);
  const end = { contentBottom: Math.round(last), barTop: Math.round(bar.getBoundingClientRect().top), barBottom: Math.round(bar.getBoundingClientRect().bottom) };
  window.scrollTo(0, 0);
  return { top, scrolls, end, hOver: document.documentElement.scrollWidth > document.documentElement.clientWidth };
}, sel);

async function pinned(p, label, sel) {
  await p.settle(400); // fine dell'animazione di ingresso della schermata
  const m = await measure(p, sel);
  check(`${label}: barra in fondo allo schermo e pulsante visibile`, Math.abs(m.top.barBottom - m.top.vh) <= 1 && m.top.btnBottom <= m.top.vh && m.top.btnTop >= 0, m.top);
  check(`${label}: a fine scorrimento il contenuto resta sopra la barra`, m.end.contentBottom <= m.end.barTop + 1 && Math.abs(m.end.barBottom - m.top.vh) <= 1, m.end);
  check(`${label}: nessuno scorrimento orizzontale`, !m.hOver);
  return m;
}

(async () => {
  const h = await startHarness();
  try {
    for (const [w, hgt] of [[375, 667], [390, 844]]) {
      console.log(`\n== ${w}x${hgt}: un solo telefono ==`);
      const p = await h.newPlayer(`l${w}`, { width: w, height: hgt, random: 0.99 });
      await p.open(); await p.click('#goLocal'); await p.waitScreen('homeScreen');
      for (let i = 0; i < 4; i++) await p.click('#plusPlayers');
      await pinned(p, 'impostazione (7 giocatori)', '#startGame');
      await p.click('#startGame'); await p.waitScreen('turnScreen');
      await pinned(p, 'turno privato, scheda chiusa', '#showQuestion');
      await p.click('#showQuestion'); await p.settle(100);
      const m = await pinned(p, 'turno privato, domanda aperta', '#confirmAnswer');
      // tastiera aperta: la barra torna nel flusso e non copre il campo
      await p.page.evaluate(() => document.documentElement.classList.add('kb'));
      const kb = await p.page.evaluate(() => { const bar = document.querySelector('#confirmAnswer').closest('.actions'); const inp = document.getElementById('answerInput').getBoundingClientRect(); const b = bar.getBoundingClientRect(); return { pos: getComputedStyle(bar).position, overlap: !(b.top >= inp.bottom || b.bottom <= inp.top) }; });
      check('tastiera aperta: la barra non è incollata e non copre il campo di risposta', kb.pos === 'static' && !kb.overlap, kb);
      await p.page.evaluate(() => document.documentElement.classList.remove('kb'));
      const cover = await p.page.evaluate(() => { window.scrollTo(0, 0); const inp = document.getElementById('answerInput').getBoundingClientRect(); const b = document.querySelector('#confirmAnswer').closest('.actions').getBoundingClientRect(); return { inputBottom: Math.round(inp.bottom), barTop: Math.round(b.top) }; });
      check('tastiera chiusa: il campo di risposta sta sopra la barra', cover.inputBottom <= cover.barTop, cover);
      await p.type('#answerInput', '3'); await p.click('#confirmAnswer'); await p.settle(80);
      for (let i = 1; i < 7; i++) { await p.click('#showQuestion'); await p.type('#answerInput', String(i + 2)); await p.click('#confirmAnswer'); await p.settle(60); }
      await p.waitScreen('voteScreen');
      await pinned(p, 'riepilogo (7 risposte)', '#goVote');
      await p.click('#goVote'); await p.settle(80);
      (await p.page.$$('.vote-option'))[2].click(); await p.settle(80);
      await pinned(p, 'voto, con una selezione', '#confirmVote');
      await p.click('#confirmVote'); await p.settle(150);
      await pinned(p, 'verdetto', '#rematch');
      const btns = await p.page.evaluate(() => { const a = document.getElementById('rematch').getBoundingClientRect(), b = document.getElementById('newGame').getBoundingClientRect(); return { rematchAbove: a.bottom <= b.top, newGameInside: b.bottom <= innerHeight }; });
      check('verdetto: "Nuova partita" sta sotto "Continua", dentro lo schermo', btns.rematchAbove && btns.newGameInside, btns);
    }

    console.log('\n== 375x667: party online (4 giocatori, riquadri grandi) ==');
    const a = await h.newPlayer('Anna', { width: 375, height: 667, random: 0.99 }), b = await h.newPlayer('Bea'), c = await h.newPlayer('Carlo'), d = await h.newPlayer('Dino');
    const code = await a.create('Anna'); await b.join(code, 'Bea'); await c.join(code, 'Carlo');
    await a.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 3 && !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'sala');
    await pinned(a, 'sala con 3 giocatori', '#onStart');
    const big = await a.page.evaluate(() => { const g = document.getElementById('lobbyPlayers'); const av = g.querySelector('.tile .av').getBoundingClientRect(); const nm = getComputedStyle(g.querySelector('.tile-name')).fontSize; return { tiles: g.children.length, compact: g.classList.contains('compact'), avW: Math.round(av.width), nameSize: nm }; });
    check('sala con 3 giocatori (4 riquadri con "In arrivo"): riquadri grandi (sagoma 68px, nome 17px)', big.tiles === 4 && !big.compact && big.avW === 68 && big.nameSize === '17px', big);
    await d.join(code, 'Dino');
    await a.waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 4, null, 8000, '4 in sala');
    await a.settle(200);
    check('sala con 4 giocatori (5 riquadri con "In arrivo"): versione compatta, perché i riquadri mostrati sono 5', await gridRule(a, '#lobbyPlayers', true), await a.page.evaluate(() => document.getElementById('lobbyPlayers').children.length));
    await a.click('#onStart');
    for (const p of [a, b, c, d]) { await p.waitScreen('onTurnScreen'); await p.waitFor(() => !document.getElementById('onAnswerArea').classList.contains('hidden'), null, 8000, 'domanda'); }
    const mo = await pinned(a, 'risposta online', '#onSend');
    const inp = await a.page.evaluate(() => { window.scrollTo(0, 0); return { inputBottom: Math.round(document.getElementById('onAnswer').getBoundingClientRect().bottom), barTop: Math.round(document.getElementById('onSend').closest('.actions').getBoundingClientRect().top) }; });
    check('risposta online: il campo sta sopra la barra', inp.inputBottom <= inp.barTop, inp);
    await a.answer(1); await b.answer(2); await c.answer(3);
    check('attesa online con 4 riquadri: versione grande', await gridRule(a, '#onWaitList', false));
    await d.answer(4);
    for (const p of [a, b, c, d]) await p.waitScreen('onSummaryScreen');
    await pinned(a, 'riepilogo online', '#onToVote');
    await a.click('#onToVote');
    for (const p of [a, b, c, d]) { await p.waitScreen('onVoteScreen'); await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 3, null, 8000, 'opzioni'); }
    await a.page.evaluate(() => document.querySelector('#onVoteOptions .vote-option').click()); await a.settle(100);
    await pinned(a, 'voto online', '#onSign');
    check('voto online con 3 riquadri mostrati: versione grande', await gridRule(a, '#onVoteOptions', false));
    await a.click('#onSign');
    for (const [p, n] of [[b, 'Carlo'], [c, 'Dino'], [d, 'Anna']]) { await p.page.evaluate(t => { [...document.querySelectorAll('#onVoteOptions .vote-option')].find(x => x.textContent.includes(t)).click(); }, n); await p.click('#onSign'); }
    for (const p of [a, b, c, d]) await p.waitScreen('onResultScreen');
    await a.waitFor(() => document.querySelectorAll('#onVotesList .vote-row').length >= 1, null, 8000, 'voti');
    await pinned(a, 'verdetto online', '#onContinue');
    // ---- 7 giocatori, voti sparsi: il verdetto con la sagoma grande non deve far scorrere ----
    console.log('\n== 375x667: party online, 7 giocatori, 3 righe di voti ==');
    const NAMES = ['Anna', 'Bea', 'Carlo', 'Dino', 'Eva', 'Fabio', 'Gina'];
    const q = [await h.newPlayer('Anna7', { width: 375, height: 667, random: 0.99 })];
    for (let i = 1; i < 7; i++) q.push(await h.newPlayer(NAMES[i] + '7'));
    const code7 = await q[0].create(NAMES[0]);
    for (let i = 1; i < 7; i++) await q[i].join(code7, NAMES[i]);
    await q[0].waitFor(() => document.querySelectorAll('#lobbyPlayers .player-row').length === 7 && !document.getElementById('onStart').classList.contains('hidden'), null, 10000, '7 in sala');
    check('sala con 7 giocatori (7 riquadri): compatta', await gridRule(q[0], '#lobbyPlayers', true));
    await pinned(q[0], 'sala con 7 giocatori', '#onStart');
    await q[0].click('#onStart');
    for (const p of q) { await p.waitScreen('onTurnScreen'); await p.waitFor(() => !document.getElementById('onAnswerArea').classList.contains('hidden'), null, 10000, 'domanda'); }
    for (let i = 0; i < 6; i++) await q[i].answer(i + 1);
    check('attesa con 7 riquadri: compatta', await gridRule(q[0], '#onWaitList', true));
    await q[6].answer(7);
    for (const p of q) await p.waitScreen('onSummaryScreen');
    await q[0].click('#onToVote');
    for (const p of q) { await p.waitScreen('onVoteScreen'); await p.waitFor(() => document.querySelectorAll('#onVoteOptions .vote-option').length === 6, null, 10000, 'opzioni'); }
    check('voto con 6 riquadri mostrati: compatta', await gridRule(q[0], '#onVoteOptions', true));
    // voti concentrati su tre persone (il caso tipico): 3 righe, sagoma grande
    const typical = [1, 2, 0, 0, 1, 2, 0]; // indice di chi viene votato da ciascuno (nessuno vota se stesso)
    for (let i = 0; i < 7; i++) {
      const target = NAMES[typical[i]];
      await q[i].page.evaluate(t => { [...document.querySelectorAll('#onVoteOptions .vote-option')].find(x => x.textContent.includes(t)).click(); }, target);
      await q[i].click('#onSign');
    }
    for (const p of q) await p.waitScreen('onResultScreen');
    await q[0].waitFor(() => document.querySelectorAll('#onVotesList .vote-row').length === 3, null, 10000, '3 righe di voti');
    await q[0].settle(400);
    const fit = await q[0].page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, vh: innerHeight, avatar: Math.round(document.getElementById('onRevealAvatar').getBoundingClientRect().width) }));
    check('verdetto con 7 giocatori e 3 righe di voti a 375×667: sagoma grande e la schermata non scorre', fit.scrollH <= fit.vh && fit.avatar >= 96, fit);
    await pinned(q[0], 'verdetto con 7 giocatori e 3 righe di voti', '#onContinue');
    check('tutte le schermate senza errori di pagina', h.players.every(p => p.errors.length === 0), h.players.flatMap(p => p.errors).slice(0, 3));
  } finally { await h.stop(); }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
