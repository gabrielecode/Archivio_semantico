import { requireAuth, verifyPassword, hashPassword, throttle, signSession, setCookie, getSecret } from './_lib/auth.js';
import { getUser, validatePassword, isNameTaken, validateEmail, isEmailTaken, saveUser } from './_lib/users.js';
import { kvMode } from './_lib/kv.js';

export default async (req: any, res: any) => {
    if (req.method !== 'POST' && req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().startsWith('application/json')) {
        return res.status(415).json({ error: 'Unsupported Media Type' });
    }

    if (kvMode() === 'none') {
        return res.status(503).json({ error: 'Per modificare gli accessi serve il database (Upstash Redis) collegato a Vercel' });
    }

    const userId = await requireAuth(req, res);
    if (!userId) return;

    const user = await getUser(userId);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';

    const ipThrottle = await throttle(`account-ip:${ip}`, 5, 600);
    if (!ipThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const userThrottle = await throttle(`account-u:${userId}`, 5, 600);
    if (!userThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const { action, currentPassword, newPassword, name, email } = req.body || {};

    if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Password attuale richiesta' });
    }

    if (!verifyPassword(currentPassword, user.hash)) {
        await new Promise(r => setTimeout(r, 400));
        return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    if (action === 'password') {
        if (!newPassword || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Nuova password richiesta' });
        }
        const pwError = validatePassword(newPassword, user.id);
        if (pwError) {
            return res.status(400).json({ error: pwError });
        }

        user.hash = hashPassword(newPassword);
        user.sessionsValidFrom = Date.now();
        const saved = await saveUser(user);
        if (!saved) {
            return res.status(500).json({ error: 'Errore durante il salvataggio' });
        }

        const token = signSession(user.id);
        if (!token) {
            return res.status(503).json({ error: 'Auth not configured' });
        }

        const secure = req.headers['x-forwarded-proto'] === 'https';
        setCookie(res, token, secure);

        return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    if (action === 'name') {
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Nuovo nome richiesto' });
        }
        const trimmedName = name.trim();
        if (trimmedName.length < 3 || trimmedName.length > 64) {
            return res.status(400).json({ error: 'Il nome deve essere compreso tra 3 e 64 caratteri' });
        }

        const taken = await isNameTaken(trimmedName, user.id);
        if (taken) {
            return res.status(400).json({ error: 'Questo nome o ID è già in uso da un altro utente' });
        }

        user.name = trimmedName;
        const saved = await saveUser(user);
        if (!saved) {
            return res.status(500).json({ error: 'Errore durante il salvataggio' });
        }

        return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    if (action === 'email') {
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Nuova email richiesta' });
        }
        const emailErr = validateEmail(email);
        if (emailErr) {
            return res.status(400).json({ error: emailErr });
        }
        const normEmail = email.trim().toLowerCase();
        const taken = await isEmailTaken(normEmail, user.id);
        if (taken) {
            return res.status(400).json({ error: 'Questa email è già in uso da un altro utente' });
        }

        user.email = normEmail;
        const saved = await saveUser(user);
        if (!saved) {
            return res.status(400).json({ error: 'Email già in uso o errore di salvataggio' });
        }

        return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    return res.status(400).json({ error: 'Azione non valida' });
};
