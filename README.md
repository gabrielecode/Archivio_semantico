# TCM Semantic Search

## Cos'è
Strumento di ricerca semantica per dati TCM (Medicina Tradizionale Cinese).
Permette di organizzare e ricercare contenuti tramite embedding.

## Avvio
1. `npm install`
2. Configurare `.env.local` con:
   - `GEMINI_API_KEY=...`
   - `ADMIN_TOKEN=...`
3. `npm run dev`
4. Produzione: `npm run build` seguito da `npm run start`

## Come si usa
1. **Struttura**: Definire tipi e campi nel pannello apposito.
2. **Dati**: Creare nuove voci o importarle.
3. **Genera embedding**: Premere l'icona chiave e inserire l'ADMIN_TOKEN.
4. **Ricerca**: Utilizzare la barra di ricerca semantica.
5. **Salva JSON**: Esportare i dati.

## Formato archivio
Versione 2, modello `gemini-embedding-2-preview`, dimensione 768.
Records contengono chunk. Il cambio modello richiede rigenerazione.

## Import/Export Excel
Colonne: Titolo, Tipo, Contenuto, Tags, Fonte + campi dinamici.

## Sicurezza
- `ADMIN_TOKEN` obbligatorio per indicizzazione.
- Rate limit sulle ricerche.
- Chiave API salvata solo sul server.
- Token admin solo in memoria.

## Limiti
- In anteprima, salvataggio via download.
- Strumento di consultazione, non sostituisce parere medico.
