import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

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

const queryRateLimit = new Map<string, { count: number; resetTime: number }>();
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of queryRateLimit.entries()) {
        if (now > data.resetTime) queryRateLimit.delete(ip);
    }
}, 60000).unref();

app.get('/api/health', (req, res) => {
    res.json({ ok: true, embed: !!process.env.GEMINI_API_KEY });
});

app.post('/api/embed', async (req, res, next) => {
    const { texts, mode } = req.body;
    const ip = req.ip || 'unknown';

    if (mode === 'query') {
        const now = Date.now();
        const data = queryRateLimit.get(ip) || { count: 0, resetTime: now + 60000 };
        if (data.resetTime < now) { data.count = 0; data.resetTime = now + 60000; }
        if (data.count >= 30) return res.status(429).json({ error: 'Too many requests' });
        data.count++;
        queryRateLimit.set(ip, data);
    }

    if (!Array.isArray(texts) || texts.length === 0 || texts.length > 50 || !texts.every(t => typeof t === 'string' && t.trim().length > 0 && t.length <= 2000)) {
        return res.status(400).json({ error: 'Invalid texts' });
    }

    if (mode === 'document') {
        const adminToken = process.env.ADMIN_TOKEN;
        if (!adminToken) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' });
        const providedToken = req.headers['x-admin-token'];
        if (typeof providedToken !== 'string' || !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(adminToken))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
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
                        console.error('Embedding error:', error);
                        failed = true;
                        if (error.status === 429) return res.status(429).json({ error: 'Embedding rate limited' });
                        return res.status(502).json({ error: 'Embedding failed' });
                    }
                    await new Promise(r => setTimeout(r, [500, 1500, 4000][attempts - 1]));
                }
            }
        }
        res.json({ vectors });
    } catch (error: any) {
        next(error);
    }
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

(async () => {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer } = await import('vite');
        const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
        app.use(vite.middlewares);
    } else {
        const dist = path.resolve(process.cwd(), 'dist');
        app.use(express.static(dist));
        app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
    app.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`));
})();
