// Passaggio dalla versione pubblicata v21 (service worker "cache prima", commit 3f6a96d) alla versione di questa cartella.
// Service worker VERO, Chrome. Due cartelle temporanee servite da un server che "pubblica" cambiando cartella:
//   A = v21 (da git), B = versione attuale (copia dei file serviti).
// Non fa parte di `npm test` (serve la storia di git): node migrate-v21.js [commit-v21]
// Verifica anche l'accorgimento di sw.js per questo solo passaggio ("se c'è la cache della v21, subentra subito"): senza, chi lascia l'app aperta resta sulla v21.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..');
const COMMIT = process.argv.find(a => /^[0-9a-f]{7,40}$/.test(a)) || '3f6a96d';
const SKIP = process.argv.includes('--legacy-skip-waiting');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const A = fs.mkdtempSync(path.join(os.tmpdir(), 'mrq-v21-')), B = fs.mkdtempSync(path.join(os.tmpdir(), 'mrq-new-'));
// A: la v21 vera, da git
for (const f of execFileSync('git', ['-C', ROOT, 'ls-tree', '-r', '--name-only', COMMIT]).toString().split(String.fromCharCode(10)).map(x => x.trim()).filter(f => f && !f.startsWith('tests/') && !f.startsWith('design/') && !f.endsWith('.md'))) {
  fs.mkdirSync(path.dirname(path.join(A, f)), { recursive: true });
  fs.writeFileSync(path.join(A, f), execFileSync('git', ['-C', ROOT, 'show', `${COMMIT}:${f}`], { maxBuffer: 1 << 28 }));
}
// B: la versione attuale (solo file serviti)
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const files = [...new Set([...sw.match(/const ASSETS=\[(.*?)\]/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean).concat(['sw.js']))];
for (const f of files) { fs.mkdirSync(path.dirname(path.join(B, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(B, f)); }
if (SKIP) {
  let s = fs.readFileSync(path.join(B, 'sw.js'), 'utf8');
  const o = "self.addEventListener('install',event=>{";
  if (!s.includes(o)) throw new Error('install non trovato');
  s = s.replace(o, o + "\n  // PASSAGGIO DA v21: se c'è la vecchia cache \"mr-question-shell-vNN\" la versione nuova subentra subito (solo la prima volta)\n  event.waitUntil(caches.keys().then(ks=>{if(ks.some(k=>/^mr-question-shell-v\\d+$/.test(k)))self.skipWaiting();}));");
  fs.writeFileSync(path.join(B, 'sw.js'), s);
}

const ctl = { root: A, log: [] };
const treeName = () => (ctl.root === A ? 'A' : 'B');
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ctl.root, p);
  if (!f.startsWith(ctl.root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  ctl.log.push(treeName() + ' ' + p);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=600' });
  fs.createReadStream(f).pipe(res);
});

// quale versione sta girando? funzioni che esistono solo in A (v21) o solo in B, controllate su HTML, JS e CSS separatamente
const features = page => page.evaluate(async () => {
  const html = !!document.getElementById('updateBanner');                 // index.html nuovo
  const js = typeof window.MRQ_SW !== 'undefined' || document.documentElement.dataset.js === 'new'; // app.js nuovo (registra MRQ_SW)
  const input = document.querySelector('.name-input'); document.getElementById('goLocal').click(); await new Promise(r => setTimeout(r, 60));
  const f = parseFloat(getComputedStyle(document.querySelector('#nameFields .name-input')).fontSize);
  document.getElementById('backToMenu').click();
  const css = f >= 16;                                                       // style.css nuovo (campi a 16px)
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = (await caches.keys()).sort();
  return { html, js, css, version: self.MRQ_VERSION || null, caches: keys, controller: !!navigator.serviceWorker.controller, waiting: !!(reg && reg.waiting), active: !!(reg && reg.active), installing: !!(reg && reg.installing) };
});
const verdict = f => (f.html && f.js && f.css) ? 'NUOVA' : (!f.html && !f.js && !f.css) ? 'v21' : 'MISTA';

(async () => {
  await new Promise(r => server.listen(0, r)); const url = `http://localhost:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    const ctx = await browser.createBrowserContext(); // il "telefono": stessa memoria tra una apertura e l'altra
    const errs = [];
    const openApp = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.setViewport({ width: 390, height: 844 }); await p.goto(url, { waitUntil: 'networkidle0' }); return p; };
    console.log(`\n== v21 (${COMMIT}) → versione attuale${SKIP ? ' con accorgimento "subentra subito se c\'è v21"' : ' (senza accorgimenti)'} ==`);

    // 1. telefono con v21 installata
    ctl.root = A;
    let p = await openApp(); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload({ waitUntil: 'networkidle0' });
    let f = await features(p);
    check('partenza: v21 installata e attiva (cache v21, nessun banner, nessuna versione unica)', verdict(f) === 'v21' && f.caches.join() === 'mr-question-shell-v21' && f.controller && f.version === null, f);
    await p.close();

    // 2. pubblicazione della versione nuova
    ctl.root = B; ctl.log.length = 0;

    // 3. prima apertura dopo la pubblicazione: il vecchio service worker serve v21 e intanto scarica la nuova
    p = await openApp(); await sleep(1800); f = await features(p);
    console.log('   prima riapertura →', verdict(f), JSON.stringify(f));
    const firstVerdict = verdict(f);
    check('prima apertura dopo la pubblicazione: nessun file misto (tutta v21 o tutta nuova)', firstVerdict !== 'MISTA', f);
    const swInstalled = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!(r && r.waiting), active: !!(r && r.active) }; });
    console.log('   dopo 1,8 s:', JSON.stringify(swInstalled));
    // app lasciata aperta (iPhone: in background nel selettore delle app, mai chiusa del tutto): si ricarica due volte
    await p.goto(url, { waitUntil: 'networkidle0' }); await sleep(1200); await p.goto(url, { waitUntil: 'networkidle0' }); await sleep(1200);
    f = await features(p); const stuck = verdict(f);
    console.log('   senza chiudere, dopo due ricaricamenti →', stuck, JSON.stringify(f));
    check('SENZA chiudere del tutto la app, dopo un paio di ricaricamenti non si resta bloccati sulla v21 (e nessun file misto)', stuck !== 'v21' && stuck !== 'MISTA', f);
    // chiusura completa dell'app (tutte le schede) e attesa che il service worker in attesa subentri
    await p.close(); await sleep(1500);

    // 4. seconda apertura: deve partire la versione nuova
    ctl.log.length = 0;
    p = await openApp(); await sleep(800); f = await features(p); const second = verdict(f);
    console.log('   seconda riapertura →', second, JSON.stringify(f));
    check('DOPO una chiusura completa e una riapertura (che ha già scaricato la nuova) parte la versione NUOVA', second === 'NUOVA' && f.version, f);
    check('nessun mix di file vecchi e nuovi nemmeno nella seconda apertura', second !== 'MISTA', f);
    check('le cache vecchie sono state tolte: resta solo quella della versione nuova', f.caches.length === 1 && /^mr-question-shell-[0-9a-f]{10}$/.test(f.caches[0]), f.caches);
    await p.close();

    // 5. riapertura ancora: stabile e nuova, offline compreso
    p = await openApp(); await sleep(500); f = await features(p);
    check('terza apertura: nuova e stabile', verdict(f) === 'NUOVA' && !f.waiting, f);
    await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__mrqReady === true, { timeout: 8000 });
    f = await features(p);
    check('offline dopo il passaggio: la versione nuova parte dalla cache', verdict(f) === 'NUOVA', f);
    await p.setOfflineMode(false);

    // 6. gli aggiornamenti successivi passano dal banner: nuova pubblicazione C (B + una riga in app.js e nuova versione)
    const C = fs.mkdtempSync(path.join(os.tmpdir(), 'mrq-c-'));
    for (const g of files) { fs.mkdirSync(path.dirname(path.join(C, g)), { recursive: true }); fs.copyFileSync(path.join(B, g), path.join(C, g)); }
    fs.appendFileSync(path.join(C, 'app.js'), '\n// versione C\n'); fs.writeFileSync(path.join(C, 'version.js'), "self.MRQ_VERSION='versioneC';\n");
    ctl.root = C;
    await p.evaluate(() => window.MRQ_SW.update());
    await p.waitForFunction(() => !document.getElementById('updateBanner').classList.contains('hidden'), { timeout: 10000 }).catch(() => {});
    const banner = await p.evaluate(() => ({ visible: !document.getElementById('updateBanner').classList.contains('hidden'), screen: document.querySelector('.screen.active').id }));
    check('da lì in poi: la pubblicazione successiva fa comparire il banner "Aggiorna" nel menù', banner.visible && banner.screen === 'menuScreen', banner);
    await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 15000 }), p.click('#updateNow')]); await sleep(600);
    f = await features(p);
    check('"Aggiorna": riparte con la versione C', f.version === 'versioneC' && f.caches.join() === 'mr-question-shell-versioneC', f);
    check('nessun errore di pagina in tutto il percorso', errs.length === 0, errs.slice(0, 3));
    await p.close();
    console.log(`\nESITO prima riapertura: ${firstVerdict}; seconda: ${second}`);
  } finally { await browser.close(); server.closeAllConnections && server.closeAllConnections(); server.close(); for (const d of [A, B]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERRORE', e.stack || e.message); try { server.close(); } catch (_) {} process.exit(1); });
