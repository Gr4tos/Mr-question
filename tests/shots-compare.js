// Affianca le schermate dell'app (cartella di shots-party.js) a quelle di design/design-reference.html.
// Uso: node shots-compare.js [cartella-app] [cartella-uscita]   (di norma: shots/party-dark -> shots/compare)
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = path.resolve(process.argv[2] || path.join(__dirname, 'shots', 'party-dark'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'shots', 'compare'));
fs.mkdirSync(OUT, { recursive: true });
const REF = 'file:///' + path.join(__dirname, '..', 'design', 'design-reference.html').replace(/\\/g, '/');
// [titolo del riferimento, file dell'app]
const PAIRS = [
  ['1 · Menù iniziale', '01-menu'],
  ['2 · Sala d\'attesa', '11-sala'],
  ['3 · Il tuo fascicolo (tappa 3)', '03-turno-chiuso'],
  ['4 · Chi ha deposto', '13-online-attesa'],
  ['5 · Riepilogo', '14-online-riepilogo'],
  ['6 · Voto', '15-online-voto'],
  ['7 · Verdetto', '16-online-verdetto']
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
    await page.goto(REF, { waitUntil: 'networkidle0' });
    const phones = await page.$$('.phone');
    for (let i = 0; i < phones.length; i++) await phones[i].screenshot({ path: path.join(OUT, `ref-${i + 1}.png`) });
    const url = f => 'file:///' + f.replace(/\\/g, '/');
    for (let i = 0; i < PAIRS.length; i++) {
      const [title, file] = PAIRS[i];
      const html = `<body style="margin:0;background:#0d0908;font-family:sans-serif;color:#a8957a"><div style="display:flex;gap:24px;padding:20px;align-items:flex-start">
        <figure style="margin:0"><figcaption style="margin-bottom:8px">RIFERIMENTO — ${title}</figcaption><img src="${url(path.join(OUT, `ref-${i + 1}.png`))}" style="height:844px;display:block"></figure>
        <figure style="margin:0"><figcaption style="margin-bottom:8px">APP — ${file} (390×844)</figcaption><img src="${url(path.join(APP, file + '.png'))}" style="height:844px;display:block"></figure></div></body>`;
      const tmp = path.join(OUT, `_pair-${i + 1}.html`);
      fs.writeFileSync(tmp, html);
      const p2 = await browser.newPage();
      await p2.setViewport({ width: 900, height: 920 });
      await p2.goto(url(tmp), { waitUntil: 'networkidle0' });
      await p2.screenshot({ path: path.join(OUT, `confronto-${i + 1}.png`), fullPage: true });
      await p2.close(); fs.unlinkSync(tmp);
    }
    console.log('confronti in', OUT);
  } finally { await browser.close(); }
})().catch(e => { console.log('ERRORE', e.stack || e.message); process.exit(1); });
