import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth';
import { DetectionService } from '../services/detectionService';

export const scanRouter = Router();

// Scan requires authentication
scanRouter.use(authenticate);

const scanSchema = z.object({
  prompt: z.string().min(1).max(50000),
  platform: z.string().min(1).max(100),
  url: z.string().url().optional(),
  context: z.record(z.unknown()).optional(),
});

// POST /api/v1/scan
// Core endpoint: called by extension on every prompt submission
scanRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prompt, platform, url, context } = scanSchema.parse(req.body);
    const userId = req.userId!;

    // Fetch user settings to apply personal sensitivity config
    let settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.userSettings.create({ data: { userId } });
    }

    // Fetch active policies for the user
    const policies = await prisma.policy.findMany({
      where: {
        isActive: true,
        OR: [{ userId }, { isGlobal: true }],
      },
    });

    // Run detection
    const detectionResult = DetectionService.scan({
      prompt,
      platform,
      settings,
      policies,
    });

    // Determine action based on settings and result
    let action: 'BLOCKED' | 'WARNED' | 'ALLOWED' = 'ALLOWED';
    if (detectionResult.riskScore >= 80 && settings.blockingEnabled) {
      action = 'BLOCKED';
    } else if (detectionResult.riskScore >= 40 && settings.alertsEnabled) {
      action = 'WARNED';
    }

    // Persist event asynchronously — don't block the response
    prisma.detectionEvent.create({
      data: {
        userId,
        platform,
        url: url ?? null,
        promptHash: DetectionService.hashPrompt(prompt),
        riskScore: detectionResult.riskScore,
        categories: detectionResult.categories,
        action,
        findings: detectionResult.findings as object[],
        context: (context ?? {}) as object,
      },
    }).catch((err: unknown) => {
      // Log but don't fail the scan response
      console.error('[scan] Failed to persist detection event:', err);
    });

    res.json({
      action,
      riskScore: detectionResult.riskScore,
      categories: detectionResult.categories,
      findings: detectionResult.findings,
      message: getScanMessage(action, detectionResult.riskScore),
    });
  } catch (err) { next(err); }
});

// POST /api/v1/scan/batch
// For bulk scanning (e.g., policy pre-checks)
scanRouter.post('/batch', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batchSchema = z.object({
      prompts: z.array(scanSchema).min(1).max(50),
    });

    const { prompts } = batchSchema.parse(req.body);
    const userId = req.userId!;

    const settings = await prisma.userSettings.findUnique({ where: { userId } })
      ?? await prisma.userSettings.create({ data: { userId } });

    const policies = await prisma.policy.findMany({
      where: {
        isActive: true,
        OR: [{ userId }, { isGlobal: true }],
      },
    });

    const results = prompts.map(({ prompt, platform }) => {
      const detectionResult = DetectionService.scan({ prompt, platform, settings, policies });
      const action: 'BLOCKED' | 'WARNED' | 'ALLOWED' =
        detectionResult.riskScore >= 80 && settings.blockingEnabled ? 'BLOCKED'
        : detectionResult.riskScore >= 40 && settings.alertsEnabled ? 'WARNED'
        : 'ALLOWED';

      return {
        platform,
        action,
        riskScore: detectionResult.riskScore,
        categories: detectionResult.categories,
      };
    });

    res.json({ results });
  } catch (err) { next(err); }
});

function getScanMessage(action: string, riskScore: number): string {
  if (action === 'BLOCKED') {
    return `Prompt blocked — risk score ${riskScore}/100 exceeds your policy threshold.`;
  }
  if (action === 'WARNED') {
    return `Caution: risk score ${riskScore}/100 detected. Review before submitting.`;
  }
  return `Prompt cleared — risk score ${riskScore}/100.`;
}