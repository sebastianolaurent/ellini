# Eleonora & Luca - Sito Matrimonio

Landing page statica con invito, logistica evento, mappa, sezione regalo e galleria foto invitati con upload su Supabase Storage.

## Stack

- HTML/CSS/JS vanilla (nessun framework)
- [Supabase JS v2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2) per upload/lista foto
- MapKit JS (Apple) con fallback MapLibre

## Struttura Progetto

- `index.html`: pagina principale invito
- `gallery.html`: pagina con album completo
- `script.js`: logica principale (mappa, calendario, IBAN, upload e preview galleria home)
- `gallery-page.js`: logica album completo + infinite scroll
- `config.js`: configurazioni runtime (MapKit + Supabase)
- `styles.css`: stile globale
- `assets/`: immagini e file calendario (`.ics`)
- `CNAME`: dominio custom GitHub Pages

## Riferimenti Ambiente

- Dominio pubblico: `https://lucaeleonora.com`
- Repository GitHub: `https://github.com/sebastianolaurent/ellini`
- Branch principale: `main`

## Riferimenti Supabase / Bucket

Configurazione attuale in `config.js`:

- Project URL: `https://edontmlcteelyjrqxnzf.supabase.co`
- Bucket: `wedding-photos`
- Client side key: `anonKey` (usata dal frontend)

Il frontend carica e legge direttamente dal bucket root:

- Home (`script.js`): mostra fino a 6 foto recenti
- Album (`gallery-page.js`): paginazione/infinite scroll (`PAGE_SIZE = 80`)
- Formato upload: conversione/ottimizzazione JPEG con limite `1.5MB` per foto

## Naming File Upload

I file vengono salvati con prefisso timestamp + UUID:

- Home: `<timestamp>-<uuid>--<author-slug>--<nome>.jpg`
- Gallery page: `<timestamp>-<uuid>-<nome>.jpg`

## Avvio Locale

Essendo un sito statico, puoi usare un server HTTP semplice nella root progetto:

```bash
python3 -m http.server 8080
```

Poi apri: `http://localhost:8080`

Nota: in locale MapKit usa fallback (MapLibre), mentre il token MapKit è previsto per il dominio pubblico.

## Deploy

Progetto pensato per GitHub Pages con dominio custom (`CNAME`).

Flusso tipico:

1. Commit su `main`
2. Push su GitHub
3. Pubblicazione automatica su Pages (se configurata lato repository)

## Note Operative

- Se cambia il bucket o il progetto Supabase, aggiorna `window.SUPABASE_CONFIG` in `config.js`.
- Se scade o cambia autorizzazione mappe Apple, aggiorna `productionToken` in `config.js`.
- `anonKey` non è una secret key server-side, ma le policy del bucket devono essere corrette (lettura/scrittura solo come previsto).
