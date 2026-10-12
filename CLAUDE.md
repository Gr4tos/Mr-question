# Mr Question? — contesto del progetto

Rispondi sempre in italiano. L'utente non è uno sviluppatore esperto: spiega cosa fai in modo semplice, una cosa alla volta. Non dichiarare mai file creati, test superati o funzioni operative senza averli verificati davvero.

## Cos'è

Party game investigativo con impostore, 3–7 giocatori, mobile-first (Safari iPhone in primis). Web app statica (HTML/CSS/JS, nessun build step, nessuna dipendenza npm) pubblicata su GitHub Pages dal branch `main`, cartella root.

Repository: https://github.com/Gr4tos/Mr-question (branch `main`; i file stanno direttamente nella root del repo, nessuna sottocartella)

## Struttura reale (verificata)

- `index.html` — tutte le schermate in un'unica pagina (`homeScreen`, `turnScreen`, `voteScreen`, `ballotScreen`, `resultScreen`)
- `style.css` — unico foglio di stile, direzione "dossier" (vedi sotto); i font sono caricati in locale con `@font-face` (nessun import da Google)
- `app.js` — tutta la logica, nessun framework
- `config.js` — `window.MRQ_CONFIG = { grokEndpoint: "" }` (vuoto)
- `sw.js` — service worker cache-first, nome cache `mr-question-shell-v9` (in `ASSETS` ci sono anche i due font)
- `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- `assets/fonts/` — `inter-latin.woff2` (Inter variabile, pesi 400–800, sottoinsieme latin) e `special-elite-latin.woff2`, più le licenze: `OFL-Inter.txt` (SIL OFL 1.1) e `LICENSE-SpecialElite-Apache-2.0.txt` (Special Elite è sotto Apache 2.0, non OFL). Le licenze non sono in `ASSETS`, di proposito.
- `assets/images/mr-question-logo.png` — in realtà è un JPEG opaco rinominato; nascosto di default (classe `logo-missing`)

Non esiste una cartella `worker/`: il Cloudflare Worker per Grok non è nel repository.

## Flusso di gioco (da preservare)

1. Home: stepper 3–7 giocatori, nomi facoltativi (campi vuoti con placeholder "Sospettato N"; un campo vuoto usa il placeholder come nome; i nomi effettivi devono essere diversi), "Apri le indagini". Il testo scritto nei campi sta in `state.inputs`, i nomi effettivi del round in `state.names`.
2. Turni privati: nome del giocatore, "Apri la scheda" rivela la domanda, risposta numerica, "Metti a verbale". Il telefono passa di mano.
3. Riepilogo pubblico: domanda comune + tutte le risposte.
4. Votazione con conferma esplicita.
5. Verdetto, "Riapri il caso" (rivincita stessi nomi) o "Nuovo fascicolo".

Regole fondamentali:
- L'impostore riceve una domanda alternativa e **non sa di essere l'impostore**. Nessun testo deve rivelarglielo. Vale anche per il futuro multiplayer.
- Domande e risposte private non devono mai comparire prima della fase pubblica.
- Le risposte sono **solo numeriche** (`input type="number"`, `confirmAnswer()` rifiuta il resto). Tutte le domande devono avere risposta numerica.
- Si evita, se possibile, lo stesso impostore del round precedente.

## Dettagli tecnici di app.js

- `$ = id => document.getElementById(id)`; usa 38 ID dell'HTML via `$('...')` (tra cui `caseStamp`, il timbro, e `exitButton`/`exitDialog`/`exitStay`/`exitConfirm` per l'uscita dalla partita), più `homeError`, `answerError`, `resultError` (messaggi di errore inline, usati da `showError()`/`clearErrors()`). **Non rinominarli** senza aggiornare tutti i riferimenti. Non si usa più `alert()`.
- 50 coppie di domande integrate in `BUILTIN` (formato `[comune, impostore, risp, risp, categoria]`).
- `localStorage`: `mq_bank` (archivio domande), `mq_used` (ID già usati), `mq_last` (ultimo impostore).
- `fetchLiveQuestions()` chiama `POST {grokEndpoint}/generate` solo se online e se l'endpoint non è vuoto; con endpoint vuoto il ramo non parte mai. Fallback automatico sulle domande locali.
- `addQuestions()` deduplica per coppia comune|impostore.
- Il README descrive una sezione "Archivio" con import/export JSON e prompt per Grok: **non è implementata** nell'interfaccia.

## Direzione artistica (approvata dall'utente)

"Dossier del detective dilettante": fondo scuro = tavolo d'archivio; schede di carta avorio appoggiate sopra. Interfaccia seria nella forma, ironia solo nei dettagli visivi (graffetta, timbro storto). Testi sobri ma con lessico investigativo: sospettati, indagini, deposizioni, metti a verbale, firma l'accusa, riapri il caso.

Token in `:root` di `style.css`: `--ink #15120d` (fondo), `--paper #efe7d6` (schede), `--stamp #a7332e` (rosso timbro), `--hi #d8b739` (giallo evidenziatore), `--emblem #f2c51c` / `--emblem-side #a87f0c` (sagoma).

Ruoli dei colori, da rispettare:
- rosso = ufficiale/stati (timbri, accusa, verdetto, etichette)
- giallo = indizio/azione (evidenziare, la domanda ufficiale)
- non mescolarli a caso

Tipografia: `--mono` (Special Elite, effetto macchina da scrivere) solo per etichette, numeri, timbri e pulsanti; `--sans` (Inter) per titoli, domande, risposte e nomi.

Pulsante principale `.primary-button`: barra spazio da macchina da scrivere, beige/crema, che affonda alla pressione.

Emblema Home: sagoma di detective (cappello a falda, colletto del trench, spalle) gialla con punto di domanda nero al posto del viso, con spessore "cartoncino" (copie sfalsate in `--emblem-side`) e ombra piatta. È definita come `<g id="mqSilhouette">` dentro `index.html`. La stessa sagoma è l'icona dell'app.

Home e topbar: nella topbar (su tutte le schermate) a sinistra "CASO N° 0037", a destra il timbro rosso inclinato `#caseStamp`: "CASO APERTO" ovunque, "CASO CHIUSO" sulla schermata del verdetto (lo cambia `showScreen()`; con "Riapri il caso" e "Nuovo fascicolo" torna "CASO APERTO"). Sotto il timbro c'è il tastino di uscita `#exitButton` (icona porta con freccia, solo SVG), visibile solo nelle schermate `turn`, `vote`, `ballot` (lo gestisce `showScreen()`). Apre la conferma `#exitDialog` ("Vuoi tornare al menù principale?" / "La partita in corso andrà persa."): "No, continua" è il pulsante principale (barra spazio) e chiude la conferma senza toccare la schermata; "Sì, torna al menù" è secondario (`.quiet-button`), azzera la partita (`state.round`, voto, domanda e risposta nel DOM) e torna alla Home mantenendo numero e nomi dei giocatori. Con la conferma aperta `<main>` è `inert`; Esc o tocco sullo sfondo equivalgono a "No, continua". Il timbro e il tastino stanno in `.topbar-right` (la topbar è allineata in alto: il timbro deve restare a 17px dal bordo della pagina nella Home, come approvato). Non c'è più l'indicatore di connessione: la logica online/offline resta solo in `startGame()`/`fetchLiveQuestions()` via `navigator.onLine`. Nella Home, il blocco sagoma + "MR QUESTION?" (`--mono`, 28px, "?" rosso timbro) + scheda è centrato in verticale; la graffetta sta sul bordo superiore destro della scheda e non deve toccare nessun testo (controllato a 375×667 e 390×844). Nessun footer, nessun titolo/slogan, nessuna riga sotto la scheda. Nei pulsanti principali l'icona sta a destra del testo; "Apri le indagini" ha l'icona SVG del tasto Invio (a tratto, `currentColor`).

Da evitare (richiesta esplicita dell'utente): emoji come icone, estetica generica "fatta dall'AI", glow/neon/gradienti decorativi messi a caso, card standard, illustrazioni che non servono al prodotto. Le illustrazioni si disegnano in SVG con forme geometriche nette (le sagome organiche "a mano libera" sono venute male).

## Regole di lavoro

- Prima di modificare, leggi i file coinvolti. Interventi mirati, niente riscritture totali non necessarie.
- Mantieni separati HTML, CSS e JS.
- Nessuna dipendenza esterna caricata a runtime: il gioco deve funzionare offline dopo la prima apertura.
- **Ogni volta che cambi un file servito**, incrementa `CACHE` in `sw.js` (v6 → v7 …), altrimenti i telefoni continuano a vedere la versione vecchia. Se aggiungi un file, aggiungilo anche ad `ASSETS`: se un file in `ASSETS` non esiste, `cache.addAll` fallisce e l'offline si rompe.
- Rispetta `prefers-reduced-motion`, le safe area di iPhone, la tastiera virtuale e gli schermi bassi (c'è già una media query `max-height: 740px`).
- Mai chiavi API nel codice distribuito al browser.
- Non sovrascrivere `config.js` senza motivo.

## Verifica dopo ogni modifica

- `node --check app.js sw.js config.js`
- ogni ID usato da `$('...')` in `app.js` esiste in `index.html`, nessun ID duplicato
- ogni file in `ASSETS` di `sw.js` e ogni icona del manifest esiste
- prova manuale con `python3 -m http.server 8080`: partita completa da 3 giocatori, poi da 7; verdetto corretto e sbagliato; rivincita; modalità offline (DevTools → Network → Offline dopo il primo caricamento)
- riporta chiaramente cosa hai testato e cosa resta da testare sul telefono vero

## Problemi noti / da fare

1. ~~Bug indicatore online/offline~~ — RISOLTO rimuovendo l'indicatore (pill e `setStatus()` non esistono più).
2. ~~Font non offline~~ — RISOLTO: font in `assets/fonts/`, `@font-face` con `font-display: swap`, file in `ASSETS` (cache v7).
3. Set di illustrazioni SVG da completare nello stesso stile della sagoma: sigillo del turno privato (ora un carattere `❋`), medaglione del verdetto (ora `✓`/`×`), graffetta (ora disegnata in CSS).
4. ~~Errori con `alert()`~~ — RISOLTO: nomi duplicati, risposta non numerica e "nessuna domanda" usano la fascetta `.inline-error` (rosso timbro, tratteggiata).
5. Il README non corrisponde all'app (Archivio/import JSON assente). Decidere se implementare l'Archivio o correggere il README.
6. Logo JPEG opaco: sostituire con un PNG/SVG trasparente o rimuoverlo.

## Roadmap (ordine deciso con l'utente)

1. Completare e rifinire la versione offline pass-and-play (punti sopra).
2. Party online: stanza con codice d'accesso, ognuno sul proprio telefono, backend Firebase (scelto per piano gratuito e sincronizzazione realtime). La modalità offline su un solo telefono deve restare. L'account Firebase lo crea l'utente: non inventare credenziali o configurazioni.
3. Pubblicazione sugli store (iPhone e Android). Da decidere: PWA impacchettata vs app nativa. Per l'App Store serve un Mac e un account Apple Developer.

Grok: decisione rimandata. Se si riprende, la chiave va solo in un backend (Worker o funzione Firebase), mai nel client.
