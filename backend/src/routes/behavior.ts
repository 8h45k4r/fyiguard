import { Router, Request, Response } from 'express';
import {
  startSession,
  endSession,
  recordBehaviorEvent,
  getUserUsageSummary,
  getOrgUsageDashboard,
  getTrendingData,
  getUserLeaderboard,
} from '../services/behaviorService';

const router = Router();

/**
 * POST /api/behavior/session/start
 * Start a new tracking session
 */
router.post('/session/start', async (req: Request, res: Response) => {
  try {
    const { userId, orgId, platform } = req.body;

    if (!userId || !orgId || !platform) {
      return res.status(400).json({ error: 'Missing required fields: userId, orgId, platform' });
    }

    const sessionKey = await startSession({
      userId,
      orgId,
      platform,
      eventType: 'session_start',
    });

    res.status(201).json({ success: true, sessionKey });
  } catch (error) {
    console.error('[FYI Guard] Session start error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * POST /api/behavior/session/end
 * End a tracking session
 */
router.post('/session/end', async (req: Request, res: Response) => {
  try {
    const { userId, platform } = req.body;

    if (!userId || !platform) {
      return res.status(400).json({ error: 'Missing required fields: userId, platform' });
    }

    const session = await endSession(userId, platform);

    if (!session) {
      return res.status(404).json({ error: 'No active session found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('[FYI Guard] Session end error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * POST /api/behavior/event
 * Record a behavior event
 */
router.post('/event', async (req: Request, res: Response) => {
  try {
    const { userId, orgId, platform, eventType, metadata } = req.body;

    if (!userId || !orgId || !platform || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await recordBehaviorEvent({
      userId,
      orgId,
      platform,
      eventType,
      metadata,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[FYI Guard] Behavior event error:', error);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

/**
 * GET /api/behavior/user/:userId/summary
 * Get usage summary for a user
 */
router.get('/user/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;

    const summary = await getUserUsageSummary(userId, parseInt(days as string));
    res.json(summary);
  } catch (error) {
    console.error('[FYI Guard] User summary error:', error);
    res.status(500).json({ error: 'Failed to fetch user summary' });
  }
});

/**
 * GET /api/behavior/org/:orgId/dashboard
 * Get org-wide usage dashboard
 */
router.get('/org/:orgId/dashboard', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { days = '30' } = req.query;

    const dashboard = await getOrgUsageDashboard(orgId, parseInt(days as string));
    res.json(dashboard);
  } catch (error) {
    console.error('[FYI Guard] Org dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch org dashboard' });
  }
});

/**
 * GET /api/behavior/org/:orgId/trending
 * Get trending data for charts
 */
router.get('/org/:orgId/trending', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { days = '30' } = req.query;

    const trending = await getTrendingData(orgId, parseInt(days as string));
    res.json(trending);
  } catch (error) {
    console.error('[FYI Guard] Trending data error:', error);
    res.status(500).json({ error: 'Failed to fetch trending data' });
  }
});

/**
 * GET /api/behavior/org/:orgId/leaderboard
 * Get user leaderboard
 */
router.get('/org/:orgId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { days = '30', sortBy = 'time' } = req.query;

    const leaderboard = await getUserLeaderboard(
      orgId,
      parseInt(days as string),
      sortBy as 'time' | 'productivity' | 'risk'
    );
    res.json(leaderboard);
  } catch (error) {
    console.error('[FYI Guard] Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;