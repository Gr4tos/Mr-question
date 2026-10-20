// Service worker. La versione viene da version.js (condiviso con la pagina; si aggiorna con "node tests/bump-version.js").
// - HTML, JS e CSS: prima la rete, con un timeout di 3 secondi; se non risponde (o è offline) si usa la copia in cache.
// - Le richieste di codice usano cache:'no-cache' (si rivalida sempre col server): la cache HTTP del browser (GitHub Pages: 10 minuti) non può restituire un file vecchio accanto a uno nuovo.
// - Il resto (font, icone, immagini, manifest): prima la cache.
// - Una versione nuova si installa in attesa e NON subentra da sola (unica eccezione: il passaggio dalla v21, vedi install): la pagina mostra il banner "Aggiorna" (solo nel menù e nel verdetto).
importScripts('./version.js');
const CACHE='mr-question-shell-'+self.MRQ_VERSION;
const ASSETS=['./','./index.html','./style.css','./app.js','./theme.js','./online.js','./config.js','./version.js','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png','./icon-192.png','./icon-512.png','./assets/fonts/inter-latin.woff2','./assets/fonts/special-elite-latin.woff2'];
const NET_TIMEOUT=3000;
let slowSince=0; // quando la rete non ha risposto in tempo: per i 20 secondi dopo non si riaspetta 3 secondi per ogni file, si parte subito dalla cache

self.addEventListener('install',event=>{
  // PASSAGGIO DALLA v21 (service worker "cache prima", cache "mr-question-shell-vNN"): la v21 non ha il banner e, se l'app resta aperta o in background,
  // questo service worker resterebbe in attesa all'infinito (la gente vedrebbe sempre la v21). Solo se esiste quella vecchia cache subentra subito.
  // Le versioni successive (cache con l'impronta, non "vNN") NON lo fanno: si aggiornano dal banner.
  event.waitUntil(caches.keys().then(keys=>{if(keys.some(k=>/^mr-question-shell-v[0-9]+$/.test(k)))self.skipWaiting();}));
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(ASSETS.map(url=>
    fetch(new Request(url,{cache:'reload'})).then(res=>{if(!res.ok)throw new Error(url+' '+res.status);return cache.put(url,res);})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mr-question-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='SKIP_WAITING')self.skipWaiting();
  if(d.type==='VERSION'&&event.ports&&event.ports[0])event.ports[0].postMessage(self.MRQ_VERSION);
});

function isCode(req,url){
  return req.mode==='navigate'||/\.(html|js|css)$/.test(url.pathname)||url.pathname.endsWith('/');
}
async function networkFirst(req){
  const cache=await caches.open(CACHE);
  const net=fetch(req.url,{cache:'no-cache'}).then(res=>{if(res&&res.ok&&res.type==='basic')cache.put(req,res.clone());return res;});
  net.catch(()=>{}); // se arriva dopo il timeout aggiorna comunque la cache, senza errori in console
  const wait=Date.now()-slowSince<20000?0:NET_TIMEOUT;
  const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),wait));
  try{
    const first=await Promise.race([net,timeout]);
    if(first)return first;
    slowSince=Date.now();
    const hit=await cache.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await cache.match('./index.html'):null);
    return hit||await net; // niente copia (primo avvio): si aspetta la rete
  }catch(e){
    const hit=await cache.match(req,{ignoreSearch:true})||(req.mode==='navigate'?await cache.match('./index.html'):null);
    if(hit)return hit;
    return offlineResponse();
  }
}
const offlineResponse=()=>new Response('',{status:504,statusText:'offline'}); // niente copia e niente rete: risposta vuota, non un errore non gestito
async function cacheFirst(req){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(req);
  if(hit)return hit;
  try{
    const res=await fetch(req);
    if(res&&res.ok&&res.type==='basic')cache.put(req,res.clone());
    return res;
  }catch(e){return offlineResponse();}
}
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return; // tutto il traffico Firebase passa dritto, mai dalla cache
  event.respondWith(isCode(req,url)?networkFirst(req):cacheFirst(req));
});
