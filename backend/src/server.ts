/**
 * FYI Guard - Backend API Server
 *
 * Entry point for the FYI Guard backend API.
 * Configures Express with security middleware, route handlers,
 * and database connectivity via Prisma + Supabase.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Database
import { prisma } from './lib/prisma';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/logger';
import { authenticate } from './middleware/auth';

// Routes
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { settingsRouter } from './routes/settings';
import { policiesRouter } from './routes/policies';
import { analyticsRouter } from './routes/analytics';
import { scanRouter } from './routes/scan';
import { guardRouter } from './routes/guard';
import alertsRouter from './routes/alerts';
import behaviorRouter from './routes/behavior';

// Re-export prisma for use in other modules
export { prisma };

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const API_PREFIX = '/api/v1';

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Public
app.use(`${API_PREFIX}/health`, healthRouter);
app.use(`${API_PREFIX}/auth`, authRouter);

// Protected
app.use(`${API_PREFIX}/events`, authenticate, eventsRouter);
app.use(`${API_PREFIX}/settings`, authenticate, settingsRouter);
app.use(`${API_PREFIX}/policies`, authenticate, policiesRouter);
app.use(`${API_PREFIX}/analytics`, authenticate, analyticsRouter);
app.use(`${API_PREFIX}/scan`, authenticate, scanRouter);
app.use(`${API_PREFIX}/guard`, authenticate, guardRouter);
app.use(`${API_PREFIX}/alerts`, authenticate, alertsRouter);
app.use(`${API_PREFIX}/behavior`, authenticate, behaviorRouter);

// Error handler (must be last)
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server Startup
// ---------------------------------------------------------------------------
async function main() {
  await prisma.$connect();
  console.log('[FYI Guard] Database connected');

  app.listen(PORT, () => {
    console.log(`[FYI Guard] API server running on port ${PORT}`);
    console.log(`[FYI Guard] API prefix: ${API_PREFIX}`);
    console.log(`[FYI Guard] Environment: ${process.env['NODE_ENV'] || 'development'}`);
  });
}

main().catch((err) => {
  console.error('[FYI Guard] Failed to start:', err);
  prisma.$disconnect();
  process.exit(1);
});

export default app;