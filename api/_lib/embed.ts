import { verifyFirebaseAuth, SlidingWindowLimiter, RequestLike, ResponseLike } from './auth.js';
import { EMBEDDING_MODEL_CATALOG, getDefaultEmbeddingModelId, resolveEmbeddingModel } from './models.js';

const queryLimiter = new SlidingWindowLimiter(60_000);
const documentLimiter = new SlidingWindowLimiter(60_000);

const RETRYABLE_STATUSES = new Set([429, 503, 529]);
const RETRY_DELAYS_MS = [500, 1500, 4000];

export function normalizeL2Vector(vec: unknown, expectedDim: number): number[] | null {
    if (!Array.isArray(vec) || vec.length === 0) return null;
    if (expectedDim > 0 && vec.length !== expectedDim) return null;

    let sumSquares = 0;
    for (let i = 0; i < vec.length; i++) {
        const v = vec[i];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            return null;
        }
        sumSquares += v * v;
    }

    const norm = Math.sqrt(sumSquares);
    if (!Number.isFinite(norm) || norm === 0) return null;

    return (vec as number[]).map((v) => v / norm);
}

export const healthHandler = (_req: RequestLike, res: ResponseLike) => {
    const defaultModelId = getDefaultEmbeddingModelId();
    const resolved = resolveEmbeddingModel(defaultModelId);
    res.status(200).json({
        embed: Boolean(process.env.OPENROUTER_API_KEY),
        defaultModel: resolved?.id || defaultModelId,
        defaultDim: resolved?.dim || 1536,
        models: EMBEDDING_MODEL_CATALOG,
    });
};

export const embedHandler = async (req: RequestLike, res: ResponseLike) => {
    if (req.method && req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const user = await verifyFirebaseAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Payload richiesta non valido' });
    }

    const { texts, mode = 'document', model } = req.body as {
        texts?: unknown;
        mode?: unknown;
        model?: unknown;
    };

    if (mode !== 'query' && mode !== 'document') {
        return res.status(400).json({ error: 'Modalità embedding non valida' });
    }

    const resolvedModel = resolveEmbeddingModel(model);
    if (!resolvedModel) {
        return res.status(400).json({ error: 'Modello di embedding non supportato' });
    }

    const allowed =
        mode === 'query'
            ? queryLimiter.consume(user.uid, 60)
            : documentLimiter.consume(user.uid, 25);

    if (!allowed) {
        return res.status(429).json({ error: 'Troppe richieste, riprova tra poco' });
    }

    if (
        !Array.isArray(texts) ||
        texts.length === 0 ||
        texts.length > 50 ||
        !texts.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= 2000)
    ) {
        return res.status(400).json({ error: 'Testi non validi per embedding' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'Servizio embedding non disponibile' });
    }

    let attempts = 0;
    let responseData: any = null;

    while (attempts < 3) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: resolvedModel.id,
                    input: texts,
                    provider: { data_collection: 'deny' },
                }),
                signal: AbortSignal.timeout(25_000),
            });

            if (resp.status === 401 || resp.status === 402 || resp.status === 404) {
                console.error('Embedding provider error status:', resp.status, resolvedModel.id);
                return res.status(503).json({ error: 'Servizio embedding non disponibile' });
            }

            if (RETRYABLE_STATUSES.has(resp.status)) {
                attempts++;
                if (attempts >= 3) {
                    return res.status(502).json({ error: 'Servizio embedding temporaneamente occupato' });
                }
                await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempts - 1]));
                continue;
            }

            if (!resp.ok) {
                console.error('Embedding error status:', resp.status, resolvedModel.id);
                return res.status(502).json({ error: 'Generazione embedding fallita' });
            }

            responseData = await resp.json();
            break;
        } catch (error: any) {
            attempts++;
            if (attempts >= 3) {
                console.error('Embedding network error:', error?.message);
                return res.status(502).json({ error: 'Generazione embedding fallita' });
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempts - 1]));
        }
    }

    if (!responseData || !Array.isArray(responseData.data)) {
        return res.status(502).json({ error: 'Risposta embedding non valida' });
    }

    try {
        const vectors: number[][] = new Array(texts.length);
        let actualDim = resolvedModel.dim;

        for (let i = 0; i < texts.length; i++) {
            const item = responseData.data.find((d: any) => d && d.index === i) || responseData.data[i];
            const rawVec = item?.embedding;
            if (actualDim === 0 && Array.isArray(rawVec) && rawVec.length > 0) {
                actualDim = rawVec.length;
            }
            const normalized = normalizeL2Vector(rawVec, actualDim);
            if (!normalized) {
                return res.status(502).json({ error: 'Dimensione o valori embedding inattesi' });
            }
            vectors[i] = normalized;
        }

        return res.status(200).json({
            vectors,
            model: resolvedModel.id,
            dim: actualDim,
        });
    } catch (error: any) {
        console.error('Embedding processing error:', error?.message);
        return res.status(500).json({ error: 'Errore interno durante elaborazione embedding' });
    }
};
