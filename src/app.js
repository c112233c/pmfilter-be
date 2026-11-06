import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.id = req.headers['x-request-id']?.toString().slice(0, 100) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-API-Key'],
  maxAge: 600,
}));
app.use(express.json({ limit: '1mb', strict: true }));
app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (req, res, next) => {
  try {
    const { pool } = await import('./config/database.js');
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
