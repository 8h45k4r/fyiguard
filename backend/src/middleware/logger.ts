/**
 * FYI Guard - Request Logger Middleware
 *
 * Structured request/response logging using morgan.
 * - Development: colorized, concise output
 * - Production: JSON format for log aggregators
 */
import morgan from 'morgan';
import { Request, Response } from 'express';

/** JSON log token for production structured logging */
morgan.token('body-length', (req: Request) =>
  req.body ? String(JSON.stringify(req.body).length) : '0'
);

/** Development logger - colorized, human-readable */
const devFormat = ':method :url :status :response-time ms - :body-length bytes';

/** Production logger - JSON for log aggregators */
const prodFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  ip: ':remote-addr',
});

export const requestLogger =
  process.env['NODE_ENV'] === 'production'
    ? morgan(prodFormat)
    : morgan(devFormat);