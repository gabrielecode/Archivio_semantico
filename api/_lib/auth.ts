import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export type RequestLike = {
    method?: string;
    body?: any;
    query?: Record<string, any>;
    headers: Record<string, any>;
    socket?: { remoteAddress?: string };
};

export type ResponseLike = {
    status: (code: number) => { json: (data: any) => void };
    setHeader: (name: string, value: string) => void;
    end?: (chunk?: any) => void;
};

const JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface AuthenticatedUser {
    uid: string;
    email?: string;
}

export async function verifyFirebaseAuth(req: RequestLike): Promise<AuthenticatedUser | null> {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;

    const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
    if (!projectId) return null;

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
        });
        if (payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub) {
            return null;
        }
        return {
            uid: payload.sub,
            email: typeof payload.email === 'string' ? payload.email : undefined,
        };
    } catch {
        return null;
    }
}

export class SlidingWindowLimiter {
    private store = new Map<string, { count: number; resetTime: number }>();

    constructor(private windowMs = 60_000) {
        const timer = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store.entries()) {
                if (now > entry.resetTime) {
                    this.store.delete(key);
                }
            }
        }, windowMs);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    consume(key: string, limit: number): boolean {
        const now = Date.now();
        const current = this.store.get(key);
        if (!current || current.resetTime <= now) {
            this.store.set(key, { count: 1, resetTime: now + this.windowMs });
            return true;
        }
        if (current.count >= limit) {
            return false;
        }
        current.count += 1;
        return true;
    }
}
