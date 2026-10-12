import { createRemoteJWKSet, jwtVerify } from 'jose';

type RequestLike = {
    method?: string;
    body: any;
    headers: Record<string, any>;
    socket: { remoteAddress?: string };
};
type ResponseLike = {
    status: (code: number) => { json: (data: any) => void };
    setHeader: (name: string, value: string) => void;
};

const JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

async function verifyAuth(req: RequestLike): Promise<string | null> {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split('Bearer ')[1];
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return null;

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
        });
        if (payload.email_verified !== true) {
            return null;
        }
        return payload.sub as string;
    } catch (e) {
        return null;
    }
}

const queryRateLimit = new Map<string, { count: number; resetTime: number }>();
const documentRateLimit = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
    const now = Date.now();
    for (const [id, data] of queryRateLimit.entries()) {
        if (now > data.resetTime) queryRateLimit.delete(id);
    }
    for (const [id, data] of documentRateLimit.entries()) {
        if (now > data.resetTime) documentRateLimit.delete(id);
    }
}, 60000).unref();

export const healthHandler = (req: RequestLike, res: ResponseLike) => {
    res.status(200).json({ embed: !!process.env.OPENROUTER_API_KEY });
};

export const embedHandler = async (req: RequestLike, res: ResponseLike) => {
    const userId = await verifyAuth(req);
    if (!userId) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    const { texts, mode } = req.body;

    const now = Date.now();
    const limitMap = mode === 'query' ? queryRateLimit : documentRateLimit;
    const limit = mode === 'query' ? 60 : 20;
    
    const data = limitMap.get(userId) || { count: 0, resetTime: now + 60000 };
    if (data.resetTime < now) { data.count = 0; data.resetTime = now + 60000; }
    if (data.count >= limit) return res.status(429).json({ error: 'Too many requests' });
    data.count++;
    limitMap.set(userId, data);

    if (!Array.isArray(texts) || texts.length === 0 || texts.length > 50 || !texts.every(t => typeof t === 'string' && t.trim().length > 0 && t.length <= 2000)) {
        return res.status(400).json({ error: 'Invalid texts' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Servizio embedding non disponibile' });

    let attempts = 0;
    let responseData: any = null;

    while (attempts < 3) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_EMBED_MODEL || 'openai/text-embedding-3-small',
                    input: texts,
                    provider: { data_collection: 'deny' }
                })
            });

            if (resp.status === 401 || resp.status === 402 || resp.status === 404) {
                console.error('Embedding error status:', resp.status);
                return res.status(503).json({ error: 'Servizio embedding non disponibile' });
            }

            if ([429, 503, 529].includes(resp.status)) {
                attempts++;
                if (attempts >= 3) {
                    return res.status(502).json({ error: 'Embedding failed' });
                }
                await new Promise(r => setTimeout(r, [500, 1500, 4000][attempts - 1]));
                continue;
            }

            if (!resp.ok) {
                console.error('Embedding error status:', resp.status);
                return res.status(502).json({ error: 'Embedding failed' });
            }

            responseData = await resp.json();
            break;
        } catch (error: any) {
            attempts++;
            if (attempts >= 3) {
                console.error('Embedding error:', error?.message);
                return res.status(502).json({ error: 'Embedding failed' });
            }
            await new Promise(r => setTimeout(r, [500, 1500, 4000][attempts - 1]));
        }
    }

    if (!responseData || !Array.isArray(responseData.data)) {
        return res.status(502).json({ error: 'Embedding failed' });
    }

    try {
        const vectors: number[][] = new Array(texts.length);
        for (let i = 0; i < texts.length; i++) {
            const item = responseData.data.find((d: any) => d.index === i) || responseData.data[i];
            const vec = item?.embedding;
            if (!vec || !Array.isArray(vec) || vec.length !== 1536) {
                return res.status(502).json({ error: 'Dimensione embedding inattesa' });
            }
            const norm = Math.sqrt(vec.reduce((a: number, b: number) => a + b * b, 0));
            if (norm === 0 || isNaN(norm)) {
                return res.status(502).json({ error: 'Dimensione embedding inattesa' });
            }
            vectors[i] = vec.map((v: number) => v / norm);
        }
        res.status(200).json({ vectors });
    } catch (error: any) {
        console.error('Embedding processing error:', error?.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
