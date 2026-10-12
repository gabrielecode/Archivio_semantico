import crypto from 'crypto';
import { createUser, validateEmail, validatePassword, ID_RE, normalizeId } from './_lib/users.js';
import { kvMode, getKv } from './_lib/kv.js';
import { signSession, setCookie, throttle } from './_lib/auth.js';

const safeCompare = (a: string, b: string): boolean => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
};

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Unsupported Media Type' });

    const inviteEnv = process.env.INVITE_CODE;
    const kv = getKv();
    if (!inviteEnv || kvMode() === 'none' || !kv) {
        return res.status(403).json({ error: 'Registrazione non attiva' });
    }

    const { id, name, email, password, inviteCode } = req.body || {};

    if (!safeCompare(inviteCode || '', inviteEnv)) {
        await new Promise(r => setTimeout(r, 400));
        return res.status(400).json({ error: 'Codice d\'invito non valido' });
    }

    const normId = normalizeId(id);
    if (!ID_RE.test(normId) || ['admin', 'root', 'system'].includes(normId)) {
        return res.status(400).json({ error: 'Dati non validi o già in uso' });
    }

    if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 64) {
        return res.status(400).json({ error: 'Dati non validi o già in uso' });
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
        return res.status(400).json({ error: 'Dati non validi o già in uso' });
    }

    const pwErr = validatePassword(password, normId);
    if (pwErr) {
        return res.status(400).json({ error: 'Dati non validi o già in uso' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';

    const ipThrottle = await throttle(`reg-ip:${ip}`, 5, 3600);
    if (!ipThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const emailThrottle = await throttle(`reg-email:${emailNorm}`, 5, 3600);
    if (!emailThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const result = await createUser({
        id: normId,
        name: name.trim(),
        password,
        email: emailNorm,
        role: 'user'
    });

    if (!result.ok || !result.user) {
        return res.status(400).json({ error: 'Dati non validi o già in uso' });
    }

    const token = signSession(result.user.id);
    if (!token) {
        return res.status(503).json({ error: 'Auth not configured' });
    }

    const secure = req.headers['x-forwarded-proto'] === 'https';
    setCookie(res, token, secure);

    return res.status(200).json({ user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role } });
};
