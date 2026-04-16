# Widget Chat Assistente UnoERP

Widget JavaScript embeddabile per l'area riservata Uniwix. Fornisce una chat intelligente che risponde alle domande degli utenti basandosi sulle FAQ di UnoERP.

## Come si usa

Basta aggiungere **una riga** all'HTML dell'area riservata, prima del tag `</body>`:

```html
<script src="https://mihai-mm.github.io/faq-chat-widget/widget.js"></script>
```

Niente altro. Il widget si carica, si inizializza e appare un pulsante blu in basso a destra.

Demo live: https://mihai-mm.github.io/faq-chat-widget/

## Cosa fa

- Pulsante toggle sempre visibile in basso a destra
- Finestra chat 420×640 (fullscreen su mobile)
- Welcome message automatico all'apertura
- Conversazione multi-turno con memoria (sessionId persistente)
- Rendering markdown delle risposte (grassetto, liste, link)
- Link alle FAQ aprono in nuova scheda (non perdi la chat)
- Pulsante "Nuova conversazione" (icona refresh ↻) per resettare
- Chip visibile con ID conversazione (`#abc123`) per conferma visuale
- Messaggi persistenti: chiudi e riapri la pagina, la chat resta visibile
- Accessibilità: navigazione da tastiera, lettori di schermo, contrasto WCAG AA

## Configurazione

Il widget è pre-configurato per collegarsi al backend chatbot di Uniwix. Non serve alcuna configurazione aggiuntiva per il funzionamento base.

### Configurazione avanzata (per produzione)

Per associare la chat all'utente autenticato di UnoERP (e non al browser):

```html
<script
  src="https://mihai-mm.github.io/faq-chat-widget/widget.js"
  data-user-id="<?= $current_user_id ?>"
></script>
```

Vantaggi di passare l'userId:
- **Multi-device**: utente cambia computer, ritrova la sua conversazione
- **Computer condiviso**: utenti diversi vedono chat diverse, zero leak
- **Cronologia stabile**: il backend ricorda tutto lo storico di quell'utente

Se `data-user-id` non è presente, il widget genera un ID random legato al browser (modalità dev).

## Come si comporta il chatbot

- Risponde SOLO con informazioni presenti nelle FAQ di UnoERP
- Se la domanda è fuori ambito (es. meteo, sport), rifiuta educatamente
- Se la domanda è pertinente ma la FAQ non c'è, indica l'email di supporto `ticket@unoerp.it`
- Cita le fonti alla fine della risposta con link "Per approfondire:"

## Stile e branding

Palette minimale coerente con UnoERP:
- Primary blu `#1E5FBF`
- Header dark `#111827`
- Background chiaro `#FFFFFF` / `#F3F4F6`

Il widget è isolato dal CSS dell'area riservata (Shadow DOM), quindi non può sporcare o essere sporcato da altri stili della pagina.

## Hosting del file widget

Tre opzioni, in ordine di raccomandazione:

### Opzione 1 (consigliata per Uniwix): hosting interno
Uniwix scarica `widget.js` e lo mette sul proprio server. Lo include con:
```html
<script src="/assets/js/uniwix-chat-widget.js"></script>
```
**Vantaggi:** controllo totale, nessuna dipendenza esterna, aggiornamenti solo quando decide Uniwix.

### Opzione 2: GitHub Pages (attuale)
```html
<script src="https://mihai-mm.github.io/faq-chat-widget/widget.js"></script>
```
**Vantaggi:** zero setup, auto-deploy ad ogni push, gratis.
**Svantaggi:** dipendenza da GitHub Pages uptime (≈99.9%).

### Opzione 3: CDN esterna a scelta
Potete caricare il file su Cloudflare Pages, Vercel, AWS S3, o qualsiasi CDN statica. Basta aggiornare l'URL nel tag `<script>`.

## Aggiornamenti

Il widget è progettato per richiedere zero manutenzione ordinaria. Se Uniwix hosta il file internamente, gli aggiornamenti futuri si concorderanno e vi forniremo la nuova versione del file.

Se volete seguire gli aggiornamenti automatici via GitHub Pages, ogni modifica arriverà entro 1-2 minuti dal push sul repository.

## Test in locale

Per testare il widget localmente senza server:

```bash
cd chatbot-widget
python3 -m http.server 8765
```

Poi aprire http://localhost:8765/ nel browser.

Per resettare la sessione di test, aprire la console del browser ed eseguire:
```js
localStorage.clear()
```
poi ricaricare la pagina.

## Supporto

Per problemi, segnalazioni o richieste di modifica, contattare Mihai Moraru (mihai@onesecagent.com).
