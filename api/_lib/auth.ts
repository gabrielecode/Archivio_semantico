import crypto from 'crypto';

type RequestLike = {
    headers: Record<string, any>;
    socket: { remoteAddress?: string };
};
type ResponseLike = {
    status: (code: number) => { json: (data: any) => void };
    setHeader: (name: string, value: string) => void;
};

let usersCache: { id: string; name: string; hash: string }[] | null = null;

export const getUsers = () => {
    if (usersCache) return usersCache;
    try {
        const users = JSON.parse(process.env.USERS || '[]');
        if (!Array.isArray(users)) throw new Error();
        const validUsers = users.filter((u: any) => typeof u.id === 'string' && /^[a-z0-9_-]{1,32}$/.test(u.id) && typeof u.name === 'string' && typeof u.hash === 'string');
        const ids = new Set<string>();
        usersCache = validUsers.filter((u: { id: string }) => {
            if (ids.has(u.id)) return false;
            ids.add(u.id);
            return true;
        });
        return usersCache;
    } catch {
        return [];
    }
};

const getSecret = () => process.env.AUTH_SECRET;

export const verifyPassword = (pw: string, stored: string) => {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'base64');
    const hash = Buffer.from(parts[2], 'base64');
    const derived = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(derived, hash);
};

export const dummyScrypt = () => {
    crypto.scryptSync('dummy', Buffer.alloc(16), 32, { N: 16384, r: 8, p: 1 });
};

export const signSession = (userId: string) => {
    const secret = getSecret();
    if (!secret) return null;
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: userId, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
};

export const verifySession = (token: string) => {
    const secret = getSecret();
    if (!secret) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
    try {
        const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (exp < Date.now()) return null;
        if (!getUsers().some(uObj => uObj.id === u)) return null;
        return u;
    } catch {
        return null;
    }
};

const loginThrottle = new Map<string, { count: number; resetTime: number }>();

export const checkThrottle = (ip: string) => {
    const now = Date.now();
    const data = loginThrottle.get(ip) || { count: 0, resetTime: now + 10 * 60 * 1000 };
    if (data.resetTime < now) { data.count = 0; data.resetTime = now + 10 * 60 * 1000; }
    return data;
};

export const requireAuth = (req: RequestLike, res: ResponseLike) => {
    const cookieHeader = req.headers['cookie'];
    const token = cookieHeader?.split('; ').find((c: string) => c.startsWith('tcm_session='))?.split('=')[1];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const userId = verifySession(token);
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    return userId;
};

export const setCookie = (res: ResponseLike, token: string, secure: boolean) => {
    res.setHeader('Set-Cookie', `tcm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure ? '; Secure' : ''}`);
};

export const clearCookie = (res: ResponseLike) => {
    res.setHeader('Set-Cookie', 'tcm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
};
