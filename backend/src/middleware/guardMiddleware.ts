/**
 * Guard Middleware
 * ================
 * Express middleware that intercepts incoming prompts and evaluates them
 * through the GuardService before allowing them to reach the AI platform.
 *
 * This middleware sits between authentication and the route handler,
 * providing a transparent security layer for all prompt-based requests.
 *
 * Flow: Request -> Auth -> GuardMiddleware -> Route Handler
 *
 * @module middleware/guardMiddleware
 */

import { Response, NextFunction } from 'express';
import {
  GuardService,
  GuardVerdict,
  UserRole,
} from '../services/guardService';
import { AuthRequest } from './auth';
import { prisma } from '../server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the guard middleware.
 * Allows per-route customization of guard behavior.
 */
export interface GuardMiddlewareOptions {
  /** Skip guard evaluation entirely (useful for health/auth routes) */
  skip?: boolean;

  /** Override the default action for when GuardService is unavailable */
  fallbackAction?: 'ALLOW' | 'BLOCK';

  /** Custom field name to read the prompt from in req.body */
  promptField?: string;

  /** Custom field name to read the platform from in req.body */
  platformField?: string;

  /** If true, attach verdict to req but do not block (monitor-only mode) */
  monitorOnly?: boolean;
}

/**
 * Extended request type that includes guard verdict data.
 * Downstream route handlers can access `req.guardVerdict` for logging
 * or conditional logic.
 */
export interface GuardedRequest extends AuthRequest {
  guardVerdict?: GuardVerdict;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<GuardMiddlewareOptions> = {
  skip: false,
  fallbackAction: 'BLOCK',
  promptField: 'prompt',
  platformField: 'platform',
  monitorOnly: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps the string-based userRole from AuthRequest to the GuardService UserRole type.
 * Falls back to 'member' if the role is unrecognized.
 */
function toUserRole(role?: string): UserRole {
  const validRoles: UserRole[] = ['member', 'org_admin', 'superadmin'];
  if (role && validRoles.includes(role as UserRole)) {
    return role as UserRole;
  }
  // Map Prisma enum values to GuardService roles
  const roleMap: Record<string, UserRole> = {
    MEMBER: 'member',
    ADMIN: 'org_admin',
    superadmin: 'superadmin',
  };
  return roleMap[role || ''] || 'member';
}

/**
 * Looks up a user's email by their userId from the database.
 * Returns 'anonymous' if the user cannot be found.
 */
async function resolveUserEmail(userId?: string): Promise<string> {
  if (!userId) return 'anonymous';
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

// ---------------------------------------------------------------------------
// Middleware Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Express middleware that evaluates prompts through GuardService.
 *
 * @param options - Optional configuration to customize guard behavior
 * @returns Express middleware function
 *
 * @example
 * // Basic usage on a route
 * router.post('/chat', guardMiddleware(), async (req, res) => { ... });
 *
 * @example
 * // Monitor-only mode (logs but never blocks)
 * router.post('/sandbox', guardMiddleware({ monitorOnly: true }), handler);
 *
 * @example
 * // Custom prompt field name
 * router.post('/query', guardMiddleware({ promptField: 'message' }), handler);
 */
export function guardMiddleware(options: GuardMiddlewareOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (
    req: GuardedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // -----------------------------------------------------------------------
    // 1. Skip if configured
    // -----------------------------------------------------------------------
    if (config.skip) {
      next();
      return;
    }

    // -----------------------------------------------------------------------
    // 2. Extract prompt and platform from request body
    // -----------------------------------------------------------------------
    const prompt = req.body?.[config.promptField];
    const platform = req.body?.[config.platformField] || 'unknown';

    // No prompt in body -> nothing to guard, pass through
    if (!prompt || typeof prompt !== 'string') {
      next();
      return;
    }

    // -----------------------------------------------------------------------
    // 3. Build guard context from authenticated request
    // -----------------------------------------------------------------------
    const userEmail = await resolveUserEmail(req.userId);
    const userRole = toUserRole(req.userRole);
    const orgId = req.body?.orgId || undefined;
    const sessionToken = req.headers?.['x-session-token'] as string | undefined;
    const sessionIp = req.ip || req.socket.remoteAddress;

    try {
      // ---------------------------------------------------------------------
      // 4. Evaluate prompt through GuardService
      // ---------------------------------------------------------------------
      const verdict = await GuardService.evaluate({
        userEmail,
        userRole,
        orgId,
        textInputs: [prompt],
        sessionToken,
        sessionIp,
        headers: req.headers as Record<string, string>,
      });

      // Attach verdict to request for downstream handlers
      req.guardVerdict = verdict;

      // ---------------------------------------------------------------------
      // 5. Handle verdict based on action
      // ---------------------------------------------------------------------

      // BLOCK: Reject the request immediately
      if (verdict.verdict === 'BLOCK' && !config.monitorOnly) {
        res.status(403).json({
          error: 'Prompt blocked by security policy',
          reason: verdict.reason,
          detail: verdict.detail,
          risk_level: verdict.risk_level,
        });
        return;
      }

      // ESCALATE: Flag for review but allow through with warning headers
      if (verdict.verdict === 'ESCALATE') {
        res.setHeader('X-Guard-Escalated', 'true');
        res.setHeader('X-Guard-Reason', verdict.reason);
        res.setHeader('X-Guard-Risk-Level', verdict.risk_level);
      }

      // ALLOW, ESCALATE (non-blocked): Continue to route handler
      next();
    } catch (error) {
      // -------------------------------------------------------------------
      // 6. Handle GuardService failures gracefully
      // -------------------------------------------------------------------
      console.error('[GuardMiddleware] Evaluation failed:', error);

      // Log the failure for observability
      await logGuardFailure(userEmail, platform, prompt, error);

      if (config.fallbackAction === 'BLOCK') {
        // Fail-closed: block requests when guard is unavailable
        res.status(503).json({
          error: 'Security evaluation unavailable. Request blocked.',
          code: 'GUARD_UNAVAILABLE',
        });
        return;
      }

      // Fail-open: allow request but log the incident
      console.warn('[GuardMiddleware] Falling back to ALLOW due to config');
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: Log guard evaluation failures
// ---------------------------------------------------------------------------

/**
 * Logs a guard evaluation failure to the database for incident tracking.
 * Uses a fire-and-forget pattern to avoid blocking the request pipeline.
 *
 * @param userEmail - Email of the requesting user
 * @param platform - Target AI platform
 * @param prompt - The prompt that failed evaluation
 * @param error - The error that caused the failure
 */
async function logGuardFailure(
  userEmail: string,
  platform: string,
  prompt: string,
  error: unknown,
): Promise<void> {
  try {
    await prisma.guardLog.create({
      data: {
                          userEmail,
        userRole: 'member',
        platform,
        verdict: 'ERROR',
        reason: error instanceof Error ? error.message : 'Unknown error',
        detail: prompt.substring(0, 200),
        riskLevel: 'CRITICAL',
        actionTaken: 'ERROR',
        action: 'ERROR',
      },
    });
  } catch (dbError) {
    // If even logging fails, write to stderr - do NOT throw
    console.error('[GuardMiddleware] Failed to log guard failure:', dbError);
  }
}

// ---------------------------------------------------------------------------
// Convenience: Pre-configured middleware instances
// ---------------------------------------------------------------------------

/** Standard guard middleware with default settings (fail-closed) */
export const guard = guardMiddleware();

/** Monitor-only guard - logs verdicts but never blocks requests */
export const guardMonitor = guardMiddleware({ monitorOnly: true });

/** Lenient guard - falls back to ALLOW when GuardService is unavailable */
export const guardLenient = guardMiddleware({ fallbackAction: 'ALLOW' });
