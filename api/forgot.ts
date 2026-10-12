import crypto from 'crypto';
import { getUserByEmail, validateEmail } from './_lib/users.js';
import { kvMode, getKv } from './_lib/kv.js';
import { throttle } from './_lib/auth.js';

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Unsupported Media Type' });

    const { email } = req.body || {};
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress) || 'unknown';

    const ipThrottle = await throttle(`forgot-ip:${ip}`, 10, 3600);
    if (!ipThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    if (emailNorm) {
        const emailThrottle = await throttle(`forgot-email:${emailNorm}`, 3, 3600);
        if (!emailThrottle.allowed) {
            return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
        }
    }

    const apiKey = process.env.RESEND_API_KEY;
    const mailFrom = process.env.MAIL_FROM;
    const appUrl = process.env.APP_URL;

    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    if (isProd && (!apiKey || !mailFrom || !appUrl)) {
        return res.status(503).json({ error: 'Recupero via email non attivo: contatta l\'amministratore' });
    }

    const kv = getKv();
    if (emailNorm && !validateEmail(emailNorm) && kv) {
        const user = await getUserByEmail(emailNorm);
        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            await kv.set(`reset:${tokenHash}`, user.id, { exSeconds: 1800 });

            const resetLink = `${appUrl || 'http://localhost:3000'}/?reset=${token}`;

            if (apiKey && mailFrom) {
                try {
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: mailFrom,
                            to: user.email,
                            subject: 'Recupero Password - Archivio Semantico',
                            text: `Usa questo link per reimpostare la password (valido 30 minuti, monouso):\n\n${resetLink}`,
                            html: `<p>Usa questo link per reimpostare la password (valido 30 minuti, monouso):</p><p><a href="${resetLink}">${resetLink}</a></p>`
                        })
                    });
                } catch (err) {
                    console.error('Failed to send reset email:', err);
                }
            } else {
                console.log(`[DEV PASSWORD RESET LINK]: ${resetLink}`);
            }
        }
    }

    return res.status(200).json({ message: "Se l'indirizzo è registrato riceverai un'email" });
};
