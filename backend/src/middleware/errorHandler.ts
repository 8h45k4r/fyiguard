import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[FYI Guard] Error:', err.message);
  const status = (err as Error & { status?: number }).status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}

export class AppError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'AppError';
  }
}