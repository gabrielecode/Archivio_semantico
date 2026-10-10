import { getUsers, requireAuth } from './_lib/auth.js';

export default async (req: any, res: any) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const userId = requireAuth(req, res);
    if (!userId) return;
    const user = getUsers().find((u: { id: string; name: string; hash: string }) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(200).json({ user: { id: user.id, name: user.name } });
};
