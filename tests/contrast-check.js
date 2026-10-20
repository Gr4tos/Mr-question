// Contrasto WCAG AA dei due temi, calcolato dai token di style.css (blocchi :root e :root[data-theme="light"]).
// Testo normale: almeno 4,5:1. Elementi grafici e testo molto grande (titoli, icone, timbri grandi): almeno 3:1.
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

function block(selector, src = css) {
  const start = src.indexOf(selector + '{');
  if (start < 0) throw new Error('blocco non trovato: ' + selector);
  const end = src.indexOf('\n}', start);
  const out = {};
  for (const m of src.slice(start, end).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const dark = block(':root');
// con un argomento (file CSS con un blocco :root[data-theme="light"]) si prova una proposta di tema chiaro senza toccare style.css
const lightSrc = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : css;
const light = { ...dark, ...block(':root[data-theme="light"]', lightSrc) };
const themes = { scuro: dark, chiaro: light };

function val(t, name, depth = 0) {
  let v = t[name];
  if (v == null) throw new Error('token mancante: ' + name);
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  if (ref && depth < 5) return val(t, ref[1], depth + 1);
  return v;
}
// colore opaco di un token; se è rgba() lo fonde sul colore di sotto ("token@sotto")
function solid(t, spec) {
  const [name, under] = spec.split('@');
  const v = val(t, name);
  const m = v.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (!m) return v;
  const base = val(t, under || 'ink');
  const b = [1, 3, 5].map(i => parseInt(base.slice(i, i + 2), 16));
  const mix = [1, 2, 3].map((k, i) => Math.round(Number(m[k]) * Number(m[4]) + b[i] * (1 - Number(m[4]))));
  return '#' + mix.map(x => x.toString(16).padStart(2, '0')).join('');
}
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const PAGE = ['ink', 'bg-g1', 'bg-g2'];
const PAPER = ['paper', 'paper-2', 'paper-3'];
// sfondi trasparenti (tessere, selezione, pulsanti tondi) fusi sui tre colori del fondo
const over = name => PAGE.map(p => `${name}@${p}`);
// [descrizione, token primo piano, token sfondi, minimo]
const PAIRS = [
  ['testo e titoli sul fondo', 'on-bg', PAGE, 4.5],
  ['sottotitoli sul fondo', 'on-bg-2', PAGE, 4.5],
  ['etichette sul fondo ("Indietro", note)', 'on-bg-3', PAGE, 4.5],
  ['rosso timbro come testo sul fondo (timbro, eyebrow, avvisi)', 'stamp-top', PAGE, 4.5],
  ['giallo come testo sul fondo (titoli evidenziati)', 'hi-top', PAGE, 4.5],
  ['icone del selettore tema sul fondo', 'on-bg-3', PAGE, 3],
  ['testo sulle tessere (risposte, voto)', 'on-bg', over('tile'), 4.5],
  ['sottotitolo della modalità sulla tessera', 'on-bg-2', over('tile'), 4.5],
  ['numeri gialli sulle tessere', 'hi-top', over('tile'), 4.5],
  ['testo sulla tessera selezionata', 'on-bg', over('sel-bg'), 4.5],
  ['segno di spunta rosso sulla tessera selezionata', 'stamp-top', over('sel-bg'), 3],
  ['testo del pulsante secondario', 'on-bg', over('tile-2'), 4.5],
  ['testo sulle schede', 'paper-ink', PAPER, 4.5],
  ['testo secondario sulle schede', 'paper-ink2', PAPER, 4.5],
  ['etichette piccole sulle schede', 'paper-ink3', PAPER, 4.5],
  ['rosso timbro come testo sulle schede', 'stamp', PAPER, 4.5],
  ['segnaposto dei campi', 'placeholder', ['paper-3'], 4.5],
  ['contorno rosso delle schede e dei campi', 'stamp', PAPER, 3],
  ['testo rosso scuro su rosso tenue (avvisi, conferme)', 'stamp-ink', ['stamp-bg'], 4.5],
  ['icone dei pulsanti tondi (uscita, ?) sul loro cerchio', 'on-bg', over('round-bg'), 3],
  ['numero del posto sulla tessera', 'badge-ink', ['badge-bg'], 4.5],
  ['numero del posto (cerchio) sulla tessera', 'badge-bg', over('tile'), 3],
  ['spunta "ha risposto" sul suo cerchio', 'ok-ink', ['ok'], 3],
  ['cerchio verde della spunta sulla tessera', 'ok', over('tile'), 3],
  ['spunta della selezione sul suo cerchio rosso', 'chk-ink', ['stamp-top'], 3],
  ['testo sulla tessera "tu"', 'on-bg', over('me-bg'), 4.5],
  ['bordo della tessera "tu"', 'me-line', PAGE, 3],
  ['"In arrivo" (tessera vuota) sul fondo', 'empty-ink', PAGE, 4.5],
  ['etichette morbide sul fondo (scegli modalità)', 'label-soft', PAGE, 4.5],
  ['etichette morbide sulle tessere ("1 VOTO")', 'label-soft', over('tile'), 4.5],
  ['pallino "scollegato" sulle tessere', 'dot-off', over('tile'), 3],
  ['codice del caso', 'code-ink', ['code-bg'], 4.5],
  ['etichetta del codice', 'code-label', ['code-bg'], 4.5],
  ['testo sul pulsante principale giallo', 'btn-ink', ['btn-bg'], 4.5],
  ['sottotitolo sulla modalità gialla', 'btn-sub', ['btn-bg'], 4.5],
  ['icona sulla modalità gialla', 'btn-ink', over('btn-ic').map(x => x.replace(/@.*/, '@btn-bg')), 3],
  ['"spessore" del pulsante giallo sul fondo (riconoscibilità del pulsante)', 'btn-edge', PAGE, 3],
  ['tasto + / - premuto', 'paper-ink2', ['paper-press'], 4.5],
  ['sagoma: punto di domanda sul giallo', 'emblem-mark', ['emblem'], 3],
];
// sagoma: nel tema scuro basta il giallo sul fondo; nel chiaro serve il contorno scuro
const AV = ['av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6', 'av-7'];
const AVATAR = {
  scuro: [...AV.map(a => [`sagoma ${a} sul fondo e sulle tessere`, a, [...PAGE, ...over('tile')], 3]), ...AV.map(a => [`punto di domanda su ${a}`, 'av-mark', [a], 3])],
  chiaro: [['contorno delle sagome sul fondo e sulle tessere', 'av-outline', [...PAGE, ...over('tile')], 3], ...AV.map(a => [`${a} dentro il contorno`, a, ['av-outline'], 3]), ...AV.map(a => [`punto di domanda su ${a}`, 'av-mark', [a], 3])]
};
const EMBLEM = {
  scuro: [['sagoma gialla sul fondo', 'emblem', PAGE, 3]],
  chiaro: [['contorno della sagoma sul fondo', 'emblem-outline', PAGE, 3], ['sagoma gialla dentro il contorno', 'emblem', ['emblem-outline'], 3]]
};

let bad = 0, n = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n== tema ${name} ==`);
  for (const [desc, fg, bgs, min] of [...PAIRS, ...EMBLEM[name], ...AVATAR[name]]) {
    const f = val(t, fg);
    const worst = Math.min(...bgs.map(b => ratio(f, solid(t, b))));
    const ok = worst >= min;
    n++; if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${worst.toFixed(2).padStart(5)} (min ${min}) ${desc} [${fg} ${f} su ${bgs.join('/')}]`);
  }
}
console.log(`\nRISULTATO: ${n - bad} contrasti su ${n} sufficienti, ${bad} insufficienti`);
process.exit(bad ? 1 : 0);
