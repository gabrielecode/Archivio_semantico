import { verifyPassword, dummyScrypt, signSession, throttle, setCookie, getSecret } from './_lib/auth.js';
import { findByLoginName, envUsers } from './_lib/users.js';
import { kvMode } from './_lib/kv.js';

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Unsupported Media Type' });

    if (!getSecret() || (envUsers().length === 0 && kvMode() === 'none')) {
        return res.status(503).json({ error: 'Autenticazione non configurata' });
    }

    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200) {
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';
    
    const ipThrottle = await throttle(`login:${ip}`, 10, 600);
    if (!ipThrottle.allowed) return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });

    const userThrottle = await throttle(`login-u:${username.trim().toLowerCase()}`, 10, 600);
    if (!userThrottle.allowed) return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });

    const user = await findByLoginName(username);
    let success = false;
    if (user) {
        if (verifyPassword(password, user.hash)) {
            success = true;
        }
    } else {
        dummyScrypt();
    }

    if (!success) {
        await new Promise(r => setTimeout(r, 400));
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = signSession(user!.id);
    if (!token) return res.status(503).json({ error: 'Auth not configured' });

    const secure = req.headers['x-forwarded-proto'] === 'https';
    setCookie(res, token, secure);
    res.status(200).json({ user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role } });
};
