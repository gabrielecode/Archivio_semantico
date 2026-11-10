import { Request, Response } from 'express';

type RequestLike = {
    method?: string;
    query: Record<string, any>;
    headers: Record<string, any>;
};

type ResponseLike = {
    status: (code: number) => { json: (data: any) => void };
    setHeader: (name: string, value: string) => void;
    end: (chunk?: any) => void;
};

export const ttsHandler = async (req: RequestLike | any, res: ResponseLike | any) => {
    try {
        const text = typeof req.query?.text === 'string' ? req.query.text.trim() : '';
        if (!text) {
            return res.status(400).json({ error: 'Parametro "text" mancante' });
        }
        if (text.length > 200) {
            return res.status(400).json({ error: 'Testo troppo lungo (massimo 200 caratteri)' });
        }

        const lang = typeof req.query?.lang === 'string' && req.query.lang ? req.query.lang : 'zh-CN';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8'
            }
        });

        if (!response.ok) {
            console.error('Google TTS fetch error status:', response.status);
            return res.status(response.status).json({ error: 'Impossibile generare la pronuncia vocale' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.end(buffer);
    } catch (error: any) {
        console.error('TTS handler error:', error?.message || error);
        return res.status(500).json({ error: 'Errore interno del server durante la generazione della pronuncia' });
    }
};
