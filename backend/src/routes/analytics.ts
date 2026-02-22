import { Router, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

export const analyticsRouter = Router();

// All analytics routes require authentication
analyticsRouter.use(authenticate);

// GET /api/v1/analytics/summary
analyticsRouter.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const [totalEvents, blockedEvents, warnedEvents, recentEvents] = await Promise.all([
      prisma.detectionEvent.count({ where: { userId } }),
      prisma.detectionEvent.count({ where: { userId, action: 'BLOCKED' } }),
      prisma.detectionEvent.count({ where: { userId, action: 'WARNED' } }),
      prisma.detectionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          platform: true,
          riskScore: true,
          action: true,
          createdAt: true,
          categories: true,
        },
      }),
    ]);

    res.json({
      totalEvents,
      blockedEvents,
      warnedEvents,
      allowedEvents: totalEvents - blockedEvents - warnedEvents,
      blockRate: totalEvents > 0 ? (blockedEvents / totalEvents) * 100 : 0,
      recentEvents,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/by-platform
analyticsRouter.get('/by-platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const results = await prisma.detectionEvent.groupBy({
      by: ['platform'],
      where: { userId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const formatted = results.map((r) => ({
      platform: r.platform,
      count: r._count.id,
    }));

    res.json(formatted);
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/by-category
analyticsRouter.get('/by-category', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const events = await prisma.detectionEvent.findMany({
      where: { userId },
      select: { categories: true },
    });

    const categoryCount: Record<string, number> = {};
    for (const event of events) {
      const categories = event.categories as string[];
      for (const cat of categories) {
        categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
      }
    }

    const formatted = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    res.json(formatted);
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/timeline?days=30
analyticsRouter.get('/timeline', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const days = Math.min(parseInt(req.query['days'] as string ?? '30', 10), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.detectionEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true, action: true },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by day
    const timeline: Record<string, { blocked: number; warned: number; allowed: number }> = {};
    for (const event of events) {
      const day = event.createdAt.toISOString().split('T')[0]!;
      if (!timeline[day]) {
        timeline[day] = { blocked: 0, warned: 0, allowed: 0 };
      }
      if (event.action === 'BLOCKED') timeline[day]!.blocked++;
      else if (event.action === 'WARNED') timeline[day]!.warned++;
      else timeline[day]!.allowed++;
    }

    const formatted = Object.entries(timeline).map(([date, counts]) => ({ date, ...counts }));

    res.json(formatted);
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/admin/overview (admin only)
analyticsRouter.get('/admin/overview', requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalEvents, blockedEvents] = await Promise.all([
      prisma.user.count(),
      prisma.detectionEvent.count(),
      prisma.detectionEvent.count({ where: { action: 'BLOCKED' } }),
    ]);

    res.json({ totalUsers, totalEvents, blockedEvents });
  } catch (err) { next(err); }
});