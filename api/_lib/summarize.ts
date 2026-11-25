import { verifyFirebaseAuth, SlidingWindowLimiter, RequestLike, ResponseLike } from './auth.js';

const summarizeLimiter = new SlidingWindowLimiter(60_000);

const RETRYABLE_STATUSES = new Set([429, 503, 529]);
const RETRY_DELAYS_MS = [500, 1500, 4000];

const SYSTEM_PROMPT =
    "Scrivi in italiano una voce stile enciclopedia SOLO con le fonti fornite. Ogni frase termina con la fonte tra parentesi quadre, es. [1]. Non aggiungere conoscenze esterne. Se un'informazione non è nelle fonti scrivi 'non presente nelle schede'. Sezioni: Definizione, Localizzazione, Azioni e indicazioni, Schede correlate (solo se presenti).";

interface SummarizeSourceInput {
    n: number;
    titolo: string;
    campo: string;
    testo: string;
}

function parseSources(raw: unknown): SummarizeSourceInput[] | null {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 8) {
        return null;
    }

    const parsed: SummarizeSourceInput[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return null;
        }
        const { n, titolo, campo, testo } = item as Record<string, unknown>;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 100) {
            return null;
        }
        if (typeof titolo !== 'string' || titolo.trim().length === 0 || titolo.length > 300) {
            return null;
        }
        if (campo !== undefined && (typeof campo !== 'string' || campo.length > 200)) {
            return null;
        }
        if (typeof testo !== 'string' || testo.trim().length === 0 || testo.length > 1500) {
            return null;
        }
        parsed.push({
            n,
            titolo: titolo.trim(),
            campo: typeof campo === 'string' ? campo.trim() : '',
            testo: testo.trim(),
        });
    }

    return parsed;
}

export const summarizeHandler = async (req: RequestLike, res: ResponseLike) => {
    if (req.method && req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const user = await verifyFirebaseAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    if (!summarizeLimiter.consume(user.uid, 10)) {
        return res.status(429).json({ error: 'Troppe richieste, riprova tra poco' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Payload richiesta non valido' });
    }

    const { query, sources } = req.body as {
        query?: unknown;
        sources?: unknown;
    };

    if (typeof query !== 'string' || query.trim().length === 0 || query.length > 500) {
        return res.status(400).json({ error: 'Query non valida' });
    }

    const parsedSources = parseSources(sources);
    if (!parsedSources) {
        return res.status(400).json({ error: 'Fonti non valide (massimo 8 fonti da 1500 caratteri ciascuna)' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const model = process.env.OPENROUTER_SUMMARY_MODEL?.trim();
    if (!apiKey || !model) {
        return res.status(503).json({ error: 'Servizio sintesi non disponibile' });
    }

    const sourcesBlock = parsedSources
        .map((s) => `[${s.n}] ${s.titolo}${s.campo ? ` — ${s.campo}` : ''}\n${s.testo}`)
        .join('\n\n');

    const userPrompt = `Query: ${query.trim()}\n\nFonti:\n${sourcesBlock}`;

    let attempts = 0;
    let responseData: any = null;

    while (attempts < 3) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.2,
                    max_tokens: 900,
                    reasoning: { effort: 'low' },
                    provider: { data_collection: 'deny' },
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                }),
                signal: AbortSignal.timeout(30_000),
            });

            if (resp.status === 401 || resp.status === 402 || resp.status === 404) {
                console.error('Summarize provider error status:', resp.status, model);
                return res.status(503).json({ error: 'Servizio sintesi non disponibile' });
            }

            if (RETRYABLE_STATUSES.has(resp.status)) {
                attempts++;
                if (attempts >= 3) {
                    return res.status(502).json({ error: 'Servizio sintesi temporaneamente occupato' });
                }
                await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempts - 1]));
                continue;
            }

            if (!resp.ok) {
                console.error('Summarize error status:', resp.status, model);
                return res.status(502).json({ error: 'Generazione sintesi fallita' });
            }

            responseData = await resp.json();
            break;
        } catch (error: any) {
            attempts++;
            if (attempts >= 3) {
                console.error('Summarize network error:', error?.message);
                return res.status(502).json({ error: 'Generazione sintesi fallita' });
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempts - 1]));
        }
    }

    const markdown = responseData?.choices?.[0]?.message?.content;
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
        return res.status(502).json({ error: 'Risposta sintesi non valida' });
    }

    return res.status(200).json({ markdown });
};
