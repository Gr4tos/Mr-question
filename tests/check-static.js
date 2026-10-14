// Controlli statici di CLAUDE.md: sintassi, ID usati/duplicati, file di ASSETS, icone del manifest, cache.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let bad = 0;
const check = (label, ok, extra) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`); };

for (const [f, mod] of [['app.js', false], ['sw.js', false], ['config.js', false], ['online.js', true]]) {
  const r = mod ? spawnSync(process.execPath, ['--input-type=module', '--check'], { input: read(f) }) : spawnSync(process.execPath, ['--check', path.join(ROOT, f)]);
  check(`sintassi ${f}`, r.status === 0, r.stderr && r.stderr.toString().slice(0, 200));
}
const html = read('index.html');
const ids = [...html.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
check('nessun ID duplicato in index.html', dup.length === 0, dup.join(','));
for (const f of ['app.js', 'online.js']) {
  const used = [...new Set([...read(f).matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]))];
  const missing = used.filter(x => !ids.includes(x));
  check(`${f}: ${used.length} ID usati con $('...') esistono tutti in index.html`, missing.length === 0, missing.join(','));
}
const extra = ['homeError', 'answerError', 'resultError', 'menuError'];
check('ID dei messaggi di errore (usati via showError) esistono', extra.every(x => ids.includes(x)));
const sw = read('sw.js');
const assets = [...sw.match(/const ASSETS=\[(.*?)\]/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
const missingAssets = assets.filter(a => !fs.existsSync(path.join(ROOT, a)));
check(`tutti i ${assets.length} file di ASSETS esistono`, missingAssets.length === 0, missingAssets.join(','));
check('online.js e\' in ASSETS; l\'SDK Firebase e le licenze no', assets.includes('online.js') && !assets.some(a => a.includes('vendor/firebase') || /LICENSE|OFL/i.test(a)));
const manifest = JSON.parse(read('manifest.webmanifest'));
const missingIcons = manifest.icons.map(i => i.src).filter(s => !fs.existsSync(path.join(ROOT, s)));
check('icone del manifest esistono', missingIcons.length === 0, missingIcons.join(','));
const vend = fs.readdirSync(path.join(ROOT, 'assets/vendor/firebase'));
check('SDK Firebase locale: nessun import da Internet', vend.every(f => !/https?:\/\//.test(read(`assets/vendor/firebase/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').match(/from"https?:[^"]*"/g)?.join('') || '')), vend.join(','));
console.log('cache:', sw.match(/CACHE='([^']+)'/)[1]);
process.exit(bad ? 1 : 0);
