import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth';

export const settingsRouter = Router();

// All settings routes require authentication
settingsRouter.use(authenticate);

const updateSettingsSchema = z.object({
  blockingEnabled: z.boolean().optional(),
  alertsEnabled: z.boolean().optional(),
  sensitivityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  allowedDomains: z.array(z.string().url()).optional(),
  blockedCategories: z.array(z.string()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  slackWebhookUrl: z.string().url().nullable().optional(),
  emailAlerts: z.boolean().optional(),
  alertEmail: z.string().email().nullable().optional(),
});

// GET /api/v1/settings
settingsRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.userId },
    });

    // Auto-create default settings if none exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.userId! },
      });
    }

    res.json(settings);
  } catch (err) { next(err); }
});

// PATCH /api/v1/settings
settingsRouter.patch('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = updateSettingsSchema.parse(req.body);

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId },
      update: updates,
      create: { userId: req.userId!, ...updates },
    });

    res.json(settings);
  } catch (err) { next(err); }
});

// DELETE /api/v1/settings (reset to defaults)
settingsRouter.delete('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.userSettings.delete({
      where: { userId: req.userId },
    });

    // Re-create with defaults
    const settings = await prisma.userSettings.create({
      data: { userId: req.userId! },
    });

    res.json(settings);
  } catch (err) { next(err); }
});