// Strumenti per i test end-to-end: server statico del progetto, finto backend e giocatori simulati
// (ognuno in un contesto di browser separato, come un telefono diverso, col finto SDK al posto di Firebase).
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { Backend } = require('./backend');
const SDK = require('./sdk');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

function staticServer() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('non trovato'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, () => resolve(s));
  });
}

class Player {
  constructor(h, label, page, ctx) { this.h = h; this.label = label; this.page = page; this.ctx = ctx; this.clientId = null; this.errors = []; this.dialogs = 0; this.requested = []; this.blockOnline = false; this.fakeSdk = true; this.logs = []; }

  async attach() {
    const { page, h } = this;
    await page.setBypassServiceWorker(true);
    page.on('pageerror', e => this.errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) this.errors.push(`console: ${m.text()}`); });
    page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warn' || t === 'warning') this.logs.push(`${t}: ${m.text()}`); });
    page.on('dialog', d => { this.dialogs++; d.dismiss(); });
    if (this.fakeSdk) {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const pathname = new URL(req.url()).pathname;
        this.requested.push(pathname);
        if (this.blockOnline && pathname === '/online.js') return req.abort();
        const m = pathname.match(/\/assets\/vendor\/firebase\/([\w-]+\.js)$/);
        if (m && SDK[m[1]]) return req.respond({ status: 200, contentType: 'text/javascript', body: SDK[m[1]] });
        return req.continue();
      });
    } else {
      // prove sul database vero: nessuna intercettazione (romperebbe le chiamate verso Firebase), solo registro delle richieste
      page.on('request', req => { this.requested.push(new URL(req.url()).pathname); });
    }
    await page.exposeFunction('__fbCall', async (op, args) => {
      if (op === 'hello') {
        if (this.clientId) await h.backend.removeClient(this.clientId);
        this.clientId = h.backend.addClient((id, msg) => this.push(id, msg));
        return { ok: true };
      }
      const res = h.backend.call(this.clientId, op, args);
      // come nel vero SDK: gli eventi locali arrivano prima della conferma dell'operazione
      const c = h.backend.clients.get(this.clientId);
      if (c) await c.queue;
      return res;
    });
  }

  push(id, msg) { return this.page.evaluate((i, m) => { if (window.__fbPush) window.__fbPush(i, m); }, id, msg).catch(() => {}); }

  // ---- azioni e letture ----
  async open() { await this.page.goto(this.h.url, { waitUntil: 'networkidle0' }); }
  screen() { return this.page.evaluate(() => { const a = document.querySelector('.screen.active'); return a ? a.id : null; }); }
  async waitScreen(id, timeout = this.h.timeout || 8000) {
    try { await this.page.waitForFunction(i => { const a = document.querySelector('.screen.active'); return a && a.id === i; }, { timeout }, id); }
    catch { throw new Error(`${this.label}: schermata attesa ${id}, trovata ${await this.screen()}`); }
  }
  async waitFor(fn, arg, timeout = this.h.timeout || 8000, what = 'condizione') {
    try { await this.page.waitForFunction(fn, { timeout }, arg); }
    catch { throw new Error(`${this.label}: timeout in attesa di ${what}`); }
  }
  click(sel) { return this.page.click(sel); }
  async type(sel, text) { await this.page.click(sel); await this.page.evaluate(s => { const e = document.querySelector(s); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel); if (text) await this.page.type(sel, text); }
  text(sel) { return this.page.$eval(sel, e => e.textContent.trim()); }
  value(sel) { return this.page.$eval(sel, e => e.value); }
  body() { return this.page.evaluate(() => document.body.innerText); }
  visible(sel) { return this.page.$eval(sel, e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'); }
  exists(sel) { return this.page.$(sel).then(Boolean); }
  disabled(sel) { return this.page.$eval(sel, e => e.disabled); }
  texts(sel) { return this.page.$$eval(sel, els => els.map(e => e.textContent.trim().replace(/\s+/g, ' '))); }
  rerender() { return this.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); }
  async settle(ms = 150) { await new Promise(r => setTimeout(r, ms)); await this.page.evaluate(() => new Promise(r => setTimeout(r, 30))); }

  async goOnline() { await this.open(); await this.click('#goOnline'); await this.waitScreen('onMenuScreen'); }
  async create(name) {
    await this.goOnline();
    await this.type('#onName', name);
    await this.click('#onCreate');
    await this.waitScreen('onLobbyScreen');
    return this.text('#lobbyCode');
  }
  async join(code, name) {
    await this.goOnline();
    await this.type('#onName', name);
    await this.type('#onCode', code);
    await this.click('#onJoin');
    await this.waitScreen('onLobbyScreen');
  }
  // apre il fascicolo del turno privato da tastiera (maniglia + Invio = apertura diretta) e aspetta il campo di risposta
  async openSheet() {
    const online = await this.page.evaluate(() => document.getElementById('onTurnScreen').classList.contains('active'));
    const handle = online ? '#onHandle' : '#turnHandle', field = online ? '#onAnswer' : '#answerInput';
    if (await this.page.$(field)) return; // già aperta
    await this.waitFor(s => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, handle, undefined, 'la maniglia del fascicolo');
    await this.page.focus(handle); await this.page.keyboard.press('Enter');
    await this.waitFor(s => !!document.querySelector(s), field, undefined, 'il campo di risposta');
  }
  async closeSheet() {
    await this.waitFor(() => [...document.querySelectorAll('.sheet-cover')].every(c => getComputedStyle(c).visibility === 'hidden' || !c.closest('.sheet').querySelector('.sheet-grabber')), null, undefined, 'la copertina sollevata');
    await this.page.click('.sheet-grabber');
    await this.waitFor(() => !document.querySelector('.sheet-grabber') && !document.getElementById('answerInput') && !document.getElementById('onAnswer'), null, undefined, 'la scheda chiusa');
  }
  // legge la domanda privata: apre la scheda, la legge, la richiude
  async readQuestion() {
    const online = await this.page.evaluate(() => document.getElementById('onTurnScreen').classList.contains('active'));
    await this.openSheet();
    const t = await this.text(online ? '#onQuestion' : '#questionText');
    await this.closeSheet();
    return t;
  }
  // il telefono perde la connessione / la ritrova
  offline() { this.h.backend.goOffline(this.clientId); return this.settle(); }
  online() { this.h.backend.goOnline(this.clientId); return this.settle(); }
  // risposta numerica nel proprio turno online
  async answer(value) {
    await this.openSheet();
    await this.type('#onAnswer', String(value));
    await this.click('#onSend');
    // l'ultimo a rispondere passa subito al riepilogo: va bene anche se "in attesa" non fa in tempo a comparire
    try { await this.page.waitForFunction(() => !document.getElementById('onWaitArea').classList.contains('hidden') || !document.getElementById('onTurnScreen').classList.contains('active'), { timeout: this.h.timeout || 8000 }); }
    catch { throw new Error(`${this.label}: la conferma "a verbale" non arriva (errore: "${await this.text('#onAnswerError')}", schermata: ${await this.screen()}, rifiuti: ${JSON.stringify(this.h.backend.denied.slice(-2))})`); }
  }
  // clic su "Entra" e attesa dell'esito (messaggio d'errore o cambio schermata), senza tempi fissi
  async tryJoin() {
    await this.click('#onJoin');
    await this.waitFor(() => document.getElementById('onMenuError').textContent.length > 0 || !document.getElementById('onMenuScreen').classList.contains('active'), null, 10000, "l'esito dell'ingresso");
  }
  async exit(confirm = true) {
    await this.click('#exitButton');
    await this.waitFor(() => !document.getElementById('exitDialog').classList.contains('hidden'), null, 4000, 'la conferma di uscita');
    if (confirm) await this.click('#exitConfirm'); else await this.click('#exitStay');
    await this.settle();
  }
  async close() { try { await this.ctx.close(); } catch { /* ignora */ } }
}

async function startHarness() {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
  const backend = new Backend(rules);
  const server = await staticServer();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const h = { backend, url, browser, players: [] };
  h.newPlayer = async (label, { width = 390, height = 844, random = null, fake = true } = {}) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = new Player(h, label, page, ctx);
    p.fakeSdk = fake;
    await p.attach();
    if (random !== null) await page.evaluateOnNewDocument(r => { Math.random = () => r; }, random);
    // MQ_THEME=light|dark|auto: scelta del tema per tutta la batteria di test (se la pagina non ne ha una salvata)
    if (process.env.MQ_THEME) await page.evaluateOnNewDocument(t => { try { if (!localStorage.getItem('mq_theme')) localStorage.setItem('mq_theme', t); } catch (e) { /* ignora */ } }, process.env.MQ_THEME);
    h.players.push(p);
    return p;
  };
  h.reset = async () => { await Promise.all(h.players.map(p => p.close())); h.players = []; h.backend = new Backend(rules); };
  h.stop = async () => { await browser.close(); await new Promise(r => server.close(r)); };
  return h;
}

module.exports = { startHarness };
