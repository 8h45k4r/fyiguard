/**
 * Authentication & Authorization Middleware
 * ==========================================
 *
 * Provides JWT-based authentication and role-based authorization
 * for the FYI Guard backend API.
 *
 * Exports:
 *   - AuthRequest: Extended Request interface with userId and userRole
 *   - authenticate: Middleware that verifies JWT and attaches user context
 *   - requireAdmin: Middleware that enforces superadmin role
 *
 * Usage:
 *   router.get('/protected', authenticate, handler);
 *   router.post('/admin-only', authenticate, requireAdmin, handler);
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

// ==========================================
// Types
// ==========================================

/**
 * Extended Express Request with authenticated user context.
 * Populated by the `authenticate` middleware.
 */
export interface AuthRequest extends Request {
  /** The authenticated user's database ID (cuid) */
  userId?: string;
  /** The authenticated user's role (e.g., 'MEMBER', 'ADMIN', 'superadmin') */
  userRole?: string;
}

/** Shape of the JWT payload we sign and verify */
interface JwtPayload {
  userId: string;
  role: string;
}

// ==========================================
// Constants
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET ?? 'secret';
const BEARER_PREFIX = 'Bearer ';

// ==========================================
// authenticate
// ==========================================

/**
 * Verifies the Authorization header contains a valid JWT.
 *
 * On success:
 *   - Sets req.userId to the authenticated user's database ID
 *   - Sets req.userRole to the user's role from the token
 *   - Calls next()
 *
 * On failure:
 *   - Returns 401 with a generic error message
 *
 * Implementation notes:
 *   - Extracts token from "Bearer <token>" header format
 *   - Verifies token signature and decodes payload
 *   - Confirms user still exists in the database (prevents stale tokens)
 *   - Uses the DB role as authoritative (never trusts token role alone)
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Guard: missing or malformed Authorization header
  if (!authHeader?.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(BEARER_PREFIX.length);

  try {
    // Verify token signature and decode payload
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Confirm user still exists (prevents use of tokens for deleted users)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user context to request
    // Note: We use the DB role (authoritative), not the token role
    req.userId = user.id;
    req.userRole = user.role;

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ==========================================
// requireAdmin
// ==========================================

/**
 * Authorization middleware that enforces superadmin access.
 *
 * Must be used AFTER `authenticate` in the middleware chain.
 * Returns 403 if the authenticated user is not a superadmin.
 *
 * Checks for both 'ADMIN' (Prisma enum) and 'superadmin' (Guard role)
 * to maintain compatibility between the extension auth system
 * and the Guard multi-tenant system.
 *
 * Usage:
 *   router.delete('/users/:id', authenticate, requireAdmin, handler);
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const role = req.userRole;

  // Accept both Prisma Role enum ('ADMIN') and Guard role ('superadmin')
  if (role !== 'ADMIN' && role !== 'superadmin') {
    res.status(403).json({ error: 'Insufficient permissions. Admin access required.' });
    return;
  }

  next();
}

// Legacy alias — some older route files reference `requireAuth`
// TODO: migrate all route files to use `authenticate`, then remove this alias
export const requireAuth = authenticate;1
