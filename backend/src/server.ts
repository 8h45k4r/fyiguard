/**
 * FYI Guard - Backend API Server
 * ==============================
 *
 * Entry point for the FYI Guard backend API.
 * Configures Express with security middleware, route handlers,
 * and database connectivity via Prisma + Supabase.
 *
 * Architecture:
 *   Client -> Express -> [helmet, cors, rateLimiter] -> [authenticate] -> Routes
 *                                                                          |
 *                                                         [guardMiddleware] -> GuardService
 *
 * @module server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
// @ts-expect-error - PrismaClient types available after `npx prisma generate`
import { PrismaClient } from '@prisma/client';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
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

// ---------------------------------------------------------------------------
// Database Client
// ---------------------------------------------------------------------------

/**
 * Shared Prisma client instance.
 * Exported so that middleware and services can reuse the same connection pool.
 * In production, Prisma manages connection pooling automatically.
 */
export const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Express App Configuration
// ---------------------------------------------------------------------------

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const API_PREFIX = '/api/v1';

// ---------------------------------------------------------------------------
// Global Middleware (applied to ALL routes)
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (applied globally)
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

// Public routes (no authentication required)
app.use(`${API_PREFIX}/health`, healthRouter);
app.use(`${API_PREFIX}/auth`, authRouter);

// Protected routes (authentication required)
app.use(`${API_PREFIX}/events`, authenticate, eventsRouter);
app.use(`${API_PREFIX}/settings`, authenticate, settingsRouter);
app.use(`${API_PREFIX}/policies`, authenticate, policiesRouter);
app.use(`${API_PREFIX}/analytics`, authenticate, analyticsRouter);
app.use(`${API_PREFIX}/scan`, authenticate, scanRouter);
app.use(`${API_PREFIX}/guard`, authenticate, guardRouter);

// ---------------------------------------------------------------------------
// Error Handling (must be registered LAST)
// ---------------------------------------------------------------------------

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
