/**
 * FYI Guard - Organization Routes
 * CRUD for orgs, membership, domain management, invites
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const orgRouter = Router();

// All org routes require auth
orgRouter.use(authenticate);

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  domain: z.string().email().optional(),
});

/** POST /organizations - Create a new org */
orgRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, slug } = createOrgSchema.parse(req.body);
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new AppError('Organization slug already taken', 409);

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: { userId: req.userId!, role: 'admin' },
        },
      },
      include: { members: true },
    });

    // Update user's orgId
    await prisma.user.update({
      where: { id: req.userId! },
      data: { orgId: org.id, role: 'ADMIN' },
    });

    // Auto-add email domain if work email
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (user?.email) {
      const emailDomain = user.email.split('@')[1];
      const publicDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com'];
      if (!publicDomains.includes(emailDomain)) {
        await prisma.orgDomain.create({
          data: { orgId: org.id, domain: emailDomain },
        });
      }
    }

    res.status(201).json({ org });
  } catch (err) { next(err); }
});

/** GET /organizations/mine - Get user's org */
orgRouter.get('/mine', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.orgMember.findMany({
      where: { userId: req.userId! },
      include: {
        org: { include: { domains: true, members: { include: { user: { select: { id: true, email: true, name: true, role: true } } } } } },
      },
    });
    res.json({ organizations: memberships });
  } catch (err) { next(err); }
});

/** GET /organizations/:id - Get org details */
orgRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: req.userId! } },
    });
    if (!member) throw new AppError('Not a member of this organization', 403);

    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        domains: true,
        members: { include: { user: { select: { id: true, email: true, name: true, role: true } } } },
      },
    });
    res.json({ org });
  } catch (err) { next(err); }
});

/** POST /organizations/:id/invite - Invite a user */
orgRouter.post('/:id/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(['member', 'admin']).default('member'),
    }).parse(req.body);

    // Check requester is admin
    const requester = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: req.userId! } },
    });
    if (!requester || requester.role !== 'admin') throw new AppError('Only admins can invite', 403);

    // Find or check user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found. They must register first.', 404);

    // Check already member
    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: user.id } },
    });
    if (existing) throw new AppError('User is already a member', 409);

    await prisma.orgMember.create({
      data: { orgId: req.params.id, userId: user.id, role },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: req.params.id },
    });

    res.status(201).json({ message: 'User invited successfully' });
  } catch (err) { next(err); }
});

/** DELETE /organizations/:id/members/:userId - Remove member */
orgRouter.delete('/:id/members/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requester = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: req.userId! } },
    });
    if (!requester || requester.role !== 'admin') throw new AppError('Only admins can remove members', 403);

    await prisma.orgMember.delete({
      where: { orgId_userId: { orgId: req.params.id, userId: req.params.userId } },
    });
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

/** POST /organizations/:id/domains - Add domain */
orgRouter.post('/:id/domains', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { domain } = z.object({ domain: z.string().min(3) }).parse(req.body);
    const requester = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: req.userId! } },
    });
    if (!requester || requester.role !== 'admin') throw new AppError('Only admins can manage domains', 403);

    const orgDomain = await prisma.orgDomain.create({
      data: { orgId: req.params.id, domain },
    });
    res.status(201).json({ domain: orgDomain });
  } catch (err) { next(err); }
});

/** GET /organizations/:id/dashboard - Admin analytics dashboard */
orgRouter.get('/:id/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requester = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: req.params.id, userId: req.userId! } },
    });
    if (!requester || requester.role !== 'admin') throw new AppError('Admin access required', 403);

    const orgId = req.params.id;
    const members = await prisma.orgMember.findMany({ where: { orgId } });
    const userIds = members.map(m => m.userId);

    const [alerts, sessions, events] = await Promise.all([
      prisma.adminAlert.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.behaviorSession.findMany({
        where: { userId: { in: userIds } },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }),
      prisma.detectionEvent.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const totalTime = sessions.reduce((s, sess) => s + sess.durationSeconds, 0);
    const riskSummary = {
      critical: events.filter(e => e.riskLevel === 'CRITICAL').length,
      high: events.filter(e => e.riskLevel === 'HIGH').length,
      medium: events.filter(e => e.riskLevel === 'MEDIUM').length,
      low: events.filter(e => e.riskLevel === 'LOW').length,
    };

    res.json({
      orgId,
      totalMembers: members.length,
      totalAlerts: alerts.length,
      recentAlerts: alerts.slice(0, 10),
      totalTimeHours: Math.round(totalTime / 3600 * 10) / 10,
      riskSummary,
      totalEvents: events.length,
      recentSessions: sessions.slice(0, 20),
    });
  } catch (err) { next(err); }
});
