import crypto from 'crypto';
import { getKv } from './kv.js';

export type User = {
    id: string;
    name: string;
    hash: string;
    created: string;
    source: 'env' | 'kv';
    sessionsValidFrom: number;
    recoveryHash?: string;
    role: 'admin' | 'user';
    email?: string;
};

export const normalizeId = (s: any): string => String(s || '').trim().toLowerCase();
export const ID_RE = /^[a-z0-9._@-]{3,64}$/;

let envUsersCache: User[] | null = null;
let lastEnvRaw: string | undefined = undefined;

export const envUsers = (): User[] => {
    const raw = process.env.USERS;
    if (envUsersCache && lastEnvRaw === raw) return envUsersCache;
    lastEnvRaw = raw;
    if (!raw) {
        envUsersCache = [];
        return envUsersCache;
    }
    let cleaned = raw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1).trim();
    }
    try {
        let parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) {
            if (parsed && typeof parsed === 'object') {
                parsed = [parsed];
            } else {
                throw new Error('Not an array or object');
            }
        }
        const validUsers: User[] = [];
        const ids = new Set<string>();
        for (const u of parsed) {
            if (!u || typeof u.id !== 'string' || typeof u.name !== 'string' || typeof u.hash !== 'string') {
                console.warn('Skipping invalid user format in USERS env');
                continue;
            }
            const norm = normalizeId(u.id);
            if (!ID_RE.test(norm)) {
                console.warn(`Skipping user with invalid id format: ${norm}`);
                continue;
            }
            if (ids.has(norm)) {
                console.warn(`Skipping duplicate user id: ${norm}`);
                continue;
            }
            ids.add(norm);
            validUsers.push({
                id: norm,
                name: u.name,
                hash: u.hash,
                created: u.created || new Date().toISOString(),
                source: 'env',
                sessionsValidFrom: 0,
                recoveryHash: u.recoveryHash,
                role: u.role === 'user' ? 'user' : 'admin'
            });
        }
        envUsersCache = validUsers;
        return envUsersCache;
    } catch (err) {
        const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
        const validUsers: User[] = [];
        const ids = new Set<string>();
        for (const part of parts) {
            const norm = normalizeId(part);
            if (norm.length >= 3 && ID_RE.test(norm) && !ids.has(norm)) {
                ids.add(norm);
                validUsers.push({
                    id: norm,
                    name: part,
                    hash: '',
                    created: new Date().toISOString(),
                    source: 'env',
                    sessionsValidFrom: 0,
                    role: 'admin'
                });
            }
        }
        if (validUsers.length > 0) {
            envUsersCache = validUsers;
            return envUsersCache;
        }
        console.warn('Failed to parse USERS env:', err);
        envUsersCache = [];
        return envUsersCache;
    }
};

export const getUser = async (id: string): Promise<User | null> => {
    const norm = normalizeId(id);
    const forceEnv = process.env.FORCE_ENV_USERS === 'true';

    if (forceEnv) {
        const envU = envUsers().find(u => u.id === norm);
        if (envU) return envU;
    }

    const kv = getKv();
    if (kv) {
        try {
            const raw = await kv.get(`user:${norm}`);
            if (raw) {
                const u = JSON.parse(raw) as User;
                if (u) return u;
            }
        } catch {}
    }

    if (!forceEnv) {
        const envU = envUsers().find(u => u.id === norm);
        if (envU) return envU;
    }

    return null;
};

export const getAllUsers = async (): Promise<User[]> => {
    const envU = envUsers();
    const kv = getKv();
    const forceEnv = process.env.FORCE_ENV_USERS === 'true';

    if (!kv) return envU;

    try {
        const indexRaw = await kv.get('users:index');
        const ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        const kvUsers: User[] = [];
        if (Array.isArray(ids)) {
            for (const id of ids) {
                const raw = await kv.get(`user:${id}`);
                if (raw) {
                    try {
                        kvUsers.push(JSON.parse(raw));
                    } catch {}
                }
            }
        }

        const map = new Map<string, User>();
        if (forceEnv) {
            for (const u of kvUsers) map.set(u.id, u);
            for (const u of envU) map.set(u.id, u);
        } else {
            for (const u of envU) map.set(u.id, u);
            for (const u of kvUsers) map.set(u.id, u);
        }
        return Array.from(map.values());
    } catch {
        return envU;
    }
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateEmail = (email: any): string | null => {
    if (typeof email !== 'string') return 'Email non valida';
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length > 200 || !EMAIL_RE.test(trimmed)) return 'Email non valida';
    return null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
    if (!email || typeof email !== 'string') return null;
    const normEmail = email.trim().toLowerCase();
    const kv = getKv();
    if (kv) {
        try {
            const id = await kv.get(`email:${normEmail}`);
            if (id) {
                return await getUser(id);
            }
        } catch {}
    }
    const all = await getAllUsers();
    return all.find(u => u.email && u.email.toLowerCase() === normEmail) || null;
};

export const isEmailTaken = async (email: string, exceptId?: string): Promise<boolean> => {
    if (!email || typeof email !== 'string') return false;
    const normEmail = email.trim().toLowerCase();
    const normExcept = exceptId ? normalizeId(exceptId) : undefined;
    const existing = await getUserByEmail(normEmail);
    if (!existing) return false;
    if (normExcept && existing.id === normExcept) return false;
    return true;
};

export const saveUser = async (user: User): Promise<boolean> => {
    const kv = getKv();
    if (!kv) return false;
    const normId = normalizeId(user.id);
    const oldUser = await getUser(normId);

    if (oldUser && oldUser.email && oldUser.email !== user.email) {
        try {
            await kv.del(`email:${oldUser.email.toLowerCase()}`);
        } catch {}
    }

    if (user.email) {
        const normEmail = user.email.trim().toLowerCase();
        const existingId = await kv.get(`email:${normEmail}`);
        if (existingId && existingId !== normId) {
            return false;
        }
        await kv.set(`email:${normEmail}`, normId);
    }

    const updated: User = {
        ...user,
        id: normId,
        source: 'kv',
        email: user.email ? user.email.trim().toLowerCase() : undefined
    };

    await kv.set(`user:${normId}`, JSON.stringify(updated));

    try {
        const indexRaw = await kv.get('users:index');
        let ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        if (!Array.isArray(ids)) ids = [];
        if (!ids.includes(normId)) {
            ids.push(normId);
            await kv.set('users:index', JSON.stringify(ids));
        }
    } catch {}

    return true;
};

export const createUser = async (u: { id: string; name: string; password: string; email?: string; role?: 'admin' | 'user'; fromEnv?: boolean }) => {
    const normId = normalizeId(u.id);
    if (!ID_RE.test(normId)) {
        return { ok: false, error: 'ID non valido (3-64 caratteri alfanumerici, . _ @ -)' };
    }
    if (!u.fromEnv && ['admin', 'root', 'system'].includes(normId)) {
        return { ok: false, error: 'Questo ID è riservato' };
    }

    if (await isNameTaken(u.name, normId)) {
        return { ok: false, error: 'Nome già in uso' };
    }

    let normEmail: string | undefined = undefined;
    if (u.email) {
        const errEmail = validateEmail(u.email);
        if (errEmail) return { ok: false, error: errEmail };
        normEmail = u.email.trim().toLowerCase();
        if (await isEmailTaken(normEmail, normId)) {
            return { ok: false, error: 'Email già in uso' };
        }
    }

    const kv = getKv();
    if (!kv) {
        return { ok: false, error: 'Storage non disponibile' };
    }

    if (normEmail) {
        await kv.set(`email:${normEmail}`, normId, { nx: true });
        const owner = await kv.get(`email:${normEmail}`);
        if (owner && owner !== normId) {
            return { ok: false, error: 'Email già in uso' };
        }
        await kv.set(`email:${normEmail}`, normId);
    }

    const newUser: User = {
        id: normId,
        name: u.name,
        hash: hashPassword(u.password),
        created: new Date().toISOString(),
        source: 'kv',
        sessionsValidFrom: 0,
        email: normEmail,
        role: u.role || 'user'
    };

    const setOk = await kv.set(`user:${normId}`, JSON.stringify(newUser), { nx: !u.fromEnv });
    if (!setOk && !u.fromEnv) {
        if (normEmail) await kv.del(`email:${normEmail}`);
        return { ok: false, error: 'Utente già esistente' };
    }
    if (u.fromEnv) {
        await kv.set(`user:${normId}`, JSON.stringify(newUser));
    }

    try {
        const indexRaw = await kv.get('users:index');
        let ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        if (!Array.isArray(ids)) ids = [];
        if (!ids.includes(normId)) {
            ids.push(normId);
            await kv.set('users:index', JSON.stringify(ids));
        }
    } catch {}

    return { ok: true, user: newUser };
};

export const isNameTaken = async (name: string, exceptId?: string): Promise<boolean> => {
    if (!name || typeof name !== 'string') return false;
    const normName = normalizeId(name);
    const trimmedLower = name.trim().toLowerCase();
    const normExcept = exceptId ? normalizeId(exceptId) : undefined;
    const all = await getAllUsers();
    for (const u of all) {
        if (normExcept && u.id === normExcept) continue;
        if (u.id === normName || u.id === trimmedLower || u.name.trim().toLowerCase() === trimmedLower) {
            return true;
        }
    }
    return false;
};

export const updateUser = async (id: string, patch: Partial<User>) => {
    const norm = normalizeId(id);
    let user = await getUser(norm);
    const kv = getKv();
    if (!kv) return false;

    if (!user) {
        // If user exists in env but not yet in KV, create KV record
        const envU = envUsers().find(e => e.id === norm);
        if (envU) {
            user = { ...envU, source: 'kv' };
        } else {
            return false;
        }
    }

    const updated = { ...user, ...patch, id: norm, source: 'kv' as const };
    await kv.set(`user:${norm}`, JSON.stringify(updated));

    try {
        const indexRaw = await kv.get('users:index');
        let ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
        if (!Array.isArray(ids)) ids = [];
        if (!ids.includes(norm)) {
            ids.push(norm);
            await kv.set('users:index', JSON.stringify(ids));
        }
    } catch {}

    return true;
};

export const validatePassword = (pw: any, username: any): string | null => {
    if (typeof pw !== 'string') return 'Password non valida';
    if (pw.length < 8) return 'La password deve essere di almeno 8 caratteri';
    if (pw.length > 200) return 'La password è troppo lunga (massimo 200 caratteri)';
    if (username && typeof username === 'string' && pw === username) return 'La password non può essere uguale al nome utente';
    if (/^\d+$/.test(pw)) return 'La password non può contenere solo numeri';
    return null;
};

export const hashPassword = (pw: string): string => {
    const normalized = (pw || '').normalize('NFC');
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(normalized, salt, 32, { N: 16384, r: 8, p: 1 });
    return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
};

export const verifyPassword = (pw: string, stored: string): boolean => {
    if (!pw || typeof pw !== 'string' || !stored || typeof stored !== 'string') return false;
    const normalized = pw.normalize('NFC');
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    try {
        const salt = Buffer.from(parts[1], 'base64');
        const hash = Buffer.from(parts[2], 'base64');
        if (salt.length === 0 || hash.length === 0) return false;
        const derived = crypto.scryptSync(normalized, salt, hash.length, { N: 16384, r: 8, p: 1 });
        if (derived.length !== hash.length) return false;
        return crypto.timingSafeEqual(derived, hash);
    } catch {
        return false;
    }
};

export const dummyScrypt = () => {
    crypto.scryptSync('dummy', Buffer.alloc(16), 32, { N: 16384, r: 8, p: 1 });
};

export const findByLoginName = async (input: string): Promise<User | null> => {
    const norm = normalizeId(input);
    const user = await getUser(norm);
    if (user) return user;

    const allUsers = await getAllUsers();
    const matches = allUsers.filter(u => u.name.toLowerCase() === input.toLowerCase() || u.name === input);
    if (matches.length === 1) return matches[0];
    return null;
};
