import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Types for Behavior Tracking
// ============================================

export interface BehaviorEvent {
  userId: string;
  orgId: string;
  platform: string;
  eventType: 'session_start' | 'session_end' | 'prompt_submitted' | 'file_uploaded' | 'detection_triggered';
  metadata?: Record<string, any>;
  timestamp?: Date;
  userEmail?: string;
}

export interface SessionData {
  userId: string;
  orgId: string;
  platform: string;
  startTime: Date;
  endTime?: Date;
  promptCount: number;
  detectionCount: number;
  blockedCount: number;
  userEmail?: string;
}

export interface UsageSummary {
  userId: string;
  totalTimeMinutes: number;
  platformBreakdown: Record<string, number>;
  productivityScore: number;
  promptsSubmitted: number;
  detectionsTriggered: number;
  blockedAttempts: number;
  riskScore: number;
}

export interface OrgUsageDashboard {
  orgId: string;
  period: string;
  totalUsers: number;
  totalSessions: number;
  totalTimeHours: number;
  avgTimePerUserMinutes: number;
  platformUsage: Record<string, { users: number; timeMinutes: number; prompts: number }>;
  topUsers: Array<{ userId: string; timeMinutes: number; prompts: number }>;
  riskSummary: { critical: number; high: number; medium: number; low: number };
  productivityMetrics: { avgScore: number; topPlatform: string; peakHour: number };
}

// ============================================
// In-Memory Session Tracker
// ============================================

const activeSessions = new Map<string, SessionData>();

function getSessionKey(userId: string, platform: string): string {
  return `${userId}:${platform}`;
}

/**
 * Start or resume a behavior tracking session
 */
export async function startSession(event: BehaviorEvent): Promise<string> {
  const key = getSessionKey(event.userId, event.platform);
  const existing = activeSessions.get(key);

  if (existing) {
    return key;
  }

  const session: SessionData = {
    userId: event.userId,
    orgId: event.orgId,
    platform: event.platform,
    startTime: event.timestamp || new Date(),
    promptCount: 0,
    detectionCount: 0,
    blockedCount: 0,
    userEmail: event.userEmail,
  };

  activeSessions.set(key, session);

  // Persist to DB
  await prisma.behaviorSession.create({
    data: {
      userId: event.userId,
      userEmail: event.userEmail || event.userId,
      orgId: event.orgId,
      platform: event.platform,
      startTime: session.startTime,
      promptCount: 0,
      blockedCount: 0,
    },
  });

  console.log(`[FYI Guard] Session started: ${key}`);
  return key;
}

/**
 * End a behavior tracking session
 */
export async function endSession(userId: string, platform: string): Promise<SessionData | null> {
  const key = getSessionKey(userId, platform);
  const session = activeSessions.get(key);

  if (!session) return null;

  session.endTime = new Date();
  activeSessions.delete(key);

  const durationMs = session.endTime.getTime() - session.startTime.getTime();
  const durationSeconds = Math.round(durationMs / 1000);
  const durationMinutes = Math.round(durationMs / 60000);

  // Update DB record
  await prisma.behaviorSession.updateMany({
    where: {
      userId,
      platform,
      endTime: null,
    },
    data: {
      endTime: session.endTime,
      durationSeconds,
      promptCount: session.promptCount,
      blockedCount: session.blockedCount,
    },
  });

  // Update daily usage summary
  await updateDailyUsageSummary(userId, session.orgId, platform, durationMinutes, session);

  console.log(`[FYI Guard] Session ended: ${key}, duration: ${durationMinutes}min`);
  return session;
}

/**
 * Record a behavior event (prompt, detection, etc.)
 */
export async function recordBehaviorEvent(event: BehaviorEvent): Promise<void> {
  const key = getSessionKey(event.userId, event.platform);
  let session = activeSessions.get(key);

  // Auto-start session if not active
  if (!session) {
    await startSession(event);
    session = activeSessions.get(key)!;
  }

  switch (event.eventType) {
    case 'prompt_submitted':
      session.promptCount++;
      break;
    case 'detection_triggered':
      session.detectionCount++;
      break;
    case 'file_uploaded':
      session.promptCount++;
      break;
  }

  // Check if blocked
  if (event.metadata?.blocked) {
    session.blockedCount++;
  }
}

/**
 * Update or create daily usage summary
 */
async function updateDailyUsageSummary(
  userId: string,
  orgId: string,
  platform: string,
  durationMinutes: number,
  session: SessionData
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.dailyUsageSummary.findFirst({
    where: {
      userId,
      platform,
      date: today,
    },
  });

  if (existing) {
    await prisma.dailyUsageSummary.update({
      where: { id: existing.id },
      data: {
        totalMinutes: existing.totalMinutes + durationMinutes,
        sessionCount: existing.sessionCount + 1,
        promptCount: existing.promptCount + session.promptCount,
        detectionCount: existing.detectionCount + session.detectionCount,
        blockedCount: existing.blockedCount + session.blockedCount,
      },
    });
  } else {
    await prisma.dailyUsageSummary.create({
      data: {
        userId,
        userEmail: session.userEmail || userId,
        orgId,
        platform,
        date: today,
        totalMinutes: durationMinutes,
        sessionCount: 1,
        promptCount: session.promptCount,
        detectionCount: session.detectionCount,
        blockedCount: session.blockedCount,
      },
    });
  }
}

// ============================================
// Analytics Query Functions
// ============================================

/**
 * Get usage summary for a specific user
 */
export async function getUserUsageSummary(
  userId: string,
  days: number = 30
): Promise<UsageSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const summaries = await prisma.dailyUsageSummary.findMany({
    where: {
      userId,
      date: { gte: since },
    },
  });

  const platformBreakdown: Record<string, number> = {};
  let totalMinutes = 0;
  let totalPrompts = 0;
  let totalDetections = 0;
  let totalBlocked = 0;

  for (const s of summaries) {
    totalMinutes += s.totalMinutes;
    totalPrompts += s.promptCount;
    totalDetections += s.detectionCount;
    totalBlocked += s.blockedCount;
    const plat = s.platform || 'all';
    platformBreakdown[plat] = (platformBreakdown[plat] || 0) + s.totalMinutes;
  }

  // Calculate productivity score (0-100)
  const productivityScore = calculateProductivityScore(
    totalPrompts, totalDetections, totalBlocked, totalMinutes
  );

  // Calculate risk score (0-100)
  const riskScore = calculateRiskScore(totalDetections, totalBlocked, totalPrompts);

  return {
    userId,
    totalTimeMinutes: totalMinutes,
    platformBreakdown,
    productivityScore,
    promptsSubmitted: totalPrompts,
    detectionsTriggered: totalDetections,
    blockedAttempts: totalBlocked,
    riskScore,
  };
}

/**
 * Get organization-wide usage dashboard
 */
export async function getOrgUsageDashboard(
  orgId: string,
  days: number = 30
): Promise<OrgUsageDashboard> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const summaries = await prisma.dailyUsageSummary.findMany({
    where: {
      orgId,
      date: { gte: since },
    },
  });

  const sessions = await prisma.behaviorSession.findMany({
    where: {
      orgId,
      startTime: { gte: since },
    },
  });

  // Aggregate data
  const userSet = new Set<string>();
  const platformData: Record<string, { users: Set<string>; timeMinutes: number; prompts: number }> = {};
  const userTotals: Record<string, { timeMinutes: number; prompts: number }> = {};
  let totalMinutes = 0;
  let totalPrompts = 0;
  let totalDetections = 0;
  let totalBlocked = 0;

  for (const s of summaries) {
    userSet.add(s.userId);
    totalMinutes += s.totalMinutes;
    totalPrompts += s.promptCount;
    totalDetections += s.detectionCount;
    totalBlocked += s.blockedCount;

    const plat = s.platform || 'all';
    if (!platformData[plat]) {
      platformData[plat] = { users: new Set<string>(), timeMinutes: 0, prompts: 0 };
    }
    platformData[plat].users.add(s.userId);
    platformData[plat].timeMinutes += s.totalMinutes;
    platformData[plat].prompts += s.promptCount;

    if (!userTotals[s.userId]) {
      userTotals[s.userId] = { timeMinutes: 0, prompts: 0 };
    }
    userTotals[s.userId].timeMinutes += s.totalMinutes;
    userTotals[s.userId].prompts += s.promptCount;
  }

  // Get risk level counts from detection events
  const events = await prisma.detectionEvent.findMany({
    where: {
      createdAt: { gte: since },
    },
    select: { riskLevel: true },
  });

  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const e of events) {
    const level = e.riskLevel.toLowerCase() as keyof typeof riskCounts;
    if (level in riskCounts) riskCounts[level]++;
  }

  // Build platform usage (convert Sets to counts)
  const platformUsage: Record<string, { users: number; timeMinutes: number; prompts: number }> = {};
  for (const [platform, data] of Object.entries(platformData)) {
    platformUsage[platform] = {
      users: data.users.size,
      timeMinutes: data.timeMinutes,
      prompts: data.prompts,
    };
  }

  // Top users by time
  const topUsers = Object.entries(userTotals)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.timeMinutes - a.timeMinutes)
    .slice(0, 10);

  // Find top platform and peak hour
  const topPlatform = Object.entries(platformUsage)
    .sort((a, b) => b[1].timeMinutes - a[1].timeMinutes)[0]?.[0] || 'N/A';

  // Peak hour from sessions
  const hourCounts = new Array(24).fill(0);
  for (const sess of sessions) {
    hourCounts[sess.startTime.getHours()]++;
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  const avgProductivity = userSet.size > 0
    ? Math.round((totalPrompts / Math.max(totalMinutes, 1)) * 100)
    : 0;

  return {
    orgId,
    period: `${days} days`,
    totalUsers: userSet.size,
    totalSessions: sessions.length,
    totalTimeHours: Math.round(totalMinutes / 60 * 10) / 10,
    avgTimePerUserMinutes: userSet.size > 0 ? Math.round(totalMinutes / userSet.size) : 0,
    platformUsage,
    topUsers,
    riskSummary: riskCounts,
    productivityMetrics: {
      avgScore: Math.min(avgProductivity, 100),
      topPlatform,
      peakHour,
    },
  };
}

// ============================================
// Scoring & Helper Functions
// ============================================

/**
 * Calculate productivity score (0-100)
 * Higher score = more prompts per minute with fewer blocks
 */
function calculateProductivityScore(
  prompts: number,
  detections: number,
  blocked: number,
  minutes: number
): number {
  if (minutes === 0) return 0;

  const promptRate = prompts / minutes;
  const blockPenalty = blocked / Math.max(prompts, 1);
  const detectionPenalty = detections / Math.max(prompts, 1);

  let score = Math.min(promptRate * 30, 60);
  score += Math.max(0, 25 * (1 - detectionPenalty));
  score += Math.max(0, 15 * (1 - blockPenalty));

  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Calculate risk score (0-100)
 * Higher score = more risky behavior
 */
function calculateRiskScore(
  detections: number,
  blocked: number,
  prompts: number
): number {
  if (prompts === 0) return 0;

  const detectionRate = detections / prompts;
  const blockRate = blocked / prompts;

  const score = (detectionRate * 40) + (blockRate * 60);
  return Math.round(Math.min(score * 100, 100));
}

/**
 * Get trending data for charts (daily breakdown)
 */
export async function getTrendingData(
  orgId: string,
  days: number = 30
): Promise<Array<{ date: string; totalMinutes: number; prompts: number; detections: number; blocked: number; uniqueUsers: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const summaries = await prisma.dailyUsageSummary.findMany({
    where: {
      orgId,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  const dailyMap: Record<string, { totalMinutes: number; prompts: number; detections: number; blocked: number; users: Set<string> }> = {};

  for (const s of summaries) {
    const dateKey = s.date.toISOString().split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        totalMinutes: 0,
        prompts: 0,
        detections: 0,
        blocked: 0,
        users: new Set<string>(),
      };
    }
    dailyMap[dateKey].totalMinutes += s.totalMinutes;
    dailyMap[dateKey].prompts += s.promptCount;
    dailyMap[dateKey].detections += s.detectionCount;
    dailyMap[dateKey].blocked += s.blockedCount;
    dailyMap[dateKey].users.add(s.userId);
  }

  return Object.entries(dailyMap).map(([date, data]) => ({
    date,
    totalMinutes: data.totalMinutes,
    prompts: data.prompts,
    detections: data.detections,
    blocked: data.blocked,
    uniqueUsers: data.users.size,
  }));
}

/**
 * Get user leaderboard for an org
 */
export async function getUserLeaderboard(
  orgId: string,
  days: number = 30,
  sortBy: 'time' | 'productivity' | 'risk' = 'time'
): Promise<UsageSummary[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const summaries = await prisma.dailyUsageSummary.findMany({
    where: {
      orgId,
      date: { gte: since },
    },
  });

  const userMap: Record<string, { totalMinutes: number; prompts: number; detections: number; blocked: number; platforms: Record<string, number> }> = {};

  for (const s of summaries) {
    if (!userMap[s.userId]) {
      userMap[s.userId] = { totalMinutes: 0, prompts: 0, detections: 0, blocked: 0, platforms: {} };
    }
    userMap[s.userId].totalMinutes += s.totalMinutes;
    userMap[s.userId].prompts += s.promptCount;
    userMap[s.userId].detections += s.detectionCount;
    userMap[s.userId].blocked += s.blockedCount;
    const plat = s.platform || 'all';
    userMap[s.userId].platforms[plat] = (userMap[s.userId].platforms[plat] || 0) + s.totalMinutes;
  }

  const leaderboard: UsageSummary[] = Object.entries(userMap).map(([userId, data]) => {
    const productivityScore = calculateProductivityScore(
      data.prompts, data.detections, data.blocked, data.totalMinutes
    );
    const riskScore = calculateRiskScore(data.detections, data.blocked, data.prompts);

    return {
      userId,
      totalTimeMinutes: data.totalMinutes,
      platformBreakdown: data.platforms,
      productivityScore,
      promptsSubmitted: data.prompts,
      detectionsTriggered: data.detections,
      blockedAttempts: data.blocked,
      riskScore,
    };
  });

  switch (sortBy) {
    case 'productivity':
      return leaderboard.sort((a, b) => b.productivityScore - a.productivityScore);
    case 'risk':
      return leaderboard.sort((a, b) => b.riskScore - a.riskScore);
    default:
      return leaderboard.sort((a, b) => b.totalTimeMinutes - a.totalTimeMinutes);
  }
}
