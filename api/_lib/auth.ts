import crypto from 'crypto';
import { getKv, kvMode } from './kv.js';
import { getUser, envUsers, verifyPassword, hashPassword, dummyScrypt } from './users.js';

type RequestLike = {
    headers: Record<string, any>;
    socket: { remoteAddress?: string };
};
type ResponseLike = {
    status: (code: number) => { json: (data: any) => void };
    setHeader: (name: string, value: string) => void;
};

export { verifyPassword, hashPassword, dummyScrypt };

export const getSecret = () => process.env.AUTH_SECRET;

export const signSession = (userId: string) => {
    const secret = getSecret();
    if (!secret) return null;
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const iat = Date.now();
    const payload = Buffer.from(JSON.stringify({ u: userId, iat, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
};

export const verifySession = async (token: string): Promise<string | null> => {
    const secret = getSecret();
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!payload || !signature) return null;
    try {
        const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
        const { u, iat, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!exp || exp < Date.now()) return null;
        const user = await getUser(u);
        if (!user) return null;
        if (user.sessionsValidFrom && iat && iat < user.sessionsValidFrom) return null;
        return user.id;
    } catch {
        return null;
    }
};

const inMemThrottle = new Map<string, { count: number; resetTime: number }>();

export const throttle = async (key: string, max: number, windowSec: number): Promise<{ allowed: boolean; retryAfterSec: number }> => {
    const kv = getKv();
    if (kvMode() !== 'none' && kv) {
        const kvKey = `thr:${key}`;
        try {
            const count = await kv.incr(kvKey, windowSec);
            if (count > max) {
                return { allowed: false, retryAfterSec: windowSec };
            }
            return { allowed: true, retryAfterSec: 0 };
        } catch {
            // fallback to in-memory
        }
    }

    const now = Date.now();
    let data = inMemThrottle.get(key);
    if (!data || data.resetTime < now) {
        data = { count: 0, resetTime: now + windowSec * 1000 };
        inMemThrottle.set(key, data);
    }
    data.count++;
    if (data.count > max) {
        const retryAfterSec = Math.ceil((data.resetTime - now) / 1000);
        return { allowed: false, retryAfterSec: retryAfterSec > 0 ? retryAfterSec : windowSec };
    }
    return { allowed: true, retryAfterSec: 0 };
};

export const requireAuth = async (req: RequestLike, res: ResponseLike): Promise<string | null> => {
    const cookieHeader = req.headers['cookie'];
    const token = cookieHeader?.split('; ').find((c: string) => c.trim().startsWith('tcm_session='))?.split('=')[1];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const userId = await verifySession(token);
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

export const getAuthStatus = () => {
    const secretOk = !!process.env.AUTH_SECRET;
    const geminiOk = !!process.env.GEMINI_API_KEY;
    const registration = !!process.env.INVITE_CODE && kvMode() !== 'none';
    return {
        users: envUsers().length,
        store: kvMode(),
        auth: secretOk,
        embed: geminiOk,
        registration
    };
};
