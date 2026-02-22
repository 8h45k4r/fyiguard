/**
 * FYI Guard - Zod Validation Schemas
 *
 * Centralized input validation for all API routes.
 * Each schema validates request body/params before reaching route handlers.
 *
 * Usage in routes:
 *   import { scanRequestSchema } from '../lib/validation';
 *   const parsed = scanRequestSchema.parse(req.body);
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared Enums & Primitives
// ---------------------------------------------------------------------------

export const riskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const detectionCategoryEnum = z.enum([
  'PII',
  'API_KEY',
  'CREDENTIAL',
  'FINANCIAL',
  'MEDICAL',
  'CONFIDENTIAL',
  'CODE_SECRET',
]);

// ---------------------------------------------------------------------------
// /api/v1/scan
// ---------------------------------------------------------------------------

export const scanRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text too long'),
  platform: z.string().optional(),
  settings: z
    .object({
      enabledCategories: z.array(detectionCategoryEnum).optional(),
      sensitivityLevel: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

// ---------------------------------------------------------------------------
// /api/v1/guard/check
// ---------------------------------------------------------------------------

export const guardCheckSchema = z.object({
  prompt: z.string().min(1).max(50000),
  platform: z.string().min(1),
  userId: z.string().optional(),
  orgId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type GuardCheckRequest = z.infer<typeof guardCheckSchema>;

// ---------------------------------------------------------------------------
// /api/v1/events
// ---------------------------------------------------------------------------

const detectionEventSchema = z.object({
  id: z.string(),
  eventType: z.enum(['BLOCK', 'WARN', 'ALLOW']),
  timestamp: z.string().or(z.date()),
  detection: z.object({
    category: detectionCategoryEnum,
    riskLevel: riskLevelEnum,
    confidence: z.number().min(0).max(1),
    matchedPattern: z.string().optional(),
    context: z.string().optional(),
  }),
  context: z.object({
    platform: z.string(),
    url: z.string(),
    promptLength: z.number(),
  }),
  metadata: z.object({
    extensionVersion: z.string(),
    browser: z.string(),
    userAction: z.string(),
  }),
});

export const eventsRequestSchema = z.object({
  events: z.array(detectionEventSchema).min(1).max(100),
});

export type EventsRequest = z.infer<typeof eventsRequestSchema>;

// ---------------------------------------------------------------------------
// /api/v1/settings
// ---------------------------------------------------------------------------

export const settingsUpdateSchema = z.object({
  enabledCategories: z.array(detectionCategoryEnum).optional(),
  sensitivityLevel: z.enum(['low', 'medium', 'high']).optional(),
  blockMode: z.enum(['block', 'warn', 'monitor']).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

// ---------------------------------------------------------------------------
// /api/v1/auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(1, 'Name is required').max(100),
  orgName: z.string().optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Reusable validation middleware factory
// ---------------------------------------------------------------------------

import { Request, Response, NextFunction } from 'express';

/**
 * Creates Express middleware that validates req.body against a Zod schema.
 * Returns 400 with structured error details on validation failure.
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}