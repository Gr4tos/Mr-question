// Tema chiaro / scuro. Si carica in <head>, subito dopo il foglio di stile e senza defer:
// cosi' il tema giusto e' applicato prima del primo disegno (nessun lampo di colore).
// Scelte: 'auto' (segue prefers-color-scheme, predefinito), 'light', 'dark'. Salvata in localStorage (mq_theme).
(function () {
  var KEY = 'mq_theme', root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function read() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function resolve(pref) { return pref === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : pref; }
  function apply(pref) {
    root.setAttribute('data-theme', resolve(pref));
    root.setAttribute('data-theme-pref', pref);
    // il colore della barra del browser segue il fondo del tema (variabile --ink)
    var meta = document.querySelector('meta[name="theme-color"]');
    var ink = getComputedStyle(root).getPropertyValue('--ink').trim();
    if (meta && ink) meta.setAttribute('content', ink);
  }
  function set(pref) {
    if (pref !== 'light' && pref !== 'dark') pref = 'auto';
    try { localStorage.setItem(KEY, pref); } catch (e) { /* modalita' privata: vale solo per questa sessione */ }
    apply(pref);
  }
  function onSystemChange() { if (read() === 'auto') apply('auto'); }
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', onSystemChange); else if (mq.addListener) mq.addListener(onSystemChange); }
  window.MQTheme = { get: read, set: set };
  apply(read());
})();
