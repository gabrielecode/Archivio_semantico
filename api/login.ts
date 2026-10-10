import { getUsers, verifyPassword, dummyScrypt, signSession, checkThrottle, setCookie } from './_lib/auth.js';
import crypto from 'crypto';

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (req.headers['content-type'] !== 'application/json') return res.status(415).json({ error: 'Unsupported Media Type' });

    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200) {
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';
    
    const throttle = checkThrottle(ip);
    if (throttle.count >= 10) return res.status(429).json({ error: 'Too many requests' });

    const user = getUsers().find((u: { id: string; name: string; hash: string }) => u.id === username);
    let success = false;
    if (user) {
        if (verifyPassword(password, user.hash)) {
            success = true;
        }
    } else {
        dummyScrypt();
    }

    if (!success) {
        throttle.count++;
        await new Promise(r => setTimeout(r, 400));
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = signSession(user!.id);
    if (!token) return res.status(503).json({ error: 'Auth not configured' });

    const secure = req.headers['x-forwarded-proto'] === 'https';
    setCookie(res, token, secure);
    res.status(200).json({ user: { id: user!.id, name: user!.name } });
};
