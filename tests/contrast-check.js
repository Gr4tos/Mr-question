// Contrasto WCAG AA dei due temi, calcolato dai token di style.css (blocchi :root e :root[data-theme="light"]).
// Testo normale: almeno 4,5:1. Elementi grafici e testo molto grande (titoli, icone, timbri grandi): almeno 3:1.
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

function block(selector) {
  const start = css.indexOf(selector + '{');
  if (start < 0) throw new Error('blocco non trovato: ' + selector);
  const end = css.indexOf('\n}', start);
  const out = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const dark = block(':root');
const light = { ...dark, ...block(':root[data-theme="light"]') };
const themes = { scuro: dark, chiaro: light };

function val(t, name, depth = 0) {
  let v = t[name];
  if (v == null) throw new Error('token mancante: ' + name);
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  if (ref && depth < 5) return val(t, ref[1], depth + 1);
  return v;
}
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const PAGE = ['ink', 'bg-g1', 'bg-g2'];
const PAPER = ['paper', 'paper-2', 'paper-3'];
// [descrizione, token primo piano, token sfondi, minimo]
const PAIRS = [
  ['testo e titoli sul fondo', 'on-bg', PAGE, 4.5],
  ['sottotitoli sul fondo', 'on-bg-2', PAGE, 4.5],
  ['etichette sul fondo (numero del caso, "Indietro", note)', 'on-bg-3', PAGE, 4.5],
  ['rosso timbro come testo sul fondo (timbro, eyebrow, avvisi)', 'stamp-top', PAGE, 4.5],
  ['giallo come testo sul fondo (titoli evidenziati)', 'hi-top', PAGE, 4.5],
  ['verde del verdetto sul fondo (simbolo grande)', 'green', PAGE, 3],
  ['icone del selettore tema e dell\'uscita sul fondo', 'on-bg-3', PAGE, 3],
  ['testo sulle schede', 'paper-ink', PAPER, 4.5],
  ['testo secondario sulle schede', 'paper-ink2', PAPER, 4.5],
  ['etichette piccole sulle schede', 'paper-ink3', PAPER, 4.5],
  ['rosso timbro come testo sulle schede', 'stamp', PAPER, 4.5],
  ['segnaposto dei campi', 'placeholder', ['paper-3'], 4.5],
  ['contorno rosso delle schede e dei campi', 'stamp', PAPER, 3],
  ['verde (pallino collegato) sulle sottoschede', 'green', ['paper-2'], 3],
  ['testo rosso scuro su rosso tenue (avvisi, conferme)', 'stamp-ink', ['stamp-bg', 'stamp-tint-2'], 4.5],
  ['testo sulle schede su rosso tenue', 'paper-ink', ['stamp-bg'], 4.5],
  ['testo secondario su rosso tenue (Cambia scelta)', 'paper-ink2', ['stamp-bg'], 4.5],
  ['etichette su rosso tenue', 'paper-ink3', ['stamp-bg'], 4.5],
  ['testo su giallo tenue (domanda comune)', 'paper-ink', ['hi-bg'], 4.5],
  ['etichetta gialla su giallo tenue', 'hi-ink', ['hi-bg'], 4.5],
  ['testo sul tasto beige', 'key-ink', ['key-top', 'key-bot'], 4.5],
  ['testo sull\'avatar', 'paper-ink', ['avatar-bg'], 4.5],
  ['tasto + / - premuto', 'paper-ink2', ['paper-press'], 4.5],
  ['sagoma: punto di domanda sul giallo', 'emblem-mark', ['emblem'], 3],
];
// sagoma: nel tema scuro basta il giallo sul fondo; nel chiaro serve il contorno scuro
const EMBLEM = {
  scuro: [['sagoma gialla sul fondo', 'emblem', PAGE, 3]],
  chiaro: [['contorno della sagoma sul fondo', 'emblem-outline', PAGE, 3], ['sagoma gialla dentro il contorno', 'emblem', ['emblem-outline'], 3]]
};

let bad = 0, n = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n== tema ${name} ==`);
  for (const [desc, fg, bgs, min] of [...PAIRS, ...EMBLEM[name]]) {
    const f = val(t, fg);
    const worst = Math.min(...bgs.map(b => ratio(f, val(t, b))));
    const ok = worst >= min;
    n++; if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${worst.toFixed(2).padStart(5)} (min ${min}) ${desc} [${fg} ${f} su ${bgs.join('/')}]`);
  }
}
console.log(`\nRISULTATO: ${n - bad} contrasti su ${n} sufficienti, ${bad} insufficienti`);
process.exit(bad ? 1 : 0);
