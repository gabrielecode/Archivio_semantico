import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { embedHandler, healthHandler } from './api/_lib/embed.js';
import loginHandler from './api/login.js';
import logoutHandler from './api/logout.js';
import meHandler from './api/me.js';

import accountHandler from './api/account.js';
import usersHandler from './api/users.js';
import registerHandler from './api/register.js';
import forgotHandler from './api/forgot.js';
import resetHandler from './api/reset.js';

dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', healthHandler);
app.post('/api/embed', embedHandler);
app.post('/api/login', loginHandler);
app.post('/api/logout', logoutHandler);
app.get('/api/me', meHandler);
app.post('/api/register', registerHandler);
app.post('/api/forgot', forgotHandler);
app.post('/api/reset', resetHandler);
app.all('/api/account', accountHandler);
app.all('/api/users', usersHandler);

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
