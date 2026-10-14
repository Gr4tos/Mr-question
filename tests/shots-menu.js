// Screenshot e misure del menù iniziale, della Home a un telefono e del menù online (due schermi).
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./fake/harness');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const h = await startHarness();
  try {
    for (const [w, hgt] of [[375, 667], [390, 844]]) {
      const p = await h.newPlayer(`m${w}`, { width: w, height: hgt });
      await p.open();
      await p.page.evaluate(async () => document.fonts.ready);
      const m = () => p.page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const act = document.querySelector('.screen.active');
        const first = act.firstElementChild.getBoundingClientRect(), card = document.querySelector('.screen.active .setup-card');
        const c = card ? card.getBoundingClientRect() : null;
        return { screen: act.id, hOver: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrollH: document.documentElement.scrollHeight, vh: innerHeight, cardBottom: c && Math.round(c.bottom), cardRight: c && Math.round(c.right), topbarBottom: Math.round(r('.topbar').bottom), firstTop: Math.round(first.top) };
      });
      console.log(`${w}x${hgt} menù:`, JSON.stringify(await m()));
      await p.page.screenshot({ path: path.join(OUT, `menu-${w}x${hgt}.png`) });
      await p.click('#goLocal'); await p.settle();
      console.log(`${w}x${hgt} un telefono:`, JSON.stringify(await m()));
      await p.page.screenshot({ path: path.join(OUT, `local-${w}x${hgt}.png`) });
      await p.click('#backToMenu'); await p.settle();
      await p.click('#goOnline'); await p.waitScreen('onMenuScreen');
      console.log(`${w}x${hgt} menù online:`, JSON.stringify(await m()));
      await p.page.screenshot({ path: path.join(OUT, `onmenu-${w}x${hgt}.png`), fullPage: true });
    }
  } finally { await h.stop(); }
})();
