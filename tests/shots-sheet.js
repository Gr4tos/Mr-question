// Affianca alcune schermate di una cartella di shots-party.js in un'unica immagine.
// Uso: node shots-sheet.js cartella uscita.png nome1 nome2 nome3 ...
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [dir, out, ...names] = process.argv.slice(2);
const url = f => 'file:///' + path.resolve(f).split(path.sep).join('/');
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  const imgs = names.map(n => `<figure style="margin:0"><figcaption style="color:#888;font:12px sans-serif;margin-bottom:6px">${n}</figcaption><img src="${url(path.join(dir, n + '.png'))}" style="width:390px;display:block;border:1px solid #444"></figure>`).join('');
  const tmp = path.resolve(out) + '.html';
  fs.writeFileSync(tmp, `<body style="margin:0;background:#222"><div style="display:flex;gap:16px;padding:16px">${imgs}</div></body>`);
  await p.setViewport({ width: 16 + names.length * 406, height: 900 });
  await p.goto(url(tmp), { waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.resolve(out), fullPage: true });
  fs.unlinkSync(tmp); await b.close();
})();
