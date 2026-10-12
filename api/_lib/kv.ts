import fs from 'fs';
import path from 'path';

export interface Kv {
    get(k: string): Promise<string | null>;
    set(k: string, v: string, o?: { nx?: boolean; exSeconds?: number }): Promise<boolean>;
    del(k: string): Promise<void>;
    incr(k: string, exSeconds: number): Promise<number>;
}

export type KvMode = 'redis' | 'file' | 'none';

export const kvMode = (): KvMode => {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (redisUrl && redisToken) return 'redis';
    if (!process.env.VERCEL) return 'file';
    return 'none';
};

class RedisKv implements Kv {
    private url: string;
    private token: string;

    constructor() {
        this.url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
        this.token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
    }

    private async command(cmd: any[]): Promise<any> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cmd),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await res.json() as { result?: any; error?: string };
            if (data.error) {
                throw new Error(data.error);
            }
            return data.result;
        } catch (err: any) {
            clearTimeout(timeout);
            throw err;
        }
    }

    async get(k: string): Promise<string | null> {
        const res = await this.command(['GET', k]);
        return res != null ? String(res) : null;
    }

    async set(k: string, v: string, o?: { nx?: boolean; exSeconds?: number }): Promise<boolean> {
        const args: any[] = ['SET', k, v];
        if (o?.nx) args.push('NX');
        if (o?.exSeconds) args.push('EX', o.exSeconds);
        const res = await this.command(args);
        if (o?.nx) {
            return res === 'OK';
        }
        return res === 'OK' || res != null;
    }

    async del(k: string): Promise<void> {
        await this.command(['DEL', k]);
    }

    async incr(k: string, exSeconds: number): Promise<number> {
        const val = await this.command(['INCR', k]);
        const num = Number(val);
        if (num === 1 && exSeconds > 0) {
            await this.command(['EXPIRE', k, exSeconds]);
        }
        return num;
    }
}

class FileKv implements Kv {
    private filePath: string;
    private writeChain: Promise<void> = Promise.resolve();

    constructor() {
        this.filePath = path.join(process.cwd(), '.data', 'kv.json');
    }

    private load(): Record<string, { v: string; exp?: number }> {
        try {
            if (!fs.existsSync(this.filePath)) return {};
            const raw = fs.readFileSync(this.filePath, 'utf8');
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    private save(data: Record<string, { v: string; exp?: number }>): void {
        this.writeChain = this.writeChain.then(async () => {
            try {
                fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
                fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
            } catch (err) {
                console.error('FileKv write error:', err);
            }
        });
    }

    async get(k: string): Promise<string | null> {
        const data = this.load();
        const item = data[k];
        if (!item) return null;
        if (item.exp && item.exp < Date.now()) {
            delete data[k];
            this.save(data);
            return null;
        }
        return item.v;
    }

    async set(k: string, v: string, o?: { nx?: boolean; exSeconds?: number }): Promise<boolean> {
        const data = this.load();
        const item = data[k];
        const now = Date.now();
        if (item && item.exp && item.exp < now) {
            delete data[k];
        }
        if (o?.nx && data[k]) {
            return false;
        }
        const exp = o?.exSeconds ? now + o.exSeconds * 1000 : undefined;
        data[k] = { v, exp };
        this.save(data);
        return true;
    }

    async del(k: string): Promise<void> {
        const data = this.load();
        if (data[k]) {
            delete data[k];
            this.save(data);
        }
    }

    async incr(k: string, exSeconds: number): Promise<number> {
        const data = this.load();
        const now = Date.now();
        const item = data[k];
        let current = 0;
        if (item) {
            if (item.exp && item.exp < now) {
                delete data[k];
            } else {
                current = Number(item.v) || 0;
            }
        }
        current++;
        const exp = current === 1 && exSeconds > 0 ? now + exSeconds * 1000 : (item ? item.exp : undefined);
        data[k] = { v: String(current), exp };
        this.save(data);
        return current;
    }
}

let kvInstance: Kv | null = null;
let currentMode: KvMode = 'none';

export const getKv = (): Kv | null => {
    const mode = kvMode();
    if (mode === 'none') return null;
    if (!kvInstance || currentMode !== mode) {
        currentMode = mode;
        if (mode === 'redis') {
            kvInstance = new RedisKv();
        } else {
            kvInstance = new FileKv();
        }
    }
    return kvInstance;
};
