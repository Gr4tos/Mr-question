// Aggiornamenti e avvio: service worker VERO su una copia dell'app in una cartella temporanea servita da un server che posso
// rallentare e rompere. Verifica: versione unica, rete prima con timeout di 3 s e poi cache, offline, banner "Aggiorna" solo nel menù
// e nel verdetto, allineamento silenzioso quando la pagina è già nuova, schermata d'errore all'avvio con "Riprova".
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// copia dei soli file serviti
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mrq-update-'));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const files = [...sw.match(/const ASSETS=\[(.*?)\]/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean).concat(['sw.js']);
for (const f of new Set(files)) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f)); }
// cambia la versione della copia: version.js e le tre impronte (index.html, app.js, style.css), così i file restano coerenti
const STAMPS = { 'index.html': [/(<meta name="mrq-version" content=")[0-9a-f]{10}(")/g, /(\.(?:css|js)\?v=)[0-9a-f]{10}()/g], 'app.js': [/(window\.__MRQ_APP=')[0-9a-f]{10}(')/g], 'style.css': [/(--mrq-version:\s*")[0-9a-f]{10}(")/g] };
const setVersion = v => {
  fs.writeFileSync(path.join(tmp, 'version.js'), `self.MRQ_VERSION='${v}';
`);
  for (const [f, res] of Object.entries(STAMPS)) { const p = path.join(tmp, f); let c = fs.readFileSync(p, 'utf8'); for (const re of res) c = c.replace(re, `$1${v}$2`); fs.writeFileSync(p, c); }
};
setVersion('a000000001');

const ctl = { delayCode: 0, broken: {}, requests: [], cache: 'public, max-age=600' }; // come GitHub Pages: 10 minuti di cache HTTP
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  ctl.requests.push(p);
  const send = () => {
    const b = ctl.broken[p];
    if (b === 'hang') return; // non risponde mai
    if (b === '404') { res.writeHead(404); return res.end('non trovato'); }
    if (b === 'throw') { res.writeHead(200, { 'Content-Type': MIME['.js'] }); return res.end("throw new Error('prova di guasto');"); }
    if (b === 'stale') { // stesso file ma con l'impronta di un'altra versione (file vecchio accanto a uno nuovo)
      const raw = fs.readFileSync(path.join(tmp, p), 'utf8').replace(/(window\.__MRQ_APP=')[0-9a-f]{10}|(--mrq-version:\s*")[0-9a-f]{10}/, (m, a, c) => (a || c) + '1111111111');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)], 'Cache-Control': ctl.cache }); return res.end(raw);
    }
    const f = path.join(tmp, p);
    if (!f.startsWith(tmp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': ctl.cache });
    fs.createReadStream(f).pipe(res);
  };
  const code = /\.(html|js|css)$/.test(p);
  if (code && ctl.delayCode) setTimeout(send, ctl.delayCode); else send();
});

const swState = page => page.evaluate(async () => ({ version: self.MRQ_VERSION, controller: !!navigator.serviceWorker.controller, caches: (await caches.keys()).sort(), banner: !document.getElementById('updateBanner').classList.contains('hidden'), screen: (document.querySelector('.screen.active') || {}).id, origin: performance.timeOrigin }));

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    // ================= versione unica, rete prima / cache, offline =================
    console.log('\n== service worker: versione, rete con timeout, offline ==');
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle0' }); await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle0' });
    let st = await swState(page);
    check('versione unica: la pagina (version.js) e il nome della cache dicono la stessa versione', st.version === 'a000000001' && st.caches.join() === 'mr-question-shell-a000000001' && st.controller, st);
    check('al primo avvio nessun banner di aggiornamento', !st.banner);

    // nuova versione disponibile: il service worker nuovo resta in attesa, la pagina mostra il banner (nel menù)
    setVersion('a000000002');
    await page.evaluate(() => window.MRQ_SW.update());
    await page.waitForFunction(() => !document.getElementById('updateBanner').classList.contains('hidden'), { timeout: 10000 }).catch(() => {});
    st = await swState(page);
    check('versione nuova: compare il banner nel menù, la pagina in uso resta la vecchia (nessun ricaricamento da solo)', st.banner && st.version === 'a000000001' && st.screen === 'menuScreen', st);
    check('la versione nuova è installata in attesa (due cache), la vecchia resta attiva', st.caches.join() === 'mr-question-shell-a000000001,mr-question-shell-a000000002', st.caches);
    const txt = await page.evaluate(() => [document.querySelector('#updateBanner span').textContent, document.getElementById('updateNow').textContent, document.getElementById('updateNow').getBoundingClientRect().height]);
    check('testo del banner e pulsante "Aggiorna" (almeno 44px)', txt[0] === 'È disponibile una nuova versione' && txt[1] === 'Aggiorna' && txt[2] >= 44, txt);

    // visibilità: solo nel menù e nel verdetto, mai durante la partita
    const vis = {};
    for (const s of ['home', 'turn', 'vote', 'ballot', 'onMenu', 'onLobby', 'onTurn', 'onSummary', 'onVote', 'menu', 'result', 'onResult']) {
      vis[s] = await page.evaluate(s => { window.MRQ.showScreen(s); return !document.getElementById('updateBanner').classList.contains('hidden'); }, s);
    }
    const inGame = ['turn', 'vote', 'ballot', 'onTurn', 'onSummary', 'onVote'].every(s => !vis[s]);
    check('banner mai visibile durante turno, riepilogo e voto (a un telefono e online)', inGame, vis);
    check('banner visibile nel menù, nel verdetto a un telefono e nel verdetto online', vis.menu && vis.result && vis.onResult, vis);
    check('banner non visibile nelle schermate di impostazione e sala (non sono menù né verdetto)', !vis.home && !vis.onMenu && !vis.onLobby, vis);
    await page.evaluate(() => window.MRQ.showScreen('menu'));

    // "Aggiorna": la nuova versione subentra e la pagina si ricarica
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }), page.click('#updateNow')]);
    await page.evaluate(() => navigator.serviceWorker.ready); await sleep(500);
    st = await swState(page);
    check('"Aggiorna": la pagina riparte con la versione nuova, una sola cache, nessun banner', st.version === 'a000000002' && st.caches.join() === 'mr-question-shell-a000000002' && !st.banner && st.controller && st.screen === 'menuScreen', st);

    // pagina già nuova (arrivata dalla rete) con service worker vecchio: ci si allinea in silenzio, senza banner né ricaricamenti
    setVersion('a000000003');
    await page.goto(url, { waitUntil: 'networkidle0' });
    const t0 = (await swState(page)).origin;
    for (let i = 0; i < 20; i++) { st = await swState(page); if (st.caches.join() === 'mr-question-shell-a000000003') break; await sleep(300); }
    check('pagina già aggiornata dalla rete: il service worker si allinea (cache a000000003) senza banner e senza ricaricare', st.caches.join() === 'mr-question-shell-a000000003' && !st.banner && st.version === 'a000000003' && st.origin === t0, st);

    // rete lenta: dopo ~3 secondi si passa alla copia in cache e il gioco parte
    ctl.delayCode = 6000;
    const t1 = Date.now(); await page.goto(url, { waitUntil: 'domcontentloaded' }); const dt = Date.now() - t1;
    await page.waitForFunction(() => window.__mrqReady === true, { timeout: 10000 });
    st = await swState(page);
    check('rete che non risponde (6 s): HTML, JS e CSS arrivano dalla cache dopo circa 3 secondi', dt >= 2700 && dt <= 5200 && st.screen === 'menuScreen' && st.version === 'a000000003', { ms: dt, st });
    await page.click('#goLocal'); await page.click('#startGame');
    await page.waitForFunction(() => document.getElementById('turnScreen').classList.contains('active'), { timeout: 5000 });
    check('con la rete lenta la partita a un telefono parte', (await page.$eval('#topLabel', e => e.textContent)) === 'TURNO 1 / 3');
    await sleep(3500); ctl.delayCode = 0; // lascia finire le richieste lente in corso

    // offline: subito dalla cache
    await page.setOfflineMode(true);
    const t2 = Date.now(); await page.goto(url, { waitUntil: 'load' }); const dOff = Date.now() - t2;
    await page.waitForFunction(() => window.__mrqReady === true, { timeout: 5000 });
    check('offline: la pagina si apre subito dalla cache (meno di 2,5 secondi)', dOff < 2500 && (await swState(page)).screen === 'menuScreen', { ms: dOff });
    await page.click('#goLocal'); await page.click('#startGame');
    await page.waitForFunction(() => document.getElementById('turnScreen').classList.contains('active'), { timeout: 5000 });
    check('offline: la partita a un telefono parte', (await page.$eval('#topLabel', e => e.textContent)) === 'TURNO 1 / 3');
    await page.setOfflineMode(false);
    check('nessun errore di pagina', errs.length === 0, errs);
    await ctx.close();

    // ================= avvio a prova di blocco =================
    console.log('\n== avvio a prova di blocco ==');
    ctl.cache = 'no-store';
    const bctx = await browser.createBrowserContext(); const bp = await bctx.newPage();
    await bp.setBypassServiceWorker(true); await bp.setViewport({ width: 390, height: 844 });
    const errorShown = () => bp.waitForFunction(() => !document.getElementById('bootError').hidden, { timeout: 12000 });
    const boot = () => bp.evaluate(() => { const b = document.getElementById('bootError'); const cs = getComputedStyle(b); return { shown: !b.hidden, display: cs.display, position: cs.position, title: b.querySelector('.exit-question').textContent, detail: document.getElementById('bootDetail').textContent, retry: document.getElementById('bootRetry').textContent.trim(), retries: sessionStorage.getItem('mq_boot_retry'), ready: window.__mrqReady === true }; });

    await bp.goto(url, { waitUntil: 'load' }); await sleep(300);
    let b = await boot();
    check('avvio normale: nessuna schermata d\'errore, app pronta', !b.shown && b.ready && b.retries === null, b);

    ctl.broken['/app.js'] = 'throw';
    await bp.goto(url, { waitUntil: 'load' }); await errorShown(); b = await boot();
    check('errore in app.js: schermata d\'errore nello stile dell\'app con "Riprova" e il motivo', b.shown && b.display === 'flex' && b.position === 'fixed' && b.title === 'Qualcosa si è inceppato' && b.retry === 'Riprova' && /prova di guasto/.test(b.detail) && !b.ready, b);
    const shot = await bp.evaluate(() => { const c = document.querySelector('#bootError .exit-card').getBoundingClientRect(); return { w: Math.round(c.width), btnH: Math.round(document.getElementById('bootRetry').getBoundingClientRect().height) }; });
    check('la schermata d\'errore è leggibile su iPhone (scheda larga, pulsante da 56px)', shot.w > 300 && shot.btnH >= 52, shot);

    await Promise.all([bp.waitForNavigation({ waitUntil: 'load' }), bp.click('#bootRetry')]); await errorShown(); b = await boot();
    check('"Riprova" con il guasto ancora presente: ricarica e mostra di nuovo l\'errore (primo tentativo)', b.shown && b.retries === '1', b);
    await Promise.all([bp.waitForNavigation({ waitUntil: 'load', timeout: 15000 }), bp.click('#bootRetry')]); await errorShown(); b = await boot();
    check('secondo tentativo di fila (online): si butta anche la copia salvata e si ricarica', b.shown && b.retries === '2', b);
    delete ctl.broken['/app.js'];
    await Promise.all([bp.waitForNavigation({ waitUntil: 'load', timeout: 15000 }), bp.click('#bootRetry')]); await sleep(400); b = await boot();
    check('guasto risolto: "Riprova" fa partire il gioco, schermata d\'errore spenta e contatore azzerato', !b.shown && b.ready && b.retries === null && (await bp.$eval('.screen.active', e => e.id)) === 'menuScreen', b);

    // nessun mix di versioni: un file con l'impronta di un'altra versione ferma l'avvio con la schermata d'errore
    for (const [file, key] of [['/app.js', 'app'], ['/style.css', 'stile']]) {
      ctl.broken[file] = 'stale';
      await bp.goto(url, { waitUntil: 'load' }); await errorShown(); b = await boot();
      check(`file misto (${file} di un'altra versione): schermata d'errore "versioni diverse (${key})", non un gioco a metà`, b.shown && b.detail.includes(`versioni diverse (${key})`), b);
      delete ctl.broken[file];
    }
    await bp.goto(url, { waitUntil: 'load' }); await sleep(400); b = await boot();
    check('con i file coerenti nessuna schermata di errore (le quattro impronte coincidono)', !b.shown && b.ready, b);
    ctl.broken['/app.js'] = '404';
    await bp.goto(url, { waitUntil: 'load' }); await errorShown(); b = await boot();
    check('file mancante (app.js 404): schermata d\'errore con il nome del file', b.shown && /app\.js/.test(b.detail), b);
    delete ctl.broken['/app.js'];

    ctl.broken['/app.js'] = 'hang';
    await bp.evaluate(() => sessionStorage.clear());
    const th = Date.now(); bp.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {}); await errorShown(); const dh = Date.now() - th; b = await boot();
    check('avvio che non finisce mai: dopo circa 8 secondi compare la schermata d\'errore', b.shown && dh >= 7000 && dh <= 11500 && /troppo/.test(b.detail), { ms: dh, detail: b.detail });
    delete ctl.broken['/app.js'];
    await bctx.close();
  } finally { await browser.close(); server.closeAllConnections && server.closeAllConnections(); server.close(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); try { server.close(); } catch (_) {} process.exit(1); });
