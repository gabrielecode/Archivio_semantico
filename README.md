# TCM Semantic Search (Archivio Semantico MTC)

## Cos'è
Strumento di ricerca semantica per dati TCM (Medicina Tradizionale Cinese). Permette di organizzare e ricercare contenuti tramite embedding semantici.

## Avvio
1. `npm install`
2. Configurare `.env.local` con:
   - `GEMINI_API_KEY=...`
   - `AUTH_SECRET=...` (stringa casuale sicura per i cookie firmati HMAC)
   - `USERS='[{"id":"admin","name":"Amministratore","hash":"scrypt$...","role":"admin"}]'`
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (richiesto su Vercel per modificare accessi e password dall'app)
3. `npm run dev` (avvia Vite + server Express su porta 3000)
4. Produzione: `npm run build` seguito da `npm run start`

## Gestione Accessi e Utenti
- **Cambio password e profilo**: Ogni utente autenticato può cambiare la propria password o il proprio nome dal menu utente ("Il mio account").
- **Pannello Amministratore**: Gli utenti con ruolo `admin` possono gestire gli utenti (creazione, reimpostazione password, cambio ruolo e eliminazione) dal pannello "Gestione utenti".
- **Modalità di recupero (`FORCE_ENV_USERS=true`)**: Se impostata come variabile d'ambiente su Vercel, gli utenti definiti nella variabile `USERS` vincono sempre su quelli memorizzati in KV, consentendo di rientrare in caso di blocco credenziali.

## Come si usa
1. **Struttura**: Definire tipi e campi nel pannello apposito.
2. **Dati**: Creare nuove voci o importarle.
3. **Genera embedding**: Utilizzare la barra di embedding (richiede `GEMINI_API_KEY` configurata).
4. **Ricerca**: Utilizzare la barra di ricerca semantica.
5. **Salva / Esporta JSON**: Esportare o sincronizzare i dati.

## Sicurezza e Autenticazione
- Autenticazione basata su cookie firmati HMAC (`tcm_session`).
- Storage persistente degli utenti in KV (Upstash Redis) con priorità rispetto alle variabili d'ambiente.
- Rate limiting su login e modifiche account.
- Chiave API Gemini protetta sul server.

## Limiti
- Strumento di consultazione, non sostituisce un parere medico.

