import { requireAuth, throttle } from './_lib/auth.js';
import { getUser, getAllUsers, createUser as createKvUser, validatePassword, isNameTaken, normalizeId, ID_RE, User, saveUser, validateEmail, isEmailTaken } from './_lib/users.js';
import { kvMode, getKv } from './_lib/kv.js';
import crypto from 'crypto';

export default async (req: any, res: any) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const adminUser = await getUser(userId);
    if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato: richiesto ruolo amministratore' });
    }

    const method = req.method;

    if (['POST', 'PATCH', 'DELETE'].includes(method)) {
        if (kvMode() === 'none') {
            return res.status(503).json({ error: 'Per modificare gli accessi serve il database (Upstash Redis) collegato a Vercel' });
        }
        const ct = req.headers['content-type'] || '';
        if (!ct.toLowerCase().startsWith('application/json')) {
            return res.status(415).json({ error: 'Unsupported Media Type' });
        }
    }

    const adminThrottle = await throttle(`admin:${userId}`, 30, 600);
    if (!adminThrottle.allowed) {
        return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    }

    const kv = getKv();

    if (method === 'GET') {
        try {
            const all = await getAllUsers();
            const list = all.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email || '',
                role: u.role,
                source: u.source,
                created: u.created
            }));
            return res.status(200).json({ users: list });
        } catch (err: any) {
            console.error('Error listing users:', err);
            return res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    if (method === 'POST') {
        const { id, name, password, email, role } = req.body || {};
        const normId = normalizeId(id);
        if (!ID_RE.test(normId)) {
            return res.status(400).json({ error: 'ID non valido (3-64 caratteri alfanumerici, . _ @ -)' });
        }
        if (!name || typeof name !== 'string' || name.trim().length < 3) {
            return res.status(400).json({ error: 'Nome non valido (almeno 3 caratteri)' });
        }
        const pwError = validatePassword(password, normId);
        if (pwError) {
            return res.status(400).json({ error: pwError });
        }
        let normEmail: string | undefined = undefined;
        if (email) {
            const errEmail = validateEmail(email);
            if (errEmail) return res.status(400).json({ error: errEmail });
            normEmail = email.trim().toLowerCase();
            if (await isEmailTaken(normEmail!)) {
                return res.status(400).json({ error: 'Email già in uso' });
            }
        }
        const targetRole = role === 'admin' ? 'admin' : 'user';

        const existing = await getUser(normId);
        if (existing) {
            return res.status(400).json({ error: 'Utente con questo ID già esistente' });
        }

        const nameTaken = await isNameTaken(name);
        if (nameTaken) {
            return res.status(400).json({ error: 'Nome utente già in uso' });
        }

        if (!kv) {
            return res.status(503).json({ error: 'Storage non disponibile' });
        }

        const resCreate = await createKvUser({
            id: normId,
            name: name.trim(),
            password,
            email: normEmail,
            role: targetRole
        });

        if (!resCreate.ok) {
            return res.status(400).json({ error: resCreate.error });
        }

        console.log(`[Admin] User created: ${normId} by admin ${adminUser.id}`);
        return res.status(201).json({
            user: {
                id: resCreate.user!.id,
                name: resCreate.user!.name,
                email: resCreate.user!.email || '',
                role: resCreate.user!.role,
                source: resCreate.user!.source,
                created: resCreate.user!.created
            }
        });
    }

    if (method === 'PATCH') {
        const { id, action, newPassword, name, email, role } = req.body || {};
        const normId = normalizeId(id);
        if (!normId) {
            return res.status(400).json({ error: 'ID utente richiesto' });
        }

        const targetUser = await getUser(normId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        if (!kv) {
            return res.status(503).json({ error: 'Storage non disponibile' });
        }

        if (action === 'reset-password') {
            const pwError = validatePassword(newPassword, normId);
            if (pwError) {
                return res.status(400).json({ error: pwError });
            }

            const updated: User = {
                ...targetUser,
                hash: (await import('./_lib/users.js')).hashPassword(newPassword),
                sessionsValidFrom: Date.now(),
                source: 'kv'
            };

            await saveUser(updated);
            console.log(`[Admin] Password reset for user: ${normId} by admin ${adminUser.id}`);
            return res.status(200).json({ ok: true });
        }

        if (action === 'rename') {
            if (!name || typeof name !== 'string' || name.trim().length < 3) {
                return res.status(400).json({ error: 'Nome non valido' });
            }
            const trimmedName = name.trim();
            const taken = await isNameTaken(trimmedName, normId);
            if (taken) {
                return res.status(400).json({ error: 'Nome già in uso' });
            }

            const updated: User = {
                ...targetUser,
                name: trimmedName,
                source: 'kv'
            };

            await saveUser(updated);
            console.log(`[Admin] User renamed: ${normId} -> ${trimmedName} by admin ${adminUser.id}`);
            return res.status(200).json({ ok: true });
        }

        if (action === 'email') {
            const errEmail = validateEmail(email);
            if (errEmail) return res.status(400).json({ error: errEmail });
            const normEmail = email.trim().toLowerCase();
            const taken = await isEmailTaken(normEmail, normId);
            if (taken) return res.status(400).json({ error: 'Email già in uso' });

            const updated: User = {
                ...targetUser,
                email: normEmail,
                source: 'kv'
            };

            await saveUser(updated);
            console.log(`[Admin] Email changed for ${normId} to ${normEmail} by admin ${adminUser.id}`);
            return res.status(200).json({ ok: true });
        }

        if (action === 'role') {
            const newRole = role === 'admin' ? 'admin' : 'user';
            if (targetUser.role === 'admin' && newRole === 'user') {
                const { countAdmins } = await import('./_lib/users.js');
                const adminCount = await countAdmins();
                if (adminCount <= 1) {
                    return res.status(400).json({ error: "Impossibile declassare l'ultimo amministratore" });
                }
            }

            const updated: User = {
                ...targetUser,
                role: newRole,
                source: 'kv'
            };

            await saveUser(updated);
            console.log(`[Admin] Role changed for ${normId} to ${newRole} by admin ${adminUser.id}`);
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Azione non valida' });
    }

    if (method === 'DELETE') {
        const { id } = req.body || {};
        const normId = normalizeId(id);
        if (!normId) {
            return res.status(400).json({ error: 'ID utente richiesto' });
        }

        if (normId === normalizeId(adminUser.id)) {
            return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
        }

        const targetUser = await getUser(normId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        if (targetUser.role === 'admin') {
            const { countAdmins } = await import('./_lib/users.js');
            const adminCount = await countAdmins();
            if (adminCount <= 1) {
                return res.status(400).json({ error: "Impossibile eliminare l'ultimo amministratore" });
            }
        }

        if (!kv) {
            return res.status(503).json({ error: 'Storage non disponibile' });
        }

        // Set sessionsValidFrom before deleting
        targetUser.sessionsValidFrom = Date.now();
        await saveUser(targetUser);

        await kv.del(`user:${normId}`);
        if (targetUser.email) {
            try {
                await kv.del(`email:${targetUser.email.toLowerCase()}`);
            } catch {}
        }

        try {
            const indexRaw = await kv.get('users:index');
            let ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
            if (Array.isArray(ids)) {
                ids = ids.filter(i => i !== normId);
                await kv.set('users:index', JSON.stringify(ids));
            }
        } catch {}

        console.log(`[Admin] User deleted: ${normId} by admin ${adminUser.id}`);
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
