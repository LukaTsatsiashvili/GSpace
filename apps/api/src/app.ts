import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { csrfGuard } from './security/auth.js';

export const app = express();
const origin = new URL(process.env.WEB_ORIGIN || 'http://localhost:5173').origin;

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '1mb', type: 'application/json' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gspace-api' });
});

app.use('/api/v1', csrfGuard);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
});

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid request data' } });
    return;
  }
  console.error('API request failed', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};
app.use(errorHandler);
