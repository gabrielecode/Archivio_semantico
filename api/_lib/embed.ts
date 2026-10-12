import { GoogleGenAI } from '@google/genai';
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

let ai: GoogleGenAI | null = null;
const getAI = () => {
    if (!ai && process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
    }
    return ai;
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
    res.status(200).json({ embed: !!process.env.GEMINI_API_KEY });
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

    const aiInstance = getAI();
    if (!aiInstance) return res.status(503).json({ error: 'Service Unavailable' });

    try {
        const vectors: number[][] = new Array(texts.length);
        let failed = false;

        const prefix = mode === 'query' ? 'task: search result | query: ' : 'title: none | text: ';
        
        for (let i = 0; i < texts.length; i++) {
            if (failed) break;
            let attempts = 0;
            while (attempts < 3) {
                try {
                    const result = await aiInstance.models.embedContent({
                        model: 'gemini-embedding-2-preview',
                        contents: { parts: [{ text: prefix + texts[i] }] },
                        config: { outputDimensionality: 768 }
                    });
                    const vec = result.embeddings?.[0]?.values;
                    if (!vec) throw new Error('No embedding found');
                    const norm = Math.sqrt(vec.reduce((a: number, b: number) => a + b * b, 0));
                    if (norm === 0 || isNaN(norm)) throw new Error('Invalid embedding');
                    vectors[i] = vec.map((v: number) => v / norm);
                    break;
                } catch (error: any) {
                    attempts++;
                    if (attempts >= 3 || (error.status !== 429 && error.status !== 503)) {
                        console.error('Embedding error:', { status: error.status, message: error.message });
                        failed = true;
                        if (error.status === 429) return res.status(429).json({ error: 'Embedding rate limited' });
                        return res.status(502).json({ error: 'Embedding failed' });
                    }
                    await new Promise(r => setTimeout(r, [500, 1500, 4000][attempts - 1]));
                }
            }
        }
        res.status(200).json({ vectors });
    } catch (error: any) {
        console.error({ status: error.status, message: error.message });
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
