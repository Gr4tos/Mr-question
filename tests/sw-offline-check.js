// Con il service worker VERO: l'app si installa (compresi i nuovi file) e funziona offline.
// Il party online non viene aperto mentre si e' online, per non toccare il database reale.
const { startHarness } = require('./fake/harness');
let bad = 0;
const check = (label, ok, extra) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };
(async () => {
  const h = await startHarness();
  try {
    const p = await h.newPlayer('sw');
    await p.page.setBypassServiceWorker(false);
    await p.open();
    await p.page.evaluate(() => navigator.serviceWorker.ready);
    await p.page.reload({ waitUntil: 'networkidle0' });
    const info = await p.page.evaluate(async () => {
      const names = await caches.keys();
      const c = await caches.open(names[0]);
      return { names, urls: (await c.keys()).map(r => new URL(r.url).pathname) };
    });
    check('cache attiva v14', info.names.length === 1 && info.names[0] === 'mr-question-shell-v14', info.names);
    check('online.js e i font sono in cache', ['/online.js', '/app.js', '/assets/fonts/inter-latin.woff2', '/assets/fonts/special-elite-latin.woff2'].every(u => info.urls.includes(u)));
    check('l\'SDK Firebase non e\' stato scaricato all\'installazione', !info.urls.some(u => u.includes('vendor/firebase')));
    await p.page.setOfflineMode(true);
    await p.page.reload({ waitUntil: 'load' });
    check('offline: la pagina si ricarica dalla cache', (await p.screen()) === 'menuScreen');
    await p.click('#goOnline');
    check('offline: "Party online" mostra il messaggio e propone un solo telefono', /offline/i.test(await p.text('#menuError')) && await p.visible('#goLocal'));
    await p.click('#goLocal'); await p.waitScreen('homeScreen');
    await p.click('#startGame'); await p.waitScreen('turnScreen');
    check('offline: la partita a un telefono parte', (await p.text('#turnStep')) === '1 / 3');
    const fonts = await p.page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map(f => `${f.family}:${f.status}`); });
    check('offline: font dalla cache', fonts.length > 0 && fonts.every(f => f.endsWith(':loaded')), fonts);
    check('nessun errore', p.errors.length === 0, p.errors);
  } finally { await h.stop(); }
  process.exit(bad ? 1 : 0);
})();
