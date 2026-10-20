// Versione unica dell'app (version.js), condivisa da pagina e service worker.
// La versione è l'impronta (hash) di tutti i file serviti: se cambia un file, cambia la versione. Un solo comando:
//   node tests/bump-version.js          riscrive version.js e le impronte nei file
//   node tests/bump-version.js --check  controlla che sia tutto aggiornato (lo fa anche check-static.js / npm test)
// Impronte scritte anche dentro index.html (<meta name="mrq-version">), app.js (window.__MRQ_APP) e style.css (--mrq-version):
// index.html controlla a caricamento finito che portino tutte la stessa versione (altrimenti: file vecchio accanto a uno nuovo).
// Per calcolare l'impronta queste tre righe vengono azzerate (niente giro vizioso). I fine riga \r vengono ignorati.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ZERO = '0000000000';
// per ogni file: le espressioni che contengono l'impronta (gruppo 1 = prima, gruppo 2 = dopo). In index.html anche gli indirizzi dei file
// (style.css?v=…, app.js?v=…): un indirizzo nuovo a ogni versione impedisce al browser di riusare un file vecchio dalla sua cache.
const STAMPS = {
  'index.html': [/(<meta name="mrq-version" content=")[0-9a-f]{10}(")/g, /(\.(?:css|js)\?v=)[0-9a-f]{10}()/g],
  'app.js': [/(window\.__MRQ_APP=')[0-9a-f]{10}(')/g],
  'style.css': [/(--mrq-version:\s*")[0-9a-f]{10}(")/g]
};

function servedFiles() {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const assets = [...sw.match(/const ASSETS=\[(.*?)\]/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(f => f && f !== 'version.js');
  return [...new Set([...assets, 'sw.js'])].sort();
}
const read = f => fs.readFileSync(path.join(ROOT, f)).toString('latin1').replace(/\r/g, '');
function computeVersion() {
  const h = crypto.createHash('sha1');
  for (const f of servedFiles()) {
    let c = read(f);
    for (const re of STAMPS[f] || []) c = c.replace(re, `$1${ZERO}$2`);
    h.update(f + '\n'); h.update(c); h.update('\n');
  }
  return h.digest('hex').slice(0, 10);
}
const contents = v => `// Generato da tests/bump-version.js: non modificare a mano. Versione = impronta dei file serviti.\nself.MRQ_VERSION='${v}';\n`;
function stampsOf(v) {
  const bad = [];
  for (const [f, res] of Object.entries(STAMPS)) {
    for (const re of res) {
      const all = [...read(f).matchAll(re)];
      if (!all.length) bad.push(`${f}: impronta non trovata`);
      else if (all.some(m => !m[0].includes(v))) bad.push(`${f}: impronta vecchia`);
    }
  }
  return bad;
}

if (require.main === module) {
  const file = path.join(ROOT, 'version.js');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r/g, '') : '';
  if (process.argv.includes('--check')) {
    const v = computeVersion();
    const bad = stampsOf(v);
    const ok = current === contents(v) && bad.length === 0;
    console.log(ok ? `versione aggiornata: ${v}` : `versione NON aggiornata (serve ${v}${bad.length ? '; ' + bad.join(', ') : ''}): esegui "node tests/bump-version.js"`);
    process.exit(ok ? 0 : 1);
  }
  // scrive le impronte nei tre file (l'impronta non dipende da esse), poi version.js
  const v = computeVersion();
  let changed = [];
  for (const [f, res] of Object.entries(STAMPS)) {
    const p = path.join(ROOT, f);
    const raw = fs.readFileSync(p, 'utf8');
    let next = raw;
    for (const re of res) { if (!new RegExp(re.source).test(next)) throw new Error(`${f}: impronta non trovata`); next = next.replace(re, `$1${v}$2`); }
    if (next !== raw) { fs.writeFileSync(p, next); changed.push(f); }
  }
  if (current !== contents(v)) { fs.writeFileSync(file, contents(v)); changed.push('version.js'); }
  console.log(changed.length ? `aggiornato ${v}: ${changed.join(', ')}` : `già aggiornato: ${v}`);
}
module.exports = { computeVersion, servedFiles };
