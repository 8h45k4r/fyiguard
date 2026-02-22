import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GuardService, GuardContext, UserRole, GuardAction } from '../services/guardService';
import { authenticate, AuthRequest } from '../middleware/auth';

export const guardRouter = Router();

// Schema for the evaluate endpoint
const evaluateSchema = z.object({
  userEmail: z.string().email(),
  userRole: z.enum(['member', 'org_admin', 'superadmin']),
  orgId: z.string().optional(),
  action: z.enum([
    'view_own_profile',
    'view_org_members',
    'change_org_settings',
    'change_domain_plan',
    'add_remove_domains',
    'promote_to_org_admin',
    'delete_any_user',
    'grant_free_forever',
  ]).optional(),
  payload: z.record(z.unknown()).optional(),
  sessionToken: z.string().optional(),
  sessionIp: z.string().optional(),
  textInputs: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * POST /api/v1/guard/evaluate
 *
 * Core Guard endpoint. Accepts a GuardContext and returns a structured verdict.
 * This is the single entry point for all guard evaluations.
 *
 * Auth: Required (internal service-to-service or admin calls)
 */
guardRouter.post(
  '/evaluate',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = evaluateSchema.parse(req.body);

      const ctx: GuardContext = {
        userEmail: parsed.userEmail,
        userRole: parsed.userRole as UserRole,
        orgId: parsed.orgId,
        action: parsed.action as GuardAction | undefined,
        payload: parsed.payload,
        sessionToken: parsed.sessionToken,
        sessionIp: parsed.sessionIp ?? req.ip ?? undefined,
        textInputs: parsed.textInputs,
        headers: parsed.headers,
      };

      const verdict = await GuardService.evaluate(ctx);

      // Per spec: block messages to end users must be generic
      if (verdict.verdict === 'BLOCK') {
        res.status(403).json({
          verdict: verdict.verdict,
          reason: verdict.reason,
          message: 'Access denied. Contact your administrator.',
          risk_level: verdict.risk_level,
          timestamp: verdict.timestamp,
        });
        return;
      }

      if (verdict.verdict === 'ESCALATE') {
        res.status(202).json({
          verdict: verdict.verdict,
          reason: verdict.reason,
          message: 'Request is pending admin review.',
          risk_level: verdict.risk_level,
          timestamp: verdict.timestamp,
        });
        return;
      }

      // ALLOW — full verdict for internal consumers
      res.json(verdict);
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/guard/check-input
 *
 * Lightweight endpoint: only runs Content Guard + Override Detection.
 * Used by the extension for real-time text input scanning.
 */
guardRouter.post(
  '/check-input',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const inputSchema = z.object({
        userEmail: z.string().email(),
        textInputs: z.array(z.string()).min(1),
        headers: z.record(z.string()).optional(),
      });

      const parsed = inputSchema.parse(req.body);

      const ctx: GuardContext = {
        userEmail: parsed.userEmail,
        userRole: 'member',
        textInputs: parsed.textInputs,
        headers: parsed.headers,
      };

      // Only check override + malicious input (fast path)
      const overrideResult = GuardService.checkOverrideAttempt(ctx);
      if (overrideResult) {
        res.status(403).json({
          verdict: overrideResult.verdict,
          reason: overrideResult.reason,
          message: 'Access denied. Contact your administrator.',
          risk_level: overrideResult.risk_level,
        });
        return;
      }

      const maliciousResult = GuardService.checkMaliciousInput(ctx);
      if (maliciousResult) {
        res.status(403).json({
          verdict: maliciousResult.verdict,
          reason: maliciousResult.reason,
          message: 'Access denied. Contact your administrator.',
          risk_level: maliciousResult.risk_level,
        });
        return;
      }

      res.json({
        verdict: 'ALLOW',
        reason: 'OK',
        message: 'Input is clean.',
        risk_level: 'low',
      });
    } catch (err) { next(err); }
  },
);