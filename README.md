# Mr Question? — Offline Edition

Una web app installabile, mobile-first, per 3–7 giocatori. Il gioco e l'archivio incorporato funzionano localmente dopo la prima apertura. Non usa server, account o API durante la partita.

## Funzioni incluse
- Da 3 a 7 giocatori, nomi personalizzabili.
- Un impostore scelto casualmente e una domanda alternativa.
- Turni privati, un giocatore alla volta; le risposte non si vedono prima della fase pubblica.
- Domanda comune e tutte le risposte nella fase di discussione.
- Voto singolo con conferma esplicita e verdetto finale.
- Rivincita con gli stessi nomi e tentativo di evitare l'impostore del round precedente.
- Archivio locale, esportazione/importazione JSON, prompt pronto per Grok.
- Service worker per riaprire la web app offline dopo la prima visita online.

## Avvio locale per test
Apri un terminale in questa cartella ed esegui:

```bash
python3 -m http.server 8080
```

Apri `http://localhost:8080` sul computer. Per provare l'installazione PWA su un telefono, pubblica i file su un hosting statico HTTPS (per esempio GitHub Pages); apri il link una volta online e aggiungi alla schermata Home. Dopo il primo caricamento, il gioco è disponibile offline. Non aprire semplicemente `index.html` da file manager: i service worker richiedono HTTPS o localhost.

## Usare Grok per ampliare l'archivio
1. Apri Archivio → Prompt per Grok.
2. Copia il prompt in Grok e chiedi un pacchetto JSON.
3. Salva la risposta in un file `.json` senza testo o blocchi Markdown aggiuntivi.
4. In Mr Question? scegli Archivio → Importa pacchetto JSON.

Formato supportato:

```json
{
  "name": "Pacchetto Grok 001",
  "questions": [
    {
      "common": "Quanti lati ha un esagono?",
      "impostor": "Quanti lati ha un ottagono?",
      "commonAnswer": "6",
      "impostorAnswer": "8",
      "category": "matematica"
    }
  ]
}
```

Le proprietà `common` e `impostor` sono obbligatorie. Le risposte sono facoltative e non vengono mostrate ai giocatori. L'importazione elimina le coppie esattamente duplicate per domanda comune e alternativa.

## Nota tecnica
La PWA richiede una prima apertura online per scaricare i file. Una volta caricata e messa in cache, la partita non necessita di Internet. La generazione con Grok avviene separatamente e richiede Internet; i pacchetti importati sono poi disponibili offline. Questa cartella contiene il progetto sorgente, non un APK nativo.
