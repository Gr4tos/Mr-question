// Screenshot del fascicolo: chiusa, a metà trascinamento e aperta (a un telefono e online), 390x844.
// Uso: node shots-fascicolo.js [dark|light] [cartella-uscita]
const fs = require('fs'), path = require('path');
const { startHarness } = require('./fake/harness');
const theme = process.argv[2] === 'light' ? 'light' : 'dark';
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'shots', 'fascicolo-' + theme));
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const h = await startHarness();
  try {
    const mk = async (label, random) => {
      const p = await h.newPlayer(label, { width: 390, height: 844, random });
      await p.page.setViewport({ width: 390, height: 844, hasTouch: true });
      await p.page.evaluateOnNewDocument(t => { try { localStorage.setItem('mq_theme', t); } catch (e) {} }, theme);
      return p;
    };
    const shot = async (p, name) => { await sleep(350); await p.page.evaluate(async () => document.fonts.ready); await p.page.screenshot({ path: path.join(OUT, name + '.png') }); };
    const sequence = async (p, sheet, prefix) => {
      const g = await p.page.evaluate(sheet => { const s = document.querySelector(sheet).getBoundingClientRect(); const b = document.querySelector(sheet + ' .handle-bar').getBoundingClientRect(); return { x: Math.round(s.left + s.width / 2), y: Math.round(b.top), h: s.height }; }, sheet);
      await shot(p, prefix + '1-chiusa');
      const t = await p.page.touchscreen.touchStart(g.x, g.y);
      const y1 = Math.round(g.y - g.h * 0.45);
      for (let i = 1; i <= 8; i++) { await t.move(g.x, Math.round(g.y + (y1 - g.y) * i / 8)); await sleep(30); }
      await shot(p, prefix + '2-meta-trascinamento');   // dito ancora giù
      for (let i = 1; i <= 5; i++) { await t.move(g.x, Math.round(y1 - (g.h * 0.25) * i / 5)); await sleep(30); }
      await t.end(); await sleep(450);
      await shot(p, prefix + '3-aperta');
    };
    const l = await mk('locale', 0.99);
    await l.open(); await l.click('#goLocal'); await l.waitScreen('homeScreen');
    await l.type('#nameFields input:nth-child(1)', 'Daniele'); await l.type('#nameFields input:nth-child(2)', 'Giulia'); await l.type('#nameFields input:nth-child(3)', 'Marco');
    await l.click('#startGame'); await l.waitScreen('turnScreen'); await l.settle(500);
    await sequence(l, '#turnSheet', 'L');
    const a = await mk('Daniele', 0.99), b = await mk('Giulia'), c = await mk('Marco');
    const code = await a.create('Daniele'); await b.join(code, 'Giulia'); await c.join(code, 'Marco');
    await a.waitFor(() => !document.getElementById('onStart').classList.contains('hidden'), null, 8000, 'avvio'); await a.click('#onStart');
    for (const p of [a, b, c]) { await p.waitScreen('onTurnScreen'); await p.waitFor(() => { const e = document.getElementById('onHandle'); return !!e && !e.disabled; }, null, 8000, 'maniglia'); }
    await b.settle(500);
    await sequence(b, '#onSheet', 'O');
    console.log('screenshot in', OUT);
  } finally { await h.stop(); }
  process.exit(0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
