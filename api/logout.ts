import { clearCookie } from './_lib/auth.js';

export default async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    clearCookie(res);
    res.status(200).json({ ok: true });
};
