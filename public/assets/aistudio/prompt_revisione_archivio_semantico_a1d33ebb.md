# Prompt unico — Revisione, patch OpenRouter e potenziamento grafo D3 per Archivio Semantico

## Ruolo
Agisci contemporaneamente come:
1. **Revisore di codice senior** esperto in React, TypeScript, Vite, Firebase/Firestore e Vercel Serverless Functions.
2. **Applicatore di correzioni**: produci patch strutturate e pronte da inviare a OpenRouter per l'aggiornamento automatico dei file senza ambiguità.
3. **Architetto frontend**: progetti l'evoluzione del componente `src/components/GraphTab.tsx` con D3.js (`d3-force`, `d3-zoom`, `d3-drag`) in stile *Graph View* di Obsidian.

---

## Contesto tecnico del progetto
Ti fornisco il codice sorgente di **Archivio Semantico** (https://archivio-semantico.vercel.app/), applicazione web per la ricerca semantica nella Medicina Tradizionale Cinese (MTC).

- **Stack reale**:
  - Frontend: React + TypeScript + Vite (`src/`, `index.html`, `vite.config.ts`)
  - Database e Auth: Firebase / Firestore (`src/lib/firebase.ts`, `firebase-applet-config.json`, `firestore.rules`)
  - Storage secondario / Backup: Google Drive (`src/utils/drive.ts`, `src/utils/useDriveBackup.ts`) e store locale (`src/utils/store.ts`)
  - Backend Serverless (Vercel): `api/embed.ts`, `api/_lib/embed.ts`, `api/tts.ts`, `api/_lib/tts.ts`, `api/health.ts` (`vercel.json`)
- **Componenti chiave già presenti**:
  - Core & Auth: `src/App.tsx`, `src/AuthGate.tsx`, `src/types.ts`
  - Gestione schede & ricerca: `src/components/DataTab.tsx`, `src/components/SearchTab.tsx`, `src/components/EmbedBar.tsx`, `src/utils/embed.ts`, `src/utils/chunk.ts`
  - Visualizzazione a grafo: `src/components/GraphTab.tsx`
- **Obiettivi evolutivi da integrare nella revisione**:
  1. Consolidamento ed estensione del motore di embedding (`api/_lib/embed.ts` e `src/utils/embed.ts`) con supporto pulito a provider come OpenAI (`text-embedding-3-small`) o Voyage.
  2. Evoluzione di `src/components/GraphTab.tsx` in un grafo interattivo D3.js fluido, leggibile e filtrabile in stile Obsidian.
  3. Generazione di patch deterministiche applicabili automaticamente via OpenRouter.

---

## Cosa devi produrre (in quest'ordine, in un unico output)

### Parte A — Revisione del codice
Analizza tutti i file sorgente allegati coprendo queste quattro categorie:

1. **Logica e Correttezza**:
   - Bug, race condition, casi limite non gestiti, stati di loading/error mancanti.
   - Coerenza del flusso dati tra Firestore, backup su Google Drive e stato locale.
2. **Architettura e Manutenibilità**:
   - Scomposizione dei file monolitici (`src/AuthGate.tsx`, `src/App.tsx`, `src/components/DataTab.tsx`, `src/components/GraphTab.tsx`).
   - Gestione dello stato, separazione delle responsabilità, duplicazione di logica tra client (`src/utils/`) e serverless (`api/_lib/`), coerenza dei tipi in `src/types.ts`.
3. **Sicurezza**:
   - Verifica delle regole di accesso in `firestore.rules` rispetto alle collezioni usate nel client.
   - Validazione degli input, rate-limiting/autenticazione e protezione delle API key negli endpoint `api/_lib/embed.ts` e `api/_lib/tts.ts`.
   - Assenza di segreti o configurazioni sensibili esposte lato client.
4. **Preparazione all'evoluzione (Embedding + Grafo D3)**:
   - Punti esatti da rifattorizzare per disaccoppiare il provider di embedding (`api/_lib/embed.ts`) e normalizzare vettori/metadati.
   - Struttura dati ottimale da esporre verso `GraphTab.tsx` per calcolare nodi, collegamenti espliciti e archi di similarità semantica.

**Regole vincolanti per la Parte A:**
- Cita sempre **percorso file e numeri di riga esatti**.
- Spiega **perché** il problema impatta sull'app e fornisci la **correzione specifica**.
- Non segnalare problemi che non puoi verificare direttamente nei file forniti: zero speculazioni.
- Massimo **5 segnalazioni di puro stile** (*nit*); concentrati su bug, sicurezza, performance e architettura.
- Se un file è ben scritto e privo di difetti rilevanti, dichiaralo esplicitamente.

**Formato obbligatorio per ogni singolo problema:**

- **ID e Severità**: `[CRITICO | ALTO | MEDIO | BASSO]` — Titolo sintetico
- **Categoria**: `Logica` | `Architettura` | `Sicurezza` | `Evoluzione`
- **Posizione**: `percorso/del/file.ts` (righe `X–Y`)
- **Problema**: descrizione tecnica chiara della causa e dell'impatto.
- **Soluzione**:

    // Inserisci qui lo snippet TypeScript/TSX corretto

---

### Parte B — Patch pronte per OpenRouter
Per ogni problema di severità **CRITICO** o **ALTO** individuato nella Parte A (e per eventuali refactoring preparatori indispensabili), produci un blocco di patch strutturato in modo deterministico affinché un agente o script via OpenRouter possa applicarlo senza ambiguità.

**Formato obbligatorio per ogni file modificato:**

#### PATCH: `percorso/esatto/del/file.ts`
- **Azione**: `UPDATE` | `CREATE`
- **Riferimento ID Revisione**: elenco degli ID risolti (es. `CRIT-01, ALT-02`)
- **Contenuto completo aggiornato del file**:

    // Codice completo, compilabile e tipizzato del file (senza omissioni tipo "// ... resto del codice")

---

### Parte C — Architettura ed evoluzione Grafo D3.js (stile Obsidian)
Partendo dall'attuale implementazione di `src/components/GraphTab.tsx` e dai tipi in `src/types.ts`, progetta e realizza il potenziamento completo della vista a grafo:

1. **Modello dati del grafo MTC**:
   - Tipizzazione rigorosa di `GraphNode` e `GraphLink`.
   - Distinzione visiva e strutturale tra tipi di nodo (es. *Scheda/Concetto MTC*, *Meridiano/Organo*, *Sintomo/Sindrome*, *Formula/Punto*) e tipi di arco (*collegamento esplicito tra schede* vs *arco semantico pesato da cosine similarity degli embedding*).
2. **Motore fisico e interazioni D3 (`d3-force`, `d3-zoom`, `d3-drag`)**:
   - Configurazione bilanciata delle forze (`forceLink` pesata sulla similarità, `forceManyBody`, `forceCenter`, `forceCollide`) con stop automatico/raffreddamento per evitare consumo inutile di CPU.
   - Zoom e pan fluidi (`d3-zoom`), trascinamento nodi (`d3-drag`), evidenziazione del vicinato (*hover neighborhood highlight*) con dissolvenza dei nodi non connessi.
   - Etichette adattive al livello di zoom per evitare sovrapposizioni testuali.
3. **Controlli UI e integrazione con l'app**:
   - Filtri per categoria/tipo scheda, slider per la soglia minima di similarità semantica, ricerca rapida di un nodo con centratura animata della camera, e pannello laterale di anteprima/apertura scheda al click.
   - Gestione completa della pulizia (`cleanup` degli listener D3 e della simulazione al cambio tab/unmount).
4. **Implementazione completa**:
   - Fornisci il codice completo e pronto all'uso di `src/components/GraphTab.tsx` (e di eventuali helper puri estratti in `src/utils/graph.ts`).

---

## Promemoria prima di inviare lo ZIP insieme a questo prompt
Per massimizzare la qualità dell'analisi ed evitare di saturare la finestra di contesto con file binari inutili, allega uno ZIP pulito contenente **solo**:
- `src/` (tutto il codice frontend)
- `api/` (tutte le serverless function)
- File di configurazione alla radice: `package.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, `index.html`, `firestore.rules`, `firebase-blueprint.json`, `security_spec.md`, `.env.example`

*(Escludi `.aistudio/`, `public/assets/aistudio/`, `node_modules/` e tieni un solo lockfile).*