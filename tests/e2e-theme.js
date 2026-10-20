// Tema chiaro / scuro / automatico: scelta, memoria, nessun lampo, theme-color, selettore, conferma di uscita opaca.
const { startHarness } = require('./fake/harness');
let passes = 0, fails = 0;
const check = (label, cond, extra) => { if (cond) passes++; else fails++; console.log(`${cond ? 'OK  ' : 'FAIL'} - ${label}${extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); };

const info = p => p.page.evaluate(() => {
  const root = document.documentElement, cs = getComputedStyle(root);
  const meta = document.querySelector('meta[name="theme-color"]').getAttribute('content');
  return {
    theme: root.getAttribute('data-theme'), pref: root.getAttribute('data-theme-pref'), meta,
    ink: cs.getPropertyValue('--ink').trim(), saved: localStorage.getItem('mq_theme'),
    checked: ['themeLight', 'themeAuto', 'themeDark'].map(id => document.getElementById(id).getAttribute('aria-checked')).join(','),
    bodyBg: getComputedStyle(document.body).backgroundImage.slice(0, 40)
  };
});
const firstFrame = p => p.page.evaluate(() => window.__firstFrame);

async function open(h, label, scheme, preset) {
  const p = await h.newPlayer(label);
  await p.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await p.page.evaluateOnNewDocument(() => { requestAnimationFrame(() => { window.__firstFrame = document.documentElement.getAttribute('data-theme'); }); });
  if (preset) await p.page.evaluateOnNewDocument(v => { try { localStorage.setItem('mq_theme', v); } catch (e) { /* ignora */ } }, preset);
  await p.open();
  return p;
}

(async () => {
  const h = await startHarness();
  try {
    // 1) valore iniziale: Scuro, anche con il sistema chiaro; Automatico (da scegliere) segue il sistema
    let p = await open(h, 'iniziale-scuro', 'light');
    let i = await info(p);
    check('senza scelta salvata: Scuro, anche se il sistema è chiaro', i.pref === 'dark' && i.theme === 'dark' && i.checked === 'false,false,true', i);
    check('il tema è applicato già al primo fotogramma (nessun lampo)', (await firstFrame(p)) === 'dark');
    check('theme-color segue il fondo del tema (scuro)', i.meta === i.ink && i.ink.toLowerCase() === '#150d0b', [i.meta, i.ink]);
    await p.click('#themeAuto'); await p.settle(100);
    i = await info(p);
    check('"Automatico" con sistema chiaro: tema chiaro, theme-color del chiaro', i.theme === 'light' && i.pref === 'auto' && i.meta === i.ink && i.ink.toLowerCase() === '#ddcca6', i);
    await p.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await p.settle(200);
    i = await info(p);
    check('Automatico: se il sistema passa a scuro, la pagina lo segue subito, con theme-color', i.theme === 'dark' && i.meta === i.ink && i.ink.toLowerCase() === '#150d0b', i);

    // 2) scelta esplicita e memoria
    await p.click('#themeLight'); await p.settle(100);
    i = await info(p);
    check('"Chiaro" vince sul sistema scuro, è salvato e il selettore lo mostra', i.theme === 'light' && i.saved === 'light' && i.pref === 'light' && i.checked === 'true,false,false', i);
    await p.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]); await p.settle(100);
    await p.click('#themeDark'); await p.settle(100);
    i = await info(p);
    check('"Scuro" vince sul sistema chiaro, theme-color scuro', i.theme === 'dark' && i.saved === 'dark' && i.meta.toLowerCase() === '#150d0b' && i.checked === 'false,false,true', i);
    await p.page.reload({ waitUntil: 'networkidle0' });
    i = await info(p);
    check('dopo la ricarica la scelta resta (e dal primo fotogramma)', i.theme === 'dark' && i.checked === 'false,false,true' && (await firstFrame(p)) === 'dark', i);
    await p.click('#themeAuto'); await p.settle(100);
    i = await info(p);
    check('"Automatico" torna a seguire il sistema (chiaro) e viene salvato', i.theme === 'light' && i.pref === 'auto' && i.saved === 'auto', i);

    // 3) selettore: area di tocco, ruoli
    const boxes = await p.page.evaluate(() => ['themeLight', 'themeAuto', 'themeDark'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    check('i tre pulsanti del tema hanno area di tocco di almeno 44×44', boxes.every(([w, hh]) => w >= 44 && hh >= 44), boxes);
    const roles = await p.page.evaluate(() => ({ group: document.getElementById('themePicker').getAttribute('role'), radios: [...document.querySelectorAll('#themePicker [role=radio]')].map(b => b.getAttribute('aria-label')) }));
    check('selettore accessibile: gruppo di tre opzioni con etichette', roles.group === 'radiogroup' && roles.radios.join('|') === 'Tema chiaro|Tema automatico|Tema scuro', roles);
    const order = await p.page.evaluate(() => [...document.querySelectorAll('#themePicker button')].map(b => b.id).join(','));
    check('ordine: chiaro, automatico, scuro', order === 'themeLight,themeAuto,themeDark', order);
    check('il selettore sta solo nel menù iniziale', !(await (async () => { await p.click('#goLocal'); await p.waitScreen('homeScreen'); return p.visible('#themePicker'); })()));
    await p.close();

    // 4) sagoma, conferma di uscita opaca, colori in entrambi i temi
    for (const [scheme, pick] of [['dark', 'dark'], ['light', 'light']]) {
      p = await open(h, `uscita-${pick}`, scheme, pick);
      const outline = await p.page.evaluate(() => { const s = getComputedStyle(document.querySelector('.emblem-face')); return { stroke: s.stroke, w: s.strokeWidth }; });
      check(`${pick}: contorno della sagoma ${pick === 'light' ? 'presente (scuro)' : 'assente'}`, pick === 'light' ? /43, 38, 32/.test(outline.stroke) && parseFloat(outline.w) > 0 : (/rgba\(0, 0, 0, 0\)|none/.test(outline.stroke) || parseFloat(outline.w) === 0), outline);
      await p.click('#goLocal'); await p.waitScreen('homeScreen'); await p.click('#startGame'); await p.waitScreen('turnScreen');
      await p.openSheet(); await p.type('#answerInput', '12');
      await p.click('#exitButton'); await p.settle(400);
      const d = await p.page.evaluate(() => {
        const e = document.getElementById('exitDialog'), cs = getComputedStyle(e);
        const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--ink'); document.body.append(probe);
        const ink = getComputedStyle(probe).color; probe.remove();
        return { bg: cs.backgroundColor, ink, opacity: cs.opacity, bgImage: cs.backgroundImage, covers: e.getBoundingClientRect().width === innerWidth && e.getBoundingClientRect().height === innerHeight, mainInert: document.querySelector('main').inert };
      });
      check(`${pick}: sfondo della conferma completamente opaco e col colore del fondo del tema`, d.bg === d.ink && /^rgb\(/.test(d.bg) && d.opacity === '1' && d.bgImage === 'none' && d.covers, d);
      check(`${pick}: la schermata sotto è inerte`, d.mainInert === true);
      await p.close();
    }
  } finally { await h.stop(); }
  console.log(`\nRISULTATO: ${passes} controlli superati, ${fails} falliti`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERRORE', e.message); process.exit(1); });
