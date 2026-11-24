import { verifyFirebaseAuth, SlidingWindowLimiter, RequestLike, ResponseLike } from './auth.js';

const ttsLimiter = new SlidingWindowLimiter(60_000);
const ALLOWED_LANGS = new Set(['zh-CN', 'zh-TW', 'it', 'de', 'en']);

export const ttsHandler = async (req: RequestLike | any, res: ResponseLike | any) => {
    if (req.method && req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const user = await verifyFirebaseAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    if (!ttsLimiter.consume(user.uid, 40)) {
        return res.status(429).json({ error: 'Troppe richieste audio, riprova tra poco' });
    }

    try {
        const text = typeof req.query?.text === 'string' ? req.query.text.trim() : '';
        if (!text) {
            return res.status(400).json({ error: 'Parametro "text" mancante' });
        }
        if (text.length > 200) {
            return res.status(400).json({ error: 'Testo troppo lungo (massimo 200 caratteri)' });
        }

        const rawLang = typeof req.query?.lang === 'string' && req.query.lang.trim() ? req.query.lang.trim() : 'zh-CN';
        if (!ALLOWED_LANGS.has(rawLang)) {
            return res.status(400).json({ error: 'Lingua non supportata' });
        }

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(rawLang)}&client=tw-ob&q=${encodeURIComponent(text)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8'
            },
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            console.error('Google TTS fetch error status:', response.status);
            return res.status(502).json({ error: 'Impossibile generare la pronuncia vocale' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'private, max-age=86400');
        return res.end(buffer);
    } catch (error: any) {
        console.error('TTS handler error:', error?.message || error);
        return res.status(500).json({ error: 'Errore interno del server durante la generazione della pronuncia' });
    }
};
