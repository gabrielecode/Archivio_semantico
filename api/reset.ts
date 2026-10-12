import crypto from 'crypto';
import { getUser, validatePassword, saveUser } from './_lib/users.js';
import { getKv, kvMode } from './_lib/kv.js';
import { hashPassword, throttle } from './_lib/auth.js';

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Unsupported Media Type' });

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';

    const ipThrottle = await throttle(`reset-ip:${ip}`, 10, 3600);
    if (!ipThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Link non valido o scaduto' });
    }

    const kv = getKv();
    if (kvMode() === 'none' || !kv) {
        return res.status(503).json({ error: 'Database non disponibile' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const userId = await kv.get(`reset:${tokenHash}`);
    if (!userId) {
        return res.status(400).json({ error: 'Link non valido o scaduto' });
    }

    const user = await getUser(userId);
    if (!user) {
        await kv.del(`reset:${tokenHash}`);
        return res.status(400).json({ error: 'Link non valido o scaduto' });
    }

    const pwErr = validatePassword(newPassword, user.id);
    if (pwErr) {
        return res.status(400).json({ error: pwErr });
    }

    // Delete token FIRST (monouso)
    await kv.del(`reset:${tokenHash}`);

    user.hash = hashPassword(newPassword);
    user.sessionsValidFrom = Date.now();
    const saved = await saveUser(user);
    if (!saved) {
        return res.status(500).json({ error: 'Errore durante il salvataggio' });
    }

    return res.status(200).json({ ok: true, message: 'Password aggiornata con successo' });
};
