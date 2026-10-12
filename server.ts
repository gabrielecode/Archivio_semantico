import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { embedHandler, healthHandler } from './api/_lib/embed.js';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', healthHandler);
app.post('/api/embed', embedHandler);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

(async () => {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer } = await import('vite');
        const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
        app.use(vite.middlewares);
    } else {
        const dist = path.resolve(process.cwd(), 'dist');
        app.use(express.static(dist));
        app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
    app.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`));
})();
