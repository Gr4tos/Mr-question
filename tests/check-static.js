// Controlli statici di CLAUDE.md: sintassi, ID usati/duplicati, file di ASSETS, icone del manifest, cache.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let bad = 0;
const check = (label, ok, extra) => { if (!ok) bad++; console.log(`${ok ? 'OK  ' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`); };

for (const [f, mod] of [['app.js', false], ['sw.js', false], ['config.js', false], ['theme.js', false], ['online.js', true]]) {
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
const extra = ['homeError', 'answerError', 'resultError', 'menuError', 'themeLight', 'themeAuto', 'themeDark'];
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
// tema: nessun colore scritto a mano fuori dai blocchi di token (:root e :root[data-theme="light"]), né in index.html
const css = read('style.css');
const afterTokens = css.slice(css.indexOf('*{ box-sizing')).replace(/\/\*[\s\S]*?\*\//g, '');
const stray = afterTokens.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || [];
check('CSS: nessun colore scritto a mano fuori dai token', stray.length === 0, stray.join(' '));
check('index.html: nessun colore scritto a mano (fill/stroke/style)', !/(fill|stroke|color|background)(=|:)\s*"?#[0-9a-fA-F]{3,8}/.test(html.replace(/<meta name="theme-color"[^>]*>/, '')));
check('theme.js è in ASSETS e caricato in <head> subito dopo il CSS', assets.includes('theme.js') && /<link rel="stylesheet" href="style\.css\?v=[0-9a-f]{10}">\s*<script src="theme\.js\?v=[0-9a-f]{10}"><\/script>/.test(html));
// versione unica: version.js aggiornato, caricato prima di app.js e importato dal service worker
const vr = spawnSync(process.execPath, [path.join(__dirname, 'bump-version.js'), '--check']);
check('version.js è aggiornato (altrimenti: node tests/bump-version.js)', vr.status === 0, String(vr.stdout).trim());
check('sw.js importa version.js e il nome della cache viene da lì (nessun numero a mano)', /importScripts\('\.\/version\.js'\)/.test(sw) && /CACHE='mr-question-shell-'\+self\.MRQ_VERSION/.test(sw) && !/CACHE='mr-question-shell-v\d/.test(sw));
check('version.js è in ASSETS e index.html lo carica prima di app.js', assets.includes('version.js') && /<script src="version\.js\?v=/.test(html) && html.indexOf('<script src="version.js?v=') < html.indexOf('<script src="app.js?v='));
check('gli indirizzi dei file in index.html e l\'import di online.js portano la versione (?v=...): niente file vecchi dalla cache del browser', ['style.css', 'theme.js', 'version.js', 'config.js', 'app.js'].every(f => html.includes(`${f}?v=`) && new RegExp(`${f.replace('.', '\\.')}\\?v=[0-9a-f]{10}`).test(html)) && read('app.js').includes("import('./online.js?v='+self.MRQ_VERSION)"));
check('viewport senza blocco dello zoom manuale', !/maximum-scale|user-scalable/i.test(html));
check('la cartella design/ non è servita né in ASSETS', !assets.some(a => a.startsWith('design/')));
console.log('versione:', read('version.js').match(/MRQ_VERSION='([^']+)'/)[1]);
process.exit(bad ? 1 : 0);
