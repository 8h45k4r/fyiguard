import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { processAlert } from '../services/alertService';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/alerts
 * Process and create a new alert for org admins
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orgId, userId, category, riskLevel, eventType, platform, details, eventId } = req.body;

    if (!orgId || !userId || !category || !riskLevel) {
      return res.status(400).json({ error: 'Missing required fields: orgId, userId, category, riskLevel' });
    }

    const alertId = await processAlert({
      orgId,
      userId,
      category,
      riskLevel,
      eventType: eventType || 'BLOCK',
      platform: platform || 'unknown',
      details: details || '',
      eventId,
    });

    res.status(201).json({ success: true, alertId });
  } catch (error) {
    console.error('[FYI Guard] Alert processing error:', error);
    res.status(500).json({ error: 'Failed to process alert' });
  }
});

/**
 * GET /api/alerts/:orgId
 * Get alerts for an organization
 */
router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { page = '1', limit = '50', severity, resolved } = req.query;

    const where: any = { orgId };
    if (severity) where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved === 'true';

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [alerts, total] = await Promise.all([
      prisma.adminAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.adminAlert.count({ where }),
    ]);

    res.json({
      alerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('[FYI Guard] Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * PATCH /api/alerts/:alertId/resolve
 * Mark an alert as resolved
 */
router.patch('/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy, notes } = req.body;

    const alert = await prisma.adminAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'admin',
        notes: notes || '',
      },
    });

    res.json({ success: true, alert });
  } catch (error) {
    console.error('[FYI Guard] Alert resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/alerts/:orgId/summary
 * Get alert summary stats for dashboard
 */
router.get('/:orgId/summary', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { days = '30' } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    const [total, unresolved, critical, high] = await Promise.all([
      prisma.adminAlert.count({ where: { orgId, createdAt: { gte: since } } }),
      prisma.adminAlert.count({ where: { orgId, resolved: false, createdAt: { gte: since } } }),
      prisma.adminAlert.count({ where: { orgId, severity: 'CRITICAL', createdAt: { gte: since } } }),
      prisma.adminAlert.count({ where: { orgId, severity: 'HIGH', createdAt: { gte: since } } }),
    ]);

    res.json({
      period: `${days} days`,
      total,
      unresolved,
      critical,
      high,
      resolvedRate: total > 0 ? Math.round(((total - unresolved) / total) * 100) : 100,
    });
  } catch (error) {
    console.error('[FYI Guard] Alert summary error:', error);
    res.status(500).json({ error: 'Failed to fetch alert summary' });
  }
});

export default router;