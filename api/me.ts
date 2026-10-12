import { requireAuth } from './_lib/auth.js';
import { getUser } from './_lib/users.js';

export default async (req: any, res: any) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const user = await getUser(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
};
