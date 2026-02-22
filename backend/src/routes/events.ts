import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const eventSchema = z.object({
  id: z.string(),
  eventType: z.enum(['BLOCK', 'WARN', 'ALLOW']),
  detection: z.object({
    category: z.string(),
    confidence: z.number(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    patternMatched: z.string(),
    sanitizedMatch: z.string(),
  }),
  context: z.object({
    platform: z.string(),
    url: z.string(),
    conversationId: z.string().nullable().optional(),
    promptLength: z.number(),
  }),
  metadata: z.object({
    extensionVersion: z.string(),
    browser: z.string(),
    userAction: z.string(),
  }),
});

// POST /api/v1/events - log a detection event
eventsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = eventSchema.parse(req.body);
    const event = await prisma.detectionEvent.create({
      data: {
        id: data.id,
        userId: req.userId!,
        eventType: data.eventType as 'BLOCK' | 'WARN' | 'ALLOW',
        category: data.detection.category,
        confidence: data.detection.confidence,
        riskLevel: data.detection.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        patternMatched: data.detection.patternMatched,
        sanitizedMatch: data.detection.sanitizedMatch,
        platform: data.context.platform,
        url: data.context.url,
        conversationId: data.context.conversationId ?? null,
        promptLength: data.context.promptLength,
        extensionVersion: data.metadata.extensionVersion,
        browser: data.metadata.browser,
        userAction: data.metadata.userAction,
      },
    });
    res.status(201).json(event);
  } catch (err) { next(err); }
});

// GET /api/v1/events - list events
eventsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', category, riskLevel } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = { userId: req.userId };
    if (category) where.category = category;
    if (riskLevel) where.riskLevel = riskLevel;
    const [events, total] = await Promise.all([
      prisma.detectionEvent.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.detectionEvent.count({ where }),
    ]);
    res.json({ events, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// DELETE /api/v1/events/:id
eventsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const event = await prisma.detectionEvent.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
    await prisma.detectionEvent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (err) { next(err); }
});

// POST /api/v1/events/batch - batch log detection events
eventsRouter.post('/batch', async (req: AuthRequest, res, next) => {
  try {
    const { events } = req.body as { events: unknown[] };
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'events array required' });
      return;
    }
    const results = [];
    for (const raw of events.slice(0, 50)) {
      const data = eventSchema.parse(raw);
      const event = await prisma.detectionEvent.create({
        data: {
          id: data.id,
          userId: req.userId!,
          eventType: data.eventType as 'BLOCK' | 'WARN' | 'ALLOW',
          category: data.detection.category,
          confidence: data.detection.confidence,
          riskLevel: data.detection.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          patternMatched: data.detection.patternMatched,
          sanitizedMatch: data.detection.sanitizedMatch,
          platform: data.context.platform,
          url: data.context.url,
          conversationId: data.context.conversationId ?? null,
          promptLength: data.context.promptLength,
          extensionVersion: data.metadata.extensionVersion,
          browser: data.metadata.browser,
          userAction: data.metadata.userAction,
        },
      });
      results.push(event);
    }
    res.status(201).json({ created: results.length });
  } catch (err) { next(err); }
});