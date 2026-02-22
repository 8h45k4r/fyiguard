import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { settingsRouter } from './routes/settings';
import { policiesRouter } from './routes/policies';
import { analyticsRouter } from './routes/analytics';
import { scanRouter } from './routes/scan';

export const prisma = new PrismaClient();

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const API_PREFIX = '/api/v1';

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN']?.split(',') ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(createRateLimiter());

// Routes
app.use(`${API_PREFIX}/health`, healthRouter);
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/events`, eventsRouter);
app.use(`${API_PREFIX}/settings`, settingsRouter);
app.use(`${API_PREFIX}/policies`, policiesRouter);
app.use(`${API_PREFIX}/analytics`, analyticsRouter);
app.use(`${API_PREFIX}/scan`, scanRouter);

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling (must be last)
app.use(errorHandler);

async function main() {
  await prisma.$connect();
  console.log('[FYI Guard] Database connected');

  app.listen(PORT, () => {
    console.log(`[FYI Guard] API server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[FYI Guard] Failed to start:', err);
  prisma.$disconnect();
  process.exit(1);
});

export default app;