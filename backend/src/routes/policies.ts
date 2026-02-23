import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';

export const policiesRouter = Router();

// All policy routes require authentication
policiesRouter.use(authenticate);

const createPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  rules: z.array(
    z.object({
      category: z.string().min(1),
      action: z.enum(['BLOCK', 'WARN', 'ALLOW']),
      patterns: z.array(z.string()).optional(),
    })
  ),
  isActive: z.boolean().default(true),
});

const updatePolicySchema = createPolicySchema.partial();

// GET /api/v1/policies
policiesRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policies = await prisma.policy.findMany({
      where: {
        OR: [
          { userId: req.userId },
          { isGlobal: true },
        ],
      },
      include: { rules: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(policies);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policies/:id
policiesRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policy = await prisma.policy.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.userId },
          { isGlobal: true },
        ],
      },
      include: { rules: true },
    });
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/policies
policiesRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPolicySchema.parse(req.body);
    const policy = await prisma.policy.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        userId: req.userId!,
        rules: {
          create: data.rules.map((rule) => ({
            category: rule.category,
            action: rule.action,
            patterns: rule.patterns || [],
          })),
        },
      },
      include: { rules: true },
    });
    res.status(201).json(policy);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/policies/:id
policiesRouter.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = updatePolicySchema.parse(req.body);
    const existing = await prisma.policy.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    // If rules are being updated, delete existing and create new ones
    if (updates.rules) {
      await prisma.policyRule.deleteMany({
        where: { policyId: req.params.id },
      });
    }

    const policy = await prisma.policy.update({
      where: { id: req.params.id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.rules && {
          rules: {
            create: updates.rules.map((rule) => ({
              category: rule.category,
              action: rule.action,
              patterns: rule.patterns || [],
            })),
          },
        }),
      },
      include: { rules: true },
    });
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/policies/:id
policiesRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.policy.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    await prisma.policy.delete({ where: { id: req.params.id } });
    res.json({ message: 'Policy deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policies/global (admin only)
policiesRouter.get('/admin/global', requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policies = await prisma.policy.findMany({
      where: { isGlobal: true },
      include: { rules: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(policies);
  } catch (err) {
    next(err);
  }
});
