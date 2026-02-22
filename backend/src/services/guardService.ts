/**
 * FYI Guard — Core Verdict Engine
 *
 * Evaluates every request, action, and data payload and returns a structured
 * verdict: ALLOW, BLOCK, or ESCALATE. Stateless per evaluation.
 *
 * Implements all 6 core responsibilities from the Guard system prompt:
 *   1. Domain Access Control
 *   2. Seat Limit Enforcement
 *   3. Role-Based Action Guard
 *   4. Content & Input Guard
 *   5. Session Integrity
 *   6. Admin Override Detection
 */

import { prisma } from '../server';

// ────────────────────── Types ──────────────────────

export type Verdict = 'ALLOW' | 'BLOCK' | 'ESCALATE';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionTaken = 'logged' | 'blocked' | 'flagged_for_review' | 'session_terminated';

export type ReasonCode =
  | 'OK'
  | 'SEAT_LIMIT_REACHED'
  | 'DOMAIN_MISMATCH'
  | 'DOMAIN_UNKNOWN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'MALICIOUS_INPUT_DETECTED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'SUSPICIOUS_MULTI_LOGIN'
  | 'OVERRIDE_ATTEMPT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ACCOUNT_SUSPENDED'
  | 'FREE_FOREVER_CONFIRMED';

export type UserRole = 'member' | 'org_admin' | 'superadmin';

export type GuardAction =
  | 'view_own_profile'
  | 'view_org_members'
  | 'change_org_settings'
  | 'change_domain_plan'
  | 'add_remove_domains'
  | 'promote_to_org_admin'
  | 'delete_any_user'
  | 'grant_free_forever';

export interface GuardVerdict {
  verdict: Verdict;
  reason: ReasonCode;
  detail: string;
  risk_level: RiskLevel;
  action_taken: ActionTaken;
  timestamp: string;
  user: {
    email: string;
    domain: string;
    role: string;
  };
}

export interface GuardContext {
  userEmail: string;
  userRole: UserRole;
  orgId?: string;
  action?: GuardAction;
  payload?: Record<string, unknown>;
  sessionToken?: string;
  sessionIp?: string;
  textInputs?: string[];
  headers?: Record<string, string>;
}

// ────────────────── Plan Seat Caps ─────────────────

const PLAN_SEAT_LIMITS: Record<string, number> = {
  free_trial: 5,
  pro: 25,
  enterprise: Infinity,
  free_forever: Infinity,
};

// ──────────── Role Permission Matrix ───────────────

const ACTION_MIN_ROLE: Record<GuardAction, UserRole> = {
  view_own_profile: 'member',
  view_org_members: 'org_admin',
  change_org_settings: 'org_admin',
  change_domain_plan: 'superadmin',
  add_remove_domains: 'superadmin',
  promote_to_org_admin: 'superadmin',
  delete_any_user: 'superadmin',
  grant_free_forever: 'superadmin',
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  member: 0,
  org_admin: 1,
  superadmin: 2,
};

// ────────── Content & Input Guard Patterns ──────────

const MALICIOUS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // SQL injection
  { name: 'SQL_INJECTION', pattern: /('\s*(OR|AND)\s+\d+\s*=\s*\d+|;\s*(DROP|DELETE|UPDATE|INSERT|ALTER)\s|UNION\s+SELECT|--\s*$)/i },
  // XSS / script injection
  { name: 'XSS_INJECTION', pattern: /(<script[^>]*>|javascript\s*:|on(load|error|click|mouseover)\s*=)/i },
  // Prompt injection
  { name: 'PROMPT_INJECTION', pattern: /(ignore\s+(previous|prior|all)\s+instructions|disregard\s+(all\s+)?instructions|you\s+are\s+now|new\s+system\s+prompt|forget\s+(everything|all))/i },
  // Role impersonation in inputs
  { name: 'ROLE_IMPERSONATION', pattern: /\b(superadmin|ADMIN_OVERRIDE|system\s*admin|root\s*access)\b/i },
];

// Override attempt patterns — checked in payloads, headers, all inputs
// This rule CANNOT be disabled. It has NO whitelist.
const OVERRIDE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'ADMIN_KEY', pattern: /__admin__/i },
  { name: 'BYPASS_FLAG', pattern: /bypass\s*=\s*true/i },
  { name: 'ROLE_OVERRIDE', pattern: /role\s*[=:]\s*['"]?superadmin/i },
  { name: 'GRANT_ALL', pattern: /grant_all/i },
  { name: 'FORCE_AUTH', pattern: /force_auth\s*=\s*true/i },
  { name: 'PRIVILEGE_ESCALATION', pattern: /\belevate_privilege|admin_token|master_key\b/i },
];

// ────────────────── Guard Service ─────────────────

export class GuardService {

  // ── Helper: build verdict object ──
  private static verdict(
    v: Verdict,
    reason: ReasonCode,
    detail: string,
    risk: RiskLevel,
    actionTaken: ActionTaken,
    email: string,
    domain: string,
    role: string,
  ): GuardVerdict {
    return {
      verdict: v,
      reason,
      detail,
      risk_level: risk,
      action_taken: actionTaken,
      timestamp: new Date().toISOString(),
      user: { email, domain, role },
    };
  }

  private static extractDomain(email: string): string {
    return email.split('@')[1]?.toLowerCase() ?? '';
  }

  private static hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  }

  // ==========================================
  // 6. ADMIN OVERRIDE DETECTION (checked FIRST)
  //    This rule cannot be disabled.
  // ==========================================
  static checkOverrideAttempt(ctx: GuardContext): GuardVerdict | null {
    const domain = this.extractDomain(ctx.userEmail);
    const allStrings = this.collectAllStrings(ctx);

    for (const str of allStrings) {
      for (const rule of OVERRIDE_PATTERNS) {
        if (rule.pattern.test(str)) {
          return this.verdict(
            'BLOCK',
            'OVERRIDE_ATTEMPT',
            `Override attempt detected: ${rule.name} in input`,
            'critical',
            'session_terminated',
            ctx.userEmail, domain, ctx.userRole,
          );
        }
      }
    }
    return null;
  }

  // ==========================================
  // 4. CONTENT & INPUT GUARD
  // ==========================================
  static checkMaliciousInput(ctx: GuardContext): GuardVerdict | null {
    const domain = this.extractDomain(ctx.userEmail);
    const textInputs = ctx.textInputs ?? [];

    for (const text of textInputs) {
      for (const rule of MALICIOUS_PATTERNS) {
        if (rule.pattern.test(text)) {
          return this.verdict(
            'BLOCK',
            'MALICIOUS_INPUT_DETECTED',
            `Malicious input detected: ${rule.name}`,
            'high',
            'blocked',
            ctx.userEmail, domain, ctx.userRole,
          );
        }
      }
    }
    return null;
  }

  // ==========================================
  // 3. ROLE-BASED ACTION GUARD
  // ==========================================
  static checkPermission(ctx: GuardContext): GuardVerdict | null {
    if (!ctx.action) return null; // no action to guard
    const domain = this.extractDomain(ctx.userEmail);
    const required = ACTION_MIN_ROLE[ctx.action];

    if (!required) return null; // unknown action, let it pass to next guard

    if (!this.hasRole(ctx.userRole, required)) {
      return this.verdict(
        'BLOCK',
        'INSUFFICIENT_PERMISSIONS',
        `Action "${ctx.action}" requires role "${required}", user has "${ctx.userRole}"`,
        'medium',
        'blocked',
        ctx.userEmail, domain, ctx.userRole,
      );
    }
    return null;
  }

  // ==========================================
  // 1. DOMAIN ACCESS CONTROL
  // ==========================================
  static async checkDomainAccess(ctx: GuardContext): Promise<GuardVerdict | null> {
    if (!ctx.orgId) return null;
    const domain = this.extractDomain(ctx.userEmail);

    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: { domains: true },
    });

    if (!org) return null; // org doesn't exist, other guards handle

    // Check if user's domain is registered
    const orgDomains = org.domains.map((d: { domain: string }) => d.domain.toLowerCase());
    const domainRecord = org.domains.find(
      (d: { domain: string }) => d.domain.toLowerCase() === domain
    );

    // If domain is not registered in the system at all
    if (!domainRecord && orgDomains.length > 0) {
      // If restrictSameDomain is enabled, block
      if (org.restrictSameDomain) {
        return this.verdict(
          'BLOCK',
          'DOMAIN_MISMATCH',
          `Email domain "${domain}" does not match org registered domains`,
          'medium',
          'blocked',
          ctx.userEmail, domain, ctx.userRole,
        );
      }

      // Domain not registered = UNKNOWN, escalate to admin
      return this.verdict(
        'ESCALATE',
        'DOMAIN_UNKNOWN',
        `Domain "${domain}" is not registered in the system`,
        'medium',
        'flagged_for_review',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    // If domain has free_forever plan, always allow regardless of seat count
    if (domainRecord && domainRecord.plan === 'free_forever') {
      return this.verdict(
        'ALLOW',
        'FREE_FOREVER_CONFIRMED',
        `Domain "${domain}" has admin-granted free_forever access`,
        'low',
        'logged',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    return null;
  }

  // ==========================================
  // 2. SEAT LIMIT ENFORCEMENT
  // ==========================================
  static async checkSeatLimit(ctx: GuardContext): Promise<GuardVerdict | null> {
    if (!ctx.orgId) return null;
    const domain = this.extractDomain(ctx.userEmail);

    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: { _count: { select: { members: true } }, domains: true },
    });

    if (!org) return null;

    // Check if domain has free_forever (unlimited seats)
    const domainRecord = org.domains.find(
      (d: { domain: string }) => d.domain.toLowerCase() === domain
    );
    if (domainRecord?.plan === 'free_forever') {
      return null; // free_forever = unlimited, skip seat check
    }

    const plan = org.plan ?? 'free_trial';
    const seatCap = PLAN_SEAT_LIMITS[plan] ?? 5;
    const currentMembers = org._count.members;

    if (currentMembers >= seatCap) {
      return this.verdict(
        'BLOCK',
        'SEAT_LIMIT_REACHED',
        `Org has ${currentMembers}/${seatCap} seats (plan: ${plan}). No seats available.`,
        'low',
        'blocked',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    return null;
  }

  // ==========================================
  // 5. SESSION INTEGRITY
  // ==========================================
  static async checkSessionIntegrity(ctx: GuardContext): Promise<GuardVerdict | null> {
    if (!ctx.sessionToken) return null;
    const domain = this.extractDomain(ctx.userEmail);

    const session = await prisma.session.findUnique({
      where: { token: ctx.sessionToken },
    });

    if (!session) {
      return this.verdict(
        'BLOCK',
        'SESSION_INVALID',
        'Session token does not match any stored session',
        'high',
        'session_terminated',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    // Check if session belongs to the claimed user
    if (session.userEmail !== ctx.userEmail) {
      return this.verdict(
        'BLOCK',
        'SESSION_INVALID',
        'Session token does not match claimed user identity',
        'critical',
        'session_terminated',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    // Check TTL
    const ttlMs = (session.ttlSeconds ?? 3600) * 1000;
    if (Date.now() - session.createdAt.getTime() > ttlMs) {
      return this.verdict(
        'BLOCK',
        'SESSION_EXPIRED',
        `Session created at ${session.createdAt.toISOString()} exceeds TTL of ${session.ttlSeconds}s`,
        'medium',
        'session_terminated',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    // Check IP class mismatch (192.x vs 10.x)
    if (ctx.sessionIp && session.ipAddress) {
      const sessionClass = session.ipAddress.split('.')[0];
      const currentClass = ctx.sessionIp.split('.')[0];
      if (sessionClass !== currentClass) {
        return this.verdict(
          'ESCALATE',
          'SESSION_INVALID',
          `Session created from IP class ${sessionClass}.x, current request from ${currentClass}.x`,
          'high',
          'flagged_for_review',
          ctx.userEmail, domain, ctx.userRole,
        );
      }
    }

    // Check multi-login: 3+ IPs within 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentSessions = await prisma.session.findMany({
      where: {
        userEmail: ctx.userEmail,
        createdAt: { gte: tenMinAgo },
      },
      select: { ipAddress: true },
    });

    const uniqueIps = new Set(recentSessions.map((s: { ipAddress: string | null }) => s.ipAddress).filter(Boolean));
    if (uniqueIps.size >= 3) {
      return this.verdict(
        'ESCALATE',
        'SUSPICIOUS_MULTI_LOGIN',
        `${uniqueIps.size} unique IPs detected for ${ctx.userEmail} in last 10 minutes`,
        'high',
        'flagged_for_review',
        ctx.userEmail, domain, ctx.userRole,
      );
    }

    return null;
  }

  // ==========================================
  // Helper: collect all strings from context for scanning
  // ==========================================
  private static collectAllStrings(ctx: GuardContext): string[] {
    const strings: string[] = [];

    // Text inputs
    if (ctx.textInputs) strings.push(...ctx.textInputs);

    // Payload values (deep stringify)
    if (ctx.payload) {
      strings.push(JSON.stringify(ctx.payload));
    }

    // Headers
    if (ctx.headers) {
      for (const [key, value] of Object.entries(ctx.headers)) {
        strings.push(`${key}=${value}`);
      }
    }

    return strings;
  }

  // ==========================================
  // LOG VERDICT (fire-and-forget)
  // Every BLOCK and ESCALATE must produce a log entry.
  // ALLOWs with anomaly flags are also logged.
  // ==========================================
  private static logVerdict(verdict: GuardVerdict, ctx: GuardContext): void {
    prisma.guardLog.create({
      data: {
        verdict: verdict.verdict,
        reason: verdict.reason,
        detail: verdict.detail,
        riskLevel: verdict.risk_level,
        actionTaken: verdict.action_taken,
        userEmail: ctx.userEmail,
        userRole: ctx.userRole,
        orgId: ctx.orgId ?? null,
        action: ctx.action ?? null,
        ipAddress: ctx.sessionIp ?? null,
        payload: ctx.payload ? JSON.stringify(ctx.payload) : null,
      },
    }).catch((err: unknown) => {
      console.error('[FYI Guard] Failed to log verdict:', err);
    });
  }

  // ==========================================
  // MAIN EVALUATE ORCHESTRATOR
  //
  // Evaluation order (intentional):
  //   1. Override Detection (ALWAYS first, cannot be disabled)
  //   2. Content & Input Guard
  //   3. Role-Based Action Guard
  //   4. Domain Access Control
  //   5. Seat Limit Enforcement
  //   6. Session Integrity
  //
  // First non-null verdict wins. If all pass => ALLOW.
  // ==========================================
  static async evaluate(ctx: GuardContext): Promise<GuardVerdict> {
    const domain = this.extractDomain(ctx.userEmail);

    // 1. Override Detection (FIRST — cannot be disabled)
    const overrideResult = this.checkOverrideAttempt(ctx);
    if (overrideResult) {
      this.logVerdict(overrideResult, ctx);
      return overrideResult;
    }

    // 2. Content & Input Guard
    const maliciousResult = this.checkMaliciousInput(ctx);
    if (maliciousResult) {
      this.logVerdict(maliciousResult, ctx);
      return maliciousResult;
    }

    // 3. Role-Based Action Guard
    const permResult = this.checkPermission(ctx);
    if (permResult) {
      this.logVerdict(permResult, ctx);
      return permResult;
    }

    // 4. Domain Access Control
    const domainResult = await this.checkDomainAccess(ctx);
    if (domainResult) {
      this.logVerdict(domainResult, ctx);
      return domainResult;
    }

    // 5. Seat Limit Enforcement
    const seatResult = await this.checkSeatLimit(ctx);
    if (seatResult) {
      this.logVerdict(seatResult, ctx);
      return seatResult;
    }

    // 6. Session Integrity
    const sessionResult = await this.checkSessionIntegrity(ctx);
    if (sessionResult) {
      this.logVerdict(sessionResult, ctx);
      return sessionResult;
    }

    // ALL CHECKS PASSED — ALLOW
    const allowVerdict = this.verdict(
      'ALLOW',
      'OK',
      'All guard checks passed',
      'low',
      'logged',
      ctx.userEmail, domain, ctx.userRole,
    );

    // Log ALLOWs too (for audit trail)
    this.logVerdict(allowVerdict, ctx);
    return allowVerdict;
  }
}